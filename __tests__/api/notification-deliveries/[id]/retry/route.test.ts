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
}));

jest.mock("@/lib/queries/notificationEvents", () => ({
  getNotificationEventById: jest.fn(),
}));

jest.mock("@/lib/services/email/emailService", () => ({
  resendExistingDelivery: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  getTaskDriveFolderUrl: jest.fn(),
}));

jest.mock("@/lib/queries/notificationRecipients", () => ({
  getTaskAssignee: jest.fn(),
  getTaskProjectCreator: jest.fn(),
  getQuoteInvitee: jest.fn(),
  getQuoteReceivedRecipient: jest.fn(),
  getAcceptedQuoteCollaborator: jest.fn(),
  getActorName: jest.fn(),
  getUserNotificationRecipient: jest.fn(),
  getProjectStakeholders: jest.fn(),
}));

jest.mock("@/lib/queries/projectEmailThreads", () => ({
  resolveProjectVersionThreadKey: jest.fn(),
}));

jest.mock("@/lib/services/notificationLogger", () => ({
  notifLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/notification-deliveries/[id]/retry/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getDeliveryById } from "@/lib/queries/notificationDeliveries";
import { getNotificationEventById } from "@/lib/queries/notificationEvents";
import { resendExistingDelivery } from "@/lib/services/email/emailService";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectTaskById, getTaskDriveFolderUrl } from "@/lib/queries/projectTasks";
import { getActorName, getUserNotificationRecipient } from "@/lib/queries/notificationRecipients";
import { resolveProjectVersionThreadKey } from "@/lib/queries/projectEmailThreads";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetDeliveryById = getDeliveryById as jest.MockedFunction<typeof getDeliveryById>;
const mockGetNotificationEventById = getNotificationEventById as jest.MockedFunction<typeof getNotificationEventById>;
const mockResendExistingDelivery = resendExistingDelivery as jest.MockedFunction<typeof resendExistingDelivery>;
const mockGetProjectById = getProjectById as jest.MockedFunction<typeof getProjectById>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockGetTaskDriveFolderUrl = getTaskDriveFolderUrl as jest.MockedFunction<typeof getTaskDriveFolderUrl>;
const mockGetActorName = getActorName as jest.MockedFunction<typeof getActorName>;
const mockGetUserNotificationRecipient = getUserNotificationRecipient as jest.MockedFunction<typeof getUserNotificationRecipient>;
const mockResolveThreadKey = resolveProjectVersionThreadKey as jest.MockedFunction<typeof resolveProjectVersionThreadKey>;

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

const task = {
  id: 9,
  project_id: 7,
  title: "Task Y",
  description: "Diseñar piezas",
  task_type: "execution",
  task_flag: "new",
  adjustment_id: null,
};

const project = {
  id: 7,
  title: "Project X",
  ideal_delivery_at: null,
};

describe("POST /api/notification-deliveries/[id]/retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue(ADMIN);
    mockResendExistingDelivery.mockResolvedValue({
      deliveryId: 42,
      provider: "gmail",
      gmailThreadId: "thread-1",
      messageId: "msg-1",
    });
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
    expect((await res!.json()).error).toBe(
      "No se pudo reconstruir el mensaje para el tipo de evento 'quote.requested'"
    );
    expect(mockResendExistingDelivery).not.toHaveBeenCalled();
  });

  it("initiates retry and returns ok=true for a valid failed delivery", async () => {
    mockGetDeliveryById.mockResolvedValue(failedDelivery as unknown as never);
    mockGetNotificationEventById.mockResolvedValue(baseEvent as unknown as never);
    mockGetProjectTaskById.mockResolvedValue(task as unknown as never);
    mockGetProjectById.mockResolvedValue(project as unknown as never);
    mockGetUserNotificationRecipient.mockResolvedValue({ id: 5, name: "Ana", email: "to@example.com" } as never);
    mockGetActorName.mockResolvedValue("Alice");
    mockGetTaskDriveFolderUrl.mockResolvedValue(null as never);
    mockResolveThreadKey.mockResolvedValue("project:7:version:base");

    const res = await callPost("42");
    const body = await res!.json();

    expect(res!.status).toBe(200);
    expect(body).toEqual({ ok: true, retrying: false, sent: true, attempt: 2 }); // retry_count was 1

    expect(mockGetProjectTaskById).toHaveBeenCalledWith(9);
    expect(mockGetProjectById).toHaveBeenCalledWith(7);
    expect(mockGetUserNotificationRecipient).toHaveBeenCalledWith(5);
    expect(mockResendExistingDelivery).toHaveBeenCalledTimes(1);
    expect(mockResendExistingDelivery).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        to: { email: "to@example.com", name: "Ana" },
        subject: expect.stringContaining("Task Y"),
        html: expect.any(String),
        text: expect.any(String),
      }),
      { projectId: 7, adjustmentId: null, threadKey: "project:7:version:base" }
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockGetDeliveryById.mockRejectedValue(new Error("DB error"));
    const res = await callPost("42");
    expect(res!.status).toBe(500);
  });
});
