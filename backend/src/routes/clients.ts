import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

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