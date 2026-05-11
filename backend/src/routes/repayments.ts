import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// GET /api/repayments/:applicationId — toutes les entrées d'un dossier
router.get('/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    // Vérifier que le dossier appartient à la compagnie
    const app = await prisma.creditApplication.findFirst({
      where: { id: applicationId, companyId: req.companyId },
    });
    if (!app) return res.status(404).json({ success: false, error: 'Dossier non trouvé' });

    const entries = await prisma.repaymentEntry.findMany({
      where: { applicationId },
      include: {
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { periodNumber: 'asc' },
    });

    res.json({ success: true, data: entries });
  } catch (err) {
    console.error('Error fetching repayment entries:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des remboursements' });
  }
});

// PATCH /api/repayments/:applicationId/:periodNumber — mettre à jour le statut d'une période
router.patch('/:applicationId/:periodNumber', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;
    const periodNumber = parseInt(req.params.periodNumber, 10);
    const { status, paidAmount, paidAt, notes } = req.body;

    if (!status || !['PAID', 'PARTIAL', 'LATE', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const app = await prisma.creditApplication.findFirst({
      where: { id: applicationId, companyId: req.companyId },
    });
    if (!app) return res.status(404).json({ success: false, error: 'Dossier non trouvé' });

    const entry = await prisma.repaymentEntry.upsert({
      where: { applicationId_periodNumber: { applicationId, periodNumber } },
      update: {
        status: status as any,
        paidAmount: paidAmount != null ? paidAmount : undefined,
        paidAt: status === 'PAID' || status === 'PARTIAL' ? (paidAt ? new Date(paidAt) : new Date()) : null,
        verifiedById: req.user!.id,
        verifiedAt: new Date(),
        notes: notes ?? undefined,
      },
      create: {
        applicationId,
        companyId: req.companyId,
        periodNumber,
        // Ces champs seront remplis par le frontend lors du premier upsert
        dueDate: new Date(req.body.dueDate),
        expectedAmount: req.body.expectedAmount,
        expectedPrincipal: req.body.expectedPrincipal,
        expectedInterest: req.body.expectedInterest,
        status: status as any,
        paidAmount: paidAmount ?? null,
        paidAt: status === 'PAID' || status === 'PARTIAL' ? (paidAt ? new Date(paidAt) : new Date()) : null,
        verifiedById: req.user!.id,
        verifiedAt: new Date(),
        notes: notes ?? null,
      },
      include: { verifiedBy: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: entry });
  } catch (err) {
    console.error('Error updating repayment entry:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du remboursement' });
  }
});

export default router;
