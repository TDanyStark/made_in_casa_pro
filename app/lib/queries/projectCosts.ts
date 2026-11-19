import { db } from "../db";
import { revalidatePath } from "next/cache";
import {
  ProjectCostError,
  PROJECT_COST_CATEGORY_MISSING_MESSAGE,
  PROJECT_COST_TASK_FOREIGN_MESSAGE,
  PROJECT_COST_VERSION_FOREIGN_MESSAGE,
  type ProjectCostCategoryType,
  type ProjectCostType,
  type ProjectCostsTotalType,
} from "../definitions";
import type { ProjectVersion } from "./projectFinancials";

// Spec: odd/tasks/project-costs.md — S2, S3, S5, S6.

type Row = Record<string, unknown>;

const toId = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toMoney = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

function toCategory(row: Row): ProjectCostCategoryType {
  return {
    id: Number(row.id),
    name: String(row.name),
    created_by: toId(row.created_by),
    created_at: row.created_at as string,
  };
}

function toCost(row: Row): ProjectCostType {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    adjustment_id: Number(row.adjustment_id),
    version_number: Number(row.version_number),
    category_id: Number(row.category_id),
    category_name: String(row.category_name),
    description: (row.description as string | null) ?? null,
    amount: toMoney(row.amount),
    incurred_at: row.incurred_at as string,
    task_id: toId(row.task_id),
    task_title: (row.task_title as string | null) ?? null,
    created_by: toId(row.created_by),
    created_by_name: (row.created_by_name as string | null) ?? null,
    updated_by: toId(row.updated_by),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

const COST_SELECT = `
  SELECT
    pc.id, pc.project_id, pc.adjustment_id, pa.version_number,
    pc.category_id, c.name AS category_name, pc.description, pc.amount,
    to_char(pc.incurred_at, 'YYYY-MM-DD') AS incurred_at,
    pc.task_id, pt.title AS task_title,
    pc.created_by, u.name AS created_by_name, pc.updated_by,
    pc.created_at, pc.updated_at
  FROM project_costs pc
  JOIN project_adjustments pa ON pa.id = pc.adjustment_id
  JOIN project_cost_categories c ON c.id = pc.category_id
  LEFT JOIN project_tasks pt ON pt.id = pc.task_id
  LEFT JOIN users u ON u.id = pc.created_by
`;

/** WHERE clause and args for the project and the optional version filter. */
function scope(projectId: number, adjustmentId?: number | null) {
  return adjustmentId === undefined || adjustmentId === null
    ? { where: "pc.project_id = $1", args: [projectId] }
    : { where: "pc.project_id = $1 AND pc.adjustment_id = $2", args: [projectId, adjustmentId] };
}

// ─── Categories (S6) ─────────────────────────────────────────────────────────

export async function listCostCategories(): Promise<ProjectCostCategoryType[]> {
  const result = await db.execute({
    sql: `SELECT id, name, created_by, created_at FROM project_cost_categories ORDER BY lower(name) ASC, id ASC`,
    args: [],
  });
  return (result.rows as Row[]).map(toCategory);
}

/** Creates a category; on a case-insensitive duplicate returns the existing one with created false. */
export async function createCostCategory(
  name: string,
  userId: number | null
): Promise<{ category: ProjectCostCategoryType; created: boolean }> {
  const trimmed = name.trim();
  const inserted = await db.execute({
    sql: `
      INSERT INTO project_cost_categories (name, created_by)
      VALUES ($1, $2)
      ON CONFLICT ((lower(name))) DO NOTHING
      RETURNING id, name, created_by, created_at
    `,
    args: [trimmed, userId],
  });
  if (inserted.rows.length > 0) return { category: toCategory(inserted.rows[0] as Row), created: true };

  const existing = await db.execute({
    sql: `SELECT id, name, created_by, created_at FROM project_cost_categories WHERE lower(name) = lower($1)`,
    args: [trimmed],
  });
  return { category: toCategory(existing.rows[0] as Row), created: false };
}

// ─── Costs ───────────────────────────────────────────────────────────────────

/** Versions of the project ordered by number; empty when the project does not exist. */
export async function getProjectCostVersions(projectId: number): Promise<ProjectVersion[]> {
  const result = await db.execute({
    sql: `SELECT id, version_number FROM project_adjustments WHERE project_id = $1 ORDER BY version_number ASC, id ASC`,
    args: [projectId],
  });
  return (result.rows as Row[]).map((v) => ({ id: Number(v.id), version_number: Number(v.version_number) }));
}

export async function listProjectCosts(projectId: number, adjustmentId?: number | null): Promise<ProjectCostType[]> {
  const { where, args } = scope(projectId, adjustmentId);
  const result = await db.execute({
    sql: `${COST_SELECT} WHERE ${where} ORDER BY pc.incurred_at DESC, pc.id DESC`,
    args,
  });
  return (result.rows as Row[]).map(toCost);
}

/** Sum of the associated costs plus a per-category breakdown (S4 consumes it). */
export async function getProjectCostsTotal(
  projectId: number,
  adjustmentId?: number | null
): Promise<ProjectCostsTotalType> {
  const { where, args } = scope(projectId, adjustmentId);
  const result = await db.execute({
    sql: `
      SELECT pc.category_id, c.name AS category_name, SUM(pc.amount) AS total
      FROM project_costs pc
      JOIN project_cost_categories c ON c.id = pc.category_id
      WHERE ${where}
      GROUP BY pc.category_id, c.name
      ORDER BY total DESC, c.name ASC
    `,
    args,
  });
  const byCategory = (result.rows as Row[]).map((r) => ({
    category_id: Number(r.category_id),
    category_name: String(r.category_name),
    total: toMoney(r.total),
  }));
  return { total: toMoney(byCategory.reduce((sum, c) => sum + c.total, 0)), by_category: byCategory };
}

/** A cost of the project, or null when it does not exist or belongs to another project. */
export async function getProjectCost(projectId: number, costId: number): Promise<ProjectCostType | null> {
  const result = await db.execute({
    sql: `${COST_SELECT} WHERE pc.project_id = $1 AND pc.id = $2`,
    args: [projectId, costId],
  });
  return result.rows.length > 0 ? toCost(result.rows[0] as Row) : null;
}

/** Version of the project, existing category and (S3) task of that same version. */
async function assertCostLinks(projectId: number, adjustmentId: number, categoryId: number, taskId: number | null) {
  const version = await db.execute({
    sql: `SELECT id FROM project_adjustments WHERE id = $1 AND project_id = $2`,
    args: [adjustmentId, projectId],
  });
  if (version.rows.length === 0) throw new ProjectCostError(PROJECT_COST_VERSION_FOREIGN_MESSAGE);

  const category = await db.execute({
    sql: `SELECT id FROM project_cost_categories WHERE id = $1`,
    args: [categoryId],
  });
  if (category.rows.length === 0) throw new ProjectCostError(PROJECT_COST_CATEGORY_MISSING_MESSAGE);

  if (taskId !== null) {
    const task = await db.execute({
      sql: `SELECT id FROM project_tasks WHERE id = $1 AND project_id = $2 AND adjustment_id = $3`,
      args: [taskId, projectId, adjustmentId],
    });
    if (task.rows.length === 0) throw new ProjectCostError(PROJECT_COST_TASK_FOREIGN_MESSAGE);
  }
}

export type ProjectCostInput = {
  adjustment_id: number;
  category_id: number;
  amount: number;
  description?: string | null;
  /** YYYY-MM-DD; null or absent = today. */
  incurred_at?: string | null;
  task_id?: number | null;
};

export async function createProjectCost(
  projectId: number,
  input: ProjectCostInput,
  userId: number | null
): Promise<ProjectCostType> {
  const taskId = input.task_id ?? null;
  await assertCostLinks(projectId, input.adjustment_id, input.category_id, taskId);

  const inserted = await db.execute({
    sql: `
      INSERT INTO project_costs
        (project_id, adjustment_id, category_id, description, amount, incurred_at, task_id, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $8)
      RETURNING id
    `,
    args: [
      projectId,
      input.adjustment_id,
      input.category_id,
      input.description ?? null,
      input.amount,
      input.incurred_at ?? null,
      taskId,
      userId,
    ],
  });
  revalidatePath(`/projects/${projectId}`);
  const created = await getProjectCost(projectId, Number((inserted.rows[0] as Row).id));
  return created!;
}

/** Updates only the given fields; null when the cost is not of this project. */
export async function updateProjectCost(
  projectId: number,
  costId: number,
  patch: Partial<ProjectCostInput>,
  userId: number | null
): Promise<ProjectCostType | null> {
  const current = await getProjectCost(projectId, costId);
  if (!current) return null;

  const next = {
    adjustment_id: patch.adjustment_id ?? current.adjustment_id,
    category_id: patch.category_id ?? current.category_id,
    description: patch.description !== undefined ? patch.description : current.description,
    amount: patch.amount ?? current.amount,
    incurred_at: patch.incurred_at ?? current.incurred_at,
    task_id: patch.task_id !== undefined ? patch.task_id : current.task_id,
  };
  await assertCostLinks(projectId, next.adjustment_id, next.category_id, next.task_id);

  const updated = await db.execute({
    sql: `
      UPDATE project_costs
      SET adjustment_id = $1, category_id = $2, description = $3, amount = $4,
          incurred_at = $5::date, task_id = $6, updated_by = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND project_id = $9
      RETURNING id
    `,
    args: [
      next.adjustment_id,
      next.category_id,
      next.description,
      next.amount,
      next.incurred_at,
      next.task_id,
      userId,
      costId,
      projectId,
    ],
  });
  if (updated.rows.length === 0) return null;
  revalidatePath(`/projects/${projectId}`);
  return getProjectCost(projectId, costId);
}

/** Deletes a cost of the project; false when it is not of this project. */
export async function deleteProjectCost(projectId: number, costId: number): Promise<boolean> {
  const result = await db.execute({
    sql: `DELETE FROM project_costs WHERE id = $1 AND project_id = $2 RETURNING id`,
    args: [costId, projectId],
  });
  if (result.rows.length === 0) return false;
  revalidatePath(`/projects/${projectId}`);
  return true;
}
