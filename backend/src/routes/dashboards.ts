import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { getMergedProfile } from '../services/moduleProfileService';
import { createInAppNotification, renderTemplate, sendEmail } from '../services/notificationService';
import { buildDashboardSharedEmail } from '../utils/emailTemplates';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

async function canDashboardAction(userId: string, companyId: string, action: string): Promise<boolean> {
  try {
    const profile = await getMergedProfile(userId, companyId);
    const mod = (profile.modules as any)?.['dashboard-builder'];
    return mod?.visible === true && Array.isArray(mod?.actions) && mod.actions.includes(action);
  } catch {
    return false;
  }
}

async function getDashboardOrFail(id: string, companyId: string, res: Response): Promise<any | null> {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    include: { widgets: true, shares: true, owner: { select: { id: true, name: true, email: true } } },
  });
  if (!dashboard) { res.status(404).json({ success: false, error: 'Dashboard introuvable' }); return null; }
  if (dashboard.companyId !== companyId) { res.status(403).json({ success: false, error: 'Accès interdit' }); return null; }
  return dashboard;
}

function canAccessDashboard(dashboard: any, userId: string, userRole: string | undefined, requiredPermission: 'VIEW' | 'EDIT'): boolean {
  if (dashboard.ownerId === userId) return true;
  return dashboard.shares.some((s: any) => {
    if (s.permission === 'VIEW' && requiredPermission === 'EDIT') return false;
    if (s.shareType === 'USER' && s.targetId === userId) return true;
    if (s.shareType === 'ROLE' && s.targetId === userRole) return true;
    if (s.shareType === 'COMPANY' && s.targetId === dashboard.companyId) return true;
    return false;
  });
}

async function notifyDashboardShare(params: {
  dashboard: any;
  shareType: string;
  targetId: string;
  permission: string;
  sharerName: string;
  companyId: string;
}): Promise<void> {
  const { dashboard, shareType, targetId, permission, sharerName, companyId } = params;

  // Resolve recipient users
  let recipients: { id: string; name: string; email: string | null }[] = [];

  if (shareType === 'USER') {
    const user = await prisma.user.findFirst({
      where: { id: targetId, isActive: true },
      select: { id: true, name: true, email: true },
    });
    if (user) recipients = [user];
  } else if (shareType === 'ROLE') {
    recipients = await prisma.user.findMany({
      where: { role: targetId as any, isActive: true, memberships: { some: { companyId, isActive: true } } },
      select: { id: true, name: true, email: true },
    });
  } else if (shareType === 'COMPANY') {
    recipients = await prisma.user.findMany({
      where: { isActive: true, memberships: { some: { companyId, isActive: true } } },
      select: { id: true, name: true, email: true },
    });
  }

  if (!recipients.length) return;

  // Tenant branding for email
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
  const [company, emailChannel, tplRecord] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, logoUrl: true } }),
    prisma.notificationChannel.findUnique({ where: { type: 'EMAIL' } }),
    prisma.notificationTemplate.findFirst({ where: { event: 'DASHBOARD_SHARED', isActive: true } }),
  ]);

  const tenant = company
    ? { name: company.name, logoUrl: company.logoUrl ? `${frontendUrl}${company.logoUrl}` : null }
    : null;

  const dashboardUrl = `${frontendUrl}/dashboard-builder/${dashboard.id}`;
  const permLabel = permission === 'EDIT' ? 'Consultation et modification' : 'Consultation uniquement';
  const emailActive = emailChannel?.isActive === true;

  for (const user of recipients) {
    if (user.id === dashboard.ownerId) continue;

    const tplVars: Record<string, string> = {
      recipientName: user.name,
      sharerName,
      dashboardName: dashboard.name,
      permissionLabel: permLabel,
      actionUrl: dashboardUrl,
    };

    // In-app notification: use template body if configured, else default
    const inAppMessage = tplRecord?.body
      ? renderTemplate(tplRecord.body, tplVars)
      : `${sharerName} vous a partagé le tableau de bord « ${dashboard.name} » (${permLabel.toLowerCase()}).`;

    await createInAppNotification(user.id, {
      title: 'Dashboard partagé avec vous',
      message: inAppMessage,
      type: 'INFO',
      relatedType: 'dashboard',
      relatedId: dashboard.id,
      actionUrl: `/dashboard-builder/${dashboard.id}`,
      companyId,
    });

    if (emailActive && user.email) {
      // Subject: use template subject if configured, else default
      const subject = tplRecord?.subject
        ? renderTemplate(tplRecord.subject, tplVars)
        : `${sharerName} vous a partagé un dashboard`;

      const html = buildDashboardSharedEmail(
        { recipientName: user.name, sharerName, dashboardName: dashboard.name, permission: permission as 'VIEW' | 'EDIT', dashboardUrl },
        tenant
      );
      await sendEmail(user.email, subject, html).catch(() => {});
    }
  }
}

