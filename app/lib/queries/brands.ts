import { db } from "../db";
import { revalidatePath } from "next/cache";
import { BrandManagerHistoryEntry, BrandType } from "../definitions";
import { getManagerById } from "./managers";
import { DomainError } from "../errors";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getBrandsByManagerId(managerId: string) {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          b.id as id,
          b.name as name,
          b.manager_id as manager_id
        FROM brands b
        WHERE b.manager_id = $1 
        ORDER BY b.name ASC
      `,
      args: [managerId],
    });
    return result.rows as unknown as BrandType[];
  } catch (error) {
    console.error("Error fetching brands by manager ID:", error);
    return [];
  }
}

export async function getBrandById(id: string) {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          b.id as id,
          b.name as name,
          b.manager_id,
          b.business_unit_id,
          m.name as manager_name,
          m.email as manager_email,
          m.phone as manager_phone,
          m.client_id as manager_client_id,
          c.id as client_id,
          c.name as client_name,
          c.accept_business_units,
          co.id as country_id,
          co.name as country_name,
          co.flag as country_flag
        FROM brands b
        LEFT JOIN managers m ON b.manager_id = m.id
        JOIN clients c ON b.client_id = c.id
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE b.id = $1
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    const clientInfo = {
      id: row.client_id,
      name: row.client_name,
      accept_business_units: Boolean(row.accept_business_units),
      country: row.country_id
        ? {
            id: row.country_id,
            name: row.country_name,
            flag: row.country_flag,
          }
        : undefined,
    };

    return {
      id: row.id,
      name: row.name,
      manager_id: row.manager_id,
      client_id: row.client_id,
      business_unit_id: row.business_unit_id,
      client_info: clientInfo,
      manager: {
        id: row.manager_id,
        // Cliente REAL del gerente. Puede diferir del cliente de la marca si el
        // gerente fue trasladado: la marca conserva su cliente original.
        client_id: row.manager_client_id,
        name: row.manager_name,
        email: row.manager_email,
        phone: row.manager_phone,
        client_info: clientInfo,
      },
    } as BrandType;
  } catch (error) {
    console.error("Error fetching brand:", error);
    return null;
  }
}

export async function getBrands() {
  try {
    const result = await db.execute(
      `SELECT * FROM brands ORDER BY name ASC`
    );
    return result.rows as unknown as BrandType[];
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
}

export async function createBrand(brandData: Omit<BrandType, "id">) {
  try {
    // El cliente de la marca se fija al crearla, a partir del cliente del
    // gerente inicial. A partir de ahí es inmutable: trasladar al gerente NO
    // cambia el cliente de la marca (ver migración 012).
    const manager = await getManagerById(brandData.manager_id.toString());
    if (!manager) {
      throw new DomainError(
        "MANAGER_NOT_FOUND",
        "El gerente especificado no existe"
      );
    }

    const clientId = Number(manager.client_id);

    const brandResult = await db.execute({
      sql: `INSERT INTO brands (name, manager_id, business_unit_id, client_id)
      VALUES ($1, $2, $3, $4) RETURNING id`,
      args: [
        brandData.name,
        brandData.manager_id,
        brandData.business_unit_id ?? null,
        clientId,
      ],
    });

    const brandId = Number(brandResult.rows[0]?.id);

    revalidatePath(`/clients/${clientId}`);

    return {
      id: brandId,
      ...brandData,
      client_id: clientId,
    };
  } catch (error) {
    console.error("Error creating brand:", error);
    throw error;
  }
}

/**
 * Actualiza una marca.
 *
 * GUARDRAIL: cambiar el gerente NUNCA cambia el cliente de la marca. El nuevo
 * gerente debe pertenecer al mismo `brands.client_id`; de lo contrario se lanza
 * `DomainError("MANAGER_CLIENT_MISMATCH")`. Antes de la migración 012 el cliente
 * se derivaba del gerente, así que reasignar a un gerente de otro laboratorio
 * movía la marca de cliente en silencio.
 *
 * @param changedBy id del usuario que ejecuta el cambio (auditoría)
 */
export async function updateBrand(
  id: string,
  updateData: Partial<BrandType>,
  changedBy?: number | null,
  reason?: string | null
) {
  try {
    const { name, manager_id, business_unit_id } = updateData;
    const updates = [];
    const args = [];

    // Si hay un cambio de manager, necesitamos el estado actual antes de actualizar
    let currentBrand = null;
    if (manager_id) {
      currentBrand = await getBrandById(id);
      if (!currentBrand) {
        throw new DomainError("BRAND_NOT_FOUND", "La marca no existe");
      }

      if (currentBrand.manager_id !== manager_id) {
        const newManager = await getManagerById(manager_id.toString());
        if (!newManager) {
          throw new DomainError(
            "MANAGER_NOT_FOUND",
            "El gerente especificado no existe"
          );
        }
        if (Number(newManager.client_id) !== Number(currentBrand.client_id)) {
          throw new DomainError(
            "MANAGER_CLIENT_MISMATCH",
            "El gerente pertenece a otro cliente. Una marca solo puede asignarse a gerentes de su mismo cliente."
          );
        }
      }
    }

    // Build update statement based on provided fields
    if (name) {
      updates.push(`name = $${args.length + 1}`);
      args.push(name);
    }

    if (manager_id) {
      updates.push(`manager_id = $${args.length + 1}`);
      args.push(manager_id);
    }

    if (business_unit_id) {
      updates.push(`business_unit_id = $${args.length + 1}`);
      args.push(business_unit_id);
    }

    if (updates.length > 0) {
      // Add the id at the end of args for WHERE clause
      args.push(id);

      // Use db transaction API
      const transaction = await db.transaction("write");

      try {
        // Actualizar la marca
        await transaction.execute({
          sql: `UPDATE brands SET ${updates.join(", ")} WHERE id = $${args.length}`,
          args,
        });

        // Si hay cambio de manager, registrar en la tabla de historial
        if (
          manager_id &&
          currentBrand &&
          currentBrand.manager_id !== manager_id
        ) {
          await transaction.execute({
            sql: `INSERT INTO brand_manager_history
                    (brand_id, previous_manager_id, new_manager_id, changed_by, reason, changed_at)
                  VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            args: [
              id,
              currentBrand.manager_id,
              manager_id,
              changedBy ?? null,
              reason ?? null,
            ],
          });
        }

        // Confirmar transacción
        await transaction.commit();

        // Get the updated brand to return
        const updatedBrand = await getBrandById(id);

        // Revalidate paths
        revalidatePath("/brands");
        revalidatePath(`/brands/${id}`);
        if (currentBrand?.client_id) {
          revalidatePath(`/clients/${currentBrand.client_id}`);
        }

        return updatedBrand;
      } catch (error) {
        // Deshacer transacción en caso de error
        await transaction.rollback();
        throw error;
      }
    }

    // If no fields to update, just return the existing brand
    return getBrandById(id);
  } catch (error) {
    console.error("Error updating brand:", error);
    throw error;
  }
}

