import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

const notifyParamSchema = z.enum(["true", "false"]).optional();

/**
 * Reads the `?notify=` opt-out used by the project wizard. Default (absent) is
 * notify=true so every other caller keeps sending task emails. `notify=false`
 * silences task.assigned / task.reassigned / task.ready for that request; the
 * wizard sends them once at the end via POST /tasks/notify-created.
 */
export function parseNotifyParam(
  request: NextRequest
): { ok: true; notify: boolean } | { ok: false; response: NextResponse } {
  const parsed = notifyParamSchema.safeParse(request.nextUrl.searchParams.get("notify") ?? undefined);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Parámetro notify inválido" }, { status: 400 }),
    };
  }
  return { ok: true, notify: parsed.data !== "false" };
}

/**
 * Sends task.ready for the tasks a mutation activated ('waiting' -> 'not_started'),
 * e.g. the ids returned by deleteProjectTask / reorderProjectTasks. Must run after
 * the DB transaction commits. Each id is notified once, and only when the task is
 * still 'not_started' and has an assignee.
 */
export async function dispatchReadyForActivatedTasks(
  activatedIds: number[] | null | undefined,
  actorUserId: number,
  projectId: number
): Promise<void> {
  const uniqueIds = [...new Set(Array.isArray(activatedIds) ? activatedIds : [])];
  for (const taskId of uniqueIds) {
    const task = await getProjectTaskById(taskId);
    if (!task || task.status !== "not_started" || !task.assigned_user_id) continue;
    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_READY,
      actorUserId,
      projectId,
      taskId,
    });
  }
}
