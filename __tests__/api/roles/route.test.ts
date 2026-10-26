/**
 * @jest-environment node
 */
// S1: /api/roles validates method and role; POST is admin-only with a Zod body.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/roles", () => ({
  getRoles: jest.fn(),
  createRole: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/api/roles/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createRole, getRoles } from "@/lib/queries/roles";
import { ADMIN_ONLY_ROLES, AUTHENTICATED_ROLES } from "@/lib/role-groups";

const mockMethod = validateHttpMethod as jest.Mock;
const mockRole = validateApiRole as jest.Mock;
const mockGetRoles = getRoles as jest.Mock;
const mockCreateRole = createRole as jest.Mock;

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMethod.mockReturnValue({ isValidMethod: true, response: undefined });
  mockRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
});

describe("GET /api/roles", () => {
  it("returns the role rows for an authenticated user (previous behavior)", async () => {
    mockGetRoles.mockResolvedValue({ rows: [{ id: 1, role: "Admin" }] });
    const req = new NextRequest("http://localhost/api/roles");

    const res = await GET(req);

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual([{ id: 1, role: "Admin" }]);
    expect(mockMethod).toHaveBeenCalledWith(req, ["GET"]);
    expect(mockRole).toHaveBeenCalledWith(req, AUTHENTICATED_ROLES);
  });

  it("returns the auth response and does not query when the role check fails", async () => {
    mockRole.mockResolvedValue({
      isAuthorized: false,
      userRole: 0,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    });

    const res = await GET(new NextRequest("http://localhost/api/roles"));

    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "No autorizado" });
    expect(mockGetRoles).not.toHaveBeenCalled();
  });
});

describe("POST /api/roles", () => {
  it("creates a role when an admin sends a valid body", async () => {
    mockCreateRole.mockResolvedValue({ rows: [{ id: 9 }] });
    const req = postReq({ role: "Auditor" });

    const res = await POST(req);

    expect(res!.status).toBe(201);
    expect(await res!.json()).toEqual({ message: "Rol creado exitosamente", id: 9 });
    expect(mockMethod).toHaveBeenCalledWith(req, ["POST"]);
    expect(mockRole).toHaveBeenCalledWith(req, ADMIN_ONLY_ROLES);
    expect(mockCreateRole).toHaveBeenCalledWith("Auditor");
  });

  it("returns 403 and does not create when the user is not admin", async () => {
    mockRole.mockResolvedValue({
      isAuthorized: false,
      userRole: 4,
      response: NextResponse.json({ error: "Acceso prohibido" }, { status: 403 }),
    });

    const res = await POST(postReq({ role: "Auditor" }));

    expect(res!.status).toBe(403);
    expect(mockCreateRole).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ role: "" }], [{ role: "   " }], [{ role: 5 }], ["not-json"]])(
    "returns 400 { error } and does not create for invalid body %p",
    async (body) => {
      const res = await POST(postReq(body));

      expect(res!.status).toBe(400);
      expect(await res!.json()).toEqual({ error: "El nombre del rol es obligatorio" });
      expect(mockCreateRole).not.toHaveBeenCalled();
    }
  );
});
