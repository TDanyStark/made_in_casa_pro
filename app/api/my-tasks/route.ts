import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getMyTasksWithPagination } from "@/lib/queries/projectTasks";
import { getAppSettings } from "@/lib/queries/settings";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  statuses: z
    .array(
      z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"])
    )
    .optional()
    .transform((v) =>
      v && v.length > 0 ? Array.from(new Set(v)) : undefined
    ),
  brandId: z.coerce.number().int().positive().optional(),
  creatorUserId: z.coerce.number().int().positive().optional(),
  assignedFrom: z.string().datetime({ offset: true }).optional(),
  assignedTo: z.string().datetime({ offset: true }).optional(),
  q: z.string().min(1).optional(),
});

/**
 * GET /api/my-tasks
 * Returns paginated tasks assigned to the current user, with optional filters.
 * Used for the collaborator dashboard.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const statusValues = url.searchParams.getAll("status");
    const rawQuery = {
      ...Object.fromEntries(url.searchParams.entries()),
      statuses: statusValues.length > 0 ? statusValues : undefined,
    };

    const parsed = querySchema.safeParse(rawQuery);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Parámetros de consulta inválidos",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const query = parsed.data;
    const limit = ITEMS_PER_PAGE;

    const [{ tasks, total }, settings] = await Promise.all([
      getMyTasksWithPagination({
      userId: session.id,
      page: query.page,
      limit,
      statuses: query.statuses,
      brandId: query.brandId,
      creatorUserId: query.creatorUserId,
      assignedFrom: query.assignedFrom ? new Date(query.assignedFrom) : undefined,
      assignedTo: query.assignedTo ? new Date(query.assignedTo) : undefined,
      q: query.q,
      }),
      getAppSettings(),
    ]);

    const pageCount = Math.ceil(total / limit);

    return NextResponse.json({
      data: tasks,
      pageCount,
      currentPage: query.page,
      total,
      dailyReportTime: settings.daily_report_time,
    });
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}
