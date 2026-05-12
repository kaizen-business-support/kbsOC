/**
 * HTML email template builder — tenant-branded.
 *
 * Each email shows the bank's own logo + name in the header,
 * with "Propulsé par OptimusCredit" only in the footer.
 * Visual config (colors, badge, CTA text) is driven by event type.
 */

// ─── Tenant branding ───────────────────────────────────────────────────────────

export interface TenantBranding {
  /** Bank / institution name, e.g. "BCI — Banque de Crédit et d'Investissement" */
  name: string;
  /** Fully-qualified logo URL, e.g. "https://app.example.com/uploads/logos/bci.png" */
  logoUrl?: string | null;
}

// ─── Event configuration ───────────────────────────────────────────────────────

export interface EventEmailConfig {
  title: string;
  subtitle: string;
  accentColor: string;
  accentDark: string;   // darker shade for gradient
  badge: string;
  badgeBg: string;
  icon: string;         // emoji icon used in the banner
  ctaText: string;
}

export const EVENT_EMAIL_CONFIGS: Record<string, EventEmailConfig> = {
  APPLICATION_SUBMITTED: {
    title: 'Nouvelle demande de crédit reçue',
    subtitle: 'Une nouvelle demande de financement a été soumise et nécessite votre attention.',
    accentColor: '#1565C0',
    accentDark:  '#0D47A1',
    badge: 'Nouvelle demande',
    badgeBg: '#1976D2',
    icon: '📋',
    ctaText: 'Consulter le dossier',
  },
  STEP_ASSIGNED: {
    title: 'Un dossier attend votre décision',
    subtitle: 'Une demande de crédit vous a été transmise et nécessite votre approbation.',
    accentColor: '#d97706',
    accentDark:  '#b45309',
    badge: 'Action requise',
    badgeBg: '#b45309',
    icon: '⚡',
    ctaText: 'Prendre ma décision',
  },
  STEP_APPROVED: {
    title: 'Étape du dossier validée',
    subtitle: 'Le dossier progresse favorablement dans le circuit d\'approbation.',
    accentColor: '#16a34a',
    accentDark:  '#15803d',
    badge: 'Étape approuvée',
    badgeBg: '#15803d',
    icon: '✓',
    ctaText: 'Suivre le dossier',
  },
  STEP_REJECTED: {
    title: 'Étape du dossier rejetée',
    subtitle: 'Le dossier a été refusé à l\'une des étapes du circuit d\'approbation.',
    accentColor: '#dc2626',
    accentDark:  '#b91c1c',
    badge: 'Étape rejetée',
    badgeBg: '#b91c1c',
    icon: '✗',
    ctaText: 'Voir les détails',
  },
  APPLICATION_APPROVED: {
    title: 'Dossier entièrement approuvé',
    subtitle: 'Le dossier a obtenu toutes les approbations requises et est maintenant validé.',
    accentColor: '#15803d',
    accentDark:  '#166534',
    badge: 'Dossier approuvé',
    badgeBg: '#166534',
    icon: '🎉',
    ctaText: 'Voir le dossier approuvé',
  },
  APPLICATION_REJECTED: {
    title: 'Dossier non retenu',
    subtitle: 'Après examen complet, la demande de crédit n\'a pas obtenu l\'approbation finale.',
    accentColor: '#b91c1c',
    accentDark:  '#991b1b',
    badge: 'Dossier rejeté',
    badgeBg: '#991b1b',
    icon: '✗',
    ctaText: 'Consulter les détails',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convert plain text (with \n) to HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(para => {
      const lines = para.split('\n').join('<br>');
      return `<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.8;">${lines}</p>`;
    })
    .join('');
}

// ─── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a professional HTML email for a given workflow event.
 *
 * @param event      - Workflow event key (e.g. 'APPLICATION_SUBMITTED')
 * @param bodyText   - Plain-text message body (already rendered with {{vars}})
 * @param vars       - Template variables for the info card and CTA link
 * @param tenant     - Optional tenant branding (logo + institution name)
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
  },
  tenant?: TenantBranding | null
): string {
  const cfg = EVENT_EMAIL_CONFIGS[event] ?? EVENT_EMAIL_CONFIGS['APPLICATION_SUBMITTED'];
  const year = new Date().getFullYear();
  const bodyHtml = textToHtml(bodyText);

  const bankName = tenant?.name ?? 'OptimusCredit';
  const logoUrl  = tenant?.logoUrl ?? null;

  // ── Header content: logo + bank name, or plain bank name if no logo ──────────
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${bankName}" height="44"
            style="height:44px;max-width:180px;object-fit:contain;display:block;">`
    : `<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;
                  letter-spacing:2px;padding:10px 0;">INSTITUTION</div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${bankName} — ${cfg.badge}</title>
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Segoe UI',Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0F4F8;">
  <tr>
    <td align="center" style="padding:32px 16px 40px;">

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- OUTER WRAPPER                                                       -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <table role="presentation" cellspacing="0" cellpadding="0"
             style="max-width:620px;width:100%;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- ══════════════════════════════════════════════════════════════ -->
        <!-- HEADER — bank logo + name                                     -->
        <!-- ══════════════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#ffffff;padding:20px 36px;border-bottom:1px solid #E8ECF0;">
            <table width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <!-- Logo / bank name -->
                <td style="vertical-align:middle;">${logoBlock}</td>
                <!-- Bank name text (shown alongside logo) -->
                <td style="vertical-align:middle;padding-left:14px;">
                  <div style="font-size:15px;font-weight:700;color:#1e293b;line-height:1.2;">
                    ${bankName}
                  </div>
                  <div style="font-size:10px;color:#94a3b8;margin-top:3px;
                              letter-spacing:1.2px;text-transform:uppercase;">
                    Gestion de Crédit
                  </div>
                </td>
                <!-- Badge -->
                <td align="right" style="vertical-align:middle;white-space:nowrap;">
                  <span style="display:inline-block;background:${cfg.badgeBg};color:#ffffff;
                               font-size:10px;font-weight:700;padding:5px 14px;
                               border-radius:20px;letter-spacing:0.8px;
                               text-transform:uppercase;white-space:nowrap;">
                    ${cfg.icon}&nbsp; ${cfg.badge}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══════════════════════════════════════════════════════════════ -->
        <!-- ACCENT BANNER                                                  -->
        <!-- ══════════════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:linear-gradient(135deg,${cfg.accentColor} 0%,${cfg.accentDark} 100%);
                     padding:28px 36px;">
            <div style="font-size:22px;font-weight:800;color:#ffffff;
                        letter-spacing:-0.3px;line-height:1.25;margin-bottom:8px;">
              ${cfg.title}
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,0.80);line-height:1.6;">
              ${cfg.subtitle}
            </div>
          </td>
        </tr>

        <!-- ══════════════════════════════════════════════════════════════ -->
        <!-- BODY                                                           -->
        <!-- ══════════════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#ffffff;padding:36px 36px 28px;">

            <!-- ── Info card ─────────────────────────────────────────────── -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                   style="background:#F8FAFC;border:1px solid #E2E8F0;
                          border-radius:12px;overflow:hidden;margin-bottom:32px;">

              <!-- Client row -->
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #E2E8F0;">
                  <table width="100%" cellspacing="0" cellpadding="0"><tr>
                    <td style="font-size:10px;font-weight:700;color:#94A3B8;
                               text-transform:uppercase;letter-spacing:1px;width:45%;">
                      Client
                    </td>
                    <td align="right" style="font-size:14px;font-weight:600;color:#1E293B;">
                      ${vars.clientName}
                    </td>
                  </tr></table>
                </td>
              </tr>

              <!-- N° dossier row -->
              <tr>
                <td style="padding:14px 24px;border-bottom:1px solid #E2E8F0;">
                  <table width="100%" cellspacing="0" cellpadding="0"><tr>
                    <td style="font-size:10px;font-weight:700;color:#94A3B8;
                               text-transform:uppercase;letter-spacing:1px;width:45%;">
                      Numéro de dossier
                    </td>
                    <td align="right">
                      <span style="font-size:13px;font-weight:700;color:#1E293B;
                                   font-family:'Courier New',monospace;letter-spacing:0.8px;
                                   background:#EEF2FF;padding:3px 10px;border-radius:6px;">
                        ${vars.applicationNumber}
                      </span>
                    </td>
                  </tr></table>
                </td>
              </tr>

              <!-- Montant row -->
              <tr>
                <td style="padding:16px 24px;">
                  <table width="100%" cellspacing="0" cellpadding="0"><tr>
                    <td style="font-size:10px;font-weight:700;color:#94A3B8;
                               text-transform:uppercase;letter-spacing:1px;width:45%;">
                      Montant demandé
                    </td>
                    <td align="right">
                      <span style="font-size:22px;font-weight:800;color:${cfg.accentColor};">
                        ${vars.amount}
                      </span>
                      <span style="font-size:13px;font-weight:600;color:${cfg.accentColor};margin-left:4px;">
                        ${vars.currency}
                      </span>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
            <!-- /Info card -->

            <!-- ── Message body ───────────────────────────────────────────── -->
            <div style="margin-bottom:8px;">${bodyHtml}</div>

            <!-- ── CTA Button ─────────────────────────────────────────────── -->
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
              <tr>
                <td style="border-radius:10px;background:linear-gradient(135deg,${cfg.accentColor},${cfg.accentDark});">
                  <a href="${vars.actionUrl}"
                     style="display:inline-block;padding:15px 40px;font-size:14px;
                            font-weight:700;color:#ffffff;text-decoration:none;
                            letter-spacing:0.4px;border-radius:10px;">
                    ${cfg.ctaText} &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- ── Link fallback ──────────────────────────────────────────── -->
            <p style="margin:16px 0 0;font-size:11px;color:#CBD5E1;line-height:1.6;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <a href="${vars.actionUrl}" style="color:#94A3B8;word-break:break-all;">${vars.actionUrl}</a>
            </p>

          </td>
        </tr>

        <!-- ══════════════════════════════════════════════════════════════ -->
        <!-- FOOTER                                                         -->
        <!-- ══════════════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 36px;">
            <table width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.8;">
                    Ce message a été généré automatiquement — merci de ne pas y répondre directement.
                  </p>
                  <p style="margin:8px 0 0;font-size:11px;color:#CBD5E1;">
                    © ${year} <strong style="color:#94A3B8;">${bankName}</strong>
                    &nbsp;·&nbsp; Propulsé par
                    <a href="#" style="color:#94A3B8;text-decoration:none;font-weight:600;">OptimusCredit</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /OUTER WRAPPER -->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Auth email wrapper — not tenant-branded (no company context at login time) ─

