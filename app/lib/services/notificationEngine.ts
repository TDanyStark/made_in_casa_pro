// ---------------------------------------------------------------------------
// notificationEngine — motor de notificaciones
//
// Punto de entrada: dispatchNotification({ eventType, actorUserId, … })
//
// Responsabilidades:
//   1. Crear el registro notification_events
//   2. Resolver destinatarios según el tipo de evento
//   3. Resolver la plantilla correcta
//   4. Resolver el threadKey si aplica
//   5. Enviar cada email vía emailService (registra deliveries internamente)
//
// Regla de sender:
//   - Eventos de acción humana → Gmail del actor (actorUserId)
//   - Sistema automático / fallback → forceSystemSender = true
//
// Errores de envío son logueados pero no rompen la mutación principal.
// ---------------------------------------------------------------------------

import { createNotificationEvent } from "@/lib/queries/notificationEvents";
import { resolveProjectVersionThreadKey } from "@/lib/queries/projectEmailThreads";
import {
  getProjectStakeholders,
  getTaskAssignee,
  getTaskProjectCreator,
  getQuoteInvitee,
  getQuoteReceivedRecipient,
  getAcceptedQuoteCollaborator,
  getActorName,
  getUserNotificationRecipient,
  type NotificationRecipient,
} from "@/lib/queries/notificationRecipients";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { sendEmail } from "@/lib/services/email/emailService";

import { taskAssigned } from "@/lib/email/templates/taskAssigned";
import { taskReassigned } from "@/lib/email/templates/taskReassigned";
import { taskCompleted } from "@/lib/email/templates/taskCompleted";
import { quoteRequested } from "@/lib/email/templates/quoteRequested";
import { quoteReceived } from "@/lib/email/templates/quoteReceived";
import { quoteAccepted } from "@/lib/email/templates/quoteAccepted";
import { projectAdjustmentCreated } from "@/lib/email/templates/projectAdjustmentCreated";
import { projectCompleted } from "@/lib/email/templates/projectCompleted";

// ── Supported event types ──────────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  TASK_ASSIGNED: "task.assigned",
  TASK_REASSIGNED: "task.reassigned",
  TASK_COMPLETED: "task.completed",
  QUOTE_REQUESTED: "quote.requested",
  QUOTE_RECEIVED: "quote.received",
  QUOTE_ACCEPTED: "quote.accepted",
  PROJECT_ADJUSTMENT_CREATED: "project.adjustment.created",
  PROJECT_COMPLETED: "project.completed",
} as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

// ── Input types per event ──────────────────────────────────────────────────

interface BaseInput {
  actorUserId: number;
  metadata?: Record<string, unknown>;
}

export interface TaskAssignedInput extends BaseInput {
  eventType: "task.assigned";
  taskId: number;
  projectId: number;
}

export interface TaskReassignedInput extends BaseInput {
  eventType: "task.reassigned";
  taskId: number;
  projectId: number;
  previousUserId: number;
  newUserId?: number | null;
}

export interface TaskCompletedInput extends BaseInput {
  eventType: "task.completed";
  taskId: number;
  projectId: number;
}

export interface QuoteRequestedInput extends BaseInput {
  eventType: "quote.requested";
  taskId: number;
  projectId: number;
  /** User id of the collaborator being invited */
  inviteeUserId: number;
}

export interface QuoteReceivedInput extends BaseInput {
  eventType: "quote.received";
  taskId: number;
  projectId: number;
  /** Price sent by the collaborator */
  price: number;
  deliveryDays: number;
  notes?: string | null;
}

export interface QuoteAcceptedInput extends BaseInput {
  eventType: "quote.accepted";
  taskId: number;
  projectId: number;
  quoteId: number;
}

export interface ProjectAdjustmentCreatedInput extends BaseInput {
  eventType: "project.adjustment.created";
  projectId: number;
  adjustmentId: number;
  versionNumber: number;
  notes?: string | null;
  taskCount?: number;
}

export interface ProjectCompletedInput extends BaseInput {
  eventType: "project.completed";
  projectId: number;
}

export type DispatchInput =
  | TaskAssignedInput
  | TaskReassignedInput
  | TaskCompletedInput
  | QuoteRequestedInput
  | QuoteReceivedInput
  | QuoteAcceptedInput
  | ProjectAdjustmentCreatedInput
  | ProjectCompletedInput;

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

