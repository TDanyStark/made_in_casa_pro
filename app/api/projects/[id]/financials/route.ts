import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectFinancials, updateProjectSalePrice } from "@/lib/queries/projectFinancials";
import { userCanAccessProject } from "@/lib/queries/projects";
import { UserRole } from "@/lib/definitions";
import {
  PROJECT_FINANCIALS_VIEW_ROLES,
  PROJECT_SALE_PRICE_EDIT_ROLES,
} from "@/lib/role-groups";

const SALE_PRICE_ERROR = "El precio de venta debe ser un número mayor o igual a 0";

const patchSchema = z.object({
  sale_price: z.number({ required_error: SALE_PRICE_ERROR, invalid_type_error: SALE_PRICE_ERROR })
    .nonnegative(SALE_PRICE_ERROR)
    .nullable(),
});

type Params = { params: Promise<{ id: string }> };

/** Comerciales solo acceden a proyectos que crearon; el resto de roles permitidos, a todos. */
async function forbidUnlessAllowed(projectId: number, userRole: UserRole) {
  if (userRole !== UserRole.COMERCIAL) return null;
  const cookie = (await cookies()).get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;
  const allowed = session?.id
    ? await userCanAccessProject(projectId, session.id, userRole)
    : false;
  return allowed
    ? null
    : NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
}

function parseProjectId(id: string) {
  const projectId = Number(id);
  return Number.isInteger(projectId) && projectId > 0 ? projectId : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_FINANCIALS_VIEW_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const projectId = parseProjectId((await params).id);
  if (!projectId) return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });

  try {
    const forbidden = await forbidUnlessAllowed(projectId, roleValidation.userRole);
    if (forbidden) return forbidden;

    const financials = await getProjectFinancials(projectId);
    if (!financials) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json(financials);
  } catch (error) {
    console.error("Error fetching project financials:", error);
    return NextResponse.json({ error: "Error al obtener la inversión del proyecto" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_SALE_PRICE_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const projectId = parseProjectId((await params).id);
  if (!projectId) return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });

  try {
    const forbidden = await forbidUnlessAllowed(projectId, roleValidation.userRole);
    if (forbidden) return forbidden;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: SALE_PRICE_ERROR }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: SALE_PRICE_ERROR }, { status: 400 });

    const updated = await updateProjectSalePrice(projectId, parsed.data.sale_price);
    if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    return NextResponse.json(await getProjectFinancials(projectId));
  } catch (error) {
    console.error("Error updating project sale price:", error);
    return NextResponse.json({ error: "Error al guardar el precio de venta" }, { status: 500 });
  }
}
