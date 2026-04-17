import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany, requireSuperAdmin, blockReadOnly } from '../middleware/auth';

const router = Router();

// GET /api/companies/current — infos de la compagnie active
router.get('/current', authenticate, requireCompany, async (req: Request, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.companyId },
      include: { memberships: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } }
    });
    if (!company) return res.status(404).json({ success: false, error: 'Compagnie introuvable' });
    return res.json({ success: true, data: company });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PATCH /api/companies/current — mise à jour settings compagnie (ADMIN)
router.patch('/current', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Réservé aux administrateurs' });
    }
    const { name, logoUrl } = req.body;
    const company = await prisma.company.update({
      where: { id: req.companyId },
      data: { ...(name && { name }), ...(logoUrl !== undefined && { logoUrl }) },
    });
    return res.json({ success: true, data: company });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/companies/members — liste des membres
router.get('/members', authenticate, requireCompany, async (req: Request, res: Response) => {
  try {
    const members = await prisma.companyMembership.findMany({
      where: { companyId: req.companyId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true, department: true, branch: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return res.json({ success: true, data: members });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/companies/members — inviter un utilisateur
router.post('/members', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Réservé aux administrateurs' });
    }
    const { userId, role } = req.body;
    if (!userId || !role) return res.status(400).json({ success: false, error: 'userId et role requis' });

    const membership = await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId, companyId: req.companyId! } },
      update: { role, isActive: true },
      create: { userId, companyId: req.companyId!, role },
    });
    return res.status(201).json({ success: true, data: membership });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PATCH /api/companies/members/:userId — changer le rôle ou désactiver
router.patch('/members/:userId', authenticate, requireCompany, blockReadOnly, async (req: Request, res: Response) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Réservé aux administrateurs' });
    }
    const { role, isActive } = req.body;
    const membership = await prisma.companyMembership.update({
      where: { userId_companyId: { userId: req.params.userId, companyId: req.companyId! } },
      data: { ...(role && { role }), ...(isActive !== undefined && { isActive }) },
    });
    return res.json({ success: true, data: membership });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
