import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const session = await getCurrentSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const connection = await getUserEmailConnection(session.id);
    return NextResponse.json({
      connected: connection?.status === "connected" && !!connection.refresh_token,
      status: connection?.status ?? "disconnected",
      email: connection?.email ?? null,
      last_error: connection?.last_error ?? null,
      updated_at: connection?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Error fetching user email status:", error);
    return NextResponse.json({ error: "Error al obtener estado de Gmail" }, { status: 500 });
  }
}
