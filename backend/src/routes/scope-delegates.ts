import express, { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

const requireAdminOrAllBranches = async (req: Request, res: Response, next: express.NextFunction) => {
  const role = req.user?.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();

  const companyId = req.user!.companyId!;
  const profile = await prisma.moduleProfile.findUnique({
    where: { companyId_role: { companyId, role: req.user!.role as any } }
  });
  if (profile?.defaultScope !== 'ALL_BRANCHES') {
    return res.status(403).json({ success: false, error: 'Scope ALL_BRANCHES requis pour gérer les délégations' });
  }
  next();
};

// GET /api/scope-delegates
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId!;
  const now = new Date();

  const delegates = await prisma.scopeDelegate.findMany({
    where: {
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }]
    },
    include: {
      delegator: { select: { id: true, name: true, role: true } },
      delegate:  { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: delegates });
}));

// POST /api/scope-delegates
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  await requireAdminOrAllBranches(req, res, async () => {
    const { delegateId, scope, allowedBranches, allowedActions, startDate, endDate } = req.body;
    const companyId = req.user!.companyId!;
    const delegatorId = req.user!.id;

    if (!delegateId || !scope || !startDate) {
      throw new AppError('delegateId, scope et startDate sont requis', 400, 'MISSING_FIELDS');
    }

    const delegate = await prisma.scopeDelegate.create({
      data: {
        delegatorId,
        delegateId,
        companyId,
        scope,
        allowedBranches: allowedBranches ?? [],
        allowedActions: allowedActions ?? [],
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      }
    });

    res.status(201).json({ success: true, data: delegate });
  });
}));

// PUT /api/scope-delegates/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  await requireAdminOrAllBranches(req, res, async () => {
    const { id } = req.params;
    const { scope, allowedBranches, allowedActions, startDate, endDate } = req.body;

    const updated = await prisma.scopeDelegate.update({
      where: { id },
      data: {
        ...(scope && { scope }),
        ...(allowedBranches && { allowedBranches }),
        ...(allowedActions && { allowedActions }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      }
    });

    res.json({ success: true, data: updated });
  });
}));

// DELETE /api/scope-delegates/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await requireAdminOrAllBranches(req, res, async () => {
    const { id } = req.params;
    const revokedById = req.user!.id;

    await prisma.scopeDelegate.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date(), revokedById }
    });

    res.json({ success: true, message: 'Délégation révoquée' });
  });
}));

export default router;
