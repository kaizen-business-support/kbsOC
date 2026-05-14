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

// ─── Time rules cache ─────────────────────────────────────────────────────────

export interface CachedTimeRule {
  id: string;
  daysOfWeek: number;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  appliesTo: 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'ROLE' | 'USER';
  targetValues: string[];
  deniedMessage: string | null;
  allowReadOnly: boolean;
}

const KEY_TIME_PLATFORM = 'sec:time-rules:platform';
const keyTimeTenant = (companyId: string) => `sec:time-rules:tenant:${companyId}`;

async function loadTimeRulesFromDb(companyId: string | null): Promise<CachedTimeRule[]> {
  const rows = await prisma.securityTimeRule.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: {
      id: true, daysOfWeek: true, timeStart: true, timeEnd: true,
      timezone: true, appliesTo: true, targetValues: true, deniedMessage: true,
      allowReadOnly: true,
    },
  });
  return rows.map(r => ({
    id: r.id,
    daysOfWeek: r.daysOfWeek,
    timeStart: r.timeStart,
    timeEnd: r.timeEnd,
    timezone: r.timezone,
    appliesTo: r.appliesTo,
    targetValues: r.targetValues,
    deniedMessage: r.deniedMessage,
    allowReadOnly: r.allowReadOnly ?? false,
  }));
}

async function readTimeCache(key: string): Promise<CachedTimeRule[] | null> {
  try {
    const raw = await cacheGet(key);
    return raw ? (JSON.parse(raw) as CachedTimeRule[]) : null;
  } catch (e) {
    logger.warn('[securityRulesCache] Redis read error (time)', { err: String(e), key });
    return null;
  }
}

async function writeTimeCache(key: string, value: CachedTimeRule[]): Promise<void> {
  try {
    await cacheSet(key, JSON.stringify(value), IP_RULES_CACHE_TTL_SEC);
  } catch (e) {
    logger.warn('[securityRulesCache] Redis write error (time)', { err: String(e), key });
  }
}

export async function getCachedPlatformTimeRules(): Promise<CachedTimeRule[]> {
  const cached = await readTimeCache(KEY_TIME_PLATFORM);
  if (cached) return cached;
  const fresh = await loadTimeRulesFromDb(null);
  await writeTimeCache(KEY_TIME_PLATFORM, fresh);
  return fresh;
}

export async function getCachedTenantTimeRules(companyId: string): Promise<CachedTimeRule[]> {
  const key = keyTimeTenant(companyId);
  const cached = await readTimeCache(key);
  if (cached) return cached;
  const fresh = await loadTimeRulesFromDb(companyId);
  await writeTimeCache(key, fresh);
  return fresh;
}

export async function invalidateTimeRulesCache(companyId: string | null): Promise<void> {
  const key = companyId === null ? KEY_TIME_PLATFORM : keyTimeTenant(companyId);
  try {
    await cacheDel(key);
  } catch (e) {
    logger.warn('[securityRulesCache] Redis del error (time)', { err: String(e), key });
  }
}
