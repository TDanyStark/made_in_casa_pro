/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-owned-project-manager.md — S1

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
const WARNING = {
  code: "DRIVE_ACCESS_SYNC_FAILED",
  message: "No se pudieron sincronizar todos los accesos de Google Drive.",
};

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

  it("S1: informa los proyectos que pasaron al nuevo gerente y re-sincroniza su Drive", async () => {
    mockUpdate.mockResolvedValue({
      brand: { ...BRAND, manager_id: 20 },
      reassignedProjectIds: [20, 21],
    });
    mockSync.mockResolvedValue(null);

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
    expect(mockSync.mock.calls).toEqual([[20], [21]]);
  });

  it("S1: un fallo de Drive no bloquea el cambio: responde 200 con driveWarning", async () => {
    mockUpdate.mockResolvedValue({
      brand: { ...BRAND, manager_id: 20 },
      reassignedProjectIds: [20, 21, 22],
    });
    mockSync
      .mockResolvedValueOnce(WARNING)
      .mockRejectedValueOnce(new Error("drive down"))
      .mockResolvedValueOnce(null);

    const res = await patch({ manager_id: 20 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...BRAND,
      manager_id: 20,
      reassigned_projects: 3,
      driveWarning: WARNING,
    });
    // Sigue sincronizando el resto de proyectos tras un fallo
    expect(mockSync).toHaveBeenCalledTimes(3);
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
