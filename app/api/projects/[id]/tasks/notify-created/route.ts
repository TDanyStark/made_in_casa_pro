import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { getTasksByProject } from "@/lib/queries/projectTasks";
import { getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { getNotificationEventsByTask } from "@/lib/queries/notificationEvents";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/tasks/notify-created
 *
 * Called once by the project wizard after it finished building the task list
 * with silenced requests (?notify=false). For the base version (v1) tasks:
 *   1. task.assigned for every task with an assignee
 *   2. task.ready for every 'not_started' task with an assignee
 * so the first collaborator gets "assigned" and then "ready".
 *
 * Idempotent: a task that already has a task.assigned (or task.ready) event is
 * skipped for that event, so a repeated call sends nothing new.
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

    const assignedTasks = tasks.filter((t) => t.assigned_user_id);
    const sentEvents = new Map<number, Set<string>>();
    for (const task of assignedTasks) {
      const events = await getNotificationEventsByTask(task.id);
      sentEvents.set(task.id, new Set(events.map((e) => e.event_type)));
    }

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

    return NextResponse.json({ notified: { assigned, ready } });
  } catch (error) {
    console.error("Error notifying created tasks:", error);
    return NextResponse.json({ error: "Error al notificar las tareas creadas" }, { status: 500 });
  }
}
