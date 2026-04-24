/**
 * @jest-environment node
 */

jest.mock("googleapis", () => {
  const sendMock = jest.fn().mockResolvedValue({
    data: { id: "gmail-msg-id", threadId: "gmail-thread-id" },
  });
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
          on: jest.fn(),
        })),
      },
      gmail: jest.fn().mockReturnValue({
        users: {
          messages: {
            send: sendMock,
          },
        },
      }),
    },
    __sendMock: sendMock,
  };
});

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn().mockResolvedValue({
    google_oauth_client_id: "client-id",
    google_oauth_client_secret: "client-secret",
  }),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserEmailConnection: jest.fn(),
  markEmailConnectionInvalid: jest.fn(),
  updateUserEmailConnectionTokens: jest.fn(),
}));

import { GmailEmailProvider } from "@/lib/services/email/gmailEmailProvider";
import { getUserEmailConnection, markEmailConnectionInvalid } from "@/lib/queries/userEmailConnections";

const mockGetUserEmailConnection = getUserEmailConnection as jest.MockedFunction<typeof getUserEmailConnection>;
const mockMarkEmailConnectionInvalid = markEmailConnectionInvalid as jest.MockedFunction<typeof markEmailConnectionInvalid>;

const connectedConnection = {
  id: 1,
  user_id: 7,
  provider: "gmail" as const,
  email: "user@gmail.com",
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: null,
  scopes: "gmail.send",
  status: "connected" as const,
  last_error: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("GmailEmailProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);
  });

  it("sends an email via Gmail API and returns threadId and messageId", async () => {
    const provider = new GmailEmailProvider(7);

    const result = await provider.send({
      from: { email: "user@gmail.com", name: "Daniel" },
      message: {
        to: { email: "recipient@test.com", name: "Ana" },
        subject: "Tarea completada",
        html: "<p>Completé la tarea</p>",
      },
    });

    expect(result.gmailThreadId).toBe("gmail-thread-id");
    expect(result.messageId).toBe("gmail-msg-id");
  });

  it("passes threadId to reply into an existing Gmail thread", async () => {
    const { google, __sendMock } = await import("googleapis") as never as {
      google: never;
      __sendMock: jest.Mock;
    };

    const provider = new GmailEmailProvider(7);

    await provider.send({
      from: { email: "user@gmail.com", name: "Daniel" },
      message: {
        to: { email: "recipient@test.com" },
        subject: "Actualización",
        html: "<p>Update</p>",
      },
      thread: {
        threadKey: "project:1:version:base",
        gmailThreadId: "existing-thread-id",
      },
    });

    expect(__sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ threadId: "existing-thread-id" }),
      })
    );
  });

  it("throws when user has no connected Gmail", async () => {
    mockGetUserEmailConnection.mockResolvedValueOnce(null);
    const provider = new GmailEmailProvider(7);

    await expect(
      provider.send({
        from: { email: "user@gmail.com", name: "Daniel" },
        message: {
          to: { email: "recipient@test.com" },
          subject: "Test",
          html: "<p>Test</p>",
        },
      })
    ).rejects.toThrow("El usuario no tiene Gmail conectado");
  });

  it("marks connection invalid and throws on invalid_grant", async () => {
    const { google } = await import("googleapis");
    const gmailMock = google.gmail({ version: "v1", auth: {} as never });
    (gmailMock.users.messages.send as jest.Mock).mockRejectedValueOnce(
      new Error("invalid_grant: Token has been expired or revoked.")
    );

    // Patch the module-level gmail factory to return the mock with a failing send
    const { __sendMock } = await import("googleapis") as never as { __sendMock: jest.Mock };
    __sendMock.mockRejectedValueOnce(
      new Error("invalid_grant: Token has been expired or revoked.")
    );

    mockMarkEmailConnectionInvalid.mockResolvedValue(undefined);

    const provider = new GmailEmailProvider(7);

    await expect(
      provider.send({
        from: { email: "user@gmail.com", name: "Daniel" },
        message: {
          to: { email: "recipient@test.com" },
          subject: "Test",
          html: "<p>Test</p>",
        },
      })
    ).rejects.toThrow("expiró o fue revocada");

    expect(mockMarkEmailConnectionInvalid).toHaveBeenCalledWith(7, expect.stringContaining("invalid_grant"));
  });
});
