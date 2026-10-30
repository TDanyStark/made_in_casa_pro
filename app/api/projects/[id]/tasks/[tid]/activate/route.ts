import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { activateWaitingTask, getProjectTaskById } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { TASK_ACTIVATE_ROLES } from "@/lib/role-groups";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";
import { taskRuleErrorResponse } from "../taskStateChange";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/activate
 * Quick manual activation of a waiting task ('waiting' -> 'not_started') by
 * comercial, admin or directivo. Emails the assignee that it is their turn.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, TASK_ACTIVATE_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const taskId = parseInt(tid);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const userId = Number(session.id);

    const existing = await getProjectTaskById(taskId);
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const task = await activateWaitingTask(taskId, userId);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_READY,
      actorUserId: userId,
      projectId,
      taskId,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const ruleResponse = taskRuleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error("Error activating task:", error);
    return NextResponse.json({ error: "Error al activar la tarea" }, { status: 500 });
  }
}
