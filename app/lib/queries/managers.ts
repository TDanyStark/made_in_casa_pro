import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  BrandReassignment,
  ManagerClientHistoryEntry,
  ManagerTransferPreview,
  ManagerTransferResult,
  ManagerType,
  ProjectReassignment,
} from "../definitions";
import { DomainError } from "../errors";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getManagerByEmail(email: string) {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM managers WHERE email = $1`,
      args: [email],
    });
    return result.rows.length > 0
      ? (result.rows[0] as unknown as ManagerType)
      : null;
  } catch (error) {
    console.error("Error fetching manager by email:", error);
    return null;
  }
}

export async function getManagerById(id: string) {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          m.*,
          c.id AS client_id, 
          c.name AS client_name,
          c.accept_business_units,
          co.id AS country_id,
          co.name AS country_name,
          co.flag AS country_flag
        FROM managers m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE m.id = $1
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      client_id: row.client_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      biography: row.biography,
      client_info: row.client_id
        ? {
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
          }
        : undefined,
    } as ManagerType;
  } catch (error) {
    console.error("Error fetching manager:", error);
    return null;
  }
}

export async function getManagersByClientId(clientId: string) {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM managers WHERE client_id = $1 ORDER BY name ASC`,
      args: [clientId],
    });
    return result.rows as unknown as ManagerType[];
  } catch (error) {
    console.error("Error fetching managers by client ID:", error);
    return [];
  }
}

