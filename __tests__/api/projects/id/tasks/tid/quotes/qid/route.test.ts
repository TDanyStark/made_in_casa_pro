/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/taskQuotes", () => ({
  acceptQuote: jest.fn(),
  rejectQuote: jest.fn(),
  getTaskQuotes: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  recalculateProjectProgress: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { QUOTE_ACCEPTED: "quote.accepted", TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from "next/server";
import { PATCH } from "@/api/projects/[id]/tasks/[tid]/quotes/[qid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { acceptQuote, getTaskQuotes, rejectQuote } from "@/lib/queries/taskQuotes";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockAcceptQuote = acceptQuote as jest.MockedFunction<typeof acceptQuote>;
const mockRejectQuote = rejectQuote as jest.MockedFunction<typeof rejectQuote>;
const mockGetTaskQuotes = getTaskQuotes as jest.MockedFunction<typeof getTaskQuotes>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPatch(body: Record<string, unknown>) {
  const response = await PATCH(
    new NextRequest("http://localhost/api/projects/15/tasks/10/quotes/77", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15", tid: "10", qid: "77" }) }
  );
  if (!response) throw new Error("PATCH handler returned undefined");
  return response;
}

describe("PATCH /api/projects/[id]/tasks/[tid]/quotes/[qid] task.ready notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatch.mockResolvedValue(undefined);
    mockAcceptQuote.mockResolvedValue(undefined);
    mockRejectQuote.mockResolvedValue(undefined);
    mockGetTaskQuotes.mockResolvedValue([{ id: 77, price: 500, delivery_days: 4 }] as never);
  });

  it("dispatches quote.accepted and then task.ready when the accepted task is not_started", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ id: 10, project_id: 15, status: "not_started", assigned_user_id: 8 } as never);

    const res = await callPatch({ action: "accept" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, action: "accepted" });
    expect(mockDispatch.mock.calls.map(([i]) => i.eventType)).toEqual(["quote.accepted", "task.ready"]);
    expect(mockDispatch).toHaveBeenLastCalledWith({
      eventType: "task.ready",
      actorUserId: 3,
      projectId: 15,
      taskId: 10,
    });
  });

  it("does not dispatch task.ready when the resulting task status is not not_started", async () => {
    mockGetProjectTaskById.mockResolvedValueOnce({ id: 10, project_id: 15, status: "waiting", assigned_user_id: 8 } as never);

    await callPatch({ action: "accept" });

    expect(mockDispatch.mock.calls.map(([i]) => i.eventType)).toEqual(["quote.accepted"]);
  });

  it("does not dispatch anything on reject", async () => {
    const res = await callPatch({ action: "reject" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, action: "rejected" });
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
