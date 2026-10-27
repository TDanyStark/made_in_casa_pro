import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  ProjectType,
  ProjectDetailType,
  ProjectDriveFailureCode,
  ProjectDriveRecipientSource,
  ProjectStatus,
  UserRole,
} from "../definitions";
import { DomainError } from "../errors";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";
import { ITEMS_PER_PAGE } from "@/config/constants";
import {
  ADDITIONAL_BRANDS_SELECT,
  PROJECT_BRAND_FILTER_SQL,
  insertProjectBrands,
  replaceProjectBrands,
  validateAdditionalBrands,
} from "./projectBrands";

// ─── Shared SELECT fragments ─────────────────────────────────────────────────

const PROJECT_SELECT = `
  p.id,
  p.title,
  p.brand_id,
  b.name           AS brand_name,
  b.manager_id     AS manager_id,
  m.name           AS manager_name,
  p.created_manager_id,
  cm.name          AS created_manager_name,
  cl.id            AS client_id,
  cl.name          AS client_name,
  b.client_id      AS current_client_id,
  bcl.name         AS current_client_name,
  p.campaign_id,
  cam.name         AS campaign_name,
  p.product_id,
  pr.name          AS product_name,
  pc.name          AS product_category_name,
  p.drive_folder_id,
  p.drive_folder_url,
  p.notes,
  p.ideal_delivery_at,
  p.oc,
  p.billing_closed_at,
  p.status,
  p.progress,
  p.created_by,
  u.name           AS created_by_name,
  p.created_at,
  p.updated_at,
  p.completed_at,
  ${ADDITIONAL_BRANDS_SELECT}
`;

