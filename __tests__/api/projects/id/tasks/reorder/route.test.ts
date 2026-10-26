/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  TaskRuleError: class TaskRuleError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "TaskRuleError";
      this.status = status;
    }
  },
  reorderProjectTasks: jest.fn(),
  getProjectTaskById: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/reorder/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, reorderProjectTasks } from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockReorder = reorderProjectTasks as jest.MockedFunction<typeof reorderProjectTasks>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost(body: Record<string, unknown>, query = "") {
  const response = await POST(
    new NextRequest(`http://localhost/api/projects/15/tasks/reorder${query}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15" }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/tasks/reorder task.ready notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatch.mockResolvedValue(undefined);
  });

  it("keeps its response and dispatches task.ready for the activated task with an assignee", async () => {
    mockReorder.mockResolvedValueOnce([22]);
    mockGetProjectTaskById.mockResolvedValueOnce({ id: 22, project_id: 15, status: "not_started", assigned_user_id: 8 } as never);

    const res = await callPost({ orderedIds: [22, 21], adjustment_id: 9 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockReorder).toHaveBeenCalledWith(15, [22, 21], 9);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      eventType: "task.ready",
      actorUserId: 3,
      projectId: 15,
      taskId: 22,
    });
  });

  it("?notify=false reorders but sends no task.ready", async () => {
    mockReorder.mockResolvedValueOnce([22]);
    mockGetProjectTaskById.mockResolvedValue({ id: 22, project_id: 15, status: "not_started", assigned_user_id: 8 } as never);

    const res = await callPost({ orderedIds: [22, 21] }, "?notify=false");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockReorder).toHaveBeenCalledWith(15, [22, 21], undefined);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("rejects an invalid notify value with 400 and does not reorder", async () => {
    const res = await callPost({ orderedIds: [22, 21] }, "?notify=off");

    expect(res.status).toBe(400);
    expect(mockReorder).not.toHaveBeenCalled();
  });

  it("does not dispatch when nothing was activated or the activated task has no assignee", async () => {
    mockReorder.mockResolvedValueOnce([]);
    await callPost({ orderedIds: [21, 22] });

    mockReorder.mockResolvedValueOnce([22]);
    mockGetProjectTaskById.mockResolvedValueOnce({ id: 22, project_id: 15, status: "not_started", assigned_user_id: null } as never);
    await callPost({ orderedIds: [22, 21] });

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// S44 (2.3): an incomplete list is a client error, not a 500.
describe("POST /api/projects/[id]/tasks/reorder incomplete list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
  });

  it("returns 400 with the rule message and sends no notification", async () => {
    const error = Object.assign(new Error("La lista debe incluir todas las tareas de la versión, una sola vez"), {
      name: "TaskRuleError",
      status: 400,
    });
    mockReorder.mockRejectedValueOnce(error);

    const res = await callPost({ orderedIds: [3, 1], adjustment_id: 4 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "La lista debe incluir todas las tareas de la versión, una sola vez" });
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
