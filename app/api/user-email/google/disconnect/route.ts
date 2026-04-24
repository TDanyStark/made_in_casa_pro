import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { disconnectUserEmailConnection } from "@/lib/queries/userEmailConnections";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const session = await getCurrentSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await disconnectUserEmailConnection(session.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting user Gmail:", error);
    return NextResponse.json({ error: "Error al desconectar Gmail" }, { status: 500 });
  }
}
