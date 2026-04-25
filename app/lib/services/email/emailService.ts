import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import {
  createNotificationDelivery,
  getDeliveryCountByEventAndRecipient,
  markDeliveryFailed,
  markDeliverySent,
  markDeliverySkipped,
} from "@/lib/queries/notificationDeliveries";
import {
  getOrCreateThread,
  updateThreadExternalIds,
} from "@/lib/queries/projectEmailThreads";
import { GmailEmailProvider } from "./gmailEmailProvider";
import { SystemEmailProvider, getSystemFrom } from "./systemEmailProvider";
import { notifLog } from "@/lib/services/notificationLogger";
import type { SendEmailOptions, SendResult } from "./emailTypes";

// ---------------------------------------------------------------------------
// emailService — unified email dispatcher
//
// Decision tree:
//   1. forceSystemSender → system provider
//   2. senderUserId with connected Gmail → Gmail provider
//   3. fallback → system provider
//
// Records every attempt in notification_deliveries.
// Updates project_email_threads with gmail_thread_id / root_message_id.
// ---------------------------------------------------------------------------

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const {
    senderUserId,
    forceSystemSender = false,
    message,
    eventId,
    recipientUserId,
    thread,
    projectId,
    adjustmentId,
  } = opts;

  // ── Resolve provider ──────────────────────────────────────────────────────
  let useGmail = false;
  let senderEmail: string;
  let senderName: string;
  let providerLabel: "gmail" | "smtp" = "smtp";

  if (!forceSystemSender && senderUserId) {
    const connection = await getUserEmailConnection(senderUserId);
    if (connection?.status === "connected" && connection.refresh_token) {
      useGmail = true;
      senderEmail = connection.email;
      senderName =
        process.env.NOTIFICATION_FROM_NAME ?? "Made in Casa";
      providerLabel = "gmail";
    }
  }

  if (!useGmail) {
    const systemFrom = getSystemFrom();
    senderEmail = systemFrom.email;
    senderName = systemFrom.name;
    providerLabel = "smtp";
  }

  // ── Resolve thread context ────────────────────────────────────────────────
  let resolvedThread = thread;
  if (projectId && thread?.threadKey) {
    const threadRecord = await getOrCreateThread({
      project_id: projectId,
      adjustment_id: adjustmentId ?? null,
      thread_key: thread.threadKey,
      provider: providerLabel,
      created_by_user_id: senderUserId ?? null,
    });

    resolvedThread = {
      threadKey: threadRecord.thread_key,
      gmailThreadId: threadRecord.gmail_thread_id,
      rootMessageId: threadRecord.root_message_id,
    };
  }

  // ── Idempotency check ─────────────────────────────────────────────────────
  // Prevent sending the same notification twice if dispatchNotification is
  // called more than once for the same (event, recipient) pair.
  const existingCount = await getDeliveryCountByEventAndRecipient(eventId, message.to.email);
  if (existingCount > 0) {
    notifLog.warn("sendEmail", `Skipping duplicate delivery — event=${eventId} recipient=${message.to.email}`);
    // Return a sentinel result so callers do not crash
    return {
      deliveryId: -1,
      provider: providerLabel,
      gmailThreadId: null,
      messageId: null,
    };
  }

  // ── Create pending delivery record ────────────────────────────────────────
  const delivery = await createNotificationDelivery({
    event_id: eventId,
    recipient_user_id: recipientUserId ?? null,
    recipient_email: message.to.email,
    sender_user_id: senderUserId ?? null,
    provider: providerLabel,
  });

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    const provider = useGmail && senderUserId
      ? new GmailEmailProvider(senderUserId)
      : new SystemEmailProvider();

    const result = await provider.send({
      from: { email: senderEmail!, name: senderName! },
      message,
      thread: resolvedThread,
    });

    await markDeliverySent(delivery.id, {
      gmail_thread_id: result.gmailThreadId ?? undefined,
      message_id: result.messageId ?? undefined,
    });

    notifLog.info("sendEmail", `Sent — delivery=${delivery.id} provider=${providerLabel} to=${message.to.email}`);

    // Persist thread identifiers for future replies
    if (projectId && resolvedThread?.threadKey) {
      const threadRecord = await getOrCreateThread({
        project_id: projectId,
        adjustment_id: adjustmentId ?? null,
        thread_key: resolvedThread.threadKey,
        provider: providerLabel,
        created_by_user_id: senderUserId ?? null,
      });

      const needsUpdate =
        (result.gmailThreadId && !threadRecord.gmail_thread_id) ||
        (result.messageId && !threadRecord.root_message_id);

      if (needsUpdate) {
        await updateThreadExternalIds(threadRecord.id, {
          gmail_thread_id: result.gmailThreadId ?? undefined,
          root_message_id: result.messageId ?? undefined,
        });
      }
    }

    return {
      deliveryId: delivery.id,
      provider: providerLabel,
      gmailThreadId: result.gmailThreadId,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    notifLog.error("sendEmail", `Failed — delivery=${delivery.id} to=${message.to.email}: ${errorMsg}`);
    await markDeliveryFailed(delivery.id, errorMsg);

    // If it is a permanent failure (max retries reached), skip and don't re-throw
    // so the notification engine does not crash the mutation.
    // Actual retry logic is handled by the manual retry endpoint.
    throw error;
  }
}

// ---------------------------------------------------------------------------
// retryDelivery — re-sends a single failed delivery
//
// Reads the stored delivery + event, re-builds a minimal email and sends it.
// Enforces MAX_RETRY_COUNT to prevent infinite retries.
// ---------------------------------------------------------------------------
export async function retryDelivery(
  deliveryId: number,
  overrideMessage: {
    to: { email: string; name?: string };
    subject: string;
    html: string;
    text?: string;
  }
): Promise<SendResult> {
  const {
    getDeliveryById,
    markDeliveryFailed: failDelivery,
    MAX_RETRY_COUNT: maxRetries,
    resetDeliveryForRetry,
  } = await import("@/lib/queries/notificationDeliveries");

  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

  if (delivery.status !== "failed") {
    throw new Error(`Delivery ${deliveryId} is not in 'failed' state (current: ${delivery.status})`);
  }

  if (delivery.retry_count >= maxRetries) {
    const msg = `Max retry count (${maxRetries}) reached for delivery ${deliveryId}`;
    notifLog.error("retryDelivery", msg);
    throw new Error(msg);
  }

  // Reset to pending so the send attempt is fresh
  await resetDeliveryForRetry(deliveryId);

  try {
    const result = await sendEmail({
      senderUserId: delivery.sender_user_id,
      message: overrideMessage,
      eventId: delivery.event_id,
      recipientUserId: delivery.recipient_user_id,
    });

    notifLog.info("retryDelivery", `Retry succeeded — delivery=${deliveryId} attempt=${delivery.retry_count + 1}`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    notifLog.error("retryDelivery", `Retry failed — delivery=${deliveryId} attempt=${delivery.retry_count + 1}: ${errorMsg}`);

    // Mark as failed again with incremented retry_count (markDeliveryFailed does this)
    await failDelivery(deliveryId, errorMsg);
    throw error;
  }
}

// Re-export markDeliverySkipped so consumers don't need two imports
export { markDeliverySkipped };
