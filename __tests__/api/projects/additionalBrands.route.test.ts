/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-additional-brands.md — S3, S6, S7

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));

jest.mock("@/lib/queries/projects", () => ({
  createProject: jest.fn(),
  getProjectsWithPagination: jest.fn(),
  getProjectDetail: jest.fn(),
  userCanAccessProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn(async () => null),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "session-cookie" }) })),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 77 })),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/route";
import { PATCH } from "@/api/projects/[id]/route";
import { createProject, updateProject } from "@/lib/queries/projects";
import { DomainError } from "@/lib/errors";

const mockCreate = createProject as jest.Mock;
const mockUpdate = updateProject as jest.Mock;

const req = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/projects/10", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function patch(body: unknown) {
  const res = await PATCH(req("PATCH", body), { params: Promise.resolve({ id: "10" }) });
  if (!res) throw new Error("PATCH handler returned undefined");
  return res;
}

async function post(body: unknown) {
  const res = await POST(req("POST", body));
  if (!res) throw new Error("POST handler returned undefined");
  return res;
}

const base = { title: "Proyecto", brand_id: 2, manager_id: 3 };

beforeEach(() => jest.clearAllMocks());

describe("POST /api/projects additional_brand_ids", () => {
  it("forwards the additional brands to createProject", async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    const res = await post({ ...base, additional_brand_ids: [5, "6"] });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ brand_id: 2, additional_brand_ids: [5, 6], created_by: 77 })
    );
  });

  it("rejects non-positive ids with 400 without creating", async () => {
    const res = await post({ ...base, additional_brand_ids: [0] });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Datos de proyecto inválidos");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("maps BRAND_CLIENT_MISMATCH to 400 with its code", async () => {
    mockCreate.mockRejectedValue(
      new DomainError("BRAND_CLIENT_MISMATCH", "Todas las marcas del proyecto deben pertenecer al mismo cliente")
    );

    const res = await post({ ...base, additional_brand_ids: [5] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Todas las marcas del proyecto deben pertenecer al mismo cliente",
      code: "BRAND_CLIENT_MISMATCH",
    });
  });
});

describe("PATCH /api/projects/[id] additional_brand_ids", () => {
  it("forwards the full set, including an empty list", async () => {
    mockUpdate.mockResolvedValue({ id: 10 });

    const res = await patch({ additional_brand_ids: [] });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(10, { additional_brand_ids: [] }, 77);
  });

  it("rejects a non-array value with 400 without updating", async () => {
    const res = await patch({ additional_brand_ids: 5 });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("maps ADDITIONAL_BRAND_IS_PRINCIPAL to 400 with its code", async () => {
    mockUpdate.mockRejectedValue(
      new DomainError("ADDITIONAL_BRAND_IS_PRINCIPAL", "La marca principal no puede agregarse también como marca adicional")
    );

    const res = await patch({ additional_brand_ids: [2] });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ADDITIONAL_BRAND_IS_PRINCIPAL");
  });
});
