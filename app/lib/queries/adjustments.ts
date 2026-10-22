import { db } from "../db";
import {
  ProjectAdjustmentType,
  TaskVersionError,
  TASK_VERSION_FOREIGN_MESSAGE,
  TASK_VERSION_MISSING_MESSAGE,
} from "../definitions";
import { revalidatePath } from "next/cache";
import type { DbTransaction } from "../db/types";

type DbExecutor = Pick<DbTransaction, "execute">;

/**
 * Resolves the version (project_adjustments.id) a new project task must belong to.
 * - Explicit id: must belong to the project, otherwise throws TaskVersionError.
 * - No id: the project's base version (lowest version_number, i.e. v1).
 * - Project without versions: throws TaskVersionError.
 * Every INSERT INTO project_tasks must go through this helper.
 */
export async function resolveTaskAdjustmentId(
  projectId: number,
  adjustmentId?: number | null,
  executor: DbExecutor = db,
  /** Version used when no adjustment id is given: the base version (V1) or the latest one. */
  fallback: "base" | "latest" = "base"
): Promise<number> {
  if (adjustmentId !== undefined && adjustmentId !== null) {
    const owned = await executor.execute({
      sql: `SELECT id FROM project_adjustments WHERE id = $1 AND project_id = $2`,
      args: [adjustmentId, projectId],
    });
    if (owned.rows.length === 0) throw new TaskVersionError(TASK_VERSION_FOREIGN_MESSAGE);
    return Number((owned.rows[0] as unknown as { id: number }).id);
  }

  const base = await executor.execute({
    sql:
      fallback === "latest"
        ? `SELECT id FROM project_adjustments WHERE project_id = $1 ORDER BY version_number DESC, id DESC LIMIT 1`
        : `SELECT id FROM project_adjustments WHERE project_id = $1 ORDER BY version_number ASC, id ASC LIMIT 1`,
    args: [projectId],
  });
  if (base.rows.length === 0) throw new TaskVersionError(TASK_VERSION_MISSING_MESSAGE);
  return Number((base.rows[0] as unknown as { id: number }).id);
}

export async function assertLatestTaskVersion(projectId: number, adjustmentId: number): Promise<void> {
  const latest = await resolveTaskAdjustmentId(projectId, undefined, db, "latest");
  if (adjustmentId !== latest) {
    throw new TaskVersionError("Solo se pueden agregar tareas a la última versión del proyecto.");
  }
}

export async function getAdjustmentsByProject(projectId: number): Promise<ProjectAdjustmentType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          pa.id, pa.project_id, pa.version_number, pa.drive_folder_id, 
          pa.drive_folder_url, pa.status, pa.notes, pa.created_at, pa.completed_at,
          COUNT(pt.id) as task_count,
          COUNT(pt.id) FILTER (WHERE pt.status = 'completed') as completed_task_count
        FROM project_adjustments pa
        LEFT JOIN project_tasks pt ON pt.adjustment_id = pa.id
        WHERE pa.project_id = $1
        GROUP BY pa.id
        ORDER BY pa.version_number ASC
      `,
      args: [projectId],
    });
    return result.rows as unknown as ProjectAdjustmentType[];
  } catch (error) {
    console.error("Error fetching project adjustments:", error);
    return [];
  }
}

export async function createProjectAdjustment(data: {
  project_id: number;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  notes?: string | null;
}): Promise<ProjectAdjustmentType> {
  const transaction = await db.transaction("write");
  try {
    // Determine the next version number
    const maxVersionResult = await transaction.execute({
      sql: `SELECT MAX(version_number) as max_v FROM project_adjustments WHERE project_id = $1`,
      args: [data.project_id],
    });
    const maxV = (maxVersionResult.rows[0] as unknown as { max_v: number | null }).max_v;
    const nextVersion = maxV ? Number(maxV) + 1 : 1; 

    // Insert new adjustment
    const insertResult = await transaction.execute({
      sql: `
        INSERT INTO project_adjustments (project_id, version_number, drive_folder_id, drive_folder_url, status, notes)
        VALUES ($1, $2, $3, $4, 'active', $5)
        RETURNING *
      `,
      args: [
        data.project_id,
        nextVersion,
        data.drive_folder_id ?? null,
        data.drive_folder_url ?? null,
        data.notes ?? null,
      ],
    });

    // Update project status to 'in_adjustments'
    await transaction.execute({
      sql: `UPDATE projects SET status = 'in_adjustments', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [data.project_id],
    });

    await transaction.commit();
    revalidatePath(`/projects/${data.project_id}`);
    
    return insertResult.rows[0] as unknown as ProjectAdjustmentType;
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating project adjustment:", error);
    throw error;
  }
}

export async function markAdjustmentAsCompleted(adjustmentId: number, projectId: number): Promise<void> {
  const transaction = await db.transaction("write");
  try {
    await transaction.execute({
      sql: `UPDATE project_adjustments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [adjustmentId],
    });

    await transaction.commit();
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error completing project adjustment:", error);
    throw error;
  }
}

export async function deleteProjectAdjustment(adjustmentId: number, projectId: number): Promise<void> {
  const transaction = await db.transaction("write");
  try {
    const adjCheck = await transaction.execute({
      sql: `SELECT status FROM project_adjustments WHERE id = $1`,
      args: [adjustmentId],
    });
    const adjustment = adjCheck.rows[0] as unknown as { status: string } | undefined;
    if (!adjustment) {
      throw new Error("Ajuste no encontrado");
    }
    if (adjustment.status === "completed") {
      throw new Error("No se puede eliminar una versión completada.");
    }

    const taskCheck = await transaction.execute({
      sql: `SELECT COUNT(*) as count FROM project_tasks WHERE adjustment_id = $1`,
      args: [adjustmentId],
    });
    const taskCount = Number((taskCheck.rows[0] as unknown as { count: number }).count);
    if (taskCount > 0) {
      throw new Error("No se puede eliminar un ajuste que tiene tareas. Elimina las tareas primero.");
    }

    await transaction.execute({
      sql: `DELETE FROM project_adjustments WHERE id = $1`,
      args: [adjustmentId],
    });

    await transaction.commit();
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting project adjustment:", error);
    throw error;
  }
}
