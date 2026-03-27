import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getMyQuotes, getPendingQuoteInvitations } from "@/lib/queries/taskQuotes";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

/**
 * GET /api/my-quotes
 * Returns all quote invitations and submitted quotes for the current user.
 * Used for the external collaborator dashboard.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [quotes, invitations] = await Promise.all([
      getMyQuotes(session.id),
      getPendingQuoteInvitations(session.id),
    ]);

    return NextResponse.json({ quotes, invitations });
  } catch (error) {
    console.error("Error fetching my quotes:", error);
    return NextResponse.json({ error: "Error al obtener cotizaciones" }, { status: 500 });
  }
}
