/**
 * @jest-environment node
 */

jest.mock("@/lib/queries/notificationEvents", () => ({
  createNotificationEvent: jest.fn().mockResolvedValue({ id: 99 }),
}));

jest.mock("@/lib/queries/projectEmailThreads", () => ({
  resolveProjectVersionThreadKey: jest.fn((pId: number, aId: number | null) =>
    Promise.resolve(`project:${pId}:version:${aId ? "v2" : "v1"}`)
  ),
}));

jest.mock("@/lib/queries/notificationRecipients", () => ({
  getProjectStakeholders: jest.fn(),
  getTaskAssignee: jest.fn(),
  getTaskProjectCreator: jest.fn(),
  getQuoteInvitee: jest.fn(),
  getQuoteReceivedRecipient: jest.fn(),
  getAcceptedQuoteCollaborator: jest.fn(),
  getUserNotificationRecipient: jest.fn(),
  getActorName: jest.fn().mockResolvedValue("Daniel Amado"),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
}));

jest.mock("@/lib/services/email/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue({ deliveryId: 1, provider: "gmail" }),
}));

import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";
import { createNotificationEvent } from "@/lib/queries/notificationEvents";
import {
  getTaskAssignee,
  getTaskProjectCreator,
  getQuoteInvitee,
  getQuoteReceivedRecipient,
  getAcceptedQuoteCollaborator,
  getUserNotificationRecipient,
  getProjectStakeholders,
} from "@/lib/queries/notificationRecipients";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { sendEmail } from "@/lib/services/email/emailService";

const mockCreateEvent = createNotificationEvent as jest.Mock;
const mockGetTaskAssignee = getTaskAssignee as jest.Mock;
const mockGetTaskProjectCreator = getTaskProjectCreator as jest.Mock;
const mockGetQuoteInvitee = getQuoteInvitee as jest.Mock;
const mockGetQuoteReceivedRecipient = getQuoteReceivedRecipient as jest.Mock;
const mockGetAcceptedQuoteCollaborator = getAcceptedQuoteCollaborator as jest.Mock;
const mockGetUserNotificationRecipient = getUserNotificationRecipient as jest.Mock;
const mockGetProjectStakeholders = getProjectStakeholders as jest.Mock;
const mockGetProjectById = getProjectById as jest.Mock;
const mockGetProjectTaskById = getProjectTaskById as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

const project = { id: 1, title: "Campaña Q2", brand_name: "Acme", client_name: "Acme Corp", notes: null, ideal_delivery_at: null, completed_at: null };
const task = { id: 10, title: "Diseño de banner", task_type: "execution", task_flag: "new", description: null, adjustment_id: null, completed_at: null, delivery_notes: null };
const assignee = { userId: 5, email: "ana@test.com", name: "Ana García" };
const creator = { userId: 3, email: "daniel@test.com", name: "Daniel Amado" };
const previousAssignee = { userId: 4, email: "old@test.com", name: "Responsable Anterior" };

