/**
 * securityRulesCache.ts
 *
 * Cache Redis des règles IP actives, par scope (plateforme | tenant).
 * TTL 60s. Tolérance Redis down (fallback DB direct, log warn).
 */

import { prisma } from '../prismaClient';
import { logger } from '../utils/logger';
import { cacheGet, cacheSet, cacheDel } from './redis';

export const IP_RULES_CACHE_TTL_SEC = 60;

export interface CachedIpRule {
  ipAddress: string;
  ruleType: 'ALLOW' | 'DENY';
}

const KEY_PLATFORM = 'sec:ip-rules:platform';
const keyTenant = (companyId: string) => `sec:ip-rules:tenant:${companyId}`;

async function loadFromDb(companyId: string | null): Promise<CachedIpRule[]> {
  const rows = await prisma.securityIpRule.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { ipAddress: true, ruleType: true },
  });
  return rows.map(r => ({ ipAddress: r.ipAddress, ruleType: r.ruleType }));
}

async function readCache(key: string): Promise<CachedIpRule[] | null> {
  try {
    const raw = await cacheGet(key);
    return raw ? (JSON.parse(raw) as CachedIpRule[]) : null;
  } catch (e) {
    logger.warn('[securityRulesCache] Redis read error', { err: String(e), key });
    return null;
  }
}

async function writeCache(key: string, value: CachedIpRule[]): Promise<void> {
  try {
    await cacheSet(key, JSON.stringify(value), IP_RULES_CACHE_TTL_SEC);
  } catch (e) {
    logger.warn('[securityRulesCache] Redis write error', { err: String(e), key });
  }
}

export async function getCachedPlatformIpRules(): Promise<CachedIpRule[]> {
  const cached = await readCache(KEY_PLATFORM);
  if (cached) return cached;
  const fresh = await loadFromDb(null);
  await writeCache(KEY_PLATFORM, fresh);
  return fresh;
}

export async function getCachedTenantIpRules(companyId: string): Promise<CachedIpRule[]> {
  const key = keyTenant(companyId);
  const cached = await readCache(key);
  if (cached) return cached;
  const fresh = await loadFromDb(companyId);
  await writeCache(key, fresh);
  return fresh;
}

export async function invalidateIpRulesCache(companyId: string | null): Promise<void> {
  const key = companyId === null ? KEY_PLATFORM : keyTenant(companyId);
  try {
    await cacheDel(key);
  } catch (e) {
    logger.warn('[securityRulesCache] Redis del error', { err: String(e), key });
  }
}
