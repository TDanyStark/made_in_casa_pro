/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-additional-brands.md — S9, S10

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));

jest.mock("@/lib/queries/managers", () => ({
  transferManager: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "session-cookie" }) })),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 77 })),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/managers/[id]/transfer/route";
import { transferManager } from "@/lib/queries/managers";
import { DomainError } from "@/lib/errors";

const mockTransfer = transferManager as jest.Mock;

async function post(body: unknown) {
  const req = new NextRequest("http://localhost/api/managers/2/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req, { params: Promise.resolve({ id: "2" }) });
  if (!res) throw new Error("POST handler returned undefined");
  return res;
}

describe("POST /api/managers/[id]/transfer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("S9: responde 400 con el código y las marcas sin sucesor", async () => {
    mockTransfer.mockRejectedValue(
      new DomainError(
        "BRANDS_WITHOUT_SUCCESSOR",
        "Asigna un nuevo gerente a todas las marcas antes del traslado: Marca A, Marca B"
      )
    );

    const res = await post({ target_client_id: 9 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Asigna un nuevo gerente a todas las marcas antes del traslado: Marca A, Marca B",
      code: "BRANDS_WITHOUT_SUCCESSOR",
    });
  });

  it("S10: devuelve el resultado con followed_projects y sin moved_*", async () => {
    const result = {
      manager: null,
      previous_client_id: 5,
      new_client_id: 9,
      reassigned_brands: 2,
      reassigned_projects: 1,
      followed_projects: 3,
    };
    mockTransfer.mockResolvedValue(result);

    const res = await post({
      target_client_id: 9,
      brand_reassignments: [{ brand_id: 4, new_manager_id: 11 }],
      project_reassignments: [{ project_id: 20, new_manager_id: 12 }],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(mockTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        managerId: 2,
        targetClientId: 9,
        changedBy: 77,
        brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
        projectReassignments: [{ project_id: 20, new_manager_id: 12 }],
      })
    );
  });

  it("mantiene la validación de Zod (400 sin cliente destino)", async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Datos inválidos");
    expect(mockTransfer).not.toHaveBeenCalled();
  });
});
