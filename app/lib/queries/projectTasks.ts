import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  ProjectTaskType,
  ProjectTaskStatus,
  TaskType,
  TaskFlag,
  TaskTransitionType,
  TaskCommandCenterFilters,
  TaskCommandCenterRow,
  MyTaskRowPaginated,
  MyTasksFilters,
} from "../definitions";
import { buildPaginationArgs, buildWhereClause, parseTotal } from "../db/query-helpers";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { CREATOR_FILTER_ROLES } from "@/lib/role-groups";

// ─── Shared SELECT fragments ──────────────────────────────────────────────────

const TASK_SELECT = `
  pt.id,
  pt.project_id,
  pt.template_id,
  pt.title,
  pt.description,
  pt.area_id,
  a.name            AS area_name,
  pt.assigned_user_id,
  u.name            AS assigned_user_name,
  u.rol_id          AS assigned_user_rol_id,
  u.is_internal     AS assigned_user_is_internal,
  pt.status,
  pt.task_type,
  pt.task_flag,
  pt.requires_quote,
  pt.assign_to_commercial,
  pt.order_index,
  pt.created_at,
  pt.updated_at,
  pt.assigned_at,
  pt.completed_at,
  pt.adjustment_id,
  pt.delivery_url,
  (
    SELECT tt.notes
    FROM task_transitions tt
    WHERE tt.task_id = pt.id
      AND tt.to_status = 'completed'
    ORDER BY tt.transitioned_at DESC, tt.id DESC
    LIMIT 1
  )                 AS delivery_notes,
  pt.completion_cost,
  pt.progress_percent,
  pt.progress_minutes,
  (SELECT json_agg(user_id) FROM task_quote_invitations WHERE task_id = pt.id) AS quoter_ids,
  (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id) AS quote_count,
  (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id AND tq.status = 'pending') AS pending_quote_count
`;

const TASK_JOINS = `
  FROM project_tasks pt
  LEFT JOIN areas a ON pt.area_id = a.id
  LEFT JOIN users u ON pt.assigned_user_id = u.id
`;

type TaskWithRawQuoterIds = ProjectTaskType & {
  quoter_ids?: number[] | string | null;
};

