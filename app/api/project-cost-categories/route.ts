import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createCostCategory, listCostCategories } from "@/lib/queries/projectCosts";
import { PROJECT_COSTS_ROLES } from "@/lib/role-groups";
import { getSessionUserId, parseBody } from "@/api/projects/[id]/costs/shared";

// Spec: odd/tasks/project-costs.md — S2, S6: searchable category list that creates missing ones inline.

const NAME_REQUIRED = "El nombre de la categoría es obligatorio";

const createSchema = z.object({
  name: z
    .string({ required_error: NAME_REQUIRED, invalid_type_error: NAME_REQUIRED })
    .trim()
    .min(1, NAME_REQUIRED)
    .max(80, "El nombre de la categoría es demasiado largo"),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_COSTS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    return NextResponse.json({ data: await listCostCategories() });
  } catch (error) {
    console.error("Error fetching project cost categories:", error);
    return NextResponse.json({ error: "Error al obtener las categorías" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_COSTS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const parsed = await parseBody(request, createSchema);
    if ("response" in parsed) return parsed.response;

    // Duplicate names (case-insensitive) return the existing category instead of failing.
    const { category, created } = await createCostCategory(parsed.data.name, await getSessionUserId());
    return NextResponse.json(category, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("Error creating project cost category:", error);
    return NextResponse.json({ error: "Error al crear la categoría" }, { status: 500 });
  }
}
