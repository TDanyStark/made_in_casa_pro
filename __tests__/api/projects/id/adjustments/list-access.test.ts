/**
 * @jest-environment node
 */
// S11: the adjustments list is only visible to non-operations roles with access to the project.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
  userCanAccessProject: jest.fn(),
}));
jest.mock("@/lib/queries/adjustments", () => ({
  createProjectAdjustment: jest.fn(),
  getAdjustmentsByProject: jest.fn(),
  resolveTaskAdjustmentId: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({ findLeastLoadedInternalCollaborator: jest.fn() }));
jest.mock("@/lib/services/googleDrive", () => ({ createSubFolder: jest.fn() }));
jest.mock("@/lib/queries/users", () => ({ getAdminAndLeadershipEmails: jest.fn() }));
jest.mock("@/lib/db", () => ({ db: { execute: jest.fn(), transaction: jest.fn() } }));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 21, rol_id: 4 })),
}));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {},
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
}));
jest.mock("@/lib/services/projectDriveAccess", () => ({ syncProjectDriveAccess: jest.fn() }));

import { NextRequest } from "next/server";
import { GET } from "@/api/projects/[id]/adjustments/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { userCanAccessProject } from "@/lib/queries/projects";

const mockRole = validateApiRole as jest.Mock;
const adjustments = [{ id: 1, project_id: 12, version_number: 1 }];

const callGet = () =>
  GET(new NextRequest("http://localhost/api/projects/12/adjustments"), {
    params: Promise.resolve({ id: "12" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (getAdjustmentsByProject as jest.Mock).mockResolvedValue(adjustments);
});

describe("GET /api/projects/[id]/adjustments access", () => {
  it("returns the adjustments to an operations role without the access lookup (previous behavior)", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });

    const res = (await callGet())!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(adjustments);
    expect(userCanAccessProject).not.toHaveBeenCalled();
  });

  it("returns 403 and reads nothing for a COLABORADOR without access", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(false);

    const res = (await callGet())!;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No tienes acceso a este proyecto" });
    expect(userCanAccessProject).toHaveBeenCalledWith(12, 21, 4);
    expect(getAdjustmentsByProject).not.toHaveBeenCalled();
  });

  it("returns the adjustments to a COLABORADOR with access", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);

    const res = (await callGet())!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(adjustments);
  });
});
