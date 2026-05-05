/**
 * contracts.ts — gestion des contrats générés sur un dossier
 *
 *   GET    /api/contracts/application/:applicationId  → lister contrats du dossier
 *   POST   /api/contracts/generate                    → générer depuis un modèle
 *   GET    /api/contracts/:id/download                → télécharger (?signed=1 → PDF signé)
 *   POST   /api/contracts/:id/signatories             → définir/remplacer les signataires
 *   POST   /api/contracts/:id/send-for-signature      → MANUAL ou EXTERNAL
 *   POST   /api/contracts/:id/upload-signed           → upload PDF signé (mode MANUAL)
 *   POST   /api/contracts/:id/cancel                  → annuler
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { authenticate, authorize, requireCompany } from '../middleware/auth';
import { generateContract } from '../services/contractGenerationService';
import { validateMagicBytes } from '../services/contractTemplateService';
import { getProvider } from '../services/signatureService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// ─── GET /application/:applicationId ──────────────────────────────────────────
router.get('/application/:applicationId', authorize(['view_contracts']), async (req: Request, res: Response) => {
  try {
    const app = await prisma.creditApplication.findFirst({
      where: { id: req.params.applicationId, companyId: req.companyId },
      select: { id: true },
    });
    if (!app) return res.status(404).json({ success: false, error: 'Dossier introuvable' });

    const contracts = await prisma.generatedContract.findMany({
      where: { applicationId: app.id },
      include: {
        template: true,
        signatories: { orderBy: { order: 'asc' } },
      },
      orderBy: { generatedAt: 'desc' },
    });
    res.json({ success: true, data: contracts });
  } catch (e: any) {
    console.error('[contracts] GET /application/:id', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /generate ───────────────────────────────────────────────────────────
router.post('/generate', authorize(['generate_contracts']), async (req: Request, res: Response) => {
  try {
    const { templateId, applicationId, customValues } = req.body;
    if (!templateId || !applicationId) {
      return res.status(400).json({ success: false, error: 'templateId et applicationId requis' });
    }

    const app = await prisma.creditApplication.findFirst({
      where: { id: applicationId, companyId: req.companyId },
      select: { id: true },
    });
    if (!app) return res.status(404).json({ success: false, error: 'Dossier introuvable' });

    const contract = await generateContract({
      templateId,
      applicationId,
      customValues: customValues || {},
      userId: req.user!.id,
    });
    res.status(201).json({ success: true, data: contract });
  } catch (e: any) {
    console.error('[contracts] POST /generate', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /:id/download ────────────────────────────────────────────────────────
router.get('/:id/download', authorize(['view_contracts']), async (req: Request, res: Response) => {
  const c = await prisma.generatedContract.findFirst({
    where: { id: req.params.id, application: { companyId: req.companyId } },
    include: { document: true },
  });
  if (!c?.document) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
  const wantSigned = req.query.signed === '1';
  const target = wantSigned && c.signedFilePath ? c.signedFilePath : c.document.filePath;
  res.download(target, c.document.filename);
});

// ─── POST /:id/signatories ────────────────────────────────────────────────────
router.post('/:id/signatories', authorize(['generate_contracts']), async (req: Request, res: Response) => {
  try {
    const { signatories } = req.body as {
      signatories: { order: number; party: 'BANK' | 'CLIENT'; fullName: string; email?: string; role?: string }[];
    };
    if (!Array.isArray(signatories)) {
      return res.status(400).json({ success: false, error: 'signatories[] requis' });
    }

    const c = await prisma.generatedContract.findFirst({
      where: { id: req.params.id, application: { companyId: req.companyId } },
    });
    if (!c) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
    if (c.status !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'Signataires figés une fois envoyé' });
    }

    await prisma.$transaction([
      prisma.contractSignatory.deleteMany({ where: { contractId: c.id } }),
      prisma.contractSignatory.createMany({
        data: signatories.map((s) => ({
          contractId: c.id,
          order: s.order,
          party: s.party,
          fullName: s.fullName,
          email: s.email || null,
          role: s.role || null,
        })),
      }),
    ]);

    const updated = await prisma.generatedContract.findUnique({
      where: { id: c.id },
      include: { signatories: { orderBy: { order: 'asc' } }, template: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('[contracts] POST /:id/signatories', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /:id/send-for-signature ─────────────────────────────────────────────
router.post('/:id/send-for-signature', authorize(['generate_contracts']), async (req: Request, res: Response) => {
  try {
    const { mode } = req.body as { mode: 'MANUAL' | 'EXTERNAL' };
    if (mode !== 'MANUAL' && mode !== 'EXTERNAL') {
      return res.status(400).json({ success: false, error: 'mode invalide' });
    }

    const c = await prisma.generatedContract.findFirst({
      where: { id: req.params.id, application: { companyId: req.companyId } },
      include: { signatories: true },
    });
    if (!c) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
    if (c.status !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'État invalide (DRAFT requis)' });
    }
    if (c.signatories.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun signataire défini' });
    }

    if (mode === 'EXTERNAL') {
      const provider = await getProvider(req.companyId!);
      const fullContract = await prisma.generatedContract.findUnique({
        where: { id: c.id },
        include: { signatories: { orderBy: { order: 'asc' } }, document: true },
      });
      if (!fullContract) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
      const { providerRef } = await provider.sendForSignature(fullContract as any, fullContract.signatories);
      const updated = await prisma.generatedContract.update({
        where: { id: c.id },
        data: {
          status: 'PENDING_SIGNATURE',
          signatureMode: 'EXTERNAL',
          externalProviderRef: providerRef,
        },
        include: { signatories: { orderBy: { order: 'asc' } }, template: true },
      });
      return res.json({ success: true, data: updated });
    }

    // MANUAL : transition simple sans appel externe
    const updated = await prisma.generatedContract.update({
      where: { id: c.id },
      data: { status: 'PENDING_SIGNATURE', signatureMode: 'MANUAL' },
      include: { signatories: { orderBy: { order: 'asc' } }, template: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('[contracts] POST /:id/send-for-signature', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /:id/upload-signed (MANUAL) ─────────────────────────────────────────
router.post('/:id/upload-signed', authorize(['generate_contracts']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fichier manquant' });
    if (!validateMagicBytes(req.file.buffer, 'PDF')) {
      return res.status(400).json({ success: false, error: 'PDF invalide' });
    }

    const c = await prisma.generatedContract.findFirst({
      where: { id: req.params.id, application: { companyId: req.companyId } },
    });
    if (!c) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
    if (c.signatureMode !== 'MANUAL') {
      return res.status(409).json({ success: false, error: 'Disponible en mode MANUAL uniquement' });
    }
    if (c.status !== 'PENDING_SIGNATURE') {
      return res.status(409).json({ success: false, error: 'État invalide (PENDING_SIGNATURE requis)' });
    }

    const dir = path.join(__dirname, '../../uploads/contracts', c.applicationId);
    fs.mkdirSync(dir, { recursive: true });
    const signedPath = path.join(dir, `${c.id}.signed.pdf`);
    fs.writeFileSync(signedPath, req.file.buffer);
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const updated = await prisma.generatedContract.update({
      where: { id: c.id },
      data: {
        status: 'SIGNED',
        signedFilePath: signedPath,
        signedFileHash: hash,
        signedAt: new Date(),
      },
      include: { signatories: { orderBy: { order: 'asc' } }, template: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    console.error('[contracts] POST /:id/upload-signed', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /:id/cancel ─────────────────────────────────────────────────────────
router.post('/:id/cancel', authorize(['generate_contracts']), async (req: Request, res: Response) => {
  const c = await prisma.generatedContract.findFirst({
    where: { id: req.params.id, application: { companyId: req.companyId } },
  });
  if (!c) return res.status(404).json({ success: false, error: 'Contrat introuvable' });
  if (c.status === 'SIGNED' || c.status === 'CANCELLED') {
    return res.status(409).json({ success: false, error: 'Ne peut être annulé dans cet état' });
  }
  const updated = await prisma.generatedContract.update({
    where: { id: c.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
    include: { signatories: true, template: true },
  });
  res.json({ success: true, data: updated });
});

/**
 * Handler webhook DocuSeal — exporté pour montage manuel dans server.ts
 * AVANT le middleware express.json() (besoin du rawBody pour HMAC).
 *
 * Monter avec : app.post('/api/contracts/webhooks/docuseal',
 *                 express.raw({ type: 'application/json' }), handleDocusealWebhook);
 */
