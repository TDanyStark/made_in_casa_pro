import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import {
  getProjectProducts,
  addProductToProject,
} from "@/lib/queries/projects";
import { instantiateTasksFromTemplates } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";

const bodySchema = z.object({
  product_id: z.coerce.number().int().positive(),
  drive_folder_id: z.string().optional().nullable(),
  drive_folder_url: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const products = await getProjectProducts(parseInt(id));
  return NextResponse.json(products);
}

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

    // Add product → get project_product id
    const projectProductId = await addProductToProject(projectId, product_id);

    // Instantiate task templates as project tasks
    await instantiateTasksFromTemplates(projectId, projectProductId, product_id);

    // Recalculate progress
    await recalculateProjectProgress(projectId);

    const products = await getProjectProducts(projectId);
    return NextResponse.json(products, { status: 201 });
  } catch (error) {
    console.error("Error adding product to project:", error);
    return NextResponse.json({ error: "Error al agregar producto al proyecto" }, { status: 500 });
  }
}
