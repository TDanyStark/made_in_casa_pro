import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import {
  getProjectTaskById,
  updateProjectTask,
  deleteProjectTask,
} from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  area_id: z.coerce.number().int().positive().nullable().optional(),
  assigned_user_id: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).optional(),
  task_flag: z.enum(["new", "correction", "adjustment"]).optional(),
  requires_quote: z.coerce.number().int().min(0).max(1).optional(),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { tid } = await params;
  const task = await getProjectTaskById(parseInt(tid));
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const updated = await updateProjectTask(parseInt(tid), validation.data);
    if (!updated) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    // Recalculate progress when status changes
    if (validation.data.status !== undefined) {
      await recalculateProjectProgress(projectId);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Error al actualizar tarea" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    await deleteProjectTask(parseInt(tid));
    await recalculateProjectProgress(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Error al eliminar tarea" }, { status: 500 });
  }
}
