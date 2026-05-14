/**
 * securityTimeRulesService.ts
 *
 * CRUD des règles horaires, avec validation stricte (jours, plages,
 * timezone) et invalidation du cache Redis.
 */

import { Prisma, SecurityAppliesTo } from '@prisma/client';
import { prisma } from '../prismaClient';
import { invalidateTimeRulesCache } from './securityRulesCache';

export class SecurityTimeRuleError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const HM_REGEX = /^\d{2}:\d{2}$/;
function isValidHm(s: string): boolean {
  if (!HM_REGEX.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export interface ListTimeRulesOpts {
  companyId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  scope?: 'platform' | 'tenant' | 'all';
  isActive?: boolean;
  appliesTo?: SecurityAppliesTo;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listTimeRules(opts: ListTimeRulesOpts) {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const scope = opts.scope ?? 'all';
  const where: Prisma.SecurityTimeRuleWhereInput = { deletedAt: null };

  if (scope === 'platform') {
    if (!opts.isSuperAdmin) {
      throw new SecurityTimeRuleError('forbidden', 'Scope plateforme réservé au SUPER_ADMIN', 403);
    }
    where.companyId = null;
  } else if (scope === 'tenant') {
    where.companyId = opts.companyId;
  } else {
    where.OR = [{ companyId: null }, { companyId: opts.companyId }];
  }

  if (opts.isActive !== undefined) where.isActive = opts.isActive;
  if (opts.appliesTo) where.appliesTo = opts.appliesTo;
  if (opts.search) {
    const searchOr: Prisma.SecurityTimeRuleWhereInput[] = [
      { name:          { contains: opts.search, mode: 'insensitive' } },
      { deniedMessage: { contains: opts.search, mode: 'insensitive' } },
    ];
    where.OR = where.OR ? [...where.OR, ...searchOr] : searchOr;
  }

  const [items, total] = await Promise.all([
    prisma.securityTimeRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
      include: { creator: { select: { id: true, name: true } } },
    }),
    prisma.securityTimeRule.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export interface CreateTimeRuleInput {
  name: string;
  daysOfWeek: number;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  appliesTo: SecurityAppliesTo;
  targetValues?: string[];
  deniedMessage?: string;
  isActive?: boolean;
  companyId: string | null;
  createdBy: string;
}

export interface UpdateTimeRuleInput {
  name?: string;
  daysOfWeek?: number;
  timeStart?: string;
  timeEnd?: string;
  timezone?: string;
  appliesTo?: SecurityAppliesTo;
  targetValues?: string[];
  deniedMessage?: string | null;
  isActive?: boolean;
}

function validateInput(input: CreateTimeRuleInput | UpdateTimeRuleInput, partial = false): void {
  if (!partial || input.name !== undefined) {
    if (!input.name || !input.name.trim()) {
      throw new SecurityTimeRuleError('invalid_name', 'Le nom est requis', 400);
    }
  }
  if (!partial || input.daysOfWeek !== undefined) {
    const d = input.daysOfWeek ?? 0;
    if (!Number.isInteger(d) || d < 1 || d > 127) {
      throw new SecurityTimeRuleError('invalid_days', 'daysOfWeek doit être un bitmask entre 1 et 127', 400);
    }
  }
  if (!partial || input.timeStart !== undefined) {
    if (!input.timeStart || !isValidHm(input.timeStart)) {
      throw new SecurityTimeRuleError('invalid_time_start', 'timeStart doit être au format HH:MM', 400);
    }
  }
  if (!partial || input.timeEnd !== undefined) {
    if (!input.timeEnd || !isValidHm(input.timeEnd)) {
      throw new SecurityTimeRuleError('invalid_time_end', 'timeEnd doit être au format HH:MM', 400);
    }
  }
  if (!partial || input.timezone !== undefined) {
    if (!input.timezone || !isValidTimezone(input.timezone)) {
      throw new SecurityTimeRuleError('invalid_timezone', `Timezone IANA invalide : ${input.timezone}`, 400);
    }
  }
  if (!partial || input.appliesTo !== undefined) {
    const at = input.appliesTo;
    if (at && at !== 'ALL' && (!input.targetValues || input.targetValues.length === 0)) {
      throw new SecurityTimeRuleError('missing_targets', `targetValues requis quand appliesTo=${at}`, 400);
    }
  }
}

export async function createTimeRule(input: CreateTimeRuleInput) {
  validateInput(input);

  const created = await prisma.securityTimeRule.create({
    data: {
      name: input.name.trim(),
      daysOfWeek: input.daysOfWeek,
      timeStart: input.timeStart,
      timeEnd: input.timeEnd,
      timezone: input.timezone,
      appliesTo: input.appliesTo,
      targetValues: input.targetValues ?? [],
      deniedMessage: input.deniedMessage ?? null,
      isActive: input.isActive ?? true,
      companyId: input.companyId,
      createdBy: input.createdBy,
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  await invalidateTimeRulesCache(created.companyId);
  return created;
}

export async function updateTimeRule(id: string, input: UpdateTimeRuleInput) {
  const existing = await prisma.securityTimeRule.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new SecurityTimeRuleError('not_found', 'Règle introuvable', 404);
  }
  validateInput(input, true);

  const updated = await prisma.securityTimeRule.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.daysOfWeek !== undefined && { daysOfWeek: input.daysOfWeek }),
      ...(input.timeStart !== undefined && { timeStart: input.timeStart }),
      ...(input.timeEnd !== undefined && { timeEnd: input.timeEnd }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.appliesTo !== undefined && { appliesTo: input.appliesTo }),
      ...(input.targetValues !== undefined && { targetValues: input.targetValues }),
      ...(input.deniedMessage !== undefined && { deniedMessage: input.deniedMessage }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  await invalidateTimeRulesCache(updated.companyId);
  return updated;
}

export async function toggleTimeRule(id: string) {
  const existing = await prisma.securityTimeRule.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new SecurityTimeRuleError('not_found', 'Règle introuvable', 404);
  }
  const updated = await prisma.securityTimeRule.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: { creator: { select: { id: true, name: true } } },
  });
  await invalidateTimeRulesCache(updated.companyId);
  return updated;
}

export async function softDeleteTimeRule(id: string) {
  const existing = await prisma.securityTimeRule.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new SecurityTimeRuleError('not_found', 'Règle introuvable', 404);
  }
  await prisma.securityTimeRule.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await invalidateTimeRulesCache(existing.companyId);
  return { id };
}
