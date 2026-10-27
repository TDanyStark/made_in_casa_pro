/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-owned-project-manager.md — S1
// Spec: odd/tasks/brand-sourced-project-manager.md — S1

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));

jest.mock("@/lib/queries/brands", () => ({
  getBrandById: jest.fn(),
  updateBrand: jest.fn(),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "session-cookie" }) })),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 77 })),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/api/brands/[id]/route";
import { getBrandById, updateBrand } from "@/lib/queries/brands";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";
import { DomainError } from "@/lib/errors";

const mockGetBrand = getBrandById as jest.Mock;
const mockUpdate = updateBrand as jest.Mock;
const mockSync = syncProjectDriveAccess as jest.Mock;

const BRAND = { id: 5, name: "Nulytelly", manager_id: 10, client_id: 2 };

async function patch(body: unknown) {
  const req = new NextRequest("http://localhost/api/brands/5", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "5" }) });
  if (!res) throw new Error("PATCH handler returned undefined");
  return res;
}

describe("PATCH /api/brands/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetBrand.mockResolvedValue(BRAND);
  });

  it("S1: informa los proyectos que pasaron al nuevo gerente sin sincronizar Drive", async () => {
    mockUpdate.mockResolvedValue({
      brand: { ...BRAND, manager_id: 20 },
      reassignedProjectIds: [20, 21],
    });

    const res = await patch({ manager_id: 20 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...BRAND,
      manager_id: 20,
      reassigned_projects: 2,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      "5",
      { name: undefined, manager_id: 20, business_unit_id: undefined },
      77
    );
    // Los gerentes no reciben acceso a Drive (odd/tasks/brand-sourced-project-manager.md S1)
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("no sincroniza Drive cuando ningún proyecto cambió de gerente", async () => {
    mockUpdate.mockResolvedValue({ brand: { ...BRAND, name: "Nuevo" }, reassignedProjectIds: [] });

    const res = await patch({ name: "Nuevo" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...BRAND, name: "Nuevo", reassigned_projects: 0 });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("mantiene la traducción de DomainError a 400", async () => {
    mockUpdate.mockRejectedValue(
      new DomainError("MANAGER_CLIENT_MISMATCH", "El gerente pertenece a otro cliente.")
    );

    const res = await patch({ manager_id: 30 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "El gerente pertenece a otro cliente.",
      code: "MANAGER_CLIENT_MISMATCH",
    });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("mantiene el 404 cuando la marca no existe", async () => {
    mockGetBrand.mockResolvedValue(null);

    const res = await patch({ manager_id: 20 });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "La marca no existe" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
