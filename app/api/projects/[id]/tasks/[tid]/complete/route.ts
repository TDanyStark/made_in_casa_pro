import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, completeTask } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { AUTHENTICATED_ROLES, TASK_OVERRIDE_ROLES } from "@/lib/role-groups";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

const bodySchema = z.object({
  notes: z.string().optional().nullable(),
  progress_minutes: z
    .number({ required_error: "Debes registrar el tiempo invertido en la tarea" })
    .int()
    .min(1, "Debes registrar al menos 1 minuto de tiempo invertido"),
  delivery_url: z.string().url().optional().nullable(),
  completion_cost: z.number().min(0).optional().nullable(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/complete
 * Marks an execution task as completed and auto-activates the next task in order.
 * Only the assigned user can complete the task (leadership can override).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const taskId = parseInt(tid);

    // Get current user from session
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const userId = session.id;
    const userRole = roleValidation.userRole;

    const task = await getProjectTaskById(taskId);
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    if (task.project_id !== projectId) {
      return NextResponse.json({ error: "Tarea no pertenece al proyecto" }, { status: 400 });
    }

    // Only assigned user can complete; leadership can override
    const isAssigned = task.assigned_user_id === userId;
    const canOverride = TASK_OVERRIDE_ROLES.includes(userRole);
    if (!isAssigned && !canOverride) {
      return NextResponse.json(
        { error: "Solo el colaborador asignado puede completar esta tarea" },
        { status: 403 }
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la petición es inválido o está vacío" },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Datos de la petición inválidos" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const result = await completeTask(taskId, userId, body.notes, {
      progress_minutes: body.progress_minutes,
      delivery_url: body.delivery_url,
      completion_cost: body.completion_cost,
    });
    await recalculateProjectProgress(projectId);

    await dispatchNotification({
      eventType: NOTIFICATION_EVENTS.TASK_COMPLETED,
      actorUserId: userId,
      projectId,
      taskId,
    });

    return NextResponse.json({
      task: result.task,
      nextTask: result.nextTask,
      blockedReason: result.blockedReason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al completar tarea";
    console.error("Error completing task:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
