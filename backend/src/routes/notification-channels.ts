import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import nodemailer from 'nodemailer';
import { seedDefaultNotifications } from '../scripts/seedNotifications';

const router = Router();

// POST /api/notification-channels/seed-defaults
router.post('/seed-defaults', async (_req: Request, res: Response) => {
  try {
    const result = await seedDefaultNotifications(prisma);
    res.json({
      success: true,
      message: `${result.created} modèle(s) créé(s), ${result.skipped} déjà existant(s)`,
      data: result,
    });
  } catch (error: any) {
    console.error('Seed defaults error:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// GET /api/notification-channels
router.get('/', async (_req: Request, res: Response) => {
  try {
    const channels = await prisma.notificationChannel.findMany({
      orderBy: { type: 'asc' },
    });
    const sanitized = channels.map(ch => {
      if (ch.type === 'EMAIL' && ch.config && typeof ch.config === 'object') {
        const { pass, ...rest } = ch.config as any;
        return { ...ch, config: { ...rest, pass: pass ? '••••••••' : '' } };
      }
      return ch;
    });
    res.json({ success: true, data: sanitized });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// PUT /api/notification-channels/:type  (EMAIL or SMS)
router.put('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { name, isActive, config } = req.body;

    if (!['EMAIL', 'SMS'].includes(type.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Type invalide' });
    }

    const configData = { ...(config || {}) };
    if (type.toUpperCase() === 'EMAIL' && configData.pass === '••••••••') {
      const existing = await prisma.notificationChannel.findFirst({ where: { type: type.toUpperCase() as any } });
      const oldConfig = existing?.config as any;
      configData.pass = oldConfig?.pass || '';
    }

    const channel = await prisma.notificationChannel.upsert({
      where: { type: type.toUpperCase() as any },
      create: {
        type: type.toUpperCase() as any,
        name: name || type,
        isActive: isActive ?? false,
        config: configData,
      },
      update: {
        name: name || type,
        isActive: isActive ?? false,
        config: configData,
      },
    });

    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/notification-channels/test/:type
router.post('/test/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { testAddress } = req.body; // email address or phone number

    const channel = await prisma.notificationChannel.findUnique({
      where: { type: type.toUpperCase() as any },
    });

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Canal non trouvé' });
    }

    const cfg = channel.config as any;

    if (type.toUpperCase() === 'EMAIL') {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: Number(cfg.port) || 587,
        secure: cfg.secure === true || cfg.secure === 'true',
        auth: { user: cfg.user, pass: cfg.pass },
      });

      await transporter.sendMail({
        from: `"${cfg.fromName || 'OptimusCredit'}" <${cfg.fromEmail || cfg.user}>`,
        to: testAddress || cfg.user,
        subject: 'Test de notification OptimusCredit',
        html: '<p>Ceci est un email de test envoyé par OptimusCredit.</p>',
      });

      res.json({ success: true, message: 'Email de test envoyé avec succès' });
    } else if (type.toUpperCase() === 'SMS') {
      // Test SMS send
      const to = testAddress || cfg.testNumber;
      if (!to) {
        return res.status(400).json({ success: false, error: 'Numéro de test requis' });
      }

      const body = 'Test de notification SMS OptimusCredit';

      if (cfg.provider === 'orange') {
        const senderAddress = encodeURIComponent(cfg.senderId || 'tel:+221');
        const url = `${cfg.baseUrl || 'https://api.orange.com/smsmessaging/v1'}/outbound/${senderAddress}/requests`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            outboundSMSMessageRequest: {
              address: `tel:${to}`,
              senderAddress,
              outboundSMSTextMessage: { message: body },
            },
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(500).json({ success: false, error: `Erreur Orange: ${text}` });
        }
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
        const response = await fetch(cfg.baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ to, message: body, senderId: cfg.senderId }),
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(500).json({ success: false, error: `Erreur SMS: ${text}` });
        }
      }

      res.json({ success: true, message: 'SMS de test envoyé avec succès' });
    } else {
      res.status(400).json({ success: false, error: 'Type non supporté' });
    }
  } catch (error: any) {
    console.error('Test channel error:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur lors du test' });
  }
});

export default router;
