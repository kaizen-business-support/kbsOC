/**
 * timeAccess.ts
 *
 * Middleware timeRulesGate — à monter APRÈS authenticate.
 * Sémantique whitelist strict :
 *   - Si aucune règle ne vise l'utilisateur → ALLOW.
 *   - Si au moins une règle vise l'utilisateur ET au moins une de
 *     ces règles a sa fenêtre ouverte maintenant → ALLOW.
 *   - Sinon → DENY 403.
 * Écrit security_block_history (reason=OUTSIDE_TIME_WINDOW) sur block.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';
import {
  ruleAppliesNow, userMatches, MatchableTimeRule, MatchableUser,
} from '../services/timeRuleMatcher';
import {
  getCachedPlatformTimeRules, getCachedTenantTimeRules, CachedTimeRule,
} from '../services/securityRulesCache';
import { logger } from '../utils/logger';

const GENERIC_MESSAGE = 'Accès refusé : vous êtes en dehors des plages horaires autorisées.';

async function recordTimeBlock(
  ip: string,
  companyId: string | null,
  userId: string,
  req: Request
): Promise<void> {
  try {
    await prisma.securityBlockHistory.create({
      data: {
        blockedIp: ip || 'unknown',
        attemptedUserId: userId,
        blockReason: 'OUTSIDE_TIME_WINDOW',
        requestPath: req.path,
        userAgent: req.get('user-agent') ?? null,
        status: 'BLOCKED',
        companyId,
      },
    });
  } catch (e) {
    logger.warn('[timeAccess] failed to write block history', { err: String(e) });
  }
}

export async function timeRulesGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next();

  const matchableUser: MatchableUser = {
    id: req.user.id,
    role: req.user.role,
    branch: req.user.branch ?? null,
    department: req.user.department ?? null,
  };

  let allRules: CachedTimeRule[] = [];
  try {
    const platform = await getCachedPlatformTimeRules();
    const tenant = req.companyId ? await getCachedTenantTimeRules(req.companyId) : [];
    allRules = [...platform, ...tenant];
  } catch (e) {
    logger.warn('[timeRulesGate] error reading rules, allowing through', { err: String(e) });
    return next();
  }

  const rules: MatchableTimeRule[] = allRules.map(r => ({
    id: r.id,
    daysOfWeek: r.daysOfWeek,
    timeStart: r.timeStart,
    timeEnd: r.timeEnd,
    timezone: r.timezone,
    appliesTo: r.appliesTo,
    targetValues: r.targetValues,
    deniedMessage: r.deniedMessage,
  }));

  const targeting = rules.filter(r => userMatches(matchableUser, r));
  if (targeting.length === 0) return next();

  const now = new Date();
  const open = targeting.some(r => ruleAppliesNow(r, matchableUser, now));
  if (open) return next();

  const message = targeting[0].deniedMessage ?? GENERIC_MESSAGE;
  const ip = req.realIp ?? req.ip ?? '';
  await recordTimeBlock(ip, req.companyId ?? null, req.user.id, req);

  res.status(403).json({
    success: false,
    error: 'outside_time_window',
    message,
  });
}
