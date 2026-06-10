import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { getMergedProfile } from '../services/moduleProfileService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

async function canTemplateAction(userId: string, companyId: string, action: string): Promise<boolean> {
  try {
    const profile = await getMergedProfile(userId, companyId);
    const mod = (profile.modules as any)?.['dashboard-builder'];
    return mod?.visible === true && Array.isArray(mod?.actions) && mod.actions.includes(action);
  } catch {
    return false;
  }
}

// GET /api/dashboard-templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const templates = await prisma.dashboardTemplate.findMany({
      where: { OR: [{ isGlobal: true }, { companyId }] },
      include: { widgets: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: templates });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboard-templates
router.post('/', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' }) as any;
  const { name, description, isGlobal = false, layout = [], widgets = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'Le nom est obligatoire' }) as any;
  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  const companyId = isGlobal && isSuperAdmin ? null : req.companyId!;
  try {
    const template = await prisma.dashboardTemplate.create({
      data: {
        name: name.trim(), description: description ?? null,
        companyId, isGlobal: isGlobal && isSuperAdmin, layout,
        widgets: { create: widgets.map((w: any, i: number) => ({ type: w.type, title: w.title, config: w.config ?? {}, order: i })) },
      },
      include: { widgets: true },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboard-templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' }) as any;
  try {
    const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id }, include: { widgets: true } });
    if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' }) as any;
    if (template.isGlobal && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ success: false, error: 'Seul SUPER_ADMIN peut modifier les templates globaux' }) as any;
    if (!template.isGlobal && template.companyId !== req.companyId)
      return res.status(403).json({ success: false, error: 'Accès interdit' }) as any;
    const { name, description, layout } = req.body;
    const updated = await prisma.dashboardTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(layout !== undefined && { layout }),
      },
      include: { widgets: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboard-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' }) as any;
  try {
    const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' }) as any;
    if (template.isGlobal && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ success: false, error: 'Seul SUPER_ADMIN peut supprimer les templates globaux' }) as any;
    if (!template.isGlobal && template.companyId !== req.companyId)
      return res.status(403).json({ success: false, error: 'Accès interdit' }) as any;
    await prisma.dashboardTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboard-templates/:id/apply
router.post('/:id/apply', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_use')))
    return res.status(403).json({ success: false, error: 'Permission templates_use requise' }) as any;
  try {
    const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id }, include: { widgets: true } });
    if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' }) as any;
    if (!template.isGlobal && template.companyId !== req.companyId)
      return res.status(403).json({ success: false, error: 'Accès interdit' }) as any;
    const name = req.body.name?.trim() || template.name;

    // Map each template widget ID → new UUID so layout and widgets stay in sync
    const idMap = new Map<string, string>();
    for (const w of template.widgets as any[]) {
      idMap.set(w.id, randomUUID());
    }

    const templateLayout = Array.isArray(template.layout) ? (template.layout as any[]) : [];
    const newLayout = templateLayout.map((item: any) => ({
      i: idMap.get(item.i) ?? randomUUID(),
      x: item.x, y: item.y, w: item.w, h: item.h,
    }));

    const newWidgets = (template.widgets as any[]).map((w) => ({
      id: idMap.get(w.id)!,
      type: w.type, title: w.title, config: w.config ?? {}, order: w.order,
    }));

    const dashboard = await prisma.dashboard.create({
      data: {
        name, description: template.description ?? null,
        companyId: req.companyId!, ownerId: req.user!.id,
        layout: newLayout, templateSourceId: template.id,
      },
    });
    if (newWidgets.length > 0) {
      await prisma.dashboardWidget.createMany({
        data: newWidgets.map((w) => ({ ...w, dashboardId: dashboard.id })),
      });
    }
    const result = { ...dashboard, widgets: newWidgets.map(w => ({ ...w, dashboardId: dashboard.id })), shares: [] };
    res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
