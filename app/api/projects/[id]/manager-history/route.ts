import { NextRequest, NextResponse } from "next/server";
import { getProjectManagerHistory } from "@/lib/queries/projects";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { PROJECT_VIEW_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string }> };

/** Historial de reasignaciones de gerente del proyecto. */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_VIEW_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id);
    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: "Proyecto inválido" }, { status: 400 });
    }

    const history = await getProjectManagerHistory(projectId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching project manager history:", error);
    return NextResponse.json(
      { error: "Error al obtener el historial del proyecto" },
      { status: 500 }
    );
  }
}
