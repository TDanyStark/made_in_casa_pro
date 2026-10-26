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
    ).rejects.toThrow(
      "La autorización de Gmail no es válida. El usuario debe reconectar Gmail desde /connect-email."
    );

    expect(mockMarkEmailConnectionInvalid).toHaveBeenCalledWith(7, expect.stringContaining("invalid_grant"));
  });
});

describe("GmailEmailProvider — From/To display names (S24)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetUserEmailConnection.mockResolvedValue(connectedConnection);
    // Drop any queued one-off rejection left by earlier tests
    const { __sendMock } = (await import("googleapis")) as never as { __sendMock: jest.Mock };
    __sendMock.mockReset();
    __sendMock.mockResolvedValue({ data: { id: "gmail-msg-id", threadId: "gmail-thread-id" } });
  });

  async function sendAndReadHeaders(fromName: string, toName?: string) {
    const { __sendMock } = (await import("googleapis")) as never as { __sendMock: jest.Mock };
    await new GmailEmailProvider(7).send({
      from: { email: "user@gmail.com", name: fromName },
      message: {
        to: { email: "recipient@test.com", ...(toName !== undefined ? { name: toName } : {}) },
        subject: "Hola",
        html: "<p>x</p>",
      },
    });
    const raw = __sendMock.mock.calls[__sendMock.mock.calls.length - 1][0].requestBody.raw as string;
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const headers = decoded.split("\r\n\r\n")[0].split("\r\n");
    return {
      from: headers.find((h) => h.startsWith("From: ")),
      to: headers.find((h) => h.startsWith("To: ")),
    };
  }

  const b64 = (v: string) => `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;

  it("RFC 2047 encodes non-ASCII display names in From and To", async () => {
    const { from, to } = await sendAndReadHeaders("Made in Casa — Ñoño", "José Peña");
    expect(from).toBe(`From: ${b64("Made in Casa — Ñoño")} <user@gmail.com>`);
    expect(to).toBe(`To: ${b64("José Peña")} <recipient@test.com>`);
  });

  it("escapes quotes and backslashes in ASCII display names", async () => {
    const { from, to } = await sendAndReadHeaders('Ana "La Jefa"', 'Back\\slash "x"');
    expect(from).toBe('From: "Ana \\"La Jefa\\"" <user@gmail.com>');
    expect(to).toBe('To: "Back\\\\slash \\"x\\"" <recipient@test.com>');
  });

  it("strips CR/LF from display names so no header can be injected", async () => {
    const { from } = await sendAndReadHeaders("Evil\r\nBcc: x@y.com");
    expect(from).toBe('From: "Evil Bcc: x@y.com" <user@gmail.com>');
  });

  it("keeps plain names quoted and a bare address when To has no name", async () => {
    const { from, to } = await sendAndReadHeaders("Daniel");
    expect(from).toBe('From: "Daniel" <user@gmail.com>');
    expect(to).toBe("To: recipient@test.com");
  });
});