async function sendToRecipients(
  recipients: NotificationRecipient[],
  actorUserId: number,
  eventId: number,
  makeMessage: (r: NotificationRecipient) => { subject: string; html: string; text: string },
  opts?: {
    projectId?: number | null;
    adjustmentId?: number | null;
    threadKey?: string;
    forceSystemSender?: boolean;
  }
) {
  await Promise.allSettled(
    recipients.map((r) => {
      const msg = makeMessage(r);
      return sendEmail({
        senderUserId: opts?.forceSystemSender ? null : actorUserId,
        forceSystemSender: opts?.forceSystemSender,
        message: {
          to: { email: r.email, name: r.name },
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        },
        eventId,
        recipientUserId: r.userId,
        projectId: opts?.projectId,
        adjustmentId: opts?.adjustmentId,
        thread: opts?.threadKey ? { threadKey: opts.threadKey } : undefined,
      });
    })
  );
}

// ── Main dispatcher ────────────────────────────────────────────────────────

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  try {
    const event = await createNotificationEvent({
      event_type: input.eventType,
      actor_user_id: input.actorUserId,
      project_id: "projectId" in input ? input.projectId : null,
      task_id: "taskId" in input ? input.taskId : null,
      adjustment_id: "adjustmentId" in input ? input.adjustmentId : null,
      metadata: input.metadata,
    });

    const eventId = (event as unknown as { id: number }).id;

    switch (input.eventType) {
      // ── task.assigned ──────────────────────────────────────────────────
      case "task.assigned": {
        const [task, project, assignee] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getTaskAssignee(input.taskId),
        ]);
        if (!assignee || !task || !project) break;

        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);
        const assignedByName = await getActorName(input.actorUserId);

        await sendToRecipients(
          [assignee],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: taskAssigned.subject({
              recipientName: r.name,
              assignedByName,
              taskTitle: task.title,
              taskType: task.task_type,
              taskFlag: task.task_flag,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
            }),
            html: taskAssigned.html({
              recipientName: r.name,
              assignedByName,
              taskTitle: task.title,
              taskType: task.task_type,
              taskFlag: task.task_flag,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
              dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null,
              deliveryDays: null,
            }),
            text: taskAssigned.text({
              recipientName: r.name,
              assignedByName,
              taskTitle: task.title,
              taskType: task.task_type,
              taskFlag: task.task_flag,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
            }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );
        break;
      }

      // ── task.reassigned ────────────────────────────────────────────────
      case "task.reassigned": {
        const [task, project, previousRecipient, newRecipient] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getUserNotificationRecipient(input.previousUserId),
          input.newUserId ? getUserNotificationRecipient(input.newUserId) : Promise.resolve(null),
        ]);
        if (!task || !project || !previousRecipient) break;

        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);
        const changedByName = await getActorName(input.actorUserId);

        await sendToRecipients(
          [previousRecipient],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: taskReassigned.subject({
              recipientName: r.name,
              changedByName,
              taskTitle: task.title,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
              newAssigneeName: newRecipient?.name ?? null,
            }),
            html: taskReassigned.html({
              recipientName: r.name,
              changedByName,
              taskTitle: task.title,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
              newAssigneeName: newRecipient?.name ?? null,
            }),
            text: taskReassigned.text({
              recipientName: r.name,
              changedByName,
              taskTitle: task.title,
              projectTitle: project.title,
              projectId: project.id,
              taskId: task.id,
              newAssigneeName: newRecipient?.name ?? null,
            }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );

        if (newRecipient) {
          const assignedByName = changedByName;
          await sendToRecipients(
            [newRecipient],
            input.actorUserId,
            eventId,
            (r) => ({
              subject: taskAssigned.subject({
                recipientName: r.name,
                assignedByName,
                taskTitle: task.title,
                taskType: task.task_type,
                taskFlag: task.task_flag,
                projectTitle: project.title,
                projectId: project.id,
                taskId: task.id,
              }),
              html: taskAssigned.html({
                recipientName: r.name,
                assignedByName,
                taskTitle: task.title,
                taskType: task.task_type,
                taskFlag: task.task_flag,
                projectTitle: project.title,
                projectId: project.id,
                taskId: task.id,
                dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null,
                deliveryDays: null,
              }),
              text: taskAssigned.text({
                recipientName: r.name,
                assignedByName,
                taskTitle: task.title,
                taskType: task.task_type,
                taskFlag: task.task_flag,
                projectTitle: project.title,
                projectId: project.id,
                taskId: task.id,
              }),
            }),
            { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
          );
        }
        break;
      }

      // ── task.completed ─────────────────────────────────────────────────
      case "task.completed": {
        const [task, project, creator] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getTaskProjectCreator(input.taskId),
        ]);
        if (!task || !project || !creator) break;

        const completedByName = await getActorName(input.actorUserId);
        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);
        const completedAt = formatDate(task.completed_at as string | null);

        await sendToRecipients(
          [creator],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: taskCompleted.subject({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt }),
            html: taskCompleted.html({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt, deliverableNotes: (task as unknown as { delivery_notes?: string | null }).delivery_notes }),
            text: taskCompleted.text({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );
        break;
      }

      // ── quote.requested ────────────────────────────────────────────────
      case "quote.requested": {
        const [task, project, invitee] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getQuoteInvitee(input.taskId, input.inviteeUserId),
        ]);
        if (!task || !project || !invitee) break;

        const invitedByName = await getActorName(input.actorUserId);
        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);

        await sendToRecipients(
          [invitee],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: quoteRequested.subject({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id }),
            html: quoteRequested.html({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, taskDescription: task.description, dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null, projectNotes: project.notes }),
            text: quoteRequested.text({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, taskDescription: task.description }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );
        break;
      }

      // ── quote.received ─────────────────────────────────────────────────
      case "quote.received": {
        const [task, project, recipient] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getQuoteReceivedRecipient(input.taskId),
        ]);
        if (!task || !project || !recipient) break;

        const collaboratorName = await getActorName(input.actorUserId);
        const collaboratorEmail = (await getTaskAssignee(input.taskId))?.email ?? "";
        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);

        await sendToRecipients(
          [recipient],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: quoteReceived.subject({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price: input.price, deliveryDays: input.deliveryDays }),
            html: quoteReceived.html({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price: input.price, deliveryDays: input.deliveryDays, notes: input.notes }),
            text: quoteReceived.text({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price: input.price, deliveryDays: input.deliveryDays }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );
        break;
      }

      // ── quote.accepted ─────────────────────────────────────────────────
      case "quote.accepted": {
        const [task, project, collaborator] = await Promise.all([
          getProjectTaskById(input.taskId),
          getProjectById(input.projectId),
          getAcceptedQuoteCollaborator(input.quoteId),
        ]);
        if (!task || !project || !collaborator) break;

        const acceptedByName = await getActorName(input.actorUserId);
        const threadKey = await resolveProjectVersionThreadKey(input.projectId, task.adjustment_id ?? null);

        const quoteInfo = (input.metadata ?? {}) as { price?: number; delivery_days?: number };
        const price = quoteInfo.price ?? 0;
        const deliveryDays = quoteInfo.delivery_days ?? 0;

        await sendToRecipients(
          [collaborator],
          input.actorUserId,
          eventId,
          (r) => ({
            subject: quoteAccepted.subject({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
            html: quoteAccepted.html({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
            text: quoteAccepted.text({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
          }),
          { projectId: input.projectId, adjustmentId: task.adjustment_id ?? null, threadKey }
        );
        break;
      }

      // ── project.adjustment.created ─────────────────────────────────────
      case "project.adjustment.created": {
        const [project, stakeholders] = await Promise.all([
          getProjectById(input.projectId),
          getProjectStakeholders(input.projectId, input.actorUserId),
        ]);
        if (!project || stakeholders.length === 0) break;

        const threadKey = await resolveProjectVersionThreadKey(input.projectId, input.adjustmentId);

        const createdByName = await getActorName(input.actorUserId);

        await sendToRecipients(
          stakeholders,
          input.actorUserId,
          eventId,
          (r) => ({
            subject: projectAdjustmentCreated.subject({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: input.adjustmentId, versionNumber: input.versionNumber, notes: input.notes }),
            html: projectAdjustmentCreated.html({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: input.adjustmentId, versionNumber: input.versionNumber, notes: input.notes, taskCount: input.taskCount }),
            text: projectAdjustmentCreated.text({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: input.adjustmentId, versionNumber: input.versionNumber }),
          }),
          { projectId: input.projectId, adjustmentId: input.adjustmentId, threadKey }
        );
        break;
      }

      // ── project.completed ──────────────────────────────────────────────
      case "project.completed": {
        const [project, stakeholders] = await Promise.all([
          getProjectById(input.projectId),
          getProjectStakeholders(input.projectId, null),
        ]);
        if (!project || stakeholders.length === 0) break;

        const threadKey = await resolveProjectVersionThreadKey(input.projectId, null);
        const completedAt = formatDate(project.completed_at ?? undefined);

        const completedByName = await getActorName(input.actorUserId);

        await sendToRecipients(
          stakeholders,
          input.actorUserId,
          eventId,
          (r) => ({
            subject: projectCompleted.subject({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt }),
            html: projectCompleted.html({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt, clientName: project.client_name ?? undefined, brandName: project.brand_name ?? undefined }),
            text: projectCompleted.text({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt }),
          }),
          { projectId: input.projectId, adjustmentId: null, threadKey, forceSystemSender: true }
        );
        break;
      }
    }
  } catch (error) {
    // El motor no rompe la mutación principal — solo registra el error
    console.error(`[notificationEngine] Error dispatching ${input.eventType}:`, error);
  }
}
