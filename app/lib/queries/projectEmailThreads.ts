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

export function buildThreadKey(projectId: number, adjustmentId: number | null): string {
  const version = adjustmentId ? `adjustment-${adjustmentId}` : "base";
  return `project:${projectId}:version:${version}`;
}

export async function getOrCreateThread(data: {
  project_id: number;
  adjustment_id?: number | null;
  thread_key?: string;
  provider?: ThreadProvider;
  created_by_user_id?: number | null;
}): Promise<ProjectEmailThreadType> {
  try {
    const threadKey = data.thread_key ?? buildThreadKey(data.project_id, data.adjustment_id ?? null);

    const existing = await db.execute({
      sql: `
        SELECT id, project_id, adjustment_id, thread_key, provider, gmail_thread_id,
               root_message_id, created_by_user_id, created_at, updated_at
        FROM project_email_threads
        WHERE project_id = $1 AND thread_key = $2
      `,
      args: [data.project_id, threadKey],
    });

    if (existing.rows.length > 0) {
      return existing.rows[0] as unknown as ProjectEmailThreadType;
    }

    const result = await db.execute({
      sql: `
        INSERT INTO project_email_threads (project_id, adjustment_id, thread_key, provider, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
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