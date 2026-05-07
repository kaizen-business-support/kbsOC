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

    // Unicité RCCM / NINEA par company
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
        applications: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      clients: clients,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des clients'
    });
  }
});

// GET /api/clients/:id - Get client by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        creator: true,
        applications: {
          include: {
            workflowSteps: true
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    res.json({
      success: true,
      client: client,
      data: client
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du client'
    });
  }
});

export default router;