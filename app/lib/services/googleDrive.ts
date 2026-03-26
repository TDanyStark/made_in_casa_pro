import { google } from "googleapis";
import { getAppSettings } from "@/lib/queries/settings";

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

  return google.drive({ version: "v3", auth: oauth2Client });
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
  const safeName = name.replace(/\//g, "-").trim();

  const search = await drive.files.list({
    q: `name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

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
async function shareFolderWithEmails(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  folderId: string,
  emails: string[]
): Promise<void> {
  for (const email of emails) {
    try {
      await drive.permissions.create({
        fileId: folderId,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: email,
        },
      });
    } catch (err) {
      console.warn(`Could not share folder ${folderId} with ${email}:`, err);
    }
  }
}

export interface DriveProjectFolders {
  projectFolderId: string;
  projectFolderUrl: string;
  productFolders: Array<{
    productName: string;
    folderId: string;
    folderUrl: string;
  }>;
}

/**
 * Creates the full folder hierarchy in Google Drive:
 * Made In Casa / {clientName} / {brandName} / {projectTitle} / {productName}
 *
 * Uses findOrCreateFolder so it is idempotent.
 * Shares the project folder and each product sub-folder with shareEmails.
 */
export async function createProjectFolders({
  clientName,
  brandName,
  projectTitle,
  productNames,
  shareEmails = [],
}: {
  clientName: string;
  brandName: string;
  projectTitle: string;
  productNames: string[];
  shareEmails?: string[];
}): Promise<DriveProjectFolders> {
  const drive = await getDriveClient();
  const emails = [...new Set(shareEmails.filter(Boolean))];

  // 1. Root: "Made In Casa"
  const rootId = await findOrCreateFolder(drive, "Made In Casa", "root");

  // 2. Client folder
  const clientId = await findOrCreateFolder(drive, clientName, rootId);

  // 3. Brand folder
  const brandId = await findOrCreateFolder(drive, brandName, clientId);

  // 4. Project folder — share with all emails
  const projectId = await findOrCreateFolder(drive, projectTitle, brandId);
  const projectUrl = `https://drive.google.com/drive/folders/${projectId}`;
  if (emails.length > 0) {
    await shareFolderWithEmails(drive, projectId, emails);
  }

  // 5. Product sub-folders — share each one too
  const productFolders: DriveProjectFolders["productFolders"] = [];
  for (const productName of productNames) {
    const prodFolderId = await findOrCreateFolder(drive, productName, projectId);
    if (emails.length > 0) {
      await shareFolderWithEmails(drive, prodFolderId, emails);
    }
    productFolders.push({
      productName,
      folderId: prodFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${prodFolderId}`,
    });
  }

  return { projectFolderId: projectId, projectFolderUrl: projectUrl, productFolders };
}

/**
 * Creates a single product sub-folder inside an existing project folder.
 */
export async function createProductFolder(
  projectFolderId: string,
  productName: string
): Promise<{ folderId: string; folderUrl: string }> {
  const drive = await getDriveClient();
  const folderId = await findOrCreateFolder(drive, productName, projectFolderId);
  return {
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
  };
}
