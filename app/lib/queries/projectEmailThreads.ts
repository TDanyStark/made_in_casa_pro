import { db } from "../db";

export type ThreadProvider = "gmail" | "smtp" | "resend";

export type ProjectEmailThreadType = {
  id: number;
  project_id: number;
  adjustment_id: number | null;
  thread_key: string;
  provider: ThreadProvider;
  gmail_thread_id: string | null;
  root_message_id: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export function buildThreadKey(projectId: number, versionNumber = 1): string {
  return `project:${projectId}:version:v${versionNumber}`;
}

export async function resolveProjectVersionThreadKey(
  projectId: number,
  adjustmentId?: number | null
): Promise<string> {
  if (adjustmentId == null) return buildThreadKey(projectId, 1);

  const result = await db.execute({
    sql: `SELECT version_number FROM project_adjustments WHERE id = $1 AND project_id = $2`,
    args: [adjustmentId, projectId],
  });

  const versionNumber = Number((result.rows[0] as { version_number?: unknown } | undefined)?.version_number);
  return buildThreadKey(projectId, Number.isFinite(versionNumber) && versionNumber > 0 ? versionNumber : 1);
}

export async function getThreadByProjectVersion(
  projectId: number,
  adjustmentId?: number | null
): Promise<ProjectEmailThreadType | null> {
  try {
    const threadKey = await resolveProjectVersionThreadKey(projectId, adjustmentId ?? null);
    const result = await db.execute({
      sql: `
        SELECT id, project_id, adjustment_id, thread_key, provider, gmail_thread_id,
               root_message_id, created_by_user_id, created_at, updated_at
        FROM project_email_threads
        WHERE project_id = $1 AND thread_key = $2
        LIMIT 1
      `,
      args: [projectId, threadKey],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProjectEmailThreadType;
  } catch (error) {
    console.error("Error fetching project email thread by version:", error);
    return null;
  }
}

export async function getOrCreateThread(data: {
  project_id: number;
  adjustment_id?: number | null;
  thread_key?: string;
  provider?: ThreadProvider;
  created_by_user_id?: number | null;
}): Promise<ProjectEmailThreadType> {
  try {
    const threadKey = data.thread_key ?? await resolveProjectVersionThreadKey(data.project_id, data.adjustment_id ?? null);
    const hasAdjustment = data.adjustment_id != null;
    const conflictTarget = hasAdjustment
      ? "(project_id, adjustment_id, thread_key) WHERE adjustment_id IS NOT NULL"
      : "(project_id, thread_key) WHERE adjustment_id IS NULL";

    const result = await db.execute({
      sql: `
        INSERT INTO project_email_threads (project_id, adjustment_id, thread_key, provider, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ${conflictTarget}
        DO UPDATE SET updated_at = project_email_threads.updated_at
        RETURNING id, project_id, adjustment_id, thread_key, provider, gmail_thread_id,
                  root_message_id, created_by_user_id, created_at, updated_at
      `,
      args: [
        data.project_id,
        data.adjustment_id ?? null,
        threadKey,
        data.provider ?? "gmail",
        data.created_by_user_id ?? null,
      ],
    });

    return result.rows[0] as unknown as ProjectEmailThreadType;
  } catch (error) {
    console.error("Error getting/creating email thread:", error);
    throw error;
  }
}

export async function updateThreadExternalIds(
  threadId: number,
  data: {
    gmail_thread_id?: string;
    root_message_id?: string;
  }
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE project_email_threads
        SET gmail_thread_id = COALESCE($2, gmail_thread_id),
            root_message_id = COALESCE($3, root_message_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      args: [threadId, data.gmail_thread_id ?? null, data.root_message_id ?? null],
    });
  } catch (error) {
    console.error("Error updating thread external IDs:", error);
    throw error;
  }
}

export async function getThreadsByProject(
  projectId: number
): Promise<ProjectEmailThreadType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, project_id, adjustment_id, thread_key, provider, gmail_thread_id,
               root_message_id, created_by_user_id, created_at, updated_at
        FROM project_email_threads
        WHERE project_id = $1
        ORDER BY created_at ASC
      `,
      args: [projectId],
    });
    return result.rows as unknown as ProjectEmailThreadType[];
  } catch (error) {
    console.error("Error fetching project threads:", error);
    return [];
  }
}

export async function getThreadByKey(
  threadKey: string
): Promise<ProjectEmailThreadType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, project_id, adjustment_id, thread_key, provider, gmail_thread_id,
               root_message_id, created_by_user_id, created_at, updated_at
        FROM project_email_threads
        WHERE thread_key = $1
      `,
      args: [threadKey],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProjectEmailThreadType;
  } catch (error) {
    console.error("Error fetching thread by key:", error);
    return null;
  }
}
