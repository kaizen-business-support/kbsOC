import { Router, Request, Response } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/notification-rules
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rules = await prisma.notificationRule.findMany({
      include: {
        template: {
          select: { name: true, event: true, channel: { select: { type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/notification-rules
router.post('/', async (req: Request, res: Response) => {
  try {
    const { event, templateId, recipientRoles, isActive } = req.body;

    if (!event || !templateId || !recipientRoles) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }

    const rule = await prisma.notificationRule.create({
      data: {
        event,
        templateId,
        recipientRoles,
        isActive: isActive ?? true,
      },
      include: {
        template: {
          select: { name: true, event: true, channel: { select: { type: true } } },
        },
      },
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    console.error('Create rule error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Une règle avec cet événement et ce template existe déjà' });
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT /api/notification-rules/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { event, templateId, recipientRoles, isActive } = req.body;

    const rule = await prisma.notificationRule.update({
      where: { id: req.params.id },
      data: {
        ...(event !== undefined && { event }),
        ...(templateId !== undefined && { templateId }),
        ...(recipientRoles !== undefined && { recipientRoles }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        template: {
          select: { name: true, event: true, channel: { select: { type: true } } },
        },
      },
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// DELETE /api/notification-rules/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.notificationRule.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Règle supprimée' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