function authEmailWrapper(
  badge: string,
  badgeBg: string,
  accentColor: string,
  accentDark: string,
  bodyHtml: string
): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OptimusCredit</title>
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Segoe UI',Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0F4F8;">
  <tr>
    <td align="center" style="padding:32px 16px 40px;">
      <table role="presentation" cellspacing="0" cellpadding="0"
             style="max-width:620px;width:100%;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- HEADER -->
        <tr>
          <td style="background:#ffffff;padding:20px 36px;border-bottom:1px solid #E8ECF0;">
            <table width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align:middle;">
                <div style="font-size:20px;font-weight:800;color:#1565C0;letter-spacing:-0.5px;">OptimusCredit</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:3px;letter-spacing:1.4px;text-transform:uppercase;">
                  Plateforme de Gestion de Crédit
                </div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="display:inline-block;background:${badgeBg};color:#ffffff;
                             font-size:10px;font-weight:700;padding:5px 14px;border-radius:20px;
                             letter-spacing:0.8px;text-transform:uppercase;">${badge}</span>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- ACCENT BAR -->
        <tr>
          <td style="background:linear-gradient(135deg,${accentColor},${accentDark});padding:3px 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:36px 36px 28px;">${bodyHtml}</td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 36px;">
            <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;line-height:1.8;">
              Ce message a été généré automatiquement par <strong>OptimusCredit</strong>.<br>
              Merci de ne pas répondre directement à cet email.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#CBD5E1;text-align:center;">
              © ${year} OptimusCredit · Tous droits réservés
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

