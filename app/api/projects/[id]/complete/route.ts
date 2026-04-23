import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { PROJECT_EDIT_ROLES } from "@/lib/role-groups";
import { completeProject } from "@/lib/queries/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    await completeProject(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al completar proyecto";
    const status =
      message === "Proyecto no encontrado" ? 404 :
      message === "El proyecto ya está completado" ? 409 :
      message === "El proyecto no tiene todas las tareas completadas" ? 422 :
      500;
    return NextResponse.json({ error: message }, { status });
  }
}
