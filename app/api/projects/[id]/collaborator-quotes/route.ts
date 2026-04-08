import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getTaskQuotesForCollaborator } from "@/lib/queries/taskQuotes";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/collaborator-quotes
 * Returns all quotes submitted by the current user for tasks in this project.
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

    const quotes = await getTaskQuotesForCollaborator(projectId, session.id);

    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Error fetching collaborator quotes:", error);
    return NextResponse.json({ error: "Error al obtener cotizaciones" }, { status: 500 });
  }
}
