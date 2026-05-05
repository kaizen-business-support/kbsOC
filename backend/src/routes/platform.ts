import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { blacklistToken } from '../services/redis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Logo upload: stored in uploads/logos/<companyCode>.<ext>
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `company-${req.params.id}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté — PNG, JPG, WEBP ou SVG uniquement'));
  },
});

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

// GET /api/platform/companies/:id/members — liste les membres d'un tenant
router.get('/companies/:id/members', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId: req.params.id },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, jobTitle: true, department: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return res.json({ success: true, data: memberships });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/platform/companies/:id/members — créer un utilisateur et l'ajouter au tenant
router.post('/companies/:id/members', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, name, role, password } = req.body;
    if (!email || !name || !role || !password) {
      return res.status(400).json({ success: false, error: 'email, name, role et password sont requis' });
    }
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ success: false, error: 'Compagnie introuvable' });

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    // Upsert user (peut déjà exister sur un autre tenant)
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, isActive: true },
      create: { email, name, passwordHash, role, isActive: true, permissions: [] },
    });

    // Ajouter au tenant
    const membership = await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: req.params.id } },
      update: { role, isActive: true },
      create: { userId: user.id, companyId: req.params.id, role, isActive: true },
    });

    return res.status(201).json({ success: true, data: { user, membership } });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, error: 'Email déjà utilisé' });
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// DELETE /api/platform/companies/:id/members/:userId — retirer un utilisateur du tenant
router.delete('/companies/:id/members/:userId', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.companyMembership.update({
      where: { userId_companyId: { userId: req.params.userId, companyId: req.params.id } },
      data: { isActive: false },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/platform/companies/:id/logo — upload logo (multipart/form-data, field: logo)
router.post('/companies/:id/logo', authenticate, requireSuperAdmin, uploadLogo.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fichier logo manquant' });
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { logoUrl },
    });
    return res.json({ success: true, data: company });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Erreur upload' });
  }
});

// POST /api/platform/manage-company — token SUPER_ADMIN avec contexte compagnie (accès complet)
router.post('/manage-company', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ success: false, error: 'companyId requis' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ success: false, error: 'Compagnie introuvable' });

    const jti = uuidv4();
    const token = jwt.sign(
      { userId: req.user!.id, email: req.user!.email, role: 'SUPER_ADMIN', companyId, jti },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '2h' }
    );

    prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'MANAGE_COMPANY_STARTED',
        entityType: 'company',
        entityId: companyId,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
      }
    }).catch(() => {});

    return res.json({ success: true, token, company });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur accès compagnie' });
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
