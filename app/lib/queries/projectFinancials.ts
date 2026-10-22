import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  computeProjectFinancials,
  type ProjectFinancialRow,
  type ProjectFinancials,
} from "../project-financials";
import { withCurrentHourlyRates, type SalaryRateFields } from "../internal-rate";
import { WEEKLY_WORK_HOURS_SQL } from "./settings";

export interface ProjectVersion {
  id: number;
  version_number: number;
}

/** Financials plus the project versions and the version filter applied (null = all). */
export interface ProjectFinancialsView extends ProjectFinancials {
  versions: ProjectVersion[];
  adjustment_id: number | null;
}

/**
 * Sale price plus hours and money invested; null when the project does not exist.
 * With adjustmentId only that version's tasks count. The sale price is for the
 * whole project, so a filtered summary returns margin null.
 */
export async function getProjectFinancials(
  projectId: number,
  adjustmentId: number | null = null
): Promise<ProjectFinancialsView | null> {
  const project = await db.execute({
    sql: `SELECT sale_price FROM projects WHERE id = $1`,
    args: [projectId],
  });
  if (project.rows.length === 0) return null;

  const versions = await db.execute({
    sql: `SELECT id, version_number FROM project_adjustments WHERE project_id = $1 ORDER BY version_number ASC, id ASC`,
    args: [projectId],
  });

  const tasks = await db.execute({
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
      WHERE pt.project_id = $1${adjustmentId === null ? "" : " AND pt.adjustment_id = $2"}
    `,
    args: adjustmentId === null ? [projectId] : [projectId, adjustmentId],
  });

  const financials = computeProjectFinancials(
    withCurrentHourlyRates(tasks.rows as unknown as (ProjectFinancialRow & SalaryRateFields)[]),
    (project.rows[0] as { sale_price: number | string | null }).sale_price
  );
  return {
    ...financials,
    margin: adjustmentId === null ? financials.margin : null,
    versions: (versions.rows as unknown as { id: number | string; version_number: number | string }[]).map(
      (v) => ({ id: Number(v.id), version_number: Number(v.version_number) })
    ),
    adjustment_id: adjustmentId,
  };
}

/** Sets (or clears with null) the sale price; false when the project does not exist. */
export async function updateProjectSalePrice(projectId: number, salePrice: number | null): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE projects SET sale_price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
    args: [projectId, salePrice],
  });
  if (result.rows.length === 0) return false;
  revalidatePath(`/projects/${projectId}`);
  return true;
}
