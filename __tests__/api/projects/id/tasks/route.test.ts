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
    QUOTE_REQUESTED: "quote.requested",
  },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createProjectTask, resolveProjectTaskAssignment } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

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

async function callPost(body: Record<string, unknown>, projectId = "15") {
  const response = await POST(
    new NextRequest(`http://localhost/api/projects/${projectId}/tasks`, {
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