describe("dispatchNotification()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateEvent.mockResolvedValue({ id: 99 });
    mockGetProjectById.mockResolvedValue(project);
    mockGetProjectTaskById.mockResolvedValue(task);
    mockGetTaskAssignee.mockResolvedValue(assignee);
    mockGetTaskProjectCreator.mockResolvedValue(creator);
    mockGetUserNotificationRecipient.mockImplementation((userId: number) => {
      if (userId === 4) return Promise.resolve(previousAssignee);
      if (userId === 5) return Promise.resolve(assignee);
      return Promise.resolve(null);
    });
    mockSendEmail.mockResolvedValue({ deliveryId: 1, provider: "gmail" });
    process.env.NEXT_PUBLIC_APP_URL = "https://app.madeincasa.com";
  });

  // ── task.assigned ────────────────────────────────────────────────────────

  it("task.assigned: creates event and sends email to assignee", async () => {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
    });

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "task.assigned", project_id: 1, task_id: 10 })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ to: { email: "ana@test.com", name: "Ana García" } }),
        eventId: 99,
        recipientUserId: 5,
      })
    );
  });

  it("task.assigned: skips email when assignee is not found", async () => {
    mockGetTaskAssignee.mockResolvedValueOnce(null);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("task.reassigned: notifies previous assignee and new assignee", async () => {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_REASSIGNED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
      previousUserId: 4,
      newUserId: 5,
    });

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "task.reassigned", project_id: 1, task_id: 10 })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({
      message: expect.objectContaining({
        to: { email: "old@test.com", name: "Responsable Anterior" },
        subject: expect.stringContaining("Ya no eres responsable"),
      }),
      recipientUserId: 4,
    }));
    expect(mockSendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
      message: expect.objectContaining({ to: { email: "ana@test.com", name: "Ana García" } }),
      recipientUserId: 5,
    }));
  });

  it("task.reassigned: only notifies previous assignee when task is unassigned", async () => {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_REASSIGNED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
      previousUserId: 4,
      newUserId: null,
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: 4 }));
  });

  // ── task.completed ───────────────────────────────────────────────────────

  it("task.completed: notifies project creator", async () => {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_COMPLETED,
      actorUserId: 5,
      taskId: 10,
      projectId: 1,
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ to: { email: "daniel@test.com", name: "Daniel Amado" } }),
      })
    );
  });

  // ── quote.requested ──────────────────────────────────────────────────────

  it("quote.requested: sends invitation email to invitee", async () => {
    const invitee = { userId: 7, email: "carlos@test.com", name: "Carlos Díaz" };
    mockGetQuoteInvitee.mockResolvedValue(invitee);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
      inviteeUserId: 7,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ to: { email: "carlos@test.com", name: "Carlos Díaz" } }),
      })
    );
  });

  it("quote.requested: skips when invitee is not found", async () => {
    mockGetQuoteInvitee.mockResolvedValueOnce(null);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
      inviteeUserId: 99,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── quote.received ───────────────────────────────────────────────────────

  it("quote.received: notifies project creator with price info", async () => {
    mockGetQuoteReceivedRecipient.mockResolvedValue(creator);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.QUOTE_RECEIVED,
      actorUserId: 7,
      taskId: 10,
      projectId: 1,
      price: 850000,
      deliveryDays: 3,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ to: { email: "daniel@test.com", name: "Daniel Amado" } }),
      })
    );
    const html = mockSendEmail.mock.calls[0][0].message.html as string;
    expect(html).toContain("850");
  });

  // ── quote.accepted ───────────────────────────────────────────────────────

  it("quote.accepted: notifies collaborator whose quote was accepted", async () => {
    const collaborator = { userId: 7, email: "carlos@test.com", name: "Carlos Díaz" };
    mockGetAcceptedQuoteCollaborator.mockResolvedValue(collaborator);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.QUOTE_ACCEPTED,
      actorUserId: 3,
      taskId: 10,
      projectId: 1,
      quoteId: 55,
      metadata: { price: 850000, delivery_days: 3 },
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ to: { email: "carlos@test.com", name: "Carlos Díaz" } }),
      })
    );
  });

  // ── project.adjustment.created ───────────────────────────────────────────

  it("project.adjustment.created: notifies all stakeholders except actor", async () => {
    const stakeholders = [
      { userId: 5, email: "ana@test.com", name: "Ana García" },
      { userId: 8, email: "luis@test.com", name: "Luis Pérez" },
    ];
    mockGetProjectStakeholders.mockResolvedValue(stakeholders);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.PROJECT_ADJUSTMENT_CREATED,
      actorUserId: 3,
      projectId: 1,
      adjustmentId: 2,
      versionNumber: 2,
    });

    expect(mockGetProjectStakeholders).toHaveBeenCalledWith(1, 3);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it("project.adjustment.created: skips when no stakeholders", async () => {
    mockGetProjectStakeholders.mockResolvedValue([]);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.PROJECT_ADJUSTMENT_CREATED,
      actorUserId: 3,
      projectId: 1,
      adjustmentId: 2,
      versionNumber: 2,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── project.completed ────────────────────────────────────────────────────

  it("project.completed: notifies all stakeholders using system sender", async () => {
    const stakeholders = [
      { userId: 3, email: "daniel@test.com", name: "Daniel Amado" },
      { userId: 5, email: "ana@test.com", name: "Ana García" },
    ];
    mockGetProjectStakeholders.mockResolvedValue(stakeholders);
    mockGetProjectById.mockResolvedValue({ ...project, completed_at: "2026-04-24T18:00:00Z" });

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.PROJECT_COMPLETED,
      actorUserId: 3,
      projectId: 1,
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    // project.completed always uses system sender
    for (const call of mockSendEmail.mock.calls) {
      expect(call[0].forceSystemSender).toBe(true);
    }
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it("does not throw when sendEmail fails — logs error silently", async () => {
    mockGetTaskAssignee.mockResolvedValue(assignee);
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP timeout"));

    await expect(
      dispatchNotification({
        eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
        actorUserId: 3,
        taskId: 10,
        projectId: 1,
      })
    ).resolves.not.toThrow();
  });

  it("does not throw when createNotificationEvent fails", async () => {
    mockCreateEvent.mockRejectedValueOnce(new Error("DB error"));

    await expect(
      dispatchNotification({
        eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
        actorUserId: 3,
        taskId: 10,
        projectId: 1,
      })
    ).resolves.not.toThrow();
  });
});
