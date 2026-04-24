import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { PROJECT_VIEW_ROLES } from "@/lib/role-groups";
import { getDeliveriesByProject } from "@/lib/queries/notificationDeliveries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_VIEW_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const deliveries = await getDeliveriesByProject(projectId, limit);
    return NextResponse.json({ data: deliveries });
  } catch (error) {
    console.error("Error fetching project notification deliveries:", error);
    return NextResponse.json(
      { error: "Error al obtener historial de emails del proyecto" },
      { status: 500 }
    );
  }
}