function normalizeTaskQuoterIds(task: TaskWithRawQuoterIds): ProjectTaskType {
  if (typeof task.quoter_ids === "string") {
    try {
      task.quoter_ids = JSON.parse(task.quoter_ids) as number[];
    } catch {
      task.quoter_ids = [];
    }
  } else if (!task.quoter_ids) {
    task.quoter_ids = [];
  }

  return task;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProjectTaskById(id: number): Promise<ProjectTaskType | null> {
  try {
    const result = await db.execute({
      sql: `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE pt.id = $1`,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const task = result.rows[0] as unknown as TaskWithRawQuoterIds;
    return normalizeTaskQuoterIds(task);
  } catch (error) {
    console.error("Error fetching project task by ID:", error);
    return null;
  }
}

export async function getTasksByProject(projectId: number, adjustmentId?: number | null): Promise<ProjectTaskType[]> {
  try {
    let whereSQL = `pt.project_id = $1`;
    const args: unknown[] = [projectId];

    if (adjustmentId !== undefined) {
      if (adjustmentId === null) {
         whereSQL += ` AND pt.adjustment_id IS NULL`;
      } else {
         whereSQL += ` AND pt.adjustment_id = $2`;
         args.push(adjustmentId);
      }
    }

    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        WHERE ${whereSQL}
        ORDER BY pt.order_index ASC, pt.id ASC
      `,
      args,
    });
    const tasks = result.rows as unknown as TaskWithRawQuoterIds[];
    return tasks.map(normalizeTaskQuoterIds);
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
  adjustment_id?: number | null;
}): Promise<ProjectTaskType> {
  if (data.task_type === "validation" && data.order_index === 0) {
    throw new Error("Una tarea de validación no puede ser la primera tarea del proyecto.");
  }
  try {
    const status = data.status ?? (data.order_index === 0 ? "not_started" : "waiting");
    const assignedUserId = data.assigned_user_id ?? null;
    const assignedAt = (status === "not_started" && assignedUserId) ? new Date() : null;

    const result = await db.execute({
      sql: `
        INSERT INTO project_tasks
          (project_id, template_id, title, description,
           area_id, assigned_user_id, status, task_type, task_flag,
           requires_quote, assign_to_commercial, order_index, assigned_at, adjustment_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `,
      args: [
        data.project_id,
        data.template_id ?? null,
        data.title,
        data.description ?? null,
        data.area_id ?? null,
        assignedUserId,
        status,
        data.task_type ?? "execution",
        data.task_flag ?? "new",
        data.requires_quote ?? 0,
        data.assign_to_commercial ?? 0,
        data.order_index,
        assignedAt,
        data.adjustment_id ?? null,
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
    const currentTask = await getProjectTaskById(id);
    if (!currentTask) return null;

    // Protection: Completed tasks are read-only
    if (currentTask.status === "completed") {
      throw new Error("No se pueden editar tareas completadas.");
    }

    const updates: string[] = [];
    const args: unknown[] = [];

    // Auto-update assigned_at if:
    // 1. Status is changing from 'waiting' to 'not_started' (and it has a user)
    // 2. A user is being assigned AND the resulting status is NOT 'waiting'
    const newStatus = data.status || currentTask.status;
    const isChangingToNotStarted = currentTask.status === "waiting" && data.status === "not_started";
    const isAssigningUser = data.assigned_user_id && !currentTask.assigned_user_id;
    const isAlreadyActive = newStatus !== "waiting";

    if ((isChangingToNotStarted && (data.assigned_user_id || currentTask.assigned_user_id)) || (isAssigningUser && isAlreadyActive)) {
      updates.push("assigned_at = CURRENT_TIMESTAMP");
    }

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

    if (updates.length === 0) return currentTask;

    // Business rule validation: Validation task cannot be in first position
    if (data.task_type === "validation" && currentTask.order_index === 0) {
      throw new Error("Una tarea de validación no puede ser la primera tarea del proyecto.");
    }

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
    if (!task) return;
    if (task.status === "completed") {
      throw new Error("No se pueden eliminar tareas completadas.");
    }
    await db.execute({ sql: `DELETE FROM project_tasks WHERE id = $1`, args: [id] });
    revalidatePath(`/projects/${task.project_id}`);
  } catch (error) {
    console.error("Error deleting project task:", error);
    throw error;
  }
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export async function reorderProjectTasks(
  projectId: number,
  orderedIds: number[],
  adjustmentId?: number | null
): Promise<void> {
  const currentTasks = await getTasksByProject(projectId, adjustmentId);
  const completedTaskIds = currentTasks.filter(t => t.status === "completed").map(t => t.id);

  // Business Rule: Completed tasks must not change their position relative to others
  // In practice, this means they stay at their fixed order_index (assuming they were at the top)
  for (const tid of completedTaskIds) {
    const task = currentTasks.find(t => t.id === tid)!;
    const currentIdx = task.order_index;
    const newIdx = orderedIds.indexOf(tid);
    
    // If the completed task is in the list being reordered, its index must match its current order_index
    if (newIdx !== -1 && newIdx !== currentIdx) {
      throw new Error("Las tareas completadas no pueden ser reordenadas.");
    }
  }

  const adjustmentFilter = adjustmentId === undefined ? "" : (adjustmentId === null ? "AND adjustment_id IS NULL" : `AND adjustment_id = ${adjustmentId}`);

  const transaction = await db.transaction("write");
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await transaction.execute({
        sql: `UPDATE project_tasks SET order_index = $1 WHERE id = $2 AND project_id = $3 ${adjustmentFilter}`,
        args: [i, orderedIds[i], projectId],
      });
    }

    // Status logic:
    // 1. The first task that is NOT completed must be set to 'not_started' if it was 'waiting'
    // 2. All subsequent tasks that are 'not_started' must be set to 'waiting'
    const updatedTasksResult = await transaction.execute({
      sql: `SELECT id, status, assigned_user_id FROM project_tasks WHERE project_id = $1 ${adjustmentFilter} ORDER BY order_index ASC`,
      args: [projectId],
    });
    const updatedTasks = updatedTasksResult.rows as unknown as { id: number; status: ProjectTaskStatus; assigned_user_id: number | null }[];
    
    let firstNonCompletedFound = false;
    for (const task of updatedTasks) {
      if (task.status === "completed") continue;

      if (!firstNonCompletedFound) {
        firstNonCompletedFound = true;
        if (task.status === "waiting") {
          await transaction.execute({
            sql: `UPDATE project_tasks SET status = 'not_started', assigned_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            args: [task.id, task.assigned_user_id ? new Date() : null],
          });
        }
      } else {
        if (task.status === "not_started") {
          await transaction.execute({
            sql: `UPDATE project_tasks SET status = 'waiting', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            args: [task.id],
          });
        }
      }
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

// ─── Start task (not_started → in_progress) ──────────────────────────────────

/**
 * Transitions a task from 'not_started' to 'in_progress'.
 * Only callable when the task is in 'not_started' status.
 */
export async function startTask(
  taskId: number,
  movedByUserId: number
): Promise<{ success: boolean; error?: string }> {
  const result = await db.execute({
    sql: `SELECT id, status, assigned_user_id, project_id FROM project_tasks WHERE id = $1`,
    args: [taskId],
  });

  if (result.rows.length === 0) {
    return { success: false, error: "Tarea no encontrada" };
  }

  const task = result.rows[0] as unknown as {
    id: number;
    status: ProjectTaskStatus;
    assigned_user_id: number | null;
    project_id: number;
  };

  if (task.status !== "not_started") {
    return {
      success: false,
      error: 'La tarea debe estar en estado "sin iniciar" para poder tomarla',
    };
  }

  await db.execute({
    sql: `UPDATE project_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
    args: [taskId],
  });

  await db.execute({
    sql: `
      INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
      SELECT $1, project_id, 'not_started', 'in_progress', task_flag, task_flag, $2, ''
      FROM project_tasks WHERE id = $1
    `,
    args: [taskId, movedByUserId],
  });

  revalidatePath(`/projects/${task.project_id}`);
  return { success: true };
}

// ─── Complete task (execution flow) ──────────────────────────────────────────

/**
 * Marks an execution task as completed and auto-activates the next task in order.
 * Only the assigned user can complete (enforced at API layer).
 */
export async function completeTask(
  taskId: number,
  userId: number,
  notes?: string | null,
  options?: {
    progress_minutes?: number;
    delivery_url?: string | null;
    completion_cost?: number | null;
  }
): Promise<{ task: ProjectTaskType; nextTask: ProjectTaskType | null; blockedReason?: string }> {
  const task = await getProjectTaskById(taskId);
  if (!task) throw new Error("Tarea no encontrada");
  if (task.status === "completed") throw new Error("Esta tarea ya está completada y no puede modificarse");
  // Permite completar tanto tareas de ejecución como de validación (usado por validateTask)
  if (task.task_type !== "execution" && task.task_type !== "validation") {
    throw new Error("Tipo de tarea no válido para completar");
  }
  if (task.status !== "in_progress") {
    throw new Error("Solo se pueden completar tareas en progreso");
  }

  const transaction = await db.transaction("write");
  try {
    // 1. Mark current task as completed (with optional enrichment fields)
    await transaction.execute({
      sql: `UPDATE project_tasks
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP,
                progress_minutes = $2,
                delivery_url = $3,
                completion_cost = $4,
                progress_percent = 100
            WHERE id = $1`,
      args: [
        taskId,
        options?.progress_minutes ?? 0,
        options?.delivery_url ?? null,
        options?.completion_cost ?? null,
      ],
    });

    // 2. Log transition
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'completed', $4, $4, $5, $6)
      `,
      args: [taskId, task.project_id, task.status, task.task_flag, userId, notes ?? null],
    });

    // 3. Find next task in this project — must be in the same adjustment version
    const adjFilter = task.adjustment_id !== null
      ? `AND adjustment_id = ${task.adjustment_id}`
      : `AND adjustment_id IS NULL`;

    const nextResult = await transaction.execute({
      sql: `
        SELECT id, assigned_user_id, requires_quote, task_flag, status
        FROM project_tasks
        WHERE project_id = $1
          AND order_index > (SELECT order_index FROM project_tasks WHERE id = $2)
          AND status IN ('waiting', 'not_started')
          ${adjFilter}
        ORDER BY order_index ASC
        LIMIT 1
      `,
      args: [task.project_id, taskId],
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
          sql: `UPDATE project_tasks SET status = 'not_started', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          args: [next.id],
        });
        await transaction.execute({
          sql: `
            INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
            VALUES ($1, $2, $3, 'not_started', $4, $4, $5, $6)
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

// ─── Rejection loop — append-only new tasks ──────────────────────────────────

/**
 * On validation rejection, inserts two new tasks after the rejected validation task N:
 *   N+1: clone of target task M (task_flag='correction', status='not_started')
 *   N+2: clone of validation task N (task_flag='correction', task_type='validation', status='not_started')
 * All tasks with order_index > N.order_index are shifted by +2.
 * Task N is marked as completed and logged in task_transitions.
 * Everything runs inside a single transaction.
 */
export async function createRejectionLoopTasks(
  projectId: number,
  rejectedValidationTaskId: number,
  targetTaskId: number,
  userId: number,
  notes?: string | null
): Promise<{ firstCorrectionTask: ProjectTaskType }> {
  // Step 1: Fetch task N (validation being rejected) and task M (target to send back to)
  const [taskNResult, taskMResult] = await Promise.all([
    db.execute({
      sql: `SELECT id, order_index, task_flag, status, adjustment_id FROM project_tasks WHERE id = $1 AND project_id = $2`,
      args: [rejectedValidationTaskId, projectId],
    }),
    db.execute({
      sql: `SELECT id, order_index FROM project_tasks WHERE id = $1 AND project_id = $2`,
      args: [targetTaskId, projectId],
    }),
  ]);

  if (taskNResult.rows.length === 0) throw new Error("Tarea de validación no encontrada");
  if (taskMResult.rows.length === 0) throw new Error("Tarea destino no encontrada");

  const taskN = taskNResult.rows[0] as unknown as { id: number; order_index: number; task_flag: string; status: string; adjustment_id: number | null };
  const taskM = taskMResult.rows[0] as unknown as { id: number; order_index: number };

  // Step 2: Fetch the range of tasks between M and N inclusive (ONLY within the same adjustment)
  const adjustmentFilterSQL = taskN.adjustment_id === null ? "AND adjustment_id IS NULL" : "AND adjustment_id = $4";
  const rangeArgs = [projectId, taskM.order_index, taskN.order_index];
  if (taskN.adjustment_id !== null) rangeArgs.push(taskN.adjustment_id);

  const rangeResult = await db.execute({
    sql: `
      SELECT * FROM project_tasks 
      WHERE project_id = $1 
        AND order_index >= $2 
        AND order_index <= $3
        ${adjustmentFilterSQL}
      ORDER BY order_index ASC
    `,
    args: rangeArgs,
  });

  const rangeTasks = rangeResult.rows as unknown as ProjectTaskType[];
    const K = rangeTasks.length;

    const adjustmentFilter = taskN.adjustment_id === null ? "AND adjustment_id IS NULL" : "AND adjustment_id = $4";
    const shiftArgs = [K, projectId, taskN.order_index];
    if (taskN.adjustment_id !== null) shiftArgs.push(taskN.adjustment_id);

    const transaction = await db.transaction("write");
    try {
      // Step 3: Shift all tasks after N up by K
      await transaction.execute({
        sql: `
          UPDATE project_tasks
          SET order_index = order_index + $1, updated_at = CURRENT_TIMESTAMP
          WHERE project_id = $2 AND order_index > $3 ${adjustmentFilter}
        `,
        args: shiftArgs,
      });

      const newTasksIds: number[] = [];

    // Step 4: Clone all tasks in the range
    for (let i = 0; i < K; i++) {
      const original = rangeTasks[i];
      const newStatus: ProjectTaskStatus = i === 0 ? "not_started" : "waiting";
      const newOrderIndex = taskN.order_index + 1 + i;

      const cloneInsert = await transaction.execute({
        sql: `
          INSERT INTO project_tasks
            (project_id, template_id, title, description,
             area_id, assigned_user_id, status, task_type, task_flag,
             requires_quote, assign_to_commercial, order_index, assigned_at, adjustment_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'correction', $9, $10, $11, $12, $13)
          RETURNING id
        `,
        args: [
          projectId,
          original.template_id ?? null,
          original.title,
          original.description ?? null,
          original.area_id ?? null,
          original.assigned_user_id ?? null,
          newStatus,
          original.task_type,
          original.requires_quote ?? 0,
          original.assign_to_commercial ?? 0,
          newOrderIndex,
          (newStatus === "not_started" && original.assigned_user_id) ? new Date() : null,
          taskN.adjustment_id ?? null,
        ],
      });
      const newTaskId = Number(cloneInsert.rows[0]?.id);
      newTasksIds.push(newTaskId);

      // Step 5: Log transition for each new clone (null → status)
      await transaction.execute({
        sql: `
          INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
          VALUES ($1, $2, NULL, $3, NULL, 'correction', $4, NULL)
        `,
        args: [newTaskId, projectId, newStatus, userId],
      });
    }

    // Step 6: Mark task N as completed
    await transaction.execute({
      sql: `UPDATE project_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [rejectedValidationTaskId],
    });

    // Step 7: Log transition for task N (status → completed)
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'completed', $4, $4, $5, $6)
      `,
      args: [rejectedValidationTaskId, projectId, taskN.status, taskN.task_flag, userId, notes ?? "Validación rechazada, enviada a corrección"],
    });

    await transaction.commit();

    const firstCorrectionTask = await getProjectTaskById(newTasksIds[0]);

    revalidatePath(`/projects/${projectId}`);
    return { firstCorrectionTask: firstCorrectionTask! };
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating rejection loop tasks:", error);
    throw error;
  }
}

// ─── Validate task (validation flow) ─────────────────────────────────────────

/**
 * Handles validation task actions:
 * - approve: same as complete, moves to next task in order
 * - reject: creates two new tasks (correction clone of M + re-validation clone of N) after N,
 *           marks N as completed, and shifts all subsequent order_indexes by 2
 */
export async function validateTask(
  taskId: number,
  userId: number,
  action: "approve" | "reject",
  targetTaskId?: number,
  notes?: string | null
): Promise<{ task: ProjectTaskType; targetTask: ProjectTaskType | null; blockedReason?: string }> {
  const task = await getProjectTaskById(taskId);
  if (!task) throw new Error("Tarea no encontrada");
  if (task.status === "completed") throw new Error("Esta tarea ya está completada y no puede modificarse");
  if (task.task_type !== "validation") throw new Error("Solo se pueden validar tareas de tipo validación");
  if (task.status !== "in_progress") {
    throw new Error("La tarea de validación no está en un estado que permita validarla");
  }

  if (action === "approve") {
    const result = await completeTask(taskId, userId, notes);
    return { task: result.task, targetTask: result.nextTask, blockedReason: result.blockedReason };
  }

  // Reject: create two new tasks (correction + re-validation) instead of mutating existing tasks
  if (targetTaskId === undefined) throw new Error("Se requiere indicar a qué tarea volver");

  const loopResult = await createRejectionLoopTasks(task.project_id, taskId, targetTaskId, userId, notes);

  const updatedTask = await getProjectTaskById(taskId);
  revalidatePath(`/projects/${task.project_id}`);
  return { task: updatedTask!, targetTask: loopResult.firstCorrectionTask };
}

// ─── Auto-assignment helpers ──────────────────────────────────────────────────

/**
 * Resolves the assigned_user_id based on assignment mode.
 * Priority: 
 * 1. Specific User (fixed)
 * 2. Commercial (Project Manager email lookup -> Creator fallback)
 * 3. Auto-assign (Least loaded in Area)
 */
export async function resolveProjectTaskAssignment(
  projectId: number,
  data: {
    assigned_user_id?: number | null;
    area_id?: number | null;
    assign_to_commercial?: number;
  }
): Promise<number | null> {
  try {
    // 1. Explicitly assigned user
    if (data.assigned_user_id) {
      return data.assigned_user_id;
    }

    // 2. Commercial mode
    if (Number(data.assign_to_commercial) === 1) {
      const projectResult = await db.execute({
        sql: `
          SELECT p.created_by, m.email AS manager_email
          FROM projects p
          LEFT JOIN managers m ON p.manager_id = m.id
          WHERE p.id = $1
        `,
        args: [projectId],
      });

      if (projectResult.rows.length > 0) {
        const row = projectResult.rows[0] as unknown as { created_by: number | null; manager_email: string | null };
        
        if (row.manager_email) {
          const userResult = await db.execute({
            sql: `SELECT id FROM users WHERE email = $1 AND is_active = 1 LIMIT 1`,
            args: [row.manager_email],
          });
          if (userResult.rows.length > 0) {
            return Number((userResult.rows[0] as unknown as { id: number }).id);
          }
        }
        
        // Fallback to creator
        if (row.created_by) {
          return row.created_by;
        }
      }
      return null;
    }

    // 3. Auto-assign by Area (if area_id is provided and no specific user)
    if (data.area_id) {
      return findLeastLoadedInternalCollaborator(data.area_id);
    }

    return null;
  } catch (error) {
    console.error("Error resolving project task assignment:", error);
    return null;
  }
}

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
  productId: number,
  commercialUserId?: number | null,
  adjustmentId?: number | null,
  invitedBy?: number | null
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
        let status: ProjectTaskStatus = i === 0 ? "not_started" : "waiting";
        const isBlockedByQuote = status === "not_started" && Number(tpl.requires_quote) === 1 && !assignedTo;
        
        if (isBlockedByQuote) {
          status = "blocked";
        }

        const assignedAt = (status === "not_started" || status === "blocked") && assignedTo ? new Date() : null;

        const insertResult = await transaction.execute({
          sql: `
            INSERT INTO project_tasks
              (project_id, template_id, title, description,
               area_id, assigned_user_id, status, task_type, task_flag,
               requires_quote, assign_to_commercial, order_index, assigned_at, adjustment_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9, $10, $11, $12, $13)
            RETURNING id
          `,
          args: [
            projectId,
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
            assignedAt,
            adjustmentId ?? null,
          ],
        });

        const newTaskId = Number(insertResult.rows[0]?.id);

        // Copy pre-configured quoters to task_quote_invitations
        if (Number(tpl.requires_quote) === 1) {
          const templateQuoters = await db.execute({
            sql: `SELECT user_id FROM product_task_template_quoters WHERE template_id = $1`,
            args: [tpl.id],
          });
          for (const row of templateQuoters.rows) {
            await transaction.execute({
              sql: `
                INSERT INTO task_quote_invitations (task_id, user_id, invited_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (task_id, user_id) DO NOTHING
              `,
              args: [newTaskId, (row as { user_id: number }).user_id, invitedBy ?? null],
            });
          }

          // Log transition if blocked
          if (isBlockedByQuote && invitedBy) {
            await transaction.execute({
              sql: `INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
                    VALUES ($1, $2, NULL, $3, NULL, 'new', $4, $5)`,
              args: [newTaskId, projectId, "blocked", invitedBy, "Requiere cotización de colaborador externo"],
            });
          }
        }
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
  console.log(`Fetching tasks for user ${userId}`);
  try {
    const result = await db.execute({
      sql: `
        SELECT
          pt.id,
          pt.project_id,
          pt.template_id,
          pt.title,
          pt.description,
          pt.area_id,
          a.name            AS area_name,
          pt.assigned_user_id,
          u.name            AS assigned_user_name,
          u.rol_id          AS assigned_user_rol_id,
          u.is_internal     AS assigned_user_is_internal,
          pt.status,
          pt.task_type,
          pt.task_flag,
          pt.requires_quote,
          pt.assign_to_commercial,
          pt.order_index,
          pt.created_at,
          pt.updated_at,
          pt.delivery_url,
          pt.completion_cost,
          pt.progress_percent,
          pt.progress_minutes,
          p.title           AS project_title,
          pr.name           AS product_name,
          0                 AS quote_count,
          0                 AS pending_quote_count
        FROM project_tasks pt
        LEFT JOIN areas a            ON pt.area_id           = a.id
        LEFT JOIN users u            ON pt.assigned_user_id  = u.id
        LEFT JOIN projects p         ON pt.project_id        = p.id
        LEFT JOIN products pr        ON p.product_id         = pr.id
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

// ─── My Tasks — paginated ─────────────────────────────────────────────────────

const DEFAULT_MY_TASK_STATUSES: ProjectTaskStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "waiting",
];

export async function getMyTasksWithPagination(
  filters: MyTasksFilters & { userId: number }
): Promise<{ tasks: MyTaskRowPaginated[]; total: number }> {
  try {
    const {
      userId,
      page = 1,
      limit = ITEMS_PER_PAGE,
      statuses,
      brandId,
      creatorUserId,
      assignedFrom,
      assignedTo,
      q,
    } = filters;

    const resolvedStatuses =
      statuses && statuses.length > 0
        ? Array.from(new Set(statuses))
        : DEFAULT_MY_TASK_STATUSES;

    // Build base args + handle the OR search manually before buildWhereClause
    const baseArgs: unknown[] = [];
    const extraClauses: string[] = [];

    // Handle q (search) manually — two columns share the same $N placeholder
    if (q) {
      const pct = `%${q}%`;
      baseArgs.push(pct);
      extraClauses.push(
        `(pt.title ILIKE $${baseArgs.length} OR p.title ILIKE $${baseArgs.length})`
      );
    }

    // Build remaining WHERE conditions via buildWhereClause
    const conditions: Array<{ sql: string; value: unknown }> = [
      { sql: "pt.assigned_user_id = $", value: userId },
      { sql: "pt.status = ANY($)", value: resolvedStatuses },
      { sql: "p.brand_id = $", value: brandId },
      { sql: "p.created_by = $", value: creatorUserId },
      { sql: "pt.assigned_at >= $", value: assignedFrom },
      { sql: "pt.assigned_at <= $", value: assignedTo },
    ];

    const { whereSQL: dynamicWhereSQL, args: whereArgs } = buildWhereClause(conditions);
    const dynamicClauses = dynamicWhereSQL
      .replace(/^\s*WHERE\s*/i, "")
      .split(" AND ")
      .filter(Boolean)
      .map((clause) =>
        clause.replace(/\$(\d+)/g, (_, idx) => `$${Number(idx) + baseArgs.length}`)
      );

    const dynamicArgs: unknown[] = [...baseArgs, ...whereArgs];
    const whereParts = [...extraClauses, ...dynamicClauses];
    const whereSQL = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";

    // Count query (lighter JOINs: only what WHERE clause references)
    const countQuery = db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM project_tasks pt
        INNER JOIN projects p     ON p.id = pt.project_id
        LEFT JOIN brands b        ON b.id = p.brand_id
        LEFT JOIN users creator   ON creator.id = p.created_by
        ${whereSQL}
      `,
      args: dynamicArgs,
    });

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(
      dynamicArgs,
      page,
      limit
    );

    // Main data query (full JOIN set)
    const dataQuery = db.execute({
      sql: `
        SELECT
          pt.id,
          pt.title,
          pt.description,
          pt.project_id,
          p.title              AS project_title,
          pr.name              AS product_name,
          b.name               AS brand_name,
          b.id                 AS brand_id,
          creator.id           AS creator_user_id,
          creator.name         AS creator_user_name,
          pt.assigned_user_id,
          u.name               AS assigned_user_name,
          u.rol_id             AS assigned_user_rol_id,
          u.is_internal        AS assigned_user_is_internal,
          pt.area_id,
          a.name               AS area_name,
          pt.status,
          pt.task_type,
          pt.task_flag,
          pt.requires_quote,
          pt.assign_to_commercial,
          pt.order_index,
          pt.adjustment_id,
          COALESCE(pa.version_number, 1) AS version_number,
          pt.assigned_at,
          pt.completed_at,
          pt.created_at,
          pt.updated_at,
          pt.delivery_url,
          pt.completion_cost,
          pt.progress_percent,
          pt.progress_minutes,
          (SELECT json_agg(user_id) FROM task_quote_invitations WHERE task_id = pt.id) AS quoter_ids,
          (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id)               AS quote_count,
          (SELECT COUNT(*) FROM task_quotes tq WHERE tq.task_id = pt.id AND tq.status = 'pending') AS pending_quote_count
        FROM project_tasks pt
        INNER JOIN projects p     ON p.id = pt.project_id
        LEFT JOIN products pr     ON pr.id = p.product_id
        LEFT JOIN brands b        ON b.id = p.brand_id
        LEFT JOIN users creator   ON creator.id = p.created_by
        LEFT JOIN users u         ON u.id = pt.assigned_user_id
        LEFT JOIN areas a         ON a.id = pt.area_id
        LEFT JOIN project_adjustments pa ON pa.id = pt.adjustment_id
        ${whereSQL}
        ORDER BY
          CASE pt.status
            WHEN 'in_progress' THEN 0
            WHEN 'not_started' THEN 1
            WHEN 'blocked'     THEN 2
            WHEN 'waiting'     THEN 3
            WHEN 'completed'   THEN 4
          END ASC,
          COALESCE(pt.assigned_at, pt.created_at) DESC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...dynamicArgs, ...paginationArgs],
    });

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const tasks = (dataResult.rows as unknown as MyTaskRowPaginated[]).map((task) => {
      if (typeof (task as unknown as { quoter_ids: unknown }).quoter_ids === "string") {
        try {
          task.quoter_ids = JSON.parse(
            (task as unknown as { quoter_ids: string }).quoter_ids
          );
        } catch {
          task.quoter_ids = [];
        }
      } else if (!(task as unknown as { quoter_ids: unknown }).quoter_ids) {
        task.quoter_ids = [];
      }
      return task;
    });

    return { tasks, total };
  } catch (error) {
    console.error("Error fetching my tasks with pagination:", error);
    return { tasks: [], total: 0 };
  }
}

