import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  ProjectType,
  ProjectDetailType,
  ProjectProductType,
  ProjectTaskType,
  ProjectStatus,
} from "../definitions";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";
import { ITEMS_PER_PAGE } from "@/config/constants";

// ─── Shared SELECT fragments ─────────────────────────────────────────────────

const PROJECT_SELECT = `
  p.id,
  p.title,
  p.brand_id,
  b.name           AS brand_name,
  p.manager_id,
  m.name           AS manager_name,
  cl.id            AS client_id,
  cl.name          AS client_name,
  p.campaign_id,
  cam.name         AS campaign_name,
  p.drive_folder_id,
  p.drive_folder_url,
  p.notes,
  p.status,
  p.progress,
  p.created_by,
  u.name           AS created_by_name,
  p.created_at,
  p.updated_at
`;

const PROJECT_JOINS = `
  FROM projects p
  LEFT JOIN brands    b   ON p.brand_id    = b.id
  LEFT JOIN managers  m   ON p.manager_id  = m.id
  LEFT JOIN clients   cl  ON m.client_id   = cl.id
  LEFT JOIN campaigns cam ON p.campaign_id = cam.id
  LEFT JOIN users     u   ON p.created_by  = u.id
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

export async function getProjectDetail(id: number): Promise<ProjectDetailType | null> {
  try {
    const project = await getProjectById(id);
    if (!project) return null;

    // Co-managers
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

    // Products with task counts
    const productsResult = await db.execute({
      sql: `
        SELECT
          pp.id,
          pp.project_id,
          pp.product_id,
          pr.name          AS product_name,
          pr.category_id   AS product_category_id,
          pc.name          AS product_category_name,
          pp.status,
          pp.created_at,
          COUNT(pt.id)                                          AS task_total,
          COUNT(pt.id) FILTER (WHERE pt.status = 'completed')  AS task_completed
        FROM project_products pp
        JOIN products          pr ON pp.product_id    = pr.id
        LEFT JOIN product_categories pc ON pr.category_id = pc.id
        LEFT JOIN project_tasks pt ON pt.project_product_id = pp.id
        WHERE pp.project_id = $1
        GROUP BY pp.id, pr.name, pr.category_id, pc.name
        ORDER BY pp.created_at ASC
      `,
      args: [id],
    });

    return {
      ...project,
      co_managers: coMgrResult.rows as unknown as ProjectDetailType["co_managers"],
      products: productsResult.rows as unknown as ProjectProductType[],
    };
  } catch (error) {
    console.error("Error fetching project detail:", error);
    return null;
  }
}

export async function getProjectsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
  status,
  brandId,
  managerId,
  campaignId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  brandId?: number;
  managerId?: number;
  campaignId?: number;
}) {
  try {
    const { whereSQL, args } = buildWhereClause([
      { sql: "unaccent(p.title) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
      { sql: "p.status = $", value: status },
      { sql: "p.brand_id = $", value: brandId },
      { sql: "p.manager_id = $", value: managerId },
      { sql: "p.campaign_id = $", value: campaignId },
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
          (SELECT COUNT(*) FROM project_products pp WHERE pp.project_id = p.id) AS product_count,
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

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createProject(data: {
  title: string;
  brand_id: number;
  manager_id: number;
  campaign_id?: number | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  notes?: string | null;
  status?: ProjectStatus;
  created_by?: number | null;
}): Promise<ProjectType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO projects
          (title, brand_id, manager_id, campaign_id, drive_folder_id, drive_folder_url, notes, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      args: [
        data.title,
        data.brand_id,
        data.manager_id,
        data.campaign_id ?? null,
        data.drive_folder_id ?? null,
        data.drive_folder_url ?? null,
        data.notes ?? null,
        data.status ?? "active",
        data.created_by ?? null,
      ],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath("/projects");
    const created = await getProjectById(id);
    return created!;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateProject(
  id: number,
  data: Partial<{
    title: string;
    campaign_id: number | null;
    drive_folder_id: string | null;
    drive_folder_url: string | null;
    notes: string | null;
    status: ProjectStatus;
    progress: number;
  }>
): Promise<ProjectType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    const fields: Array<[string, unknown]> = [
      ["title", data.title],
      ["campaign_id", data.campaign_id],
      ["drive_folder_id", data.drive_folder_id],
      ["drive_folder_url", data.drive_folder_url],
      ["notes", data.notes],
      ["status", data.status],
      ["progress", data.progress],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        args.push(val);
        updates.push(`${col} = $${args.length}`);
      }
    }

    if (updates.length === 0) return getProjectById(id);

    // always bump updated_at
    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    await db.execute({
      sql: `UPDATE projects SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

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

export async function recalculateProjectProgress(projectId: number): Promise<number> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          COUNT(*)                                         AS total,
          COUNT(*) FILTER (WHERE status = 'completed')    AS completed
        FROM project_tasks
        WHERE project_id = $1
      `,
      args: [projectId],
    });
    const row = result.rows[0] as unknown as { total: string; completed: string };
    const total = Number(row.total);
    const completed = Number(row.completed);
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    await db.execute({
      sql: `UPDATE projects SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      args: [progress, projectId],
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return progress;
  } catch (error) {
    console.error("Error recalculating project progress:", error);
    throw error;
  }
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

// ─── Project products ─────────────────────────────────────────────────────────

export async function getProjectProducts(projectId: number): Promise<ProjectProductType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          pp.id,
          pp.project_id,
          pp.product_id,
          pr.name          AS product_name,
          pr.category_id   AS product_category_id,
          pc.name          AS product_category_name,
          pp.status,
          pp.created_at,
          COUNT(pt.id)                                         AS task_total,
          COUNT(pt.id) FILTER (WHERE pt.status = 'completed') AS task_completed
        FROM project_products pp
        JOIN products          pr ON pp.product_id    = pr.id
        LEFT JOIN product_categories pc ON pr.category_id = pc.id
        LEFT JOIN project_tasks pt ON pt.project_product_id = pp.id
        WHERE pp.project_id = $1
        GROUP BY pp.id, pr.name, pr.category_id, pc.name
        ORDER BY pp.created_at ASC
      `,
      args: [projectId],
    });
    return result.rows as unknown as ProjectProductType[];
  } catch (error) {
    console.error("Error fetching project products:", error);
    return [];
  }
}

export async function addProductToProject(
  projectId: number,
  productId: number
): Promise<number> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO project_products (project_id, product_id)
        VALUES ($1, $2)
        ON CONFLICT (project_id, product_id) DO NOTHING
        RETURNING id
      `,
      args: [projectId, productId],
    });
    if (result.rows.length === 0) {
      // Already existed — fetch the existing id
      const existing = await db.execute({
        sql: `SELECT id FROM project_products WHERE project_id = $1 AND product_id = $2`,
        args: [projectId, productId],
      });
      return Number(existing.rows[0]?.id);
    }
    revalidatePath(`/projects/${projectId}`);
    return Number(result.rows[0]?.id);
  } catch (error) {
    console.error("Error adding product to project:", error);
    throw error;
  }
}

export async function removeProductFromProject(
  projectId: number,
  projectProductId: number
): Promise<void> {
  try {
    await db.execute({
      sql: `DELETE FROM project_products WHERE id = $1 AND project_id = $2`,
      args: [projectProductId, projectId],
    });
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error removing product from project:", error);
    throw error;
  }
}
