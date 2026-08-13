const DRIVE_HOSTNAME_SUFFIX = 'drive.google.com';
const FOLDER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isDriveHostname(hostname: string): boolean {
  return hostname.endsWith(DRIVE_HOSTNAME_SUFFIX);
}

/**
 * Extracts a Google Drive folder id from a Drive folder URL.
 *
 * Supported shapes:
 *  - https://drive.google.com/drive/folders/{id}
 *  - https://drive.google.com/drive/u/{n}/folders/{id}  (any digit for {n})
 *  - https://drive.google.com/folders/{id}
 *  - https://drive.google.com/open?id={id}
 *  - any of the above with a trailing slash and/or a query string (e.g. ?usp=sharing)
 *
 * Pure function, no I/O, no side effects. Returns `null` for empty input,
 * malformed URLs, non-drive.google.com hosts, or URLs without a recognizable
 * folder id.
 */
export function parseDriveFolderId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!isDriveHostname(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  const foldersIndex = segments.lastIndexOf('folders');

  if (foldersIndex !== -1 && segments.length > foldersIndex + 1) {
    const candidate = segments[foldersIndex + 1];
    if (FOLDER_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  const idFromQuery = parsed.searchParams.get('id');
  if (idFromQuery && FOLDER_ID_PATTERN.test(idFromQuery)) {
    return idFromQuery;
  }

  return null;
}
