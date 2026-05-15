/**
 * timeAccess.ts
 *
 * Middleware timeRulesGate — à monter APRÈS authenticate.
 *
 * Sémantique whitelist strict + Phase 6a :
 *   - Si aucune règle ne vise l'utilisateur → ALLOW.
 *   - Si au moins une fenêtre ouverte → ALLOW.
 *   - Sinon (hors fenêtre) :
 *       • Pour les méthodes mutantes (POST/PUT/PATCH/DELETE) → 423.
 *       • Pour GET, autorisé seulement si TOUTES les règles applicables
 *         ont allowReadOnly=true ; sinon 423.
 *   - Audit dédoublonné via Redis (1 entrée max par 5 min par user).
 *
 * Réponse 423 :
 *   { success: false, error: 'outside_time_window',
 *     message, next_open: ISO|null, allow_read_only: bool }
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';
import redis from '../services/redis';
import {
  ruleAppliesNow, userMatches, nextOpenAt,
  MatchableTimeRule, MatchableUser,
} from '../services/timeRuleMatcher';
import {
  getCachedPlatformTimeRules, getCachedTenantTimeRules, CachedTimeRule,
} from '../services/securityRulesCache';
import { logger } from '../utils/logger';

const GENERIC_MESSAGE = 'Accès restreint en dehors des heures autorisées.';
const TIME_DENIAL_DEDUP_TTL_SEC = 300; // 5 minutes
const TIME_DENIAL_DEDUP_KEY = (userId: string) => `tr:denied:${userId}`;

interface RecordBlockOpts {
  userId: string;
  companyId: string | null;
  ip: string;
  req: Request;
}

/**
 * Insert une entrée security_block_history uniquement si la clé Redis
 * dédoublonnage n'existe pas (TTL 5 min). Best-effort sur erreur.
 */
async function maybeRecordTimeBlock(opts: RecordBlockOpts): Promise<void> {
  const key = TIME_DENIAL_DEDUP_KEY(opts.userId);
  try {
    const exists = await redis.exists(key);
    if (exists) return;
    await redis.set(key, '1', 'EX', TIME_DENIAL_DEDUP_TTL_SEC);
  } catch (e) {
    // Redis down → on log et on continue (audit non dédoublonné mais opérationnel)
    logger.warn('[timeAccess] dedup Redis check/set failed', { err: String(e) });
  }

  try {
    await prisma.securityBlockHistory.create({
      data: {
        blockedIp: opts.ip || 'unknown',
        attemptedUserId: opts.userId,
        blockReason: 'OUTSIDE_TIME_WINDOW',
        requestPath: opts.req.path,
        userAgent: opts.req.get('user-agent') ?? null,
        status: 'BLOCKED',
        companyId: opts.companyId,
      },
    });
  } catch (e) {
    logger.warn('[timeAccess] audit insert failed', { err: String(e) });
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
    allowReadOnly: r.allowReadOnly,
  }));

  const targeting = rules.filter(r => userMatches(matchableUser, r));
  if (targeting.length === 0) return next();

  const now = new Date();
  if (targeting.some(r => ruleAppliesNow(r, matchableUser, now))) return next();

  // → fenêtre fermée pour cet utilisateur
  const method = req.method.toUpperCase();
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  // GET autorisé hors fenêtre uniquement si TOUTES les règles applicables
  // ont allowReadOnly=true.
  const allReadOnlyEnabled = targeting.every(r => r.allowReadOnly === true);

  if (!isMutation && allReadOnlyEnabled) {
    return next(); // GET autorisée
  }

  // Audit dédoublonné
  await maybeRecordTimeBlock({
    userId: req.user.id,
    companyId: req.companyId ?? null,
    ip: req.realIp ?? req.ip ?? 'unknown',
    req,
  });

  const firstRule = targeting[0];
  const message = firstRule.deniedMessage ?? GENERIC_MESSAGE;
  const next_open = nextOpenAt(rules, matchableUser, now);

  res.status(423).json({
    success: false,
    error: 'outside_time_window',
    message,
    next_open: next_open ? next_open.toISOString() : null,
    allow_read_only: allReadOnlyEnabled,
  });
}
