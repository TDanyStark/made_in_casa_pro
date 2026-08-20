import type {
  DriveSyncWarning,
  ProjectDriveExpectedRecipient,
  ProjectDrivePermission,
} from "@/lib/definitions";
import {
  clearProjectDriveAccessFailure,
  getProjectById,
  getProjectExpectedDriveRecipients,
  upsertProjectDriveAccessFailure,
  type ProjectDriveAccessFailure,
  type ProjectDriveRecipient,
} from "@/lib/queries/projects";
import { syncDriveFolderAccessDetailed } from "@/lib/services/googleDrive";

const ROLE_RANK: Record<string, number> = {
  reader: 1,
  commenter: 1,
  writer: 2,
  fileOrganizer: 2,
  organizer: 2,
  owner: 3,
};

export function buildExpectedDriveRecipientStatuses(
  recipients: ProjectDriveRecipient[],
  permissions: ProjectDrivePermission[],
  failures: ProjectDriveAccessFailure[]
): ProjectDriveExpectedRecipient[] {
  const failuresByEmail = new Map(
    failures.map((failure) => [failure.email.trim().toLowerCase(), failure])
  );
  const hasUnverifiableGroupAccess = permissions.some(
    (permission) => permission.type === "group"
  );

  return recipients.map((recipient) => {
    const email = recipient.email.trim().toLowerCase();
    const domain = email.slice(email.lastIndexOf("@") + 1);
    const candidates: Array<{
      permission: ProjectDrivePermission;
      via: "direct" | "domain" | "anyone";
    }> = [];
    for (const permission of permissions) {
      if (
        permission.type === "user" &&
        permission.emailAddress?.trim().toLowerCase() === email
      ) {
        candidates.push({ permission, via: "direct" });
      } else if (
        permission.type === "domain" &&
        permission.domain?.trim().toLowerCase() === domain
      ) {
        candidates.push({ permission, via: "domain" });
      } else if (permission.type === "anyone") {
        candidates.push({ permission, via: "anyone" });
      }
    }
    candidates.sort(
      (a, b) => (ROLE_RANK[b.permission.role] ?? 0) - (ROLE_RANK[a.permission.role] ?? 0)
    );
    const best = candidates[0];
    const hasWriter = (ROLE_RANK[best?.permission.role ?? ""] ?? 0) >= ROLE_RANK.writer;
    const failure = failuresByEmail.get(email);

    return {
      ...recipient,
      email,
      expectedRole: "writer",
      status: hasWriter ? "has_access" : best ? "insufficient_role" : "missing",
      actualRole: best?.permission.role ?? null,
      accessVia: best?.via ?? null,
      failureCode: hasWriter || best ? null : failure?.failureCode ?? null,
      lastAttemptAt: hasWriter || best ? null : failure?.lastAttemptAt ?? null,
      hasUnverifiableGroupAccess,
    };
  });
}

export async function syncProjectDriveAccess(projectId: number): Promise<DriveSyncWarning | null> {
  try {
    const project = await getProjectById(projectId);
    if (!project?.drive_folder_id) return null;
    const recipients = await getProjectExpectedDriveRecipients(projectId);
    const result = await syncDriveFolderAccessDetailed(
      project.drive_folder_id,
      recipients.map((recipient) => recipient.email)
    );
    for (const attempt of result.attempts) {
      if (attempt.failureCode) {
        await upsertProjectDriveAccessFailure(projectId, attempt.email, attempt.failureCode);
      } else {
        await clearProjectDriveAccessFailure(projectId, attempt.email);
      }
    }
    return result.warning;
  } catch {
    console.warn("DRIVE_ACCESS_SYNC_FAILED", { projectId });
    return {
      code: "DRIVE_ACCESS_SYNC_FAILED",
      message: "No se pudieron sincronizar todos los accesos de Google Drive.",
    };
  }
}
