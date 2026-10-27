/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-sourced-project-manager.md — S1, S7

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));

jest.mock("@/lib/queries/projects", () => ({
  addCoManager: jest.fn(),
  removeCoManager: jest.fn(),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST, DELETE } from "@/api/projects/[id]/managers/route";
import { addCoManager, removeCoManager } from "@/lib/queries/projects";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";

const mockAdd = addCoManager as jest.Mock;
const mockRemove = removeCoManager as jest.Mock;
const mockSync = syncProjectDriveAccess as jest.Mock;

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/projects/9/managers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: "9" }) };

describe("/api/projects/[id]/managers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("S1: POST agrega el co-responsable sin darle acceso a Drive", async () => {
    mockAdd.mockResolvedValue(undefined);

    const res = await POST(request("POST", { manager_id: 4 }), params);
    if (!res) throw new Error("POST handler returned undefined");

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });
    expect(mockAdd).toHaveBeenCalledWith(9, 4);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("S7: POST sin manager_id sigue respondiendo 400 sin escribir", async () => {
    const res = await POST(request("POST", {}), params);
    if (!res) throw new Error("POST handler returned undefined");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "manager_id requerido" });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("S7: DELETE quita el co-responsable igual que antes", async () => {
    mockRemove.mockResolvedValue(undefined);

    const res = await DELETE(request("DELETE", { manager_id: 4 }), params);
    if (!res) throw new Error("DELETE handler returned undefined");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockRemove).toHaveBeenCalledWith(9, 4);
    expect(mockSync).not.toHaveBeenCalled();
  });
});
