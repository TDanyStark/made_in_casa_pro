/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-session", () => ({
  getCurrentSession: jest.fn(),
}));

jest.mock("@/lib/services/userGmailOAuth", () => ({
  USER_GMAIL_SCOPES: ["https://www.googleapis.com/auth/gmail.send"],
  createUserGmailOAuthClient: jest.fn(),
  getGoogleAccountEmail: jest.fn(),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  createUserEmailConnection: jest.fn(),
  getUserEmailConnection: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/user-email/google/callback/route";
import { getCurrentSession } from "@/lib/services/api-session";
import { createUserGmailOAuthClient, getGoogleAccountEmail } from "@/lib/services/userGmailOAuth";
import { createUserEmailConnection, getUserEmailConnection } from "@/lib/queries/userEmailConnections";

const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>;
const mockCreateUserGmailOAuthClient = createUserGmailOAuthClient as jest.MockedFunction<typeof createUserGmailOAuthClient>;
const mockGetGoogleAccountEmail = getGoogleAccountEmail as jest.MockedFunction<typeof getGoogleAccountEmail>;
const mockCreateUserEmailConnection = createUserEmailConnection as jest.MockedFunction<typeof createUserEmailConnection>;
const mockGetUserEmailConnection = getUserEmailConnection as jest.MockedFunction<typeof getUserEmailConnection>;

describe("GET /api/user-email/google/callback", () => {
  const oauthClient = {
    getToken: jest.fn(),
    setCredentials: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockGetCurrentSession.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
    mockCreateUserGmailOAuthClient.mockResolvedValue(oauthClient as never);
    mockGetUserEmailConnection.mockResolvedValue(null);
    mockGetGoogleAccountEmail.mockResolvedValue("gmail-user@test.com" as never);
    mockCreateUserEmailConnection.mockResolvedValue({ id: 1 } as never);
    oauthClient.getToken.mockResolvedValue({
      tokens: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expiry_date: 1767225600000,
        id_token: "id-token",
        scope: "https://www.googleapis.com/auth/gmail.send",
      },
    });
  });

  it("stores the Gmail connection and redirects with success", async () => {
    const res = await GET(new NextRequest("http://localhost/api/user-email/google/callback?code=abc"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_success=1");
    expect(oauthClient.getToken).toHaveBeenCalledWith("abc");
    expect(oauthClient.setCredentials).toHaveBeenCalledWith(expect.objectContaining({ access_token: "access-token" }));
    expect(mockCreateUserEmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 7,
        email: "gmail-user@test.com",
        access_token: "access-token",
        refresh_token: "refresh-token",
      })
    );
  });

  it("preserves an existing refresh token when Google does not return a new one", async () => {
    oauthClient.getToken.mockResolvedValueOnce({
      tokens: {
        access_token: "new-access-token",
        expiry_date: 1767225600000,
      },
    });
    mockGetUserEmailConnection.mockResolvedValueOnce({ refresh_token: "existing-refresh-token" } as never);

    await GET(new NextRequest("http://localhost/api/user-email/google/callback?code=abc"));

    expect(mockCreateUserEmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({ refresh_token: "existing-refresh-token" })
    );
  });

  it("redirects with no_refresh_token when no refresh token is available", async () => {
    oauthClient.getToken.mockResolvedValueOnce({ tokens: { access_token: "access-token" } });

    const res = await GET(new NextRequest("http://localhost/api/user-email/google/callback?code=abc"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_error=no_refresh_token");
    expect(mockCreateUserEmailConnection).not.toHaveBeenCalled();
  });
});
