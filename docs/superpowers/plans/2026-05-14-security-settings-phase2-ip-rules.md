# Security Settings — Phase 2 IP Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le bout-en-bout des règles IP : validation IPv4/IPv6/CIDR, CRUD REST, middleware d'enforcement (plateforme avant auth, tenant après auth) avec cache Redis 60s, anti-self-lockout, population du `security_block_history`, et UI Tab + Dialog modal MUI utilisant le `DataTable` générique existant.

**Architecture:** Helpers purs `ipMatcher` (testables sans Prisma) + service `securityIpRulesService` (Prisma + cache invalidation) + cache `securityRulesCache` (Redis avec fallback DB) + 2 middlewares (`platformIpGate` avant auth, `tenantIpGate` après) + routes Express protégées par `authorize(['manage_security'])`. Côté front : `IPRulesTab` rendu via `DataTable`, `IPRuleFormDialog` pour create/edit, `ApiService.security.ipRules.*` pour les appels.

**Tech Stack:** Node.js + Express + Prisma + Redis + Jest + `ipaddr.js` (backend) ; React + TypeScript + MUI (front).

**Spec:** `docs/superpowers/specs/2026-05-14-security-settings-phase2-ip-rules.md`

---

## File structure

- **Backend — Create**
  - `backend/src/services/ipMatcher.ts` — helpers purs `validateIpOrCidr`, `ipMatches`, `normalizeIp`.
  - `backend/src/services/securityRulesCache.ts` — cache Redis des règles actives.
  - `backend/src/services/securityIpRulesService.ts` — CRUD Prisma + anti-lockout + invalidation cache.
  - `backend/src/middleware/extractRealIp.ts` — pose `req.realIp` depuis `X-Forwarded-For`/`req.ip`.
  - `backend/src/middleware/ipAccess.ts` — `platformIpGate` + `tenantIpGate`.
  - `backend/src/routes/security-ip-rules.ts` — routes CRUD.
  - `backend/src/__tests__/ipMatcher.test.ts` — unit.
  - `backend/src/__tests__/securityIpRulesRoute.test.ts` — intégration.

- **Backend — Modify**
  - `backend/package.json` — ajout `ipaddr.js`.
  - `backend/src/server.ts` — `trust proxy`, montage middlewares + routes.

- **Frontend — Create**
  - `src/components/security/IPRuleFormDialog.tsx` — Dialog MUI create/edit.

- **Frontend — Modify**
  - `src/services/api.ts` — section `ApiService.security.ipRules.*`.
  - `src/components/security/IPRulesTab.tsx` — réécriture du placeholder.

---

## Task 1 — Backend : helpers purs `ipMatcher` (TDD)

**Files:**
- Create: `backend/src/services/ipMatcher.ts`
- Create: `backend/src/__tests__/ipMatcher.test.ts`
- Modify: `backend/package.json` (ajout `ipaddr.js`)

- [ ] **Step 1.1 — Installer `ipaddr.js`**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npm install ipaddr.js
```

Vérifier ensuite que `package.json` liste `"ipaddr.js": "^2.x"` dans `dependencies`.

- [ ] **Step 1.2 — Écrire les tests**

Créer `backend/src/__tests__/ipMatcher.test.ts` :

```typescript
import { validateIpOrCidr, ipMatches, normalizeIp } from '../services/ipMatcher';

describe('validateIpOrCidr', () => {
  it('accepte les IPv4 simples', () => {
    expect(validateIpOrCidr('192.168.1.1').valid).toBe(true);
    expect(validateIpOrCidr('10.0.0.0').valid).toBe(true);
  });
  it('accepte les IPv4/CIDR', () => {
    const r = validateIpOrCidr('192.168.1.0/24');
    expect(r.valid).toBe(true);
    expect(r.isCidr).toBe(true);
    expect(r.family).toBe(4);
  });
  it('accepte les IPv6 simples', () => {
    expect(validateIpOrCidr('2001:db8::1').valid).toBe(true);
    expect(validateIpOrCidr('::1').valid).toBe(true);
  });
  it('accepte les IPv6/CIDR', () => {
    const r = validateIpOrCidr('2001:db8::/32');
    expect(r.valid).toBe(true);
    expect(r.isCidr).toBe(true);
    expect(r.family).toBe(6);
  });
  it('refuse les inputs vides ou mal formés', () => {
    expect(validateIpOrCidr('').valid).toBe(false);
    expect(validateIpOrCidr('hello').valid).toBe(false);
    expect(validateIpOrCidr('192.168.1.999').valid).toBe(false);
  });
  it('refuse les prefixes hors-bornes', () => {
    expect(validateIpOrCidr('192.168.1.0/33').valid).toBe(false);
    expect(validateIpOrCidr('2001:db8::/129').valid).toBe(false);
    expect(validateIpOrCidr('192.168.1.0/-1').valid).toBe(false);
  });
  it('normalise (trim + lowercase)', () => {
    expect(validateIpOrCidr('  2001:DB8::1 ').normalized).toBe('2001:db8::1');
  });
});

