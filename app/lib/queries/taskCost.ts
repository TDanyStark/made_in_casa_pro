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
}

const toNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

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
        (
          SELECT tq.price FROM task_quotes tq
          WHERE tq.task_id = pt.id AND tq.status = 'accepted'
          ORDER BY tq.updated_at DESC
          LIMIT 1
        ) AS accepted_quote_price
      FROM project_tasks pt
      LEFT JOIN users u ON u.id = pt.assigned_user_id
      WHERE pt.id = $1 AND pt.project_id = $2
    `,
    args: [taskId, projectId],
  });
  if (result.rows.length === 0) return null;

  const [row] = withCurrentHourlyRates([result.rows[0] as unknown as ProjectFinancialRow & SalaryRateFields]);
  const { internal, cost } = computeTaskCost(row);
  return {
    cost: Math.round(cost * 100) / 100,
    internal,
    minutes: toNumber(row.progress_minutes) ?? 0,
    ...describeCost(row),
  };
}
