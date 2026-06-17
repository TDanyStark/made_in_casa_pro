import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getUserEmailConnection, markEmailConnectionInvalid } from "@/lib/queries/userEmailConnections";
import { getAppSettings } from "@/lib/queries/settings";
import { google } from "googleapis";

function encodeRfc2047(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value;
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

// ---------------------------------------------------------------------------
// GET /api/user-email/test-send
//
// Sends a real test email from the logged-in user's connected Gmail account
// to themselves and returns a step-by-step diagnostic report.
// Accessible by any authenticated user.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const session = await getCurrentSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.id;
  const steps: Array<{ step: string; ok: boolean; detail?: string }> = [];

  try {
    // ── Step 1: Load connection ───────────────────────────────────────────
    const connection = await getUserEmailConnection(userId);
    steps.push({
      step: "load_connection",
      ok: !!connection,
      detail: connection
        ? `status=${connection.status} email=${connection.email}`
        : "No hay conexión Gmail registrada para este usuario",
    });

    if (!connection) {
      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }

    if (connection.status !== "connected" || !connection.refresh_token) {
      steps.push({
        step: "connection_valid",
        ok: false,
        detail: `Estado de la conexión: '${connection.status}' — debe reconectar Gmail`,
      });
      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }

    steps.push({ step: "connection_valid", ok: true, detail: `Conectado como ${connection.email}` });

    // ── Step 2: Load OAuth credentials ───────────────────────────────────
    const settings = await getAppSettings();
    const hasClientId = !!settings.google_oauth_client_id;
    const hasClientSecret = !!settings.google_oauth_client_secret;

    steps.push({
      step: "oauth_credentials",
      ok: hasClientId && hasClientSecret,
      detail: `client_id=${hasClientId ? "ok" : "FALTA"} client_secret=${hasClientSecret ? "ok" : "FALTA"}`,
    });

    if (!hasClientId || !hasClientSecret) {
      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }

    // ── Step 3: Build OAuth2 client & refresh token ───────────────────────
    const oauth2Client = new google.auth.OAuth2(
      settings.google_oauth_client_id!,
      settings.google_oauth_client_secret!
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
      access_token: connection.access_token ?? undefined,
    });

    try {
      const tokenResponse = await oauth2Client.refreshAccessToken();
      const newToken = tokenResponse.credentials.access_token;
      steps.push({
        step: "token_refresh",
        ok: !!newToken,
        detail: newToken ? "Token renovado correctamente" : "Google no devolvió access token",
      });
      if (!newToken) return NextResponse.json({ ok: false, steps }, { status: 200 });
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
        await markEmailConnectionInvalid(userId, msg);
        steps.push({ step: "connection_marked_invalid", ok: true, detail: "Conexión marcada como inválida en DB" });
      }

      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }

    // ── Step 4: Verify gmail.send scope ───────────────────────────────────
    try {
      const { token } = await oauth2Client.getAccessToken();
      const tokenInfo = await oauth2Client.getTokenInfo(token ?? "");
      const scopes: string[] = tokenInfo.scopes ?? [];
      const hasSendScope = scopes.includes("https://www.googleapis.com/auth/gmail.send");
      steps.push({
        step: "gmail_send_scope",
        ok: hasSendScope,
        detail: hasSendScope
          ? "Scope gmail.send presente"
          : `Scope gmail.send AUSENTE. Scopes actuales: ${scopes.join(", ")}`,
      });
      if (!hasSendScope) return NextResponse.json({ ok: false, steps }, { status: 200 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: "gmail_send_scope", ok: false, detail: msg });
      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }

    // ── Step 5: Send test email to self ───────────────────────────────────
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const subject = encodeRfc2047("Test de conexion Gmail - Made in Casa");
    const bodyText = `Este es un correo de prueba para verificar que la conexión Gmail de ${connection.email} funciona correctamente en Made in Casa.\n\nFecha: ${new Date().toISOString()}`;
    const bodyHtml = `<p>Este es un correo de prueba para verificar que la conexión Gmail de <strong>${connection.email}</strong> funciona correctamente en <strong>Made in Casa</strong>.</p><p style="color:#888;font-size:12px;">Fecha: ${new Date().toISOString()}</p>`;

    const raw = [
      `From: "Made in Casa" <${connection.email}>`,
      `To: ${connection.email}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="testboundary"`,
      ``,
      `--testboundary`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      bodyText,
      ``,
      `--testboundary`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      bodyHtml,
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
        detail: `Enviado. Revisa tu bandeja de entrada en ${connection.email}. gmail_id=${res.data.id}`,
      });

      return NextResponse.json({ ok: true, steps }, { status: 200 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step: "send_test_email", ok: false, detail: msg });

      const isPermanent =
        msg.includes("invalid_grant") ||
        msg.includes("Requested entity was not found") ||
        msg.includes("insufficient authentication scopes") ||
        msg.includes("Request had insufficient authentication scopes");

      if (isPermanent) {
        await markEmailConnectionInvalid(userId, msg);
        steps.push({ step: "connection_marked_invalid", ok: true, detail: "Conexión marcada como inválida en DB" });
      }

      return NextResponse.json({ ok: false, steps }, { status: 200 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    steps.push({ step: "unexpected_error", ok: false, detail: msg });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }
}
