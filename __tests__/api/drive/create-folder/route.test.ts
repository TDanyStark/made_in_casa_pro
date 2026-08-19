/** @jest-environment node */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/services/googleDrive", () => ({
  createProjectFolders: jest.fn(),
}));
jest.mock("@/lib/queries/users", () => ({
  getAdminAndLeadershipEmails: jest.fn(),
}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn() }));

import { NextRequest } from "next/server";
import { POST } from "@/api/drive/create-folder/route";
import { validateApiRole } from "@/lib/services/api-auth";
import { createProjectFolders } from "@/lib/services/googleDrive";
import { getAdminAndLeadershipEmails } from "@/lib/queries/users";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

const mockCreateProjectFolders = createProjectFolders as jest.MockedFunction<typeof createProjectFolders>;

async function callPost(body: Record<string, unknown>) {
  const response = await POST(
    new NextRequest("http://localhost/api/drive/create-folder", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/drive/create-folder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1 });
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: "token" }) });
    (decrypt as jest.Mock).mockResolvedValue({ id: 7, email: "creator@test.com", rol_id: 1 });
    (getAdminAndLeadershipEmails as jest.Mock).mockResolvedValue(["admin@test.com"]);
  });

  const body = {
    clientName: "Cliente Uno",
    brandName: "Marca Uno",
    projectTitle: "Proyecto X",
    shareEmails: ["manager@test.com"],
  };

  it("happy path: returns 201 with the created folder data", async () => {
    mockCreateProjectFolders.mockResolvedValue({
      projectFolderId: "folder-1",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-1",
    });

    const response = await callPost(body);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      projectFolderId: "folder-1",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-1",
    });
    expect(mockCreateProjectFolders).toHaveBeenCalledWith({
      clientName: "Cliente Uno",
      brandName: "Marca Uno",
      projectTitle: "Proyecto X",
      shareEmails: ["admin@test.com", "creator@test.com", "manager@test.com"],
    });
  });

  it("partial sharing failure: still returns 201 with folder data plus a safe driveWarning (regression)", async () => {
    // Root cause of the regression this test guards against: createProjectFolders
    // used to let a partial-sharing failure reject the whole promise even though
    // the folder chain was created/found successfully, causing the route to return
    // a 500 and blocking the wizard from ever creating the project.
    mockCreateProjectFolders.mockResolvedValue({
      projectFolderId: "folder-1",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-1",
      driveWarning: {
        code: "DRIVE_ACCESS_SYNC_FAILED",
        message: "No se pudieron sincronizar todos los accesos de Google Drive.",
      },
    });

    const response = await callPost(body);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      projectFolderId: "folder-1",
      projectFolderUrl: "https://drive.google.com/drive/folders/folder-1",
      driveWarning: {
        code: "DRIVE_ACCESS_SYNC_FAILED",
        message: "No se pudieron sincronizar todos los accesos de Google Drive.",
      },
    });
  });

  it("real folder-creation failure: still returns a safe 500 without leaking provider details", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockCreateProjectFolders.mockRejectedValue(new Error("sensitive provider response"));

    const response = await callPost(body);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Error al crear carpetas en Drive");
    expect(json).not.toHaveProperty("detail");
  });
});