describe('ipMatches', () => {
  it('IP simple = IP simple (exact)', () => {
    expect(ipMatches('192.168.1.1', '192.168.1.1')).toBe(true);
    expect(ipMatches('192.168.1.1', '192.168.1.2')).toBe(false);
  });
  it('IP dans CIDR IPv4', () => {
    expect(ipMatches('192.168.1.42', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.2.42', '192.168.1.0/24')).toBe(false);
  });
  it('IP dans CIDR IPv6', () => {
    expect(ipMatches('2001:db8::abcd', '2001:db8::/32')).toBe(true);
    expect(ipMatches('2001:db9::1',    '2001:db8::/32')).toBe(false);
  });
  it('IPv4-mappé-en-IPv6 matche son équivalent IPv4', () => {
    expect(ipMatches('::ffff:192.168.1.1', '192.168.1.1')).toBe(true);
    expect(ipMatches('::ffff:192.168.1.1', '192.168.1.0/24')).toBe(true);
  });
  it('CIDR /32 = exact match', () => {
    expect(ipMatches('10.0.0.5', '10.0.0.5/32')).toBe(true);
    expect(ipMatches('10.0.0.6', '10.0.0.5/32')).toBe(false);
  });
  it('CIDR /0 matche tout (IPv4)', () => {
    expect(ipMatches('192.168.1.1', '0.0.0.0/0')).toBe(true);
  });
  it('retourne false si l\'IP ou la règle est invalide', () => {
    expect(ipMatches('not-an-ip', '192.168.1.0/24')).toBe(false);
    expect(ipMatches('192.168.1.1', 'invalid-rule')).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('compresse les IPv6', () => {
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });
  it('passe IPv4 inchangée', () => {
    expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1');
  });
  it('retourne null pour invalide', () => {
    expect(normalizeIp('not-ip')).toBeNull();
  });
});
```

- [ ] **Step 1.3 — Lancer le test pour vérifier qu'il échoue**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx jest src/__tests__/ipMatcher.test.ts
```
Expected: FAIL — `Cannot find module '../services/ipMatcher'`.

- [ ] **Step 1.4 — Implémenter le helper**

Créer `backend/src/services/ipMatcher.ts` :

```typescript
/**
 * ipMatcher.ts
 *
 * Helpers purs pour validation et matching d'adresses IP et CIDR
 * (IPv4 + IPv6). S'appuie sur ipaddr.js. Aucune dépendance Prisma.
 */

import * as ipaddr from 'ipaddr.js';

export interface IpValidationResult {
  valid: boolean;
  normalized?: string;
  family?: 4 | 6;
  isCidr?: boolean;
}

/**
 * Valide une chaîne IP ou IP/CIDR. Retourne la valeur normalisée si valide.
 */
export function validateIpOrCidr(input: string): IpValidationResult {
  if (!input || typeof input !== 'string') return { valid: false };
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { valid: false };

  // CIDR : présence d'un slash
  if (trimmed.includes('/')) {
    try {
      const [addr, prefixStr] = trimmed.split('/');
      const prefix = Number(prefixStr);
      if (!Number.isInteger(prefix) || prefix < 0) return { valid: false };
      const parsed = ipaddr.parse(addr);
      const max = parsed.kind() === 'ipv4' ? 32 : 128;
      if (prefix > max) return { valid: false };
      return {
        valid: true,
        normalized: `${parsed.toNormalizedString()}/${prefix}`,
        family: parsed.kind() === 'ipv4' ? 4 : 6,
        isCidr: true,
      };
    } catch {
      return { valid: false };
    }
  }

  // IP simple
  try {
    const parsed = ipaddr.parse(trimmed);
    return {
      valid: true,
      normalized: parsed.toNormalizedString(),
      family: parsed.kind() === 'ipv4' ? 4 : 6,
      isCidr: false,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Vérifie si une IP matche une règle (IP simple ou CIDR).
 * Retourne false si l'un ou l'autre est invalide.
 */
export function ipMatches(ip: string, rule: string): boolean {
  if (!ip || !rule) return false;
  try {
    const ipParsed = ipaddr.parse(ip.trim());
    const ruleStr = rule.trim();

    // CIDR
    if (ruleStr.includes('/')) {
      const cidr = ipaddr.parseCIDR(ruleStr);
      // Pont IPv4 / IPv6 : si le CIDR est IPv4 et l'IP est un IPv4-mappé-en-IPv6, on convertit.
      if (cidr[0].kind() === 'ipv4' && ipParsed.kind() === 'ipv6') {
        const v6 = ipParsed as ipaddr.IPv6;
        if (v6.isIPv4MappedAddress()) {
          return v6.toIPv4Address().match(cidr as [ipaddr.IPv4, number]);
        }
        return false;
      }
      if (cidr[0].kind() === 'ipv6' && ipParsed.kind() === 'ipv4') {
        return false;
      }
      return ipParsed.match(cidr as any);
    }

    // IP simple : match exact normalisé
    const ruleParsed = ipaddr.parse(ruleStr);
    if (ipParsed.kind() === ruleParsed.kind()) {
      return ipParsed.toNormalizedString() === ruleParsed.toNormalizedString();
    }
    // Pont IPv4/IPv6 sur match exact
    if (ipParsed.kind() === 'ipv6' && ruleParsed.kind() === 'ipv4') {
      const v6 = ipParsed as ipaddr.IPv6;
      if (v6.isIPv4MappedAddress()) {
        return v6.toIPv4Address().toString() === (ruleParsed as ipaddr.IPv4).toString();
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Normalise une IP (compression IPv6, trim). Null si invalide.
 */
export function normalizeIp(input: string): string | null {
  try {
    const trimmed = input.trim();
    return ipaddr.parse(trimmed).toNormalizedString();
  } catch {
    return null;
  }
}
```

- [ ] **Step 1.5 — Vérifier que les tests passent**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/ipMatcher.test.ts
```
Expected: PASS, tous les tests verts (≈ 17 tests).

- [ ] **Step 1.6 — Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 1.7 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/package.json backend/package-lock.json backend/src/services/ipMatcher.ts backend/src/__tests__/ipMatcher.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): helpers ipMatcher (validation + match IPv4/IPv6/CIDR)

Helpers purs basés sur ipaddr.js. validateIpOrCidr, ipMatches, normalizeIp.
Supporte le pont IPv4-mappé-IPv6 (::ffff:x.x.x.x ↔ x.x.x.x)."
```

---

## Task 2 — Backend : cache Redis des règles

**Files:**
- Create: `backend/src/services/securityRulesCache.ts`

- [ ] **Step 2.1 — Vérifier l'API Redis disponible**

```bash
grep -n "export\|get\|set\|del" /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/src/services/redis.ts | head -20
```
Note les fonctions exportées (`getRedis`, `redisGet`, `redisSet`, etc.) — adapter les noms ci-dessous si nécessaire.

- [ ] **Step 2.2 — Implémenter le cache**

Créer `backend/src/services/securityRulesCache.ts` :

```typescript
/**
 * securityRulesCache.ts
 *
 * Cache Redis des règles IP actives, par scope (plateforme | tenant).
 * TTL 60s. Tolérance Redis down (fallback DB direct, log warn).
 */

import { prisma } from '../prismaClient';
import { logger } from '../utils/logger';
import { getRedis } from './redis';

export const IP_RULES_CACHE_TTL_SEC = 60;

export interface CachedIpRule {
  ipAddress: string;
  ruleType: 'ALLOW' | 'DENY';
}

const KEY_PLATFORM = 'sec:ip-rules:platform';
const keyTenant = (companyId: string) => `sec:ip-rules:tenant:${companyId}`;

async function loadFromDb(companyId: string | null): Promise<CachedIpRule[]> {
  const rows = await prisma.securityIpRule.findMany({
    where: {
      companyId: companyId,
      isActive: true,
      deletedAt: null,
    },
    select: { ipAddress: true, ruleType: true },
  });
  return rows.map(r => ({ ipAddress: r.ipAddress, ruleType: r.ruleType }));
}

async function tryRedis<T>(fn: (client: any) => Promise<T>): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    return await fn(client);
  } catch (e) {
    logger.warn('[securityRulesCache] Redis error, falling back to DB', { err: String(e) });
    return null;
  }
}

export async function getCachedPlatformIpRules(): Promise<CachedIpRule[]> {
  const cached = await tryRedis(async (c) => {
    const raw = await c.get(KEY_PLATFORM);
    return raw ? (JSON.parse(raw) as CachedIpRule[]) : null;
  });
  if (cached) return cached;

  const fresh = await loadFromDb(null);
  await tryRedis(async (c) => {
    await c.set(KEY_PLATFORM, JSON.stringify(fresh), 'EX', IP_RULES_CACHE_TTL_SEC);
  });
  return fresh;
}

export async function getCachedTenantIpRules(companyId: string): Promise<CachedIpRule[]> {
  const key = keyTenant(companyId);
  const cached = await tryRedis(async (c) => {
    const raw = await c.get(key);
    return raw ? (JSON.parse(raw) as CachedIpRule[]) : null;
  });
  if (cached) return cached;

  const fresh = await loadFromDb(companyId);
  await tryRedis(async (c) => {
    await c.set(key, JSON.stringify(fresh), 'EX', IP_RULES_CACHE_TTL_SEC);
  });
  return fresh;
}

export async function invalidateIpRulesCache(companyId: string | null): Promise<void> {
  const key = companyId === null ? KEY_PLATFORM : keyTenant(companyId);
  await tryRedis(async (c) => { await c.del(key); });
}
```

Note : si `getRedis` n'existe pas dans `redis.ts` ou si l'API expose des fonctions wrapper (`redisGet`, `redisSet`, `redisDel`), remplacer les appels par celles-ci. Si Redis n'est pas configuré du tout dans le projet, garder la structure et désactiver le bloc cache (retourner toujours `loadFromDb`).

- [ ] **Step 2.3 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 2.4 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/services/securityRulesCache.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): cache Redis 60s des règles IP actives

Clés : sec:ip-rules:platform | sec:ip-rules:tenant:<companyId>.
Fallback DB transparent si Redis indisponible. Invalidation manuelle
exposée pour les mutations."
```

---

## Task 3 — Backend : service CRUD `securityIpRulesService`

**Files:**
- Create: `backend/src/services/securityIpRulesService.ts`

- [ ] **Step 3.1 — Implémenter le service**

Créer `backend/src/services/securityIpRulesService.ts` :

```typescript
/**
 * securityIpRulesService.ts
 *
 * CRUD des règles IP, avec validation, anti-self-lockout et
 * invalidation du cache Redis.
 */

import { Prisma, SecurityRuleType } from '@prisma/client';
import { prisma } from '../prismaClient';
import { validateIpOrCidr, ipMatches } from './ipMatcher';
import { invalidateIpRulesCache } from './securityRulesCache';

export class SecurityIpRuleError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export class SelfLockoutError extends SecurityIpRuleError {
  constructor(ip: string) {
    super(
      'self_lockout_prevented',
      `Cette règle bloquerait votre propre IP (${ip}). Modifiez la portée ou désactivez la règle.`,
      422
    );
  }
}

export interface ListIpRulesOpts {
  companyId: string;        // tenant courant du requester (peut être ignoré pour SUPER_ADMIN)
  isAdmin: boolean;
  isSuperAdmin: boolean;
  scope?: 'platform' | 'tenant' | 'all';
  isActive?: boolean;
  ruleType?: SecurityRuleType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listIpRules(opts: ListIpRulesOpts) {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

  const scope = opts.scope ?? 'all';

  const where: Prisma.SecurityIpRuleWhereInput = { deletedAt: null };

  if (scope === 'platform') {
    if (!opts.isSuperAdmin) {
      throw new SecurityIpRuleError('forbidden', 'Scope plateforme réservé au SUPER_ADMIN', 403);
    }
    where.companyId = null;
  } else if (scope === 'tenant') {
    where.companyId = opts.companyId;
  } else {
    where.OR = [{ companyId: null }, { companyId: opts.companyId }];
  }

  if (opts.isActive !== undefined) where.isActive = opts.isActive;
  if (opts.ruleType) where.ruleType = opts.ruleType;
  if (opts.search) {
    where.OR = [
      { ipAddress:   { contains: opts.search, mode: 'insensitive' } },
      { description: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.securityIpRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
      include: { creator: { select: { id: true, name: true } } },
    }),
    prisma.securityIpRule.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export interface CreateIpRuleInput {
  ipAddress: string;
  ruleType: SecurityRuleType;
  description?: string;
  isActive?: boolean;
  companyId: string | null;
  createdBy: string;
}

export async function createIpRule(input: CreateIpRuleInput, requesterIp: string) {
  const v = validateIpOrCidr(input.ipAddress);
  if (!v.valid) {
    throw new SecurityIpRuleError('invalid_ip', `Adresse IP ou CIDR invalide : ${input.ipAddress}`, 400);
  }
  const normalized = v.normalized!;
  const isActive = input.isActive ?? true;

  if (input.ruleType === 'DENY' && isActive && ipMatches(requesterIp, normalized)) {
    throw new SelfLockoutError(requesterIp);
  }

  const created = await prisma.securityIpRule.create({
    data: {
      ipAddress: normalized,
      ruleType: input.ruleType,
      description: input.description ?? null,
      isActive,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  await invalidateIpRulesCache(created.companyId);
  return created;
}

export interface UpdateIpRuleInput {
  ipAddress?: string;
  ruleType?: SecurityRuleType;
  description?: string | null;
  isActive?: boolean;
}

export async function updateIpRule(id: string, input: UpdateIpRuleInput, requesterIp: string) {
  const existing = await prisma.securityIpRule.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new SecurityIpRuleError('not_found', 'Règle introuvable', 404);
  }

  let normalized = existing.ipAddress;
  if (input.ipAddress !== undefined) {
    const v = validateIpOrCidr(input.ipAddress);
    if (!v.valid) {
      throw new SecurityIpRuleError('invalid_ip', `Adresse IP ou CIDR invalide : ${input.ipAddress}`, 400);
    }
    normalized = v.normalized!;
  }

  const ruleType = input.ruleType ?? existing.ruleType;
  const isActive = input.isActive ?? existing.isActive;

  if (ruleType === 'DENY' && isActive && ipMatches(requesterIp, normalized)) {
    throw new SelfLockoutError(requesterIp);
  }

  const updated = await prisma.securityIpRule.update({
    where: { id },
    data: {
      ipAddress: normalized,
      ruleType,
      description: input.description === undefined ? existing.description : input.description,
      isActive,
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  await invalidateIpRulesCache(updated.companyId);
  return updated;
}

export async function toggleIpRule(id: string, requesterIp: string) {
  const existing = await prisma.securityIpRule.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new SecurityIpRuleError('not_found', 'Règle introuvable', 404);
  }

  const willBeActive = !existing.isActive;
  if (willBeActive && existing.ruleType === 'DENY' && ipMatches(requesterIp, existing.ipAddress)) {
    throw new SelfLockoutError(requesterIp);
  }

  const updated = await prisma.securityIpRule.update({
    where: { id },
    data: { isActive: willBeActive },
    include: { creator: { select: { id: true, name: true } } },
  });

  await invalidateIpRulesCache(updated.companyId);
  return updated;
}

export async function softDeleteIpRule(id: string) {
  const existing = await prisma.securityIpRule.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new SecurityIpRuleError('not_found', 'Règle introuvable', 404);
  }
  await prisma.securityIpRule.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await invalidateIpRulesCache(existing.companyId);
  return { id };
}
```

- [ ] **Step 3.2 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 3.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/services/securityIpRulesService.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): service CRUD securityIpRulesService

CRUD avec validation IP/CIDR stricte, anti-self-lockout sur DENY actif,
invalidation cache Redis sur mutation, soft delete. Erreur typée
SelfLockoutError → 422 self_lockout_prevented."
```

---

## Task 4 — Backend : middleware `extractRealIp` + routes + intégration tests

**Files:**
- Create: `backend/src/middleware/extractRealIp.ts`
- Create: `backend/src/routes/security-ip-rules.ts`
- Create: `backend/src/__tests__/securityIpRulesRoute.test.ts`

- [ ] **Step 4.1 — `extractRealIp`**

Créer `backend/src/middleware/extractRealIp.ts` :

```typescript
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      realIp?: string;
    }
  }
}

/**
 * Extrait l'IP réelle du client en respectant X-Forwarded-For (premier
 * élément, trim). Requiert `app.set('trust proxy', true)` côté serveur.
 */
export function extractRealIp(req: Request, _res: Response, next: NextFunction): void {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    req.realIp = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    req.realIp = String(xff[0]).split(',')[0].trim();
  } else {
    req.realIp = req.ip ?? '';
  }
  next();
}
```

- [ ] **Step 4.2 — Routes `security-ip-rules.ts`**

Créer `backend/src/routes/security-ip-rules.ts` :

```typescript
import { Router, Request, Response } from 'express';
import { authorize } from '../middleware/auth';
import {
  listIpRules, createIpRule, updateIpRule, toggleIpRule, softDeleteIpRule,
  SecurityIpRuleError,
} from '../services/securityIpRulesService';

const router = Router();

router.use(authorize(['manage_security']));

function isSuperAdmin(req: Request): boolean {
  return req.user?.role === 'SUPER_ADMIN';
}

function isAdmin(req: Request): boolean {
  return req.user?.role === 'ADMIN' || isSuperAdmin(req);
}

function handle(res: Response, e: unknown) {
  if (e instanceof SecurityIpRuleError) {
    return res.status(e.status).json({ success: false, error: e.code, message: e.message });
  }
  console.error('[security-ip-rules]', e);
  return res.status(500).json({ success: false, error: 'internal', message: 'Erreur serveur' });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await listIpRules({
      companyId: req.user!.companyId ?? '',
      isAdmin: isAdmin(req),
      isSuperAdmin: isSuperAdmin(req),
      scope: (req.query.scope as any) ?? 'all',
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      ruleType: req.query.ruleType as any,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : 0,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
    });
    res.json({ success: true, data });
  } catch (e) { handle(res, e); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const wantsPlatform = req.body.companyId === null;
    if (wantsPlatform && !isSuperAdmin(req)) {
      return res.status(403).json({
        success: false, error: 'forbidden_platform_scope',
        message: 'Seul SUPER_ADMIN peut créer une règle plateforme',
      });
    }
    const companyId = wantsPlatform ? null : (req.user!.companyId ?? null);
    if (!wantsPlatform && !companyId) {
      return res.status(400).json({
        success: false, error: 'missing_tenant',
        message: 'companyId requis pour une règle non-plateforme',
      });
    }
    const created = await createIpRule({
      ipAddress: req.body.ipAddress,
      ruleType: req.body.ruleType,
      description: req.body.description,
      isActive: req.body.isActive,
      companyId,
      createdBy: req.user!.id,
    }, req.realIp ?? req.ip ?? '');
    res.status(201).json({ success: true, data: created });
  } catch (e) { handle(res, e); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateIpRule(req.params.id, {
      ipAddress: req.body.ipAddress,
      ruleType: req.body.ruleType,
      description: req.body.description,
      isActive: req.body.isActive,
    }, req.realIp ?? req.ip ?? '');
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const updated = await toggleIpRule(req.params.id, req.realIp ?? req.ip ?? '');
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await softDeleteIpRule(req.params.id);
    res.json({ success: true, data: deleted });
  } catch (e) { handle(res, e); }
});

export default router;
```

- [ ] **Step 4.3 — Test d'intégration**

Créer `backend/src/__tests__/securityIpRulesRoute.test.ts` :

```typescript
import express from 'express';
import request from 'supertest';

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    req.companyId = req.user?.companyId;
    next();
  },
  authorize: () => (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).end();
    const isAdminLike = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    const hasWildcard = (req.user.permissions || []).includes('*');
    if (isAdminLike || hasWildcard) return next();
    return res.status(403).end();
  },
  requireCompany: (req: any, res: any, next: any) => req.companyId ? next() : res.status(403).end(),
}));

import { PrismaClient } from '@prisma/client';
import ipRulesRouter from '../routes/security-ip-rules';
import { extractRealIp } from '../middleware/extractRealIp';

const prisma = new PrismaClient();
const COMPANY = 'co-ip-rules-test';
const ADMIN = { id: 'u-admin', role: 'ADMIN', companyId: COMPANY, permissions: [] };
const ANALYST = { id: 'u-analyst', role: 'ANALYSTE_RISQUES', companyId: COMPANY, permissions: [] };
const SUPER  = { id: 'u-super', role: 'SUPER_ADMIN', companyId: COMPANY, permissions: ['*'] };

function makeApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(extractRealIp);
  app.use('/api/security/ip-rules', ipRulesRouter);
  return app;
}

describe('Routes /api/security/ip-rules', () => {
  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'IP Rules Test', code: 'ip-test' } });
    await prisma.user.create({
      data: { id: ADMIN.id, email: 'admin@test.local', name: 'Admin', role: 'ADMIN' as any },
    });
    await prisma.user.create({
      data: { id: ANALYST.id, email: 'analyst@test.local', name: 'Analyst', role: 'ANALYSTE_RISQUES' as any },
    });
    await prisma.user.create({
      data: { id: SUPER.id, email: 'super@test.local', name: 'Super', role: 'SUPER_ADMIN' as any },
    });
  });

  afterAll(async () => {
    await prisma.securityIpRule.deleteMany({ where: { OR: [{ companyId: COMPANY }, { createdBy: { in: [ADMIN.id, ANALYST.id, SUPER.id] } }] } });
    await prisma.user.deleteMany({ where: { id: { in: [ADMIN.id, ANALYST.id, SUPER.id] } } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('ANALYSTE → 403', async () => {
    const res = await request(makeApp()).get('/api/security/ip-rules').set('x-test-user', JSON.stringify(ANALYST));
    expect(res.status).toBe(403);
  });

  it('ADMIN crée une règle ALLOW → 201', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: '203.0.113.0/24', ruleType: 'ALLOW', description: 'Bureau' });
    expect(res.status).toBe(201);
    expect(res.body.data.ipAddress).toBe('203.0.113.0/24');
    expect(res.body.data.companyId).toBe(COMPANY);
  });

  it('IP invalide → 400', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: 'pas-une-ip', ruleType: 'ALLOW' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_ip');
  });

  it('DENY qui couvre l\'IP requester → 422 self_lockout_prevented', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .set('x-forwarded-for', '198.51.100.42')
      .send({ ipAddress: '198.51.100.0/24', ruleType: 'DENY' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('self_lockout_prevented');
  });

  it('ADMIN ne peut pas créer une règle plateforme (companyId: null) → 403', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: '10.0.0.0/24', ruleType: 'ALLOW', companyId: null });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden_platform_scope');
  });

  it('SUPER_ADMIN peut créer une règle plateforme', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ ipAddress: '10.0.0.0/24', ruleType: 'ALLOW', companyId: null });
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBeNull();
  });

  it('Toggle d\'une règle DENY existante qui couvrirait l\'IP → 422', async () => {
    // Crée d'abord une règle DENY inactive
    const created = await prisma.securityIpRule.create({
      data: { ipAddress: '198.51.100.0/24', ruleType: 'DENY', isActive: false, companyId: COMPANY, createdBy: ADMIN.id },
    });
    const res = await request(makeApp())
      .patch(`/api/security/ip-rules/${created.id}/toggle`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .set('x-forwarded-for', '198.51.100.42');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('self_lockout_prevented');
  });

  it('Soft delete → la règle n\'apparaît plus dans la liste', async () => {
    const created = await prisma.securityIpRule.create({
      data: { ipAddress: '203.0.113.99', ruleType: 'ALLOW', isActive: true, companyId: COMPANY, createdBy: ADMIN.id },
    });
    const del = await request(makeApp())
      .delete(`/api/security/ip-rules/${created.id}`)
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(del.status).toBe(200);

    const list = await request(makeApp())
      .get('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN));
    const ids = list.body.data.items.map((r: any) => r.id);
    expect(ids).not.toContain(created.id);
  });
});
```

- [ ] **Step 4.4 — Lancer le test**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/securityIpRulesRoute.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 4.5 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 4.6 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/middleware/extractRealIp.ts backend/src/routes/security-ip-rules.ts backend/src/__tests__/securityIpRulesRoute.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): routes /api/security/ip-rules + extractRealIp middleware

5 routes CRUD/toggle/delete gardées par authorize(['manage_security']).
Permission gate avec bypass admin/wildcard. Tests d'intégration : ADMIN
create/list/toggle/delete, ANALYST refusé, IP invalide, anti-lockout,
scope plateforme SUPER_ADMIN-only."
```

---

## Task 5 — Backend : middleware d'enforcement `ipAccess`

**Files:**
- Create: `backend/src/middleware/ipAccess.ts`

- [ ] **Step 5.1 — Implémenter le middleware**

Créer `backend/src/middleware/ipAccess.ts` :

```typescript
/**
 * ipAccess.ts
 *
 * Middlewares d'enforcement des règles IP.
 *   - platformIpGate : à monter AVANT auth (scope plateforme uniquement).
 *   - tenantIpGate   : à monter APRÈS auth (scope tenant via req.companyId).
 *
 * Cascade : DENY plateforme > DENY tenant > ALLOW tenant > default ALLOW.
 * Population du security_block_history à chaque BLOCK (best-effort).
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';
import { ipMatches } from '../services/ipMatcher';
import { getCachedPlatformIpRules, getCachedTenantIpRules, CachedIpRule } from '../services/securityRulesCache';
import { logger } from '../utils/logger';

function evaluateBlock(ip: string, rules: CachedIpRule[]): { decision: 'allow' | 'deny' | 'none' } {
  // ALLOW d'abord (explicite)
  for (const r of rules) {
    if (r.ruleType === 'ALLOW' && ipMatches(ip, r.ipAddress)) {
      return { decision: 'allow' };
    }
  }
  // DENY ensuite
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

const BLOCKED_RESPONSE = {
  success: false,
  error: 'ip_blocked',
  message: 'Accès refusé : votre adresse IP est bloquée.',
};

export async function platformIpGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.realIp ?? req.ip ?? '';
  if (!ip) return next();
  const rules = await getCachedPlatformIpRules();
  const { decision } = evaluateBlock(ip, rules);
  if (decision === 'deny') {
    await recordBlock(ip, null, null, req);
    res.status(403).json(BLOCKED_RESPONSE);
    return;
  }
  next();
}

export async function tenantIpGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.realIp ?? req.ip ?? '';
  if (!ip || !req.companyId) return next();
  const rules = await getCachedTenantIpRules(req.companyId);
  const { decision } = evaluateBlock(ip, rules);
  if (decision === 'deny') {
    await recordBlock(ip, req.companyId, req.user?.id ?? null, req);
    res.status(403).json(BLOCKED_RESPONSE);
    return;
  }
  next();
}
```

- [ ] **Step 5.2 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 5.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/middleware/ipAccess.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): middleware platformIpGate + tenantIpGate

Évaluation : ALLOW (early return) puis DENY (block). Écriture du
security_block_history à chaque blocage (reason='IP_BLACKLISTED'),
en best-effort (un échec d'écriture ne bloque pas la réponse 403)."
```

---

## Task 6 — Backend : câblage `server.ts` (trust proxy + middlewares + route)

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 6.1 — Lire la zone à modifier**

```bash
grep -n "app\\.use(helmet\|globalLimiter\|app\\.use('/api/clients'\|app\\.use(express\\.json\|app\\.set(" /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/src/server.ts | head -10
```

- [ ] **Step 6.2 — Activer `trust proxy`**

Si `app.set('trust proxy'` n'existe pas dans server.ts, ajouter juste après la création de `app` (vers le début du fichier) :

```typescript
app.set('trust proxy', true);
```

- [ ] **Step 6.3 — Importer les middlewares + la route**

Ajouter aux imports en haut de `server.ts` :

```typescript
import { extractRealIp } from './middleware/extractRealIp';
import { platformIpGate, tenantIpGate } from './middleware/ipAccess';
import securityIpRulesRoutes from './routes/security-ip-rules';
```

- [ ] **Step 6.4 — Monter `extractRealIp` puis `platformIpGate`**

Juste après `app.use(helmet())` et avant `app.use(globalLimiter)`, insérer :

```typescript
app.use(extractRealIp);
app.use(platformIpGate);
```

- [ ] **Step 6.5 — Monter `tenantIpGate` sur chaque route protégée**

Trouver toutes les lignes du type `app.use('/api/xxx', authenticate, xxxRoutes)` et insérer `tenantIpGate` entre `authenticate` et `xxxRoutes`. Pour limiter le diff, créer un alias d'array d'authentification dans server.ts juste avant le bloc :

```typescript
const protect = [authenticate, tenantIpGate];
```

puis remplacer **uniquement la première route protégée** (`/api/clients`) en démonstration :

```typescript
app.use('/api/clients', ...protect, clientRoutes);
```

Et ajouter la nouvelle route de gestion `/api/security/ip-rules` :

```typescript
app.use('/api/security/ip-rules', ...protect, securityIpRulesRoutes);
```

Note pragmatique : pour limiter le périmètre de cette PR, on monte `tenantIpGate` uniquement sur `/api/clients` et `/api/security/ip-rules`. Les autres routes seront migrées dans une Phase 2.5 follow-up. Documenter ce choix dans le commit.

- [ ] **Step 6.6 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```
Expected: aucun output.

- [ ] **Step 6.7 — Lancer toute la suite Phase 2 backend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/ipMatcher.test.ts src/__tests__/securityIpRulesRoute.test.ts
```
Expected: tous passent (≈ 25 tests).

- [ ] **Step 6.8 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/server.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): câblage server.ts — trust proxy + ipAccess + route

trust proxy activé. extractRealIp + platformIpGate montés tôt (avant
auth). tenantIpGate appliqué à /api/clients et /api/security/ip-rules
en démo ; migration des autres routes en follow-up."
```

---

## Task 7 — Frontend : ApiService

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 7.1 — Ajouter la section `security.ipRules`**

Repérer la fin de la classe `ApiService` dans `src/services/api.ts` (probablement juste avant l'export par défaut ou la dernière accolade fermante). Ajouter en propriété statique :

```typescript
  static security = {
    ipRules: {
      list: async (params: {
        isActive?: boolean;
        ruleType?: 'ALLOW' | 'DENY';
        search?: string;
        scope?: 'platform' | 'tenant' | 'all';
        page?: number;
        pageSize?: number;
      } = {}): Promise<{ success: boolean; data: { items: any[]; total: number; page: number; pageSize: number } }> => {
        const r = await api.get('/security/ip-rules', { params });
        return r.data;
      },
      create: async (body: {
        ipAddress: string;
        ruleType: 'ALLOW' | 'DENY';
        description?: string;
        isActive?: boolean;
        companyId?: string | null;
      }) => {
        const r = await api.post('/security/ip-rules', body);
        return r.data;
      },
      update: async (id: string, body: {
        ipAddress?: string;
        ruleType?: 'ALLOW' | 'DENY';
        description?: string | null;
        isActive?: boolean;
      }) => {
        const r = await api.put(`/security/ip-rules/${id}`, body);
        return r.data;
      },
      toggle: async (id: string) => {
        const r = await api.patch(`/security/ip-rules/${id}/toggle`);
        return r.data;
      },
      remove: async (id: string) => {
        const r = await api.delete(`/security/ip-rules/${id}`);
        return r.data;
      },
    },
  };
```

- [ ] **Step 7.2 — Vérifier TS frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .
```
Expected: aucun output.

- [ ] **Step 7.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/services/api.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(api): ApiService.security.ipRules.*

5 wrappers TS : list, create, update, toggle, remove pour
/api/security/ip-rules."
```

---

## Task 8 — Frontend : `IPRuleFormDialog`

**Files:**
- Create: `src/components/security/IPRuleFormDialog.tsx`

- [ ] **Step 8.1 — Implémenter le Dialog**

```tsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, RadioGroup, Radio, FormControlLabel, FormControl,
  Switch, FormHelperText, Alert, Box, Typography, Checkbox,
} from '@mui/material';
import { ApiService } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { colors } from '../home/homeTokens';

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/;

export interface IpRule {
  id: string;
  ipAddress: string;
  ruleType: 'ALLOW' | 'DENY';
  description: string | null;
  isActive: boolean;
  companyId: string | null;
}

interface Props {
  open: boolean;
  initial?: IpRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function IPRuleFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { isRole } = useUser();
  const isSuperAdmin = isRole('super_admin');

  const [ipAddress, setIpAddress] = useState('');
  const [ruleType, setRuleType] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPlatform, setIsPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIpAddress(initial?.ipAddress ?? '');
      setRuleType(initial?.ruleType ?? 'ALLOW');
      setDescription(initial?.description ?? '');
      setIsActive(initial?.isActive ?? true);
      setIsPlatform(initial ? initial.companyId === null : false);
      setError(null);
    }
  }, [open, initial]);

  const ipValid = !ipAddress || IP_REGEX.test(ipAddress.trim());

  async function handleSave() {
    setError(null);
    if (!ipAddress.trim()) { setError('Adresse IP requise'); return; }
    if (!ipValid) { setError('Format IP/CIDR invalide'); return; }

    setSaving(true);
    try {
      if (initial) {
        await ApiService.security.ipRules.update(initial.id, {
          ipAddress: ipAddress.trim(),
          ruleType,
          description: description || null,
          isActive,
        });
      } else {
        await ApiService.security.ipRules.create({
          ipAddress: ipAddress.trim(),
          ruleType,
          description: description || undefined,
          isActive,
          ...(isSuperAdmin && isPlatform ? { companyId: null } : {}),
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erreur lors de l\'enregistrement';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: colors.text.primary }}>
        {initial ? 'Modifier la règle IP' : 'Ajouter une règle IP'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Adresse IP / CIDR"
            value={ipAddress}
            onChange={e => setIpAddress(e.target.value)}
            placeholder="192.168.1.0/24 ou 2001:db8::/32 ou 203.0.113.42"
            error={!!ipAddress && !ipValid}
            helperText={!ipValid ? 'Format invalide' : 'IPv4, IPv6 ou CIDR (ex: 192.168.1.0/24)'}
            fullWidth
            size="small"
          />
          <FormControl>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: colors.text.secondary }}>Type</Typography>
            <RadioGroup row value={ruleType} onChange={e => setRuleType(e.target.value as 'ALLOW' | 'DENY')}>
              <FormControlLabel value="ALLOW" control={<Radio size="small" />} label="Autoriser (allow)" />
              <FormControlLabel value="DENY"  control={<Radio size="small" />} label="Bloquer (deny)" />
            </RadioGroup>
          </FormControl>
          <TextField
            label="Description (facultatif)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
            label="Règle active"
          />
          {isSuperAdmin && !initial && (
            <FormControlLabel
              control={<Checkbox checked={isPlatform} onChange={e => setIsPlatform(e.target.checked)} />}
              label="Règle plateforme (s'applique à tous les tenants)"
            />
          )}
          {error && <Alert severity="error" sx={{ borderRadius: 1 }}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !ipAddress.trim() || !ipValid}
          variant="contained"
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          {initial ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 8.2 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .
```
Expected: aucun output.

- [ ] **Step 8.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/security/IPRuleFormDialog.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): IPRuleFormDialog (create/edit modal)

Dialog MUI avec champs IP, type allow/deny, description, actif et
toggle 'règle plateforme' réservé SUPER_ADMIN. Validation regex
côté front + affichage des erreurs serveur (self_lockout_prevented
notamment) en Alert sans fermer la modal."
```

---

## Task 9 — Frontend : réécriture `IPRulesTab`

**Files:**
- Modify: `src/components/security/IPRulesTab.tsx`

- [ ] **Step 9.1 — Réécrire le placeholder**

Remplacer intégralement le contenu de `src/components/security/IPRulesTab.tsx` par :

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Snackbar, Switch, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DataTable, DataTableColumn } from '../common/DataTable';
import { ApiService } from '../../services/api';
import { colors } from '../home/homeTokens';
import { IPRuleFormDialog, IpRule } from './IPRuleFormDialog';

interface SnackState { open: boolean; severity: 'success' | 'error' | 'info'; message: string; }

export function IPRulesTab() {
  const [rows, setRows] = useState<IpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IpRule | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, severity: 'success', message: '' });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.security.ipRules.list({ pageSize: 100 });
      setRows(res.data.items as IpRule[]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleToggle(row: IpRule) {
    try {
      await ApiService.security.ipRules.toggle(row.id);
      setSnack({ open: true, severity: 'success', message: row.isActive ? 'Règle désactivée' : 'Règle activée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  async function handleRemove(row: IpRule) {
    if (!window.confirm(`Supprimer la règle ${row.ipAddress} ?`)) return;
    try {
      await ApiService.security.ipRules.remove(row.id);
      setSnack({ open: true, severity: 'success', message: 'Règle supprimée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  const columns: DataTableColumn<IpRule>[] = [
    {
      id: 'ipAddress', header: 'IP / CIDR',
      accessor: (r) => r.ipAddress,
      filter: { type: 'text' },
      render: (r) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.ipAddress}</Box>
      ),
    },
    {
      id: 'ruleType', header: 'Type',
      accessor: (r) => r.ruleType,
      filter: { type: 'enum', options: [{ value: 'ALLOW', label: 'Autoriser' }, { value: 'DENY', label: 'Bloquer' }] },
      render: (r) => (
        <Chip
          label={r.ruleType === 'ALLOW' ? 'Autoriser' : 'Bloquer'}
          size="small"
          sx={{
            fontWeight: 600,
            bgcolor: r.ruleType === 'ALLOW' ? '#d1fae5' : '#fee2e2',
            color: r.ruleType === 'ALLOW' ? '#065f46' : '#9F1239',
            border: 'none',
          }}
        />
      ),
    },
    {
      id: 'scope', header: 'Portée',
      accessor: (r) => (r.companyId === null ? 'platform' : 'tenant'),
      filter: { type: 'enum', options: [{ value: 'platform', label: 'Plateforme' }, { value: 'tenant', label: 'Tenant' }] },
      render: (r) => r.companyId === null
        ? <Chip label="Plateforme" size="small" sx={{ bgcolor: colors.accent.muted, color: colors.accent.primary, fontWeight: 600, border: 'none' }} />
        : <Chip label="Tenant"    size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none' }} />,
    },
    {
      id: 'description', header: 'Description',
      accessor: (r) => r.description ?? '',
      filter: { type: 'text' },
    },
    {
      id: 'isActive', header: 'Statut',
      accessor: (r) => (r.isActive ? 'active' : 'inactive'),
      filter: { type: 'enum', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      render: (r) => (
        <Switch checked={r.isActive} onChange={() => handleToggle(r)} size="small" />
      ),
    },
    {
      id: 'actions', header: 'Actions',
      accessor: () => '',
      filter: { type: 'none' },
      sortable: false,
      align: 'right',
      render: (r) => (
        <>
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={() => { setEditing(r); setDialogOpen(true); }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" onClick={() => handleRemove(r)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          Ajouter une règle
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        pageSize={20}
        loading={loading}
        emptyMessage="Aucune règle IP configurée"
      />

      <IPRuleFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setSnack({ open: true, severity: 'success', message: editing ? 'Règle modifiée' : 'Règle créée' }); reload(); }}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
```

- [ ] **Step 9.2 — Vérifier TS**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .
```
Expected: aucun output.

- [ ] **Step 9.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/security/IPRulesTab.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): IPRulesTab — table DataTable + Dialog modal + actions

Bouton 'Ajouter', table avec filtres ERPNext par colonne (IP, type,
portée, description, statut), toggle inline, édition, suppression
(window.confirm). Snackbar local pour feedback succès/erreur."
```

---

## Task 10 — Smoke test manuel + push

**Files:** aucun.

- [ ] **Step 10.1 — Lancer back + front**

```bash
# Terminal 1
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev
# Terminal 2
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

- [ ] **Step 10.2 — Scénarios fonctionnels**

1. **Login ADMIN** → Sidebar > Sécurité > onglet "Règles IP".
2. Cliquer "Ajouter une règle" → Dialog s'ouvre.
3. Saisir `203.0.113.0/24`, type ALLOW, description "Bureau", actif → Créer.
4. La règle apparaît dans la table avec chip "Autoriser" + portée "Tenant".
5. Cliquer le Switch statut → la règle se désactive (toast "Règle désactivée"). Recliquer → réactive.
6. Cliquer Edit → Dialog ouvre avec valeurs préremplies. Modifier la description → Enregistrer.
7. Filtrer la colonne Type sur "Bloquer" → la liste s'adapte.
8. Tenter d'ajouter une règle DENY avec `127.0.0.0/8` (qui couvre le localhost depuis lequel l'admin accède). Si l'IP courante est dans le range → erreur 422 affichée dans la modal "Cette règle bloquerait votre propre IP…".

- [ ] **Step 10.3 — Scénario d'enforcement (curl)**

Créer une règle DENY pour une IP factice via l'UI, puis tester via curl avec `X-Forwarded-For` :

```bash
# Créer la règle DENY 198.51.100.0/24 via l'UI (admin).
# Puis :
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-Forwarded-For: 198.51.100.42" \
  http://localhost:3000/api/clients
# Expected : 403

curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-Forwarded-For: 198.51.100.42" \
  http://localhost:3000/api/auth/me
# Expected : 401 (route auth/me ne porte pas tenantIpGate — démo)
```

- [ ] **Step 10.4 — Vérifier l'écriture du block history**

```bash
psql "$(grep '^DATABASE_URL' /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/.env | cut -d= -f2- | tr -d '\"')" -c \
  "SELECT blocked_ip, request_path, status, created_at FROM security_block_history ORDER BY created_at DESC LIMIT 5;"
```
Expected : voir une ligne par blocage déclenché à l'étape 10.3.

- [ ] **Step 10.5 — Smoke non-admin**

Login en CHARGE_AFFAIRES → la Sidebar ne montre pas "Sécurité" ; accès direct à `/security-settings` → page placeholder "Accès réservé".

- [ ] **Step 10.6 — Push**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC push origin release/v1.0
```

---

## Self-Review checklist

- **Spec §2 (cascade)** → Task 5 (`evaluateBlock`).
- **Spec §3 (ipMatcher)** → Task 1.
- **Spec §4 (service CRUD)** → Task 3.
- **Spec §5 (middlewares)** → Tasks 4.1 + 5.
- **Spec §6 (cache Redis)** → Task 2.
- **Spec §7 (anti-self-lockout)** → Task 3 (logique) + Task 4.3 (tests).
- **Spec §8 (routes API)** → Task 4.2.
- **Spec §9 (câblage server.ts)** → Task 6.
- **Spec §10 (frontend)** → Tasks 7 + 8 + 9.
- **Spec §11 (tests)** → Tasks 1.2 + 4.3.

Aucun TBD/TODO. Les noms (`ipMatcher`, `securityIpRulesService`, `securityRulesCache`, `platformIpGate`, `tenantIpGate`, `extractRealIp`, `SelfLockoutError`, `ApiService.security.ipRules`) sont cohérents entre tasks.