// El cliente de la creación sale de `projects.client_id` (migración 012) y el
// gerente de la creación de `projects.created_manager_id` (migración 025).
// El gerente y el cliente ACTUALES salen siempre de la marca principal
// (`brands.manager_id` / `brands.client_id`); `projects` no tiene columna de gerente actual (migración 027).
const PROJECT_JOINS = `
  FROM projects p
  LEFT JOIN brands           b   ON p.brand_id    = b.id
  LEFT JOIN managers         m   ON m.id = b.manager_id
  LEFT JOIN managers         cm  ON p.created_manager_id = cm.id
  LEFT JOIN clients          cl  ON p.client_id   = cl.id
  LEFT JOIN clients          bcl ON bcl.id = b.client_id
  LEFT JOIN campaigns        cam ON p.campaign_id = cam.id
  LEFT JOIN products         pr  ON p.product_id  = pr.id
  LEFT JOIN product_categories pc ON pr.category_id = pc.id
  LEFT JOIN users            u   ON p.created_by  = u.id
`;

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProjectById(id: number): Promise<ProjectType | null> {
  try {
    const result = await db.execute({
      sql: `SELECT ${PROJECT_SELECT} ${PROJECT_JOINS} WHERE p.id = $1`,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProjectType;
  } catch (error) {
    console.error("Error fetching project by ID:", error);
    return null;
  }
}

/**
 * Determina si un usuario puede acceder a un proyecto específico según su rol.
 *   - Colaborador: solo si tiene al menos una tarea asignada en el proyecto
 *     (o, con `includeQuoteInvitations`, si fue invitado a cotizar una tarea del proyecto).
 *   - Comercial: solo si es el creador del proyecto.
 *   - Otros roles (admin, directivo, financiero): acceso total.
 */
export async function userCanAccessProject(
  projectId: number,
  userId: number,
  roleId: number,
  options?: { includeQuoteInvitations?: boolean }
): Promise<boolean> {
  // Admin, Directivo y Financiero ven todo
  if (
    roleId === UserRole.ADMIN ||
    roleId === UserRole.DIRECTIVO ||
    roleId === UserRole.FINANCIERO
  ) {
    return true;
  }

  try {
    if (roleId === UserRole.COMERCIAL) {
      const result = await db.execute({
        sql: `SELECT 1 FROM projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
        args: [projectId, userId],
      });
      return result.rows.length > 0;
    }

    if (roleId === UserRole.COLABORADOR) {
      const sql = options?.includeQuoteInvitations
        ? `SELECT 1 WHERE EXISTS (
             SELECT 1 FROM project_tasks WHERE project_id = $1 AND assigned_user_id = $2
           ) OR EXISTS (
             SELECT 1 FROM task_quote_invitations tqi
             JOIN project_tasks pt ON pt.id = tqi.task_id
             WHERE pt.project_id = $1 AND tqi.user_id = $2
           )`
        : `SELECT 1 FROM project_tasks WHERE project_id = $1 AND assigned_user_id = $2 LIMIT 1`;
      const result = await db.execute({ sql, args: [projectId, userId] });
      return result.rows.length > 0;
    }

    return false;
  } catch (error) {
    console.error("Error checking project access:", error);
    return false;
  }
}

export async function getProjectDetail(id: number): Promise<ProjectDetailType | null> {
  try {
    const project = await getProjectById(id);
    if (!project) return null;

    const coMgrResult = await db.execute({
      sql: `
        SELECT m.id, m.name, m.email
        FROM project_managers pm
        JOIN managers m ON pm.manager_id = m.id
        WHERE pm.project_id = $1
        ORDER BY m.name ASC
      `,
      args: [id],
    });

    return {
      ...project,
      co_managers: coMgrResult.rows as unknown as ProjectDetailType["co_managers"],
    };
  } catch (error) {
    console.error("Error fetching project detail:", error);
    return null;
  }
}

export type ProjectDriveRecipient = {
  email: string;
  name: string | null;
  sources: ProjectDriveRecipientSource[];
};

/**
 * Current people who should receive additive access to the project folder.
 * Managers and co-managers (client contacts) never get access: they usually
 * have no Google account.
 */
export async function getProjectExpectedDriveRecipients(
  projectId: number
): Promise<ProjectDriveRecipient[]> {
  const result = await db.execute({
    sql: `
      SELECT email, name, 'leadership' AS source FROM users
      WHERE is_active = 1 AND email IS NOT NULL AND rol_id IN ($2, $3, $4)
      UNION ALL
      SELECT u.email, u.name, 'creator' AS source
      FROM projects p JOIN users u ON u.id = p.created_by
      WHERE p.id = $1 AND u.is_active = 1 AND u.email IS NOT NULL
      UNION ALL
      SELECT u.email, u.name, 'task_assignee' AS source
      FROM project_tasks pt JOIN users u ON u.id = pt.assigned_user_id
      WHERE pt.project_id = $1 AND u.is_active = 1 AND u.email IS NOT NULL
    `,
    args: [projectId, UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO],
  });

  const recipients = new Map<string, ProjectDriveRecipient>();
  for (const row of result.rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const source = String(row.source) as ProjectDriveRecipientSource;
    const existing = recipients.get(email);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      recipients.set(email, {
        email,
        name: row.name ? String(row.name) : null,
        sources: [source],
      });
    }
  }
  return [...recipients.values()];
}

export async function getProjectStakeholderEmails(projectId: number): Promise<string[]> {
  return (await getProjectExpectedDriveRecipients(projectId)).map((recipient) => recipient.email);
}

export type ProjectDriveAccessFailure = {
  email: string;
  failureCode: ProjectDriveFailureCode;
  lastAttemptAt: string;
};

export async function getProjectDriveAccessFailures(
  projectId: number
): Promise<ProjectDriveAccessFailure[]> {
  const result = await db.execute({
    sql: `SELECT email, failure_code, last_attempt_at
          FROM project_drive_access_failures WHERE project_id = $1`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    email: String(row.email),
    failureCode: String(row.failure_code) as ProjectDriveFailureCode,
    lastAttemptAt: String(row.last_attempt_at),
  }));
}

export async function upsertProjectDriveAccessFailure(
  projectId: number,
  email: string,
  failureCode: ProjectDriveFailureCode
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO project_drive_access_failures (project_id, email, failure_code, last_attempt_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (project_id, email) DO UPDATE SET
            failure_code = EXCLUDED.failure_code,
            last_attempt_at = EXCLUDED.last_attempt_at`,
    args: [projectId, email.trim().toLowerCase(), failureCode],
  });
}

export async function clearProjectDriveAccessFailure(
  projectId: number,
  email: string
): Promise<void> {
  await db.execute({
    sql: `DELETE FROM project_drive_access_failures WHERE project_id = $1 AND email = $2`,
    args: [projectId, email.trim().toLowerCase()],
  });
}

export async function getProjectsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
  status,
  brandId,
  managerId,
  clientId,
  campaignId,
  assignedUserId,
  createdById,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  brandId?: number;
  managerId?: number;
  /** Filtra por el cliente propio del proyecto (projects.client_id) */
  clientId?: number;
  campaignId?: number;
  /** Restringe a proyectos con al menos una tarea asignada a este usuario (colaboradores) */
  assignedUserId?: number;
  /** Restringe a proyectos creados por este usuario (comerciales) */
  createdById?: number;
}) {
  try {
    const { whereSQL, args } = buildWhereClause([
      { sql: "unaccent(p.title) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
      { sql: "p.status = $", value: status },
      // Marca principal o adicional
      { sql: PROJECT_BRAND_FILTER_SQL, value: brandId },
      // Gerente actual = el de la marca principal
      { sql: "b.manager_id = $", value: managerId },
      { sql: "p.client_id = $", value: clientId },
      { sql: "p.campaign_id = $", value: campaignId },
      {
        sql: "EXISTS (SELECT 1 FROM project_tasks pt WHERE pt.project_id = p.id AND pt.assigned_user_id = $)",
        value: assignedUserId,
      },
      { sql: "p.created_by = $", value: createdById },
    ]);

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count ${PROJECT_JOINS}${whereSQL}`,
      args,
    });
    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);
    const result = await db.execute({
      sql: `
        SELECT
          ${PROJECT_SELECT},
          (SELECT COUNT(*) FROM project_managers pm WHERE pm.project_id = p.id) AS co_manager_count
        ${PROJECT_JOINS}${whereSQL}
        ORDER BY p.updated_at DESC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...args, ...paginationArgs],
    });

    return {
      projects: result.rows as unknown as ProjectType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { projects: [], total: 0 };
  }
}

// ─── Reglas de cliente / gerente ─────────────────────────────────────────────

/**
 * Devuelve el cliente y el gerente de la marca principal de un proyecto.
 * Lanza si la marca no existe.
 */
async function getPrincipalBrand(
  brandId: number
): Promise<{ clientId: number; managerId: number | null }> {
  const result = await db.execute({
    sql: `SELECT client_id, manager_id FROM brands WHERE id = $1`,
    args: [brandId],
  });
  if (result.rows.length === 0) {
    throw new DomainError("BRAND_NOT_FOUND", "La marca especificada no existe");
  }
  const row = result.rows[0] as { client_id: number; manager_id: number | null };
  return {
    clientId: Number(row.client_id),
    managerId: row.manager_id === null ? null : Number(row.manager_id),
  };
}

/**
 * Un proyecto solo puede tener como responsable a un gerente del MISMO cliente.
 * Es la regla que impide que el gerente mueva el proyecto de cliente.
 */
async function assertManagerBelongsToClient(
  managerId: number,
  clientId: number
): Promise<void> {
  const result = await db.execute({
    sql: `SELECT client_id FROM managers WHERE id = $1`,
    args: [managerId],
  });
  if (result.rows.length === 0) {
    throw new DomainError(
      "MANAGER_NOT_FOUND",
      "El gerente especificado no existe"
    );
  }
  const managerClientId = Number(
    (result.rows[0] as { client_id: number }).client_id
  );
  if (managerClientId !== clientId) {
    throw new DomainError(
      "MANAGER_CLIENT_MISMATCH",
      "El gerente pertenece a otro cliente. Un proyecto solo puede asignarse a gerentes de su mismo cliente."
    );
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createProject(data: {
  title: string;
  brand_id: number;
  /** Marcas adicionales del mismo cliente (project_brands) */
  additional_brand_ids?: number[];
  manager_id: number;
  product_id?: number | null;
  campaign_id?: number | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  notes?: string | null;
  ideal_delivery_at?: string | null;
  oc?: string | null;
  billing_closed_at?: string | null;
  status?: ProjectStatus;
  created_by?: number | null;
}): Promise<ProjectType> {
  try {
    // La marca principal es la fuente de verdad del cliente (migración 012) y
    // del gerente: el proyecto nace con el gerente actual de su marca. El
    // gerente actual no se guarda en el proyecto (se lee de `brands.manager_id`);
    // solo se fija el gerente al crearse (`created_manager_id`).
    const brand = await getPrincipalBrand(data.brand_id);
    const clientId = brand.clientId;
    if (brand.managerId === null || Number(data.manager_id) !== brand.managerId) {
      throw new DomainError(
        "MANAGER_NOT_BRAND_MANAGER",
        "El gerente del proyecto debe ser el gerente de su marca principal"
      );
    }
    await assertManagerBelongsToClient(data.manager_id, clientId);
    const additionalBrandIds = await validateAdditionalBrands(
      data.additional_brand_ids ?? [],
      data.brand_id,
      clientId
    );

    // The project and its V1 version are created together or not at all.
    let id: number;
    const transaction = await db.transaction("write");
    try {
      const result = await transaction.execute({
        sql: `
          INSERT INTO projects
            (title, brand_id, created_manager_id, client_id, product_id, campaign_id, drive_folder_id, drive_folder_url, notes, ideal_delivery_at, oc, billing_closed_at, status, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `,
        args: [
          data.title,
          data.brand_id,
          // Gerente al crearse: fijo, nada más lo escribe.
          data.manager_id,
          clientId,
          data.product_id ?? null,
          data.campaign_id ?? null,
          data.drive_folder_id ?? null,
          data.drive_folder_url ?? null,
          data.notes ?? null,
          data.ideal_delivery_at ?? null,
          data.oc ?? null,
          data.billing_closed_at ?? null,
          data.status ?? "active",
          data.created_by ?? null,
        ],
      });
      id = Number(result.rows[0]?.id);

      // Initialize V1 adjustment record
      await transaction.execute({
        sql: `
          INSERT INTO project_adjustments (project_id, version_number, status, drive_folder_id, drive_folder_url)
          VALUES ($1, 1, 'active', $2, $3)
        `,
        args: [id, data.drive_folder_id ?? null, data.drive_folder_url ?? null],
      });
      await insertProjectBrands(transaction, id, additionalBrandIds);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    revalidatePath("/projects");
    const created = await getProjectById(id);
    return created!;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Actualiza un proyecto.
 *
 * El gerente NO es actualizable aquí: el gerente actual de un proyecto se lee
 * siempre de su marca principal (`brands.manager_id`) y cambia solo al
 * reasignar la marca (`updateBrand`), sin escribir nada en el proyecto.
 */
export async function updateProject(
  id: number,
  data: Partial<{
    title: string;
    product_id: number | null;
    campaign_id: number | null;
    drive_folder_id: string | null;
    drive_folder_url: string | null;
    notes: string | null;
    ideal_delivery_at: string | null;
    oc: string | null;
    billing_closed_at: string | null;
    status: ProjectStatus;
    progress: number;
    /** Reemplaza el conjunto completo de marcas adicionales */
    additional_brand_ids: number[];
  }>
): Promise<ProjectType | null> {
  try {
    const currentProject = await getProjectById(id);
    if (!currentProject) return null;
    // Las marcas asociadas son un vínculo informativo: se pueden editar aun
    // con el proyecto completado, siempre que sea lo único que cambia.
    const onlyAdditionalBrands = Object.entries(data).every(
      ([key, value]) => key === "additional_brand_ids" || value === undefined
    );
    if (!onlyAdditionalBrands && currentProject.status === 'completed' && data.status !== 'in_adjustments' && data.status !== 'archived' && data.status !== 'active') {
       throw new Error("No se pueden editar proyectos completados");
    }

    const additionalBrandIds =
      data.additional_brand_ids !== undefined
        ? await validateAdditionalBrands(
            data.additional_brand_ids,
            Number(currentProject.brand_id),
            Number(currentProject.client_id)
          )
        : undefined;

    const updates: string[] = [];
    const args: unknown[] = [];

    const fields: Array<[string, unknown]> = [
      ["title", data.title],
      ["product_id", data.product_id],
      ["campaign_id", data.campaign_id],
      ["drive_folder_id", data.drive_folder_id],
      ["drive_folder_url", data.drive_folder_url],
      ["notes", data.notes],
      ["ideal_delivery_at", data.ideal_delivery_at],
      ["oc", data.oc],
      ["billing_closed_at", data.billing_closed_at],
      ["status", data.status],
      ["progress", data.progress],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        args.push(val);
        updates.push(`${col} = $${args.length}`);
      }
    }

    if (updates.length === 0 && additionalBrandIds === undefined) {
      return getProjectById(id);
    }

    // always bump updated_at
    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    const updateSql = `UPDATE projects SET ${updates.join(", ")} WHERE id = $${args.length}`;

    if (additionalBrandIds !== undefined) {
      // El UPDATE y el reemplazo de marcas adicionales van en la misma
      // transacción: un proyecto no puede quedar con marcas a medio aplicar.
      const transaction = await db.transaction("write");
      try {
        await transaction.execute({ sql: updateSql, args });
        await replaceProjectBrands(transaction, id, additionalBrandIds);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      await db.execute({ sql: updateSql, args });
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return getProjectById(id);
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
}

export async function deleteProject(id: number): Promise<void> {
  try {
    await db.execute({ sql: `DELETE FROM projects WHERE id = $1`, args: [id] });
    revalidatePath("/projects");
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
}

// ─── Progress recalculation ───────────────────────────────────────────────────

export interface ProjectProgressRecalculation {
  progress: number;
  /**
   * true only when THIS recalculation moved the project from < 100 (or NULL) to
   * 100, with at least one task and a status other than 'completed'.
   * Drives the `project.ready_to_close` email.
   */
  reachedCompletion: boolean;
}

/**
 * Recalculates and stores the project's progress (always returns the number;
 * kept for existing callers). Use `recalculateProjectProgressWithTransition`
 * when the caller needs to know whether the project just reached 100%.
 */
export async function recalculateProjectProgress(projectId: number): Promise<number> {
  const { progress } = await recalculateProjectProgressWithTransition(projectId);
  return progress;
}

/** Recalculate the latest version and synchronize its lifecycle with the project.
 * Lock before counting: concurrent recalculations observe the committed state
 * of the previous recalculation, rather than publishing stale counts.
 */
export async function recalculateProjectProgressWithTransition(
  projectId: number
): Promise<ProjectProgressRecalculation> {
  const tx = await db.transaction("write");
  let progress = 0;
  let reachedCompletion = false;
  try {
    const projectResult = await tx.execute({
      sql: `SELECT status, progress FROM projects WHERE id = $1 FOR UPDATE`,
      args: [projectId],
    });
    const project = projectResult.rows[0] as unknown as { status: string } | undefined;
    if (project) {
      const versionResult = await tx.execute({
        sql: `SELECT id FROM project_adjustments WHERE project_id = $1 ORDER BY version_number DESC, id DESC LIMIT 1 FOR UPDATE`,
        args: [projectId],
      });
      const version = versionResult.rows[0] as unknown as { id: number } | undefined;
      let total = 0;
      let completed = 0;
      if (version) {
        const counts = await tx.execute({
          sql: `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'completed') AS completed
                FROM project_tasks WHERE project_id = $1 AND adjustment_id = $2`,
          args: [projectId, Number(version.id)],
        });
        const row = counts.rows[0] as unknown as { total: string; completed: string };
        total = Number(row.total);
        completed = Number(row.completed);
      }
      const allCompleted = total > 0 && completed === total;
      progress = allCompleted ? 100 : total === 0 ? 0 : Math.min(99, Math.round(completed / total * 100));
      const status = allCompleted ? "completed" : project.status === "completed" ? "active" : project.status;
      reachedCompletion = allCompleted && project.status !== "completed";
      await tx.execute({
        sql: `UPDATE projects SET progress = $1, status = $2,
              completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
              updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        args: [progress, status, projectId],
      });
      if (version) {
        await tx.execute({
          sql: `UPDATE project_adjustments SET status = $1,
                completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END
                WHERE id = $2`,
          args: [allCompleted ? "completed" : "active", Number(version.id)],
        });
      }
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { progress, reachedCompletion };
}

// ─── Manual completion ───────────────────────────────────────────────────────

/** Manual fallback for automatic completion. Validates the real task counts of
 * the latest version (never the stored, rounded progress) under the same lock
 * order as `recalculateProjectProgressWithTransition` (project, then version),
 * and closes the project and that version together.
 */
export async function completeProject(projectId: number): Promise<void> {
  const tx = await db.transaction("write");
  try {
    const projectResult = await tx.execute({
      sql: `SELECT status FROM projects WHERE id = $1 FOR UPDATE`,
      args: [projectId],
    });
    const project = projectResult.rows[0] as unknown as { status: string } | undefined;
    if (!project) throw new Error("Proyecto no encontrado");
    if (project.status === "completed") throw new Error("El proyecto ya está completado");

    const versionResult = await tx.execute({
      sql: `SELECT id FROM project_adjustments WHERE project_id = $1 ORDER BY version_number DESC, id DESC LIMIT 1 FOR UPDATE`,
      args: [projectId],
    });
    const version = versionResult.rows[0] as unknown as { id: number } | undefined;
    let total = 0;
    let completed = 0;
    if (version) {
      const counts = await tx.execute({
        sql: `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'completed') AS completed
              FROM project_tasks WHERE project_id = $1 AND adjustment_id = $2`,
        args: [projectId, Number(version.id)],
      });
      const row = counts.rows[0] as unknown as { total: string; completed: string };
      total = Number(row.total);
      completed = Number(row.completed);
    }
    if (!version || total === 0 || completed !== total) {
      throw new Error("El proyecto no tiene todas las tareas completadas");
    }

    await tx.execute({
      sql: `UPDATE projects SET progress = 100, status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [projectId],
    });
    await tx.execute({
      sql: `UPDATE project_adjustments SET status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
            WHERE id = $1`,
      args: [Number(version.id)],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    console.error("Error completing project:", error);
    throw error;
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

// ─── Co-managers ─────────────────────────────────────────────────────────────

export async function addCoManager(projectId: number, managerId: number): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO project_managers (project_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      args: [projectId, managerId],
    });
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error adding co-manager:", error);
    throw error;
  }
}

export async function removeCoManager(projectId: number, managerId: number): Promise<void> {
  try {
    await db.execute({
      sql: `DELETE FROM project_managers WHERE project_id = $1 AND manager_id = $2`,
      args: [projectId, managerId],
    });
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error removing co-manager:", error);
    throw error;
  }
}

