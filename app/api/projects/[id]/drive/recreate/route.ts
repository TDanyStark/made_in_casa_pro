import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  getProjectDetail,
  getProjectStakeholderEmails,
  updateProject,
  userCanAccessProject,
} from "@/lib/queries/projects";
import { createProjectFolders } from "@/lib/services/googleDrive";
import { PROJECT_EDIT_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/drive/recreate
 *
 * Recrea (o reutiliza, si ya existe) la cadena de carpetas de Drive
 * `Made In Casa / {cliente} / {marca} / {proyecto}` para un proyecto
 * existente, y persiste `drive_folder_id`/`drive_folder_url`.
 *
 * Pensado para reparar proyectos con `drive_folder_url` huérfano/obsoleto
 * (p.ej. tras la migración de service-account a OAuth).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = Number(id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!await userCanAccessProject(projectId, Number(session.id), roleValidation.userRole)) {
      return NextResponse.json({ error: "Acceso prohibido" }, { status: 403 });
    }

    const project = await getProjectDetail(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Email del usuario que ejecuta la acción (igual que create-folder).
    const creatorEmail = session?.email ?? null;

    const stakeholderEmails = await getProjectStakeholderEmails(projectId);
    const shareEmails = [...stakeholderEmails, ...(creatorEmail ? [creatorEmail] : [])];

    const result = await createProjectFolders({
      clientName: project.client_name,
      brandName: project.brand_name,
      projectTitle: project.title,
      shareEmails,
    });

    const updated = await updateProject(
      projectId,
      {
        drive_folder_id: result.projectFolderId,
        drive_folder_url: result.projectFolderUrl,
      },
      session?.id ?? null
    );

    if (!updated) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(
      { projectFolderId: result.projectFolderId, projectFolderUrl: result.projectFolderUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error recreating Drive folder:", error);
    return NextResponse.json(
      { error: "Error al recrear la carpeta en Drive" },
      { status: 500 }
    );
  }
}
