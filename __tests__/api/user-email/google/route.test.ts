/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/services/api-session", () => ({
  getCurrentSession: jest.fn(),
}));

jest.mock("@/lib/services/userGmailOAuth", () => ({
  generateUserGmailAuthUrl: jest.fn(),
  GMAIL_OAUTH_STATE_COOKIE: "gmail_oauth_state",
  GMAIL_OAUTH_CALLBACK_PATH: "/api/user-email/google/callback",
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/user-email/google/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { generateUserGmailAuthUrl } from "@/lib/services/userGmailOAuth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>;
const mockGenerateUserGmailAuthUrl = generateUserGmailAuthUrl as jest.MockedFunction<typeof generateUserGmailAuthUrl>;

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error("GET handler returned undefined");
  return response;
}

describe("GET /api/user-email/google", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetCurrentSession.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
    mockGenerateUserGmailAuthUrl.mockResolvedValue("https://accounts.google.com/o/oauth2/auth" as never);
  });

  it("redirects authenticated users to the Gmail OAuth URL", async () => {
    const req = new NextRequest("http://localhost/api/user-email/google");

    const res = await callGet(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/auth");
    expect(mockValidateApiRole).toHaveBeenCalledWith(req, AUTHENTICATED_ROLES);
    expect(mockGenerateUserGmailAuthUrl).toHaveBeenCalledWith("http://localhost:3000", expect.any(String));
  });

  // S3: the Gmail OAuth flow carries a random state stored in a short-lived httpOnly cookie.
  it("stores the OAuth state passed to Google in an httpOnly sameSite=lax cookie", async () => {
    const res = await callGet(new NextRequest("http://localhost/api/user-email/google"));

    const state = mockGenerateUserGmailAuthUrl.mock.calls[0][1] as string;
    expect(state.length).toBeGreaterThanOrEqual(32);
    const cookie = res.cookies.get("gmail_oauth_state");
    expect(cookie?.value).toBe(state);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBeGreaterThan(0);
    expect(cookie?.maxAge).toBeLessThanOrEqual(600);
  });

  it("returns unauthorized when there is no active session", async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null);

    const res = await callGet(new NextRequest("http://localhost/api/user-email/google"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("No autorizado");
  });
});
