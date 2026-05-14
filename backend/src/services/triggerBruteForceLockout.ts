/**
 * triggerBruteForceLockout.ts
 *
 * Orchestrateur appelé par le handler /api/auth/login quand le compteur
 * d'échecs vient de passer le seuil pour un email donné.
 *
 * Responsabilités :
 *   1. Lookup user par email (peut être null si email inconnu).
 *   2. Insert security_block_history (BRUTE_FORCE).
 *   3. Si user existe : enqueue email de verrouillage.
 *
 * Tout en best-effort (try/catch + log) — n'altère pas la réponse login.
 */

import { prisma } from '../prismaClient';
import { logger } from '../utils/logger';
import { enqueueEmail } from './emailQueueService';
import { buildBruteForceLockoutEmail } from './bruteForceEmail';
import { getBruteForceConfig } from './bruteForceTracker';

export interface BruteForceLockoutInput {
  email: string;
  ip: string;
  userAgent: string | null;
}

export async function triggerBruteForceLockout(input: BruteForceLockoutInput): Promise<void> {
  const emailLower = input.email.trim().toLowerCase();
  const cfg = getBruteForceConfig();
  const unlockAt = new Date(Date.now() + cfg.blockDurationSec * 1000);

  let user: { id: string; name: string; email: string; memberships: { companyId: string }[] } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true, name: true, email: true,
        memberships: { take: 1, select: { companyId: true } },
      },
    });
  } catch (e) {
    logger.warn('[triggerBruteForceLockout] user lookup failed', { err: String(e), email: emailLower });
  }

  try {
    await prisma.securityBlockHistory.create({
      data: {
        blockedIp: input.ip || 'unknown',
        attemptedUserId: user?.id ?? null,
        blockReason: 'BRUTE_FORCE',
        requestPath: '/api/auth/login',
        userAgent: input.userAgent,
        status: 'BLOCKED',
        companyId: user?.memberships?.[0]?.companyId ?? null,
      },
    });
  } catch (e) {
    logger.warn('[triggerBruteForceLockout] audit insert failed', { err: String(e) });
  }

  if (user) {
    try {
      const mail = buildBruteForceLockoutEmail({
        recipientName: user.name,
        failedAttempts: cfg.threshold,
        windowMinutes: Math.round(cfg.windowSec / 60),
        unlockAt,
      });
      await enqueueEmail({
        to: user.email,
        subject: mail.subject,
        html: mail.bodyHtml,
        event: 'brute_force_lockout',
        recipientName: user.name,
        companyId: user.memberships?.[0]?.companyId,
      });
    } catch (e) {
      logger.warn('[triggerBruteForceLockout] email enqueue failed', { err: String(e) });
    }
  }
}
