import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  ProjectTaskType,
  ProjectTaskStatus,
  TaskType,
  TaskFlag,
  TaskTransitionType,
} from "../definitions";

// ─── Shared SELECT fragments ──────────────────────────────────────────────────

const TASK_SELECT = `
  pt.id,
  pt.project_id,
  pt.project_product_id,
  pt.template_id,
  pt.title,
  pt.description,
  pt.area_id,
  a.name            AS area_name,
  pt.assigned_user_id,
  u.name            AS assigned_user_name,
  u.rol_id          AS assigned_user_rol_id,
  pt.status,
  pt.task_type,
  pt.task_flag,
  pt.requires_quote,
  pt.assign_to_commercial,
  pt.order_index,
  pt.created_at,
  pt.updated_at,
  (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id) AS quote_count,
  (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id AND tq.status = 'pending') AS pending_quote_count
`;

const TASK_JOINS = `
  FROM project_tasks pt
  LEFT JOIN areas a ON pt.area_id = a.id
  LEFT JOIN users u ON pt.assigned_user_id = u.id
`;

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProjectTaskById(id: number): Promise<ProjectTaskType | null> {
  try {
    const result = await db.execute({
      sql: `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE pt.id = $1`,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProjectTaskType;
  } catch (error) {
    console.error("Error fetching project task by ID:", error);
    return null;
  }
}

export async function getTasksByProjectProduct(
  projectProductId: number
): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        WHERE pt.project_product_id = $1
        ORDER BY pt.order_index ASC, pt.id ASC
      `,
      args: [projectProductId],
    });
    return result.rows as unknown as ProjectTaskType[];
  } catch (error) {
    console.error("Error fetching tasks by project_product_id:", error);
    return [];
  }
}

export async function getTasksByProject(projectId: number): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        WHERE pt.project_id = $1
        ORDER BY pt.project_product_id ASC, pt.order_index ASC, pt.id ASC
      `,
      args: [projectId],
    });
    return result.rows as unknown as ProjectTaskType[];
  } catch (error) {
    console.error("Error fetching tasks by project:", error);
    return [];
  }
}