// ─── Progress update ──────────────────────────────────────────────────────────

/**
 * Updates task progress: sets progress_percent and accumulates additional_minutes.
 * Validation (e.g. status check) is handled at the API layer.
 */
export async function updateTaskProgress(
  taskId: number,
  data: { progress_percent: number; additional_minutes: number }
): Promise<ProjectTaskType> {
  const currentTask = await getProjectTaskById(taskId);
  if (!currentTask) {
    throw new Error("Tarea no encontrada");
  }

  await db.execute({
    sql: `UPDATE project_tasks
          SET progress_percent = $1,
              progress_minutes = progress_minutes + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3`,
    args: [data.progress_percent, data.additional_minutes, taskId],
  });

  revalidatePath(`/projects/${currentTask.project_id}`);
  const updatedTask = await getProjectTaskById(taskId);

  if (!updatedTask) {
    throw new Error("No fue posible obtener la tarea actualizada");
  }

  return updatedTask;
}

export async function getTasksCommandCenterWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  creatorUserId,
  areaId,
  assignedUserId,
  statuses,
  taskType,
  taskFlag,
  assignedFrom,
  assignedTo,
  completedFrom,
  completedTo,
}: TaskCommandCenterFilters): Promise<{ tasks: TaskCommandCenterRow[]; total: number }> {
  try {
    const requestedStatuses = statuses && statuses.length > 0
      ? Array.from(new Set(statuses))
      : ["not_started", "waiting", "in_progress", "completed", "blocked"];

    const hasAllStatuses = requestedStatuses.length === 5;
    const includeCompleted = requestedStatuses.includes("completed");
    const statusesWithoutCompleted = requestedStatuses.filter((taskStatus) => taskStatus !== "completed");
    const restrictByStatuses = !hasAllStatuses;

    const conditions: Array<{ sql: string; value: unknown }> = [
      { sql: "creator.rol_id = ANY($)", value: CREATOR_FILTER_ROLES },
      { sql: "p.created_by = $", value: creatorUserId },
      { sql: "pt.area_id = $", value: areaId },
      { sql: "pt.assigned_user_id = $", value: assignedUserId },
      { sql: "pt.task_type = $", value: taskType },
      { sql: "pt.task_flag = $", value: taskFlag },
      { sql: "pt.assigned_at >= $", value: assignedFrom },
      { sql: "pt.assigned_at <= $", value: assignedTo },
      { sql: "pt.completed_at >= $", value: completedFrom },
      { sql: "pt.completed_at <= $", value: completedTo },
    ];

    if (restrictByStatuses) {
      if (requestedStatuses.length === 0) {
        conditions.push({ sql: "pt.status = ANY($::text[])", value: [] });
      } else if (includeCompleted && statusesWithoutCompleted.length === 0) {
        conditions.push({ sql: "pt.status = ANY($)", value: ["completed"] });
      } else if (includeCompleted && statusesWithoutCompleted.length > 0) {
        conditions.push({ sql: "(pt.status = 'completed' OR pt.status = ANY($))", value: statusesWithoutCompleted });
      } else {
        conditions.push({ sql: "pt.status = ANY($)", value: statusesWithoutCompleted });
      }
    }

    const { whereSQL, args } = buildWhereClause(conditions);

    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM project_tasks pt
        INNER JOIN projects p ON p.id = pt.project_id
        LEFT JOIN users creator ON creator.id = p.created_by
        ${whereSQL}
      `,
      args,
    });

    const total = parseTotal(countResult.rows as Record<string, unknown>[]);
    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);

    const result = await db.execute({
      sql: `
        SELECT
          pt.id,
          pt.title,
          pt.project_id,
          p.title AS project_title,
          pr.name AS product_name,
          pt.assigned_user_id,
          assignee.name AS assigned_user_name,
          assignee.is_internal AS assigned_user_is_internal,
          pt.task_flag,
          pt.task_type,
          pt.status,
          pt.requires_quote,
          pt.assigned_at,
          pt.completed_at
        FROM project_tasks pt
        INNER JOIN projects p ON p.id = pt.project_id
        LEFT JOIN users creator ON creator.id = p.created_by
        LEFT JOIN users assignee ON assignee.id = pt.assigned_user_id
        LEFT JOIN products pr ON pr.id = p.product_id
        ${whereSQL}
        ORDER BY COALESCE(pt.assigned_at, pt.created_at) DESC, pt.id DESC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...args, ...paginationArgs],
    });

    return {
      tasks: result.rows as unknown as TaskCommandCenterRow[],
      total,
    };
  } catch (error) {
    console.error("Error fetching command center tasks:", error);
    return { tasks: [], total: 0 };
  }
}

