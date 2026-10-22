import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  computeProjectFinancials,
  type ProjectFinancialRow,
  type ProjectFinancials,
} from "../project-financials";

/** Sale price plus hours and money invested; null when the project does not exist. */
export async function getProjectFinancials(projectId: number): Promise<ProjectFinancials | null> {
  const project = await db.execute({
    sql: `SELECT sale_price FROM projects WHERE id = $1`,
    args: [projectId],
  });
  if (project.rows.length === 0) return null;

  const tasks = await db.execute({
    sql: `
      SELECT
        pt.assigned_user_id,
        u.name           AS assigned_user_name,
        u.is_internal    AS assignee_is_internal,
        u.hourly_rate    AS assignee_hourly_rate,
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
      WHERE pt.project_id = $1
    `,
    args: [projectId],
  });

  return computeProjectFinancials(
    tasks.rows as unknown as ProjectFinancialRow[],
    (project.rows[0] as { sale_price: number | string | null }).sale_price
  );
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
