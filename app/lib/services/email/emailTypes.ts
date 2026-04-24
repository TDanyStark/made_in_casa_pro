import type { DeliveryProvider } from "@/lib/queries/notificationDeliveries";

// ---------------------------------------------------------------------------
// Shared types for the email service layer
// ---------------------------------------------------------------------------

export type { DeliveryProvider };

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailRecipient;
  subject: string;
  html: string;
  /** Plain-text fallback. Auto-derived from html when omitted. */
  text?: string;
  replyTo?: string;
}

export interface ThreadContext {
  /** Stable key used to look up or create the thread record. */
  threadKey: string;
  /** Gmail thread ID to reply into (populated after first email is sent). */
  gmailThreadId?: string | null;
  /** SMTP/RFC822 Message-ID of the first message in the thread. */
  rootMessageId?: string | null;
}

export interface SendEmailOptions {
  /** User performing the action. When provided and connected, sends via their Gmail. */
  senderUserId?: number | null;
  /** Force the system sender regardless of user connection status. */
  forceSystemSender?: boolean;
  message: EmailMessage;
  /** DB event row id, used to record the delivery attempt. */
  eventId: number;
  /** Recipient's user id if they are an app user (for delivery tracking). */
  recipientUserId?: number | null;
  /** Thread context to maintain per-version email threads. */
  thread?: ThreadContext;
  /** Project context for thread creation/update. */
  projectId?: number | null;
  adjustmentId?: number | null;
}

export interface SendResult {
  deliveryId: number;
  provider: DeliveryProvider;
  gmailThreadId?: string | null;
  messageId?: string | null;
}

export interface EmailProvider {
  send(opts: {
    from: { email: string; name: string };
    message: EmailMessage;
    thread?: ThreadContext;
  }): Promise<{ messageId?: string | null; gmailThreadId?: string | null }>;
}
