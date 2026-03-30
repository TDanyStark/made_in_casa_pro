import { db } from "../db";
import { UserRole } from "../definitions";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";
import { ITEMS_PER_PAGE } from "@/config/constants";

export type TrafficRowType = {
  project_id: number;
  project_title: string;
  project_product_id: number;
  product_name: string;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  task_count: number;
  task_completed: number;
  progress_percentage: number;
  current_task_title: string | null;
  current_task_responsible_name: string | null;
  commercial_name: string | null;
  brand_name: string | null;
  manager_name: string | null;
};

export async function getTrafficWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
  brandId,
  commercialId,
  userId,
  userRole,
}: {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: number;
  commercialId?: number;
  userId: number;
  userRole: UserRole;
}) {
  try {
    const conditions: Array<{ sql: string; value: unknown }> = [
      { sql: "unaccent(p.title) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
      { sql: "p.brand_id = $", value: brandId },
      { sql: "p.created_by = $", value: commercialId },
    ];

    // Role-based filtering
    if (userRole === UserRole.COMERCIAL) {
      // Sees projects they created OR are manager of OR are co-manager of
      conditions.push({
        sql: `(p.created_by = $ OR p.manager_id IN (SELECT id FROM managers WHERE email = (SELECT email FROM users WHERE id = $)) OR p.id IN (SELECT project_id FROM project_managers WHERE manager_id IN (SELECT id FROM managers WHERE email = (SELECT email FROM users WHERE id = $))))`,
        value: userId,
      });
    } else if (userRole === UserRole.COLABORADOR) {
      // Sees projects where they have at least one task assigned
      conditions.push({
        sql: `p.id IN (SELECT project_id FROM project_tasks WHERE assigned_user_id = $)`,
        value: userId,
      });
    }
    // Admin and Directivo see everything (no extra condition)

    const { whereSQL, args } = buildWhereClause(conditions);

    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count
        FROM projects p
        JOIN project_products pp ON p.id = pp.project_id
        JOIN products pr ON pp.product_id = pr.id
        LEFT JOIN brands b ON p.brand_id = b.id
        ${whereSQL}
      `,
      args,
    });
    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);

    const result = await db.execute({
      sql: `
        SELECT
          p.id AS project_id,
          p.title AS project_title,
          pp.id AS project_product_id,
          pr.name AS product_name,
          pp.drive_folder_id,
          pp.drive_folder_url,
          COUNT(pt.id) AS task_count,
          COUNT(pt.id) FILTER (WHERE pt.status = 'completed') AS task_completed,
          b.name AS brand_name,
          u_creator.name AS commercial_name,
          m.name AS manager_name,
          (
            SELECT pt2.title
            FROM project_tasks pt2
            WHERE pt2.project_product_id = pp.id
              AND pt2.status IN ('in_progress', 'not_started', 'blocked', 'waiting')
            ORDER BY pt2.order_index ASC, pt2.id ASC
            LIMIT 1
          ) AS current_task_title,
          (
            SELECT u2.name
            FROM project_tasks pt3
            LEFT JOIN users u2 ON pt3.assigned_user_id = u2.id
            WHERE pt3.project_product_id = pp.id
              AND pt3.status IN ('in_progress', 'not_started', 'blocked', 'waiting')
            ORDER BY pt3.order_index ASC, pt3.id ASC
            LIMIT 1
          ) AS current_task_responsible_name
        FROM projects p
        JOIN project_products pp ON p.id = pp.project_id
        JOIN products pr ON pp.product_id = pr.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN users u_creator ON p.created_by = u_creator.id
        LEFT JOIN managers m ON p.manager_id = m.id
        LEFT JOIN project_tasks pt ON pt.project_product_id = pp.id
        ${whereSQL}
        GROUP BY p.id, pp.id, pr.name, b.name, u_creator.name, m.name, p.updated_at, pp.drive_folder_id, pp.drive_folder_url
        ORDER BY p.updated_at DESC, pp.id ASC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...args, ...paginationArgs],
    });

    const data = result.rows.map((row: any) => {
      const taskCount = Number(row.task_count);
      const taskCompleted = Number(row.task_completed);
      return {
        ...row,
        task_count: taskCount,
        task_completed: taskCompleted,
        progress_percentage: taskCount === 0 ? 0 : Math.round((taskCompleted / taskCount) * 100),
      };
    });

    return {
      data: data as TrafficRowType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching traffic data:", error);
    return { data: [], total: 0 };
  }
}
