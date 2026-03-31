import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectTaskById, validateTask } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  targetTaskId: z.coerce.number().int().positive().optional(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/validate
 * Handles validation task actions.
 * - approve: moves to next task in order (same as complete)
 * - reject: marks validation as completed (historical), sets target task to in_progress with flag=correction
 * 
 * Only the assigned user can validate.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
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
    const userId = session.id;
    const userRole = roleValidation.userRole;

    const task = await getProjectTaskById(taskId);
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    if (task.project_id !== projectId) {
      return NextResponse.json({ error: "Tarea no pertenece al proyecto" }, { status: 400 });
    }
    if (task.task_type !== "validation") {
      return NextResponse.json({ error: "Esta tarea no es de tipo validación" }, { status: 400 });
    }

    // Only assigned user can validate; admins/directivos can override
    const isAssigned = task.assigned_user_id === userId;
    const canOverride = userRole === UserRole.ADMIN || userRole === UserRole.DIRECTIVO;
    if (!isAssigned && !canOverride) {
      return NextResponse.json(
        { error: "Solo el colaborador asignado puede validar esta tarea" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { action, targetTaskId, notes } = validation.data;

    if (action === "reject" && targetTaskId === undefined) {
      return NextResponse.json(
        { error: "targetTaskId is required for rejection" },
        { status: 400 }
      );
    }

    const result = await validateTask(taskId, userId, action, targetTaskId, notes);
    await recalculateProjectProgress(projectId);

    return NextResponse.json({
      task: result.task,
      targetTask: result.targetTask,
      blockedReason: result.blockedReason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al validar tarea";
    console.error("Error validating task:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
