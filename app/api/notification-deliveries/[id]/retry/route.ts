import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";
import {
  getDeliveryById,
  MAX_RETRY_COUNT,
} from "@/lib/queries/notificationDeliveries";
import { getNotificationEventById } from "@/lib/queries/notificationEvents";
import { resendExistingDelivery } from "@/lib/services/email/emailService";
import { notifLog } from "@/lib/services/notificationLogger";
import { getProjectById } from "@/lib/queries/projects";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import {
  getTaskAssignee,
  getTaskProjectCreator,
  getQuoteInvitee,
  getQuoteReceivedRecipient,
  getAcceptedQuoteCollaborator,
  getActorName,
  getUserNotificationRecipient,
  getProjectStakeholders,
} from "@/lib/queries/notificationRecipients";
import { resolveProjectVersionThreadKey } from "@/lib/queries/projectEmailThreads";
import { taskAssigned } from "@/lib/email/templates/taskAssigned";
import { taskReassigned } from "@/lib/email/templates/taskReassigned";
import { taskCompleted } from "@/lib/email/templates/taskCompleted";
import { quoteRequested } from "@/lib/email/templates/quoteRequested";
import { quoteReceived } from "@/lib/email/templates/quoteReceived";
import { quoteAccepted } from "@/lib/email/templates/quoteAccepted";
import { projectAdjustmentCreated } from "@/lib/email/templates/projectAdjustmentCreated";
import { projectCompleted } from "@/lib/email/templates/projectCompleted";
import type { NotificationEventType } from "@/lib/services/notificationEngine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const deliveryId = Number(id);
  if (isNaN(deliveryId)) {
    return NextResponse.json({ error: "ID de delivery inválido" }, { status: 400 });
  }

  try {
    const delivery = await getDeliveryById(deliveryId);

    if (!delivery) {
      return NextResponse.json({ error: "Delivery no encontrado" }, { status: 404 });
    }

    if (delivery.status !== "failed") {
      return NextResponse.json(
        { error: `Solo se pueden reintentar deliveries fallidos (estado actual: ${delivery.status})` },
        { status: 409 }
      );
    }

    if (delivery.retry_count >= MAX_RETRY_COUNT) {
      return NextResponse.json(
        { error: `Se alcanzó el límite máximo de reintentos (${MAX_RETRY_COUNT})` },
        { status: 422 }
      );
    }

    // Load the original event
    const event = await getNotificationEventById(delivery.event_id);
    if (!event) {
      return NextResponse.json({ error: "Evento de notificación no encontrado" }, { status: 404 });
    }

    // Build the email message for the original recipient using the stored event data
    const built = await buildRetryMessage(
      event as {
        event_type: string;
        actor_user_id: number | null;
        project_id: number | null;
        task_id: number | null;
        adjustment_id: number | null;
        metadata: Record<string, unknown> | null;
      },
      delivery.recipient_email,
      delivery.recipient_user_id
    );

    if (!built) {
      return NextResponse.json(
        { error: `No se pudo reconstruir el mensaje para el tipo de evento '${event.event_type}'` },
        { status: 422 }
      );
    }

    notifLog.info(
      "retry",
      `Retrying delivery=${deliveryId} event_type=${event.event_type} attempt=${delivery.retry_count + 1}`
    );

    // Resend using the EXISTING delivery row — no new event or delivery is created
    await resendExistingDelivery(deliveryId, built.message, built.opts);

    return NextResponse.json({ ok: true, retrying: false, sent: true, attempt: delivery.retry_count + 1 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    notifLog.error("retry-route", `Unexpected error for delivery=${deliveryId}: ${msg}`);
    return NextResponse.json(
      { error: "Error al reintentar el envío" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso ?? "—";
  }
}

type RetryMessage = {
  message: { to: { email: string; name?: string }; subject: string; html: string; text?: string };
  opts?: { projectId?: number | null; adjustmentId?: number | null; threadKey?: string; forceSystemSender?: boolean };
};

/**
 * Reconstructs the email message that should be sent to `recipientEmail` for
 * the given stored event. Returns null for event types where retrying is not
 * supported (e.g. missing required metadata).
 */
async function buildRetryMessage(
  event: {
    event_type: string;
    actor_user_id: number | null;
    project_id: number | null;
    task_id: number | null;
    adjustment_id: number | null;
    metadata: Record<string, unknown> | null;
  },
  recipientEmail: string,
  recipientUserId: number | null
): Promise<RetryMessage | null> {
  const actorUserId = event.actor_user_id ?? 0;
  const meta = event.metadata ?? {};

  switch (event.event_type as NotificationEventType) {
    // ── task.assigned ────────────────────────────────────────────────────
    case "task.assigned": {
      if (!event.task_id || !event.project_id) return null;
      const [task, project, assignee] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        recipientUserId ? getUserNotificationRecipient(recipientUserId) : getTaskAssignee(event.task_id),
      ]);
      if (!task || !project || !assignee) return null;
      const assignedByName = await getActorName(actorUserId);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);
      const r = assignee;
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: taskAssigned.subject({ recipientName: r.name, assignedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id }),
          html: taskAssigned.html({ recipientName: r.name, assignedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id, dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null, deliveryDays: null }),
          text: taskAssigned.text({ recipientName: r.name, assignedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── task.reassigned ──────────────────────────────────────────────────
    case "task.reassigned": {
      if (!event.task_id || !event.project_id) return null;
      const previousUserId = Number(meta.previous_user_id ?? 0);
      const newUserId = meta.new_user_id ? Number(meta.new_user_id) : null;
      const [task, project, previousRecipient, newRecipient] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        getUserNotificationRecipient(previousUserId),
        newUserId ? getUserNotificationRecipient(newUserId) : Promise.resolve(null),
      ]);
      if (!task || !project || !previousRecipient) return null;
      const changedByName = await getActorName(actorUserId);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);

      // Determine which recipient matches the delivery's email
      const isNewAssignee = newRecipient && newRecipient.email === recipientEmail;
      const r = isNewAssignee ? newRecipient : previousRecipient;

      if (isNewAssignee) {
        return {
          message: {
            to: { email: recipientEmail, name: r.name },
            subject: taskAssigned.subject({ recipientName: r.name, assignedByName: changedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id }),
            html: taskAssigned.html({ recipientName: r.name, assignedByName: changedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id, dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null, deliveryDays: null }),
            text: taskAssigned.text({ recipientName: r.name, assignedByName: changedByName, taskTitle: task.title, taskType: task.task_type, taskFlag: task.task_flag, projectTitle: project.title, projectId: project.id, taskId: task.id }),
          },
          opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
        };
      }

      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: taskReassigned.subject({ recipientName: r.name, changedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, newAssigneeName: newRecipient?.name ?? null }),
          html: taskReassigned.html({ recipientName: r.name, changedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, newAssigneeName: newRecipient?.name ?? null }),
          text: taskReassigned.text({ recipientName: r.name, changedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, newAssigneeName: newRecipient?.name ?? null }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── task.completed ───────────────────────────────────────────────────
    case "task.completed": {
      if (!event.task_id || !event.project_id) return null;
      const [task, project, creator] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        getTaskProjectCreator(event.task_id),
      ]);
      if (!task || !project || !creator) return null;
      const completedByName = await getActorName(actorUserId);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);
      const completedAt = formatDate(task.completed_at as string | null);
      const r = creator;
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: taskCompleted.subject({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt }),
          html: taskCompleted.html({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt, deliverableNotes: (task as unknown as { delivery_notes?: string | null }).delivery_notes }),
          text: taskCompleted.text({ recipientName: r.name, completedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, completedAt }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── quote.requested ──────────────────────────────────────────────────
    case "quote.requested": {
      if (!event.task_id || !event.project_id || !meta.invitee_user_id) return null;
      const inviteeUserId = Number(meta.invitee_user_id);
      const [task, project, invitee] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        getQuoteInvitee(event.task_id, inviteeUserId),
      ]);
      if (!task || !project || !invitee) return null;
      const invitedByName = await getActorName(actorUserId);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);
      const r = invitee;
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: quoteRequested.subject({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id }),
          html: quoteRequested.html({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, taskDescription: task.description, dueDate: project.ideal_delivery_at ? formatDate(project.ideal_delivery_at) : null, projectNotes: project.notes }),
          text: quoteRequested.text({ recipientName: r.name, invitedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, taskDescription: task.description }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── quote.received ───────────────────────────────────────────────────
    case "quote.received": {
      if (!event.task_id || !event.project_id) return null;
      const [task, project, recipient, collaboratorAssignee] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        getQuoteReceivedRecipient(event.task_id),
        getTaskAssignee(event.task_id),
      ]);
      if (!task || !project || !recipient) return null;
      const collaboratorName = await getActorName(actorUserId);
      const collaboratorEmail = collaboratorAssignee?.email ?? "";
      const price = Number(meta.price ?? 0);
      const deliveryDays = Number(meta.delivery_days ?? 0);
      const notes = meta.notes ? String(meta.notes) : null;
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);
      const r = recipient;
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: quoteReceived.subject({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
          html: quoteReceived.html({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays, notes }),
          text: quoteReceived.text({ recipientName: r.name, collaboratorName, collaboratorEmail, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── quote.accepted ───────────────────────────────────────────────────
    case "quote.accepted": {
      if (!event.task_id || !event.project_id || !meta.quote_id) return null;
      const quoteId = Number(meta.quote_id);
      const [task, project, collaborator] = await Promise.all([
        getProjectTaskById(event.task_id),
        getProjectById(event.project_id),
        getAcceptedQuoteCollaborator(quoteId),
      ]);
      if (!task || !project || !collaborator) return null;
      const acceptedByName = await getActorName(actorUserId);
      const price = Number(meta.price ?? 0);
      const deliveryDays = Number(meta.delivery_days ?? 0);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, task.adjustment_id ?? null);
      const r = collaborator;
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: quoteAccepted.subject({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
          html: quoteAccepted.html({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
          text: quoteAccepted.text({ recipientName: r.name, acceptedByName, taskTitle: task.title, projectTitle: project.title, projectId: project.id, taskId: task.id, price, deliveryDays }),
        },
        opts: { projectId: event.project_id, adjustmentId: task.adjustment_id ?? null, threadKey },
      };
    }

    // ── project.adjustment.created ───────────────────────────────────────
    case "project.adjustment.created": {
      if (!event.project_id || !event.adjustment_id) return null;
      const [project, stakeholders] = await Promise.all([
        getProjectById(event.project_id),
        getProjectStakeholders(event.project_id, actorUserId),
      ]);
      if (!project || stakeholders.length === 0) return null;
      const r = stakeholders.find((s) => s.email === recipientEmail) ?? stakeholders[0];
      const createdByName = await getActorName(actorUserId);
      const versionNumber = Number(meta.version_number ?? 2);
      const notes = meta.notes ? String(meta.notes) : null;
      const taskCount = meta.task_count ? Number(meta.task_count) : undefined;
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, event.adjustment_id);
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: projectAdjustmentCreated.subject({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: event.adjustment_id, versionNumber, notes }),
          html: projectAdjustmentCreated.html({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: event.adjustment_id, versionNumber, notes, taskCount }),
          text: projectAdjustmentCreated.text({ recipientName: r.name, createdByName, projectTitle: project.title, projectId: project.id, adjustmentId: event.adjustment_id, versionNumber }),
        },
        opts: { projectId: event.project_id, adjustmentId: event.adjustment_id, threadKey },
      };
    }

    // ── project.completed ────────────────────────────────────────────────
    case "project.completed": {
      if (!event.project_id) return null;
      const [project, stakeholders] = await Promise.all([
        getProjectById(event.project_id),
        getProjectStakeholders(event.project_id, null),
      ]);
      if (!project || stakeholders.length === 0) return null;
      const r = stakeholders.find((s) => s.email === recipientEmail) ?? stakeholders[0];
      const completedByName = await getActorName(actorUserId);
      const completedAt = formatDate(project.completed_at);
      const threadKey = await resolveProjectVersionThreadKey(event.project_id, null);
      return {
        message: {
          to: { email: recipientEmail, name: r.name },
          subject: projectCompleted.subject({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt }),
          html: projectCompleted.html({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt, clientName: project.client_name ?? undefined, brandName: project.brand_name ?? undefined }),
          text: projectCompleted.text({ recipientName: r.name, completedByName, projectTitle: project.title, projectId: project.id, completedAt }),
        },
        opts: { projectId: event.project_id, adjustmentId: null, threadKey, forceSystemSender: true },
      };
    }

    default:
      return null;
  }
}
