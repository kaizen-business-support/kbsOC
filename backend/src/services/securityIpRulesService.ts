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
  companyId: string;
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
    const searchOr: Prisma.SecurityIpRuleWhereInput[] = [
      { ipAddress:   { contains: opts.search, mode: 'insensitive' } },
      { description: { contains: opts.search, mode: 'insensitive' } },
    ];
    where.OR = where.OR ? [...where.OR, ...searchOr] : searchOr;
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
  const existing = await prisma.securityIpRule.findFirst({ where: { id, deletedAt: null } });
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
  const existing = await prisma.securityIpRule.findFirst({ where: { id, deletedAt: null } });
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
  const existing = await prisma.securityIpRule.findFirst({ where: { id, deletedAt: null } });
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
