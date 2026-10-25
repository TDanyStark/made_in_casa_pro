/**
 * @jest-environment node
 */
// S14: a submission for a task that no longer accepts quotes is a 409 and notifies nobody.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/taskQuotes", () => ({ submitQuote: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 7, rol_id: 4 })) }));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { QUOTE_RECEIVED: "quote.received" },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/quotes/submit/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { submitQuote } from "@/lib/queries/taskQuotes";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const callPost = () =>
  POST(
    new NextRequest("http://localhost/api/projects/15/tasks/10/quotes/submit", {
      method: "POST",
      body: JSON.stringify({ price: 1000, delivery_days: 2 }),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15", tid: "10" }) }
  );

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
});

it("returns 409 with the rule message and sends no quote.received", async () => {
  (submitQuote as jest.Mock).mockRejectedValue(
    Object.assign(new Error("Esta tarea ya no recibe cotizaciones"), { name: "TaskRuleError", status: 409 })
  );

  const res = (await callPost())!;

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Esta tarea ya no recibe cotizaciones" });
  expect(dispatchNotification).not.toHaveBeenCalled();
});

it("keeps answering 500 with the message for other errors (previous behavior)", async () => {
  (submitQuote as jest.Mock).mockRejectedValue(new Error("No tienes invitación para cotizar esta tarea"));

  const res = (await callPost())!;

  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "No tienes invitación para cotizar esta tarea" });
  expect(dispatchNotification).not.toHaveBeenCalled();
});
