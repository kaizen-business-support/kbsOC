import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// POST /api/clients - Create a new client
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      companyName, rccm, ninea, legalForm, sector, branch,
      headquarters, phone, email, contactPerson, establishedYear,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'La raison sociale est obligatoire' });
    }

    if (rccm) {
      const existing = await prisma.client.findFirst({ where: { companyId: req.companyId, rccm } });
      if (existing) return res.status(409).json({ success: false, error: `Un client avec le RCCM ${rccm} existe déjà` });
    }
    if (ninea) {
      const existing = await prisma.client.findFirst({ where: { companyId: req.companyId, ninea } });
      if (existing) return res.status(409).json({ success: false, error: `Un client avec le NINEA ${ninea} existe déjà` });
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        rccm: rccm || null,
        ninea: ninea || null,
        legalForm: legalForm || null,
        sector: sector || null,
        branch: branch || null,
        headquarters: headquarters || null,
        phone: phone || null,
        email: email || null,
        contactPerson: contactPerson || null,
        establishedYear: establishedYear ? Number(establishedYear) : null,
        isActive: true,
        createdBy: req.user!.id,
        companyId: req.companyId,
      },
      include: { creator: true },
    });

    res.status(201).json({ success: true, data: client, client });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du client' });
  }
});

// GET /api/clients - Get all clients
router.get('/', async (req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      where: { companyId: req.companyId },
      include: {
        creator: true,
        applications: {
          select: {
            id: true,
            amount: true,
            status: true,
            currency: true,
            creditTypeId: true,
            createdAt: true,
            repaymentSchedule: true,
            durationMonths: true,
            proposedRate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const terminalStatuses = new Set(['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED']);
    const exposureStatuses = new Set(['APPROVED', 'DISBURSED']);

    const enriched = clients.map((c) => {
      const apps = c.applications as Array<{ id: string; amount: any; status: string; createdAt: Date }>;
      const totalExposure = apps
        .filter((a) => exposureStatuses.has(a.status))
        .reduce((sum, a) => sum + Number(a.amount), 0);
      const appCount = apps.length;
      const activeAppCount = apps.filter((a) => !terminalStatuses.has(a.status)).length;
      const sorted = [...apps].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastAppStatus = sorted[0]?.status ?? null;
      return { ...c, totalExposure, appCount, activeAppCount, lastAppStatus };
    });

    res.json({ success: true, clients: enriched, data: enriched });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des clients' });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      companyName, rccm, ninea, legalForm, sector, branch,
      headquarters, phone, email, contactPerson, establishedYear, isActive,
    } = req.body;

    const existing = await prisma.client.findFirst({ where: { id, companyId: req.companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'La raison sociale est obligatoire' });
    }

    if (rccm && rccm !== existing.rccm) {
      const dup = await prisma.client.findFirst({ where: { companyId: req.companyId, rccm, NOT: { id } } });
      if (dup) return res.status(409).json({ success: false, error: `Un client avec le RCCM ${rccm} existe déjà` });
    }
    if (ninea && ninea !== existing.ninea) {
      const dup = await prisma.client.findFirst({ where: { companyId: req.companyId, ninea, NOT: { id } } });
      if (dup) return res.status(409).json({ success: false, error: `Un client avec le NINEA ${ninea} existe déjà` });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        companyName,
        rccm: rccm || null,
        ninea: ninea || null,
        legalForm: legalForm || null,
        sector: sector || null,
        branch: branch || null,
        headquarters: headquarters || null,
        phone: phone || null,
        email: email || null,
        contactPerson: contactPerson || null,
        establishedYear: establishedYear ? Number(establishedYear) : null,
        ...(isActive !== undefined && { isActive }),
      },
      include: { creator: true },
    });

    res.json({ success: true, data: client, client });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du client' });
  }
});

// PATCH /api/clients/:id/toggle-status
router.patch('/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.client.findFirst({ where: { id, companyId: req.companyId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }
    const client = await prisma.client.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { creator: true },
    });
    res.json({ success: true, data: client, client });
  } catch (error) {
    console.error('Error toggling client status:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du statut' });
  }
});

// GET /api/clients/:id - Get client by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findFirst({
      where: { id, companyId: req.companyId },
      include: {
        creator: true,
        applications: {
          include: {
            creditType: { select: { name: true } },
            documents: { select: { id: true } },
            workflowSteps: {
              select: { id: true, status: true, completedAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    res.json({ success: true, client, data: client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération du client' });
  }
});

export default router;
