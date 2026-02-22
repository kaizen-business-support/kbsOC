/**
 * backup.ts — Admin backup/restore routes.
 *
 * All routes require authentication (applied in server.ts).
 * Most routes also require ADMIN role.
 *
 * Routes:
 *  GET    /api/backup/list              — list available backups
 *  POST   /api/backup/create           — trigger manual backup
 *  POST   /api/backup/restore          — restore from backup (+ 2FA confirmation)
 *  DELETE /api/backup/:filename        — delete a backup file
 *  GET    /api/backup/download/:filename — download a backup file
 *  GET    /api/backup/logs             — recent backup log entries
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import speakeasy from 'speakeasy';
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackupFile,
  BACKUP_DIR,
} from '../services/backupService';
import { prisma } from '../server';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
  }
  next();
};

const FILENAME_REGEX = /^[a-zA-Z0-9_\-.]+\.sql\.gz$/;

// ─── GET /api/backup/list ──────────────────────────────────────────────────────

router.get('/list', requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const files = listBackups();
  return res.json({ success: true, backups: files });
}));

// ─── POST /api/backup/create ──────────────────────────────────────────────────

router.post('/create', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const type: 'full' | 'partial' = req.body.type === 'partial' ? 'partial' : 'full';
  const filename = await createBackup(type, req.user!.id);
  return res.json({ success: true, message: 'Sauvegarde créée', filename });
}));

// ─── POST /api/backup/restore ─────────────────────────────────────────────────
// Requires 2FA confirmation if the requesting user has 2FA enabled.

router.post('/restore', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { filename, otpToken } = req.body;

  if (!filename || !FILENAME_REGEX.test(filename)) {
    throw new AppError('Nom de fichier invalide', 400, 'INVALID_FILENAME');
  }

  // Verify 2FA if enabled
  const user = await (prisma as any).user.findUnique({ where: { id: req.user!.id } });
  if (user?.twoFactorEnabled) {
    if (!otpToken) {
      return res.status(428).json({
        success: false,
        error: 'Code 2FA requis pour la restauration',
        requires2FA: true
      });
    }
    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: otpToken,
      window: 1
    });
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Code 2FA invalide' });
    }
  }

  // Run restore asynchronously and return immediately
  restoreBackup(filename).catch((err: Error) => {
    console.error('Restore error:', err);
  });

  return res.json({
    success: true,
    message: `Restauration depuis ${filename} lancée. Le serveur va redémarrer.`
  });
}));

// ─── DELETE /api/backup/:filename ─────────────────────────────────────────────

router.delete('/:filename', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!FILENAME_REGEX.test(filename)) {
    throw new AppError('Nom de fichier invalide', 400, 'INVALID_FILENAME');
  }
  deleteBackupFile(filename);
  return res.json({ success: true, message: `${filename} supprimé` });
}));

// ─── GET /api/backup/download/:filename ───────────────────────────────────────

router.get('/download/:filename', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!FILENAME_REGEX.test(filename)) {
    throw new AppError('Nom de fichier invalide', 400, 'INVALID_FILENAME');
  }

  const filePath = path.join(BACKUP_DIR, filename);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
    throw new AppError('Chemin invalide', 400, 'INVALID_PATH');
  }

  if (!fs.existsSync(filePath)) {
    throw new AppError('Fichier introuvable', 404, 'NOT_FOUND');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/gzip');
  fs.createReadStream(filePath).pipe(res);
}));

// ─── GET /api/backup/logs ──────────────────────────────────────────────────────

router.get('/logs', requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const logs = await (prisma as any).backupLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return res.json({ success: true, logs });
}));

export default router;
