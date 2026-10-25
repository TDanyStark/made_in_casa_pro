import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES, hasAnyRole, OPERATIONS_ROLES } from "@/lib/role-groups";
import { getProjectTaskById, getTaskTransitions } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * GET /api/projects/[id]/tasks/[tid]/history
 * Returns the transition history (audit log) for a specific task.
 * Non-operations roles need access to the task's project (the UI sends project id 0,
 * so access is checked against the task's own project).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const taskId = parseInt(tid);

    if (!hasAnyRole(roleValidation.userRole, OPERATIONS_ROLES)) {
      const task = await getProjectTaskById(taskId);
      if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
      const cookie = (await cookies()).get("session")?.value;
      const session = cookie ? await decrypt(cookie) : null;
      const allowed = session?.id
        ? await userCanAccessProject(task.project_id, Number(session.id), roleValidation.userRole)
        : false;
      if (!allowed) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }

    const transitions = await getTaskTransitions(taskId);
    return NextResponse.json(transitions);
  } catch (error) {
    console.error("Error fetching task history:", error);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}
