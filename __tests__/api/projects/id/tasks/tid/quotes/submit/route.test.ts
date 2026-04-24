/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/taskQuotes", () => ({
  submitQuote: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {
    QUOTE_RECEIVED: "quote.received",
  },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/quotes/submit/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { submitQuote } from "@/lib/queries/taskQuotes";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockSubmitQuote = submitQuote as jest.MockedFunction<typeof submitQuote>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost(request: NextRequest) {
  const response = await POST(request, { params: Promise.resolve({ id: "15", tid: "10" }) });
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/tasks/[tid]/quotes/submit notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "collab@test.com", rol_id: 4 } as never);
    mockSubmitQuote.mockResolvedValue({
      id: 55,
      task_id: 10,
      project_id: 15,
      user_id: 7,
      user_name: "Carlos",
      price: 850000,
      delivery_days: 3,
      delivery_hours: 0,
      delivery_minutes: 0,
      notes: "<p>Incluye retoque</p>",
      status: "pending",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    } as never);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("dispatches quote.received after submitting quote", async () => {
    const request = new NextRequest("http://localhost/api/projects/15/tasks/10/quotes/submit", {
      method: "POST",
      body: JSON.stringify({ price: 850000, delivery_days: 3, notes: "<p>Incluye retoque</p>" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await callPost(request);

    expect(response.status).toBe(201);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "quote.received",
      actorUserId: 7,
      projectId: 15,
      taskId: 10,
      price: 850000,
      deliveryDays: 3,
      notes: "<p>Incluye retoque</p>",
    });
  });
});
