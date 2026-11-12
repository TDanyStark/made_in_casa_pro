import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES, hasAnyRole, OPERATIONS_ROLES } from "@/lib/role-groups";
import { getProjectTaskById, getTaskWorkContext } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * GET /api/projects/[id]/tasks/[tid]/context
 * Returns the work context of a task (Drive folder, project/version notes and
 * previous completed tasks of the same project) for the Mis Tareas sheet.
 * Non-operations roles need access to the task's own project.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const taskId = Number(tid);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ error: "ID de tarea inválido" }, { status: 400 });
    }

    const task = await getProjectTaskById(taskId);
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    if (!hasAnyRole(roleValidation.userRole, OPERATIONS_ROLES)) {
      const cookie = (await cookies()).get("session")?.value;
      const session = cookie ? await decrypt(cookie) : null;
      const allowed = session?.id
        ? await userCanAccessProject(task.project_id, Number(session.id), roleValidation.userRole)
        : false;
      if (!allowed) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }

    const context = await getTaskWorkContext(taskId);
    if (!context) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    return NextResponse.json(context);
  } catch (error) {
    console.error("Error fetching task work context:", error);
    return NextResponse.json({ error: "Error al obtener el contexto de la tarea" }, { status: 500 });
  }
}
