import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { domainErrorResponse } from "@/lib/services/api-errors";
import { getProjectDetail, updateProject, deleteProject } from "@/lib/queries/projects";
import {
  LEADERSHIP_ROLES,
  PROJECT_EDIT_ROLES,
  PROJECT_VIEW_ROLES,
} from "@/lib/role-groups";
import {
  isSupportedProjectDateTime,
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from "@/lib/utils/project-date-time";
import { parseDriveFolderId } from "@/lib/utils/drive-url";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";

const projectDateTimeSchema = z
  .string()
  .trim()
  .refine(isSupportedProjectDateTime, "Formato de fecha y hora inválido")
  .transform(normalizeProjectDateTime);

const nullableTextSchema = z
  .string()
  .optional()
  .nullable()
  .transform(normalizeOptionalProjectText);

/**
 * Un string vacío se trata como "desvincular" (ver PATCH handler, que además
 * limpia drive_folder_id). Un string no vacío debe pertenecer a
 * drive.google.com; el `.refine` va ANTES de `.nullable().optional()` para
 * que null/undefined no lo ejecuten (comportamiento existente intacto).
 */
const driveFolderUrlSchema = z
  .string()
  .refine((value) => {
    if (value === "") return true;
    try {
      return new URL(value).hostname.endsWith("drive.google.com");
    } catch {
      return false;
    }
  }, "La URL debe pertenecer a drive.google.com")
  .nullable()
  .optional();

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  /**
   * Reasignación de responsable. El nuevo gerente debe pertenecer al mismo
   * cliente del proyecto; si no, la capa de queries lanza MANAGER_CLIENT_MISMATCH
   * y aquí se devuelve 400.
   */
  manager_id: z.coerce.number().int().positive().optional(),
  campaign_id: z.coerce.number().int().positive().nullable().optional(),
  drive_folder_id: z.string().nullable().optional(),
  drive_folder_url: driveFolderUrlSchema,
  notes: z.string().nullable().optional(),
  ideal_delivery_at: projectDateTimeSchema.optional().nullable(),
  oc: nullableTextSchema,
  billing_closed_at: projectDateTimeSchema.optional().nullable(),
  status: z.enum(["active", "paused", "completed", "archived", "in_adjustments"]).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_VIEW_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const project = await getProjectDetail(parseInt(id));
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }
    // El actor queda registrado en project_manager_history si cambia el gerente
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;

    const data = { ...validation.data };
    if (typeof data.drive_folder_url === "string") {
      if (data.drive_folder_url === "") {
        // Desvincular: limpiar ambos campos, sin tocar Drive.
        data.drive_folder_url = null;
        data.drive_folder_id = null;
      } else {
        const parsedId = parseDriveFolderId(data.drive_folder_url);
        if (!parsedId) {
          return NextResponse.json(
            { error: "No se pudo extraer el id de la carpeta desde la URL" },
            { status: 400 }
          );
        }
        data.drive_folder_id = parsedId;
      }
    }

    const updated = await updateProject(
      parseInt(id),
      data,
      session?.id ?? null
    );
    if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    const driveWarning = data.manager_id !== undefined
      ? await syncProjectDriveAccess(parseInt(id))
      : null;
    return NextResponse.json({ ...updated, ...(driveWarning ? { driveWarning } : {}) });
  } catch (error) {
    const domain = domainErrorResponse(error);
    if (domain) return domain;
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Error al actualizar proyecto" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, LEADERSHIP_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    await deleteProject(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Error al eliminar proyecto" }, { status: 500 });
  }
}
