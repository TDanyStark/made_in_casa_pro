import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectTaskById, completeTask } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const bodySchema = z.object({
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/complete
 * Marks an execution task as completed and auto-activates the next task in order.
 * Only the assigned user can complete the task (admin/directivo can override).
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

    // Only assigned user can complete; admins/directivos can override
    const isAssigned = task.assigned_user_id === userId;
    const canOverride = userRole === UserRole.ADMIN || userRole === UserRole.DIRECTIVO;
    if (!isAssigned && !canOverride) {
      return NextResponse.json(
        { error: "Solo el colaborador asignado puede completar esta tarea" },
        { status: 403 }
      );
    }

    let body: { notes?: string | null } = {};
    try {
      const raw = await request.json();
      const parsed = bodySchema.safeParse(raw);
      if (parsed.success) body = parsed.data;
    } catch {
      // body is optional
    }

    const result = await completeTask(taskId, userId, body.notes);
    await recalculateProjectProgress(projectId);

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
