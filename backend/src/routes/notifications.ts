import { Router, Request, Response } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/notifications — list last 50 for current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Non authentifié' });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/notifications/count — unread count
router.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Non authentifié' });

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Non authentifié' });

    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      return res.status(404).json({ success: false, error: 'Notification non trouvée' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Non authentifié' });

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
