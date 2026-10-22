/**
 * @jest-environment node
 */

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
  recalculateProjectProgress: jest.fn(),
}));

jest.mock("@/lib/queries/adjustments", () => ({
  resolveTaskAdjustmentId: jest.fn(),
  assertLatestTaskVersion: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
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
import { POST } from "@/api/projects/[id]/tasks/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createProjectTask, resolveProjectTaskAssignment } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { resolveTaskAdjustmentId, assertLatestTaskVersion } from "@/lib/queries/adjustments";
import { TaskVersionError } from "@/lib/definitions";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCreateProjectTask = createProjectTask as jest.MockedFunction<typeof createProjectTask>;
const mockResolveProjectTaskAssignment = resolveProjectTaskAssignment as jest.MockedFunction<
  typeof resolveProjectTaskAssignment
>;
const mockRecalculateProjectProgress = recalculateProjectProgress as jest.MockedFunction<
  typeof recalculateProjectProgress
>;
const mockDbExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const mockDbTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const mockResolveTaskAdjustmentId = resolveTaskAdjustmentId as jest.MockedFunction<typeof resolveTaskAdjustmentId>;

beforeEach(() => {
  // Default: an explicit adjustment_id belongs to the project and is kept as-is.
  mockResolveTaskAdjustmentId.mockImplementation(async (_projectId, adjustmentId) => adjustmentId ?? 1);
});

async function callPost(body: Record<string, unknown>, projectId = "15", query = "") {
  const response = await POST(
    new NextRequest(`http://localhost/api/projects/${projectId}/tasks${query}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: projectId }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/tasks — canonical initial status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
    mockRecalculateProjectProgress.mockResolvedValue(undefined as never);
    // No session by default: cookie missing -> currentUserId null -> no notifications.
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) } as never);
    mockDecrypt.mockResolvedValue(null as never);
    mockDispatchNotification.mockResolvedValue(undefined as never);
  });

  it("rejects adding a task to a historical version without writing or notifying", async () => {
    jest.mocked(assertLatestTaskVersion).mockRejectedValueOnce(new TaskVersionError("Solo se pueden agregar tareas a la última versión del proyecto."));
    const res = await callPost({ title: "Nueva tarea", adjustment_id: 9 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Solo se pueden agregar tareas a la última versión del proyecto." });
    expect(mockCreateProjectTask).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
    expect(recalculateProgressAndNotify).not.toHaveBeenCalled();
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it("resolves to not_started when the task queue for the adjustment has no active tasks, even without an explicit status in the request (UI must not send a hardcoded 'waiting')", async () => {
    // order_index query: not the first task in the adjustment
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 2 }] } as never);
    // active-tasks-count query: every previous task in this adjustment is done
    mockDbExecute.mockResolvedValueOnce({ rows: [{ cnt: "0" }] } as never);

    mockResolveProjectTaskAssignment.mockResolvedValue(null);
    mockCreateProjectTask.mockResolvedValue({
      id: 99,
      project_id: 15,
      status: "not_started",
    } as never);

    const res = await callPost({
      title: "Tarea sin estado explícito",
      adjustment_id: 9,
      requires_quote: 0,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("not_started");
    expect(mockCreateProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "not_started" })
    );
  });

  it("forces status to blocked for requires_quote tasks with no resolved assignee, regardless of the computed default status", async () => {
    // order_index query: first task in the adjustment -> defaultStatus would be not_started
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);

    mockResolveProjectTaskAssignment.mockResolvedValue(null);
    mockCreateProjectTask.mockResolvedValue({
      id: 100,
      project_id: 15,
      status: "blocked",
      task_flag: "new",
    } as never);

    // isBlockedByQuote branch opens a write transaction to log the transition.
    const mockTransaction = {
      execute: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    mockDbTransaction.mockResolvedValue(mockTransaction as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "session-token" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);

    const res = await callPost({
      title: "Tarea que requiere cotización",
      adjustment_id: 9,
      requires_quote: 1,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("blocked");
    expect(mockCreateProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "blocked", requires_quote: 1 })
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it("resolves to waiting (not not_started) when a predecessor task in the same adjustment is blocked — a blocked task occupies the queue's turn", async () => {
    // order_index query: not the first task in the adjustment
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 2 }] } as never);
    // active-tasks-count query: one predecessor is 'blocked' (pending quote) — must count as active
    mockDbExecute.mockResolvedValueOnce({ rows: [{ cnt: "1" }] } as never);

    mockResolveProjectTaskAssignment.mockResolvedValue(null);
    mockCreateProjectTask.mockResolvedValue({
      id: 102,
      project_id: 15,
      status: "waiting",
    } as never);

    const res = await callPost({
      title: "Tarea detrás de una bloqueada",
      adjustment_id: 9,
      requires_quote: 0,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("waiting");
    expect(mockCreateProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waiting" })
    );

    // The active-count query must include 'blocked' in its IN(...) filter so a
    // blocked predecessor is counted as occupying the queue.
    expect(mockDbExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining("'blocked'"),
      })
    );
  });

  describe("task.ready notification on creation", () => {
    beforeEach(() => {
      mockCookies.mockResolvedValue({
        get: jest.fn().mockReturnValue({ value: "session-token" }),
      } as never);
      mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    });

    function eventTypes() {
      return mockDispatchNotification.mock.calls.map(([input]) => input.eventType);
    }

    it("dispatches task.assigned and then task.ready when the first task is created not_started with an assignee", async () => {
      mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
      mockResolveProjectTaskAssignment.mockResolvedValue(7);
      mockCreateProjectTask.mockResolvedValue({
        id: 200,
        project_id: 15,
        status: "not_started",
        assigned_user_id: 7,
      } as never);

      const res = await callPost({ title: "Primera tarea", adjustment_id: 9 });

      expect(res.status).toBe(201);
      expect(eventTypes()).toEqual(["task.assigned", "task.ready"]);
      expect(mockDispatchNotification).toHaveBeenNthCalledWith(1, {
        eventType: "task.assigned",
        actorUserId: 3,
        projectId: 15,
        taskId: 200,
      });
      expect(mockDispatchNotification).toHaveBeenNthCalledWith(2, {
        eventType: "task.ready",
        actorUserId: 3,
        projectId: 15,
        taskId: 200,
      });
    });

    it("dispatches only task.assigned for a task created in 'waiting'", async () => {
      mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 2 }] } as never);
      mockDbExecute.mockResolvedValueOnce({ rows: [{ cnt: "1" }] } as never);
      mockResolveProjectTaskAssignment.mockResolvedValue(7);
      mockCreateProjectTask.mockResolvedValue({
        id: 201,
        project_id: 15,
        status: "waiting",
        assigned_user_id: 7,
      } as never);

      const res = await callPost({ title: "Tarea en espera", adjustment_id: 9 });

      expect(res.status).toBe(201);
      expect(eventTypes()).toEqual(["task.assigned"]);
    });

    it("?notify=false silences task.assigned and task.ready but still sends quote.requested", async () => {
      mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
      mockResolveProjectTaskAssignment.mockResolvedValue(7);
      mockCreateProjectTask.mockResolvedValue({
        id: 203,
        project_id: 15,
        status: "not_started",
        assigned_user_id: 7,
      } as never);
      mockDbTransaction.mockResolvedValue({
        execute: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      } as never);

      const res = await callPost({ title: "Silenciosa", adjustment_id: 9, quoter_ids: [12] }, "15", "?notify=false");

      expect(res.status).toBe(201);
      expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
      expect(mockDispatchNotification).toHaveBeenCalledWith({
        eventType: "quote.requested",
        actorUserId: 3,
        projectId: 15,
        taskId: 203,
        inviteeUserId: 12,
      });
      expect(recalculateProgressAndNotify).toHaveBeenCalledWith(15, 3, { notify: false });
    });

    it("recalculates progress through the ready-to-close helper with notify on by default", async () => {
      mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
      mockResolveProjectTaskAssignment.mockResolvedValue(null);
      mockCreateProjectTask.mockResolvedValue({
        id: 204,
        project_id: 15,
        status: "not_started",
        assigned_user_id: null,
      } as never);

      const res = await callPost({ title: "Normal", adjustment_id: 9 });

      expect(res.status).toBe(201);
      expect(recalculateProgressAndNotify).toHaveBeenCalledTimes(1);
      expect(recalculateProgressAndNotify).toHaveBeenCalledWith(15, 3, { notify: true });
    });

    it("rejects an invalid notify value with 400 and creates nothing", async () => {
      const res = await callPost({ title: "X", adjustment_id: 9 }, "15", "?notify=maybe");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Par\u00e1metro notify inv\u00e1lido" });
      expect(mockCreateProjectTask).not.toHaveBeenCalled();
      expect(mockDispatchNotification).not.toHaveBeenCalled();
    });

    it("does not dispatch task.ready when the created not_started task has no assignee", async () => {
      mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
      mockResolveProjectTaskAssignment.mockResolvedValue(null);
      mockCreateProjectTask.mockResolvedValue({
        id: 202,
        project_id: 15,
        status: "not_started",
        assigned_user_id: null,
      } as never);

      const res = await callPost({ title: "Sin responsable", adjustment_id: 9 });

      expect(res.status).toBe(201);
      expect(mockDispatchNotification).not.toHaveBeenCalled();
    });
  });

  it("still honors an explicit status sent by the caller (e.g. admin tooling), untouched by the default-status computation", async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 3 }] } as never);
    mockDbExecute.mockResolvedValueOnce({ rows: [{ cnt: "1" }] } as never); // an active task exists

    mockResolveProjectTaskAssignment.mockResolvedValue(7);
    mockCreateProjectTask.mockResolvedValue({
      id: 101,
      project_id: 15,
      status: "in_progress",
    } as never);

    const res = await callPost({
      title: "Tarea con estado explícito",
      adjustment_id: 9,
      status: "in_progress",
      requires_quote: 0,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("in_progress");
    expect(mockCreateProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress" })
    );
  });
});

describe("POST /api/projects/[id]/tasks — version is mandatory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1 as never, response: undefined } as never);
    mockRecalculateProjectProgress.mockResolvedValue(undefined as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) } as never);
    mockDecrypt.mockResolvedValue(null as never);
    mockResolveProjectTaskAssignment.mockResolvedValue(null);
  });

  it("returns 400 with the exact message and creates nothing when the project has no version", async () => {
    const message = "El proyecto no tiene una versión. No se puede crear la tarea sin versión.";
    mockResolveTaskAdjustmentId.mockRejectedValue(new TaskVersionError(message));

    const res = await callPost({ title: "Sin versión" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: message });
    expect(mockCreateProjectTask).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("returns 400 with the exact message and creates nothing when the version belongs to another project", async () => {
    const message = "La versión indicada no pertenece al proyecto.";
    mockResolveTaskAdjustmentId.mockRejectedValue(new TaskVersionError(message));

    const res = await callPost({ title: "Versión ajena", adjustment_id: 999 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: message });
    expect(mockResolveTaskAdjustmentId).toHaveBeenCalledWith(15, 999, expect.anything(), "latest");
    expect(mockCreateProjectTask).not.toHaveBeenCalled();
  });

  it("returns 201 using the latest version (previous behavior) when adjustment_id is omitted", async () => {
    mockResolveTaskAdjustmentId.mockResolvedValue(4);
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
    mockCreateProjectTask.mockResolvedValue({ id: 120, project_id: 15, status: "not_started", adjustment_id: 4 } as never);

    const res = await callPost({ title: "Sin adjustment_id" });

    expect(res.status).toBe(201);
    expect(mockResolveTaskAdjustmentId).toHaveBeenCalledWith(15, undefined, expect.anything(), "latest");
    expect(mockDbExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({ args: [15, 4] }));
    expect(mockCreateProjectTask).toHaveBeenCalledWith(expect.objectContaining({ adjustment_id: 4 }));
  });

  it("keeps an explicit adjustment_id unchanged (previous behavior)", async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [{ next_order: 0 }] } as never);
    mockCreateProjectTask.mockResolvedValue({ id: 121, project_id: 15, status: "not_started", adjustment_id: 9 } as never);

    const res = await callPost({ title: "Con versión", adjustment_id: 9 });

    expect(res.status).toBe(201);
    expect(mockResolveTaskAdjustmentId).toHaveBeenCalledWith(15, 9, expect.anything(), "latest");
    expect(mockCreateProjectTask).toHaveBeenCalledWith(expect.objectContaining({ adjustment_id: 9 }));
  });

  it("still returns 500 for unrelated errors", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("db down"));

    const res = await callPost({ title: "Falla", adjustment_id: 9 });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al crear tarea" });
  });
});

describe("POST /api/projects/[id]/tasks — paused cannot be created", () => {
  it("returns 400 and creates nothing for status paused", async () => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1 as never, response: undefined } as never);

    const res = await callPost({ title: "Pausada", adjustment_id: 9, status: "paused" });

    expect(res.status).toBe(400);
    expect(mockCreateProjectTask).not.toHaveBeenCalled();
  });
});
