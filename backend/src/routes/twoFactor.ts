/**
 * Two-Factor Authentication routes
 *
 * All routes require the `authenticate` middleware (applied at server.ts level
 * for /api/auth/2fa).
 *
 * Routes:
 *  POST   /api/auth/2fa/setup           — generate TOTP secret + QR code URI
 *  POST   /api/auth/2fa/verify-setup    — confirm first code, activate 2FA, return backup codes
 *  POST   /api/auth/2fa/verify          — verify code during login step-2 (exchanges tempToken)
 *  POST   /api/auth/2fa/disable         — disable 2FA (blocked if role forces it)
 *  GET    /api/auth/2fa/backup-codes    — return masked backup codes
 *  POST   /api/auth/2fa/regenerate-backup-codes — regenerate backup codes
 *  PUT    /api/users/:id/2fa-required   — admin: force/remove per-user 2FA obligation
 *  PUT    /api/roles/:role/2fa-required — admin: force/remove 2FA for entire role
 */

import { Router, Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../server';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')
  );
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
}

function generateAccessToken(payload: { userId: string; email: string; role: string }): string {
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

// ─── POST /api/auth/2fa/setup ─────────────────────────────────────────────────

router.post('/setup', async (req: Request, res: Response) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `OptimusCredit (${req.user!.email})`,
      issuer: 'OptimusCredit'
    });

    // Store pending secret (not yet active — activated on verify-setup)
    await (prisma as any).user.update({
      where: { id: req.user!.id },
      data: { twoFactorSecret: secret.base32 }
    });

    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return res.json({
      success: true,
      secret: secret.base32,       // for manual entry in authenticator apps
      otpauthUrl,
      qrCode: qrCodeDataUrl         // data:image/png;base64,...
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la configuration du 2FA' });
  }
});

// ─── POST /api/auth/2fa/verify-setup ─────────────────────────────────────────

router.post('/verify-setup', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Code requis' });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user?.twoFactorSecret) {
      return res.status(400).json({ success: false, error: 'Lancez d\'abord la configuration 2FA (/setup)' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ success: false, error: 'Code invalide. Vérifiez l\'heure de votre appareil.' });
    }

    // Generate backup codes (store hashed, return plain)
    const plainCodes = generateBackupCodes(8);
    const hashedCodes = plainCodes.map(hashBackupCode);

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        backupCodes: hashedCodes
      }
    });

    return res.json({
      success: true,
      message: '2FA activé avec succès',
      backupCodes: plainCodes   // Show once — user must save them
    });
  } catch (error) {
    console.error('2FA verify-setup error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la vérification' });
  }
});

// ─── POST /api/auth/2fa/verify ────────────────────────────────────────────────
// Called during login step-2. Accepts either a TOTP code or a backup code.
// The request must carry the tempToken (from login step-1) in Authorization header.

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token temporaire manquant' });
    }

    const tempToken = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'dev-secret') as any;
    } catch {
      return res.status(401).json({ success: false, error: 'Token temporaire invalide ou expiré' });
    }

    if (decoded.type !== '2fa_pending') {
      return res.status(401).json({ success: false, error: 'Token invalide pour la vérification 2FA' });
    }

    const { token: otpToken } = req.body;
    if (!otpToken) {
      return res.status(400).json({ success: false, error: 'Code requis' });
    }

    const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Utilisateur invalide' });
    }

    let verified = false;

    // 1. Try TOTP
    if (user.twoFactorSecret) {
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: otpToken,
        window: 1
      });
    }

    // 2. Try backup codes if TOTP failed
    if (!verified && user.backupCodes?.length > 0) {
      const hashed = hashBackupCode(otpToken);
      const codeIndex = user.backupCodes.indexOf(hashed);
      if (codeIndex !== -1) {
        verified = true;
        // Consume the backup code (remove it)
        const newCodes = [...user.backupCodes];
        newCodes.splice(codeIndex, 1);
        await (prisma as any).user.update({
          where: { id: user.id },
          data: { backupCodes: newCodes }
        });
      }
    }

    if (!verified) {
      return res.status(401).json({ success: false, error: 'Code invalide' });
    }

    // Issue full session tokens
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    const refreshToken = generateRefreshToken(user.id);

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
        isActive: user.isActive,
        twoFactorEnabled: user.twoFactorEnabled
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    return res.status(500).json({ success: false, error: 'Erreur de vérification 2FA' });
  }
});

// ─── POST /api/auth/2fa/disable ───────────────────────────────────────────────

router.post('/disable', async (req: Request, res: Response) => {
  try {
    const user = await (prisma as any).user.findUnique({ where: { id: req.user!.id } });

    // Check if role forces 2FA
    const roleConfig = await (prisma as any).rolePermission.findUnique({
      where: { role: user.role }
    });

    if (user.twoFactorRequired || roleConfig?.twoFactorRequired) {
      return res.status(403).json({
        success: false,
        error: 'Le 2FA est obligatoire pour votre rôle et ne peut pas être désactivé'
      });
    }

    await (prisma as any).user.update({
      where: { id: req.user!.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: []
      }
    });

    return res.json({ success: true, message: '2FA désactivé' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la désactivation' });
  }
});

// ─── GET /api/auth/2fa/backup-codes ──────────────────────────────────────────

router.get('/backup-codes', async (req: Request, res: Response) => {
  try {
    const user = await (prisma as any).user.findUnique({ where: { id: req.user!.id } });

    return res.json({
      success: true,
      count: user?.backupCodes?.length ?? 0,
      message: 'Les codes de secours sont stockés de façon chiffrée. Régénérez-les pour en obtenir de nouveaux.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

// ─── POST /api/auth/2fa/regenerate-backup-codes ───────────────────────────────

router.post('/regenerate-backup-codes', async (req: Request, res: Response) => {
  try {
    const user = await (prisma as any).user.findUnique({ where: { id: req.user!.id } });

    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ success: false, error: 'Le 2FA n\'est pas activé' });
    }

    const plainCodes = generateBackupCodes(8);
    const hashedCodes = plainCodes.map(hashBackupCode);

    await (prisma as any).user.update({
      where: { id: req.user!.id },
      data: { backupCodes: hashedCodes }
    });

    return res.json({ success: true, backupCodes: plainCodes });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la régénération' });
  }
});

// ─── PUT /api/auth/2fa/users/:id/2fa-required ────────────────────────────────
// Admin: force/remove 2FA obligation for a specific user

router.put('/users/:id/2fa-required', async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
    }

    const { required } = req.body;

    await (prisma as any).user.update({
      where: { id: req.params.id },
      data: { twoFactorRequired: Boolean(required) }
    });

    return res.json({
      success: true,
      message: `2FA ${required ? 'rendu obligatoire' : 'rendu optionnel'} pour l'utilisateur`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

// ─── PUT /api/auth/2fa/roles/:role/2fa-required ───────────────────────────────
// Admin: force/remove 2FA for an entire role

router.put('/roles/:role/2fa-required', async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
    }

    const { required } = req.body;

    await (prisma as any).rolePermission.update({
      where: { role: req.params.role as any },
      data: { twoFactorRequired: Boolean(required) }
    });

    return res.json({
      success: true,
      message: `2FA ${required ? 'rendu obligatoire' : 'rendu optionnel'} pour le rôle ${req.params.role}`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

export default router;
