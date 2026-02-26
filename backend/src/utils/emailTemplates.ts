/**
 * Shared HTML email template builder.
 * Visual config (colors, badges, titles) is determined by event type.
 * Users only write the plain-text body message.
 */

export interface EventEmailConfig {
  title: string;
  subtitle: string;
  accentColor: string;
  badge: string;
  badgeBg: string;
  ctaText: string;
}

export const EVENT_EMAIL_CONFIGS: Record<string, EventEmailConfig> = {
  APPLICATION_SUBMITTED: {
    title: 'Nouvelle demande de crédit reçue',
    subtitle: 'Une nouvelle demande de financement a été soumise et nécessite votre attention.',
    accentColor: '#1565C0',
    badge: 'Nouvelle demande',
    badgeBg: 'rgba(255,255,255,0.22)',
    ctaText: 'Consulter le dossier',
  },
  STEP_ASSIGNED: {
    title: 'Un dossier attend votre décision',
    subtitle: 'Une demande de crédit a été transmise à votre niveau et nécessite votre approbation.',
    accentColor: '#d97706',
    badge: 'Action requise',
    badgeBg: '#b45309',
    ctaText: 'Prendre ma décision',
  },
  STEP_APPROVED: {
    title: 'Étape du dossier approuvée',
    subtitle: 'Le dossier progresse favorablement dans le circuit d\'approbation.',
    accentColor: '#16a34a',
    badge: 'Étape approuvée',
    badgeBg: '#15803d',
    ctaText: 'Suivre le dossier',
  },
  STEP_REJECTED: {
    title: 'Étape du dossier rejetée',
    subtitle: 'Le dossier a été refusé à l\'une des étapes du circuit d\'approbation.',
    accentColor: '#dc2626',
    badge: 'Étape rejetée',
    badgeBg: '#b91c1c',
    ctaText: 'Voir les détails',
  },
  APPLICATION_APPROVED: {
    title: 'Dossier entièrement approuvé',
    subtitle: 'Le dossier a obtenu toutes les approbations requises et est maintenant validé.',
    accentColor: '#15803d',
    badge: 'Dossier approuvé',
    badgeBg: '#166534',
    ctaText: 'Voir le dossier approuvé',
  },
  APPLICATION_REJECTED: {
    title: 'Dossier non retenu',
    subtitle: 'Après examen complet, la demande de crédit n\'a pas obtenu l\'approbation finale.',
    accentColor: '#b91c1c',
    badge: 'Dossier rejeté',
    badgeBg: '#991b1b',
    ctaText: 'Consulter les détails',
  },
};

/** Convert plain text (with \n) to HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(para => {
      const lines = para.split('\n').join('<br>');
      return `<p style="margin:0 0 14px;font-size:14px;color:#475569;line-height:1.75;">${lines}</p>`;
    })
    .join('');
}

/**
 * Build a full professional HTML email for a given workflow event.
 *
 * @param event  - Workflow event key (e.g. 'APPLICATION_SUBMITTED')
 * @param bodyText - Plain text message (already rendered, with \n line breaks)
 * @param vars  - Template variables for the info card and CTA link
 */
