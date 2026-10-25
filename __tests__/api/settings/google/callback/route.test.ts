/**
 * @jest-environment node
 */
// S2: the Drive OAuth callback requires ADMIN_ONLY_ROLES and a state matching the cookie.
jest.mock("@/lib/services/api-auth", () => ({
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn(),
  upsertSettings: jest.fn(),
}));

const mockGetToken = jest.fn();
jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({ getToken: mockGetToken })),
    },
  },
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/api/settings/google/callback/route";
import { validateApiRole } from "@/lib/services/api-auth";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";

const COOKIE = "google_drive_oauth_state";
const APP = "http://localhost:3000";

function callbackReq(query: string, cookieState?: string) {
  const headers: Record<string, string> = {};
  if (cookieState !== undefined) headers.cookie = `${COOKIE}=${cookieState}`;
  return new NextRequest(`http://localhost/api/settings/google/callback?${query}`, { headers });
}

function expectCookieCleared(res: NextResponse) {
  const cookie = res.cookies.get(COOKIE);
  expect(cookie?.value).toBe("");
  expect(cookie?.maxAge).toBe(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = APP;
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
  (getAppSettings as jest.Mock).mockResolvedValue({
    google_oauth_client_id: "cid",
    google_oauth_client_secret: "secret",
  });
  mockGetToken.mockResolvedValue({ tokens: { refresh_token: "refresh" } });
});

describe("GET /api/settings/google/callback", () => {
  it("saves the refresh token when the state matches the cookie (previous behavior)", async () => {
    const req = callbackReq("code=abc&state=s1", "s1");

    const res = await GET(req);

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_success=1`);
    expect(validateApiRole).toHaveBeenCalledWith(req, ADMIN_ONLY_ROLES);
    expect(mockGetToken).toHaveBeenCalledWith("abc");
    expect(upsertSettings).toHaveBeenCalledWith({
      google_oauth_refresh_token: "refresh",
      google_oauth_connected_email: null,
    });
    expectCookieCleared(res);
  });

  it("rejects a non-admin with a fixed error code and saves nothing", async () => {
    (validateApiRole as jest.Mock).mockResolvedValue({
      isAuthorized: false,
      userRole: 4,
      response: NextResponse.json({ error: "Acceso prohibido" }, { status: 403 }),
    });

    const res = await GET(callbackReq("code=abc&state=s1", "s1"));

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_error=forbidden`);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(upsertSettings).not.toHaveBeenCalled();
    expectCookieCleared(res);
  });

  it.each([
    ["missing state cookie", "code=abc&state=s1", undefined],
    ["missing state param", "code=abc", "s1"],
    ["mismatched state", "code=abc&state=attacker", "s1"],
  ])("rejects %s with invalid_state and saves nothing", async (_label, query, cookie) => {
    const res = await GET(callbackReq(query, cookie));

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_error=invalid_state`);
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(upsertSettings).not.toHaveBeenCalled();
    expectCookieCleared(res);
  });

  it("never puts the internal error message in the redirect URL", async () => {
    mockGetToken.mockRejectedValue(new Error("invalid_grant: secret internals"));

    const res = await GET(callbackReq("code=abc&state=s1", "s1"));

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_error=oauth_failed`);
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  it("maps an arbitrary Google error param to a fixed code", async () => {
    const res = await GET(callbackReq("error=%3Cscript%3E&state=s1", "s1"));

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_error=oauth_error`);
  });

  it("keeps access_denied from Google", async () => {
    const res = await GET(callbackReq("error=access_denied&state=s1", "s1"));

    expect(res.headers.get("location")).toBe(`${APP}/settings?google_error=access_denied`);
  });
});
