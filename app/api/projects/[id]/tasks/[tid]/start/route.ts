import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, startTask } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { AUTHENTICATED_ROLES, TASK_OVERRIDE_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/start
 * Transitions a task from 'not_started' to 'in_progress'.
 * Allowed for: assigned user, or a leadership role (override).
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

    // Permission check:
    // - The assigned user can always start their own task
    // - Leadership roles can override and start any task
    const isAssigned = task.assigned_user_id === userId;
    const canOverride = TASK_OVERRIDE_ROLES.includes(userRole);
    if (!isAssigned && !canOverride) {
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
