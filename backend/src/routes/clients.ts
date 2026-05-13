import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../server';
import { authenticate, requireCompany } from '../middleware/auth';
import {
  canDownloadContract,
  CONTRACT_ELIGIBLE_APPLICATION_STATUSES,
} from '../services/contractAccess';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// Roles that can only see clients they personally created
const CREATOR_ONLY_ROLES = ['CHARGE_AFFAIRES', 'ASSISTANT_COMMERCIAL'];
// Roles that see clients where they have an assigned workflow step
const ASSIGNEE_ROLES = ['ANALYSTE_RISQUES'];
// All other roles see all company clients (ADMIN, SUPER_ADMIN, DIRECTION_GENERALE,
// RESPONSABLE_RISQUES, RESPONSABLE_ENGAGEMENTS, COMITE_CREDIT, DIRECTION_JURIDIQUE,
// BACK_OFFICE, DIR_AG)

function buildClientWhereFilter(req: Request) {
  const base: any = { companyId: req.companyId };
  const role = req.user!.role as string;
  const userId = req.user!.id;

  if (CREATOR_ONLY_ROLES.includes(role)) {
    base.createdBy = userId;
  } else if (ASSIGNEE_ROLES.includes(role)) {
    base.applications = {
      some: { workflowSteps: { some: { assigneeId: userId } } },
    };
  }
  return base;
}

function generateAccountNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000); // 6-digit
  return `CLT-${year}-${rand}`;
}

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

    // Generate unique account number with collision retry
    let accountNumber = generateAccountNumber();
    let attempts = 0;
    while (attempts < 5) {
      const dup = await prisma.client.findUnique({ where: { accountNumber } });
      if (!dup) break;
      accountNumber = generateAccountNumber();
      attempts++;
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        accountNumber,
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

// GET /api/clients - Get all clients (role-filtered)
router.get('/', async (req: Request, res: Response) => {
  try {
    const where = buildClientWhereFilter(req);

    const clients = await prisma.client.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, department: true } },
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

// GET /api/clients/:id - Get client by ID (role-filtered)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const baseWhere = buildClientWhereFilter(req);

    const client = await prisma.client.findFirst({
      where: { id, ...baseWhere },
      include: {
        creator: { select: { id: true, name: true, department: true } },
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

// GET /api/clients/:id/contracts — contrats signés (Document category=CONTRACT)
// de toutes les applications éligibles du client.
router.get('/:id/contracts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user!.role as UserRole;

    // Build the tenant-scoped where filter for the client.
    // For CHARGE_AFFAIRES and ASSISTANT_COMMERCIAL: scope to clients whose
    // creator shares the same branch/department as the requesting user
    // (branch-based scope, not creator-only, for contract visibility).
    // All other roles see all company clients.
    const clientWhere: any = { id, companyId: req.companyId };
    if (['CHARGE_AFFAIRES', 'ASSISTANT_COMMERCIAL'].includes(role)) {
      const userScope = req.user!.branch ?? req.user!.department ?? null;
      if (!userScope) {
        return res.status(404).json({ success: false, error: 'Client non trouvé' });
      }
      clientWhere.creator = {
        OR: [
          { branch: userScope },
          { department: userScope },
        ],
      };
    }

    const client = await prisma.client.findFirst({
      where: clientWhere,
      include: {
        creator: { select: { id: true, branch: true, department: true } },
        applications: {
          where: { status: { in: [...CONTRACT_ELIGIBLE_APPLICATION_STATUSES] } },
          include: {
            creditType: { select: { name: true } },
            documents: {
              where: { category: 'CONTRACT' },
              include: { uploader: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    const userCtx = {
      role: role,
      branch: req.user!.branch ?? null,
      department: req.user!.department ?? null,
    };
    const clientCtx = {
      creator: {
        branch: client.creator.branch ?? null,
        department: client.creator.department ?? null,
      },
    };
    const canDl = canDownloadContract(userCtx, clientCtx);

    const contracts = client.applications.flatMap(app =>
      app.documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
        uploadedBy: { id: doc.uploader.id, name: doc.uploader.name },
        application: {
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          amount: Number(app.amount),
          creditTypeName: app.creditType?.name ?? null,
        },
        previewUrl: `/api/documents/preview/${doc.id}`,
        downloadUrl: `/api/documents/download/${doc.id}`,
        canDownload: canDl,
      }))
    );

    res.json({ success: true, contracts });
  } catch (error) {
    console.error('Error fetching client contracts:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des contrats' });
  }
});

export default router;
