import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/services/api-session";
import {
  createUserGmailOAuthClient,
  getGoogleAccountEmail,
  USER_GMAIL_SCOPES,
} from "@/lib/services/userGmailOAuth";
import { createUserEmailConnection, getUserEmailConnection } from "@/lib/queries/userEmailConnections";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/connect-email?email_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/connect-email?email_error=no_code`);
  }

  const session = await getCurrentSession();
  if (!session?.id) {
    return NextResponse.redirect(`${appUrl}/?email_error=unauthorized`);
  }

  try {
    const oauth2Client = await createUserGmailOAuthClient(appUrl);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const existingConnection = await getUserEmailConnection(session.id);
    const refreshToken = tokens.refresh_token ?? existingConnection?.refresh_token ?? null;

    if (!refreshToken) {
      return NextResponse.redirect(`${appUrl}/connect-email?email_error=no_refresh_token`);
    }

    const connectedEmail = await getGoogleAccountEmail(oauth2Client, tokens.id_token);
    if (!connectedEmail) {
      return NextResponse.redirect(`${appUrl}/connect-email?email_error=no_email`);
    }

    await createUserEmailConnection({
      user_id: session.id,
      email: connectedEmail,
      access_token: tokens.access_token ?? null,
      refresh_token: refreshToken,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ?? USER_GMAIL_SCOPES.join(" "),
    });

    return NextResponse.redirect(`${appUrl}/connect-email?email_success=1`);
  } catch (err) {
    console.error("Error in user Gmail OAuth callback:", err);
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(`${appUrl}/connect-email?email_error=${encodeURIComponent(message)}`);
  }
}
