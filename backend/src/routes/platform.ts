import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { blacklistToken } from '../services/redis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/platform/companies — liste toutes les compagnies
router.get('/companies', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: { _count: { select: { memberships: true, applications: true, clients: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: companies });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/platform/companies — créer une nouvelle compagnie
router.post('/companies', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { name, code, logoUrl } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: 'name et code requis' });
    const company = await prisma.company.create({ data: { name, code, logoUrl } });
    return res.status(201).json({ success: true, data: company });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, error: 'Code compagnie déjà existant' });
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PATCH /api/platform/companies/:id — activer/désactiver une compagnie
router.patch('/companies/:id', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive, name, logoUrl } = req.body;
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(name && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
    });
    return res.json({ success: true, data: company });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/platform/impersonate — token d'impersonation readOnly (30 min)
router.post('/impersonate', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ success: false, error: 'companyId requis' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ success: false, error: 'Compagnie introuvable' });

    const jti = uuidv4();
    const impersonationToken = jwt.sign(
      { userId: req.user!.id, email: req.user!.email, role: 'SUPER_ADMIN', companyId, readOnly: true, jti },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '30m' }
    );

    // Audit log
    prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'IMPERSONATION_STARTED',
        entityType: 'company',
        entityId: companyId,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
      }
    }).catch(() => {});

    return res.json({ success: true, impersonationToken, company, expiresIn: '30m' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur impersonation' });
  }
});

export default router;
