import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../server';
import { logger } from '../utils/logger';
import { isTokenBlacklisted } from '../services/redis';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        companyId?: string;
        readOnly?: boolean;
      };
      companyId?: string;  // shortcut for req.user.companyId
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  jti?: string;
  companyId?: string;      // present in tokens after company selection
  readOnly?: boolean;      // present in impersonation tokens
  iat?: number;
  exp?: number;
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authorization header missing or invalid format',
        code: 'MISSING_AUTH_HEADER'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token missing',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not set');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Check token revocation (logout blacklist)
    if (decoded.jti) {
      const revoked = await isTokenBlacklisted(decoded.jti);
      if (revoked) {
        return res.status(401).json({
          error: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        });
      }
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'User account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions as string[] : []
    };

    if (decoded.companyId) {
      req.user!.companyId = decoded.companyId;
      req.companyId = decoded.companyId;
    }
    if (decoded.readOnly) {
      req.user!.readOnly = true;
    }

    // Update last login timestamp (optional, for audit purposes)
    if (process.env.UPDATE_LAST_LOGIN === 'true') {
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      }).catch(error => {
        logger.warn('Failed to update last login timestamp:', error);
      });
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid access token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Authorization middleware factory
export const authorize = (requiredPermissions: string[] = [], requiredRoles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check roles if specified
    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Check permissions if specified
    if (requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every(permission =>
        req.user!.permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    }

    next();
  };
};

export const requireCompany = (req: Request, res: Response, next: NextFunction) => {
  if (!req.companyId) {
    return res.status(403).json({
      error: "Compagnie non sélectionnée. Appelez POST /api/auth/select-company d'abord.",
      code: 'COMPANY_NOT_SELECTED'
    });
  }
  next();
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Accès réservé au Super Administrateur plateforme.',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }
  next();
};

export const blockReadOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.readOnly) {
    return res.status(403).json({
      error: 'Mode impersonation : modifications interdites.',
      code: 'READ_ONLY_MODE'
    });
  }
  next();
};

// Helper function to generate JWT token
export const generateToken = (payload: {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
  readOnly?: boolean;
}, expiresIn = '1h'): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable not set');
  const jti = require('crypto').randomUUID();
  return jwt.sign({ ...payload, jti }, jwtSecret, { expiresIn } as SignOptions);
};

// Helper function to generate refresh token
export const generateRefreshToken = (userId: string): string => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable not set');
  }

  return jwt.sign({ userId }, jwtRefreshSecret, { expiresIn: '7d' });
};