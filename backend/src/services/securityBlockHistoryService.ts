/**
 * securityBlockHistoryService.ts
 *
 * Lecture filtrée du journal des blocages, unblock unitaire et bulk.
 * unblock = acquittement de log (pas de mutation de règle IP/Time).
 */

import { Prisma, SecurityBlockReason, SecurityBlockStatus } from '@prisma/client';
import { prisma } from '../prismaClient';
import { purgeBlocksForEmail } from './bruteForceTracker';
import { logger } from '../utils/logger';

export class SecurityBlockHistoryError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export interface BlockHistoryFilter {
  companyId: string;
  isSuperAdmin: boolean;
  scope?: 'tenant' | 'platform' | 'all';
  blockedIp?: string;
  reason?: SecurityBlockReason;
  status?: SecurityBlockStatus;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildWhere(f: BlockHistoryFilter): Prisma.SecurityBlockHistoryWhereInput {
  const where: Prisma.SecurityBlockHistoryWhereInput = {};
  const scope = f.scope ?? 'tenant';

  if (scope === 'platform') {
    if (!f.isSuperAdmin) {
      throw new SecurityBlockHistoryError('forbidden', 'Scope plateforme réservé au SUPER_ADMIN', 403);
    }
    where.companyId = null;
  } else if (scope === 'tenant') {
    where.companyId = f.companyId;
  } else {
    if (!f.isSuperAdmin) {
      throw new SecurityBlockHistoryError('forbidden', 'Scope all réservé au SUPER_ADMIN', 403);
    }
  }

  if (f.blockedIp) where.blockedIp = { contains: f.blockedIp, mode: 'insensitive' };
  if (f.reason) where.blockReason = f.reason;
  if (f.status) where.status = f.status;
  if (f.userId) where.attemptedUserId = f.userId;

  if (f.dateFrom || f.dateTo) {
    where.createdAt = {};
    if (f.dateFrom) (where.createdAt as any).gte = new Date(`${f.dateFrom}T00:00:00.000Z`);
    if (f.dateTo) {
      const end = new Date(`${f.dateTo}T00:00:00.000Z`);
      end.setUTCHours(23, 59, 59, 999);
      (where.createdAt as any).lte = end;
    }
  }

  return where;
}

export async function listBlockHistory(filter: BlockHistoryFilter, page = 0, pageSize = 20) {
  const safePage = Math.max(0, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const where = buildWhere(filter);

  const [items, total] = await Promise.all([
    prisma.securityBlockHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: safePage * safePageSize,
      take: safePageSize,
      include: {
        attemptedUser: { select: { id: true, name: true } },
        unblocker:     { select: { id: true, name: true } },
      },
    }),
    prisma.securityBlockHistory.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: safePageSize };
}

export async function unblockOne(id: string, requesterId: string, note: string) {
  const trimmed = (note ?? '').trim();
  if (trimmed.length < 5) {
    throw new SecurityBlockHistoryError('invalid_note', 'La note de déblocage est requise (min. 5 caractères)', 400);
  }
  if (trimmed.length > 500) {
    throw new SecurityBlockHistoryError('invalid_note', 'La note de déblocage est trop longue (max 500 caractères)', 400);
  }

  const existing = await prisma.securityBlockHistory.findUnique({ where: { id } });
  if (!existing) {
    throw new SecurityBlockHistoryError('not_found', 'Entrée introuvable', 404);
  }
  if (existing.status === 'UNBLOCKED') {
    throw new SecurityBlockHistoryError('already_unblocked', 'Cette entrée est déjà débloquée', 422);
  }

  const updated = await prisma.securityBlockHistory.update({
    where: { id },
    data: {
      status: 'UNBLOCKED',
      unblockedBy: requesterId,
      unblockedAt: new Date(),
      unblockNote: trimmed,
    },
    include: {
      attemptedUser: { select: { id: true, name: true, email: true } },
      unblocker:     { select: { id: true, name: true } },
    },
  });

  // Purge Redis si l'entrée concerne un verrouillage brute-force d'un user connu.
  if (updated.blockReason === 'BRUTE_FORCE' && updated.attemptedUser?.email) {
    try {
      await purgeBlocksForEmail(updated.attemptedUser.email);
    } catch (e) {
      logger.warn('[unblockOne] purge Redis BF failed', { err: String(e) });
    }
  }

  return updated;
}

export async function unblockMany(filter: BlockHistoryFilter, requesterId: string, note: string) {
  const trimmed = (note ?? '').trim();
  if (trimmed.length < 5) {
    throw new SecurityBlockHistoryError('invalid_note', 'La note de déblocage est requise (min. 5 caractères)', 400);
  }
  if (trimmed.length > 500) {
    throw new SecurityBlockHistoryError('invalid_note', 'La note de déblocage est trop longue (max 500 caractères)', 400);
  }

  const where = { ...buildWhere(filter), status: 'BLOCKED' as const };
  const result = await prisma.securityBlockHistory.updateMany({
    where,
    data: {
      status: 'UNBLOCKED',
      unblockedBy: requesterId,
      unblockedAt: new Date(),
      unblockNote: trimmed,
    },
  });
  return { affected: result.count };
}

export async function streamForExport(filter: BlockHistoryFilter, max = 10000) {
  const where = buildWhere(filter);
  const rows = await prisma.securityBlockHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: max + 1,
    include: {
      attemptedUser: { select: { id: true, name: true } },
      unblocker:     { select: { id: true, name: true } },
    },
  });
  const truncated = rows.length > max;
  return { rows: rows.slice(0, max), truncated };
}
