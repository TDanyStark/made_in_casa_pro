/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/notificationDeliveries", () => ({
  getDeliveryById: jest.fn(),
  MAX_RETRY_COUNT: 3,
  resetDeliveryForRetry: jest.fn(),
}));

jest.mock("@/lib/queries/notificationEvents", () => ({
  getNotificationEventById: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  dispatchNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/services/notificationLogger", () => ({
  notifLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/notification-deliveries/[id]/retry/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getDeliveryById, resetDeliveryForRetry } from "@/lib/queries/notificationDeliveries";
import { getNotificationEventById } from "@/lib/queries/notificationEvents";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetDeliveryById = getDeliveryById as jest.MockedFunction<typeof getDeliveryById>;
const mockResetDeliveryForRetry = resetDeliveryForRetry as jest.MockedFunction<typeof resetDeliveryForRetry>;
const mockGetNotificationEventById = getNotificationEventById as jest.MockedFunction<typeof getNotificationEventById>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

const ADMIN = { isAuthorized: true, userRole: 1, response: undefined } as never;
const FORBIDDEN = {
  isAuthorized: false,
  userRole: 4,
  response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
} as never;

function makeRequest(deliveryId: string) {
  return new NextRequest(`http://localhost/api/notification-deliveries/${deliveryId}/retry`, {
    method: "POST",
  });
}

function callPost(deliveryId: string) {
  return POST(makeRequest(deliveryId), { params: Promise.resolve({ id: deliveryId }) });
}

// Use unknown cast to avoid spread-of-never TS error while keeping mock flexibility
const failedDelivery = {
  id: 42,
  event_id: 10,
  recipient_user_id: 5,
  recipient_email: "to@example.com",
  sender_user_id: 3,
  provider: "gmail",
  status: "failed",
  error: "SMTP timeout",
  gmail_thread_id: null,
  message_id: null,
  sent_at: null,
  created_at: "2026-01-01",
  retry_count: 1,
  last_attempt_at: "2026-01-01",
  event_type: "task.assigned",
  project_id: 7,
  project_title: "Project X",
  task_id: 9,
  task_title: "Task Y",
  adjustment_id: null,
  actor_user_id: 3,
  actor_name: "Alice",
};

const baseEvent = {
  id: 10,
  event_type: "task.assigned",
  actor_user_id: 3,
  project_id: 7,
  task_id: 9,
  adjustment_id: null,
  metadata: null as Record<string, unknown> | null,
  created_at: "2026-01-01",
};

describe("POST /api/notification-deliveries/[id]/retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue(ADMIN);
    mockResetDeliveryForRetry.mockResolvedValue(undefined);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await callPost("abc");
    expect(res!.status).toBe(400);
  });

  it("returns 403 when not admin", async () => {
    mockValidateApiRole.mockResolvedValue(FORBIDDEN);
    const res = await callPost("42");
    expect(res!.status).toBe(403);
  });

  it("returns 404 when delivery not found", async () => {
    mockGetDeliveryById.mockResolvedValue(null);
    const res = await callPost("42");
    expect(res!.status).toBe(404);
  });

  it("returns 409 when delivery is not failed", async () => {
    mockGetDeliveryById.mockResolvedValue({ ...failedDelivery, status: "sent" } as unknown as never);
    const res = await callPost("42");
    expect(res!.status).toBe(409);
  });

  it("returns 422 when max retry count is reached", async () => {
    mockGetDeliveryById.mockResolvedValue({ ...failedDelivery, retry_count: 3 } as unknown as never);
    const res = await callPost("42");
    expect(res!.status).toBe(422);
    const body = await res!.json();
    expect(body.error).toContain("máximo");
  });

  it("returns 404 when event is not found", async () => {
    mockGetDeliveryById.mockResolvedValue(failedDelivery as unknown as never);
    mockGetNotificationEventById.mockResolvedValue(null);
    const res = await callPost("42");
    expect(res!.status).toBe(404);
  });

  it("returns 422 when event type cannot be retried (missing required metadata)", async () => {
    mockGetDeliveryById.mockResolvedValue(failedDelivery as unknown as never);
    mockGetNotificationEventById.mockResolvedValue({
      ...baseEvent,
      event_type: "quote.requested",
      metadata: {} as Record<string, unknown>, // missing invitee_user_id
    } as unknown as never);
    const res = await callPost("42");
    expect(res!.status).toBe(422);
    expect((await res!.json()).error).toContain("no soporta reintento automático");
  });

  it("initiates retry and returns ok=true for a valid failed delivery", async () => {
    mockGetDeliveryById.mockResolvedValue(failedDelivery as unknown as never);
    mockGetNotificationEventById.mockResolvedValue(baseEvent as unknown as never);

    const res = await callPost("42");
    const body = await res!.json();

    expect(res!.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retrying).toBe(true);
    expect(body.attempt).toBe(2); // retry_count was 1

    expect(mockResetDeliveryForRetry).toHaveBeenCalledWith(42);
    // dispatchNotification is called async (fire-and-forget), give event loop a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "task.assigned", taskId: 9, projectId: 7 })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockGetDeliveryById.mockRejectedValue(new Error("DB error"));
    const res = await callPost("42");
    expect(res!.status).toBe(500);
  });
});
