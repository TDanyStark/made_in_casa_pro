import { google } from "googleapis";
import { getAppSettings } from "@/lib/queries/settings";
import type {
  DriveSyncWarning,
  ProjectDrivePermissionsResponse,
} from "@/lib/definitions";

/**
 * Returns an OAuth2-authenticated Google Drive client using credentials
 * stored in the app_settings table (configured by the admin).
 */
async function getDriveClient() {
  const settings = await getAppSettings();

  if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
    throw new Error(
      "Google OAuth no configurado. Ve a Configuración y conecta la cuenta de Google Drive."
    );
  }

  if (!settings.google_oauth_refresh_token) {
    throw new Error(
      "Google Drive no está autorizado. Ve a Configuración y conecta la cuenta de Google Drive."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    settings.google_oauth_client_id,
    settings.google_oauth_client_secret
  );

  oauth2Client.setCredentials({
    refresh_token: settings.google_oauth_refresh_token,
  });

  try {
    await oauth2Client.getAccessToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("invalid_grant")) {
      throw new Error(
        "La autorización de Google Drive ha expirado o fue revocada. Reconecta Google Drive en Configuración."
      );
    }

    throw error;
  }

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Searches (read-only, never creates) for a folder by name inside a given
 * parent folder. Returns the first match's ID (or null) plus the total
 * number of matches, so callers can detect duplicates.
 */
