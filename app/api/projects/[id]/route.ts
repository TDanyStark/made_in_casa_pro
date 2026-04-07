import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
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

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  campaign_id: z.coerce.number().int().positive().nullable().optional(),
  drive_folder_id: z.string().nullable().optional(),
  drive_folder_url: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
  ideal_delivery_at: projectDateTimeSchema.optional().nullable(),
  oc: nullableTextSchema,
  billing_closed_at: projectDateTimeSchema.optional().nullable(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
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
    const updated = await updateProject(parseInt(id), validation.data);
    if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
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
