import express, { Request, Response } from 'express';
import { cacheGet, cacheSet } from '../services/redis';
import { prisma } from '../prismaClient';

const router = express.Router();
const CACHE_KEY = 'cache:branches:active';
const CACHE_TTL = 300;

// GET /api/branches - Get all branches
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;

    if (includeInactive !== 'true') {
      const cached = await cacheGet(CACHE_KEY);
      if (cached) {
        const branches = JSON.parse(cached);
        return res.json({ success: true, branches, data: branches });
      }
    }

    const whereConditions: any = {};
    if (includeInactive !== 'true') {
      whereConditions.isActive = true;
    }

    const branches = await prisma.branch.findMany({
      where: whereConditions,
      orderBy: { name: 'asc' }
    });

    if (includeInactive !== 'true') {
      await cacheSet(CACHE_KEY, JSON.stringify(branches), CACHE_TTL);
    }

    res.json({ success: true, branches, data: branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des agences'
    });
  }
});

// GET /api/branches/:id - Get branch by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({
      where: { id }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Agence non trouvée'
      });
    }

    res.json({
      success: true,
      branch,
      data: branch
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'agence'
    });
  }
});

// POST /api/branches - Create new branch
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, address, city, country, manager, isActive } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Les champs name et code sont obligatoires'
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        code,
        address,
        city,
        country: country || 'Sénégal',
        manager,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Agence créée avec succès'
    });
  } catch (error: any) {
    console.error('Error creating branch:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Une agence avec ce nom ou code existe déjà'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de l\'agence'
    });
  }
});

// PUT /api/branches/:id - Update branch
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, address, city, country, manager, isActive } = req.body;

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name,
        code,
        address,
        city,
        country,
        manager,
        isActive
      }
    });

    res.json({
      success: true,
      data: branch,
      message: 'Agence mise à jour avec succès'
    });
  } catch (error: any) {
    console.error('Error updating branch:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Agence non trouvée'
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Une agence avec ce nom ou code existe déjà'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de l\'agence'
    });
  }
});

// DELETE /api/branches/:id - Delete branch
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.branch.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Agence supprimée avec succès'
    });
  } catch (error: any) {
    console.error('Error deleting branch:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Agence non trouvée'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'agence'
    });
  }
});

export default router;
