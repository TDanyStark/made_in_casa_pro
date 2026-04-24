// ---------------------------------------------------------------------------
// Reusable email components — call these inside any template body.
// All styles are inline for email-client compatibility.
// ---------------------------------------------------------------------------

import { BRAND_COLOR, TEXT_DARK, TEXT_MUTED, BORDER_COLOR } from "./layout";

// ── Typography ───────────────────────────────────────────────────────────────

export function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;color:${TEXT_DARK};font-size:22px;font-weight:700;line-height:1.3;">${text}</h1>`;
}

export function subheading(text: string): string {
  return `<h2 style="margin:0 0 16px;color:${TEXT_MUTED};font-size:14px;font-weight:500;line-height:1.5;">${text}</h2>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">${text}</p>`;
}

export function muted(text: string): string {
  return `<p style="margin:0 0 12px;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">${text}</p>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER_COLOR};margin:24px 0;" />`;
}

// ── Buttons ──────────────────────────────────────────────────────────────────

export function primaryButton(label: string, href: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background:linear-gradient(135deg,#ec4899 0%,#7c3aed 100%);border-radius:8px;padding:1px;">
      <a href="${href}"
         target="_blank"
         style="display:inline-block;background:transparent;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;text-decoration:none;border-radius:7px;letter-spacing:0.2px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function secondaryButton(label: string, href: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;">
  <tr>
    <td style="border:1px solid ${BORDER_COLOR};border-radius:8px;">
      <a href="${href}"
         target="_blank"
         style="display:inline-block;color:${TEXT_DARK};font-size:14px;font-weight:500;padding:10px 24px;text-decoration:none;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

// ── Info Cards ───────────────────────────────────────────────────────────────

export function infoCard(
  rows: Array<{ label: string; value: string }>
): string {
  const rowsHtml = rows
    .map(
      ({ label, value }) => `
<tr>
  <td style="padding:8px 0;color:${TEXT_MUTED};font-size:13px;white-space:nowrap;width:1%;padding-right:20px;">${label}</td>
  <td style="padding:8px 0;color:${TEXT_DARK};font-size:13px;">${escapeHtml(value)}</td>
</tr>`
    )
    .join("");

  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%"
  style="background:#f9fafb;border:1px solid ${BORDER_COLOR};border-radius:8px;padding:16px 20px;margin:20px 0;">
  <tbody>${rowsHtml}</tbody>
</table>`;
}

export function badge(text: string, color = BRAND_COLOR): string {
  return `<span style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}33;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;">${escapeHtml(text)}</span>`;
}

// ── Rich-text note block ─────────────────────────────────────────────────────

export function noteBlock(html: string): string {
  return `
<div style="background:#f0f9ff;border-left:4px solid ${BRAND_COLOR};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="margin:0 0 6px;color:${BRAND_COLOR};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Notas</p>
  <div style="color:${TEXT_DARK};font-size:14px;line-height:1.6;">${html}</div>
</div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
