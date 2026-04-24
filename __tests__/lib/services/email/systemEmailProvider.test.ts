/**
 * @jest-environment node
 */

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "<msg-123@smtp>" }),
  }),
}));

import nodemailer from "nodemailer";
import { SystemEmailProvider } from "@/lib/services/email/systemEmailProvider";

const mockTransport = (nodemailer.createTransport as jest.Mock).mock.results[0]
  ?.value as { sendMail: jest.Mock } | undefined;

function getTransport(): { sendMail: jest.Mock } {
  return (nodemailer.createTransport as jest.Mock).mock.results.at(-1)?.value;
}

describe("SystemEmailProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "password";
    process.env.SMTP_SECURE = "false";
    process.env.NOTIFICATION_FROM_EMAIL = "notificaciones@mic.com";
    process.env.NOTIFICATION_FROM_NAME = "Made in Casa";
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: "<msg-123@smtp>" }),
    });
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("sends an email using SMTP transport", async () => {
    const provider = new SystemEmailProvider();

    const result = await provider.send({
      from: { email: "notificaciones@mic.com", name: "Made in Casa" },
      message: {
        to: { email: "recipient@test.com", name: "Ana" },
        subject: "Tarea asignada",
        html: "<p>Tienes una tarea</p>",
      },
    });

    const transport = getTransport();
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining("recipient@test.com"),
        subject: "Tarea asignada",
        html: "<p>Tienes una tarea</p>",
      })
    );
    expect(result.messageId).toBe("<msg-123@smtp>");
    expect(result.gmailThreadId).toBeNull();
  });

  it("adds In-Reply-To and References headers when a thread has rootMessageId", async () => {
    const provider = new SystemEmailProvider();

    await provider.send({
      from: { email: "notificaciones@mic.com", name: "Made in Casa" },
      message: {
        to: { email: "recipient@test.com" },
        subject: "Re: Proyecto",
        html: "<p>Actualización</p>",
      },
      thread: {
        threadKey: "project:1:version:base",
        rootMessageId: "<root-msg@smtp>",
      },
    });

    const transport = getTransport();
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        inReplyTo: "<root-msg@smtp>",
        references: "<root-msg@smtp>",
      })
    );
  });

  it("throws when SMTP env vars are missing", async () => {
    delete process.env.SMTP_HOST;
    const provider = new SystemEmailProvider();

    await expect(
      provider.send({
        from: { email: "notificaciones@mic.com", name: "Made in Casa" },
        message: {
          to: { email: "recipient@test.com" },
          subject: "Test",
          html: "<p>Test</p>",
        },
      })
    ).rejects.toThrow("Configuración SMTP incompleta");
  });

  it("auto-generates plain text from html when text is not provided", async () => {
    const provider = new SystemEmailProvider();

    await provider.send({
      from: { email: "notificaciones@mic.com", name: "Made in Casa" },
      message: {
        to: { email: "recipient@test.com" },
        subject: "Test",
        html: "<p>Hola <strong>mundo</strong></p>",
      },
    });

    const transport = getTransport();
    const call = transport.sendMail.mock.calls[0][0];
    expect(call.text).toBe("Hola mundo");
  });
});
