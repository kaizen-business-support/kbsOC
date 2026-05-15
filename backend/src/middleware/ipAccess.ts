/**
 * ipAccess.ts
 *
 * Middlewares d'enforcement des règles IP.
 *   - platformIpGate : à monter AVANT auth (scope plateforme uniquement).
 *   - tenantIpGate   : à monter APRÈS auth (scope tenant via req.companyId).
 *
 * Cascade : ALLOW d'abord (early return), puis DENY (block).
 * Population du security_block_history à chaque BLOCK (best-effort).
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';
import { ipMatches } from '../services/ipMatcher';
import { getCachedPlatformIpRules, getCachedTenantIpRules, CachedIpRule } from '../services/securityRulesCache';
import { logger } from '../utils/logger';

function evaluateBlock(ip: string, rules: CachedIpRule[]): { decision: 'allow' | 'deny' | 'none' } {
  for (const r of rules) {
    if (r.ruleType === 'ALLOW' && ipMatches(ip, r.ipAddress)) {
      return { decision: 'allow' };
    }
  }
  for (const r of rules) {
    if (r.ruleType === 'DENY' && ipMatches(ip, r.ipAddress)) {
      return { decision: 'deny' };
    }
  }
  return { decision: 'none' };
}

async function recordBlock(
  ip: string,
  companyId: string | null,
  userId: string | null,
  req: Request
): Promise<void> {
  try {
    await prisma.securityBlockHistory.create({
      data: {
        blockedIp: ip,
        attemptedUserId: userId,
        blockReason: 'IP_BLACKLISTED',
        requestPath: req.path,
        userAgent: req.get('user-agent') ?? null,
        status: 'BLOCKED',
        companyId,
      },
    });
  } catch (e) {
    logger.warn('[ipAccess] failed to write block history', { err: String(e) });
  }
}

function blockedResponse(ip: string) {
  return {
    success: false,
    error: 'ip_blocked',
    blockedIp: ip,
    message: 'Accès refusé : votre adresse IP est bloquée.',
  };
}

export async function platformIpGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.realIp ?? req.ip ?? '';
  if (!ip) return next();
  try {
    const rules = await getCachedPlatformIpRules();
    const { decision } = evaluateBlock(ip, rules);
    if (decision === 'deny') {
      await recordBlock(ip, null, null, req);
      res.status(403).json(blockedResponse(ip));
      return;
    }
  } catch (e) {
    logger.warn('[platformIpGate] error reading rules, allowing through', { err: String(e) });
  }
  next();
}

export async function tenantIpGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.realIp ?? req.ip ?? '';
  if (!ip || !req.companyId) return next();
  try {
    const rules = await getCachedTenantIpRules(req.companyId);
    const { decision } = evaluateBlock(ip, rules);
    if (decision === 'deny') {
      await recordBlock(ip, req.companyId, req.user?.id ?? null, req);
      res.status(403).json(blockedResponse(ip));
      return;
    }
  } catch (e) {
    logger.warn('[tenantIpGate] error reading rules, allowing through', { err: String(e) });
  }
  next();
}
