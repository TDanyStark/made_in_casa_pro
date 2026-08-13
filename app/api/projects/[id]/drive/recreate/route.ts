import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectDetail, updateProject } from "@/lib/queries/projects";
import { getAdminAndLeadershipEmails } from "@/lib/queries/users";
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
    const projectId = parseInt(id);

    const project = await getProjectDetail(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Email del usuario que ejecuta la acción (igual que create-folder).
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const creatorEmail = session?.email ?? null;

    const adminEmails = await getAdminAndLeadershipEmails();
    const shareEmails = [...adminEmails, ...(creatorEmail ? [creatorEmail] : [])];

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
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error al recrear la carpeta en Drive", detail: message },
      { status: 500 }
    );
  }
}
