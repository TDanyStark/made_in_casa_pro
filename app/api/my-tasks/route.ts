import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getMyTasks } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

/**
 * GET /api/my-tasks
 * Returns all active tasks assigned to the current user.
 * Used for the collaborator dashboard.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tasks = await getMyTasks(session.id);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}
