/**
 * @jest-environment node
 */

// S11: only operations roles edit a task through PATCH; GET/PATCH/DELETE answer
// 404 when the task belongs to another project; GET applies project access for
// non-operations roles. S19: a failed quoter-invitation save returns 500 and
// sends no quote.requested.

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  updateProjectTask: jest.fn(),
  deleteProjectTask: jest.fn(),
  resolveProjectTaskAssignment: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  userCanAccessProject: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn() },
}));

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn() }));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {
    TASK_ASSIGNED: "task.assigned",
    TASK_REASSIGNED: "task.reassigned",
    TASK_READY: "task.ready",
    QUOTE_REQUESTED: "quote.requested",
  },
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn().mockResolvedValue(null),
}));

import { NextRequest, NextResponse } from "next/server";
import { DELETE, GET, PATCH } from "@/api/projects/[id]/tasks/[tid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { deleteProjectTask, getProjectTaskById, updateProjectTask } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const mockValidateApiRole = validateApiRole as jest.Mock;
const mockGetTask = getProjectTaskById as jest.Mock;
const mockUpdate = updateProjectTask as jest.Mock;
const mockDelete = deleteProjectTask as jest.Mock;
const mockCanAccess = userCanAccessProject as jest.Mock;
const mockTransaction = db.transaction as jest.Mock;
const mockDispatch = dispatchNotification as jest.Mock;

const task = {
  id: 10,
  project_id: 15,
  title: "Banner",
  area_id: null,
  assigned_user_id: 4,
  assign_to_commercial: 0,
  requires_quote: 0,
  status: "not_started",
  task_type: "execution",
  task_flag: "new",
};

/** Behaves like the real role check: authorizes only when the role is allowed. */
function actAs(role: number, userId: number) {
  mockValidateApiRole.mockImplementation(async (_req: unknown, roles: readonly number[]) =>
    roles.includes(role)
      ? { isAuthorized: true, userRole: role, response: undefined }
      : { isAuthorized: false, userRole: role, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  );
  (decrypt as jest.Mock).mockResolvedValue({ id: userId, rol_id: role });
}

const ctx = (id = "15") => ({ params: Promise.resolve({ id, tid: "10" }) });

function request(method: string, body?: unknown, project = "15") {
  return new NextRequest(`http://localhost/api/projects/${project}/tasks/10`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function expectNoMutation() {
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockTransaction).not.toHaveBeenCalled();
  expect(recalculateProgressAndNotify).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) });
  mockGetTask.mockResolvedValue(task);
  mockUpdate.mockResolvedValue(task);
  mockDelete.mockResolvedValue([]);
});

describe("PATCH /api/projects/[id]/tasks/[tid] — operations roles only", () => {
  it("requires an operations role", async () => {
    actAs(1, 3);
    await PATCH(request("PATCH", { title: "Otro" }), ctx());
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), OPERATIONS_ROLES);
  });

  it.each([
    [{ title: "Otro" }],
    [{ assigned_user_id: 9 }],
    [{ status: "paused" }],
    [{ quoter_ids: [12] }],
  ])("rejects a COLABORADOR (even the assignee) editing %j and changes nothing", async (body) => {
    actAs(4, 4);
    mockGetTask.mockResolvedValue({ ...task, status: "in_progress" });

    const res = (await PATCH(request("PATCH", body), ctx()))!;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No autorizado" });
    expectNoMutation();
  });

  it("lets an operations role edit a task of the URL project (previous behavior)", async () => {
    actAs(3, 3);
    const res = (await PATCH(request("PATCH", { title: "Otro" }), ctx()))!;
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(10, { title: "Otro" }, 3);
  });

  it("returns 404 and changes nothing when the task belongs to another project", async () => {
    actAs(1, 3);
    mockGetTask.mockResolvedValue({ ...task, project_id: 99 });

    const res = (await PATCH(request("PATCH", { title: "Otro", quoter_ids: [12] }), ctx()))!;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tarea no encontrada" });
    expectNoMutation();
  });
});

// S19 + S36: invitations are written by updateProjectTask in the task's own
// transaction; the route never writes them separately.
describe("PATCH /api/projects/[id]/tasks/[tid] — quoter invitations (S19, S36)", () => {
  it("returns 500 and sends no quote.requested when the task + invitations transaction fails", async () => {
    actAs(1, 3);
    mockUpdate.mockRejectedValue(new Error("insert failed"));

    const res = (await PATCH(request("PATCH", { title: "Otro", quoter_ids: [12] }), ctx()))!;

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al actualizar tarea" });
    expect(mockUpdate).toHaveBeenCalledWith(10, { title: "Otro" }, 3, { quoterIds: [12] });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("passes the invitations to the task update and sends quote.requested when it succeeds (previous behavior)", async () => {
    actAs(1, 3);

    const res = (await PATCH(request("PATCH", { quoter_ids: [12] }), ctx()))!;

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(10, {}, 3, { quoterIds: [12] });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ eventType: "quote.requested", inviteeUserId: 12 }));
  });
});

describe("DELETE /api/projects/[id]/tasks/[tid] — task must belong to the URL project", () => {
  it("returns 404 and deletes nothing when the task belongs to another project", async () => {
    actAs(1, 3);
    mockGetTask.mockResolvedValue({ ...task, project_id: 99 });

    const res = (await DELETE(request("DELETE"), ctx()))!;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tarea no encontrada" });
    expectNoMutation();
  });

  it("returns 404 and deletes nothing when the task does not exist", async () => {
    actAs(1, 3);
    mockGetTask.mockResolvedValue(null);

    const res = (await DELETE(request("DELETE"), ctx()))!;

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes a task of the URL project (previous behavior)", async () => {
    actAs(1, 3);
    const res = (await DELETE(request("DELETE"), ctx()))!;
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(10);
  });
});

describe("GET /api/projects/[id]/tasks/[tid] — project scope and access", () => {
  it("returns 404 when the task belongs to another project", async () => {
    actAs(1, 3);
    mockGetTask.mockResolvedValue({ ...task, project_id: 99 });

    const res = (await GET(request("GET"), ctx()))!;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tarea no encontrada" });
  });

  it("returns 403 for a COLABORADOR without access to the project", async () => {
    actAs(4, 50);
    mockCanAccess.mockResolvedValue(false);

    const res = (await GET(request("GET"), ctx()))!;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No tienes acceso a este proyecto" });
    expect(mockCanAccess).toHaveBeenCalledWith(15, 50, 4);
  });

  it("returns the task to a COLABORADOR with access to the project", async () => {
    actAs(4, 4);
    mockCanAccess.mockResolvedValue(true);

    const res = (await GET(request("GET"), ctx()))!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(task);
  });

  it("returns the task to an operations role without the access lookup (previous behavior)", async () => {
    actAs(2, 3);

    const res = (await GET(request("GET"), ctx()))!;

    expect(res.status).toBe(200);
    expect(mockCanAccess).not.toHaveBeenCalled();
  });
});