interface PaginationParams {
  managerId?: string;
  clientId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getBrandsWithPagination({
  managerId,
  clientId,
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
}: PaginationParams) {
  try {
    // LEFT JOIN a managers: solo aporta `manager_name` y el término de búsqueda.
    // El cliente ya NO se deriva del gerente (migración 012), así que una marca
    // sin gerente asignado debe seguir apareciendo en el listado.
    let sql = `
      SELECT b.id as id, b.name as brand_name,
            b.manager_id, b.client_id, m.name as manager_name
      FROM brands b
      LEFT JOIN managers m ON b.manager_id = m.id
    `;
    const filterArgs: Array<string | number> = [];

    // Build WHERE clause
    const conditions: string[] = [];

    if (managerId) {
      filterArgs.push(managerId);
      conditions.push(`b.manager_id = $${filterArgs.length}`);
    }

    if (clientId) {
      filterArgs.push(clientId);
      // Columna propia de brands, no derivada del gerente.
      conditions.push(`b.client_id = $${filterArgs.length}`);
    }

    if (search) {
      const searchParam = `%${search}%`;
      filterArgs.push(searchParam);
      const p1 = filterArgs.length;
      filterArgs.push(searchParam);
      const p2 = filterArgs.length;
      conditions.push(`(unaccent(b.name) ILIKE unaccent($${p1}) OR unaccent(m.name) ILIKE unaccent($${p2}))`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // El COUNT ya no necesita managers para filtrar por cliente, pero sí para
    // la búsqueda por nombre de gerente. LEFT JOIN para no alterar el total.
    let countSql = `
      SELECT COUNT(*) as count
      FROM brands b
      LEFT JOIN managers m ON b.manager_id = m.id
    `;
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }

    const countResult = await db.execute({
      sql: countSql,
      args: filterArgs,
    });

    const total = Number(countResult.rows[0].count);

    // Add order by and pagination
    sql += ` ORDER BY b.name ASC LIMIT $${filterArgs.length + 1} OFFSET $${filterArgs.length + 2}`;
    const offset = (page - 1) * limit;
    const args = [...filterArgs, limit, offset];

    // Execute query
    const result = await db.execute({
      sql,
      args,
    });

    // Transform the result
    const brands = result.rows.map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      manager_id: row.manager_id,
      manager_name: row.manager_name,
      client_id: row.client_id,
    }));

    return {
      brands,
      total,
    };
  } catch (error) {
    console.error("Error fetching brands with pagination:", error);
    return { brands: [], total: 0 };
  }
}

// Historial de cambios de gerente de una marca, con el actor que los ejecutó.
export async function getBrandManagerHistory(
  brandId: string
): Promise<BrandManagerHistoryEntry[]> {
  try {
    const historyResult = await db.execute({
      sql: `
        SELECT
          bmh.id,
          bmh.brand_id,
          bmh.previous_manager_id,
          prev_m.name as previous_manager_name,
          bmh.new_manager_id,
          new_m.name as new_manager_name,
          bmh.changed_by,
          u.name as changed_by_name,
          bmh.reason,
          bmh.changed_at
        FROM brand_manager_history bmh
        LEFT JOIN managers prev_m ON bmh.previous_manager_id = prev_m.id
        LEFT JOIN managers new_m  ON bmh.new_manager_id      = new_m.id
        LEFT JOIN users    u      ON bmh.changed_by          = u.id
        WHERE bmh.brand_id = $1
        ORDER BY bmh.changed_at DESC
      `,
      args: [brandId],
    });

    return historyResult.rows.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      previousManagerId: row.previous_manager_id,
      previousManagerName: row.previous_manager_name,
      newManagerId: row.new_manager_id,
      newManagerName: row.new_manager_name,
      changedBy: row.changed_by,
      changedByName: row.changed_by_name,
      reason: row.reason,
      changedAt: row.changed_at,
    })) as unknown as BrandManagerHistoryEntry[];
  } catch (error) {
    console.error("Error fetching brand manager history:", error);
    return [];
  }
}
