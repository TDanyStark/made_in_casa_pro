/**
 * @jest-environment node
 */
// S5: task history is only visible to non-operations roles with access to the task's project.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getTaskTransitions: jest.fn(),
  getProjectTaskById: jest.fn(),
}));
jest.mock("@/lib/queries/projects", () => ({
  userCanAccessProject: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 21, rol_id: 4 })),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/projects/[id]/tasks/[tid]/history/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, getTaskTransitions } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";

const mockRole = validateApiRole as jest.Mock;
const transitions = [{ id: 1, from_status: "pending", to_status: "in_progress" }];

// The UI calls this endpoint with project id 0, so access is checked against the task's project.
const callGet = () =>
  GET(new NextRequest("http://localhost/api/projects/0/tasks/5/history"), {
    params: Promise.resolve({ id: "0", tid: "5" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (getTaskTransitions as jest.Mock).mockResolvedValue(transitions);
  (getProjectTaskById as jest.Mock).mockResolvedValue({ id: 5, project_id: 12 });
});

describe("GET /api/projects/[id]/tasks/[tid]/history", () => {
  it("returns the history to an operations role (previous behavior)", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });

    const res = await callGet();

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual(transitions);
    expect(getTaskTransitions).toHaveBeenCalledWith(5);
    expect(userCanAccessProject).not.toHaveBeenCalled();
  });

  it("returns 403 to a collaborator without access to the task's project", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(false);

    const res = await callGet();

    expect(res!.status).toBe(403);
    expect(await res!.json()).toEqual({ error: "No tienes acceso a este proyecto" });
    expect(userCanAccessProject).toHaveBeenCalledWith(12, 21, 4);
    expect(getTaskTransitions).not.toHaveBeenCalled();
  });

  it("returns the history to a collaborator with access", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);

    const res = await callGet();

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual(transitions);
  });

  it("returns 404 to a collaborator when the task does not exist", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (getProjectTaskById as jest.Mock).mockResolvedValue(null);

    const res = await callGet();

    expect(res!.status).toBe(404);
    expect(await res!.json()).toEqual({ error: "Tarea no encontrada" });
    expect(getTaskTransitions).not.toHaveBeenCalled();
  });
});
