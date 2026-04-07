import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getPendingQuoteInvitationsCount } from "@/lib/queries/taskQuotes";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

/**
 * GET /api/my-quotes/count
 * Returns the count of pending quote invitations for the current user.
 * Lightweight endpoint used for the sidebar notification badge.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const count = await getPendingQuoteInvitationsCount(session.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching pending quote invitations count:", error);
    return NextResponse.json({ error: "Error al obtener conteo de cotizaciones" }, { status: 500 });
  }
}
