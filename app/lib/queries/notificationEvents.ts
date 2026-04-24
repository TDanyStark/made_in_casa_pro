import { db } from "../db";

export type NotificationEventType = {
  id: number;
  event_type: string;
  project_id: number | null;
  task_id: number | null;
  adjustment_id: number | null;
  actor_user_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function createNotificationEvent(data: {
  event_type: string;
  project_id?: number | null;
  task_id?: number | null;
  adjustment_id?: number | null;
  actor_user_id?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<NotificationEventType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO notification_events (event_type, project_id, task_id, adjustment_id, actor_user_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, event_type, project_id, task_id, adjustment_id, actor_user_id, metadata, created_at
      `,
      args: [
        data.event_type,
        data.project_id ?? null,
        data.task_id ?? null,
        data.adjustment_id ?? null,
        data.actor_user_id ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    });
    return result.rows[0] as unknown as NotificationEventType;
  } catch (error) {
    console.error("Error creating notification event:", error);
    throw error;
  }
}

export async function getNotificationEventsByProject(
  projectId: number,
  limit = 50
): Promise<NotificationEventType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, event_type, project_id, task_id, adjustment_id, actor_user_id, metadata, created_at
        FROM notification_events
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      args: [projectId, limit],
    });
    return result.rows as unknown as NotificationEventType[];
  } catch (error) {
    console.error("Error fetching notification events:", error);
    return [];
  }
}

export async function getNotificationEventsByTask(
  taskId: number
): Promise<NotificationEventType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, event_type, project_id, task_id, adjustment_id, actor_user_id, metadata, created_at
        FROM notification_events
        WHERE task_id = $1
        ORDER BY created_at DESC
      `,
      args: [taskId],
    });
    return result.rows as unknown as NotificationEventType[];
  } catch (error) {
    console.error("Error fetching task notification events:", error);
    return [];
  }
}