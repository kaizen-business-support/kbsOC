import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import applicationRoutes from './routes/applications';
import workflowRoutes from './routes/workflows';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import workflowConfigRoutes from './routes/workflow-config';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import branchRoutes from './routes/branches';
import approvalLimitRoutes from './routes/approval-limits';
import creditTypeRoutes from './routes/creditTypes';
import roleRoutes from './routes/roles';
import twoFactorRoutes from './routes/twoFactor';
import backupRoutes from './routes/backup';
import { startScheduler } from './services/schedulerService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { authenticate } from './middleware/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize Prisma Client
export const prisma = new PrismaClient();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — never use wildcard '*' ───────────────────────────────────────────
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3006';

// Reject wildcard '*' — force explicit list
const allowedOrigins: string[] = rawAllowedOrigins === '*'
  ? ['http://localhost:3006', 'http://0.0.0.0:3006']
  : rawAllowedOrigins.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (native apps, Postman in dev)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// ─── Rate limiting — applied in all environments ──────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

// Global limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: isProd
    ? parseInt(process.env.RATE_LIMIT_MAX || '100')
    : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.',
    statusCode: 429,
  },
});
app.use(globalLimiter);

// Stricter limiter on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    statusCode: 429,
  },
});

console.log(`🛡️  Rate limiting active (${isProd ? 'production' : 'development'} thresholds)`);

// ─── Body parsing — conservative limits ──────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── UTF-8 charset ────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.charset = 'utf-8';
  const originalJson = res.json.bind(res);
  res.json = function (obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(obj);
  };
  next();
});

// ─── Logging middleware ───────────────────────────────────────────────────────
app.use(logger);

// ─── Public routes ────────────────────────────────────────────────────────────
// Auth routes have their own rate limiter on login/refresh
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// ─── Protected routes (authenticate middleware applied) ───────────────────────
app.use('/api/clients', authenticate, clientRoutes);
app.use('/api/applications', authenticate, applicationRoutes);
app.use('/api/workflows', authenticate, workflowRoutes);
app.use('/api/analytics', authenticate, analyticsRoutes);
app.use('/api/workflow-config', authenticate, workflowConfigRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/departments', authenticate, departmentRoutes);
app.use('/api/branches', authenticate, branchRoutes);
app.use('/api/approval-limits', authenticate, approvalLimitRoutes);
app.use('/api/credit-types', authenticate, creditTypeRoutes);
app.use('/api/roles', authenticate, roleRoutes);
app.use('/api/auth/2fa', authenticate, twoFactorRoutes);
app.use('/api/backup', authenticate, backupRoutes);

// ─── Root endpoint ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    message: 'OptimusCredit Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/api/health'
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint non trouvé',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OptimusCredit Backend API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/health`);

  // Start backup scheduler
  if (process.env.DISABLE_SCHEDULER !== 'true') {
    startScheduler();
  }
});

process.on('unhandledRejection', async (err: Error) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  await prisma.$disconnect();
  server.close(() => {
    process.exit(1);
  });
});

export default app;
