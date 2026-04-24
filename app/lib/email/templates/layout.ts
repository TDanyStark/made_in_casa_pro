// ---------------------------------------------------------------------------
// Email layout — wraps every template in a consistent branded shell.
// Uses inline styles and table-based structure for max email-client compat.
// ---------------------------------------------------------------------------

const BRAND_GRADIENT = "background: linear-gradient(135deg, #ec4899 0%, #7c3aed 100%);";
const BRAND_COLOR = "#7c3aed";
const TEXT_DARK = "#1a1a2e";
const TEXT_MUTED = "#6b7280";
const BG_PAGE = "#f3f4f6";
const BG_CARD = "#ffffff";
const BORDER_COLOR = "#e5e7eb";

export function emailLayout({
  previewText,
  body,
  footerNote,
}: {
  previewText: string;
  body: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${previewText}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: ${BG_PAGE}; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .stack-col { display: block !important; width: 100% !important; }
      .mobile-pad { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG_PAGE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="${BRAND_GRADIENT}border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:10px;padding:10px 20px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Made in Casa</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background-color:${BG_CARD};padding:40px;border-left:1px solid ${BORDER_COLOR};border-right:1px solid ${BORDER_COLOR};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="mobile-pad" style="color:${TEXT_DARK};font-size:15px;line-height:1.6;">${body}</td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border:1px solid ${BORDER_COLOR};border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:${TEXT_MUTED};font-size:12px;line-height:1.6;">
                Este correo fue enviado automáticamente por el sistema <strong>Made in Casa Pro</strong>.<br/>
                ${footerNote ?? "Por favor no respondas directamente a este mensaje."}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { BRAND_COLOR, TEXT_DARK, TEXT_MUTED, BG_PAGE, BG_CARD, BORDER_COLOR };
