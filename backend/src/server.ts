import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import os from 'os';
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
import announcementRoutes from './routes/announcements';
import notificationChannelRoutes from './routes/notification-channels';
import notificationTemplateRoutes from './routes/notification-templates';
import notificationRuleRoutes from './routes/notification-rules';
import notificationRoutes from './routes/notifications';
import auditLogRoutes from './routes/audit-logs';
import { startScheduler } from './services/schedulerService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { authenticate } from './middleware/auth';
import { auditLogger } from './middleware/auditLogger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5007', 10);

// Initialize Prisma Client
export const prisma = new PrismaClient();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — auto-detect local IPs + explicit list ────────────────────────────
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3006';

// Detect all local network IPs of this machine at startup
const getLocalNetworkOrigins = (): string[] => {
  const origins: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        origins.push(`http://${addr.address}:${FRONTEND_PORT}`);
      }
    }
  }
  return origins;
};

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3006';

// Reject wildcard '*' — exit early in production, warn in dev
if (rawAllowedOrigins === '*' && process.env.NODE_ENV === 'production') {
  console.error('FATAL: ALLOWED_ORIGINS must not be "*" in production. Set an explicit list.');
  process.exit(1);
}

const staticOrigins: string[] = rawAllowedOrigins === '*'
  ? ['http://localhost:3006']
  : rawAllowedOrigins.split(',').map(o => o.trim()).filter(Boolean);

const dynamicOrigins = getLocalNetworkOrigins();

// Merge static + auto-detected, remove duplicates
const allowedOrigins: string[] = [...new Set([...staticOrigins, ...dynamicOrigins])];

console.log('🌐 CORS allowed origins:', allowedOrigins);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (native apps, curl in dev)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

// Global limiter — only in production (dev has too many double-renders with React StrictMode)
if (isProd) {
  const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.',
      statusCode: 429,
    },
  });
  app.use(globalLimiter);
  console.log('🛡️  Global rate limiting enabled (production)');
} else {
  console.log('⚠️  Global rate limiting disabled in development');
}

// Auth-specific limiter — always active but generous in dev
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    statusCode: 429,
  },
});

console.log(`🔒  Auth rate limiting: ${isProd ? '10' : '200'} req/15min`);

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

// ─── Audit logger — global, non-blocking ─────────────────────────────────────
// Placed before routes so res.on('finish') is registered on every request.
// By the time the 'finish' event fires, authenticate() has already set req.user.
// The middleware self-guards: it does nothing if req.user is absent or if the
// HTTP method is not mutating (GET / HEAD / OPTIONS).
app.use(auditLogger);

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
app.use('/api/announcements', authenticate, announcementRoutes);
app.use('/api/notification-channels', authenticate, notificationChannelRoutes);
app.use('/api/notification-templates', authenticate, notificationTemplateRoutes);
app.use('/api/notification-rules', authenticate, notificationRuleRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/audit-logs',   authenticate, auditLogRoutes);

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