export function buildEventEmail(
  event: string,
  bodyText: string,
  vars: {
    clientName: string;
    applicationNumber: string;
    amount: string;
    currency: string;
    actionUrl: string;
    [key: string]: string;
  }
): string {
  const cfg = EVENT_EMAIL_CONFIGS[event] ?? EVENT_EMAIL_CONFIGS['APPLICATION_SUBMITTED'];
  const year = new Date().getFullYear();

  const bodyHtml = textToHtml(bodyText);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OptimusCredit — ${cfg.badge}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- OUTER CARD -->
        <table role="presentation" cellspacing="0" cellpadding="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;
                      box-shadow:0 4px 32px rgba(0,0,0,0.10);">

          <!-- ═══ HEADER ══════════════════════════════════════════════════ -->
          <tr>
            <td style="background:linear-gradient(135deg,#1565C0 0%,#0D47A1 100%);padding:28px 40px 26px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1;">
                      OptimusCredit
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.60);margin-top:5px;
                                text-transform:uppercase;letter-spacing:1.4px;">
                      Plateforme de Gestion de Crédit
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:${cfg.badgeBg};color:#ffffff;
                                 font-size:10px;font-weight:700;padding:6px 16px;border-radius:20px;
                                 letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;
                                 border:1px solid rgba(255,255,255,0.25);">
                      ${cfg.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ ACCENT BAR ═══════════════════════════════════════════════ -->
          <tr>
            <td height="4" style="background:${cfg.accentColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ═══ BODY ══════════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <!-- Event title -->
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;">
                ${cfg.title}
              </h1>
              <p style="margin:0 0 32px;font-size:15px;color:#64748b;line-height:1.6;">
                ${cfg.subtitle}
              </p>

              <!-- ── Info card ────────────────────────────────────────── -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                            overflow:hidden;margin-bottom:32px;">
                <!-- Client -->
                <tr>
                  <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
                    <table width="100%" cellspacing="0" cellpadding="0"><tr>
                      <td style="font-size:11px;font-weight:600;color:#94a3b8;
                                 text-transform:uppercase;letter-spacing:0.8px;">Client</td>
                      <td align="right" style="font-size:14px;font-weight:600;color:#1e293b;">
                        ${vars.clientName}
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <!-- N° dossier -->
                <tr>
                  <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
                    <table width="100%" cellspacing="0" cellpadding="0"><tr>
                      <td style="font-size:11px;font-weight:600;color:#94a3b8;
                                 text-transform:uppercase;letter-spacing:0.8px;">Numéro de dossier</td>
                      <td align="right" style="font-size:14px;font-weight:700;color:#1e293b;
                                               font-family:'Courier New',monospace;letter-spacing:0.5px;">
                        ${vars.applicationNumber}
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <!-- Montant -->
                <tr>
                  <td style="padding:14px 24px;">
                    <table width="100%" cellspacing="0" cellpadding="0"><tr>
                      <td style="font-size:11px;font-weight:600;color:#94a3b8;
                                 text-transform:uppercase;letter-spacing:0.8px;">Montant demandé</td>
                      <td align="right" style="font-size:20px;font-weight:800;color:${cfg.accentColor};">
                        ${vars.amount}&nbsp;<span style="font-size:14px;">${vars.currency}</span>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
              <!-- /Info card -->

              <!-- ── User message ─────────────────────────────────────── -->
              <div style="padding:0;">
                ${bodyHtml}
              </div>

              <!-- ── CTA Button ───────────────────────────────────────── -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                <tr>
                  <td style="border-radius:8px;background:${cfg.accentColor};">
                    <a href="${vars.actionUrl}"
                       style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;
                              color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:8px;">
                      ${cfg.ctaText} &nbsp;→
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ═══ DIVIDER ════════════════════════════════════════════════ -->
          <tr>
            <td height="1" style="background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ═══ FOOTER ════════════════════════════════════════════════ -->
          <tr>
            <td style="background:#f8fafc;padding:22px 40px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.7;">
                Ce message a été généré automatiquement par
                <strong style="color:#64748b;">OptimusCredit</strong>.<br>
                Merci de ne pas répondre directement à cet email.
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#cbd5e1;text-align:center;">
                © ${year} OptimusCredit · Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
        <!-- /OUTER CARD -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Sample variables for template preview */
export const PREVIEW_SAMPLE_VARS = {
  clientName: 'ACME Sénégal SARL',
  applicationNumber: 'OC-2024-00042',
  amount: '25 000 000',
  currency: 'XOF',
  stepName: 'Approbation Directeur d\'Agence',
  assigneeName: 'Amadou Diallo',
  createdByName: 'Fatou Sow',
  decision: 'APPROVED',
  comments: 'Dossier conforme aux critères d\'éligibilité. Garanties suffisantes.',
  actionUrl: '#',
};
