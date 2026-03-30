import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import {
  getProjectProducts,
  addProductToProject,
  getProjectDetail,
} from "@/lib/queries/projects";
import { instantiateTasksFromTemplates } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { createProductFolder } from "@/lib/services/googleDrive";
import { getProductById } from "@/lib/queries/products";

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

    let { product_id, drive_folder_id, drive_folder_url } = validation.data;

    // Get project to resolve details
    const project = await getProjectDetail(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // If drive info is not provided but the project has a drive folder, create one for the product
    if (!drive_folder_id && project.drive_folder_id) {
      try {
        const product = await getProductById(product_id);
        if (product) {
          const driveRes = await createProductFolder(project.drive_folder_id, product.name);
          drive_folder_id = driveRes.folderId;
          drive_folder_url = driveRes.folderUrl;
          
          // Note: In a real scenario, we might want to share this folder too.
          // But createProductFolder doesn't currently take emails.
          // For now, it will be created under the project folder which is already shared.
        }
      } catch (e) {
        console.error("Error creating product drive folder:", e);
      }
    }

    const commercialUserId = project.created_by ?? null;

    // Add product → get project_product id
    const projectProductId = await addProductToProject(projectId, product_id, drive_folder_id, drive_folder_url);

    // Instantiate task templates as project tasks
    // Pass commercialUserId so assign_to_commercial=1 tasks get the project creator assigned
    await instantiateTasksFromTemplates(projectId, projectProductId, product_id, commercialUserId);

    // Recalculate progress
    await recalculateProjectProgress(projectId);

    const products = await getProjectProducts(projectId);
    return NextResponse.json(products, { status: 201 });
  } catch (error) {
    console.error("Error adding product to project:", error);
    return NextResponse.json({ error: "Error al agregar producto al proyecto" }, { status: 500 });
  }
}

