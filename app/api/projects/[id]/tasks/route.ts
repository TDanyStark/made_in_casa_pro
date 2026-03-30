import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getTasksByProject, createProjectTask } from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { db } from "@/lib/db";

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().int().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
  task_flag: z.enum(["new", "correction", "adjustment"]).optional().default("new"),
  requires_quote: z.coerce.number().int().min(0).max(1).optional().default(0),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional().default(0),
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
  const tasks = await getTasksByProject(parseInt(id));
  return NextResponse.json(tasks);
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
    const validation = taskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    // Get next order_index for this project
    const orderResult = await db.execute({
      sql: `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM project_tasks WHERE project_id = $1`,
      args: [projectId],
    });
    const nextOrder = Number((orderResult.rows[0] as unknown as { next_order: number }).next_order);

    const task = await createProjectTask({
      project_id: projectId,
      title: validation.data.title,
      description: validation.data.description ?? null,
      area_id: validation.data.area_id ?? null,
      assigned_user_id: validation.data.assigned_user_id ?? null,
      status: validation.data.status ?? "not_started",
      task_type: validation.data.task_type ?? "execution",
      task_flag: validation.data.task_flag ?? "new",
      requires_quote: validation.data.requires_quote ?? 0,
      assign_to_commercial: validation.data.assign_to_commercial ?? 0,
      order_index: nextOrder,
    });

    await recalculateProjectProgress(projectId);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating project task:", error);
    return NextResponse.json({ error: "Error al crear tarea" }, { status: 500 });
  }
}
