import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../server';
import { comparePassword, hashPassword, validatePasswordStrength } from '../utils/password';
import { blacklistToken, isTokenBlacklisted } from '../services/redis';
import { authenticate } from '../middleware/auth';
import { sendEmail } from '../services/notificationService';
import { buildPasswordResetEmail } from '../utils/emailTemplates';
import { getAppUrl } from '../utils/getAppUrl';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
}): string {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' }
  );
}

function generateRefreshToken(userId: string): string {
  const jti = uuidv4();
  return jwt.sign(
    { userId, jti },
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    { expiresIn: '7d' }
  );
}

function generateAccessTokenWithCompany(payload: {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  readOnly?: boolean;
}): string {
  const jti = uuidv4();
  return jwt.sign(
    { ...payload, jti },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' }
  );
}

/** Temporary token used between password-check and 2FA/forced-change step (10 min TTL). */
function generateTempToken(userId: string, type: string = '2fa_pending'): string {
  return jwt.sign(
    { userId, type },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '10m' }
  );
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Délai constant pour résister aux timing attacks (énumération d'emails)
    const DUMMY_HASH = '$2b$12$dummyhashtopreventtimingattacksXXXXXXXXXXXXXXXXXXXXXX';
    if (!user || !user.passwordHash) {
      await comparePassword(password, DUMMY_HASH);
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    if (!user.isActive) {
      await comparePassword(password, DUMMY_HASH);
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    // ── Mot de passe temporaire expiré ────────────────────────────────────────
    if ((user as any).passwordExpiresAt && new Date() > (user as any).passwordExpiresAt) {
      return res.status(401).json({
        success: false,
        code: 'PASSWORD_EXPIRED',
        error: 'Votre mot de passe temporaire a expiré. Contactez votre administrateur ou utilisez "Mot de passe oublié".'
      });
    }

    // ── Changement de mot de passe obligatoire ────────────────────────────────
    if ((user as any).mustChangePassword) {
      const tempToken = generateTempToken(user.id, 'must_change');
      return res.json({ success: true, requiresPasswordChange: true, tempToken });
    }

    // ── 2FA check ────────────────────────────────────────────────────────────
    const roleConfig = await (prisma as any).rolePermission.findUnique({
      where: { role: user.role }
    });
    const roleForcesOtp = roleConfig?.twoFactorRequired === true;
    const userHas2fa = (user as any).twoFactorEnabled === true;

    if (roleForcesOtp && !userHas2fa) {
      // Role requires 2FA but user hasn't set it up yet → force setup
      const tempToken = generateTempToken(user.id);
      return res.json({ success: true, requiresSetup: true, tempToken });
    }

    if (userHas2fa || roleForcesOtp) {
      // User has 2FA configured → request OTP before granting session
      const tempToken = generateTempToken(user.id);
      return res.json({ success: true, requires2FA: true, tempToken });
    }

    // ── Full login — multi-company flow ─────────────────────────────────────
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Fetch user's company memberships
    const memberships = await (prisma as any).companyMembership.findMany({
      where: { userId: user.id, isActive: true },
      include: { company: { select: { id: true, name: true, code: true, logoUrl: true, isActive: true } } },
    });

    const companies = memberships
      .filter((m: any) => m.company.isActive)
      .map((m: any) => ({
        id: m.company.id,
        name: m.company.name,
        code: m.company.code,
        logoUrl: m.company.logoUrl,
        role: m.role,
      }));

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      permissions: user.permissions,
      lastLogin: new Date().toISOString(),
      isActive: user.isActive
    };

    // Log login (manuel — le middleware auditLogger ne s'applique pas ici car req.user absent)
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_USER',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
      }
    }).catch(() => {});

    // If exactly one company: auto-select, return full token
    if (companies.length === 1) {
      const accessToken = generateAccessTokenWithCompany({
        userId: user.id,
        email: user.email,
        role: companies[0].role,
        companyId: companies[0].id,
      });
      const refreshToken = generateRefreshToken(user.id);
      return res.json({
        success: true,
        accessToken,
        refreshToken,
        user: userData,
        companies,
        autoSelected: true,
      });
    }

    // If no company: return token without companyId (legacy/admin flow)
    if (companies.length === 0) {
      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken(user.id);
      return res.json({ success: true, accessToken, refreshToken, user: userData, companies: [] });
    }

    // Multiple companies: return partialToken + company list
    const partialToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'company_selection' },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '5m' }
    );

    return res.json({
      success: true,
      requiresCompanySelection: true,
      partialToken,
      companies,
      user: userData,
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded?.jti && decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          await blacklistToken(decoded.jti, ttl);
        }
      } catch {
        // decode failure — still proceed with logout
      }
    }
    // Log logout
    const logUserId = (req as any).user?.id;
    if (logUserId) {
      prisma.auditLog.create({
        data: {
          userId: logUserId,
          action: 'LOGOUT_USER',
          entityType: 'user',
          entityId: logUserId,
          ipAddress: req.ip || null,
          userAgent: req.get('User-Agent') || null,
        }
      }).catch(() => {});
    }

    return res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la déconnexion' });
  }
});

// ─── POST /api/auth/select-company ───────────────────────────────────────────

