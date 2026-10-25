import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { domainErrorResponse } from "@/lib/services/api-errors";
import { createProject, getProjectsWithPagination } from "@/lib/queries/projects";
import { parsePagination } from "@/lib/utils/pagination";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { PROJECT_EDIT_ROLES, PROJECT_VIEW_ROLES } from "@/lib/role-groups";
import { UserRole } from "@/lib/definitions";
import {
  isSupportedProjectDateTime,
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from "@/lib/utils/project-date-time";
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

const projectSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(300),
  brand_id: z.coerce.number().int().positive("La marca es requerida"),
  manager_id: z.coerce.number().int().positive("El gerente es requerido"),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  campaign_id: z.coerce.number().int().positive().optional().nullable(),
  drive_folder_id: z.string().optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  ideal_delivery_at: projectDateTimeSchema.optional().nullable(),
  oc: nullableTextSchema,
  billing_closed_at: projectDateTimeSchema.optional().nullable(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_VIEW_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    if (!pagination.success) return pagination.response;
    const { page, limit } = pagination;
    const search = url.searchParams.get("search") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const brandId = url.searchParams.get("brand_id") ? parseInt(url.searchParams.get("brand_id")!) : undefined;
    const managerId = url.searchParams.get("manager_id") ? parseInt(url.searchParams.get("manager_id")!) : undefined;
    const clientId = url.searchParams.get("client_id") ? parseInt(url.searchParams.get("client_id")!) : undefined;
    const campaignId = url.searchParams.get("campaign_id") ? parseInt(url.searchParams.get("campaign_id")!) : undefined;

    // Restringir visibilidad según el rol del usuario:
    //   - Colaborador: solo proyectos con al menos una tarea asignada a él
    //   - Comercial: solo proyectos que él creó
    //   - Admin / Directivo / Financiero: ven todo
    const sessionCookie = (await cookies()).get("session")?.value;
    const session = sessionCookie ? await decrypt(sessionCookie) : null;
    let assignedUserId: number | undefined;
    let createdById: number | undefined;
    if (session?.id) {
      // Rol vigente en BD (validateApiRole), no el del JWT
      if (roleValidation.userRole === UserRole.COLABORADOR) {
        assignedUserId = session.id;
      } else if (roleValidation.userRole === UserRole.COMERCIAL) {
        createdById = session.id;
      }
    }

    const { projects, total } = await getProjectsWithPagination({
      page, limit, search, status, brandId, managerId, clientId, campaignId,
      assignedUserId, createdById,
    });

    const pageCount = Math.ceil(total / limit);
    return NextResponse.json({ data: projects, pageCount, currentPage: page, total });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Error al obtener proyectos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    // Get current user id from session for created_by
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const createdBy = session?.id ?? null;

    const body = await request.json();
    const validation = projectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos de proyecto inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const project = await createProject({
      ...validation.data,
      created_by: createdBy,
    });
    const driveWarning = project.drive_folder_id
      ? await syncProjectDriveAccess(project.id)
      : null;
    return NextResponse.json(
      { ...project, ...(driveWarning ? { driveWarning } : {}) },
      { status: 201 }
    );
  } catch (error) {
    const domain = domainErrorResponse(error);
    if (domain) return domain;
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
}
