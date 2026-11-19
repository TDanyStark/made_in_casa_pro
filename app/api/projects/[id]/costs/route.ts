import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  createProjectCost,
  getProjectCostsTotal,
  getProjectCostVersions,
  listProjectCosts,
} from "@/lib/queries/projectCosts";
import { ProjectCostError, resolveCostAdjustmentId } from "@/lib/definitions";
import { PROJECT_COSTS_ROLES } from "@/lib/role-groups";
import {
  createCostSchema,
  forbidUnlessAllowed,
  getSessionUserId,
  parseBody,
  parsePositiveId,
} from "./shared";

// Spec: odd/tasks/project-costs.md — S2, S5, S6.

type Params = { params: Promise<{ id: string }> };

const PROJECT_NOT_FOUND = { error: "Proyecto no encontrado" };

/** Optional ?adjustment_id: null when absent, NaN when present but not a positive integer. */
function parseAdjustmentId(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("adjustment_id");
  if (raw === null) return null;
  return parsePositiveId(raw) ?? NaN;
}

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_COSTS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const projectId = parsePositiveId((await params).id);
  if (!projectId) return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });

  try {
    const forbidden = await forbidUnlessAllowed(projectId, roleValidation.userRole);
    if (forbidden) return forbidden;

    const adjustmentId = parseAdjustmentId(request);
    if (Number.isNaN(adjustmentId)) {
      return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
    }

    const versions = await getProjectCostVersions(projectId);
    if (versions.length === 0) return NextResponse.json(PROJECT_NOT_FOUND, { status: 404 });
    if (adjustmentId !== null && !versions.some((v) => v.id === adjustmentId)) {
      return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
    }

    const [costs, totals] = await Promise.all([
      listProjectCosts(projectId, adjustmentId),
      getProjectCostsTotal(projectId, adjustmentId),
    ]);
    return NextResponse.json({ costs, ...totals, versions, adjustment_id: adjustmentId });
  } catch (error) {
    console.error("Error fetching project costs:", error);
    return NextResponse.json({ error: "Error al obtener los costos del proyecto" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_COSTS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const projectId = parsePositiveId((await params).id);
  if (!projectId) return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });

  try {
    const forbidden = await forbidUnlessAllowed(projectId, roleValidation.userRole);
    if (forbidden) return forbidden;

    const parsed = await parseBody(request, createCostSchema);
    if ("response" in parsed) return parsed.response;
    const data = parsed.data;

    const versions = await getProjectCostVersions(projectId);
    if (versions.length === 0) return NextResponse.json(PROJECT_NOT_FOUND, { status: 404 });
    // S5: the only version when there is one; required with 2+.
    const adjustmentId = resolveCostAdjustmentId(versions, data.adjustment_id);

    const cost = await createProjectCost(
      projectId,
      {
        adjustment_id: adjustmentId,
        category_id: data.category_id,
        description: data.description ?? null,
        amount: data.amount,
        incurred_at: data.incurred_at ?? null,
        task_id: data.task_id ?? null,
      },
      await getSessionUserId()
    );
    return NextResponse.json(cost, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectCostError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating project cost:", error);
    return NextResponse.json({ error: "Error al guardar el costo" }, { status: 500 });
  }
}
