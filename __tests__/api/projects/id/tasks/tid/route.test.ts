/**
 * @jest-environment node
 */

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
  recalculateProjectProgress: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

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

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/api/projects/[id]/tasks/[tid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  deleteProjectTask,
  getProjectTaskById,
  resolveProjectTaskAssignment,
  updateProjectTask,
} from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockResolveProjectTaskAssignment = resolveProjectTaskAssignment as jest.MockedFunction<typeof resolveProjectTaskAssignment>;
const mockUpdateProjectTask = updateProjectTask as jest.MockedFunction<typeof updateProjectTask>;
const mockDeleteProjectTask = deleteProjectTask as jest.MockedFunction<typeof deleteProjectTask>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const mockRecalcAndNotify = recalculateProgressAndNotify as jest.MockedFunction<typeof recalculateProgressAndNotify>;

const existingTask = {
  id: 10,
  project_id: 15,
  title: "Diseño de banner",
  description: null,
  area_id: null,
  assigned_user_id: 4,
  assign_to_commercial: 0,
  requires_quote: 0,
  status: "not_started",
  task_type: "execution",
  task_flag: "new",
};

async function callPatch(body: Record<string, unknown>, query = "") {
  const response = await PATCH(new NextRequest(`http://localhost/api/projects/15/tasks/10${query}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }), {
    params: Promise.resolve({ id: "15", tid: "10" }),
  });
  if (!response) throw new Error("PATCH handler returned undefined");
  return response;
}

describe("PATCH /api/projects/[id]/tasks/[tid] reassignment notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetProjectTaskById.mockResolvedValue(existingTask as never);
    mockResolveProjectTaskAssignment.mockResolvedValue(5);
    mockUpdateProjectTask.mockResolvedValue({ ...existingTask, assigned_user_id: 5 } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("dispatches task.reassigned when responsible user changes", async () => {
    const response = await callPatch({ assigned_user_id: 5 });

    expect(response.status).toBe(200);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "task.reassigned",
      actorUserId: 3,
      projectId: 15,
      taskId: 10,
      previousUserId: 4,
      newUserId: 5,
    });
    expect(mockDispatchNotification).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: "task.assigned" }));
  });

  it("dispatches task.assigned when assigning an unassigned task", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, assigned_user_id: null } as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, assigned_user_id: 5 } as never);

    await callPatch({ assigned_user_id: 5 });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "task.assigned",
      actorUserId: 3,
      projectId: 15,
      taskId: 10,
    });
  });
});

describe("PATCH /api/projects/[id]/tasks/[tid] task.ready notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  function eventTypes() {
    return mockDispatchNotification.mock.calls.map(([input]) => input.eventType);
  }

  it("dispatches task.ready when an assigned task moves from waiting to not_started", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "waiting" } as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "not_started" } as never);

    const response = await callPatch({ status: "not_started" });

    expect(response.status).toBe(200);
    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "task.ready",
      actorUserId: 3,
      projectId: 15,
      taskId: 10,
    });
  });

  it("dispatches task.assigned then task.ready when a blocked task gets an assignee and becomes not_started", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "blocked", assigned_user_id: null } as never);
    mockResolveProjectTaskAssignment.mockResolvedValueOnce(5);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "not_started", assigned_user_id: 5 } as never);

    await callPatch({ assigned_user_id: 5, status: "not_started" });

    expect(eventTypes()).toEqual(["task.assigned", "task.ready"]);
  });

  it("?notify=false silences task.reassigned / task.assigned / task.ready but keeps quote.requested", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "waiting" } as never);
    mockResolveProjectTaskAssignment.mockResolvedValueOnce(5);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "not_started", assigned_user_id: 5 } as never);
    const { db } = jest.requireMock("@/lib/db") as { db: { transaction: jest.Mock } };
    db.transaction.mockResolvedValueOnce({
      execute: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    });

    const response = await callPatch({ assigned_user_id: 5, status: "not_started", quoter_ids: [12] }, "?notify=false");

    expect(response.status).toBe(200);
    expect(eventTypes()).toEqual(["quote.requested"]);
    // project.ready_to_close is also silenced in the wizard
    expect(mockRecalcAndNotify).toHaveBeenCalledWith(15, 3, { notify: false });
  });

  it("recalculates progress through the ready-to-close helper when the status changes", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "waiting" } as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "not_started" } as never);

    const response = await callPatch({ status: "not_started" });

    expect(response.status).toBe(200);
    expect(mockRecalcAndNotify).toHaveBeenCalledTimes(1);
    expect(mockRecalcAndNotify).toHaveBeenCalledWith(15, 3, { notify: true });
  });

  it("does not recalculate progress when the status does not change (previous behavior)", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce(existingTask as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, title: "Otro" } as never);

    await callPatch({ title: "Otro" });

    expect(mockRecalcAndNotify).not.toHaveBeenCalled();
  });

  it("rejects an invalid notify value with 400 and updates nothing", async () => {
    const response = await callPatch({ status: "not_started" }, "?notify=0");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Par\u00e1metro notify inv\u00e1lido" });
    expect(mockUpdateProjectTask).not.toHaveBeenCalled();
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it("does not dispatch task.ready when the task was already not_started", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce(existingTask as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, title: "Nuevo t\u00edtulo" } as never);

    await callPatch({ title: "Nuevo t\u00edtulo" });

    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it("does not dispatch task.ready when the task becomes not_started without an assignee, or moves to waiting/blocked", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "waiting", assigned_user_id: null } as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "not_started", assigned_user_id: null } as never);
    await callPatch({ status: "not_started" });

    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, status: "waiting" } as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "blocked" } as never);
    await callPatch({ status: "blocked" });

    mockGetProjectTaskById.mockResolvedValueOnce(existingTask as never);
    mockUpdateProjectTask.mockResolvedValueOnce({ ...existingTask, status: "waiting" } as never);
    await callPatch({ status: "waiting" });

    expect(eventTypes()).not.toContain("task.ready");
  });
});

describe("DELETE /api/projects/[id]/tasks/[tid] task.ready notifications", () => {
  async function callDelete(query = "") {
    const response = await DELETE(new NextRequest(`http://localhost/api/projects/15/tasks/10${query}`, {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "15", tid: "10" }),
    });
    if (!response) throw new Error("DELETE handler returned undefined");
    return response;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("dispatches task.ready for the task activated by the deletion when it has an assignee", async () => {
    mockDeleteProjectTask.mockResolvedValueOnce([11] as never);
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, id: 11, status: "not_started", assigned_user_id: 8 } as never);

    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(mockDeleteProjectTask).toHaveBeenCalledWith(10);
    expect(mockGetProjectTaskById).toHaveBeenCalledWith(11);
    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "task.ready",
      actorUserId: 3,
      projectId: 15,
      taskId: 11,
    });
  });

  it("?notify=false deletes the task but sends no task.ready", async () => {
    mockDeleteProjectTask.mockResolvedValueOnce([11] as never);
    mockGetProjectTaskById.mockResolvedValue({ ...existingTask, id: 11, status: "not_started", assigned_user_id: 8 } as never);

    const response = await callDelete("?notify=false");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockDeleteProjectTask).toHaveBeenCalledWith(10);
    expect(mockDispatchNotification).not.toHaveBeenCalled();
    expect(mockRecalcAndNotify).toHaveBeenCalledWith(15, 3, { notify: false });
  });

  it("deleting the last pending task recalculates through the ready-to-close helper (notify on)", async () => {
    mockDeleteProjectTask.mockResolvedValueOnce([] as never);

    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(mockRecalcAndNotify).toHaveBeenCalledTimes(1);
    expect(mockRecalcAndNotify).toHaveBeenCalledWith(15, 3, { notify: true });
  });

  it("rejects an invalid notify value with 400 and deletes nothing", async () => {
    const response = await callDelete("?notify=no");

    expect(response.status).toBe(400);
    expect(mockDeleteProjectTask).not.toHaveBeenCalled();
  });

  it("does not dispatch task.ready when nothing was activated or the activated task has no assignee", async () => {
    mockDeleteProjectTask.mockResolvedValueOnce([] as never);
    await callDelete();

    mockDeleteProjectTask.mockResolvedValueOnce([11] as never);
    mockGetProjectTaskById.mockResolvedValueOnce({ ...existingTask, id: 11, status: "not_started", assigned_user_id: null } as never);
    await callDelete();

    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });
});
