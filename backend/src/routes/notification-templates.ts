import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { buildEventEmail, PREVIEW_SAMPLE_VARS } from '../utils/emailTemplates';
import { renderTemplate } from '../services/notificationService';

const router = Router();

// POST /api/notification-templates/preview
// Returns rendered HTML for the given event + body, using sample data + tenant branding
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { event, body, subject } = req.body;

    if (!event || !body) {
      return res.status(400).json({ success: false, error: 'event et body requis' });
    }

    const vars: Record<string, string> = { ...PREVIEW_SAMPLE_VARS };

    const renderedBody    = renderTemplate(body, vars);
    const renderedSubject = subject ? renderTemplate(subject, vars) : 'Aperçu — OptimusCredit';

    // Load tenant branding for the preview
    const companyId = (req as any).companyId as string | undefined;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    let tenantBranding = null;
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, logoUrl: true },
      });
      if (company) {
        tenantBranding = {
          name: company.name,
          logoUrl: company.logoUrl ? `${frontendUrl}${company.logoUrl}` : null,
        };
      }
    }

    const html = buildEventEmail(event, renderedBody, vars as any, tenantBranding);

    res.json({ success: true, html, subject: renderedSubject });
  } catch (error: any) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// GET /api/notification-templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      include: { channel: { select: { type: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/notification-templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: req.params.id },
      include: { channel: true },
    });
    if (!template) return res.status(404).json({ success: false, error: 'Template non trouvé' });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/notification-templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, event, channelId, subject, body, isActive } = req.body;

    if (!name || !event || !channelId || !body) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }

    const template = await prisma.notificationTemplate.create({
      data: { name, event, channelId, subject: subject || null, body, isActive: isActive ?? true },
      include: { channel: { select: { type: true, name: true } } },
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT /api/notification-templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, event, channelId, subject, body, isActive } = req.body;

    const template = await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(event !== undefined && { event }),
        ...(channelId !== undefined && { channelId }),
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { channel: { select: { type: true, name: true } } },
    });

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// DELETE /api/notification-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.notificationTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
