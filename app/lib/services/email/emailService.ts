import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import {
  createNotificationDelivery,
  getDeliveryById,
  getDeliveryCountByEventAndRecipient,
  markDeliveryFailed,
  markDeliverySent,
  markDeliverySkipped,
  resetDeliveryForRetry,
} from "@/lib/queries/notificationDeliveries";
import {
  getOrCreateThread,
  updateThreadExternalIds,
} from "@/lib/queries/projectEmailThreads";
import { GmailEmailProvider } from "./gmailEmailProvider";
import { SystemEmailProvider, getSystemFrom } from "./systemEmailProvider";
import { notifLog } from "@/lib/services/notificationLogger";
import type { SendEmailOptions, SendResult, ThreadContext } from "./emailTypes";

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
// resendExistingDelivery — re-sends a specific delivery row without creating
// a new event or a new delivery record.
//
// Bypasses the idempotency check (which would block re-sends for the same
// event+recipient pair) by operating directly on the existing delivery row.
// Resets status to 'pending', sends via the appropriate provider, then marks
// the SAME delivery as 'sent' or 'failed'. The retry_count is incremented on
// failure via markDeliveryFailed.
// ---------------------------------------------------------------------------
export async function resendExistingDelivery(
  deliveryId: number,
  message: {
    to: { email: string; name?: string };
    subject: string;
    html: string;
    text?: string;
  },
  opts?: {
    projectId?: number | null;
    adjustmentId?: number | null;
    threadKey?: string;
    forceSystemSender?: boolean;
  }
): Promise<SendResult> {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

  // Reset to pending — throws if delivery is not currently in 'failed' state
  await resetDeliveryForRetry(deliveryId);

  // ── Resolve provider (same logic as sendEmail) ────────────────────────
  let useGmail = false;
  let senderEmail: string;
  let senderName: string;
  let providerLabel: "gmail" | "smtp" = "smtp";

  if (!opts?.forceSystemSender && delivery.sender_user_id) {
    const connection = await getUserEmailConnection(delivery.sender_user_id);
    if (connection?.status === "connected" && connection.refresh_token) {
      useGmail = true;
      senderEmail = connection.email;
      senderName = process.env.NOTIFICATION_FROM_NAME ?? "Made in Casa";
      providerLabel = "gmail";
    }
  }

  if (!useGmail) {
    const systemFrom = getSystemFrom();
    senderEmail = systemFrom.email;
    senderName = systemFrom.name;
    providerLabel = "smtp";
  }

  // ── Resolve thread context ────────────────────────────────────────────
  let resolvedThread: ThreadContext | undefined;
  if (opts?.projectId && opts?.threadKey) {
    const threadRecord = await getOrCreateThread({
      project_id: opts.projectId,
      adjustment_id: opts.adjustmentId ?? null,
      thread_key: opts.threadKey,
      provider: providerLabel,
      created_by_user_id: delivery.sender_user_id ?? null,
    });
    resolvedThread = {
      threadKey: threadRecord.thread_key,
      gmailThreadId: threadRecord.gmail_thread_id,
      rootMessageId: threadRecord.root_message_id,
    };
  }

  // ── Send ──────────────────────────────────────────────────────────────
  try {
    const provider = useGmail && delivery.sender_user_id
      ? new GmailEmailProvider(delivery.sender_user_id)
      : new SystemEmailProvider();

    const result = await provider.send({
      from: { email: senderEmail!, name: senderName! },
      message,
      thread: resolvedThread,
    });

    await markDeliverySent(deliveryId, {
      gmail_thread_id: result.gmailThreadId ?? undefined,
      message_id: result.messageId ?? undefined,
    });

    notifLog.info("resendExistingDelivery", `Sent — delivery=${deliveryId} provider=${providerLabel} to=${message.to.email}`);

    // Persist thread identifiers for future replies
    if (opts?.projectId && resolvedThread?.threadKey) {
      const threadRecord = await getOrCreateThread({
        project_id: opts.projectId,
        adjustment_id: opts.adjustmentId ?? null,
        thread_key: resolvedThread.threadKey,
        provider: providerLabel,
        created_by_user_id: delivery.sender_user_id ?? null,
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
      deliveryId,
      provider: providerLabel,
      gmailThreadId: result.gmailThreadId,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    notifLog.error("resendExistingDelivery", `Failed — delivery=${deliveryId} to=${message.to.email}: ${errorMsg}`);
    await markDeliveryFailed(deliveryId, errorMsg);
    throw error;
  }
}

// Re-export markDeliverySkipped so consumers don't need two imports
export { markDeliverySkipped };
