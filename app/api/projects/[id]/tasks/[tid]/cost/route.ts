import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTaskCost, updateTaskCost, type TaskCostUpdateResult } from "@/lib/queries/taskCost";
import { LEADERSHIP_ROLES, TASK_COST_EDIT_ROLES } from "@/lib/role-groups";

const COST_ERROR = "El costo debe ser un número mayor o igual a 0";

const patchSchema = z.object({
  completion_cost: z
    .number({ required_error: COST_ERROR, invalid_type_error: COST_ERROR })
    .nonnegative(COST_ERROR),
});

const REJECTIONS: Record<Exclude<TaskCostUpdateResult, "updated">, { error: string; status: number }> = {
  not_found: { error: "Tarea no encontrada", status: 404 },
  not_completed: { error: "Solo se puede corregir el costo de una tarea completada", status: 400 },
  internal: {
    error: "El costo de una tarea interna se calcula con el sueldo y no se puede editar",
    status: 400,
  },
};

type Params = { params: Promise<{ id: string; tid: string }> };

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * GET /api/projects/[id]/tasks/[tid]/cost
 * How much one task cost and why (frozen/current rate, declared price or quote).
 * Admin, directivo and financiero only.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, LEADERSHIP_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id, tid } = await params;
  const projectId = parseId(id);
  const taskId = parseId(tid);
  if (!projectId || !taskId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const cost = await getTaskCost(projectId, taskId);
    if (!cost) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    return NextResponse.json(cost);
  } catch (error) {
    console.error("Error fetching task cost:", error);
    return NextResponse.json({ error: "Error al obtener el costo de la tarea" }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/tasks/[tid]/cost
 * Corrects the cost of a completed external task (0 allowed) and records who
 * corrected it and the value first declared. Admin and directivo only.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, TASK_COST_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id, tid } = await params;
  const projectId = parseId(id);
  const taskId = parseId(tid);
  if (!projectId || !taskId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: COST_ERROR }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: COST_ERROR }, { status: 400 });

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const result = await updateTaskCost(projectId, taskId, parsed.data.completion_cost, session.id);
    if (result !== "updated") {
      const { error, status } = REJECTIONS[result];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json(await getTaskCost(projectId, taskId));
  } catch (error) {
    console.error("Error updating task cost:", error);
    return NextResponse.json({ error: "Error al corregir el costo de la tarea" }, { status: 500 });
  }
}
