import express, { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { getMergedProfile, seedDefaultProfiles } from '../services/moduleProfileService';
import { DEFAULT_ROLE_PROFILES } from '../constants/defaultModuleProfiles';
import { cacheGet, cacheSet, cacheDel } from '../services/redis';

const router = express.Router();

const CACHE_TTL = 300; // 5 minutes
const cacheKey = (companyId: string, userId: string) => `module-profile:${companyId}:${userId}`;

const requireAdmin = (req: Request, res: Response, next: express.NextFunction) => {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// GET /api/module-profiles/me
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const companyId = req.user!.companyId;
  if (!companyId) throw new AppError('Company context required', 400, 'NO_COMPANY');

  const key = cacheKey(companyId, userId);
  const cached = await cacheGet(key);
  if (cached) return res.json({ success: true, data: JSON.parse(cached) });

  const profile = await getMergedProfile(userId, companyId);
  await cacheSet(key, JSON.stringify(profile), CACHE_TTL);
  res.json({ success: true, data: profile });
}));

// GET /api/module-profiles
router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) throw new AppError('Company context required', 400, 'NO_COMPANY');

  const profiles = await prisma.moduleProfile.findMany({ where: { companyId } });
  res.json({ success: true, data: profiles });
}));

// POST /api/module-profiles/seed
router.post('/seed', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;
  await seedDefaultProfiles(companyId, userId);
  res.json({ success: true, message: 'Profils par défaut créés pour le tenant' });
}));

// POST /api/module-profiles/reset/:role
router.post('/reset/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;
  const def = DEFAULT_ROLE_PROFILES[role];
  if (!def) throw new AppError('Rôle inconnu', 404, 'UNKNOWN_ROLE');

  const profile = await prisma.moduleProfile.upsert({
    where: { companyId_role: { companyId, role: role as any } },
    update: {
      modules: def.modules as any,
      defaultScope: def.defaultScope as any,
      allowedBranches: def.allowedBranches,
      isDefault: true
    },
    create: {
      companyId,
      role: role as any,
      label: def.label,
      modules: def.modules as any,
      defaultScope: def.defaultScope as any,
      allowedBranches: def.allowedBranches,
      isDefault: true,
      createdById: userId
    }
  });

  const affected = await prisma.companyMembership.findMany({ where: { companyId, role: role as any } });
  await Promise.all(affected.map(m => cacheDel(cacheKey(companyId, m.userId))));

  res.json({ success: true, data: profile });
}));

// GET /api/module-profiles/users/:userId
router.get('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const companyId = req.user!.companyId!;

  const override = await prisma.userModuleOverride.findUnique({
    where: { userId_companyId: { userId, companyId } }
  });

  const mergedProfile = await getMergedProfile(userId, companyId);
  res.json({ success: true, data: { override, mergedProfile } });
}));

// PUT /api/module-profiles/users/:userId
router.put('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { modules, dataScope, allowedBranches } = req.body;
  const companyId = req.user!.companyId!;
  const createdById = req.user!.id;

  const override = await prisma.userModuleOverride.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: {
      modules: modules ?? null,
      dataScope: dataScope ?? null,
      allowedBranches: allowedBranches ?? []
    },
    create: {
      userId,
      companyId,
      modules: modules ?? null,
      dataScope: dataScope ?? null,
      allowedBranches: allowedBranches ?? [],
      createdById
    }
  });

  await cacheDel(cacheKey(companyId, userId));
  res.json({ success: true, data: override });
}));

// DELETE /api/module-profiles/users/:userId
router.delete('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const companyId = req.user!.companyId!;

  await prisma.userModuleOverride.deleteMany({ where: { userId, companyId } });
  await cacheDel(cacheKey(companyId, userId));
  res.json({ success: true, message: 'Override supprimé' });
}));

// GET /api/module-profiles/:role
router.get('/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.user!.companyId!;

  const profile = await prisma.moduleProfile.findUnique({
    where: { companyId_role: { companyId, role: role as any } }
  });

  if (!profile) throw new AppError('Profile not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: profile });
}));

// PUT /api/module-profiles/:role
router.put('/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const { modules, defaultScope, allowedBranches, label } = req.body;
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;

  if (!modules || !defaultScope) {
    throw new AppError('modules et defaultScope sont requis', 400, 'MISSING_FIELDS');
  }

  const profile = await prisma.moduleProfile.upsert({
    where: { companyId_role: { companyId, role: role as any } },
    update: { modules, defaultScope, allowedBranches: allowedBranches ?? [], label, isDefault: false },
    create: {
      companyId,
      role: role as any,
      label: label ?? role,
      modules,
      defaultScope,
      allowedBranches: allowedBranches ?? [],
      isDefault: false,
      createdById: userId
    }
  });

  // Invalider le cache de tous les membres du tenant ayant ce rôle
  const affected = await prisma.companyMembership.findMany({ where: { companyId, role: role as any } });
  await Promise.all(affected.map(m => cacheDel(cacheKey(companyId, m.userId))));

  res.json({ success: true, data: profile });
}));

export default router;
