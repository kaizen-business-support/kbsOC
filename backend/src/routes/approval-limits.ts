import express, { Request, Response } from 'express';
import { cacheGet, cacheSet } from '../services/redis';
import { prisma } from '../prismaClient';

const router = express.Router();
const CACHE_KEY = 'cache:approval-limits';
const CACHE_TTL = 120; // 2 minutes

// GET /api/approval-limits - Get all approval limits
router.get('/', async (req: Request, res: Response) => {
  try {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) {
      const approvalLimits = JSON.parse(cached);
      return res.json({ success: true, data: approvalLimits, approvalLimits });
    }

    const approvalLimits = await prisma.approvalLimit.findMany({
      orderBy: { minAmount: 'asc' }
    });

    await cacheSet(CACHE_KEY, JSON.stringify(approvalLimits), CACHE_TTL);

    res.json({ success: true, data: approvalLimits, approvalLimits });
  } catch (error) {
    console.error('Error fetching approval limits:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des limites d\'approbation'
    });
  }
});

// GET /api/approval-limits/:id - Get approval limit by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = await prisma.approvalLimit.findUnique({
      where: { id }
    });

    if (!limit) {
      return res.status(404).json({
        success: false,
        error: 'Limite d\'approbation non trouvée'
      });
    }

    res.json({
      success: true,
      data: limit,
      approvalLimit: limit // backward compatibility
    });
  } catch (error) {
    console.error('Error fetching approval limit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la limite d\'approbation'
    });
  }
});

// GET /api/approval-limits/role/:role - Get approval limit by role
router.get('/role/:role', async (req: Request, res: Response) => {
  try {
    const { role } = req.params;
    const limit = await prisma.approvalLimit.findUnique({
      where: { role: role as any }
    });

    if (!limit) {
      return res.status(404).json({
        success: false,
        error: 'Limite d\'approbation non trouvée pour ce rôle'
      });
    }

    res.json({
      success: true,
      data: limit,
      approvalLimit: limit // backward compatibility
    });
  } catch (error) {
    console.error('Error fetching approval limit by role:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la limite d\'approbation'
    });
  }
});

// GET /api/approval-limits/amount/:amount - Get approval limit for a specific amount
router.get('/amount/:amount', async (req: Request, res: Response) => {
  try {
    const amount = parseFloat(req.params.amount);

    const limit = await prisma.approvalLimit.findFirst({
      where: {
        AND: [
          { minAmount: { lte: amount } },
          { maxAmount: { gte: amount } },
          { isActive: true }
        ]
      }
    });

    if (!limit) {
      return res.status(404).json({
        success: false,
        error: `Aucune limite d'approbation trouvée pour le montant ${amount}`
      });
    }

    res.json({
      success: true,
      data: limit,
      approvalLimit: limit // backward compatibility
    });
  } catch (error) {
    console.error('Error fetching approval limit by amount:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la limite d\'approbation'
    });
  }
});

// POST /api/approval-limits - Create new approval limit
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      role,
      displayName,
      minAmount,
      maxAmount,
      currency,
      reviewDuration,
      maxReviewDuration,
      description
    } = req.body;

    // Validation
    if (!role || !displayName || minAmount === undefined || maxAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants'
      });
    }

    if (maxAmount <= minAmount) {
      return res.status(400).json({
        success: false,
        error: 'Le montant maximum doit être supérieur au montant minimum'
      });
    }

    const newLimit = await prisma.approvalLimit.create({
      data: {
        role,
        displayName,
        minAmount,
        maxAmount,
        currency: currency || 'XOF',
        reviewDuration: reviewDuration || 480, // Default 1 day
        maxReviewDuration: maxReviewDuration || null,
        description: description || null
      }
    });

    res.status(201).json({
      success: true,
      data: newLimit,
      message: 'Limite d\'approbation créée avec succès'
    });
  } catch (error: any) {
    console.error('Error creating approval limit:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Une limite d\'approbation existe déjà pour ce rôle'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la limite d\'approbation'
    });
  }
});

// PUT /api/approval-limits/:id - Update approval limit
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validation for amount ranges
    if (updateData.minAmount !== undefined && updateData.maxAmount !== undefined) {
      if (updateData.maxAmount <= updateData.minAmount) {
        return res.status(400).json({
          success: false,
          error: 'Le montant maximum doit être supérieur au montant minimum'
        });
      }
    }

    const updatedLimit = await prisma.approvalLimit.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedLimit,
      message: 'Limite d\'approbation mise à jour avec succès'
    });
  } catch (error: any) {
    console.error('Error updating approval limit:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Limite d\'approbation non trouvée'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de la limite d\'approbation'
    });
  }
});

// DELETE /api/approval-limits/:id - Delete approval limit
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.approvalLimit.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Limite d\'approbation supprimée avec succès'
    });
  } catch (error: any) {
    console.error('Error deleting approval limit:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Limite d\'approbation non trouvée'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la limite d\'approbation'
    });
  }
});

export default router;
