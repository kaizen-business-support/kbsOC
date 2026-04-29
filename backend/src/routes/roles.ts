import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

function buildEmptyModuleProfile(): Record<string, { visible: boolean; actions: string[]; sections: string[] }> {
  const keys = [
    'home','clients','credit-application','dispatching','approvals','workflow',
    'analytics','credit-scoring','credit-simulation','data-input','analysis',
    'reports','credit-policy','credit-types','approval-limits','contract-templates',
    'legal-step','raci-matrix','user-management','bank-holidays-admin',
    'notifications-config','announcements',
  ];
  return Object.fromEntries(keys.map(k => [k, { visible: false, actions: [], sections: [] }]));
}

const router = express.Router();

// Middleware to check admin permission
const requireAdmin = (req: Request, res: Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const token = authHeader.substring(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (payload.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// GET /api/roles - Get all roles with their permissions
router.get('/',
  asyncHandler(async (req: Request, res: Response) => {
    // Fetch roles and user counts in two queries instead of N+1
    const [roles, userCounts] = await Promise.all([
      prisma.rolePermission.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.user.groupBy({ by: ['role'], _count: { role: true } })
    ]);

    // Build a lookup map for O(1) access
    const countByRole = new Map(userCounts.map(r => [r.role, r._count.role]));

    const rolesWithCounts = roles.map(role => ({
      id: role.id,
      name: role.role,
      label: role.label,
      description: role.description,
      permissions: role.permissions as string[],
      twoFactorRequired: (role as any).twoFactorRequired ?? false,
      userCount: countByRole.get(role.role as any) ?? 0,
      isActive: role.isActive,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString()
    }));

    res.json({ success: true, roles: rolesWithCounts });
  })
);

// GET /api/roles/:role - Get specific role by role enum value
router.get('/:role',
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;

    const rolePermission = await prisma.rolePermission.findUnique({
      where: { role: role as any }
    });

    if (!rolePermission) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    const userCount = await prisma.user.count({
      where: { role: rolePermission.role as any }
    });

    res.json({
      success: true,
      role: {
        id: rolePermission.id,
        name: rolePermission.role,
        label: rolePermission.label,
        description: rolePermission.description,
        permissions: rolePermission.permissions as string[],
        userCount,
        isActive: rolePermission.isActive,
        createdAt: rolePermission.createdAt.toISOString(),
        updatedAt: rolePermission.updatedAt.toISOString()
      }
    });
  })
);

// PUT /api/roles/:role - DÉPRÉCIÉ (HTTP 410)
// Utiliser PUT /api/module-profiles/:role pour modifier les permissions.
router.put('/:role',
  requireAdmin,
  (_req: Request, res: Response) => {
    res.status(410).json({
      success: false,
      deprecated: true,
      message: 'Cette route est dépréciée. Utilisez PUT /api/module-profiles/:role pour modifier les permissions.',
    });
  }
);

// DELETE /api/roles/:id - Delete role (admin only)
router.delete('/:id',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.rolePermission.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Rôle introuvable', 404, 'NOT_FOUND');
    }

    await prisma.rolePermission.delete({ where: { id } });

    res.json({ success: true, message: 'Rôle supprimé avec succès' });
  })
);

// POST /api/roles - Create new role (admin only)
router.post('/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, label, description, permissions } = req.body;

    if (!role || !label || !permissions) {
      throw new AppError('Role, label, and permissions are required', 400, 'MISSING_FIELDS');
    }

    const sanitizedRole = String(role).trim().toUpperCase().replace(/\s+/g, '_');

    if (!/^[A-Z][A-Z0-9_]*$/.test(sanitizedRole)) {
      throw new AppError('Le nom du rôle ne doit contenir que des lettres, chiffres et underscores', 400, 'INVALID_ROLE_NAME');
    }

    const newRole = await prisma.rolePermission.create({
      data: {
        role: sanitizedRole,
        label,
        description: description || null,
        permissions
      }
    });

    // Seed d'un profil de modules vide pour éviter un état indéfini
    const companyId = req.user?.companyId;
    if (companyId) {
      // upsert pour idempotence (race condition safe)
      await prisma.moduleProfile.upsert({
        where: { companyId_role: { companyId, role: sanitizedRole as any } },
        update: {},
        create: {
          companyId,
          role: sanitizedRole as any,
          label,
          modules: buildEmptyModuleProfile() as any,
          defaultScope: 'BRANCH_ONLY',
          isDefault: false,
          createdById: req.user!.id,
        },
      }).catch(err => logger.warn('Failed to seed empty ModuleProfile for new role:', err));
    }

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      role: {
        id: newRole.id,
        name: newRole.role,
        label: newRole.label,
        description: newRole.description,
        permissions: newRole.permissions as string[],
        userCount: 0,
        isActive: newRole.isActive,
        createdAt: newRole.createdAt.toISOString()
      }
    });
  })
);

export default router;
