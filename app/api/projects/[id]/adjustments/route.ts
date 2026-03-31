import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectById } from "@/lib/queries/projects";
import { createProjectAdjustment, getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { instantiateTasksFromTemplates } from "@/lib/queries/projectTasks";
import { createSubFolder } from "@/lib/services/googleDrive";
import { getAdminAndDirectivoEmails } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.DIRECTIVO,
    UserRole.COMERCIAL,
    UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const adjustments = await getAdjustmentsByProject(projectId);
    return NextResponse.json(adjustments);
  } catch (error) {
    console.error("Error al obtener ajustes:", error);
    return NextResponse.json({ error: "Error interno al obtener ajustes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.DIRECTIVO,
    UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (project.status !== "completed") {
      return NextResponse.json(
        { error: "No se puede crear un ajuste si el proyecto no está completado." },
        { status: 400 }
      );
    }

    const adjustments = await getAdjustmentsByProject(projectId);
    const lastAdjustment = adjustments[adjustments.length - 1];
    
    // Si hay un ajuste previo, debe estar completado
    if (lastAdjustment && lastAdjustment.status !== "completed") {
      return NextResponse.json(
        { error: "No se puede crear un ajuste si la versión anterior no está completada." },
        { status: 400 }
      );
    }

    const nextVersion = lastAdjustment ? lastAdjustment.version_number + 1 : 2;
    
    // Intentar crear la carpeta en Google Drive dentro de la original
    let adjustmentFolderId: string | null = null;
    let adjustmentFolderUrl: string | null = null;
    
    if (project.drive_folder_id) {
        try {
            // Get the email of the user creating the project adjustment
            const cookie = (await cookies()).get("session")?.value;
            const session = cookie ? await decrypt(cookie) : null;
            const creatorEmail = session?.email ?? null;

            // Collect admin/directivo emails from DB
            const adminEmails = await getAdminAndDirectivoEmails();

            const allEmails = [
            ...adminEmails,
            ...(creatorEmail ? [creatorEmail] : []),
            ];

            const driveRes = await createSubFolder({
                parentFolderId: project.drive_folder_id,
                folderName: `v${nextVersion}`,
                shareEmails: allEmails,
            });
            adjustmentFolderId = driveRes.folderId;
            adjustmentFolderUrl = driveRes.folderUrl;
        } catch (e) {
            console.error("No se pudo crear carpeta en Drive para el ajuste", e);
        }
    }

    const adjustment = await createProjectAdjustment({
      project_id: projectId,
      drive_folder_id: adjustmentFolderId,
      drive_folder_url: adjustmentFolderUrl,
    });

    if (project.product_id) {
      await instantiateTasksFromTemplates(
        projectId,
        project.product_id,
        project.created_by,
        adjustment.id
      );
    }

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error("Error al crear ajuste:", error);
    return NextResponse.json(
      { error: "Error interno al crear ajuste" },
      { status: 500 }
    );
  }
}
