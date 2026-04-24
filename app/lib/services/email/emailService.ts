import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import {
  createNotificationDelivery,
  markDeliveryFailed,
  markDeliverySent,
} from "@/lib/queries/notificationDeliveries";
import {
  getOrCreateThread,
  updateThreadExternalIds,
} from "@/lib/queries/projectEmailThreads";
import { GmailEmailProvider } from "./gmailEmailProvider";
import { SystemEmailProvider, getSystemFrom } from "./systemEmailProvider";
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
    await markDeliveryFailed(delivery.id, errorMsg);
    throw error;
  }
}
