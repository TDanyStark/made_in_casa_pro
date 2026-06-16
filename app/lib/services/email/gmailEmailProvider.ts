import { google } from "googleapis";
import { getAppSettings } from "@/lib/queries/settings";
import {
  getUserEmailConnection,
  markEmailConnectionInvalid,
  updateUserEmailConnectionTokens,
} from "@/lib/queries/userEmailConnections";
import type { EmailMessage, EmailProvider, ThreadContext } from "./emailTypes";

// ---------------------------------------------------------------------------
// Gmail API email provider
// Sends on behalf of a connected user using their stored OAuth tokens.
// Handles token refresh automatically and marks the connection invalid when
// Google revokes access (invalid_grant).
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Encodes a header value using RFC 2047 encoded-word format (Base64, UTF-8).
 * Required for any header field (Subject, From display name, etc.) that contains
 * non-ASCII characters such as accented letters (á, é, ó, ñ) or emoji.
 *
 * Output format: =?UTF-8?B?<base64>?=
 */
function encodeRfc2047(value: string): string {
  // If the string is pure ASCII, no encoding is needed
  if (!/[^\x00-\x7F]/.test(value)) return value;
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

function buildRfc822Message({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  inReplyTo,
  references,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `MIC_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeRfc2047(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);

  lines.push(
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    "",
    text,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    "",
    html,
    "",
    `--${boundary}--`,
  );

  return lines.join("\r\n");
}

export class GmailEmailProvider implements EmailProvider {
  constructor(private readonly userId: number) {}

  async send({
    from,
    message,
    thread,
  }: {
    from: { email: string; name: string };
    message: EmailMessage;
    thread?: ThreadContext;
  }): Promise<{ messageId?: string | null; gmailThreadId?: string | null }> {
    const connection = await getUserEmailConnection(this.userId);

    if (!connection || !connection.refresh_token) {
      throw new Error("El usuario no tiene Gmail conectado.");
    }

    const settings = await getAppSettings();
    if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
      throw new Error("Google OAuth no está configurado en el sistema.");
    }

    const oauth2Client = new google.auth.OAuth2(
      settings.google_oauth_client_id,
      settings.google_oauth_client_secret
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
      access_token: connection.access_token ?? undefined,
    });

    // Auto-refresh tokens and persist the new access_token
    oauth2Client.on("tokens", async (tokens) => {
      try {
        await updateUserEmailConnectionTokens(this.userId, {
          access_token: tokens.access_token ?? connection.access_token ?? "",
          refresh_token: tokens.refresh_token ?? null,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        });
      } catch {
        // Non-critical — the send will still proceed with the refreshed token
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const fromAddress = `"${from.name}" <${from.email}>`;
    const toAddress = message.to.name
      ? `"${message.to.name}" <${message.to.email}>`
      : message.to.email;
    const text = message.text ?? stripHtml(message.html);

    const raw = buildRfc822Message({
      from: fromAddress,
      to: toAddress,
      subject: message.subject,
      html: message.html,
      text,
      replyTo: message.replyTo,
      inReplyTo: thread?.rootMessageId ?? undefined,
      references: thread?.rootMessageId ?? undefined,
    });

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encoded,
          // Provide threadId to reply into an existing Gmail thread
          ...(thread?.gmailThreadId ? { threadId: thread.gmailThreadId } : {}),
        },
      });

      const gmailThreadId = res.data.threadId ?? null;
      const messageId = res.data.id ?? null;

      return { messageId, gmailThreadId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      const isPermanentAuthFailure =
        msg.includes("invalid_grant") ||
        msg.includes("Token has been expired") ||
        msg.includes("Requested entity was not found") ||
        msg.includes("insufficient authentication scopes") ||
        msg.includes("Request had insufficient authentication scopes");

      if (isPermanentAuthFailure) {
        await markEmailConnectionInvalid(this.userId, msg);
        throw new Error(
          "La autorización de Gmail no es válida. El usuario debe reconectar Gmail desde /connect-email."
        );
      }

      throw error;
    }
  }
}
