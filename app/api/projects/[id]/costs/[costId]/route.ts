import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { deleteProjectCost, getProjectCost, updateProjectCost } from "@/lib/queries/projectCosts";
import { ProjectCostError } from "@/lib/definitions";
import { PROJECT_COSTS_ROLES } from "@/lib/role-groups";
import {
  forbidUnlessAllowed,
  getSessionUserId,
  parseBody,
  parsePositiveId,
  updateCostSchema,
} from "../shared";

// Spec: odd/tasks/project-costs.md — S2 (edit/delete: any of the cost roles), S5, S6.

type Params = { params: Promise<{ id: string; costId: string }> };

const COST_NOT_FOUND = { error: "Costo no encontrado" };

/** Shared checks: method, role, ids, own project for commercials, cost of this project. */
async function authorize(request: NextRequest, { params }: Params, method: "PATCH" | "DELETE") {
  const methodValidation = validateHttpMethod(request, [method]);
  if (!methodValidation.isValidMethod) return { response: methodValidation.response };

  const roleValidation = await validateApiRole(request, PROJECT_COSTS_ROLES);
  if (!roleValidation.isAuthorized) return { response: roleValidation.response };

  const raw = await params;
  const projectId = parsePositiveId(raw.id);
  if (!projectId) return { response: NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 }) };
  const costId = parsePositiveId(raw.costId);
  if (!costId) return { response: NextResponse.json({ error: "ID de costo inválido" }, { status: 400 }) };

  const forbidden = await forbidUnlessAllowed(projectId, roleValidation.userRole);
  if (forbidden) return { response: forbidden };

  const cost = await getProjectCost(projectId, costId);
  if (!cost) return { response: NextResponse.json(COST_NOT_FOUND, { status: 404 }) };
  return { projectId, costId };
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const auth = await authorize(request, context, "PATCH");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, updateCostSchema);
    if ("response" in parsed) return parsed.response;

    const cost = await updateProjectCost(auth.projectId, auth.costId, parsed.data, await getSessionUserId());
    if (!cost) return NextResponse.json(COST_NOT_FOUND, { status: 404 });
    return NextResponse.json(cost);
  } catch (error) {
    if (error instanceof ProjectCostError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating project cost:", error);
    return NextResponse.json({ error: "Error al guardar el costo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    const auth = await authorize(request, context, "DELETE");
    if ("response" in auth) return auth.response;

    const deleted = await deleteProjectCost(auth.projectId, auth.costId);
    if (!deleted) return NextResponse.json(COST_NOT_FOUND, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project cost:", error);
    return NextResponse.json({ error: "Error al eliminar el costo" }, { status: 500 });
  }
}
