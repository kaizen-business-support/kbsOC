import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateRandomPassword, hashPassword } from '../utils/password';
import { prisma } from '../server';
import { sendEmail } from '../services/notificationService';
import { buildWelcomeEmail, buildAdminResetEmail } from '../utils/emailTemplates';
import { getAppUrl } from '../utils/getAppUrl';

const router = express.Router();

// Permission check using JWT verification + live DB lookup
const checkUserManagementPermission = async (req: Request, res: Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error', code: 'CONFIG_ERROR' });
    }
    const payload = jwt.verify(token, jwtSecret) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, permissions: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const permissions = user.permissions as string[];
    if (user.role === 'ADMIN' || permissions.includes('user_management')) {
      req.user = { id: user.id, email: user.email, role: user.role, permissions };
      next();
    } else {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

// Middleware allégé : ADMIN, ANALYST_SUPERVISOR, ou permission user_management
const checkAnalystListPermission = async (req: Request, res: Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  const token = authHeader.substring(7);
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ error: 'Server configuration error' });
    const payload = jwt.verify(token, jwtSecret) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, permissions: true }
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const permissions = user.permissions as string[];
    const allowed = ['ADMIN', 'ANALYST_SUPERVISOR'].includes(user.role)
      || permissions.includes('user_management')
      || permissions.includes('assign_analyst');
    if (allowed) {
      req.user = { id: user.id, email: user.email, role: user.role, permissions };
      next();
    } else {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

// Get credit analysts (accessible aux utilisateurs authentifiés avec droit d'affectation)
router.get('/credit-analysts',
  checkAnalystListPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const analysts = await prisma.user.findMany({
      where: { role: 'CREDIT_ANALYST', isActive: true },
      select: { id: true, email: true, name: true, role: true, department: true, jobTitle: true }
    });

    res.json({
      success: true,
      analysts,
      data: analysts
    });
  })
);

// Get all users (admin only)
router.get('/',
  checkUserManagementPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        branch: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        permissions: true,
        twoFactorEnabled: true,
        twoFactorRequired: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      users: users.map(user => ({
        ...user,
        lastLogin: user.lastLogin?.toISOString(),
        createdAt: user.createdAt.toISOString()
      }))
    });
  })
);

// Get user by ID
router.get('/:id',
  checkUserManagementPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        branch: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        permissions: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      user: {
        ...user,
        lastLogin: user.lastLogin?.toISOString(),
        createdAt: user.createdAt.toISOString()
      }
    });
  })
);

// Create new user (admin only)
router.post('/',
  checkUserManagementPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, role, department, branch, jobTitle, isActive = true } = req.body;

    // Validate required fields
    if (!name || !email || !role) {
      throw new AppError('Name, email, and role are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Check if email already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409, 'EMAIL_EXISTS');
    }

    // Generate random temporary password
    const temporaryPassword = generateRandomPassword(12);

    // Hash the password
    const passwordHash = await hashPassword(temporaryPassword);

    // Get permissions from RolePermission table
    const rolePermission = await prisma.rolePermission.findUnique({
      where: { role: role as any }
    });

    if (!rolePermission) {
      throw new AppError(`Role permissions not configured for ${role}`, 400, 'ROLE_NOT_CONFIGURED');
    }

    const permissions = rolePermission.permissions as string[];

    // Create user in database
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
        department: department || null,
        branch: branch || null,
        jobTitle: jobTitle || null,
        permissions,
        isActive,
        mustChangePassword: true,
        passwordExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 heures
      } as any
    });

    // Send welcome email with temporary credentials (non-blocking)
    const frontendUrl = getAppUrl();
    const welcomeHtml = buildWelcomeEmail({
      name: newUser.name,
      email: newUser.email,
      temporaryPassword,
      loginUrl: frontendUrl,
      expiresIn: '72 heures'
    });
    sendEmail(newUser.email, 'Bienvenue sur OptimusCredit — Vos accès', welcomeHtml)
      .catch(err => console.error('Welcome email failed:', err));

    res.status(201).json({
      success: true,
      message: `Utilisateur créé. Mot de passe temporaire transmis à ${newUser.email} par email.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        department: newUser.department,
        branch: (newUser as any).branch,
        jobTitle: newUser.jobTitle,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt.toISOString()
      }
      // temporaryPassword omis volontairement — ne jamais exposer un secret en API
    });
  })
);

// Update user (admin only)
router.put('/:id',
  checkUserManagementPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, role, department, branch, jobTitle, isActive } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (branch !== undefined) updateData.branch = branch;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update permissions if role changed - fetch from RolePermission table
    if (role !== undefined && role !== existingUser.role) {
      const rolePermission = await prisma.rolePermission.findUnique({
        where: { role: role as any }
      });

      if (!rolePermission) {
        throw new AppError(`Role permissions not configured for ${role}`, 400, 'ROLE_NOT_CONFIGURED');
      }

      updateData.permissions = rolePermission.permissions as string[];
    }

    // Update user in database
    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        branch: (user as any).branch,
        jobTitle: user.jobTitle,
        isActive: user.isActive,
        updatedAt: user.updatedAt.toISOString()
      }
    });
  })
);

// Reset user password (admin only)
router.post('/:id/reset-password',
  checkUserManagementPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Generate new temporary password
    const temporaryPassword = generateRandomPassword(12);

    // Hash the password
    const passwordHash = await hashPassword(temporaryPassword);

    // Update user password + force change on next login
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 heures
      } as any
    });

    // Send admin reset email with temporary credentials (non-blocking)
    const frontendUrl = getAppUrl();
    const resetHtml = buildAdminResetEmail({
      name: user.name,
      email: user.email,
      temporaryPassword,
      loginUrl: frontendUrl,
      expiresIn: '72 heures'
    });
    sendEmail(user.email, 'Réinitialisation de votre mot de passe — OptimusCredit', resetHtml)
      .catch(err => console.error('Admin reset email failed:', err));

    res.json({
      success: true,
      message: `Mot de passe réinitialisé pour ${user.name}. Le mot de passe temporaire a été envoyé à ${user.email}.`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
      // temporaryPassword omis volontairement — ne jamais exposer un secret en API
    });
  })
);

export default router;