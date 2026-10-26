/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-session", () => ({
  getCurrentSession: jest.fn(),
}));

jest.mock("@/lib/services/userGmailOAuth", () => ({
  USER_GMAIL_SCOPES: ["https://www.googleapis.com/auth/gmail.send"],
  GMAIL_OAUTH_STATE_COOKIE: "gmail_oauth_state",
  GMAIL_OAUTH_CALLBACK_PATH: "/api/user-email/google/callback",
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

const STATE_COOKIE = "gmail_oauth_state";

function callbackReq(query: string, cookieState: string | null = "s1") {
  const headers: Record<string, string> = {};
  if (cookieState !== null) headers.cookie = `${STATE_COOKIE}=${cookieState}`;
  return new NextRequest(`http://localhost/api/user-email/google/callback?${query}`, { headers });
}

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
    const res = await GET(callbackReq("code=abc&state=s1"));

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

    await GET(callbackReq("code=abc&state=s1"));

    expect(mockCreateUserEmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({ refresh_token: "existing-refresh-token" })
    );
  });

  it("redirects with no_refresh_token when no refresh token is available", async () => {
    oauthClient.getToken.mockResolvedValueOnce({ tokens: { access_token: "access-token" } });

    const res = await GET(callbackReq("code=abc&state=s1"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_error=no_refresh_token");
    expect(mockCreateUserEmailConnection).not.toHaveBeenCalled();
  });

  // S3: state must match the cookie; errors use fixed codes.
  it.each([
    ["missing state cookie", "code=abc&state=s1", null],
    ["missing state param", "code=abc", "s1"],
    ["mismatched state", "code=abc&state=attacker", "s1"],
  ])("rejects %s with invalid_state and stores nothing", async (_label, query, cookie) => {
    const res = await GET(callbackReq(query, cookie));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_error=invalid_state");
    expect(oauthClient.getToken).not.toHaveBeenCalled();
    expect(mockCreateUserEmailConnection).not.toHaveBeenCalled();
    expect(res.cookies.get(STATE_COOKIE)?.maxAge).toBe(0);
  });

  it("clears the state cookie after a successful callback", async () => {
    const res = await GET(callbackReq("code=abc&state=s1"));

    expect(res.cookies.get(STATE_COOKIE)?.value).toBe("");
    expect(res.cookies.get(STATE_COOKIE)?.maxAge).toBe(0);
  });

  it("redirects with a fixed error code, never the internal error message", async () => {
    oauthClient.getToken.mockRejectedValueOnce(new Error("invalid_grant: internal details"));

    const res = await GET(callbackReq("code=abc&state=s1"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_error=oauth_failed");
    expect(mockCreateUserEmailConnection).not.toHaveBeenCalled();
  });

  it("maps an arbitrary Google error param to a fixed code", async () => {
    const res = await GET(callbackReq("error=%3Cscript%3E&state=s1"));

    expect(res.headers.get("location")).toBe("http://localhost:3000/connect-email?email_error=oauth_error");
  });
});
