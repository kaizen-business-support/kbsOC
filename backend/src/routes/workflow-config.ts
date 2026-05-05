import express, { Request, Response } from 'express';
import Joi from 'joi';
import { prisma } from '../prismaClient';

const router = express.Router();

// Validation schemas
const stepConfigSchema = Joi.object({
  stepName: Joi.string().required(),
  displayName: Joi.string().required(),
  expectedDuration: Joi.number().integer().min(1).required(), // minutes
  maxDuration: Joi.number().integer().min(1).optional(),
  description: Joi.string().optional(),
  isActive: Joi.boolean().default(true)
});

const updateStepConfigSchema = Joi.object({
  displayName: Joi.string().optional(),
  expectedDuration: Joi.number().integer().min(1).optional(),
  maxDuration: Joi.number().integer().min(1).optional(),
  description: Joi.string().optional(),
  isActive: Joi.boolean().optional()
});

// GET /api/workflow-config/steps - Get all step configurations
router.get('/steps', async (req: Request, res: Response) => {
  try {
    const stepConfigs = await prisma.workflowStepConfig.findMany({
      orderBy: [
        { isActive: 'desc' },
        { stepName: 'asc' }
      ]
    });

    // Transform durations to human-readable format
    const transformedConfigs = stepConfigs.map(config => ({
      ...config,
      expectedDurationFormatted: formatDuration(config.expectedDuration),
      maxDurationFormatted: config.maxDuration ? formatDuration(config.maxDuration) : null
    }));

    res.json({
      success: true,
      data: transformedConfigs
    });
  } catch (error) {
    console.error('Error fetching step configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des configurations d\'étapes'
    });
  }
});

// POST /api/workflow-config/steps - Create new step configuration
router.post('/steps', async (req: Request, res: Response) => {
  try {
    const { error, value } = stepConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.details.map(d => d.message)
      });
    }

    // Check if step name already exists
    const existingConfig = await prisma.workflowStepConfig.findUnique({
      where: { stepName: value.stepName }
    });

    if (existingConfig) {
      return res.status(409).json({
        success: false,
        message: 'Une configuration existe déjà pour cette étape'
      });
    }

    const newConfig = await prisma.workflowStepConfig.create({
      data: value
    });

    res.status(201).json({
      success: true,
      data: newConfig,
      message: 'Configuration d\'étape créée avec succès'
    });
  } catch (error) {
    console.error('Error creating step configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la configuration'
    });
  }
});

// PUT /api/workflow-config/steps/:id - Update step configuration
router.put('/steps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateStepConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.details.map(d => d.message)
      });
    }

    // Check if configuration exists
    const existingConfig = await prisma.workflowStepConfig.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        message: 'Configuration d\'étape non trouvée'
      });
    }

    const updatedConfig = await prisma.workflowStepConfig.update({
      where: { id },
      data: value
    });

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Configuration mise à jour avec succès'
    });
  } catch (error) {
    console.error('Error updating step configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la configuration'
    });
  }
});

// DELETE /api/workflow-config/steps/:id - Delete step configuration
router.delete('/steps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if configuration exists
    const existingConfig = await prisma.workflowStepConfig.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        message: 'Configuration d\'étape non trouvée'
      });
    }

    await prisma.workflowStepConfig.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Configuration supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting step configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la configuration'
    });
  }
});

// Utility function to format duration in minutes to human readable
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  } else if (minutes < 1440) { // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    const remainingMinutes = minutes % 60;
    let formatted = `${days}j`;
    if (remainingHours > 0) formatted += ` ${remainingHours}h`;
    if (remainingMinutes > 0) formatted += ` ${remainingMinutes}min`;
    return formatted;
  }
}

export default router;