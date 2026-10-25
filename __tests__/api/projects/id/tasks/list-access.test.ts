/**
 * @jest-environment node
 */
// S11: the project task list is only visible to non-operations roles with access to the project.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getTasksByProject: jest.fn(),
  createProjectTask: jest.fn(),
  resolveProjectTaskAssignment: jest.fn(),
}));
jest.mock("@/lib/queries/projects", () => ({
  userCanAccessProject: jest.fn(),
}));
jest.mock("@/lib/queries/adjustments", () => ({
  resolveTaskAdjustmentId: jest.fn(),
  assertLatestTaskVersion: jest.fn(),
}));
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
import { GET } from "@/api/projects/[id]/tasks/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTasksByProject } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";

const mockRole = validateApiRole as jest.Mock;
const tasks = [{ id: 1, project_id: 12 }];

const callGet = (query = "") =>
  GET(new NextRequest(`http://localhost/api/projects/12/tasks${query}`), {
    params: Promise.resolve({ id: "12" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (getTasksByProject as jest.Mock).mockResolvedValue(tasks);
});

describe("GET /api/projects/[id]/tasks access", () => {
  it("returns the tasks to an operations role without the access lookup (previous behavior)", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 3, response: undefined });

    const res = (await callGet("?adjustment_id=4"))!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(tasks);
    expect(getTasksByProject).toHaveBeenCalledWith(12, 4);
    expect(userCanAccessProject).not.toHaveBeenCalled();
  });

  it("returns 403 and reads no tasks for a COLABORADOR without access", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(false);

    const res = (await callGet())!;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No tienes acceso a este proyecto" });
    expect(userCanAccessProject).toHaveBeenCalledWith(12, 21, 4);
    expect(getTasksByProject).not.toHaveBeenCalled();
  });

  it("returns the tasks to a COLABORADOR with access", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);

    const res = (await callGet())!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(tasks);
  });
});
