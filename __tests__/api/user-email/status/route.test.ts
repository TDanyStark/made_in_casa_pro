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

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserEmailConnection: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/user-email/status/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>;
const mockGetUserEmailConnection = getUserEmailConnection as jest.MockedFunction<typeof getUserEmailConnection>;

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error("GET handler returned undefined");
  return response;
}

describe("GET /api/user-email/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetCurrentSession.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
  });

  it("returns connected status without exposing tokens", async () => {
    mockGetUserEmailConnection.mockResolvedValue({
      id: 1,
      user_id: 7,
      provider: "gmail",
      email: "gmail-user@test.com",
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_at: null,
      scopes: "gmail.send",
      status: "connected",
      last_error: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });

    const res = await callGet(new NextRequest("http://localhost/api/user-email/status"));
    const data = await res.json();

    expect(data).toEqual({
      connected: true,
      status: "connected",
      email: "gmail-user@test.com",
      last_error: null,
      updated_at: "2026-01-01",
    });
    expect(JSON.stringify(data)).not.toContain("refresh-token");
  });

  it("returns disconnected status when there is no connection", async () => {
    mockGetUserEmailConnection.mockResolvedValue(null);

    const res = await callGet(new NextRequest("http://localhost/api/user-email/status"));
    const data = await res.json();

    expect(data.connected).toBe(false);
    expect(data.status).toBe("disconnected");
  });
});
