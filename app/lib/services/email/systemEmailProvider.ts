import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider, ThreadContext } from "./emailTypes";

// ---------------------------------------------------------------------------
// System email provider
// Reads SMTP credentials from env and sends via nodemailer.
// Used for automatic/technical notifications and as fallback when a user
// has not connected Gmail.
// ---------------------------------------------------------------------------

function getSystemFromAddress() {
  const email = process.env.NOTIFICATION_FROM_EMAIL;
  const name = process.env.NOTIFICATION_FROM_NAME ?? "Made in Casa";
  if (!email) {
    throw new Error(
      "NOTIFICATION_FROM_EMAIL no está configurado. Agrega la variable de entorno."
    );
  }
  return { email, name };
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error(
      "Configuración SMTP incompleta. Verifica SMTP_HOST, SMTP_USER y SMTP_PASSWORD."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

export class SystemEmailProvider implements EmailProvider {
  async send({
    from,
    message,
    thread,
  }: {
    from: { email: string; name: string };
    message: EmailMessage;
    thread?: ThreadContext;
  }): Promise<{ messageId?: string | null; gmailThreadId?: string | null }> {
    const transport = createTransport();

    const mailOptions: Parameters<typeof transport.sendMail>[0] = {
      from: `"${from.name}" <${from.email}>`,
      to: message.to.name
        ? `"${message.to.name}" <${message.to.email}>`
        : message.to.email,
      subject: message.subject,
      html: message.html,
      text: message.text ?? stripHtml(message.html),
      replyTo: message.replyTo ?? process.env.NOTIFICATION_REPLY_TO_EMAIL ?? from.email,
    };

    // SMTP threading via RFC 2822 headers
    if (thread?.rootMessageId) {
      mailOptions.references = thread.rootMessageId;
      mailOptions.inReplyTo = thread.rootMessageId;
    }

    const info = await transport.sendMail(mailOptions);
    const messageId: string | null = info.messageId ?? null;

    return { messageId, gmailThreadId: null };
  }
}

export function getSystemFrom() {
  return getSystemFromAddress();
}
