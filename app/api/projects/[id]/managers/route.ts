import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { addCoManager, removeCoManager } from "@/lib/queries/projects";

const bodySchema = z.object({
  manager_id: z.coerce.number().int().positive(),
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
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "manager_id requerido" }, { status: 400 });
    }
    await addCoManager(parseInt(id), validation.data.manager_id);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding co-manager:", error);
    return NextResponse.json({ error: "Error al agregar co-responsable" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "manager_id requerido" }, { status: 400 });
    }
    await removeCoManager(parseInt(id), validation.data.manager_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing co-manager:", error);
    return NextResponse.json({ error: "Error al quitar co-responsable" }, { status: 500 });
  }
}
