import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { removeProductFromProject, recalculateProjectProgress } from "@/lib/queries/projects";

type Params = { params: Promise<{ id: string; pid: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, pid } = await params;
    const projectId = parseInt(id);
    await removeProductFromProject(projectId, parseInt(pid));
    await recalculateProjectProgress(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing product from project:", error);
    return NextResponse.json({ error: "Error al quitar producto del proyecto" }, { status: 500 });
  }
}
