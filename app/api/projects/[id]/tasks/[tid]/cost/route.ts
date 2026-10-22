import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTaskCost } from "@/lib/queries/taskCost";
import { LEADERSHIP_ROLES } from "@/lib/role-groups";

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
