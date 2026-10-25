import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoles, createRole } from "@/lib/queries/roles";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ADMIN_ONLY_ROLES, AUTHENTICATED_ROLES } from "@/lib/role-groups";

const ROLE_REQUIRED_ERROR = "El nombre del rol es obligatorio";

const createRoleSchema = z.object({
  role: z.string({ required_error: ROLE_REQUIRED_ERROR, invalid_type_error: ROLE_REQUIRED_ERROR })
    .trim()
    .min(1, ROLE_REQUIRED_ERROR),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const result = await getRoles();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/roles:', error);
    return NextResponse.json(
      { error: 'Error al obtener los roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const parsed = createRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: ROLE_REQUIRED_ERROR }, { status: 400 });
  }

  try {
    const result = await createRole(parsed.data.role);

    return NextResponse.json({
      message: 'Rol creado exitosamente',
      id: Number(result.rows[0]?.id)
    }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/roles:', error);
    return NextResponse.json(
      { error: 'Error al crear el rol' },
      { status: 500 }
    );
  }
}
