import type { DriveSyncWarning } from "@/lib/definitions";
import { getProjectById, getProjectStakeholderEmails } from "@/lib/queries/projects";
import { syncDriveFolderAccess } from "@/lib/services/googleDrive";

export async function syncProjectDriveAccess(projectId: number): Promise<DriveSyncWarning | null> {
  try {
    const project = await getProjectById(projectId);
    if (!project?.drive_folder_id) return null;
    const emails = await getProjectStakeholderEmails(projectId);
    return syncDriveFolderAccess(project.drive_folder_id, emails);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al resolver accesos";
    console.warn("DRIVE_ACCESS_SYNC_FAILED", { projectId, message });
    return {
      code: "DRIVE_ACCESS_SYNC_FAILED",
      message: "No se pudieron sincronizar todos los accesos de Google Drive.",
    };
  }
}
