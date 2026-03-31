import { db } from "../db";
import { ProjectAdjustmentType } from "../definitions";
import { revalidatePath } from "next/cache";

export async function getAdjustmentsByProject(projectId: number): Promise<ProjectAdjustmentType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, project_id, version_number, drive_folder_id, drive_folder_url, status, created_at, completed_at
        FROM project_adjustments
        WHERE project_id = $1
        ORDER BY version_number ASC
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
}): Promise<ProjectAdjustmentType> {
  const transaction = await db.transaction("write");
  try {
    // Determine the next version number
    const maxVersionResult = await transaction.execute({
      sql: `SELECT MAX(version_number) as max_v FROM project_adjustments WHERE project_id = $1`,
      args: [data.project_id],
    });
    const maxV = (maxVersionResult.rows[0] as unknown as { max_v: number | null }).max_v;
    const nextVersion = maxV ? Number(maxV) + 1 : 2; // Always starts at 2 since 1 is the original project

    // Insert new adjustment
    const insertResult = await transaction.execute({
      sql: `
        INSERT INTO project_adjustments (project_id, version_number, drive_folder_id, drive_folder_url, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
      `,
      args: [
        data.project_id,
        nextVersion,
        data.drive_folder_id ?? null,
        data.drive_folder_url ?? null,
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
