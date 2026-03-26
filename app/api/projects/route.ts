import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { createProject, getProjectsWithPagination } from "@/lib/queries/projects";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const projectSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(300),
  brand_id: z.coerce.number().int().positive("La marca es requerida"),
  manager_id: z.coerce.number().int().positive("El gerente es requerido"),
  campaign_id: z.coerce.number().int().positive().optional().nullable(),
  drive_folder_id: z.string().optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const brandId = url.searchParams.get("brand_id") ? parseInt(url.searchParams.get("brand_id")!) : undefined;
    const managerId = url.searchParams.get("manager_id") ? parseInt(url.searchParams.get("manager_id")!) : undefined;
    const campaignId = url.searchParams.get("campaign_id") ? parseInt(url.searchParams.get("campaign_id")!) : undefined;

    const { projects, total } = await getProjectsWithPagination({
      page, limit, search, status, brandId, managerId, campaignId,
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

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
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
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
}
