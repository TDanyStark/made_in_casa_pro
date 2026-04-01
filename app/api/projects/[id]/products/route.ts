import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import {
  getProjectDetail,
  updateProject,
  recalculateProjectProgress,
} from "@/lib/queries/projects";
import { getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { instantiateTasksFromTemplates } from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

const bodySchema = z.object({
  product_id: z.coerce.number().int().positive(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { product_id } = validation.data;

    const project = await getProjectDetail(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (project.product_id !== null) {
      return NextResponse.json(
        { error: "Este proyecto ya tiene un producto asignado" },
        { status: 409 }
      );
    }

    // Set product on the project
    await updateProject(projectId, { product_id });

    // Instantiate task templates for V1
    const adjustments = await getAdjustmentsByProject(projectId);
    const v1 = adjustments.find(a => a.version_number === 1);
    
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;

    const commercialUserId = project.created_by ?? null;
    await instantiateTasksFromTemplates(projectId, product_id, commercialUserId, v1?.id, currentUserId);

    // Recalculate progress
    await recalculateProjectProgress(projectId);

    const updated = await getProjectDetail(projectId);
    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("Error adding product to project:", error);
    return NextResponse.json({ error: "Error al agregar producto al proyecto" }, { status: 500 });
  }
}
