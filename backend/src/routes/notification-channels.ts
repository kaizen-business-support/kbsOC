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
      const to = testAddress || cfg.user || cfg.fromEmail;

      // Mode relay HTTP
      if (cfg.relayUrl) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
        try {
          const resp = await fetch(cfg.relayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Relay-Token': cfg.relayToken ?? '' },
            signal: ctrl.signal,
            body: JSON.stringify({
              to,
              subject: 'Test de notification OptimusCredit',
              html: '<p>Ceci est un email de test envoyé par OptimusCredit (mode relay).</p>',
              from: cfg.fromEmail || cfg.user,
              fromName: cfg.fromName || 'OptimusCredit',
            }),
          });
          clearTimeout(timer);
          const body = await resp.json().catch(() => ({}));
          if (!resp.ok) return res.status(500).json({ success: false, error: (body as any).error || `Relay HTTP ${resp.status}` });
          return res.json({ success: true, message: `Email de test envoyé via relay à ${to}` });
        } catch (relayErr: any) {
          clearTimeout(timer);
          return res.status(500).json({ success: false, error: `Relay inaccessible : ${relayErr.message || relayErr.code || String(relayErr)}` });
        }
      }

      // Mode SMTP standard
      if (!cfg.host || !cfg.user || !cfg.pass) {
        return res.status(400).json({ success: false, error: 'Configuration incomplète : host, user et pass sont obligatoires (ou configurer un relay URL)' });
      }

      const smtpPort = Number(cfg.port) || 587;
      const smtpSecure = smtpPort === 465 ? true : (cfg.secure === true || cfg.secure === 'true');
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });

      try {
        await transporter.verify();
      } catch (verifyErr: any) {
        const detail = verifyErr.message || verifyErr.code || String(verifyErr);
        return res.status(500).json({ success: false, error: `Connexion SMTP échouée : ${detail}` });
      }

      await transporter.sendMail({
        from: `"${cfg.fromName || 'OptimusCredit'}" <${cfg.fromEmail || cfg.user}>`,
        to,
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
    const detail = error.message || error.code || error.responseCode?.toString() || String(error);
    res.status(500).json({ success: false, error: detail || 'Erreur lors du test' });
  }
});

export default router;
