import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';

declare global {
  namespace Express {
    interface Request {
      branchFilter?: Record<string, any>;
    }
  }
}

const SCOPE_ORDER = ['BRANCH_ONLY', 'MULTI_BRANCH', 'ALL_BRANCHES'];

function maxScope(a: string, b: string): string {
  return SCOPE_ORDER.indexOf(a) >= SCOPE_ORDER.indexOf(b) ? a : b;
}

export const scopeFilter = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.companyId || !req.user?.id) return next();

  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const [roleProfile, userOverride] = await Promise.all([
      prisma.moduleProfile.findUnique({
        where: { companyId_role: { companyId, role: req.user.role as any } }
      }),
      prisma.userModuleOverride.findUnique({
        where: { userId_companyId: { userId, companyId } }
      })
    ]);

    const baseScope = (userOverride?.dataScope ?? roleProfile?.defaultScope ?? 'BRANCH_ONLY') as string;
    let branches: string[] = userOverride?.allowedBranches?.length
      ? userOverride.allowedBranches
      : roleProfile?.allowedBranches ?? [];

    const now = new Date();
    const delegation = await prisma.scopeDelegate.findFirst({
      where: {
        delegateId: userId,
        companyId,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }]
      }
    });

    const finalScope = delegation ? maxScope(baseScope, delegation.scope as string) : baseScope;

    if (finalScope === 'ALL_BRANCHES') {
      req.branchFilter = {};
    } else {
      if (delegation?.allowedBranches?.length) {
        branches = [...new Set([...branches, ...delegation.allowedBranches])];
      }
      if (finalScope === 'BRANCH_ONLY' && branches.length === 0) {
        const userBranch = (req.user as any).branch as string | undefined;
        if (userBranch) branches = [userBranch];
      }
      req.branchFilter = branches.length ? { branchId: { in: branches } } : {};
    }
  } catch {
    req.branchFilter = {};
  }

  next();
};
