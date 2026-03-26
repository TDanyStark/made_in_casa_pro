import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { recalculateProjectProgress } from "@/lib/queries/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const progress = await recalculateProjectProgress(parseInt(id));
    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Error recalculating progress:", error);
    return NextResponse.json({ error: "Error al recalcular progreso" }, { status: 500 });
  }
}