// GET /api/dashboards
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const userRole = req.user?.role;
    const roleConditions: any[] = [
      { shareType: 'USER', targetId: userId },
      { shareType: 'COMPANY', targetId: companyId },
    ];
    if (userRole) roleConditions.push({ shareType: 'ROLE', targetId: userRole });

    const dashboards = await prisma.dashboard.findMany({
      where: {
        OR: [
          { companyId, ownerId: userId },
          { companyId, shares: { some: { OR: roleConditions } } },
        ],
      },
      include: { widgets: true, shares: true, owner: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: dashboards });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboards
router.post('/', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'Le nom est obligatoire' }) as any;
  if (!(await canDashboardAction(req.user!.id, req.companyId!, 'create')))
    return res.status(403).json({ success: false, error: 'Permission create requise' }) as any;
  try {
    const dashboard = await prisma.dashboard.create({
      data: { name: name.trim(), description: description ?? null, companyId: req.companyId!, ownerId: req.user!.id, layout: [] },
      include: { widgets: true, shares: true },
    });
    res.status(201).json({ success: true, data: dashboard });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/dashboards/:id
router.get('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'VIEW'))
    return res.status(403).json({ success: false, error: 'Accès interdit' }) as any;
  res.json({ success: true, data: dashboard });
});

// PUT /api/dashboards/:id
router.put('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' }) as any;
  try {
    const { name, description, layout } = req.body;
    const updated = await prisma.dashboard.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(layout !== undefined && { layout }),
      },
      include: { widgets: true, shares: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  const isOwner = dashboard.ownerId === req.user!.id;
  const canManage = await canDashboardAction(req.user!.id, req.companyId!, 'manage');
  if (!isOwner && !canManage)
    return res.status(403).json({ success: false, error: 'Seul le créateur ou un ADMIN peut supprimer ce dashboard' }) as any;
  try {
    await prisma.dashboard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboards/:id/widgets
router.post('/:id/widgets', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' }) as any;
  const { type, title, config = {}, position } = req.body;
  if (!type || !title) return res.status(400).json({ success: false, error: 'type et title sont obligatoires' }) as any;
  try {
    const widgetId = randomUUID();
    const currentLayout = Array.isArray(dashboard.layout) ? dashboard.layout as any[] : [];
    const newLayoutItem = { i: widgetId, x: position?.x ?? 0, y: position?.y ?? 0, w: position?.w ?? 4, h: position?.h ?? 2 };
    const [widget, updatedDashboard] = await prisma.$transaction([
      prisma.dashboardWidget.create({
        data: { id: widgetId, dashboardId: req.params.id, type, title, config, order: 0 },
      }),
      prisma.dashboard.update({
        where: { id: req.params.id },
        data: { layout: [...currentLayout, newLayoutItem] },
        include: { widgets: true },
      }),
    ]);
    res.status(201).json({ success: true, data: { widget, layout: updatedDashboard.layout } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboards/:id/widgets/:wid
router.put('/:id/widgets/:wid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' }) as any;
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.wid } });
  if (!widget || widget.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Widget introuvable' }) as any;
  try {
    const { type, title, config } = req.body;
    const updated = await prisma.dashboardWidget.update({
      where: { id: req.params.wid },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(config !== undefined && { config }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id/widgets/:wid
router.delete('/:id/widgets/:wid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' }) as any;
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.wid } });
  if (!widget || widget.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Widget introuvable' }) as any;
  try {
    const currentLayout = Array.isArray(dashboard.layout) ? dashboard.layout as any[] : [];
    await prisma.$transaction([
      prisma.dashboardWidget.delete({ where: { id: req.params.wid } }),
      prisma.dashboard.update({
        where: { id: req.params.id },
        data: { layout: currentLayout.filter((item: any) => item.i !== req.params.wid) },
      }),
    ]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/dashboards/:id/shares
router.get('/:id/shares', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, req.user?.role, 'VIEW') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Accès interdit' }) as any;
  const shares = await prisma.dashboardShare.findMany({ where: { dashboardId: req.params.id } });
  res.json({ success: true, data: shares });
});

// POST /api/dashboards/:id/shares
router.post('/:id/shares', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' }) as any;
  const { shareType, targetId, permission } = req.body;
  if (!shareType || !targetId || !permission)
    return res.status(400).json({ success: false, error: 'shareType, targetId et permission sont obligatoires' }) as any;
  if (!['USER','ROLE','COMPANY'].includes(shareType))
    return res.status(400).json({ success: false, error: 'shareType invalide' }) as any;
  if (!['VIEW','EDIT'].includes(permission))
    return res.status(400).json({ success: false, error: 'permission invalide (VIEW ou EDIT)' }) as any;
  try {
    const share = await prisma.dashboardShare.create({
      data: { dashboardId: req.params.id, shareType, targetId, permission },
    });
    res.status(201).json({ success: true, data: share });

    // Fire-and-forget: notify the recipient(s)
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } })
      .then(sharer => notifyDashboardShare({
        dashboard,
        shareType,
        targetId,
        permission,
        sharerName: sharer?.name ?? 'Un utilisateur',
        companyId: req.companyId!,
      }))
      .catch(err => console.error('notifyDashboardShare error:', err));
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Ce partage existe déjà' }) as any;
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboards/:id/shares/:sid
router.put('/:id/shares/:sid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' }) as any;
  const { permission } = req.body;
  if (!['VIEW','EDIT'].includes(permission))
    return res.status(400).json({ success: false, error: 'permission invalide (VIEW ou EDIT)' }) as any;
  const share = await prisma.dashboardShare.findUnique({ where: { id: req.params.sid } });
  if (!share || share.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Partage introuvable' }) as any;
  try {
    const updated = await prisma.dashboardShare.update({ where: { id: req.params.sid }, data: { permission } });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id/shares/:sid
router.delete('/:id/shares/:sid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' }) as any;
  const share = await prisma.dashboardShare.findUnique({ where: { id: req.params.sid } });
  if (!share || share.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Partage introuvable' }) as any;
  try {
    await prisma.dashboardShare.delete({ where: { id: req.params.sid } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
