/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectDetail: jest.fn(),
  updateProject: jest.fn(),
}));

jest.mock("@/lib/queries/users", () => ({
  getAdminAndLeadershipEmails: jest.fn(),
}));

jest.mock("@/lib/services/googleDrive", () => ({
  createProjectFolders: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/api/projects/[id]/drive/recreate/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectDetail, updateProject } from "@/lib/queries/projects";
import { getAdminAndLeadershipEmails } from "@/lib/queries/users";
import { createProjectFolders } from "@/lib/services/googleDrive";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import type { ProjectDetailType } from "@/lib/definitions";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectDetail = getProjectDetail as jest.MockedFunction<typeof getProjectDetail>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;
const mockGetAdminAndLeadershipEmails = getAdminAndLeadershipEmails as jest.MockedFunction<
  typeof getAdminAndLeadershipEmails
>;
const mockCreateProjectFolders = createProjectFolders as jest.MockedFunction<typeof createProjectFolders>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

const baseProject = {
  id: 15,
  title: "Campaña Verano",
  brand_id: 2,
  brand_name: "Marca X",
  manager_id: 3,
  manager_name: "Manager",
  client_id: 1,
  client_name: "Cliente Uno",
  campaign_id: null,
  campaign_name: null,
  product_id: null,
  product_name: null,
  product_category_name: null,
  drive_folder_id: null,
  drive_folder_url: null,
  notes: null,
  ideal_delivery_at: null,
  oc: null,
  billing_closed_at: null,
  status: "active",
  progress: 0,
  created_by: null,
  created_by_name: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  co_managers: [],
} as unknown as ProjectDetailType;

async function callPost(id = "15") {
  const response = await POST(
    new NextRequest(`http://localhost/api/projects/${id}/drive/recreate`, { method: "POST" }),
    { params: Promise.resolve({ id }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/drive/recreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetProjectDetail.mockResolvedValue(baseProject);
    mockGetAdminAndLeadershipEmails.mockResolvedValue(["admin@test.com"]);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
    mockCreateProjectFolders.mockResolvedValue({
      projectFolderId: "folder-123",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-123",
    });
    mockUpdateProject.mockResolvedValue({ ...baseProject } as never);
  });

  it("happy path: creates/finds the folder chain and persists drive_folder_id/url", async () => {
    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      projectFolderId: "folder-123",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-123",
    });
    expect(mockCreateProjectFolders).toHaveBeenCalledWith({
      clientName: "Cliente Uno",
      brandName: "Marca X",
      projectTitle: "Campaña Verano",
      shareEmails: ["admin@test.com", "user@test.com"],
    });
    expect(mockUpdateProject).toHaveBeenCalledWith(
      15,
      {
        drive_folder_id: "folder-123",
        drive_folder_url: "https://drive.google.com/drive/folders/folder-123",
      },
      7
    );
  });

  it("idempotent reuse: persists the same folder returned when it already existed (no duplicate logic at route level)", async () => {
    // createProjectFolders (which delegates to findOrCreateFolder) is responsible for
    // reusing an existing folder instead of duplicating it — the route simply persists
    // whatever id/url it returns, so a "reuse" result is handled identically to a "create" one.
    mockCreateProjectFolders.mockResolvedValue({
      projectFolderId: "existing-folder-456",
      projectFolderUrl: "https://drive.google.com/drive/folders/existing-folder-456",
    });

    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projectFolderId).toBe("existing-folder-456");
    expect(mockCreateProjectFolders).toHaveBeenCalledTimes(1);
    expect(mockUpdateProject).toHaveBeenCalledWith(
      15,
      {
        drive_folder_id: "existing-folder-456",
        drive_folder_url: "https://drive.google.com/drive/folders/existing-folder-456",
      },
      7
    );
  });

  it("creates missing client/brand parent folders on the way (delegated to createProjectFolders)", async () => {
    // The parent-chain creation is implemented inside createProjectFolders/findOrCreateFolder
    // (covered by googleDrive.test.ts). Here we confirm the route always delegates the full
    // client/brand/project names to it, regardless of which levels already exist in Drive.
    await callPost();

    expect(mockCreateProjectFolders).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: baseProject.client_name,
        brandName: baseProject.brand_name,
        projectTitle: baseProject.title,
      })
    );
  });

  it("returns 404 when the project does not exist", async () => {
    mockGetProjectDetail.mockResolvedValue(null);

    const response = await callPost("999");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Proyecto no encontrado" });
    expect(mockCreateProjectFolders).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks PROJECT_EDIT_ROLES", async () => {
    const forbidden = new Response(JSON.stringify({ error: "Acceso prohibido" }), { status: 403 });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: false,
      userRole: 4,
      response: forbidden,
    } as never);

    const response = await callPost();

    expect(response.status).toBe(403);
    expect(mockGetProjectDetail).not.toHaveBeenCalled();
  });

  it("returns 405 for a disallowed HTTP method", async () => {
    const notAllowed = NextResponse.json({ error: "Método GET no permitido" }, { status: 405 });
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: false, response: notAllowed });

    const response = await callPost();

    expect(response.status).toBe(405);
    expect(mockValidateApiRole).not.toHaveBeenCalled();
  });

  it("returns 500 with error/detail when Drive OAuth fails (invalid_grant)", async () => {
    mockCreateProjectFolders.mockRejectedValue(
      new Error("La autorización de Google Drive ha expirado o fue revocada. Reconecta Google Drive en Configuración.")
    );

    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Error al recrear la carpeta en Drive");
    expect(body.detail).toContain("autorización de Google Drive ha expirado");
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });
});
