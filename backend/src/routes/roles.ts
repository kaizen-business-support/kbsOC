import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { AppError, asyncHandler } from '../middleware/errorHandler';

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

// PUT /api/roles/:role - Update role permissions (admin only)
router.put('/:role',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;
    const { permissions, label, description } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      throw new AppError('Permissions array is required', 400, 'INVALID_PERMISSIONS');
    }

    // Update role permissions
    const updatedRole = await prisma.rolePermission.update({
      where: { role: role as any },
      data: {
        permissions,
        ...(label && { label }),
        ...(description !== undefined && { description })
      }
    });

    // Update all users with this role to have the new permissions
    await prisma.user.updateMany({
      where: { role: role as any },
      data: { permissions }
    });

    const userCount = await prisma.user.count({
      where: { role: updatedRole.role as any }
    });

    res.json({
      success: true,
      message: `Role ${updatedRole.label} and all associated users updated successfully`,
      role: {
        id: updatedRole.id,
        name: updatedRole.role,
        label: updatedRole.label,
        description: updatedRole.description,
        permissions: updatedRole.permissions as string[],
        userCount,
        isActive: updatedRole.isActive,
        updatedAt: updatedRole.updatedAt.toISOString()
      }
    });
  })
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
