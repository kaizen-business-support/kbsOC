/**
 * bruteForceEmail.ts
 *
 * Templating pur du mail de verrouillage suite à brute-force.
 * Aucune dépendance Prisma / Redis.
 */

export interface BuildLockoutEmailInput {
  recipientName: string;
  failedAttempts: number;
  windowMinutes: number;
  unlockAt: Date;
}

export interface LockoutEmailContent {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

function fmtDateFr(d: Date): string {
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function buildBruteForceLockoutEmail(input: BuildLockoutEmailInput): LockoutEmailContent {
  const { recipientName, failedAttempts, windowMinutes, unlockAt } = input;
  const unlockFmt = fmtDateFr(unlockAt);

  const subject = '[OptimusCredit] Verrouillage temporaire de votre compte';

  const bodyText = `Bonjour ${recipientName},

Nous avons détecté ${failedAttempts} tentatives de connexion infructueuses sur votre compte dans les ${windowMinutes} dernières minutes.

Pour votre sécurité, votre compte est temporairement verrouillé jusqu'à ${unlockFmt} (ou jusqu'à intervention d'un administrateur).

Si vous n'êtes pas à l'origine de ces tentatives, contactez immédiatement votre administrateur.

— L'équipe sécurité OptimusCredit`;

  const bodyHtml = `<!doctype html>
<html lang="fr">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #0F172A;">
    <h2 style="color: #1F4E79; margin-bottom: 8px;">Verrouillage temporaire de votre compte</h2>
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Nous avons détecté <strong>${failedAttempts} tentatives</strong> de connexion infructueuses sur votre compte dans les <strong>${windowMinutes} dernières minutes</strong>.</p>
    <div style="background:#fef2f2; border-left:4px solid #9F1239; padding:12px 16px; margin:16px 0; border-radius:4px;">
      Pour votre sécurité, votre compte est temporairement verrouillé jusqu'à
      <strong>${unlockFmt}</strong> (ou jusqu'à intervention d'un administrateur).
    </div>
    <p>Si vous n'êtes pas à l'origine de ces tentatives, contactez immédiatement votre administrateur.</p>
    <p style="color:#94A3B8; font-size:12px; margin-top:24px;">— L'équipe sécurité OptimusCredit</p>
  </body>
</html>`;

  return { subject, bodyHtml, bodyText };
}
