import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { cacheGet, cacheSet } from '../services/redis';

const router = Router();
const CACHE_KEY = 'cache:credit-types:active';
const CACHE_TTL = 300;

// GET /api/credit-types - Get all credit types
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;

    if (includeInactive !== 'true') {
      const cached = await cacheGet(CACHE_KEY);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }
    }

    const whereConditions: any = {};
    if (includeInactive !== 'true') {
      whereConditions.isActive = true;
    }

    const creditTypes = await prisma.creditType.findMany({
      where: whereConditions,
      include: { workflowSteps: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' }
    });

    if (includeInactive !== 'true') {
      await cacheSet(CACHE_KEY, JSON.stringify(creditTypes), CACHE_TTL);
    }

    res.json({ success: true, data: creditTypes });
  } catch (error) {
    console.error('Get credit types error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des types de crédit'
    });
  }
});

// GET /api/credit-types/:id - Get single credit type by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const creditType = await prisma.creditType.findUnique({
      where: { id },
      include: { workflowSteps: { orderBy: { order: 'asc' } } }
    });

    if (!creditType) {
      return res.status(404).json({
        success: false,
        error: 'Type de crédit non trouvé'
      });
    }

    res.json({
      success: true,
      data: creditType
    });
  } catch (error) {
    console.error('Get credit type error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du type de crédit'
    });
  }
});

// POST /api/credit-types - Create new credit type (Admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      description,
      defaultRate,
      minRate,
      maxRate,
      minDuration,
      maxDuration,
      requiresCollateral,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || !code || defaultRate === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Les champs name, code et defaultRate sont obligatoires'
      });
    }

    // Check for duplicate code
    const existing = await prisma.creditType.findUnique({
      where: { code }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Un type de crédit avec ce code existe déjà'
      });
    }

    const creditType = await prisma.creditType.create({
      data: {
        name,
        code,
        description,
        defaultRate,
        minRate,
        maxRate,
        minDuration,
        maxDuration,
        requiresCollateral: requiresCollateral || false,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      data: creditType,
      message: 'Type de crédit créé avec succès'
    });
  } catch (error: any) {
    console.error('Create credit type error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création du type de crédit'
    });
  }
});

// PUT /api/credit-types/:id - Update credit type (Admin only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      description,
      defaultRate,
      minRate,
      maxRate,
      minDuration,
      maxDuration,
      requiresCollateral,
      isActive
    } = req.body;

    // Check if credit type exists
    const existing = await prisma.creditType.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Type de crédit non trouvé'
      });
    }

    // Check for duplicate code (if code is being changed)
    if (code && code !== existing.code) {
      const duplicate = await prisma.creditType.findUnique({
        where: { code }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Un type de crédit avec ce code existe déjà'
        });
      }
    }

    const creditType = await prisma.creditType.update({
      where: { id },
      data: {
        name,
        code,
        description,
        defaultRate,
        minRate,
        maxRate,
        minDuration,
        maxDuration,
        requiresCollateral,
        isActive
      }
    });

    res.json({
      success: true,
      data: creditType,
      message: 'Type de crédit mis à jour avec succès'
    });
  } catch (error: any) {
    console.error('Update credit type error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la mise à jour du type de crédit'
    });
  }
});

// DELETE /api/credit-types/:id - Delete credit type (Admin only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if credit type exists
    const existing = await prisma.creditType.findUnique({
      where: { id },
      include: {
        applications: true
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Type de crédit non trouvé'
      });
    }

    // Check if there are applications using this credit type
    if (existing.applications.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer ce type de crédit car il est utilisé par des demandes'
      });
    }

    await prisma.creditType.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Type de crédit supprimé avec succès'
    });
  } catch (error: any) {
    console.error('Delete credit type error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la suppression du type de crédit'
    });
  }
});

// GET /api/credit-types/:id/workflow-steps
router.get('/:id/workflow-steps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const steps = await prisma.creditTypeWorkflowStep.findMany({
      where: { creditTypeId: id },
      orderBy: { order: 'asc' }
    });
    res.json({ success: true, data: steps });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des étapes' });
  }
});

// POST /api/credit-types/:id/workflow-steps
router.post('/:id/workflow-steps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stepName, stepLabel, role, order, isRequired, durationDays, description } = req.body;

    if (!stepName || !stepLabel || !role || order === undefined) {
      return res.status(400).json({ success: false, error: 'stepName, stepLabel, role et order sont obligatoires' });
    }

    // Shift existing steps with order >= new order
    await prisma.creditTypeWorkflowStep.updateMany({
      where: { creditTypeId: id, order: { gte: order } },
      data: { order: { increment: 1 } }
    });

    const step = await prisma.creditTypeWorkflowStep.create({
      data: { creditTypeId: id, stepName, stepLabel, role, order, isRequired: isRequired ?? true, durationDays: durationDays ?? 3, description }
    });

    res.status(201).json({ success: true, data: step });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Erreur lors de la création de l\'étape' });
  }
});

// PUT /api/credit-types/:id/workflow-steps/reorder — body: { steps: [{id, order}] }
// NOTE: This route must be declared BEFORE /:id/workflow-steps/:stepId to avoid conflicts
router.put('/:id/workflow-steps/reorder', async (req: Request, res: Response) => {
  try {
    const { steps } = req.body; // [{id, order}]
    await Promise.all(
      steps.map((s: { id: string; order: number }) =>
        prisma.creditTypeWorkflowStep.update({ where: { id: s.id }, data: { order: s.order } })
      )
    );
    res.json({ success: true, message: 'Ordre mis à jour' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/credit-types/:id/workflow-steps/:stepId
router.put('/:id/workflow-steps/:stepId', async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const { stepName, stepLabel, role, order, isRequired, durationDays, description } = req.body;

    const step = await prisma.creditTypeWorkflowStep.update({
      where: { id: stepId },
      data: { stepName, stepLabel, role, order, isRequired, durationDays, description }
    });

    res.json({ success: true, data: step });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Erreur lors de la mise à jour de l\'étape' });
  }
});

// DELETE /api/credit-types/:id/workflow-steps/:stepId
router.delete('/:id/workflow-steps/:stepId', async (req: Request, res: Response) => {
  try {
    const { id, stepId } = req.params;
    const step = await prisma.creditTypeWorkflowStep.findUnique({ where: { id: stepId } });
    if (!step) return res.status(404).json({ success: false, error: 'Étape non trouvée' });

    await prisma.creditTypeWorkflowStep.delete({ where: { id: stepId } });

    // Reorder remaining steps
    const remaining = await prisma.creditTypeWorkflowStep.findMany({
      where: { creditTypeId: id },
      orderBy: { order: 'asc' }
    });
    for (let i = 0; i < remaining.length; i++) {
      await prisma.creditTypeWorkflowStep.update({
        where: { id: remaining[i].id },
        data: { order: i + 1 }
      });
    }

    res.json({ success: true, message: 'Étape supprimée' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Erreur lors de la suppression de l\'étape' });
  }
});

export default router;
