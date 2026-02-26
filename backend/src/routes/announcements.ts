import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate } from '../middleware/auth';

const router = Router();

const ADMIN_ROLES = ['ADMIN', 'MANAGEMENT'];

// ─── GET /api/announcements — active announcements (all authenticated users) ──

router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now },
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── GET /api/announcements/all — all (admin/management only) ─────────────────

router.get('/all', async (req: Request, res: Response) => {
  try {
    if (!ADMIN_ROLES.includes((req.user as any)?.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const announcements = await prisma.announcement.findMany({
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get all announcements error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── POST /api/announcements — create (admin/management only) ─────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!ADMIN_ROLES.includes((req.user as any)?.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { title, message, priority, expiresAt } = req.body;

    if (!title?.trim() || !message?.trim() || !expiresAt) {
      return res.status(400).json({ success: false, error: 'Titre, message et date d\'expiration requis' });
    }

    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ success: false, error: 'La date d\'expiration doit être dans le futur' });
    }

    const announcement = await (prisma.announcement as any).create({
      data: {
        title: title.trim(),
        message: message.trim(),
        priority: priority || 'INFO',
        expiresAt: expiry,
        createdBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── PUT /api/announcements/:id — update (admin/management only) ──────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!ADMIN_ROLES.includes((req.user as any)?.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { id } = req.params;
    const { title, message, priority, expiresAt, isActive } = req.body;

    const existing = await (prisma.announcement as any).findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Annonce introuvable' });
    }

    const updateData: any = {};
    if (title !== undefined)    updateData.title    = title.trim();
    if (message !== undefined)  updateData.message  = message.trim();
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expiresAt !== undefined) {
      const expiry = new Date(expiresAt);
      if (isNaN(expiry.getTime())) {
        return res.status(400).json({ success: false, error: 'Date d\'expiration invalide' });
      }
      updateData.expiresAt = expiry;
    }

    const updated = await (prisma.announcement as any).update({
      where: { id },
      data: updateData,
      include: { creator: { select: { id: true, name: true } } },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update announcement error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// ─── DELETE /api/announcements/:id (admin/management only) ────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!ADMIN_ROLES.includes((req.user as any)?.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { id } = req.params;
    const existing = await (prisma.announcement as any).findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Annonce introuvable' });
    }

    await (prisma.announcement as any).delete({ where: { id } });
    return res.json({ success: true, message: 'Annonce supprimée' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

export default router;
