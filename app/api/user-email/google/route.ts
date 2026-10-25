import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import {
  generateUserGmailAuthUrl,
  GMAIL_OAUTH_CALLBACK_PATH,
  GMAIL_OAUTH_STATE_COOKIE,
} from "@/lib/services/userGmailOAuth";
import { createOAuthState, setOAuthStateCookie } from "@/lib/session";
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    // Anti-CSRF: el callback solo acepta la respuesta con este mismo state.
    const state = createOAuthState();
    const authUrl = await generateUserGmailAuthUrl(appUrl, state);
    return setOAuthStateCookie(
      NextResponse.redirect(authUrl),
      GMAIL_OAUTH_STATE_COOKIE,
      state,
      GMAIL_OAUTH_CALLBACK_PATH
    );
  } catch (error) {
    console.error("Error generating user Gmail auth URL:", error);
    const message = error instanceof Error ? error.message : "Error al generar URL de autorización";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
