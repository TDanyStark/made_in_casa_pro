/**
 * @jest-environment node
 */
// S2: GET /api/settings/google stores a random OAuth state in a short-lived httpOnly cookie.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn(),
}));

const mockGenerateAuthUrl = jest.fn();
jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({ generateAuthUrl: mockGenerateAuthUrl })),
    },
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/settings/google/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getAppSettings } from "@/lib/queries/settings";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
  (getAppSettings as jest.Mock).mockResolvedValue({
    google_oauth_client_id: "cid",
    google_oauth_client_secret: "secret",
  });
  mockGenerateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth?x=1");
});

describe("GET /api/settings/google", () => {
  it("redirects to Google with a random state that is also stored in an httpOnly cookie", async () => {
    const req = new NextRequest("http://localhost/api/settings/google");

    const res = await GET(req);

    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/auth?x=1");
    expect(validateApiRole).toHaveBeenCalledWith(req, ADMIN_ONLY_ROLES);

    const state = mockGenerateAuthUrl.mock.calls[0][0].state;
    expect(typeof state).toBe("string");
    expect(state.length).toBeGreaterThanOrEqual(32);

    const cookie = res!.cookies.get("google_drive_oauth_state");
    expect(cookie?.value).toBe(state);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBeGreaterThan(0);
    expect(cookie?.maxAge).toBeLessThanOrEqual(600);
  });

  it("uses a different state on each call", async () => {
    await GET(new NextRequest("http://localhost/api/settings/google"));
    await GET(new NextRequest("http://localhost/api/settings/google"));

    expect(mockGenerateAuthUrl.mock.calls[0][0].state).not.toBe(mockGenerateAuthUrl.mock.calls[1][0].state);
  });

  it("keeps returning 400 when credentials are missing (previous behavior)", async () => {
    (getAppSettings as jest.Mock).mockResolvedValue({});

    const res = await GET(new NextRequest("http://localhost/api/settings/google"));

    expect(res!.status).toBe(400);
    expect(await res!.json()).toEqual({ error: "Guarda el Client ID y Client Secret antes de conectar." });
  });
});
