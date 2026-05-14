import { Router, Request, Response } from 'express';
import { authorize } from '../middleware/auth';
import {
  listBlockHistory, unblockOne, unblockMany, streamForExport,
  SecurityBlockHistoryError, BlockHistoryFilter,
} from '../services/securityBlockHistoryService';
import { blockHistoryToCsv, BlockHistoryRow } from '../services/blockHistoryCsv';

const router = Router();
router.use(authorize(['manage_security']));

function isSuperAdmin(req: Request): boolean { return req.user?.role === 'SUPER_ADMIN'; }

function handle(res: Response, e: unknown) {
  if (e instanceof SecurityBlockHistoryError) {
    return res.status(e.status).json({ success: false, error: e.code, message: e.message });
  }
  console.error('[security-block-history]', e);
  return res.status(500).json({ success: false, error: 'internal', message: 'Erreur serveur' });
}

function readFilter(req: Request): BlockHistoryFilter {
  return {
    companyId: req.user!.companyId ?? '',
    isSuperAdmin: isSuperAdmin(req),
    scope: (req.query.scope as any) ?? 'tenant',
    blockedIp: req.query.blockedIp as string | undefined,
    reason: req.query.reason as any,
    status: req.query.status as any,
    userId: req.query.userId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  };
}

router.get('/', async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 0;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const data = await listBlockHistory(readFilter(req), page, pageSize);
    res.json({ success: true, data });
  } catch (e) { handle(res, e); }
});

router.post('/:id/unblock', async (req, res) => {
  try {
    const updated = await unblockOne(req.params.id, req.user!.id, req.body?.note ?? '');
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.post('/unblock-all', async (req, res) => {
  try {
    const filterBody = req.body?.filter ?? {};
    const filter: BlockHistoryFilter = {
      companyId: req.user!.companyId ?? '',
      isSuperAdmin: isSuperAdmin(req),
      scope: filterBody.scope ?? 'tenant',
      blockedIp: filterBody.blockedIp,
      reason: filterBody.reason,
      status: 'BLOCKED',
      userId: filterBody.userId,
      dateFrom: filterBody.dateFrom,
      dateTo: filterBody.dateTo,
    };
    const result = await unblockMany(filter, req.user!.id, req.body?.note ?? '');
    res.json({ success: true, data: result });
  } catch (e) { handle(res, e); }
});

router.get('/export', async (req, res) => {
  try {
    const { rows, truncated } = await streamForExport(readFilter(req));
    const csvRows: BlockHistoryRow[] = rows.map((r: any) => ({
      id: r.id,
      blockedIp: r.blockedIp,
      attemptedUserId: r.attemptedUserId,
      attemptedUserName: r.attemptedUser?.name ?? null,
      blockReason: r.blockReason,
      requestPath: r.requestPath,
      userAgent: r.userAgent,
      status: r.status,
      unblockedById: r.unblockedBy,
      unblockedByName: r.unblocker?.name ?? null,
      unblockedAt: r.unblockedAt,
      unblockNote: r.unblockNote,
      createdAt: r.createdAt,
    }));
    const csv = blockHistoryToCsv(csvRows);
    const filename = `block-history-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (truncated) res.setHeader('X-Truncated', 'true');
    res.send(csv);
  } catch (e) { handle(res, e); }
});

export default router;
