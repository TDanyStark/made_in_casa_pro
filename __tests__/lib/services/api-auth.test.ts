/**
 * @jest-environment node
 */

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserConnectedEmailStatus: jest.fn(),
  isGmailConnectionRequired: jest.fn(),
}));

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { UserRole } from "@/lib/definitions";
import { validateApiRole } from "@/lib/services/api-auth";
import { getUserConnectedEmailStatus, isGmailConnectionRequired } from "@/lib/queries/userEmailConnections";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockGetUserConnectedEmailStatus = getUserConnectedEmailStatus as jest.MockedFunction<typeof getUserConnectedEmailStatus>;
const mockIsGmailConnectionRequired = isGmailConnectionRequired as jest.MockedFunction<typeof isGmailConnectionRequired>;

describe("validateApiRole Gmail guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "session-token" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: UserRole.ADMIN } as never);
    mockIsGmailConnectionRequired.mockReturnValue(true);
    mockGetUserConnectedEmailStatus.mockResolvedValue(true);
  });

  it("blocks protected API routes when Gmail is required and not connected", async () => {
    mockGetUserConnectedEmailStatus.mockResolvedValueOnce(false);

    const result = await validateApiRole(
      new NextRequest("http://localhost/api/projects"),
      [UserRole.ADMIN]
    );

    expect(result.isAuthorized).toBe(false);
    expect(result.response?.status).toBe(428);
    expect(await result.response?.json()).toEqual({ error: "Debes conectar Gmail para continuar" });
  });

  it("allows user-email API routes without checking Gmail status", async () => {
    const result = await validateApiRole(
      new NextRequest("http://localhost/api/user-email/status"),
      [UserRole.ADMIN]
    );

    expect(result.isAuthorized).toBe(true);
    expect(mockGetUserConnectedEmailStatus).not.toHaveBeenCalled();
  });

  it("allows settings API routes so admins can configure OAuth before Gmail is connected", async () => {
    const result = await validateApiRole(
      new NextRequest("http://localhost/api/settings"),
      [UserRole.ADMIN]
    );

    expect(result.isAuthorized).toBe(true);
    expect(mockGetUserConnectedEmailStatus).not.toHaveBeenCalled();
  });

  it("skips the Gmail guard when REQUIRE_GMAIL_CONNECTION is disabled", async () => {
    mockIsGmailConnectionRequired.mockReturnValueOnce(false);

    const result = await validateApiRole(
      new NextRequest("http://localhost/api/projects"),
      [UserRole.ADMIN]
    );

    expect(result.isAuthorized).toBe(true);
    expect(mockGetUserConnectedEmailStatus).not.toHaveBeenCalled();
  });
});