router.post('/select-company', async (req: Request, res: Response) => {
  try {
    const { companyId, partialToken } = req.body;
    if (!companyId || !partialToken) {
      return res.status(400).json({ success: false, error: 'companyId et partialToken requis' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(partialToken, process.env.JWT_SECRET || 'dev-secret') as any;
    } catch {
      return res.status(401).json({ success: false, error: 'Token de sélection invalide ou expiré' });
    }
    if (decoded.type !== 'company_selection') {
      return res.status(401).json({ success: false, error: 'Type de token invalide' });
    }

    const membership = await (prisma as any).companyMembership.findUnique({
      where: { userId_companyId: { userId: decoded.userId, companyId } },
      include: { company: true },
    });
    if (!membership || !membership.isActive || !membership.company.isActive) {
      return res.status(403).json({ success: false, error: 'Accès à cette compagnie non autorisé' });
    }

    const accessToken = generateAccessTokenWithCompany({
      userId: decoded.userId,
      email: decoded.email,
      role: membership.role,
      companyId,
    });
    const refreshToken = generateRefreshToken(decoded.userId);

    const userRecord = await prisma.user.update({
      where: { id: decoded.userId },
      data: { lastLogin: new Date() },
      select: { id: true, email: true, name: true, role: true, department: true, jobTitle: true, permissions: true, isActive: true }
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      company: { id: membership.company.id, name: membership.company.name, code: membership.company.code, logoUrl: membership.company.logoUrl },
      role: membership.role,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        role: membership.role,
        department: userRecord.department,
        jobTitle: userRecord.jobTitle,
        permissions: userRecord.permissions,
        lastLogin: new Date().toISOString(),
        isActive: userRecord.isActive,
      },
    });
  } catch (error) {
    console.error('Select company error:', error);
    return res.status(500).json({ success: false, error: 'Erreur sélection compagnie' });
  }
});

// ─── POST /api/auth/switch-company ───────────────────────────────────────────

router.post('/switch-company', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ success: false, error: 'companyId requis' });

    const userId = req.user!.id;

    const membership = await (prisma as any).companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: true },
    });
    if (!membership || !membership.isActive || !membership.company.isActive) {
      return res.status(403).json({ success: false, error: 'Accès à cette compagnie non autorisé' });
    }

    // Blacklist the old token
    const authHeader = req.headers.authorization!;
    const oldToken = authHeader.substring(7);
    const oldDecoded = jwt.decode(oldToken) as any;
    if (oldDecoded?.jti && oldDecoded?.exp) {
      const ttl = oldDecoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await blacklistToken(oldDecoded.jti, ttl);
    }

    const accessToken = generateAccessTokenWithCompany({
      userId,
      email: req.user!.email,
      role: membership.role,
      companyId,
    });

    return res.json({
      success: true,
      accessToken,
      company: { id: membership.company.id, name: membership.company.name, code: membership.company.code, logoUrl: membership.company.logoUrl },
      role: membership.role,
    });
  } catch (error) {
    console.error('Switch company error:', error);
    return res.status(500).json({ success: false, error: 'Erreur switch compagnie' });
  }
});

// ─── GET /api/auth/companies ──────────────────────────────────────────────────

router.get('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const memberships = await (prisma as any).companyMembership.findMany({
      where: { userId: req.user!.id, isActive: true },
      include: { company: { select: { id: true, name: true, code: true, logoUrl: true, isActive: true } } },
    });
    const companies = memberships
      .filter((m: any) => m.company.isActive)
      .map((m: any) => ({ ...m.company, role: m.role }));
    return res.json({ success: true, data: companies });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur récupération compagnies' });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token requis' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'
    ) as { userId: string; jti?: string };

    // Check if refresh token itself is blacklisted
    if (decoded.jti) {
      const revoked = await isTokenBlacklisted(decoded.jti);
      if (revoked) {
        return res.status(401).json({ success: false, error: 'Token révoqué' });
      }
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Token invalide' });
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return res.json({
      success: true,
      accessToken,
      expiresIn: process.env.JWT_EXPIRY || '1h'
    });

  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        jobTitle: user.jobTitle,
        permissions: user.permissions,
        lastLogin: user.lastLogin?.toISOString() || new Date().toISOString(),
        isActive: user.isActive,
        twoFactorEnabled: (user as any).twoFactorEnabled ?? false
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────

router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ success: false, error: 'Compte non configuré correctement' });
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordExpiresAt: null
      } as any
    });

    return res.json({ success: true, message: 'Mot de passe changé avec succès' });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors du changement de mot de passe' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { phone: phone || null }
    });

    return res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du profil' });
  }
});

// ─── POST /api/auth/change-password-forced ────────────────────────────────────
// Appelé avec un tempToken (type: 'must_change') — avant session complète

router.post('/change-password-forced', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token requis' });
    }
    const token = authHeader.substring(7);

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    } catch {
      return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
    }

    if (payload.type !== 'must_change') {
      return res.status(401).json({ success: false, error: 'Token invalide' });
    }

    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, error: 'Nouveau mot de passe requis' });
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordExpiresAt: null,
        lastLogin: new Date()
      } as any
    });

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        jobTitle: user.jobTitle,
        permissions: user.permissions,
        lastLogin: new Date().toISOString(),
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Change password forced error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post('/forgot-password', async (req: Request, res: Response) => {
  // Toujours répondre 200 pour éviter l'énumération d'emails
  const successResponse = { success: true, message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.' };

  try {
    const { email } = req.body;
    if (!email) return res.json(successResponse);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) return res.json(successResponse);

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expiresAt
      } as any
    });

    const frontendUrl = getAppUrl();
    const resetUrl = `${frontendUrl}/reset-password?token=${plainToken}`;
    const html = buildPasswordResetEmail({ name: user.name, resetUrl, expiresIn: '1 heure' });
    sendEmail(user.email, 'Réinitialisation de votre mot de passe - OptimusCredit', html)
      .catch(err => console.error('Forgot password email failed:', err));

    return res.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.json(successResponse);
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token et nouveau mot de passe requis' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() }
      } as any
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Lien invalide ou expiré. Veuillez faire une nouvelle demande.' });
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordExpiresAt: null,
        passwordResetToken: null,
        passwordResetExpires: null
      } as any
    });

    return res.json({ success: true, message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

export default router;
