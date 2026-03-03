/**
 * audit-logs.ts — Read-only API for the audit log journal.
 *
 * All routes require authentication (applied in server.ts).
 * Viewing audit logs is restricted to ADMIN role.
 *
 * Routes:
 *  GET /api/audit-logs          — paginated list with filters
 *  GET /api/audit-logs/actions  — distinct action types for filter UI
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// ── Admin guard ───────────────────────────────────────────────────────────────
const requireAdmin = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'ADMIN') {
    throw new AppError('Accès réservé aux administrateurs', 403, 'FORBIDDEN');
  }
  next();
};

// ── GET /api/audit-logs/actions ───────────────────────────────────────────────
// Returns the distinct action strings present in the DB (for the filter select)
router.get(
  '/actions',
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await (prisma.auditLog as any).findMany({
      distinct: ['action'],
      select:   { action: true },
      orderBy:  { action: 'asc' },
    });
    return res.json({ success: true, actions: rows.map((r: any) => r.action) });
  })
);

// ── GET /api/audit-logs ───────────────────────────────────────────────────────
// Query params:
//   userId      — filter by user UUID
//   entityType  — e.g., 'client', 'application'
//   action      — contains (case-insensitive) search
//   dateFrom    — ISO date string (inclusive)
//   dateTo      — ISO date string (inclusive, sets time to 23:59:59)
//   page        — page number (default 1)
//   limit       — page size (default 50, max 100)
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const page  = Math.max(1, parseInt((req.query.page  as string) || '1',  10));
    const limit = Math.min(100, Math.max(10, parseInt((req.query.limit as string) || '50', 10)));
    const skip  = (page - 1) * limit;

    // Build Prisma where clause
    const where: any = {};

    if (req.query.userId)     where.userId     = req.query.userId as string;
    if (req.query.entityType) where.entityType = req.query.entityType as string;

    if (req.query.action) {
      where.action = {
        contains: req.query.action as string,
        mode:     'insensitive',
      };
    }

    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {};
      if (req.query.dateFrom) {
        where.createdAt.gte = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

export default router;
