/**
 * @jest-environment node
 */
// S16: a completion that lost the race (task no longer in progress once locked) is a 409.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  completeTask: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 5, rol_id: 4 })) }));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { TASK_COMPLETED: "task.completed", TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/complete/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { completeTask, getProjectTaskById } from "@/lib/queries/projectTasks";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

const callPost = () =>
  POST(
    new NextRequest("http://localhost/api/projects/1/tasks/10/complete", {
      method: "POST",
      body: JSON.stringify({ progress_minutes: 30 }),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "1", tid: "10" }) }
  );

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
  (getProjectTaskById as jest.Mock).mockResolvedValue({
    id: 10, project_id: 1, assigned_user_id: 5, status: "in_progress", assigned_user_rol_id: 4, assigned_user_is_internal: 1,
  });
});

it("returns 409 with the rule message and notifies nobody", async () => {
  (completeTask as jest.Mock).mockRejectedValue(
    Object.assign(new Error("Solo se pueden completar tareas en progreso"), { name: "TaskRuleError", status: 409 })
  );

  const res = (await callPost())!;

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Solo se pueden completar tareas en progreso" });
  expect(recalculateProgressAndNotify).not.toHaveBeenCalled();
  expect(dispatchNotification).not.toHaveBeenCalled();
});

it("keeps answering 500 with the message for other errors (previous behavior)", async () => {
  (completeTask as jest.Mock).mockRejectedValue(new Error("Esta tarea ya está completada y no puede modificarse"));

  const res = (await callPost())!;

  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "Esta tarea ya está completada y no puede modificarse" });
});
