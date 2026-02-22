import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateToken, generateRefreshToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Mock users data (from our seeded data)
const mockUsers = [
  {
    id: 'user1',
    email: 'amadou.diop@bank.sn',
    passwordHash: '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN',
    name: 'Amadou Diop',
    role: 'ACCOUNT_MANAGER',
    department: 'Commercial Dakar',
    jobTitle: 'Chargé d\'Affaires Senior',
    isActive: true,
    lastLogin: new Date().toISOString(),
    permissions: ['create_client', 'create_application', 'view_applications', 'edit_client_data']
  },
  {
    id: 'user2',
    email: 'fatou.ndiaye@bank.sn',
    passwordHash: '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN',
    name: 'Fatou Ndiaye',
    role: 'CREDIT_ANALYST',
    department: 'Risques',
    jobTitle: 'Analyste Crédit Principal',
    isActive: true,
    lastLogin: new Date().toISOString(),
    permissions: ['review_applications', 'financial_analysis', 'score_applications', 'benchmark_analysis']
  },
  {
    id: 'user3',
    email: 'moussa.sarr@bank.sn',
    passwordHash: '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN',
    name: 'Moussa Sarr',
    role: 'BRANCH_MANAGER',
    department: 'Direction Dakar Central',
    jobTitle: 'Directeur d\'Agence',
    isActive: true,
    lastLogin: new Date().toISOString(),
    permissions: ['approve_applications', 'view_portfolio', 'manage_team', 'workflow_override']
  },
  {
    id: 'user6',
    email: 'admin@bank.sn',
    passwordHash: '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN',
    name: 'Administrateur Système',
    role: 'ADMIN',
    department: 'IT',
    jobTitle: 'Administrateur Principal',
    isActive: true,
    lastLogin: new Date().toISOString(),
    permissions: ['system_administration', 'user_management', 'role_assignment', 'system_configuration', 'audit_logs', 'data_export']
  }
];

// Login endpoint
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
  }

  // Find user by email in mock data
  const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // For demo purposes, we'll just check if password is "demo123"
  // In a real scenario, we'd compare with the hashed password
  if (password !== 'demo123') {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const accessToken = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken(user.id);

  // Log successful login
  logger.info('User logged in successfully (mock)', {
    userId: user.id,
    email: user.email,
    role: user.role
  });

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      permissions: user.permissions,
      lastLogin: user.lastLogin
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRY || '1h'
    }
  });
}));

// Get current user profile (mock)
router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  // For mock purposes, return the first user
  const user = mockUsers[0];

  res.json({
    user: {
      ...user,
      passwordHash: undefined // Don't send password hash
    }
  });
}));

export default router;