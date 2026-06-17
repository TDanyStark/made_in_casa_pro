import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";
import { getUserEmailConnection, markEmailConnectionInvalid } from "@/lib/queries/userEmailConnections";
import { getAppSettings } from "@/lib/queries/settings";
import { google } from "googleapis";

// ---------------------------------------------------------------------------
// POST /api/user-email/test-send
//
// Sends a real test email from the authenticated user's connected Gmail account
// to themselves, and returns a detailed diagnostic report.
// Admin only.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const session = await getCurrentSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  // Optional: test a specific user id (admin testing another user's connection)
  const targetUserId: number = body.user_id ?? session.id;

  const report: Record<string, unknown> = {
    target_user_id: targetUserId,
    steps: [],
  };

  const steps = report.steps as Array<{ step: string; ok: boolean; detail?: string }>;

  try {
    // ── Step 1: Load connection ───────────────────────────────────────────
    const connection = await getUserEmailConnection(targetUserId);
    steps.push({
      step: "load_connection",
      ok: !!connection,
      detail: connection
        ? `status=${connection.status} email=${connection.email}`
        : "No connection found in DB",
    });

    if (!connection) {
      return NextResponse.json({ ok: false, report }, { status: 200 });
    }

    if (connection.status !== "connected" || !connection.refresh_token) {
      steps.push({
        step: "connection_valid",
        ok: false,
        detail: `Connection status is '${connection.status}' — user must reconnect Gmail`,
      });
      return NextResponse.json({ ok: false, report }, { status: 200 });
    }

    steps.push({ step: "connection_valid", ok: true, detail: `Gmail connected as ${connection.email}` });

    // ── Step 2: Load OAuth credentials ───────────────────────────────────
    const settings = await getAppSettings();
    const hasClientId = !!settings.google_oauth_client_id;
    const hasClientSecret = !!settings.google_oauth_client_secret;

    steps.push({
      step: "oauth_credentials",
      ok: hasClientId && hasClientSecret,
      detail: `client_id=${hasClientId ? "present" : "MISSING"} client_secret=${hasClientSecret ? "present" : "MISSING"}`,
    });

    if (!hasClientId || !hasClientSecret) {
      return NextResponse.json({ ok: false, report }, { status: 200 });
    }

    // ── Step 3: Build OAuth2 client ───────────────────────────────────────
    const oauth2Client = new google.auth.OAuth2(
      settings.google_oauth_client_id!,
      settings.google_oauth_client_secret!
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
      access_token: connection.access_token ?? undefined,
    });

    steps.push({ step: "oauth2_client_built", ok: true });

    // ── Step 4: Refresh access token explicitly ───────────────────────────
    try {
      const tokenResponse = await oauth2Client.refreshAccessToken();
      const newAccessToken = tokenResponse.credentials.access_token;
      steps.push({
        step: "token_refresh",
        ok: !!newAccessToken,
        detail: newAccessToken ? "Token refreshed successfully" : "No access token returned",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: "token_refresh", ok: false, detail: msg });

      const isPermanent =
        msg.includes("invalid_grant") ||
        msg.includes("Token has been expired") ||
        msg.includes("Requested entity was not found") ||
        msg.includes("insufficient authentication scopes") ||
        msg.includes("Request had insufficient authentication scopes");

      if (isPermanent) {
        await markEmailConnectionInvalid(targetUserId, msg);
        steps.push({ step: "connection_marked_invalid", ok: true, detail: msg });
      }

      return NextResponse.json({ ok: false, report }, { status: 200 });
    }

    // ── Step 5: Check gmail.send scope ────────────────────────────────────
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(
        (await oauth2Client.getAccessToken()).token ?? ""
      );
      const scopes: string[] = tokenInfo.scopes ?? [];
      const hasSendScope = scopes.includes("https://www.googleapis.com/auth/gmail.send");
      steps.push({
        step: "gmail_send_scope",
        ok: hasSendScope,
        detail: `Scopes: ${scopes.join(", ")}`,
      });

      if (!hasSendScope) {
        return NextResponse.json({ ok: false, report }, { status: 200 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: "gmail_send_scope", ok: false, detail: msg });
      return NextResponse.json({ ok: false, report }, { status: 200 });
    }

    // ── Step 6: Send test email ───────────────────────────────────────────
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const fromAddress = `"Made in Casa Test" <${connection.email}>`;
    const toAddress = connection.email;
    const subject = "Test de conexión Gmail — Made in Casa";
    const body_text = `Este es un correo de prueba enviado desde Made in Casa para verificar que la conexión Gmail de ${connection.email} funciona correctamente.\n\nFecha: ${new Date().toISOString()}`;
    const body_html = `<p>Este es un correo de prueba enviado desde <strong>Made in Casa</strong> para verificar que la conexión Gmail de <strong>${connection.email}</strong> funciona correctamente.</p><p style="color:#888;font-size:12px;">Fecha: ${new Date().toISOString()}</p>`;

    const raw = [
      `From: ${fromAddress}`,
      `To: ${toAddress}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="testboundary"`,
      ``,
      `--testboundary`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body_text,
      ``,
      `--testboundary`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      body_html,
      ``,
      `--testboundary--`,
    ].join("\r\n");

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      steps.push({
        step: "send_test_email",
        ok: true,
        detail: `Sent! gmail_message_id=${res.data.id} thread_id=${res.data.threadId}`,
      });

      return NextResponse.json({ ok: true, report }, { status: 200 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: "send_test_email", ok: false, detail: msg });

      const isPermanent =
        msg.includes("invalid_grant") ||
        msg.includes("Requested entity was not found") ||
        msg.includes("insufficient authentication scopes") ||
        msg.includes("Request had insufficient authentication scopes");

      if (isPermanent) {
        await markEmailConnectionInvalid(targetUserId, msg);
        steps.push({ step: "connection_marked_invalid", ok: true, detail: msg });
      }

      return NextResponse.json({ ok: false, report }, { status: 200 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    steps.push({ step: "unexpected_error", ok: false, detail: msg });
    return NextResponse.json({ ok: false, report }, { status: 500 });
  }
}