// ─── Auth email builders ───────────────────────────────────────────────────────

export function buildWelcomeEmail(vars: {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresIn: string;
}): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Bienvenue sur OptimusCredit !</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      Votre compte a été créé. Vous trouverez ci-dessous vos accès temporaires.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Adresse email</td>
            <td align="right" style="font-size:14px;font-weight:600;color:#1e293b;">${vars.email}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;">
          <table width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Mot de passe temporaire</td>
            <td align="right" style="font-size:20px;font-weight:800;color:#1565C0;font-family:'Courier New',monospace;letter-spacing:1px;">${vars.temporaryPassword}</td>
          </tr></table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#dc2626;">
            ⚠️ Ce mot de passe expire dans ${vars.expiresIn}. Connectez-vous rapidement.
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#ef4444;">
            Il vous sera demandé de choisir un nouveau mot de passe dès votre première connexion.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr>
        <td style="border-radius:10px;background:linear-gradient(135deg,#1565C0,#0D47A1);">
          <a href="${vars.loginUrl}" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:10px;">
            Accéder à la plateforme &rarr;
          </a>
        </td>
      </tr>
    </table>`;
  return authEmailWrapper('Bienvenue', 'rgba(21,101,192,0.85)', '#1565C0', '#0D47A1', body);
}

export function buildAdminResetEmail(vars: {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresIn: string;
}): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Réinitialisation de mot de passe</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      Bonjour <strong>${vars.name}</strong>, un administrateur a réinitialisé votre mot de passe.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Adresse email</td>
            <td align="right" style="font-size:14px;font-weight:600;color:#1e293b;">${vars.email}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;">
          <table width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Nouveau mot de passe temporaire</td>
            <td align="right" style="font-size:20px;font-weight:800;color:#d97706;font-family:'Courier New',monospace;letter-spacing:1px;">${vars.temporaryPassword}</td>
          </tr></table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#dc2626;">
            ⚠️ Ce mot de passe expire dans ${vars.expiresIn}. Connectez-vous rapidement.
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#ef4444;">
            Il vous sera demandé de choisir un nouveau mot de passe dès votre connexion.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr>
        <td style="border-radius:10px;background:linear-gradient(135deg,#d97706,#b45309);">
          <a href="${vars.loginUrl}" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:10px;">
            Se connecter &rarr;
          </a>
        </td>
      </tr>
    </table>`;
  return authEmailWrapper('Réinitialisation', '#b45309', '#d97706', '#b45309', body);
}

export function buildPasswordResetEmail(vars: {
  name: string;
  resetUrl: string;
  expiresIn: string;
}): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Réinitialisation de votre mot de passe</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      Bonjour <strong>${vars.name}</strong>,<br><br>
      Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte OptimusCredit.
      Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
      <tr>
        <td style="border-radius:10px;background:linear-gradient(135deg,#1565C0,#0D47A1);">
          <a href="${vars.resetUrl}" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;border-radius:10px;">
            Réinitialiser mon mot de passe &rarr;
          </a>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            ⏱️ Ce lien expire dans <strong>${vars.expiresIn}</strong>.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
      Votre mot de passe restera inchangé.
    </p>`;
  return authEmailWrapper('Réinitialisation', 'rgba(21,101,192,0.85)', '#1565C0', '#0D47A1', body);
}

// ─── Preview sample vars ───────────────────────────────────────────────────────

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
