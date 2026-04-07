import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { reorderProjectTasks } from "@/lib/queries/projectTasks";

const schema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
  adjustment_id: z.number().int().positive().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos", details: validation.error.format() }, { status: 400 });
    }
    const { orderedIds, adjustment_id } = validation.data;
    await reorderProjectTasks(parseInt(id), orderedIds, adjustment_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return NextResponse.json({ error: "Error al reordenar tareas" }, { status: 500 });
  }
}
