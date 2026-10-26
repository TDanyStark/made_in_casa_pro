/**
 * @jest-environment node
 */
// S4: validateApiRole re-reads is_active and the role from the DB on every API call.
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserConnectedEmailStatus: jest.fn(),
  isGmailConnectionRequired: jest.fn(() => false),
}));

// Overrides the default passthrough mock from jest.setup.ts.
jest.mock("@/lib/services/session-user", () => ({
  getSessionUserState: jest.fn(),
}));

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { UserRole } from "@/lib/definitions";
import { validateApiRole } from "@/lib/services/api-auth";
import { getSessionUserState } from "@/lib/services/session-user";

const mockState = getSessionUserState as jest.Mock;
const req = () => new NextRequest("http://localhost/api/projects");

beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "token" }) });
  (decrypt as jest.Mock).mockResolvedValue({ id: 7, email: "u@test.com", rol_id: UserRole.ADMIN });
});

describe("validateApiRole DB re-read", () => {
  it("authorizes an active user whose DB role is allowed and returns that role", async () => {
    mockState.mockResolvedValue({ is_active: true, rol_id: UserRole.ADMIN });

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result).toEqual({ isAuthorized: true, userRole: UserRole.ADMIN, response: undefined });
    expect(mockState).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("rejects a deactivated user with 401 even if the JWT is still valid", async () => {
    mockState.mockResolvedValue({ is_active: false, rol_id: UserRole.ADMIN });

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.isAuthorized).toBe(false);
    expect(result.userRole).toBe(UserRole.NO_AUTHENTICADO);
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: "No autorizado" });
  });

  it("rejects with 401 when the session user no longer exists", async () => {
    mockState.mockResolvedValue(null);

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.isAuthorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("uses the DB role, not the JWT role, for the role check (demoted admin)", async () => {
    mockState.mockResolvedValue({ is_active: true, rol_id: UserRole.COLABORADOR });

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.isAuthorized).toBe(false);
    expect(result.userRole).toBe(UserRole.COLABORADOR);
    expect(result.response?.status).toBe(403);
  });

  it("uses the DB role when it was promoted after the JWT was issued", async () => {
    (decrypt as jest.Mock).mockResolvedValue({ id: 7, email: "u@test.com", rol_id: UserRole.COLABORADOR });
    mockState.mockResolvedValue({ is_active: true, rol_id: UserRole.ADMIN });

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.isAuthorized).toBe(true);
    expect(result.userRole).toBe(UserRole.ADMIN);
  });

  it("returns 500 without authorizing when the DB lookup fails", async () => {
    mockState.mockRejectedValue(new Error("db down"));

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.isAuthorized).toBe(false);
    expect(result.response?.status).toBe(500);
    expect(await result.response?.json()).toEqual({ error: "Error al validar la sesión" });
  });

  it("does not hit the DB when there is no session cookie (previous behavior)", async () => {
    (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) });

    const result = await validateApiRole(req(), [UserRole.ADMIN]);

    expect(result.response?.status).toBe(401);
    expect(mockState).not.toHaveBeenCalled();
  });
});