export async function getTaskTransitions(taskId: number): Promise<TaskTransitionType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tt.id,
          tt.task_id,
          tt.project_id,
          tt.from_status,
          tt.to_status,
          tt.from_flag,
          tt.to_flag,
          tt.moved_by,
          u.name AS moved_by_name,
          tt.notes,
          tt.transitioned_at
        FROM task_transitions tt
        LEFT JOIN users u ON tt.moved_by = u.id
        WHERE tt.task_id = $1
        ORDER BY tt.transitioned_at ASC
      `,
      args: [taskId],
    });
    return result.rows as unknown as TaskTransitionType[];
  } catch (error) {
    console.error("Error fetching task transitions:", error);
    return [];
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProjectTask(data: {
  project_id: number;
  project_product_id: number;
  template_id?: number | null;
  title: string;
  description?: string | null;
  area_id?: number | null;
  assigned_user_id?: number | null;
  status?: ProjectTaskStatus;
  task_type?: TaskType;
  task_flag?: TaskFlag;
  requires_quote?: number;
  assign_to_commercial?: number;
  order_index: number;
}): Promise<ProjectTaskType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO project_tasks
          (project_id, project_product_id, template_id, title, description,
           area_id, assigned_user_id, status, task_type, task_flag,
           requires_quote, assign_to_commercial, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      args: [
        data.project_id,
        data.project_product_id,
        data.template_id ?? null,
        data.title,
        data.description ?? null,
        data.area_id ?? null,
        data.assigned_user_id ?? null,
        data.status ?? "not_started",
        data.task_type ?? "execution",
        data.task_flag ?? "new",
        data.requires_quote ?? 0,
        data.assign_to_commercial ?? 0,
        data.order_index,
      ],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath(`/projects/${data.project_id}`);
    const created = await getProjectTaskById(id);
    return created!;
  } catch (error) {
    console.error("Error creating project task:", error);
    throw error;
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProjectTask(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    area_id: number | null;
    assigned_user_id: number | null;
    status: ProjectTaskStatus;
    task_type: TaskType;
    task_flag: TaskFlag;
    requires_quote: number;
    assign_to_commercial: number;
  }>
): Promise<ProjectTaskType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    const fields: Array<[string, unknown]> = [
      ["title", data.title],
      ["description", data.description],
      ["area_id", data.area_id],
      ["assigned_user_id", data.assigned_user_id],
      ["status", data.status],
      ["task_type", data.task_type],
      ["task_flag", data.task_flag],
      ["requires_quote", data.requires_quote],
      ["assign_to_commercial", data.assign_to_commercial],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        args.push(val);
        updates.push(`${col} = $${args.length}`);
      }
    }

    if (updates.length === 0) return getProjectTaskById(id);

    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    await db.execute({
      sql: `UPDATE project_tasks SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

    const updated = await getProjectTaskById(id);
    if (updated) revalidatePath(`/projects/${updated.project_id}`);
    return updated;
  } catch (error) {
    console.error("Error updating project task:", error);
    throw error;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteProjectTask(id: number): Promise<void> {
  try {
    const task = await getProjectTaskById(id);
    await db.execute({ sql: `DELETE FROM project_tasks WHERE id = $1`, args: [id] });
    if (task) revalidatePath(`/projects/${task.project_id}`);
  } catch (error) {
    console.error("Error deleting project task:", error);
    throw error;
  }
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export async function reorderProjectTasks(
  projectProductId: number,
  projectId: number,
  orderedIds: number[]
): Promise<void> {
  const transaction = await db.transaction("write");
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await transaction.execute({
        sql: `UPDATE project_tasks SET order_index = $1 WHERE id = $2 AND project_product_id = $3`,
        args: [i, orderedIds[i], projectProductId],
      });
    }
    await transaction.commit();
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error reordering project tasks:", error);
    throw error;
  }
}

// ─── Transition logger ────────────────────────────────────────────────────────

async function logTransition(
  taskId: number,
  projectId: number,
  fromStatus: string | null,
  toStatus: string,
  fromFlag: string | null,
  toFlag: string | null,
  movedBy: number,
  notes?: string | null
): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO task_transitions
        (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    args: [taskId, projectId, fromStatus ?? null, toStatus, fromFlag ?? null, toFlag ?? null, movedBy, notes ?? null],
  });
}

// ─── Complete task (execution flow) ──────────────────────────────────────────

/**
 * Marks an execution task as completed and auto-activates the next task in order.
 * Only the assigned user can complete (enforced at API layer).
 */
