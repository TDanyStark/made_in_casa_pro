import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { UserRole } from "@/lib/definitions";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTasksCommandCenterWithPagination } from "@/lib/queries/projectTasks";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  includeCompleted: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
  creatorRole: z.enum(["admin", "directivo", "comercial"]).optional(),
  areaId: z.coerce.number().int().positive().optional(),
  assignedUserId: z.coerce.number().int().positive().optional(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  taskType: z.enum(["execution", "validation"]).optional(),
  taskFlag: z.enum(["new", "correction", "adjustment"]).optional(),
  assignedFrom: z.string().datetime({ offset: true }).optional(),
  assignedTo: z.string().datetime({ offset: true }).optional(),
  completedFrom: z.string().datetime({ offset: true }).optional(),
  completedTo: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.DIRECTIVO,
    UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const parsed = querySchema.safeParse(rawQuery);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros de consulta inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const query = parsed.data;
    const limit = ITEMS_PER_PAGE;

    const { tasks, total } = await getTasksCommandCenterWithPagination({
      page: query.page,
      limit,
      includeCompleted: query.includeCompleted ?? false,
      creatorRole: query.creatorRole,
      areaId: query.areaId,
      assignedUserId: query.assignedUserId,
      status: query.status,
      taskType: query.taskType,
      taskFlag: query.taskFlag,
      assignedFrom: query.assignedFrom ? new Date(query.assignedFrom) : undefined,
      assignedTo: query.assignedTo ? new Date(query.assignedTo) : undefined,
      completedFrom: query.completedFrom ? new Date(query.completedFrom) : undefined,
      completedTo: query.completedTo ? new Date(query.completedTo) : undefined,
    });

    const pageCount = Math.ceil(total / limit);

    return NextResponse.json({
      data: tasks,
      pageCount,
      currentPage: query.page,
      total,
    });
  } catch (error) {
    console.error("Error fetching tasks command center:", error);
    return NextResponse.json({ error: "Error al obtener las tareas" }, { status: 500 });
  }
}
