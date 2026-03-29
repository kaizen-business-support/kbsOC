import express, { Request, Response } from 'express';
import { cacheGet, cacheSet, cacheDel } from '../services/redis';
import { prisma } from '../prismaClient';

const router = express.Router();

const CACHE_KEY = 'cache:departments:active';
const CACHE_TTL = 300; // 5 minutes

// GET /api/departments - Get all departments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;

    // Use cache only for the default (active-only) query
    if (includeInactive !== 'true') {
      const cached = await cacheGet(CACHE_KEY);
      if (cached) {
        const departments = JSON.parse(cached);
        return res.json({ success: true, departments, data: departments });
      }
    }

    const whereConditions: any = {};
    if (includeInactive !== 'true') {
      whereConditions.isActive = true;
    }

    const departments = await prisma.department.findMany({
      where: whereConditions,
      orderBy: { name: 'asc' }
    });

    if (includeInactive !== 'true') {
      await cacheSet(CACHE_KEY, JSON.stringify(departments), CACHE_TTL);
    }

    res.json({ success: true, departments, data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des départements'
    });
  }
});

// GET /api/departments/:id - Get department by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Département non trouvé'
      });
    }

    res.json({
      success: true,
      department,
      data: department
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du département'
    });
  }
});

// POST /api/departments - Create new department
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, description, isActive } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Les champs name et code sont obligatoires'
      });
    }

    const department = await prisma.department.create({
      data: {
        name,
        code,
        description,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      data: department,
      message: 'Département créé avec succès'
    });
  } catch (error: any) {
    console.error('Error creating department:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Un département avec ce nom ou code existe déjà'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du département'
    });
  }
});

// PUT /api/departments/:id - Update department
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        code,
        description,
        isActive
      }
    });

    res.json({
      success: true,
      data: department,
      message: 'Département mis à jour avec succès'
    });
  } catch (error: any) {
    console.error('Error updating department:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Département non trouvé'
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Un département avec ce nom ou code existe déjà'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du département'
    });
  }
});

// DELETE /api/departments/:id - Delete department
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.department.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Département supprimé avec succès'
    });
  } catch (error: any) {
    console.error('Error deleting department:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Département non trouvé'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du département'
    });
  }
});

export default router;
