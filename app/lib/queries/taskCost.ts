import { revalidatePath } from "next/cache";
import { db } from "../db";
import { computeTaskCost, type ProjectFinancialRow } from "../project-financials";
import { withCurrentHourlyRates, type SalaryRateFields } from "../internal-rate";
import { WEEKLY_WORK_HOURS_SQL } from "./settings";

export type TaskCostSource = "frozen_rate" | "current_rate" | "declared" | "quote" | "none";

export interface TaskCost {
  cost: number;
  internal: boolean;
  minutes: number;
  /** Rate behind an internal cost: frozen when completed, current while unfinished. */
  hourly_rate: number | null;
  source: TaskCostSource;
  /** Completed external task: admin and directivo can correct its cost. */
  editable: boolean;
  /** Value the external declared before the first correction; null when never corrected. */
  original_cost: number | null;
  updated_by_name: string | null;
  updated_at: string | null;
}

export type TaskCostUpdateResult = "updated" | "not_found" | "not_completed" | "internal";

type LockedTaskCostRow = {
  status: string;
  completion_hourly_rate: number | string | null;
  completion_cost: number | string | null;
  completion_cost_original: number | string | null;
  assignee_is_internal: number | string | null;
};

type TaskCostAuditRow = {
  completion_cost_original: number | string | null;
  updated_by_name: string | null;
  completion_cost_updated_at: Date | string | null;
};

const toNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

const toIsoString = (value: Date | string | null): string | null =>
  value === null ? null : value instanceof Date ? value.toISOString() : String(value);

/** Internal work is valued by salary: a frozen rate or an internal assignee. */
const isInternalTask = (row: {
  completion_hourly_rate: number | string | null;
  assignee_is_internal: number | string | null;
}) => toNumber(row.completion_hourly_rate) !== null || Number(row.assignee_is_internal) === 1;

/** Explains which rule of computeTaskCost produced the cost (same order of precedence). */
function describeCost(row: ProjectFinancialRow): Pick<TaskCost, "hourly_rate" | "source"> {
  const frozenRate = toNumber(row.completion_hourly_rate);
  const quotePrice = toNumber(row.accepted_quote_price);

  if (row.status === "completed") {
    if (frozenRate !== null) return { hourly_rate: frozenRate, source: "frozen_rate" };
    if (toNumber(row.completion_cost) !== null) return { hourly_rate: null, source: "declared" };
    if (quotePrice !== null) return { hourly_rate: null, source: "quote" };
    return { hourly_rate: null, source: "none" };
  }
  if (Number(row.assignee_is_internal) === 1) {
    const currentRate = toNumber(row.assignee_hourly_rate);
    return currentRate !== null
      ? { hourly_rate: currentRate, source: "current_rate" }
      : { hourly_rate: null, source: "none" };
  }
  return quotePrice !== null ? { hourly_rate: null, source: "quote" } : { hourly_rate: null, source: "none" };
}

/** Cost of one task of a project; null when the task does not exist in that project. */
export async function getTaskCost(projectId: number, taskId: number): Promise<TaskCost | null> {
  const result = await db.execute({
    sql: `
      SELECT
        pt.assigned_user_id,
        u.name           AS assigned_user_name,
        u.is_internal    AS assignee_is_internal,
        u.monthly_salary AS assignee_monthly_salary,
        ${WEEKLY_WORK_HOURS_SQL} AS weekly_work_hours,
        pt.status,
        pt.progress_minutes,
        pt.completion_hourly_rate,
        pt.completion_cost,
        pt.completion_cost_original,
        pt.completion_cost_updated_by,
        pt.completion_cost_updated_at,
        editor.name      AS updated_by_name,
        (
          SELECT tq.price FROM task_quotes tq
          WHERE tq.task_id = pt.id AND tq.status = 'accepted'
          ORDER BY tq.updated_at DESC
          LIMIT 1
        ) AS accepted_quote_price
      FROM project_tasks pt
      LEFT JOIN users u ON u.id = pt.assigned_user_id
      LEFT JOIN users editor ON editor.id = pt.completion_cost_updated_by
      WHERE pt.id = $1 AND pt.project_id = $2
    `,
    args: [taskId, projectId],
  });
  if (result.rows.length === 0) return null;

  const audit = result.rows[0] as unknown as TaskCostAuditRow;
  const [row] = withCurrentHourlyRates([result.rows[0] as unknown as ProjectFinancialRow & SalaryRateFields]);
  const { internal, cost } = computeTaskCost(row);
  return {
    cost: Math.round(cost * 100) / 100,
    internal,
    minutes: toNumber(row.progress_minutes) ?? 0,
    ...describeCost(row),
    editable: row.status === "completed" && !isInternalTask(row),
    original_cost: toNumber(audit.completion_cost_original),
    updated_by_name: audit.updated_by_name ?? null,
    updated_at: toIsoString(audit.completion_cost_updated_at ?? null),
  };
}

/**
 * Corrects the cost of a completed external task (S15, S16).
 * The task row is locked so concurrent corrections keep the first declared
 * value in completion_cost_original; internal tasks are valued by salary and
 * are never edited. Rejections roll back without writing.
 */
export async function updateTaskCost(
  projectId: number,
  taskId: number,
  cost: number,
  userId: number
): Promise<TaskCostUpdateResult> {
  const tx = await db.transaction("write");
  let rejection: TaskCostUpdateResult | null = null;
  try {
    const locked = await tx.execute({
      sql: `SELECT pt.status, pt.completion_hourly_rate, pt.completion_cost,
                   pt.completion_cost_original, u.is_internal AS assignee_is_internal
            FROM project_tasks pt
            LEFT JOIN users u ON u.id = pt.assigned_user_id
            WHERE pt.id = $1 AND pt.project_id = $2
            FOR UPDATE OF pt`,
      args: [taskId, projectId],
    });
    const task = locked.rows[0] as unknown as LockedTaskCostRow | undefined;

    if (!task) rejection = "not_found";
    else if (task.status !== "completed") rejection = "not_completed";
    else if (isInternalTask(task)) rejection = "internal";
    else {
      // Keep the first declared value: only a real change of a declared value sets it.
      const previous = toNumber(task.completion_cost);
      const original =
        toNumber(task.completion_cost_original) ?? (previous !== null && previous !== cost ? previous : null);
      await tx.execute({
        sql: `UPDATE project_tasks
              SET completion_cost = $1,
                  completion_cost_original = $2,
                  completion_cost_updated_by = $3,
                  completion_cost_updated_at = CURRENT_TIMESTAMP
              WHERE id = $4 AND project_id = $5`,
        args: [cost, original, userId, taskId, projectId],
      });
      await tx.commit();
    }
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  if (rejection) {
    await tx.rollback();
    return rejection;
  }
  revalidatePath(`/projects/${projectId}`);
  return "updated";
}