export async function handleDocusealWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-docuseal-signature'] as string | undefined;
    if (!signature) return res.status(401).json({ error: 'Signature manquante' });

    const rawBody = (req.body as Buffer).toString('utf8');
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'JSON invalide' });
    }

    const eventId = String(payload.event_id || payload.id || `${payload.event_type}-${Date.now()}`);

    // Idempotency
    const existing = await prisma.webhookEventLog.findUnique({
      where: { provider_eventId: { provider: 'docuseal', eventId } },
    });
    if (existing) return res.json({ ok: true, idempotent: true });

    const providerRef = String(payload.data?.submission_id || payload.submission_id || '');
    if (!providerRef) return res.status(400).json({ error: 'submission_id manquant' });

    const contract = await prisma.generatedContract.findFirst({
      where: { externalProviderRef: providerRef },
      include: { application: true },
    });
    if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });
    if (!contract.application.companyId) return res.status(500).json({ error: 'Tenant introuvable' });

    const provider = await getProvider(contract.application.companyId);
    if (!provider.verifyWebhook(rawBody, signature)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    await prisma.webhookEventLog.create({
      data: { provider: 'docuseal', eventId, payload },
    });

    const parsed = provider.parseWebhook(payload);

    if (parsed.event === 'submission.completed') {
      let signedPath: string | null = null;
      let hash: string | null = null;
      if (parsed.signedFileUrl) {
        const r = await fetch(parsed.signedFileUrl);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          const dir = path.join(__dirname, '../../uploads/contracts', contract.applicationId);
          fs.mkdirSync(dir, { recursive: true });
          signedPath = path.join(dir, `${contract.id}.signed.pdf`);
          fs.writeFileSync(signedPath, buf);
          hash = crypto.createHash('sha256').update(buf).digest('hex');
        }
      }
      await prisma.generatedContract.update({
        where: { id: contract.id },
        data: {
          status: 'SIGNED',
          signedFilePath: signedPath ?? undefined,
          signedFileHash: hash ?? undefined,
          signedAt: new Date(),
        },
      });
    } else if (parsed.event === 'submission.declined' || parsed.event === 'submission.expired') {
      // Pas d'enum DECLINED côté contrat : on garde PENDING_SIGNATURE et le juridique annule manuellement.
      // Trace dans le webhook log suffit.
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error('[contracts] webhook docuseal', e);
    res.status(500).json({ error: e.message });
  }
}

export default router;
