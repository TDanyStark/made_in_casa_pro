import { db } from "../db";

export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type DeliveryProvider = "gmail" | "smtp" | "resend";

export type NotificationDeliveryType = {
  id: number;
  event_id: number;
  recipient_user_id: number | null;
  recipient_email: string;
  sender_user_id: number | null;
  provider: DeliveryProvider;
  status: DeliveryStatus;
  error: string | null;
  gmail_thread_id: string | null;
  message_id: string | null;
  sent_at: string | null;
  created_at: string;
  retry_count: number;
  last_attempt_at: string | null;
};

export type NotificationDeliveryDetailType = NotificationDeliveryType & {
  event_type: string | null;
  project_id: number | null;
  project_title: string | null;
  task_id: number | null;
  task_title: string | null;
  adjustment_id: number | null;
  actor_user_id: number | null;
  actor_name: string | null;
};

export async function createNotificationDelivery(data: {
  event_id: number;
  recipient_user_id?: number | null;
  recipient_email: string;
  sender_user_id?: number | null;
  provider?: DeliveryProvider;
}): Promise<NotificationDeliveryType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO notification_deliveries (event_id, recipient_user_id, recipient_email, sender_user_id, provider, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id, event_id, recipient_user_id, recipient_email, sender_user_id, provider, status, error, gmail_thread_id, message_id, sent_at, created_at, retry_count, last_attempt_at
      `,
      args: [
        data.event_id,
        data.recipient_user_id ?? null,
        data.recipient_email,
        data.sender_user_id ?? null,
        data.provider ?? "gmail",
      ],
    });
    return result.rows[0] as unknown as NotificationDeliveryType;
  } catch (error) {
    console.error("Error creating notification delivery:", error);
    throw error;
  }
}

export async function markDeliverySent(
  deliveryId: number,
  data: {
    gmail_thread_id?: string;
    message_id?: string;
  }
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE notification_deliveries
        SET status = 'sent', gmail_thread_id = COALESCE($2, gmail_thread_id),
            message_id = COALESCE($3, message_id), sent_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      args: [deliveryId, data.gmail_thread_id ?? null, data.message_id ?? null],
    });
  } catch (error) {
    console.error("Error marking delivery sent:", error);
    throw error;
  }
}

export async function markDeliveryFailed(
  deliveryId: number,
  errorMessage: string
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE notification_deliveries
        SET status = 'failed', error = $2,
            retry_count = retry_count + 1, last_attempt_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      args: [deliveryId, errorMessage],
    });
  } catch (error) {
    console.error("Error marking delivery failed:", error);
    throw error;
  }
}

export async function markDeliverySkipped(
  deliveryId: number,
  reason: string
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE notification_deliveries
        SET status = 'skipped', error = $2
        WHERE id = $1
      `,
      args: [deliveryId, reason],
    });
  } catch (error) {
    console.error("Error marking delivery skipped:", error);
    throw error;
  }
}

export async function getDeliveriesByEvent(
  eventId: number
): Promise<NotificationDeliveryType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, event_id, recipient_user_id, recipient_email, sender_user_id,
               provider, status, error, gmail_thread_id, message_id, sent_at, created_at
        FROM notification_deliveries
        WHERE event_id = $1
        ORDER BY created_at ASC
      `,
      args: [eventId],
    });
    return result.rows as unknown as NotificationDeliveryType[];
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return [];
  }
}

export async function getDeliveriesByUser(
  userId: number,
  limit = 50
): Promise<NotificationDeliveryType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT nd.id, nd.event_id, nd.recipient_user_id, nd.recipient_email, nd.sender_user_id,
               nd.provider, nd.status, nd.error, nd.gmail_thread_id, nd.message_id, nd.sent_at, nd.created_at
        FROM notification_deliveries nd
        WHERE nd.recipient_user_id = $1 OR nd.sender_user_id = $1
        ORDER BY nd.created_at DESC
        LIMIT $2
      `,
      args: [userId, limit],
    });
    return result.rows as unknown as NotificationDeliveryType[];
  } catch (error) {
    console.error("Error fetching user deliveries:", error);
    return [];
  }
}

