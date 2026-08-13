import { NextRequest, NextResponse } from "next/server";
import { getManagerTransferPreview } from "@/lib/queries/managers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string }> };

/**
 * Qué arrastra un gerente si se traslada: marcas y proyectos activos que se
 * quedan en su cliente actual, más los gerentes de ese cliente que pueden
 * heredarlos.
 */
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

    const preview = await getManagerTransferPreview(managerId);
    if (!preview) {
      return NextResponse.json(
        { error: "El gerente no existe" },
        { status: 404 }
      );
    }

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error fetching manager transfer preview:", error);
    return NextResponse.json(
      { error: "Error al obtener la vista previa del traslado" },
      { status: 500 }
    );
  }
}
