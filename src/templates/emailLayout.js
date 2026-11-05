/**
 * FORME Haute Couture Email Master Layout
 * Engineered for cross-client compatibility (Gmail, Apple Mail, Outlook, iOS, Android).
 * Features table-based layout, inlined styling, and fluid responsive design.
 */
import env from '../config/env.config.js';

export const renderMasterEmailLayout = ({
  preheader = '',
  heading,
  subtitle = '',
  badge = null,
  contentHtml,
  ctaLabel = null,
  ctaUrl = null,
  ctaSubtext = null,
  isMarketing = false,
  unsubscribeUrl = null,
  isAdmin = false,
}) => {
  const currentYear = new Date().getFullYear();
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  const defaultUnsubscribe = unsubscribeUrl || `${clientUrl}/account/preferences`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${heading} — FORME</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a { font-family: Georgia, serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #FAF8F5 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1C1917;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: #1C1917; text-decoration: underline; }
    .email-container { max-width: 600px !important; margin: 0 auto !important; width: 100% !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-headline { font-size: 22px !important; line-height: 28px !important; }
      .item-table td { font-size: 13px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5;">
  <!-- Preheader preview text for inbox scanners -->
  <div style="display: none; font-size: 1px; color: #FAF8F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader || heading} — FORME Contemporary Fashion House
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Outer Wrapper -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #E7E5E4; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
          
          <!-- Top Accent Gold Line -->
          <tr>
            <td height="3" style="background-color: #C5A880; font-size: 0px; line-height: 0px;">&nbsp;</td>
          </tr>

          <!-- Header / Brandmark -->
          <tr>
            <td align="center" style="padding: 36px 40px 24px; border-bottom: 1px solid #F5F3EF;" class="mobile-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: 0.28em; color: #121212; text-transform: uppercase;">
                      FORME
                    </span>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; color: #78716C; margin-top: 8px;">
                      Designed to Be Worn. Made to Be Remembered.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Editorial Banner / Badge (Optional) -->
          ${
            badge
              ? `<tr>
                  <td align="center" style="padding-top: 28px;">
                    <span style="display: inline-block; background-color: #FAF8F5; border: 1px solid #C5A880; color: #8A6D4B; font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; padding: 5px 14px; border-radius: 2px;">
                      ${badge}
                    </span>
                  </td>
                </tr>`
              : ''
          }

          <!-- Headline & Subtitle -->
          <tr>
            <td align="center" style="padding: ${badge ? '16px' : '36px'} 40px 8px;" class="mobile-padding">
              <h1 class="mobile-headline" style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 400; line-height: 32px; color: #121212; margin: 0; letter-spacing: 0.02em;">
                ${heading}
              </h1>
              ${
                subtitle
                  ? `<p style="font-size: 13px; color: #78716C; margin: 8px 0 0; line-height: 20px; font-style: italic;">${subtitle}</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 24px 40px 32px; font-size: 14px; line-height: 24px; color: #44403C;" class="mobile-padding">
              ${contentHtml}
            </td>
          </tr>

          <!-- Primary CTA Button (Optional) -->
          ${
            ctaLabel && ctaUrl
              ? `<tr>
                  <td align="center" style="padding: 0 40px 36px;" class="mobile-padding">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #121212; border-radius: 1px;">
                          <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #FAF8F5 !important; text-decoration: none;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ${
                      ctaSubtext
                        ? `<div style="font-size: 11px; color: #A8A29E; margin-top: 10px;">${ctaSubtext}</div>`
                        : ''
                    }
                  </td>
                </tr>`
              : ''
          }

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #FAF8F5; border-top: 1px solid #E7E5E4; padding: 32px 40px; text-align: center;" class="mobile-padding">
              <p style="font-family: 'Playfair Display', Georgia, serif; font-size: 13px; font-style: italic; color: #78716C; margin: 0 0 14px;">
                "Elegance is not about being noticed, it's about being remembered."
              </p>

              <div style="font-size: 11px; line-height: 18px; color: #78716C; margin-bottom: 16px;">
                <strong>FORME Contemporary Fashion House</strong><br>
                Client Concierge &bull; <a href="mailto:concierge@forme.store" style="color: #121212; text-decoration: none;">concierge@forme.store</a><br>
                Mumbai &bull; Paris &bull; New York &bull; Milan
              </div>

              ${
                isMarketing
                  ? `<div style="font-size: 10px; color: #A8A29E; margin-top: 14px; line-height: 16px; border-top: 1px solid #E7E5E4; padding-top: 14px;">
                      You received this dispatch because you subscribed to FORME Curations.<br>
                      <a href="${defaultUnsubscribe}" style="color: #78716C; text-decoration: underline;">Unsubscribe from promotional dispatches</a> &bull; 
                      <a href="${clientUrl}/account/preferences" style="color: #78716C; text-decoration: underline;">Manage Preferences</a>
                    </div>`
                  : isAdmin
                  ? `<div style="font-size: 10px; color: #A8A29E; margin-top: 10px;">
                      FORME Internal Operational Dispatch &bull; Confidential &bull; System Node: <code>srv-forme-prod</code>
                    </div>`
                  : `<div style="font-size: 10px; color: #A8A29E; margin-top: 10px;">
                      This is an automated transactional security correspondence regarding your FORME account.
                    </div>`
              }

              <div style="font-size: 10px; color: #D6D3D1; margin-top: 14px;">
                &copy; ${currentYear} FORME Inc. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export default renderMasterEmailLayout;

