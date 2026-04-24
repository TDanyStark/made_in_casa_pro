/**
 * @jest-environment node
 */

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserEmailConnection: jest.fn(),
}));

jest.mock("@/lib/queries/notificationDeliveries", () => ({
  createNotificationDelivery: jest.fn(),
  markDeliverySent: jest.fn(),
  markDeliveryFailed: jest.fn(),
}));

jest.mock("@/lib/queries/projectEmailThreads", () => ({
  getOrCreateThread: jest.fn(),
  updateThreadExternalIds: jest.fn(),
}));

jest.mock("@/lib/services/email/gmailEmailProvider", () => ({
  GmailEmailProvider: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ messageId: "gmail-msg-id", gmailThreadId: "gmail-thread-id" }),
  })),
}));

jest.mock("@/lib/services/email/systemEmailProvider", () => ({
  SystemEmailProvider: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ messageId: "smtp-msg-id", gmailThreadId: null }),
  })),
  getSystemFrom: jest.fn().mockReturnValue({ email: "notificaciones@mic.com", name: "Made in Casa" }),
}));

import { sendEmail } from "@/lib/services/email/emailService";
import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import {
  createNotificationDelivery,
  markDeliverySent,
  markDeliveryFailed,
} from "@/lib/queries/notificationDeliveries";
import { getOrCreateThread, updateThreadExternalIds } from "@/lib/queries/projectEmailThreads";
import { GmailEmailProvider } from "@/lib/services/email/gmailEmailProvider";
import { SystemEmailProvider } from "@/lib/services/email/systemEmailProvider";

const mockGetUserEmailConnection = getUserEmailConnection as jest.MockedFunction<typeof getUserEmailConnection>;
const mockCreateDelivery = createNotificationDelivery as jest.MockedFunction<typeof createNotificationDelivery>;
const mockMarkSent = markDeliverySent as jest.MockedFunction<typeof markDeliverySent>;
const mockMarkFailed = markDeliveryFailed as jest.MockedFunction<typeof markDeliveryFailed>;
const mockGetOrCreateThread = getOrCreateThread as jest.MockedFunction<typeof getOrCreateThread>;

const baseMessage = {
  to: { email: "recipient@test.com", name: "Ana" },
  subject: "Tarea asignada",
  html: "<p>Tienes una tarea</p>",
};

const connectedConnection = {
  id: 1, user_id: 7, provider: "gmail" as const, email: "user@gmail.com",
  access_token: "access-token", refresh_token: "refresh-token",
  expires_at: null, scopes: "gmail.send", status: "connected" as const,
  last_error: null, created_at: "2026-01-01", updated_at: "2026-01-01",
};

const baseThread = {
  id: 1, project_id: 1, adjustment_id: null, thread_key: "project:1:version:base",
  provider: "gmail" as const, gmail_thread_id: null, root_message_id: null,
  created_by_user_id: 7, created_at: "2026-01-01", updated_at: "2026-01-01",
};

describe("sendEmail()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateDelivery.mockResolvedValue({ id: 42 } as never);
    mockMarkSent.mockResolvedValue(undefined);
    mockMarkFailed.mockResolvedValue(undefined);
    mockGetOrCreateThread.mockResolvedValue(baseThread);
    (updateThreadExternalIds as jest.Mock).mockResolvedValue(undefined);
  });

  it("uses Gmail provider when senderUserId has a connected account", async () => {
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);

    const result = await sendEmail({ senderUserId: 7, message: baseMessage, eventId: 10 });

    expect(GmailEmailProvider).toHaveBeenCalledWith(7);
    expect(result.provider).toBe("gmail");
    expect(result.gmailThreadId).toBe("gmail-thread-id");
    expect(mockMarkSent).toHaveBeenCalledWith(42, expect.objectContaining({ gmail_thread_id: "gmail-thread-id" }));
  });

  it("falls back to system provider when senderUserId has no connection", async () => {
    mockGetUserEmailConnection.mockResolvedValue(null);

    const result = await sendEmail({ senderUserId: 7, message: baseMessage, eventId: 10 });

    expect(SystemEmailProvider).toHaveBeenCalled();
    expect(result.provider).toBe("smtp");
  });

  it("uses system provider when forceSystemSender is true even if user has Gmail", async () => {
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);

    const result = await sendEmail({
      senderUserId: 7,
      forceSystemSender: true,
      message: baseMessage,
      eventId: 10,
    });

    expect(SystemEmailProvider).toHaveBeenCalled();
    expect(GmailEmailProvider).not.toHaveBeenCalled();
    expect(result.provider).toBe("smtp");
  });

  it("creates a pending delivery before sending and marks it sent on success", async () => {
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);

    await sendEmail({ senderUserId: 7, message: baseMessage, eventId: 10, recipientUserId: 3 });

    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 10, recipient_user_id: 3, recipient_email: "recipient@test.com" })
    );
    expect(mockMarkSent).toHaveBeenCalledWith(42, expect.any(Object));
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("marks delivery as failed and rethrows when provider throws", async () => {
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);
    const GmailMock = GmailEmailProvider as jest.MockedClass<typeof GmailEmailProvider>;
    GmailMock.mockImplementationOnce(() => ({
      send: jest.fn().mockRejectedValue(new Error("SMTP timeout")),
    } as never));

    await expect(
      sendEmail({ senderUserId: 7, message: baseMessage, eventId: 10 })
    ).rejects.toThrow("SMTP timeout");

    expect(mockMarkFailed).toHaveBeenCalledWith(42, "SMTP timeout");
    expect(mockMarkSent).not.toHaveBeenCalled();
  });

  it("creates and updates thread when projectId and threadKey are provided", async () => {
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);

    await sendEmail({
      senderUserId: 7,
      message: baseMessage,
      eventId: 10,
      projectId: 1,
      thread: { threadKey: "project:1:version:base" },
    });

    expect(mockGetOrCreateThread).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 1, thread_key: "project:1:version:base" })
    );
    expect(updateThreadExternalIds).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ gmail_thread_id: "gmail-thread-id" })
    );
  });
});
