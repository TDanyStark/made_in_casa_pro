/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getTasksByProject: jest.fn(),
}));

jest.mock("@/lib/queries/adjustments", () => ({
  getAdjustmentsByProject: jest.fn(),
}));

jest.mock("@/lib/queries/notificationEvents", () => ({
  getNotificationEventsByTask: jest.fn(),
}));

jest.mock("@/lib/queries/taskQuotes", () => ({
  getTaskQuoteInvitations: jest.fn(),
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
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/notify-created/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTasksByProject } from "@/lib/queries/projectTasks";
import { getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { getNotificationEventsByTask } from "@/lib/queries/notificationEvents";
import { getTaskQuoteInvitations } from "@/lib/queries/taskQuotes";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetTasks = getTasksByProject as jest.MockedFunction<typeof getTasksByProject>;
const mockGetAdjustments = getAdjustmentsByProject as jest.MockedFunction<typeof getAdjustmentsByProject>;
const mockGetEvents = getNotificationEventsByTask as jest.MockedFunction<typeof getNotificationEventsByTask>;
const mockGetInvitations = getTaskQuoteInvitations as jest.MockedFunction<typeof getTaskQuoteInvitations>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost(projectId = "15") {
  const response = await POST(
    new NextRequest(`http://localhost/api/projects/${projectId}/tasks/notify-created`, { method: "POST" }),
    { params: Promise.resolve({ id: projectId }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

const tasks = [
  { id: 1, project_id: 15, status: "not_started", assigned_user_id: 7 },
  { id: 2, project_id: 15, status: "waiting", assigned_user_id: 8 },
  { id: 3, project_id: 15, status: "waiting", assigned_user_id: null },
];

describe("POST /api/projects/[id]/tasks/notify-created", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockGetAdjustments.mockResolvedValue([
      { id: 40, version_number: 1 },
      { id: 41, version_number: 2 },
    ] as never);
    mockGetTasks.mockResolvedValue(tasks as never);
    mockGetEvents.mockReset();
    mockGetEvents.mockResolvedValue([]);
    mockGetInvitations.mockReset();
    mockGetInvitations.mockResolvedValue([]);
    mockDispatch.mockResolvedValue(undefined);
  });

  it("requires POST and OPERATIONS_ROLES", async () => {
    mockValidateApiRole.mockResolvedValueOnce({
      isAuthorized: false,
      userRole: 4,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as never);

    const res = await callPost();

    expect(res.status).toBe(403);
    expect(mockValidateHttpMethod).toHaveBeenCalledWith(expect.anything(), ["POST"]);
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), OPERATIONS_ROLES);
    expect(mockGetTasks).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and 400 for an invalid project id", async () => {
    mockDecrypt.mockResolvedValueOnce(null as never);
    expect((await callPost()).status).toBe(401);

    const bad = await callPost("abc");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "ID de proyecto inv\u00e1lido" });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("sends task.assigned to every assignee, then task.ready for not_started assigned tasks, on the base version", async () => {
    const res = await callPost();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notified: { assigned: 2, ready: 1, quoteRequested: 0 } });
    expect(mockGetTasks).toHaveBeenCalledWith(15, 40);
    expect(mockDispatch.mock.calls.map(([i]) => [i.eventType, "taskId" in i ? i.taskId : null])).toEqual([
      ["task.assigned", 1],
      ["task.assigned", 2],
      ["task.ready", 1],
    ]);
    expect(mockDispatch).toHaveBeenCalledWith({ eventType: "task.ready", actorUserId: 3, projectId: 15, taskId: 1 });
  });

  it("uses tasks without adjustment when the project has no base version", async () => {
    mockGetAdjustments.mockResolvedValueOnce([] as never);

    await callPost();

    expect(mockGetTasks).toHaveBeenCalledWith(15, null);
  });

  it("is safe against double calls: skips events already sent for a task", async () => {
    mockGetEvents.mockImplementation(async (taskId: number) =>
      (taskId === 1
        ? [{ event_type: "task.assigned" }, { event_type: "task.ready" }]
        : taskId === 2
          ? [{ event_type: "task.assigned" }]
          : []) as never
    );

    const res = await callPost();

    expect(await res.json()).toEqual({ notified: { assigned: 0, ready: 0, quoteRequested: 0 } });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  describe("quote.requested for template quote invitations", () => {
    // Task 4: blocked quote task (no assignee) with two pending invitees.
    // Task 5: completed task with a pending invitation -> skipped.
    const quoteTasks = [
      ...tasks,
      { id: 4, project_id: 15, status: "blocked", assigned_user_id: null },
      { id: 5, project_id: 15, status: "completed", assigned_user_id: null },
    ];

    function invitation(taskId: number, userId: number, quoteStatus: string | null = null) {
      return { id: taskId * 100 + userId, task_id: taskId, user_id: userId, quote_status: quoteStatus };
    }

    beforeEach(() => {
      mockGetTasks.mockResolvedValue(quoteTasks as never);
      mockGetInvitations.mockImplementation(async (taskId: number) =>
        (taskId === 4
          ? [invitation(4, 12), invitation(4, 13)]
          : taskId === 5
            ? [invitation(5, 14)]
            : []) as never
      );
    });

    function dispatched() {
      return mockDispatch.mock.calls.map(([i]) => i);
    }

    it("sends quote.requested per pending invitation, after assigned/ready, and counts it", async () => {
      const res = await callPost();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ notified: { assigned: 2, ready: 1, quoteRequested: 2 } });
      expect(dispatched().map((i) => i.eventType)).toEqual([
        "task.assigned",
        "task.assigned",
        "task.ready",
        "quote.requested",
        "quote.requested",
      ]);
      expect(mockDispatch).toHaveBeenCalledWith({
        eventType: "quote.requested",
        actorUserId: 3,
        projectId: 15,
        taskId: 4,
        inviteeUserId: 12,
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        eventType: "quote.requested",
        actorUserId: 3,
        projectId: 15,
        taskId: 4,
        inviteeUserId: 13,
      });
      expect(mockGetInvitations).not.toHaveBeenCalledWith(5);
    });

    it("skips an invitee that already submitted a quote for the task", async () => {
      mockGetInvitations.mockImplementation(async (taskId: number) =>
        (taskId === 4 ? [invitation(4, 12, "pending"), invitation(4, 13)] : []) as never
      );

      const res = await callPost();

      expect((await res.json()).notified.quoteRequested).toBe(1);
      const quoteCalls = dispatched().filter((i) => i.eventType === "quote.requested");
      expect(quoteCalls).toEqual([
        { eventType: "quote.requested", actorUserId: 3, projectId: 15, taskId: 4, inviteeUserId: 13 },
      ]);
    });

    it("skips a (task, invitee) pair whose quote.requested event already exists (e.g. extra task created by the wizard)", async () => {
      mockGetEvents.mockImplementation(async (taskId: number) =>
        (taskId === 4
          ? [
              { event_type: "quote.requested", metadata: { invitee_user_id: 12 } },
              // a JSON-string metadata from another driver shape is handled too
              { event_type: "quote.requested", metadata: JSON.stringify({ invitee_user_id: 99 }) },
            ]
          : []) as never
      );

      const res = await callPost();

      expect((await res.json()).notified.quoteRequested).toBe(1);
      expect(dispatched().filter((i) => i.eventType === "quote.requested")).toEqual([
        { eventType: "quote.requested", actorUserId: 3, projectId: 15, taskId: 4, inviteeUserId: 13 },
      ]);
    });

    it("is safe against a second call: nothing is resent once the events exist", async () => {
      // Record every dispatched event so the second call sees them as history.
      const history = new Map<number, Array<{ event_type: string; metadata: Record<string, unknown> }>>();
      mockDispatch.mockImplementation(async (input) => {
        const taskId = "taskId" in input ? input.taskId : 0;
        const list = history.get(taskId) ?? [];
        list.push({
          event_type: input.eventType,
          metadata: "inviteeUserId" in input ? { invitee_user_id: input.inviteeUserId } : {},
        });
        history.set(taskId, list);
      });
      mockGetEvents.mockImplementation(async (taskId: number) => (history.get(taskId) ?? []) as never);

      const first = await callPost();
      expect(await first.json()).toEqual({ notified: { assigned: 2, ready: 1, quoteRequested: 2 } });
      const callsAfterFirst = mockDispatch.mock.calls.length;

      const second = await callPost();
      expect(await second.json()).toEqual({ notified: { assigned: 0, ready: 0, quoteRequested: 0 } });
      expect(mockDispatch.mock.calls.length).toBe(callsAfterFirst);
    });
  });
});
