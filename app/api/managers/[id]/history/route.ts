import { NextRequest, NextResponse } from "next/server";
import {
  getManagerById,
  getManagerClientHistory,
} from "@/lib/queries/managers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string }> };

/** Trayectoria del gerente entre clientes. */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const managerId = parseInt(id);
    if (Number.isNaN(managerId)) {
      return NextResponse.json({ error: "Gerente inválido" }, { status: 400 });
    }

    const manager = await getManagerById(id);
    if (!manager) {
      return NextResponse.json(
        { error: "El gerente no existe" },
        { status: 404 }
      );
    }

    const history = await getManagerClientHistory(managerId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching manager client history:", error);
    return NextResponse.json(
      { error: "Error al obtener el historial del gerente" },
      { status: 500 }
    );
  }
}
