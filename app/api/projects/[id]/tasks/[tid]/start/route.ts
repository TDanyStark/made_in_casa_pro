import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectTaskById, startTask } from "@/lib/queries/projectTasks";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/start
 * Transitions a task from 'not_started' to 'in_progress'.
 * Allowed for: assigned user, or admin/directivo/comercial who is the project creator.
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

    // Permission check:
    // - The assigned user can always start their own task
    // - Admin/Directivo/Comercial can start if they are the project creator
    const isAssigned = task.assigned_user_id === userId;
    const isManagerRole =
      userRole === UserRole.ADMIN ||
      userRole === UserRole.DIRECTIVO ||
      userRole === UserRole.COMERCIAL;

    let canStart = isAssigned;

    if (!canStart && isManagerRole) {
      const projectResult = await db.execute({
        sql: `SELECT created_by FROM projects WHERE id = $1`,
        args: [projectId],
      });
      if (projectResult.rows.length > 0) {
        const creatorUserId = Number(
          (projectResult.rows[0] as unknown as { created_by: number | null }).created_by
        );
        canStart = creatorUserId === userId;
      }
    }

    if (!canStart) {
      return NextResponse.json(
        { error: "No tienes permiso para iniciar esta tarea" },
        { status: 403 }
      );
    }

    const result = await startTask(taskId, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: "Tarea iniciada correctamente" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al iniciar tarea";
    console.error("Error starting task:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
