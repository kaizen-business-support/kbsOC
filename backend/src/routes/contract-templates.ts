/**
 * contract-templates.ts — gestion des modèles de contrats par tenant
 *
 *   GET    /api/contract-templates                 → lister (filtre ?creditTypeId=)
 *   GET    /api/contract-templates/catalog/variables → catalogue de variables fixes
 *   GET    /api/contract-templates/:id             → détail
 *   POST   /api/contract-templates                 → upload (.docx ou .pdf)
 *   PUT    /api/contract-templates/:id             → update métadonnées + customFields
 *   DELETE /api/contract-templates/:id             → soft delete (bloqué si contrats actifs)
 *   GET    /api/contract-templates/:id/download    → télécharger le modèle original
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { prisma } from '../prismaClient';
import { authenticate, authorize, requireCompany } from '../middleware/auth';
import {
  extractVariablesFromDocx, extractVariablesFromHtml,
  classifyVariables, validateMagicBytes, reconcileCustomFields,
} from '../services/contractTemplateService';
import { VARIABLE_CATALOG, flattenedCatalog } from '../constants/contractVariables';

const UPLOAD_DIR = path.join(__dirname, '../../uploads/contract-templates');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// ─── GET /catalog/variables ───────────────────────────────────────────────────
router.get('/catalog/variables', (_req: Request, res: Response) => {
  res.json({ success: true, data: { groups: VARIABLE_CATALOG, flattened: flattenedCatalog() } });
});

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { creditTypeId } = req.query;
    const templates = await prisma.contractTemplate.findMany({
      where: { companyId: req.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const filtered = creditTypeId
      ? templates.filter((t) => t.creditTypeIds.length === 0 || t.creditTypeIds.includes(String(creditTypeId)))
      : templates;
    res.json({ success: true, data: filtered });
  } catch (e: any) {
    console.error('[contract-templates] GET /', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const tpl = await prisma.contractTemplate.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!tpl) return res.status(404).json({ success: false, error: 'Modèle introuvable' });
  res.json({ success: true, data: tpl });
});

// ─── POST /rich-text ──────────────────────────────────────────────────────────
router.post('/rich-text', authorize(['manage_contract_templates']), async (req: Request, res: Response) => {
  try {
    const { name, documentType, description, htmlContent } = req.body;
    const creditTypeIds = Array.isArray(req.body.creditTypeIds) ? req.body.creditTypeIds : [];
    if (!name || !documentType || !htmlContent) {
      return res.status(400).json({ success: false, error: 'name, documentType et htmlContent obligatoires' });
    }
    const vars = extractVariablesFromHtml(htmlContent);
    const { custom } = classifyVariables(vars);
    const customFields = custom.map((n) => ({ name: n, label: n, type: 'text', required: false }));
    const tpl = await prisma.contractTemplate.create({
      data: {
        companyId: req.companyId!,
        name,
        documentType,
        description: description || null,
        fileFormat: 'RICH_TEXT',
        htmlContent,
        creditTypeIds,
        customFields,
        detectedVariables: vars,
        createdBy: req.user!.id,
      },
    });
    res.status(201).json({ success: true, data: tpl });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Un modèle avec ce nom existe déjà' });
    }
    console.error('[contract-templates] POST /rich-text', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', authorize(['manage_contract_templates']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fichier manquant' });
    const { name, documentType, description } = req.body;
    const creditTypeIds = req.body.creditTypeIds ? JSON.parse(req.body.creditTypeIds) : [];
    if (!name || !documentType) {
      return res.status(400).json({ success: false, error: 'name et documentType obligatoires' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const format: 'DOCX' | 'PDF' | null = ext === '.docx' ? 'DOCX' : ext === '.pdf' ? 'PDF' : null;
    if (!format) {
      return res.status(400).json({ success: false, error: 'Format non supporté (.docx ou .pdf)' });
    }
    if (!validateMagicBytes(req.file.buffer, format)) {
      return res.status(400).json({ success: false, error: `En-tête de fichier invalide pour ${format}` });
    }

    const id = crypto.randomBytes(12).toString('hex');
    const filename = `${id}.${format.toLowerCase()}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(filePath, req.file.buffer);

    let detected: string[] = [];
    let customFields: any[] = [];
    let htmlContent: string | null = null;
    let finalFormat: 'DOCX' | 'PDF' | 'RICH_TEXT' = format;

    if (format === 'DOCX') {
      detected = extractVariablesFromDocx(filePath);
      const { custom } = classifyVariables(detected);
      customFields = custom.map((n) => ({ name: n, label: n, type: 'text', required: false }));
      try {
        const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
        htmlContent = result.value || null;
        if (htmlContent) {
          const htmlVars = extractVariablesFromHtml(htmlContent);
          if (htmlVars.length > 0) {
            const { custom: htmlCustom } = classifyVariables(htmlVars);
            const allCustom = [...new Set([...customFields.map(c => c.name), ...htmlCustom])];
            customFields = allCustom.map(n => ({ name: n, label: n, type: 'text', required: false }));
            detected = [...new Set([...detected, ...htmlVars])];
          }
          finalFormat = 'RICH_TEXT';
        }
      } catch (convErr) {
        console.warn('[contract-templates] mammoth conversion failed, keeping DOCX format:', convErr);
      }
    }

    const tpl = await prisma.contractTemplate.create({
      data: {
        companyId: req.companyId!,
        name,
        documentType,
        description: description || null,
        fileFormat: finalFormat,
        filePath,
        fileSize: req.file.size,
        originalName: req.file.originalname,
        htmlContent,
        creditTypeIds,
        customFields,
        detectedVariables: detected,
        createdBy: req.user!.id,
      },
    });
    res.status(201).json({ success: true, data: tpl });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Un modèle avec ce nom existe déjà' });
    }
    console.error('[contract-templates] POST', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', authorize(['manage_contract_templates']), async (req: Request, res: Response) => {
  try {
    const { name, description, creditTypeIds, customFields, isActive, htmlContent } = req.body;
    const existing = await prisma.contractTemplate.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Modèle introuvable' });

    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(creditTypeIds !== undefined && { creditTypeIds }),
      ...(isActive !== undefined && { isActive }),
    };

    if (htmlContent !== undefined && existing.fileFormat === 'RICH_TEXT') {
      const vars = extractVariablesFromHtml(htmlContent);
      const { custom } = classifyVariables(vars);
      updateData.htmlContent = htmlContent;
      updateData.detectedVariables = vars;
      updateData.customFields = reconcileCustomFields((existing.customFields as any[]) ?? [], custom);
    } else if (customFields !== undefined) {
      updateData.customFields = customFields;
    }

    const tpl = await prisma.contractTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json({ success: true, data: tpl });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Un modèle avec ce nom existe déjà' });
    }
    console.error('[contract-templates] PUT', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', authorize(['manage_contract_templates']), async (req: Request, res: Response) => {
  const tpl = await prisma.contractTemplate.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!tpl) return res.status(404).json({ success: false, error: 'Modèle introuvable' });

  const activeCount = await prisma.generatedContract.count({
    where: { templateId: tpl.id, status: { notIn: ['ARCHIVED', 'CANCELLED'] } },
  });
  if (activeCount > 0) {
    return res.status(409).json({
      success: false,
      error: `Modèle utilisé par ${activeCount} contrat(s) actif(s)`,
    });
  }
  await prisma.contractTemplate.update({ where: { id: tpl.id }, data: { isActive: false } });
  res.json({ success: true });
});

// ─── GET /:id/download ────────────────────────────────────────────────────────
router.get('/:id/download', async (req: Request, res: Response) => {
  const tpl = await prisma.contractTemplate.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
  });
  if (!tpl) return res.status(404).json({ success: false, error: 'Modèle introuvable' });
  if (!tpl.filePath || !tpl.originalName) return res.status(400).json({ success: false, error: 'Ce modèle ne possède pas de fichier téléchargeable' });
  res.download(tpl.filePath, tpl.originalName);
});

export default router;
