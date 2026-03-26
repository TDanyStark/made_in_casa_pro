import { google } from "googleapis";

/**
 * Returns an authenticated Google Drive API client using the
 * GOOGLE_SERVICE_ACCOUNT_JSON environment variable.
 */
function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Finds or creates a folder by name inside a given parent folder.
 * Returns the folder ID.
 */
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  // Sanitize name for Drive (avoid slash issues)
  const safeName = name.replace(/\//g, "-").trim();

  // Search for existing folder
  const search = await drive.files.list({
    q: `name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  // Create it
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
 */
export async function createProjectFolders({
  clientName,
  brandName,
  projectTitle,
  productNames,
}: {
  clientName: string;
  brandName: string;
  projectTitle: string;
  productNames: string[];
}): Promise<DriveProjectFolders> {
  const drive = getDriveClient();

  // 1. Root: "Made In Casa"
  const rootId = await findOrCreateFolder(drive, "Made In Casa", "root");

  // 2. Client folder
  const clientId = await findOrCreateFolder(drive, clientName, rootId);

  // 3. Brand folder
  const brandId = await findOrCreateFolder(drive, brandName, clientId);

  // 4. Project folder
  const projectId = await findOrCreateFolder(drive, projectTitle, brandId);
  const projectUrl = `https://drive.google.com/drive/folders/${projectId}`;

  // 5. Product sub-folders
  const productFolders: DriveProjectFolders["productFolders"] = [];
  for (const productName of productNames) {
    const prodFolderId = await findOrCreateFolder(drive, productName, projectId);
    productFolders.push({
      productName,
      folderId: prodFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${prodFolderId}`,
    });
  }

  return {
    projectFolderId: projectId,
    projectFolderUrl: projectUrl,
    productFolders,
  };
}

/**
 * Creates a single product sub-folder inside an existing project folder.
 */
export async function createProductFolder(
  projectFolderId: string,
  productName: string
): Promise<{ folderId: string; folderUrl: string }> {
  const drive = getDriveClient();
  const folderId = await findOrCreateFolder(drive, productName, projectFolderId);
  return {
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
  };
}
