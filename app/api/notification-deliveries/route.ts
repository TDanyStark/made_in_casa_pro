import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";
import { getRecentDeliveries } from "@/lib/queries/notificationDeliveries";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const deliveries = await getRecentDeliveries(limit);
    return NextResponse.json({ data: deliveries });
  } catch (error) {
    console.error("Error fetching notification deliveries:", error);
    return NextResponse.json(
      { error: "Error al obtener historial de notificaciones" },
      { status: 500 }
    );
  }
}
