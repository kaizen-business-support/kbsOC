import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import os from 'os';
import { prisma } from './prismaClient';

// Import routes
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import applicationRoutes from './routes/applications';
import workflowRoutes from './routes/workflows';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import homeKpisRoutes from './routes/home-kpis';
import securityIpRulesRoutes from './routes/security-ip-rules';
import securityTimeRulesRoutes from './routes/security-time-rules';
import securityBlockHistoryRoutes from './routes/security-block-history';
import { extractRealIp } from './middleware/extractRealIp';
import { platformIpGate, tenantIpGate } from './middleware/ipAccess';
import { timeRulesGate } from './middleware/timeAccess';
import workflowConfigRoutes from './routes/workflow-config';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import branchRoutes from './routes/branches';
import approvalLimitRoutes from './routes/approval-limits';
import creditTypeRoutes from './routes/creditTypes';
import roleRoutes from './routes/roles';
import twoFactorRoutes from './routes/twoFactor';
import otpRoutes from './routes/otp';
import backupRoutes from './routes/backup';
import announcementRoutes from './routes/announcements';
import notificationChannelRoutes from './routes/notification-channels';
import notificationTemplateRoutes from './routes/notification-templates';
import notificationRuleRoutes from './routes/notification-rules';
import notificationRoutes from './routes/notifications';
import emailQueueRoutes from './routes/email-queue';
import auditLogRoutes from './routes/audit-logs';
import documentRoutes from './routes/documents';
import dispatchingRoutes from './routes/dispatching';
import creditPolicyRoutes from './routes/credit-policy';
import contractTemplateRoutes from './routes/contract-templates';
import contractRoutes, { handleDocusealWebhook } from './routes/contracts';
import raciMatrixRoutes from './routes/raci-matrix';
import delegationRoutes from './routes/delegations';
import moduleProfileRoutes from './routes/module-profiles';
import scopeDelegateRoutes from './routes/scope-delegates';
import repaymentRoutes from './routes/repayments';
import companyRoutes from './routes/companies';
import platformRoutes from './routes/platform';
import codirRoutes from './routes/codir';
import { startScheduler } from './services/schedulerService';
import { expireStaleActiveDelegations } from './services/delegationService';
import { syncAllRolePermissionsOnStartup } from './services/moduleProfileService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { authenticate } from './middleware/auth';
import { auditLogger } from './middleware/auditLogger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5007', 10);

// Trust reverse proxy (nginx) — nécessaire pour X-Forwarded-For et req.ip
app.set('trust proxy', true);

// Re-export shared Prisma singleton (imported above)
export { prisma };

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── IP access enforcement (plateforme, avant auth) ──────────────────────────
app.use(extractRealIp);
app.use(platformIpGate);

// ─── Compression gzip — réduit la bande passante jusqu'à 70% ─────────────────
app.use(compression());

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
// 500 req/15min par IP : pour 200 users, chaque utilisateur peut faire ~2,5 req/min en moyenne.
if (isProd) {
  const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '500'),
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

// Auth-specific limiter — 30 en prod (200 users peuvent se connecter dans la même fenêtre)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    statusCode: 429,
  },
});

console.log(`🔒  Auth rate limiting: ${isProd ? '30' : '200'} req/15min`);

// ─── Webhooks (besoin du rawBody → AVANT express.json) ───────────────────────
app.post(
  '/api/contracts/webhooks/docuseal',
  express.raw({ type: 'application/json', limit: '5mb' }),
  handleDocusealWebhook,
);

// ─── Body parsing — conservative limits ──────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Ensure upload subdirectories exist ───────────────────────────────────────
const uploadsRoot = path.join(__dirname, '../uploads');
['logos', 'contract-templates', 'contracts'].forEach((d) => {
  fs.mkdirSync(path.join(uploadsRoot, d), { recursive: true });
});

// ─── Serve uploaded files (logos, documents) ──────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/home',    authenticate, homeKpisRoutes);
app.use('/api/clients', authenticate, tenantIpGate, timeRulesGate, clientRoutes);
app.use('/api/security/ip-rules',   authenticate, tenantIpGate, timeRulesGate, securityIpRulesRoutes);
app.use('/api/security/time-rules',     authenticate, tenantIpGate, timeRulesGate, securityTimeRulesRoutes);
app.use('/api/security/block-history',  authenticate, tenantIpGate, timeRulesGate, securityBlockHistoryRoutes);
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
app.use('/api/module-profiles', authenticate, moduleProfileRoutes);
app.use('/api/scope-delegates', authenticate, scopeDelegateRoutes);
app.use('/api/codir', codirRoutes);
app.use('/api/auth/2fa', authenticate, twoFactorRoutes);
app.use('/api/otp', authenticate, otpRoutes);
app.use('/api/backup', authenticate, backupRoutes);
app.use('/api/announcements', authenticate, announcementRoutes);
app.use('/api/notification-channels', authenticate, notificationChannelRoutes);
app.use('/api/notification-templates', authenticate, notificationTemplateRoutes);
app.use('/api/notification-rules', authenticate, notificationRuleRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/email-queue', authenticate, emailQueueRoutes);
app.use('/api/audit-logs',   authenticate, auditLogRoutes);
app.use('/api/documents',    authenticate, documentRoutes);
app.use('/api/repayments',   authenticate, repaymentRoutes);
app.use('/api/dispatching',    authenticate, dispatchingRoutes);
app.use('/api/credit-policies', authenticate, creditPolicyRoutes);
app.use('/api/contract-templates', contractTemplateRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/raci-matrix', authenticate, raciMatrixRoutes);
app.use('/api/delegations',    authenticate, delegationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/platform', platformRoutes);

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
  // Libérer les connexions HTTP inactives après 65s (légèrement > les 60s des proxies)
  server.keepAliveTimeout = 65_000;
  // Le client doit envoyer ses headers dans les 10s
  server.headersTimeout = 70_000;
  // Timeout de requête à 30s — évite les connexions zombies
  server.timeout = 30_000;

  console.log(`🚀 OptimusCredit Backend API running on port ${PORT} (worker ${process.pid})`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/health`);

  // Start backup scheduler
  if (process.env.DISABLE_SCHEDULER !== 'true') {
    startScheduler();
  }

  // Expirer les délégations en retard au démarrage
  expireStaleActiveDelegations()
    .then(n => { if (n > 0) console.log(`[delegation] ${n} délégation(s) expirée(s) au démarrage`); })
    .catch(err => console.error('[delegation] expiration error:', err));

  // Resynchroniser les permissions de tous les rôles — garantit la cohérence
  // après toute modification des profils par défaut dans le code
  syncAllRolePermissionsOnStartup()
    .then(() => console.log('[permissions] Permissions rôles synchronisées'))
    .catch(err => console.error('[permissions] Erreur sync permissions:', err));
});

// Ne pas tuer le processus sur une promesse non gérée — loguer seulement.
// En démo avec plusieurs utilisateurs simultanés, une erreur isolée (timeout DB,
// requête malformée, etc.) ne doit pas faire tomber le serveur entier.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('⚠️  Unhandled Promise Rejection (non-fatal):', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err);
  // Erreur synchrone inattendue — ici on laisse le processus continuer
  // sauf si c'est une erreur catastrophique (EADDRINUSE, etc.)
  if ((err as any).code === 'EADDRINUSE') {
    console.error('Port already in use — shutting down.');
    process.exit(1);
  }
});

export default app;