interface PaginationParams {
  clientId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getManagersWithPagination({clientId, page = 1, limit = ITEMS_PER_PAGE, search,}: PaginationParams) {
  
  try {
    let sql = "SELECT * FROM managers";
    const filterArgs: Array<string | number> = [];
    const conditions: string[] = [];
    if (clientId) {
      filterArgs.push(clientId);
      conditions.push(`client_id = $${filterArgs.length}`);
    }
    if (search) {
      const searchParam = `%${search}%`;
      filterArgs.push(searchParam);
      const p1 = filterArgs.length;
      filterArgs.push(searchParam);
      const p2 = filterArgs.length;
      filterArgs.push(searchParam);
      const p3 = filterArgs.length;
      conditions.push(`(unaccent(name) ILIKE unaccent($${p1}) OR unaccent(email) ILIKE unaccent($${p2}) OR unaccent(phone) ILIKE unaccent($${p3}))`);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    // Get total count for pagination
    let countSql = "SELECT COUNT(*) as count FROM managers";
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }
    const countResult = await db.execute({
      sql: countSql,
      args: filterArgs,
    });
    const total = Number(countResult.rows[0].count);
    // Add pagination
    const offset = (page - 1) * limit;
    const args = [...filterArgs, limit, offset];
    sql += ` LIMIT $${filterArgs.length + 1} OFFSET $${filterArgs.length + 2}`;
    // Execute query
    const result = await db.execute({
      sql,
      args,
    });
    return {
      managers: result.rows as unknown as ManagerType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching managers with pagination:", error);
    return { managers: [], total: 0 };
  }
}

export async function createManager(managerData: Omit<ManagerType, "id">) {
  try {
    const result = await db.execute({
      sql: `INSERT INTO managers (client_id, name, email, phone, biography)
      VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      args: [
        managerData.client_id,
        managerData.name,
        managerData.email,
        managerData.phone || "", // El teléfono es opcional
        managerData.biography || "", // Asegurarnos de que nunca sea undefined
      ],
    });

    revalidatePath(`/clients/${managerData.client_id}`);

    return {
      id: Number(result.rows[0]?.id),
      ...managerData,
    };
  } catch (error) {
    console.error("Error creating manager:", error);
    throw error;
  }
}

/**
 * Actualiza los datos de contacto de un gerente.
 *
 * NO acepta `client_id` a propósito: mover un gerente de laboratorio es un
 * hecho de negocio con consecuencias (marcas y proyectos que hay que reasignar,
 * historial que registrar) y se hace exclusivamente vía `transferManager`.
 */
export async function updateManager(id: string, updateData: { email?: string; phone?: string, name?: string, biography?: string }) {
  try {
    // Build update query based on provided fields
    const updates: string[] = [];
    const args: string[] = [];

    if (updateData.email !== undefined) {
      updates.push(`email = $${args.length + 1}`);
      args.push(updateData.email);
    }

    if (updateData.phone !== undefined) {
      updates.push(`phone = $${args.length + 1}`);
      args.push(updateData.phone);
    }

    if (updateData.name !== undefined) {
      updates.push(`name = $${args.length + 1}`);
      args.push(updateData.name);
    }

    if (updateData.biography !== undefined) {
      updates.push(`biography = $${args.length + 1}`);
      args.push(updateData.biography);
    }

    // If no fields to update, return
    if (updates.length === 0) {
      return null;
    }

    // Add the ID as the last argument
    args.push(id);

    // Execute the update query
    await db.execute({
      sql: `UPDATE managers SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

    // Get and return the updated manager
    return getManagerById(id);
  } catch (error) {
    console.error("Error updating manager:", error);
    throw error;
  }
}

// ─── Traslado de gerente entre clientes ─────────────────────────────────────

export interface TransferManagerInput {
  managerId: number;
  /** Cliente destino. Debe ser distinto del actual. */
  targetClientId: number;
  /** Nuevo email corporativo en el cliente destino (opcional) */
  email?: string | null;
  /** Nuevo teléfono (opcional) */
  phone?: string | null;
  /**
   * Fecha en que el gerente empieza en el cliente destino. Se registra como
   * `manager_client_history.changed_at`; si se omite, CURRENT_TIMESTAMP.
   */
  startedAt?: string | null;
  reason?: string | null;
  /** Usuario que ejecuta el traslado (auditoría) */
  changedBy?: number | null;
  /** Marcas del cliente VIEJO que heredan otro gerente del cliente viejo */
  brandReassignments?: BrandReassignment[];
  /** Proyectos del cliente VIEJO que heredan otro gerente del cliente viejo */
  projectReassignments?: ProjectReassignment[];
}

/**
 * Traslada un gerente a otro cliente.
 *
 * Un gerente es SIEMPRE la misma fila en `managers`: el traslado es un
 * `UPDATE managers SET client_id` más una fila de historial, nunca una fila
 * duplicada. Como `brands.client_id` y `projects.client_id` son columnas
 * propias (migración 012), el traslado NO reescribe el cliente de nada
 * histórico: las marcas y proyectos se quedan en el cliente viejo y por eso
 * hay que darles un sucesor de ESE cliente antes de mover al gerente.
 *
 * Todo ocurre en una única transacción: o se traslada con sus reasignaciones y
 * su auditoría completas, o no se traslada.
 */
export async function transferManager({
  managerId,
  targetClientId,
  email,
  phone,
  startedAt,
  reason,
  changedBy,
  brandReassignments = [],
  projectReassignments = [],
}: TransferManagerInput): Promise<ManagerTransferResult> {
  // ── Validaciones previas (fuera de la transacción, solo lecturas) ─────────
  const managerResult = await db.execute({
    sql: `SELECT id, client_id, email FROM managers WHERE id = $1`,
    args: [managerId],
  });
  if (managerResult.rows.length === 0) {
    throw new DomainError("MANAGER_NOT_FOUND", "El gerente no existe");
  }
  const current = managerResult.rows[0] as unknown as {
    id: number;
    client_id: number;
    email: string;
  };
  const previousClientId = Number(current.client_id);

  if (Number(targetClientId) === previousClientId) {
    throw new DomainError(
      "SAME_CLIENT",
      "El gerente ya pertenece a ese cliente"
    );
  }

  const targetClient = await db.execute({
    sql: `SELECT id FROM clients WHERE id = $1`,
    args: [targetClientId],
  });
  if (targetClient.rows.length === 0) {
    throw new DomainError("CLIENT_NOT_FOUND", "El cliente destino no existe");
  }

  // `managers.email` es UNIQUE global: si el gerente estrena correo en el
  // cliente destino hay que comprobar que no lo tenga ya otro gerente.
  if (email && email !== current.email) {
    const emailOwner = await db.execute({
      sql: `SELECT id FROM managers WHERE email = $1 AND id <> $2`,
      args: [email, managerId],
    });
    if (emailOwner.rows.length > 0) {
      throw new DomainError(
        "EMAIL_IN_USE",
        "El correo electrónico ya está en uso por otro gerente"
      );
    }
  }

  // Las marcas / proyectos a reasignar deben ser del cliente VIEJO y su nuevo
  // responsable también, o el traslado movería datos históricos de cliente.
  const brandRows = await resolveBrandReassignments(
    brandReassignments,
    previousClientId,
    managerId
  );
  const projectRows = await resolveProjectReassignments(
    projectReassignments,
    previousClientId,
    managerId
  );

  // ── Escritura ─────────────────────────────────────────────────────────────
  let movedBrandsCount = 0;
  let movedProjectsCount = 0;
  const transaction = await db.transaction("write");
  try {
    for (const brand of brandRows) {
      await transaction.execute({
        sql: `UPDATE brands SET manager_id = $1 WHERE id = $2`,
        args: [brand.newManagerId, brand.brandId],
      });
      await transaction.execute({
        sql: `INSERT INTO brand_manager_history
                (brand_id, previous_manager_id, new_manager_id, changed_by, reason, changed_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        args: [
          brand.brandId,
          brand.previousManagerId,
          brand.newManagerId,
          changedBy ?? null,
          reason ?? null,
        ],
      });
    }

    for (const project of projectRows) {
      await transaction.execute({
        sql: `UPDATE projects SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        args: [project.newManagerId, project.projectId],
      });
      await transaction.execute({
        sql: `INSERT INTO project_manager_history
                (project_id, previous_manager_id, new_manager_id, changed_by, reason)
              VALUES ($1, $2, $3, $4, $5)`,
        args: [
          project.projectId,
          project.previousManagerId,
          project.newManagerId,
          changedBy ?? null,
          reason ?? null,
        ],
      });
    }

    // Todo lo que NO se reasignó a un sucesor sigue apuntando a este gerente y,
    // por tanto, viaja con él al nuevo cliente. Sin esto la marca quedaría con
    // `client_id` del laboratorio viejo y un gerente que ya está en el nuevo:
    // dos fuentes de verdad en desacuerdo.
    const movedBrands = await transaction.execute({
      sql: `UPDATE brands SET client_id = $1 WHERE manager_id = $2 AND client_id <> $1 RETURNING id`,
      args: [targetClientId, managerId],
    });
    movedBrandsCount = movedBrands.rows.length;

    // Los proyectos siguen a su marca: el cliente de un proyecto es el de la
    // marca sobre la que se ejecuta, no el del gerente que lo tramita.
    const movedProjects = await transaction.execute({
      sql: `UPDATE projects
               SET client_id = b.client_id, updated_at = CURRENT_TIMESTAMP
              FROM brands b
             WHERE b.id = projects.brand_id
               AND projects.manager_id = $1
               AND projects.client_id <> b.client_id
         RETURNING projects.id`,
      args: [managerId],
    });
    movedProjectsCount = movedProjects.rows.length;

    const managerUpdates = [`client_id = $1`];
    const managerArgs: unknown[] = [targetClientId];
    if (email !== undefined && email !== null) {
      managerArgs.push(email);
      managerUpdates.push(`email = $${managerArgs.length}`);
    }
    if (phone !== undefined && phone !== null) {
      managerArgs.push(phone);
      managerUpdates.push(`phone = $${managerArgs.length}`);
    }
    managerArgs.push(managerId);

    await transaction.execute({
      sql: `UPDATE managers SET ${managerUpdates.join(", ")} WHERE id = $${managerArgs.length}`,
      args: managerArgs,
    });

    await transaction.execute({
      sql: `INSERT INTO manager_client_history
              (manager_id, previous_client_id, new_client_id, changed_by, reason, changed_at)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP))`,
      args: [
        managerId,
        previousClientId,
        targetClientId,
        changedBy ?? null,
        reason ?? null,
        startedAt ?? null,
      ],
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error("Error transferring manager:", error);
    throw error;
  }

  revalidatePath("/managers");
  revalidatePath(`/managers/${managerId}`);
  revalidatePath(`/clients/${previousClientId}`);
  revalidatePath(`/clients/${targetClientId}`);
  revalidatePath("/brands");
  revalidatePath("/projects");

  return {
    manager: await getManagerById(String(managerId)),
    previous_client_id: previousClientId,
    new_client_id: Number(targetClientId),
    reassigned_brands: brandRows.length,
    reassigned_projects: projectRows.length,
    moved_brands: movedBrandsCount,
    moved_projects: movedProjectsCount,
  };
}

/**
 * Valida las reasignaciones de marca y resuelve el gerente previo de cada una.
 * Sucesor y marca deben pertenecer al cliente que el gerente está dejando.
 */
async function resolveBrandReassignments(
  reassignments: BrandReassignment[],
  previousClientId: number,
  managerId: number
) {
  const resolved: Array<{
    brandId: number;
    previousManagerId: number;
    newManagerId: number;
  }> = [];

  for (const item of reassignments) {
    const brandResult = await db.execute({
      sql: `SELECT id, client_id, manager_id FROM brands WHERE id = $1`,
      args: [item.brand_id],
    });
    if (brandResult.rows.length === 0) {
      throw new DomainError(
        "BRAND_NOT_FOUND",
        `La marca ${item.brand_id} no existe`
      );
    }
    const brand = brandResult.rows[0] as unknown as {
      id: number;
      client_id: number;
      manager_id: number | null;
    };

    if (Number(brand.client_id) !== previousClientId) {
      throw new DomainError(
        "MANAGER_CLIENT_MISMATCH",
        `La marca ${item.brand_id} no pertenece al cliente que deja el gerente`
      );
    }

    await assertSuccessorBelongsToClient(
      item.new_manager_id,
      previousClientId,
      managerId
    );

    resolved.push({
      brandId: Number(brand.id),
      // brand_manager_history.previous_manager_id es NOT NULL. Si la marca no
      // tuviera gerente, el gerente saliente es el previo por convención.
      previousManagerId: Number(brand.manager_id ?? managerId),
      newManagerId: Number(item.new_manager_id),
    });
  }

  return resolved;
}

/** Igual que `resolveBrandReassignments` pero para proyectos. */
async function resolveProjectReassignments(
  reassignments: ProjectReassignment[],
  previousClientId: number,
  managerId: number
) {
  const resolved: Array<{
    projectId: number;
    previousManagerId: number | null;
    newManagerId: number;
  }> = [];

  for (const item of reassignments) {
    const projectResult = await db.execute({
      sql: `SELECT id, client_id, manager_id FROM projects WHERE id = $1`,
      args: [item.project_id],
    });
    if (projectResult.rows.length === 0) {
      throw new DomainError(
        "PROJECT_NOT_FOUND",
        `El proyecto ${item.project_id} no existe`
      );
    }
    const project = projectResult.rows[0] as unknown as {
      id: number;
      client_id: number;
      manager_id: number | null;
    };

    if (Number(project.client_id) !== previousClientId) {
      throw new DomainError(
        "MANAGER_CLIENT_MISMATCH",
        `El proyecto ${item.project_id} no pertenece al cliente que deja el gerente`
      );
    }

    await assertSuccessorBelongsToClient(
      item.new_manager_id,
      previousClientId,
      managerId
    );

    resolved.push({
      projectId: Number(project.id),
      previousManagerId:
        project.manager_id === null ? null : Number(project.manager_id),
      newManagerId: Number(item.new_manager_id),
    });
  }

  return resolved;
}

/**
 * El sucesor debe existir, pertenecer al cliente que se está dejando y no ser
 * el propio gerente trasladado (reasignárselo a sí mismo no resuelve nada).
 */
async function assertSuccessorBelongsToClient(
  successorId: number,
  previousClientId: number,
  managerId: number
) {
  if (Number(successorId) === Number(managerId)) {
    throw new DomainError(
      "MANAGER_CLIENT_MISMATCH",
      "El gerente sucesor no puede ser el gerente que se está trasladando"
    );
  }

  const result = await db.execute({
    sql: `SELECT client_id FROM managers WHERE id = $1`,
    args: [successorId],
  });
  if (result.rows.length === 0) {
    throw new DomainError(
      "MANAGER_NOT_FOUND",
      `El gerente sucesor ${successorId} no existe`
    );
  }
  const successorClientId = Number(
    (result.rows[0] as unknown as { client_id: number }).client_id
  );
  if (successorClientId !== previousClientId) {
    throw new DomainError(
      "MANAGER_CLIENT_MISMATCH",
      `El gerente sucesor ${successorId} pertenece a otro cliente`
    );
  }
}

/**
 * Todo lo que quedaría huérfano si el gerente se traslada, más los candidatos a
 * heredarlo. Es la información que necesita la pantalla de traslado ANTES de
 * ejecutar nada.
 */
export async function getManagerTransferPreview(
  managerId: number
): Promise<ManagerTransferPreview | null> {
  try {
    const manager = await getManagerById(String(managerId));
    if (!manager) return null;

    const clientId = Number(manager.client_id);

    // Marcas del gerente EN SU CLIENTE ACTUAL. Una marca que quedó en un
    // cliente anterior no le pertenece ya aunque figure el manager_id.
    const brandsResult = await db.execute({
      sql: `
        SELECT b.id, b.name
        FROM brands b
        WHERE b.manager_id = $1 AND b.client_id = $2
        ORDER BY b.name ASC
      `,
      args: [managerId, clientId],
    });

    const projectsResult = await db.execute({
      sql: `
        SELECT p.id, p.title, p.status, p.brand_id, b.name AS brand_name
        FROM projects p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.manager_id = $1
          AND p.client_id = $2
          AND p.status <> 'archived'
        ORDER BY p.updated_at DESC
      `,
      args: [managerId, clientId],
    });

    const successorsResult = await db.execute({
      sql: `
        SELECT id, name, email
        FROM managers
        WHERE client_id = $1 AND id <> $2
        ORDER BY name ASC
      `,
      args: [clientId, managerId],
    });

    return {
      manager,
      current_client: manager.client_info ?? null,
      brands: brandsResult.rows as unknown as ManagerTransferPreview["brands"],
      projects:
        projectsResult.rows as unknown as ManagerTransferPreview["projects"],
      available_managers:
        successorsResult.rows as unknown as ManagerTransferPreview["available_managers"],
    };
  } catch (error) {
    console.error("Error building manager transfer preview:", error);
    return null;
  }
}

/** Trayectoria del gerente entre clientes, con nombres resueltos. */
export async function getManagerClientHistory(
  managerId: number
): Promise<ManagerClientHistoryEntry[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          mch.id,
          mch.manager_id,
          mch.previous_client_id,
          prev_c.name AS previous_client_name,
          mch.new_client_id,
          new_c.name  AS new_client_name,
          mch.changed_by,
          u.name      AS changed_by_name,
          mch.reason,
          mch.changed_at
        FROM manager_client_history mch
        LEFT JOIN clients prev_c ON mch.previous_client_id = prev_c.id
        LEFT JOIN clients new_c  ON mch.new_client_id      = new_c.id
        LEFT JOIN users   u      ON mch.changed_by         = u.id
        WHERE mch.manager_id = $1
        ORDER BY mch.changed_at DESC
      `,
      args: [managerId],
    });

    return result.rows.map((row) => ({
      id: row.id,
      managerId: row.manager_id,
      previousClientId: row.previous_client_id,
      previousClientName: row.previous_client_name,
      newClientId: row.new_client_id,
      newClientName: row.new_client_name,
      changedBy: row.changed_by,
      changedByName: row.changed_by_name,
      reason: row.reason,
      changedAt: row.changed_at,
    })) as unknown as ManagerClientHistoryEntry[];
  } catch (error) {
    console.error("Error fetching manager client history:", error);
    return [];
  }
}