// ─── Quote View ───────────────────────────────────────────────────────────────

/**
 * Returns tasks in a project that the given user has been invited to quote.
 * Used for collaborator quote view authorization (includes historical invitations).
 * Does NOT filter by task status — a user who was ever invited retains access to view the project.
 */
export async function getTasksForQuoteView(projectId: number, userId: number): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        JOIN task_quote_invitations tqi ON tqi.task_id = pt.id
        WHERE pt.project_id = $1 AND tqi.user_id = $2
        ORDER BY pt.order_index ASC
      `,
      args: [projectId, userId],
    });
    return (result.rows as unknown as TaskWithRawQuoterIds[]).map(normalizeTaskQuoterIds);
  } catch (error) {
    console.error("Error fetching tasks for quote view:", error);
    return [];
  }
}

/**
 * Returns the IDs of tasks in a project that are still open for quoting by the given user.
 * A task is open for quoting if:
 *   - The user was invited
 *   - The task still requires a quote (requires_quote = 1)
 *   - The task is still blocked (no one assigned yet)
 *   - No other quote has been accepted for this task
 *   - The user has not yet submitted a quote for this task
 */
export async function getOpenQuoteTaskIds(projectId: number, userId: number): Promise<number[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT pt.id
        FROM project_tasks pt
        JOIN task_quote_invitations tqi ON tqi.task_id = pt.id
        WHERE pt.project_id = $1
          AND tqi.user_id = $2
          AND pt.requires_quote = 1
          AND pt.status = 'blocked'
          AND pt.assigned_user_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM task_quotes tq2
            WHERE tq2.task_id = pt.id AND tq2.status = 'accepted'
          )
          AND NOT EXISTS (
            SELECT 1 FROM task_quotes tq3
            WHERE tq3.task_id = pt.id AND tq3.user_id = $2
          )
      `,
      args: [projectId, userId],
    });
    return result.rows.map((r) => Number((r as unknown as { id: number }).id));
  } catch (error) {
    console.error("Error fetching open quote task ids:", error);
    return [];
  }
}
