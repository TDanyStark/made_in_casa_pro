import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { deleteProjectAdjustment } from "@/lib/queries/adjustments";
import { LEADERSHIP_ROLES } from "@/lib/role-groups";

const paramsSchema = z.object({
  id: z.string().transform(Number),
  aid: z.string().transform(Number),
});

type Params = { params: Promise<{ id: string; aid: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, LEADERSHIP_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, aid } = paramsSchema.parse(await params);
    await deleteProjectAdjustment(aid, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting adjustment:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar ajuste";
    if (message.includes("No se puede eliminar")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}