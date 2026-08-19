/** @jest-environment node */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
  userCanAccessProject: jest.fn(),
}));
jest.mock("@/lib/services/googleDrive", () => ({
  listDriveFolderPermissions: jest.fn(),
  addDriveFolderPermission: jest.fn(),
  deleteDriveFolderPermission: jest.fn(),
}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn() }));

import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/api/projects/[id]/drive/permissions/route";
import { validateApiRole } from "@/lib/services/api-auth";
import { getProjectById, userCanAccessProject } from "@/lib/queries/projects";
import { addDriveFolderPermission, deleteDriveFolderPermission, listDriveFolderPermissions } from "@/lib/services/googleDrive";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

const params = { params: Promise.resolve({ id: "12" }) };

describe("project Drive permissions route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1 });
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: "token" }) });
    (decrypt as jest.Mock).mockResolvedValue({ id: 7, rol_id: 1 });
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);
    (getProjectById as jest.Mock).mockResolvedValue({ id: 12, drive_folder_id: "folder-12" });
  });

  it("lists the real Drive ACL for an authorized project viewer", async () => {
    const data = { canShare: true, permissions: [{ id: "p1", type: "user", role: "writer" }] };
    (listDriveFolderPermissions as jest.Mock).mockResolvedValue(data);
    const response = await GET(new NextRequest("http://localhost/api/projects/12/drive/permissions"), params);
    if (!response) throw new Error("GET handler returned undefined");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
    expect(listDriveFolderPermissions).toHaveBeenCalledWith("folder-12");
  });

  it("adds a validated reader permission using the server-side folder id", async () => {
    const response = await POST(new NextRequest("http://localhost/api/projects/12/drive/permissions", {
      method: "POST",
      body: JSON.stringify({ email: "Person@Example.com", role: "reader", folderId: "untrusted" }),
    }), params);
    if (!response) throw new Error("POST handler returned undefined");
    expect(response.status).toBe(201);
    expect(addDriveFolderPermission).toHaveBeenCalledWith("folder-12", "Person@Example.com", "reader");
  });

  it("deletes by permission id and rejects project access failures", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/projects/12/drive/permissions", {
      method: "DELETE",
      body: JSON.stringify({ permissionId: "p1" }),
    }), params);
    if (!response) throw new Error("DELETE handler returned undefined");
    expect(response.status).toBe(200);
    expect(deleteDriveFolderPermission).toHaveBeenCalledWith("folder-12", "p1");

    (userCanAccessProject as jest.Mock).mockResolvedValue(false);
    const forbidden = await GET(new NextRequest("http://localhost/api/projects/12/drive/permissions"), params);
    if (!forbidden) throw new Error("GET handler returned undefined");
    expect(forbidden.status).toBe(403);
  });

  it("does not expose provider error details", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (listDriveFolderPermissions as jest.Mock).mockRejectedValue(new Error("sensitive provider response"));
    const response = await GET(new NextRequest("http://localhost/api/projects/12/drive/permissions"), params);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "No se pudo completar la operación en Google Drive" });
  });
});