export async function findFolderByName(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  name: string,
  parentId: string
): Promise<{ id: string | null; count: number }> {
  const safeName = name.replace(/\//g, "-").trim();

  const search = await drive.files.list({
    q: `name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const files = search.data.files ?? [];

  return { id: files[0]?.id ?? null, count: files.length };
}

/**
 * Finds or creates a folder by name inside a given parent folder.
 * Returns the folder ID.
 */
async function findOrCreateFolder(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  name: string,
  parentId: string
): Promise<string> {
  const found = await findFolderByName(drive, name, parentId);

  if (found.id) {
    return found.id;
  }

  const safeName = name.replace(/\//g, "-").trim();

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

/**
 * Shares a Drive folder with a list of email addresses as writer.
 * Errors per-email are logged but do not abort the whole operation.
 */
function normalizeEmails(emails: string[]): string[] {
  const normalized = new Map<string, string>();
  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) normalized.set(email, email);
  }
  return [...normalized.values()];
}

export async function shareFolderWithEmails(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  folderId: string,
  emails: string[]
): Promise<void> {
  const existing = await listDriveFolderPermissionsWithClient(drive, folderId);
  if (!existing.canShare) {
    throw new Error("La cuenta de Google conectada no puede administrar el acceso a esta carpeta.");
  }

  const byEmail = new Map(
    existing.permissions
      .filter((permission) => permission.emailAddress)
      .map((permission) => [permission.emailAddress!.toLowerCase(), permission])
  );

  const failures: string[] = [];
  for (const email of normalizeEmails(emails)) {
    try {
      const current = byEmail.get(email);
      if (current) {
        if (current.role === "reader" && current.canDelete) {
          await drive.permissions.update({
            fileId: folderId,
            permissionId: current.id,
            supportsAllDrives: true,
            requestBody: { role: "writer" },
            fields: "id,role",
          });
        } else if (current.role === "reader" && current.inherited) {
          await drive.permissions.create({
            fileId: folderId,
            supportsAllDrives: true,
            sendNotificationEmail: false,
            fields: "id",
            requestBody: {
              type: "user",
              role: "writer",
              emailAddress: email,
            },
          });
        }
      } else {
        await drive.permissions.create({
          fileId: folderId,
          supportsAllDrives: true,
          sendNotificationEmail: false,
          fields: "id",
          requestBody: {
            type: "user",
            role: "writer",
            emailAddress: email,
          },
        });
      }
    } catch (error) {
      failures.push(email);
      console.warn(`Could not share folder ${folderId} with ${email}:`, error);
    }
  }

  if (failures.length > 0) {
    throw new Error(`No se pudieron sincronizar ${failures.length} acceso(s) de Google Drive.`);
  }
}

async function listDriveFolderPermissionsWithClient(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  folderId: string
): Promise<ProjectDrivePermissionsResponse> {
  const [file, settings] = await Promise.all([
    drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: "id,capabilities(canShare)",
    }),
    getAppSettings(),
  ]);
  const canShare = file.data.capabilities?.canShare === true;
  const connectedEmail = settings.google_oauth_connected_email?.trim().toLowerCase() ?? null;
  const permissions: ProjectDrivePermissionsResponse["permissions"] = [];
  let pageToken: string | undefined;

  do {
    const page = await drive.permissions.list({
      fileId: folderId,
      supportsAllDrives: true,
      pageToken,
      pageSize: 100,
      fields: "nextPageToken,permissions(id,type,role,emailAddress,displayName,domain,deleted,pendingOwner,permissionDetails(inherited,inheritedFrom))",
    });
    for (const permission of page.data.permissions ?? []) {
      if (!permission.id || permission.deleted) continue;
      const inherited = permission.permissionDetails?.some((detail) => detail.inherited) === true;
      const emailAddress = permission.emailAddress ?? null;
      const isConnectedAccount = Boolean(
        connectedEmail && emailAddress?.toLowerCase() === connectedEmail
      );
      permissions.push({
        id: permission.id,
        type: permission.type ?? "unknown",
        role: permission.role ?? "unknown",
        emailAddress,
        displayName: permission.displayName ?? null,
        domain: permission.domain ?? null,
        inherited,
        isConnectedAccount,
        canDelete:
          canShare && permission.role !== "owner" && !inherited && !isConnectedAccount,
      });
    }
    pageToken = page.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { canShare, permissions };
}

export async function listDriveFolderPermissions(
  folderId: string
): Promise<ProjectDrivePermissionsResponse> {
  return listDriveFolderPermissionsWithClient(await getDriveClient(), folderId);
}

export async function addDriveFolderPermission(
  folderId: string,
  email: string,
  role: "reader" | "writer"
): Promise<void> {
  const drive = await getDriveClient();
  const normalized = normalizeEmails([email]);
  if (normalized.length === 0) throw new Error("El correo no es válido.");
  const current = await listDriveFolderPermissionsWithClient(drive, folderId);
  if (!current.canShare) {
    throw new Error("La cuenta de Google conectada no puede administrar el acceso a esta carpeta.");
  }
  const existing = current.permissions.find(
    (permission) => permission.emailAddress?.toLowerCase() === normalized[0]
  );
  const canAddDirectWriter = existing?.inherited && existing.role === "reader" && role === "writer";
  if (existing && !canAddDirectWriter) {
    throw new Error("Ese correo ya tiene acceso a la carpeta.");
  }
  await drive.permissions.create({
    fileId: folderId,
    supportsAllDrives: true,
    sendNotificationEmail: false,
    fields: "id",
    requestBody: { type: "user", role, emailAddress: normalized[0] },
  });
}

export async function deleteDriveFolderPermission(
  folderId: string,
  permissionId: string
): Promise<void> {
  const drive = await getDriveClient();
  const current = await listDriveFolderPermissionsWithClient(drive, folderId);
  const permission = current.permissions.find((item) => item.id === permissionId);
  if (!permission) throw new Error("El permiso ya no existe.");
  if (!permission.canDelete) {
    throw new Error("No se puede quitar un permiso propietario, heredado o de la cuenta conectada.");
  }
  await drive.permissions.delete({
    fileId: folderId,
    permissionId,
    supportsAllDrives: true,
  });
}

/**
 * Shares a folder with the given emails, converting any partial-sharing
 * failure into a safe `DriveSyncWarning` instead of throwing. Used by both
 * `syncDriveFolderAccess` (existing project flows) and `createProjectFolders`
 * (initial creation flow) so a few recipients failing to sync never masks
 * an otherwise-successful folder creation/lookup as a hard error.
 */
async function shareFolderSafely(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  folderId: string,
  emails: string[]
): Promise<DriveSyncWarning | null> {
  try {
    await shareFolderWithEmails(drive, folderId, emails);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido de Google Drive";
    console.warn("DRIVE_ACCESS_SYNC_FAILED", { folderId, message });
    return {
      code: "DRIVE_ACCESS_SYNC_FAILED",
      message: "No se pudieron sincronizar todos los accesos de Google Drive.",
    };
  }
}

export async function syncDriveFolderAccess(
  folderId: string,
  emails: string[]
): Promise<DriveSyncWarning | null> {
  return shareFolderSafely(await getDriveClient(), folderId, emails);
}

export interface DriveProjectFolders {
  projectFolderId: string;
  projectFolderUrl: string;
  /**
   * Present only when the folder chain was created/found successfully but
   * one or more recipients could not be synced. Real folder-creation
   * failures (auth, network, API errors before/while creating folders)
   * still reject the promise — this is only for the best-effort sharing
   * step that runs after the folder already exists.
   */
  driveWarning?: DriveSyncWarning;
}

/**
 * Creates the full folder hierarchy in Google Drive:
 * Made In Casa / {clientName} / {brandName} / {projectTitle}
 *
 * Uses findOrCreateFolder so it is idempotent.
 * Shares the project folder with shareEmails.
 */
export async function createProjectFolders({
  clientName,
  brandName,
  projectTitle,
  shareEmails = [],
}: {
  clientName: string;
  brandName: string;
  projectTitle: string;
  shareEmails?: string[];
}): Promise<DriveProjectFolders> {
  const drive = await getDriveClient();
  const emails = normalizeEmails(shareEmails);

  // 1. Root: "Made In Casa"
  const rootId = await findOrCreateFolder(drive, "Made In Casa", "root");

  // 2. Client folder
  const clientId = await findOrCreateFolder(drive, clientName, rootId);

  // 3. Brand folder
  const brandId = await findOrCreateFolder(drive, brandName, clientId);

  // 4. Project folder — share with all emails
  const projectId = await findOrCreateFolder(drive, projectTitle, brandId);
  const projectUrl = `https://drive.google.com/drive/folders/${projectId}`;

  let driveWarning: DriveSyncWarning | null = null;
  if (emails.length > 0) {
    // Best-effort: some recipients failing to sync must not undo/hide the
    // fact that the folder chain itself was created/found successfully.
    driveWarning = await shareFolderSafely(drive, projectId, emails);
  }

  return {
    projectFolderId: projectId,
    projectFolderUrl: projectUrl,
    ...(driveWarning ? { driveWarning } : {}),
  };
}

/**
 * Creates a subfolder in Google Drive inside a specified parent folder.
 */
export async function createSubFolder({
  parentFolderId,
  folderName,
  shareEmails = [],
}: {
  parentFolderId: string;
  folderName: string;
  shareEmails?: string[];
}): Promise<{ folderId: string; folderUrl: string }> {
  const drive = await getDriveClient();
  const emails = normalizeEmails(shareEmails);

  const folderId = await findOrCreateFolder(drive, folderName, parentFolderId);
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

  if (emails.length > 0) {
    await shareFolderWithEmails(drive, folderId, emails);
  }

  return { folderId, folderUrl };
}
