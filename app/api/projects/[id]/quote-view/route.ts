import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getProjectDetail } from "@/lib/queries/projects";
import { getTasksByProject, getTasksForQuoteView } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/quote-view
 * Returns a read-only view of a project for collaborators invited to quote.
 * Only returns the project if the user has been invited to quote at least one task.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user has been invited to quote any task in this project
    const invitedTasks = await getTasksForQuoteView(projectId, session.id);
    
    if (invitedTasks.length === 0) {
      return NextResponse.json({ 
        error: "No tienes invitación para cotizar en este proyecto" 
      }, { status: 403 });
    }

     // Return the full project detail and all project tasks once invitation access is confirmed.
     const [fullProject, tasks] = await Promise.all([
       getProjectDetail(projectId),
       getTasksByProject(projectId),
     ]);
     if (!fullProject) {
       return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
     }

    // Return just the invited task IDs
    const invitedTaskIds = invitedTasks.map(t => t.id);

     return NextResponse.json({
       ...fullProject,
       tasks,
       invited_task_ids: invitedTaskIds,
     });
  } catch (error) {
    console.error("Error fetching quote view project:", error);
    return NextResponse.json({ error: "Error al obtener el proyecto" }, { status: 500 });
  }
}
