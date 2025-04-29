import { turso } from "../db";
import { revalidatePath } from "next/cache";
import { BrandType } from "../definitions";
import { getManagerById } from "./managers";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getBrandsByManagerId(managerId: string) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT 
          b.id as id,
          b.name as name,
          b.manager_id as manager_id
        FROM brands b
        WHERE b.manager_id = ? 
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
    const result = await turso.execute({
      sql: `
        SELECT 
          b.id as id,
          b.name as name,
          b.manager_id,
          m.name as manager_name,
          m.email as manager_email,
          m.phone as manager_phone,
          c.id as client_id,
          c.name as client_name,
          co.id as country_id,
          co.name as country_name,
          co.flag as country_flag
        FROM brands b
        JOIN managers m ON b.manager_id = m.id
        JOIN clients c ON m.client_id = c.id
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE b.id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      manager_id: row.manager_id,
      manager: {
        id: row.manager_id,
        client_id: row.client_id,
        name: row.manager_name,
        email: row.manager_email,
        phone: row.manager_phone,
        client_info: {
          id: row.client_id,
          name: row.client_name,
          country: row.country_id
            ? {
                id: row.country_id,
                name: row.country_name,
                flag: row.country_flag,
              }
            : undefined,
        },
      },
    } as BrandType;
  } catch (error) {
    console.error("Error fetching brand:", error);
    return null;
  }
}

export async function getBrands() {
  try {
    const result = await turso.execute(
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
    // No need for transaction since we're only doing a single operation now
    const brandResult = await turso.execute({
      sql: `INSERT INTO brands (name, manager_id)
      VALUES (?, ?)`,
      args: [brandData.name, brandData.manager_id],
    });

    const brandId = Number(brandResult.lastInsertRowid);

    const manager = await getManagerById(brandData.manager_id.toString());
    // Revalidamos la ruta del cliente al que pertenece el manager
    if (manager && manager.client_id) {
      revalidatePath(`/clients/${manager.client_id}`);
    }

    return {
      id: brandId,
      ...brandData,
    };
  } catch (error) {
    console.error("Error creating brand:", error);
    throw error;
  }
}

export async function updateBrand(id: string, updateData: Partial<BrandType>) {
  try {
    const { name, manager_id } = updateData;
    const updates = [];
    const args = [];

    // Si hay un cambio de manager, necesitamos obtener el manager actual antes de actualizar
    let currentBrand = null;
    if (manager_id) {
      currentBrand = await getBrandById(id);
    }

    // Build update statement based on provided fields
    if (name) {
      updates.push("name = ?");
      args.push(name);
    }

    if (manager_id) {
      updates.push("manager_id = ?");
      args.push(manager_id);
    }

    if (updates.length > 0) {
      // Add the id at the end of args for WHERE clause
      args.push(id);

      // Use Turso's transaction API
      const transaction = await turso.transaction("write");

      try {
        // Actualizar la marca
        await transaction.execute({
          sql: `UPDATE brands SET ${updates.join(", ")} WHERE id = ?`,
          args,
        });

        // Si hay cambio de manager, registrar en la tabla de historial
        if (
          manager_id &&
          currentBrand &&
          currentBrand.manager_id !== manager_id
        ) {
          await transaction.execute({
            sql: "INSERT INTO brand_manager_history (brand_id, previous_manager_id, new_manager_id, changed_at) VALUES (?, ?, ?, datetime('now', '-5 hours'))",
            args: [id, currentBrand.manager_id, manager_id],
          });
        }

        // Confirmar transacción
        await transaction.commit();

        // Get the updated brand to return
        const updatedBrand = await getBrandById(id);

        // Revalidate paths
        revalidatePath(`/brands/${id}`);

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
    // Modified query to use manager_id from brands table
    let sql = `
      SELECT b.id as id, b.name as brand_name, 
             b.manager_id, m.name as manager_name 
      FROM brands b
      JOIN managers m ON b.manager_id = m.id
    `;
    const args = [];
    const countArgs = [];

    // Build WHERE clause
    const conditions: string[] = [];

    if (managerId) {
      conditions.push("b.manager_id = ?");
      args.push(managerId);
      countArgs.push(managerId);
    }

    if (clientId) {
      conditions.push("m.client_id = ?");
      args.push(clientId);
      countArgs.push(clientId);
    }

    if (search) {
      conditions.push("(b.name LIKE ? OR m.name LIKE ?)");
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam);
      countArgs.push(searchParam, searchParam);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as count 
      FROM brands b
      JOIN managers m ON b.manager_id = m.id
    `;
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }

    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs,
    });

    const total = Number(countResult.rows[0].count);

    // Add order by and pagination
    sql += " ORDER BY b.name ASC LIMIT ? OFFSET ?";
    const offset = (page - 1) * limit;
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args,
    });

    // Transform the result
    const brands = result.rows.map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      manager_id: row.manager_id,
      manager_name: row.manager_name,
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

// Function to get brand manager history including the current manager
export async function getBrandManagerHistory(brandId: string) {
  try {
    
    // Query for past manager changes from history table
    const historyResult = await turso.execute({
      sql: `
        SELECT 
          bmh.id,
          bmh.brand_id,
          bmh.previous_manager_id,
          prev_m.name as previous_manager_name,
          bmh.new_manager_id,
          new_m.name as new_manager_name,
          bmh.changed_at
        FROM brand_manager_history bmh
        JOIN managers prev_m ON bmh.previous_manager_id = prev_m.id
        JOIN managers new_m ON bmh.new_manager_id = new_m.id
        WHERE bmh.brand_id = ?
        ORDER BY bmh.changed_at DESC
      `,
      args: [brandId],
    });
    
    // Format the history entries
    const historyEntries = historyResult.rows.map(row => ({
      id: row.id,
      brandId: row.brand_id,
      previousManagerId: row.previous_manager_id,
      previousManagerName: row.previous_manager_name,
      newManagerId: row.new_manager_id,
      newManagerName: row.new_manager_name,
      changedAt: row.changed_at
    }));
    
    return historyEntries;
  } catch (error) {
    console.error("Error fetching brand manager history:", error);
    return [];
  }
}