export async function getFailedDeliveries(
  limit = 100
): Promise<NotificationDeliveryDetailType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          nd.id, nd.event_id, nd.recipient_user_id, nd.recipient_email, nd.sender_user_id,
          nd.provider, nd.status, nd.error, nd.gmail_thread_id, nd.message_id, nd.sent_at,
          nd.created_at, nd.retry_count, nd.last_attempt_at,
          ne.event_type,
          ne.project_id, p.title AS project_title,
          ne.task_id, pt.title AS task_title,
          ne.adjustment_id,
          ne.actor_user_id,
          u.name AS actor_name
        FROM notification_deliveries nd
        JOIN notification_events ne ON ne.id = nd.event_id
        LEFT JOIN projects p ON p.id = ne.project_id
        LEFT JOIN project_tasks pt ON pt.id = ne.task_id
        LEFT JOIN users u ON u.id = ne.actor_user_id
        WHERE nd.status = 'failed'
        ORDER BY nd.created_at DESC
        LIMIT $1
      `,
      args: [limit],
    });
    return result.rows as unknown as NotificationDeliveryDetailType[];
  } catch (error) {
    console.error("Error fetching failed deliveries:", error);
    return [];
  }
}

export async function getRecentDeliveries(
  limit = 50
): Promise<NotificationDeliveryDetailType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          nd.id, nd.event_id, nd.recipient_user_id, nd.recipient_email, nd.sender_user_id,
          nd.provider, nd.status, nd.error, nd.gmail_thread_id, nd.message_id, nd.sent_at,
          nd.created_at, nd.retry_count, nd.last_attempt_at,
          ne.event_type,
          ne.project_id, p.title AS project_title,
          ne.task_id, pt.title AS task_title,
          ne.adjustment_id,
          ne.actor_user_id,
          u.name AS actor_name
        FROM notification_deliveries nd
        JOIN notification_events ne ON ne.id = nd.event_id
        LEFT JOIN projects p ON p.id = ne.project_id
        LEFT JOIN project_tasks pt ON pt.id = ne.task_id
        LEFT JOIN users u ON u.id = ne.actor_user_id
        ORDER BY nd.created_at DESC
        LIMIT $1
      `,
      args: [limit],
    });
    return result.rows as unknown as NotificationDeliveryDetailType[];
  } catch (error) {
    console.error("Error fetching recent deliveries:", error);
    return [];
  }
}

export async function getDeliveryById(
  deliveryId: number
): Promise<NotificationDeliveryDetailType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          nd.id, nd.event_id, nd.recipient_user_id, nd.recipient_email, nd.sender_user_id,
          nd.provider, nd.status, nd.error, nd.gmail_thread_id, nd.message_id, nd.sent_at,
          nd.created_at, nd.retry_count, nd.last_attempt_at,
          ne.event_type,
          ne.project_id, p.title AS project_title,
          ne.task_id, pt.title AS task_title,
          ne.adjustment_id,
          ne.actor_user_id,
          u.name AS actor_name
        FROM notification_deliveries nd
        JOIN notification_events ne ON ne.id = nd.event_id
        LEFT JOIN projects p ON p.id = ne.project_id
        LEFT JOIN project_tasks pt ON pt.id = ne.task_id
        LEFT JOIN users u ON u.id = ne.actor_user_id
        WHERE nd.id = $1
      `,
      args: [deliveryId],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as NotificationDeliveryDetailType;
  } catch (error) {
    console.error("Error fetching delivery by id:", error);
    return null;
  }
}

export async function resetDeliveryForRetry(deliveryId: number): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE notification_deliveries
        SET status = 'pending', error = NULL
        WHERE id = $1 AND status = 'failed'
      `,
      args: [deliveryId],
    });
  } catch (error) {
    console.error("Error resetting delivery for retry:", error);
    throw error;
  }
}