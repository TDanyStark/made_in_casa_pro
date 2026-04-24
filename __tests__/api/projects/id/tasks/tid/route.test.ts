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
    QUOTE_REQUESTED: "quote.requested",
  },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/api/projects/[id]/tasks/[tid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  getProjectTaskById,
  resolveProjectTaskAssignment,
  updateProjectTask,
} from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockResolveProjectTaskAssignment = resolveProjectTaskAssignment as jest.MockedFunction<typeof resolveProjectTaskAssignment>;
const mockUpdateProjectTask = updateProjectTask as jest.MockedFunction<typeof updateProjectTask>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

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

async function callPatch(body: Record<string, unknown>) {
  const response = await PATCH(new NextRequest("http://localhost/api/projects/15/tasks/10", {
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
