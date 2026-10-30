/**
 * @jest-environment node
 */
// S5 (odd/tasks/task-queue-activation.md): quick "Activar" for a waiting task,
// only for comercial, admin and directivo; it emails the assignee (task.ready).
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  activateWaitingTask: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 5 })) }));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/activate/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { activateWaitingTask, getProjectTaskById } from "@/lib/queries/projectTasks";
import { dispatchNotification } from "@/lib/services/notificationEngine";
import { UserRole } from "@/lib/definitions";

const callPost = (projectId = "1") =>
  POST(new NextRequest(`http://localhost/api/projects/${projectId}/tasks/10/activate`, { method: "POST" }), {
    params: Promise.resolve({ id: projectId, tid: "10" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: UserRole.COMERCIAL, response: undefined });
  (getProjectTaskById as jest.Mock).mockResolvedValue({ id: 10, project_id: 1, status: "waiting", assigned_user_id: 8 });
  (activateWaitingTask as jest.Mock).mockResolvedValue({ id: 10, project_id: 1, status: "not_started", assigned_user_id: 8 });
});

it("allows only comercial, admin and directivo", async () => {
  await callPost();
  const allowed = (validateApiRole as jest.Mock).mock.calls[0][1];
  expect([...allowed].sort()).toEqual([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL].sort());
});

it("returns the role error and activates nothing when the role is not allowed", async () => {
  (validateApiRole as jest.Mock).mockResolvedValue({
    isAuthorized: false,
    response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
  });
  const res = (await callPost())!;
  expect(res.status).toBe(403);
  expect(activateWaitingTask).not.toHaveBeenCalled();
  expect(dispatchNotification).not.toHaveBeenCalled();
});

it("activates the waiting task and sends task.ready to its assignee", async () => {
  const res = (await callPost())!;
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ task: { id: 10, project_id: 1, status: "not_started", assigned_user_id: 8 } });
  expect(activateWaitingTask).toHaveBeenCalledWith(10, 5);
  expect(dispatchNotification).toHaveBeenCalledWith({ eventType: "task.ready", actorUserId: 5, projectId: 1, taskId: 10 });
});

it("returns 404 when the task belongs to another project", async () => {
  const res = (await callPost("2"))!;
  expect(res.status).toBe(404);
  expect(activateWaitingTask).not.toHaveBeenCalled();
});

it("returns the rule error and notifies nobody when the task is not waiting", async () => {
  (activateWaitingTask as jest.Mock).mockRejectedValue(
    Object.assign(new Error("Solo se pueden activar tareas en espera"), { name: "TaskRuleError", status: 409 })
  );
  const res = (await callPost())!;
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Solo se pueden activar tareas en espera" });
  expect(dispatchNotification).not.toHaveBeenCalled();
});
