/**
 * @jest-environment node
 */
// S13: the quote must belong to the URL task/project; 404 missing, 409 wrong state.
// S22: a missing quote is a 404 and unexpected errors never leak error.message.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/taskQuotes", () => ({
  acceptQuote: jest.fn(),
  rejectQuote: jest.fn(),
  getTaskQuotes: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({ getProjectTaskById: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 3, rol_id: 1 })) }));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { QUOTE_ACCEPTED: "quote.accepted", TASK_READY: "task.ready" },
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
}));
jest.mock("@/lib/services/projectDriveAccess", () => ({ syncProjectDriveAccess: jest.fn() }));

import { NextRequest } from "next/server";
import { PATCH } from "@/api/projects/[id]/tasks/[tid]/quotes/[qid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { acceptQuote, getTaskQuotes, rejectQuote } from "@/lib/queries/taskQuotes";
import { dispatchNotification, recalculateProgressAndNotify } from "@/lib/services/notificationEngine";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";

/** Same shape as TaskRuleError from the task queries. */
const ruleError = (message: string, status: number) => Object.assign(new Error(message), { name: "TaskRuleError", status });

const callPatch = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest("http://localhost/api/projects/15/tasks/10/quotes/77", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15", tid: "10", qid: "77" }) }
  );

function expectNoSideEffects() {
  expect(syncProjectDriveAccess).not.toHaveBeenCalled();
  expect(recalculateProgressAndNotify).not.toHaveBeenCalled();
  expect(dispatchNotification).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
  (getTaskQuotes as jest.Mock).mockResolvedValue([{ id: 77, task_id: 10, price: 500, delivery_days: 4 }]);
  (acceptQuote as jest.Mock).mockResolvedValue(undefined);
  (rejectQuote as jest.Mock).mockResolvedValue(undefined);
});

describe("PATCH quotes/[qid] accept", () => {
  it("accepts scoped to the URL project and task", async () => {
    const res = (await callPatch({ action: "accept" }))!;
    expect(res.status).toBe(200);
    expect(acceptQuote).toHaveBeenCalledWith(77, 3, { projectId: 15, taskId: 10 });
  });

  it("returns 404 without accepting when the quote is not one of the URL task", async () => {
    (getTaskQuotes as jest.Mock).mockResolvedValue([{ id: 78, task_id: 10 }]);

    const res = (await callPatch({ action: "accept" }))!;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Cotización no encontrada" });
    expect(acceptQuote).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it.each([
    [404, "Tarea no encontrada"],
    [409, "La tarea ya tiene una cotización aceptada"],
  ])("answers %i with the rule message and sends nothing", async (status, message) => {
    (acceptQuote as jest.Mock).mockRejectedValue(ruleError(message, status));

    const res = (await callPatch({ action: "accept" }))!;

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
    expectNoSideEffects();
  });

  it("returns a generic 500 without the raw error message", async () => {
    (acceptQuote as jest.Mock).mockRejectedValue(new Error('relation "x" does not exist'));

    const res = (await callPatch({ action: "accept" }))!;

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al procesar cotización" });
    expectNoSideEffects();
  });
});

describe("PATCH quotes/[qid] reject", () => {
  it("rejects scoped to the URL project and task (previous behavior otherwise)", async () => {
    const res = (await callPatch({ action: "reject" }))!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, action: "rejected" });
    expect(rejectQuote).toHaveBeenCalledWith(77, { projectId: 15, taskId: 10 });
  });

  it("returns 404 when the quote is not of the URL task", async () => {
    (rejectQuote as jest.Mock).mockRejectedValue(ruleError("Cotización no encontrada", 404));

    const res = (await callPatch({ action: "reject" }))!;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Cotización no encontrada" });
  });
});
