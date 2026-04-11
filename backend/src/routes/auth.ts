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

    // ── Full login ────────────────────────────────────────────────────────────
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    const refreshToken = generateRefreshToken(user.id);

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
        lastLogin: new Date().toISOString(),
        isActive: user.isActive
      },
      accessToken,
      refreshToken
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
