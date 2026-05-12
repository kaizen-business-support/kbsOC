import { Router } from 'express';
import { prisma } from '../server';
import { processEmailQueue } from '../services/emailQueueService';
import { authorize } from '../middleware/auth';

const router = Router();

const requireAdminOrSuper = authorize([], ['ADMIN', 'SUPER_ADMIN']);

// ─── GET /api/email-queue ─────────────────────────────────────────────────────
// List items with optional status filter and pagination
router.get('/', requireAdminOrSuper, async (req, res) => {
  try {
    const { status, page = '1', limit = '50', applicationId } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (applicationId) where.applicationId = applicationId;

    const [items, total] = await Promise.all([
      prisma.emailQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          retries: true,
          maxRetries: true,
          lastError: true,
          scheduledAt: true,
          sentAt: true,
          event: true,
          recipientName: true,
          applicationId: true,
          companyId: true,
          createdAt: true,
        },
      }),
      prisma.emailQueue.count({ where }),
    ]);

    res.json({ success: true, data: items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/email-queue/stats ───────────────────────────────────────────────
router.get('/stats', requireAdminOrSuper, async (_req, res) => {
  try {
    const [pending, sending, sent, failed] = await Promise.all([
      prisma.emailQueue.count({ where: { status: 'PENDING' } }),
      prisma.emailQueue.count({ where: { status: 'SENDING' } }),
      prisma.emailQueue.count({ where: { status: 'SENT' } }),
      prisma.emailQueue.count({ where: { status: 'FAILED' } }),
    ]);
    res.json({ success: true, data: { pending, sending, sent, failed, total: pending + sending + sent + failed } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/email-queue/:id/retry ─────────────────────────────────────────
router.post('/:id/retry', requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.emailQueue.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: 'Introuvable' });

    await prisma.emailQueue.update({
      where: { id },
      data: { status: 'PENDING', retries: 0, lastError: null, scheduledAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/email-queue/retry-all ─────────────────────────────────────────
router.post('/retry-all', requireAdminOrSuper, async (_req, res) => {
  try {
    const result = await prisma.emailQueue.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING', retries: 0, lastError: null, scheduledAt: new Date() },
    });
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/email-queue/process-now ───────────────────────────────────────
router.post('/process-now', requireAdminOrSuper, async (_req, res) => {
  try {
    const result = await processEmailQueue();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/email-queue/:id ─────────────────────────────────────────────
router.delete('/:id', requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.emailQueue.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/email-queue (bulk: delete SENT or FAILED) ───────────────────
router.delete('/', requireAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    if (!status || !['SENT', 'FAILED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut requis: SENT ou FAILED' });
    }
    const result = await prisma.emailQueue.deleteMany({ where: { status: status as any } });
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
