import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { getTasksByProject } from "@/lib/queries/projectTasks";
import { getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { getNotificationEventsByTask, type NotificationEventType } from "@/lib/queries/notificationEvents";
import { getTaskQuoteInvitations } from "@/lib/queries/taskQuotes";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

type Params = { params: Promise<{ id: string }> };

/** Invitee ids that already have a quote.requested event for the task (metadata.invitee_user_id). */
function notifiedInvitees(events: NotificationEventType[]): Set<number> {
  const invitees = new Set<number>();
  for (const event of events) {
    if (event.event_type !== NOTIFICATION_EVENTS.QUOTE_REQUESTED) continue;
    let metadata: unknown = event.metadata;
    if (typeof metadata === "string") {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = null;
      }
    }
    const invitee = (metadata as { invitee_user_id?: unknown } | null)?.invitee_user_id;
    if (invitee != null) invitees.add(Number(invitee));
  }
  return invitees;
}

/**
 * POST /api/projects/[id]/tasks/notify-created
 *
 * Called once by the project wizard after it finished building the task list
 * with silenced requests (?notify=false). For the base version (v1) tasks:
 *   1. task.assigned for every task with an assignee
 *   2. task.ready for every 'not_started' task with an assignee
 *   3. quote.requested for every pending quote invitation (template quoters are
 *      recorded by instantiateTasksFromTemplates but never emailed). Pending =
 *      the task is not 'completed' and the invitee has not submitted a quote.
 * so the first collaborator gets "assigned" and then "ready".
 *
 * Idempotent: a task that already has a task.assigned (or task.ready) event is
 * skipped for that event, and a (task, invitee) pair with an existing
 * quote.requested event (metadata.invitee_user_id) is skipped, so a repeated
 * call (or an extra task already notified on creation) sends nothing new.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const actorUserId = Number(session.id);

    // Base version: tasks are created under the v1 adjustment (legacy projects: adjustment_id NULL).
    const adjustments = await getAdjustmentsByProject(projectId);
    const baseAdjustment = adjustments.find((a) => a.version_number === 1);
    const tasks = await getTasksByProject(projectId, baseAdjustment ? baseAdjustment.id : null);

    // Event history is read once per task, before anything is dispatched.
    const history = new Map<number, NotificationEventType[]>();
    for (const task of tasks) {
      history.set(task.id, await getNotificationEventsByTask(task.id));
    }
    const sentEvents = new Map<number, Set<string>>(
      [...history].map(([taskId, events]) => [taskId, new Set(events.map((e) => e.event_type))])
    );
    const assignedTasks = tasks.filter((t) => t.assigned_user_id);

    let assigned = 0;
    for (const task of assignedTasks) {
      if (sentEvents.get(task.id)?.has(NOTIFICATION_EVENTS.TASK_ASSIGNED)) continue;
      await dispatchNotification({
        eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
        actorUserId,
        projectId,
        taskId: task.id,
      });
      assigned++;
    }

    let ready = 0;
    for (const task of assignedTasks) {
      if (task.status !== "not_started") continue;
      if (sentEvents.get(task.id)?.has(NOTIFICATION_EVENTS.TASK_READY)) continue;
      await dispatchNotification({
        eventType: NOTIFICATION_EVENTS.TASK_READY,
        actorUserId,
        projectId,
        taskId: task.id,
      });
      ready++;
    }

    let quoteRequested = 0;
    for (const task of tasks) {
      if (task.status === "completed") continue;
      const invitations = await getTaskQuoteInvitations(task.id);
      if (invitations.length === 0) continue;
      const alreadyNotified = notifiedInvitees(history.get(task.id) ?? []);
      for (const invitation of invitations) {
        const inviteeUserId = Number(invitation.user_id);
        if (invitation.quote_status) continue; // already submitted a quote
        if (alreadyNotified.has(inviteeUserId)) continue;
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
          actorUserId,
          projectId,
          taskId: task.id,
          inviteeUserId,
        });
        alreadyNotified.add(inviteeUserId);
        quoteRequested++;
      }
    }

    return NextResponse.json({ notified: { assigned, ready, quoteRequested } });
  } catch (error) {
    console.error("Error notifying created tasks:", error);
    return NextResponse.json({ error: "Error al notificar las tareas creadas" }, { status: 500 });
  }
}
