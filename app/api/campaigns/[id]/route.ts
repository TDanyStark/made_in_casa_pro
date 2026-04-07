import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCampaignById } from "@/lib/queries/campaigns";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { AUTHENTICATED_ROLES, LEADERSHIP_ROLES, OPERATIONS_ROLES } from "@/lib/role-groups";

const patchSchema = z.object({
  name: z.string().min(1).max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const campaign = await getCampaignById(parseInt(id));
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    await db.execute({
      sql: `UPDATE campaigns SET name = $1 WHERE id = $2`,
      args: [validation.data.name, parseInt(id)],
    });
    revalidatePath("/projects");
    const updated = await getCampaignById(parseInt(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating campaign:", error);
    return NextResponse.json({ error: "Error al actualizar campaña" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, LEADERSHIP_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    await db.execute({ sql: `DELETE FROM campaigns WHERE id = $1`, args: [parseInt(id)] });
    revalidatePath("/projects");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json({ error: "Error al eliminar campaña" }, { status: 500 });
  }
}