export async function completeTask(
  taskId: number,
  userId: number,
  notes?: string | null
): Promise<{ task: ProjectTaskType; nextTask: ProjectTaskType | null; blockedReason?: string }> {
  const task = await getProjectTaskById(taskId);
  if (!task) throw new Error("Tarea no encontrada");
  if (task.task_type !== "execution") throw new Error("Solo se pueden completar tareas de ejecución con este endpoint");
  if (task.status !== "in_progress" && task.status !== "not_started") {
    throw new Error("La tarea no está en un estado que permita completarla");
  }

  const transaction = await db.transaction("write");
  try {
    // 1. Mark current task as completed
    await transaction.execute({
      sql: `UPDATE project_tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [taskId],
    });

    // 2. Log transition
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'completed', $4, $4, $5, $6)
      `,
      args: [taskId, task.project_id, task.status, task.task_flag, userId, notes ?? null],
    });

    // 3. Find next task in this product (lowest order_index with status='waiting' or 'not_started')
    const nextResult = await transaction.execute({
      sql: `
        SELECT id, assigned_user_id, requires_quote, task_flag, status
        FROM project_tasks
        WHERE project_product_id = $1
          AND order_index > (SELECT order_index FROM project_tasks WHERE id = $2)
          AND status IN ('waiting', 'not_started')
        ORDER BY order_index ASC
        LIMIT 1
      `,
      args: [task.project_product_id, taskId],
    });

    let nextTask: ProjectTaskType | null = null;
    let blockedReason: string | undefined;

    if (nextResult.rows.length > 0) {
      const next = nextResult.rows[0] as unknown as {
        id: number;
        assigned_user_id: number | null;
        requires_quote: number;
        task_flag: string;
        status: string;
      };

      if (Number(next.requires_quote) === 1 && !next.assigned_user_id) {
        // Block: requires external quote, no one assigned yet
        await transaction.execute({
          sql: `UPDATE project_tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          args: [next.id],
        });
        await transaction.execute({
          sql: `
            INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
            VALUES ($1, $2, $3, 'blocked', $4, $4, $5, $6)
          `,
          args: [next.id, task.project_id, next.status, next.task_flag, userId, "Requiere cotización de colaborador externo"],
        });
        blockedReason = "La siguiente tarea requiere cotización de un colaborador externo. El encargado del proyecto debe invitar a un externo para cotizar.";
      } else if (!next.assigned_user_id) {
        // Block: no one assigned
        await transaction.execute({
          sql: `UPDATE project_tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          args: [next.id],
        });
        await transaction.execute({
          sql: `
            INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
            VALUES ($1, $2, $3, 'blocked', $4, $4, $5, $6)
          `,
          args: [next.id, task.project_id, next.status, next.task_flag, userId, "Sin colaborador asignado"],
        });
        blockedReason = "La siguiente tarea no tiene colaborador asignado. El encargado del proyecto debe asignar a alguien.";
      } else {
        // Activate next task
        await transaction.execute({
          sql: `UPDATE project_tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          args: [next.id],
        });
        await transaction.execute({
          sql: `
            INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
            VALUES ($1, $2, $3, 'in_progress', $4, $4, $5, $6)
          `,
          args: [next.id, task.project_id, next.status, next.task_flag, userId, "Activada automáticamente al completar tarea anterior"],
        });
      }
    }

    await transaction.commit();

    const updatedTask = await getProjectTaskById(taskId);
    if (nextResult.rows.length > 0) {
      const nextId = Number((nextResult.rows[0] as unknown as { id: number }).id);
      nextTask = await getProjectTaskById(nextId);
    }

    revalidatePath(`/projects/${task.project_id}`);
    return { task: updatedTask!, nextTask, blockedReason };
  } catch (error) {
    await transaction.rollback();
    console.error("Error completing task:", error);
    throw error;
  }
}

// ─── Validate task (validation flow) ─────────────────────────────────────────

/**
 * Handles validation task actions:
 * - approve: same as complete, moves to next task in order
 * - reject: marks current validation as completed (historical), sets target task to in_progress
 *           with flag='correction', leaves intermediate tasks as completed (historical)
 */
export async function validateTask(
  taskId: number,
  userId: number,
  action: "approve" | "reject",
  targetOrderIndex?: number,
  notes?: string | null
): Promise<{ task: ProjectTaskType; targetTask: ProjectTaskType | null; blockedReason?: string }> {
  const task = await getProjectTaskById(taskId);
  if (!task) throw new Error("Tarea no encontrada");
  if (task.task_type !== "validation") throw new Error("Solo se pueden validar tareas de tipo validación");
  if (task.status !== "in_progress") throw new Error("La tarea de validación no está en progreso");

  if (action === "approve") {
    const result = await completeTask(taskId, userId, notes);
    return { task: result.task, targetTask: result.nextTask, blockedReason: result.blockedReason };
  }

  // Reject: find the target task to send back to
  if (targetOrderIndex === undefined) throw new Error("Se requiere indicar a qué tarea volver");

  const targetResult = await db.execute({
    sql: `
      SELECT id, status, task_flag, order_index
      FROM project_tasks
      WHERE project_product_id = $1 AND order_index = $2
      LIMIT 1
    `,
    args: [task.project_product_id, targetOrderIndex],
  });
  if (targetResult.rows.length === 0) throw new Error("Tarea destino no encontrada");

  const target = targetResult.rows[0] as unknown as {
    id: number;
    status: string;
    task_flag: string;
    order_index: number;
  };

  const transaction = await db.transaction("write");
  try {
    // 1. Mark validation task as completed (historical record)
    await transaction.execute({
      sql: `UPDATE project_tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [taskId],
    });
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, 'in_progress', 'completed', $3, $3, $4, $5)
      `,
      args: [taskId, task.project_id, task.task_flag, userId, notes ?? "Validación rechazada, enviada a corrección"],
    });

    // 2. Set target task to in_progress with flag=correction
    await transaction.execute({
      sql: `
        UPDATE project_tasks
        SET status = 'in_progress', task_flag = 'correction', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      args: [target.id],
    });
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'in_progress', $4, 'correction', $5, $6)
      `,
      args: [target.id, task.project_id, target.status, target.task_flag, userId, notes ?? "Regresada para corrección"],
    });

    // 3. Tasks between target and validation task: leave as completed (historical)
    // They will get new instances if the flow passes through them again

    await transaction.commit();

    const updatedTask = await getProjectTaskById(taskId);
    const targetTask = await getProjectTaskById(target.id);

    revalidatePath(`/projects/${task.project_id}`);
    return { task: updatedTask!, targetTask };
  } catch (error) {
    await transaction.rollback();
    console.error("Error validating task:", error);
    throw error;
  }
}

// ─── Auto-assignment helpers ──────────────────────────────────────────────────

/**
 * Finds the internal collaborator (is_internal=1, rol_id=4) with the fewest
 * active (not completed/waiting) project tasks in the given area.
 * If areaId is provided, restrict to that area. Otherwise search globally.
 */
export async function findLeastLoadedInternalCollaborator(areaId?: number | null): Promise<number | null> {
  try {
    const args: unknown[] = [];
    let areaFilter = "";
    if (areaId) {
      args.push(areaId);
      areaFilter = `AND u.area_id = $${args.length}`;
    }

    const result = await db.execute({
      sql: `
        SELECT u.id
        FROM users u
        LEFT JOIN project_tasks pt ON pt.assigned_user_id = u.id
          AND pt.status NOT IN ('completed', 'waiting')
        WHERE u.rol_id = 4
          AND u.is_internal = 1
          AND u.is_active = 1
          ${areaFilter}
        GROUP BY u.id
        ORDER BY COUNT(pt.id) ASC
        LIMIT 1
      `,
      args,
    });
    if (result.rows.length === 0) return null;
    return Number((result.rows[0] as unknown as { id: number }).id);
  } catch (error) {
    console.error("Error finding least loaded collaborator:", error);
    return null;
  }
}

/**
 * Checks if there are any internal collaborators in the given area.
 */
export async function hasInternalCollaboratorsInArea(areaId: number): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: `SELECT COUNT(*) AS cnt FROM users WHERE rol_id = 4 AND is_internal = 1 AND is_active = 1 AND area_id = $1`,
      args: [areaId],
    });
    return Number((result.rows[0] as unknown as { cnt: number }).cnt) > 0;
  } catch {
    return false;
  }
}

// ─── Instantiate tasks from templates ────────────────────────────────────────

/**
 * Instantiates product_task_templates as project_tasks for a given project_product.
 *
 * Assignment logic per template (in priority order):
 *   1. assign_to_commercial = 1 → assign commercialUserId (the project creator)
 *   2. assigned_user_id set → use directly (fixed assignment)
 *   3. area_id set:
 *      a. Area has internals → assign least loaded internal of that area
 *      b. No internals in area → leave NULL (blocked until manual assignment or quote)
 *   4. Neither → assigned_user_id = NULL
 *
 * Status logic:
 *   - First task (order_index = lowest) → 'not_started' (ready to begin)
 *   - All others → 'waiting' (assigned but blocked until previous completes)
 */
export async function instantiateTasksFromTemplates(
  projectId: number,
  projectProductId: number,
  productId: number,
  commercialUserId?: number | null
): Promise<void> {
  try {
    const templates = await db.execute({
      sql: `
        SELECT id, title, description, area_id, assigned_user_id,
               order_index, task_type, requires_quote, assign_to_commercial
        FROM product_task_templates
        WHERE product_id = $1
        ORDER BY order_index ASC, id ASC
      `,
      args: [productId],
    });

    const transaction = await db.transaction("write");
    try {
      for (let i = 0; i < templates.rows.length; i++) {
        const tpl = templates.rows[i] as unknown as {
          id: number;
          title: string;
          description: string | null;
          area_id: number | null;
          assigned_user_id: number | null;
          order_index: number;
          task_type: string;
          requires_quote: number;
          assign_to_commercial: number;
        };

        let assignedTo: number | null = null;

        if (Number(tpl.assign_to_commercial) === 1 && commercialUserId) {
          // Assign the project creator / commercial responsible
          assignedTo = commercialUserId;
        } else if (tpl.assigned_user_id) {
          // Fixed assignment defined in the template
          assignedTo = tpl.assigned_user_id;
        } else if (tpl.area_id) {
          // Auto-assign least loaded internal of the area
          const internalId = await findLeastLoadedInternalCollaborator(tpl.area_id);
          assignedTo = internalId; // null if no internals in area
        }

        // First task ready to start, all others wait their turn
        const status: ProjectTaskStatus = i === 0 ? "not_started" : "waiting";

        await transaction.execute({
          sql: `
            INSERT INTO project_tasks
              (project_id, project_product_id, template_id, title, description,
               area_id, assigned_user_id, status, task_type, task_flag,
               requires_quote, assign_to_commercial, order_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10, $11, $12)
          `,
          args: [
            projectId,
            projectProductId,
            tpl.id,
            tpl.title,
            tpl.description ?? null,
            tpl.area_id ?? null,
            assignedTo,
            status,
            tpl.task_type ?? "execution",
            tpl.requires_quote ?? 0,
            tpl.assign_to_commercial ?? 0,
            tpl.order_index,
          ],
        });
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error instantiating tasks from templates:", error);
    throw error;
  }
}

// ─── My tasks (for collaborator dashboard) ────────────────────────────────────

export async function getMyTasks(userId: number): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          pt.id,
          pt.project_id,
          pt.project_product_id,
          pt.template_id,
          pt.title,
          pt.description,
          pt.area_id,
          a.name            AS area_name,
          pt.assigned_user_id,
          u.name            AS assigned_user_name,
          u.rol_id          AS assigned_user_rol_id,
          pt.status,
          pt.task_type,
          pt.task_flag,
          pt.requires_quote,
          pt.assign_to_commercial,
          pt.order_index,
          pt.created_at,
          pt.updated_at,
          p.title           AS project_title,
          pr.product_name,
          0                 AS quote_count,
          0                 AS pending_quote_count
        FROM project_tasks pt
        LEFT JOIN areas a            ON pt.area_id           = a.id
        LEFT JOIN users u            ON pt.assigned_user_id  = u.id
        LEFT JOIN projects p         ON pt.project_id        = p.id
        LEFT JOIN (
          SELECT pp.id, pr2.name AS product_name
          FROM project_products pp
          JOIN products pr2 ON pp.product_id = pr2.id
        ) pr ON pt.project_product_id = pr.id
        WHERE pt.assigned_user_id = $1
          AND pt.status IN ('in_progress', 'not_started', 'blocked')
        ORDER BY pt.status = 'in_progress' DESC, pt.updated_at DESC
      `,
      args: [userId],
    });
    return result.rows as unknown as ProjectTaskType[];
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return [];
  }
}

export async function logTaskTransition(
  taskId: number,
  projectId: number,
  fromStatus: string | null,
  toStatus: string,
  fromFlag: string | null,
  toFlag: string | null,
  movedBy: number,
  notes?: string | null
): Promise<void> {
  return logTransition(taskId, projectId, fromStatus, toStatus, fromFlag, toFlag, movedBy, notes);
}
