/**
 * @jest-environment node
 */
// S16: an invalid rejection target is a 400 and a duplicated rejection a 409; nothing is notified.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  validateTask: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 5, rol_id: 4 })) }));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/validate/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, validateTask } from "@/lib/queries/projectTasks";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

const callPost = () =>
  POST(
    new NextRequest("http://localhost/api/projects/1/tasks/10/validate", {
      method: "POST",
      body: JSON.stringify({ action: "reject", targetTaskId: 12 }),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "1", tid: "10" }) }
  );

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
  (getProjectTaskById as jest.Mock).mockResolvedValue({ id: 10, project_id: 1, assigned_user_id: 5, task_type: "validation" });
});

it.each([
  [400, "La tarea a corregir debe estar antes de la validación"],
  [409, "La tarea de validación ya fue resuelta"],
])("answers %i with the rule message and notifies nobody", async (status, message) => {
  (validateTask as jest.Mock).mockRejectedValue(Object.assign(new Error(message), { name: "TaskRuleError", status }));

  const res = (await callPost())!;

  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error: message });
  expect(recalculateProgressAndNotify).not.toHaveBeenCalled();
  expect(dispatchNotification).not.toHaveBeenCalled();
});
