import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate, requireCompany, authorize } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { createInAppNotification } from '../services/notificationService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

const SUPERVISOR_ROLE: Record<string, string> = {
  CHARGE_AFFAIRES:          'ANALYSTE_RISQUES',
  ANALYSTE_RISQUES:         'RESPONSABLE_RISQUES',
  RESPONSABLE_RISQUES:      'RESPONSABLE_ENGAGEMENTS',
  RESPONSABLE_ENGAGEMENTS:  'COMITE_CREDIT',
  COMITE_CREDIT:            'DIRECTION_GENERALE',
  DIRECTION_GENERALE:       'DIRECTION_GENERALE',
  DIRECTION_JURIDIQUE:      'DIRECTION_GENERALE',
  BACK_OFFICE:              'RESPONSABLE_ENGAGEMENTS',
};

// GET /api/codir/dashboard
router.get('/dashboard', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId!;

  const steps = await prisma.workflowStep.findMany({
    where: {
      status: { in: ['PENDING', 'IN_REVIEW'] },
      application: {
        companyId,
        status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED'] },
      },
    },
    include: {
      application: {
        include: {
          client: { select: { companyName: true, branch: true } },
          creator: { select: { branch: true } },
        },
      },
      assignee: { select: { id: true, name: true } },
      policyStep: { select: { stepLabel: true } },
    },
    orderBy: [{ isOverdue: 'desc' }, { deadline: 'asc' }, { createdAt: 'asc' }],
  }) as any[];

  // Aggregate KPIs per step
  const kpiMap = new Map<string, {
    stepName: string; stepLabel: string; role: string;
    count: number; overdueCount: number; totalWaitHours: number;
  }>();

  for (const step of steps) {
    const label = step.policyStep?.stepLabel ?? step.stepName;
    const waitHours = (Date.now() - step.createdAt.getTime()) / 3_600_000;
    const existing = kpiMap.get(step.stepName);
    if (existing) {
      existing.count++;
      if (step.isOverdue) existing.overdueCount++;
      existing.totalWaitHours += waitHours;
    } else {
      kpiMap.set(step.stepName, {
        stepName: step.stepName,
        stepLabel: label,
        role: step.role,
        count: 1,
        overdueCount: step.isOverdue ? 1 : 0,
        totalWaitHours: waitHours,
      });
    }
  }

  const kpis = Array.from(kpiMap.values()).map(k => ({
    stepName: k.stepName,
    stepLabel: k.stepLabel,
    role: k.role,
    count: k.count,
    overdueCount: k.overdueCount,
    avgWaitHours: Math.round(k.totalWaitHours / k.count),
  }));

  const items = steps.map(step => ({
    stepId: step.id,
    applicationId: step.applicationId,
    applicationNumber: step.application.applicationNumber,
    clientName: step.application.client?.companyName ?? '—',
    amount: Number(step.application.amount),
    currency: step.application.currency,
    stepName: step.stepName,
    stepLabel: step.policyStep?.stepLabel ?? step.stepName,
    assignedRole: step.role,
    assigneeId: step.assigneeId,
    assigneeName: step.assignee?.name ?? null,
    createdAt: step.createdAt.toISOString(),
    deadline: step.deadline?.toISOString() ?? null,
    isOverdue: step.isOverdue,
    daysWaiting: Math.floor((Date.now() - step.createdAt.getTime()) / 86_400_000),
    isEscalated: step.isEscalated,
    escalatedAt: step.escalatedAt?.toISOString() ?? null,
    lastRelancedAt: step.lastRelancedAt?.toISOString() ?? null,
    clientBranch: (step.application.client as any)?.branch ?? null,
    creatorBranch: (step.application as any).creator?.branch ?? null,
  }));

  res.json({ success: true, data: { kpis, items } });
}));

// POST /api/codir/relance/:stepId
router.post('/relance/:stepId', authorize(['codir_relance']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const { message } = req.body;
  const companyId = req.companyId!;

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: { application: { select: { applicationNumber: true } } },
  }) as any;
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');
  if (!step.assigneeId) throw new AppError('Aucun agent assigné à cette étape', 400, 'NO_ASSIGNEE');

  const appNumber = step.application.applicationNumber;
  const finalMessage = message?.trim()
    || `Le dossier ${appNumber} attend votre action depuis ${Math.floor((Date.now() - step.createdAt.getTime()) / 86_400_000)} jour(s). Merci de traiter ce dossier en priorité.`;

  await createInAppNotification(step.assigneeId, {
    title: `Relance — Dossier ${appNumber}`,
    message: finalMessage,
    type: 'ACTION_REQUIRED',
    relatedType: 'workflow_step',
    relatedId: step.id,
    companyId,
  });

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { lastRelancedAt: new Date() },
  });

  res.json({ success: true });
}));

// POST /api/codir/escalade/:stepId
router.post('/escalade/:stepId', authorize(['codir_escalade']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const companyId = req.companyId!;
  const escalatedById = req.user!.id;

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: {
      application: { select: { applicationNumber: true } },
      assignee: { select: { name: true } },
    },
  }) as any;
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');
  if (step.isEscalated) throw new AppError('Ce dossier est déjà escaladé', 400, 'ALREADY_ESCALATED');

  const supervisorRole = SUPERVISOR_ROLE[step.role] ?? 'DIRECTION_GENERALE';
  const appNumber = step.application.applicationNumber;
  const assigneeName = step.assignee?.name ?? 'Agent non assigné';

  // Fetch supervisors via membership (no direct enum comparison on CompanyMembership)
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: { user: { select: { id: true, role: true } } },
  });
  const supervisorIds = memberships
    .filter(m => m.user.role === supervisorRole)
    .map(m => m.user.id);

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { isEscalated: true, escalatedAt: new Date(), escalatedById },
  });

  await Promise.all(supervisorIds.map(supId =>
    createInAppNotification(supId, {
      title: `Escalade — Dossier ${appNumber}`,
      message: `Le dossier ${appNumber} a été escaladé par la direction. Étape bloquante : ${step.stepName} — Agent : ${assigneeName}.`,
      type: 'WARNING',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    })
  ));

  res.json({ success: true });
}));

// PUT /api/codir/reassign/:stepId
router.put('/reassign/:stepId', authorize(['codir_reassign']), asyncHandler(async (req: Request, res: Response) => {
  const { stepId } = req.params;
  const { newAssigneeId, comment } = req.body;
  const companyId = req.companyId!;

  if (!newAssigneeId) throw new AppError('newAssigneeId est requis', 400, 'MISSING_FIELD');

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: {
      application: { select: { applicationNumber: true } },
      assignee: { select: { id: true, name: true } },
    },
  }) as any;
  if (!step) throw new AppError('Étape introuvable', 404, 'NOT_FOUND');

  // Validate new assignee belongs to this company
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: newAssigneeId, companyId, isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) throw new AppError('Agent introuvable dans cette organisation', 404, 'ASSIGNEE_NOT_FOUND');

  const appNumber = step.application.applicationNumber;
  const newAssigneeName = membership.user.name;
  const oldAssignee = step.assignee;

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { assigneeId: newAssigneeId },
  });

  await createInAppNotification(newAssigneeId, {
    title: `Dossier réaffecté — ${appNumber}`,
    message: `Le dossier ${appNumber} vous a été réaffecté.${comment ? ` Note : ${comment}` : ''}`,
    type: 'ACTION_REQUIRED',
    relatedType: 'workflow_step',
    relatedId: step.id,
    companyId,
  });

  if (oldAssignee && oldAssignee.id !== newAssigneeId) {
    await createInAppNotification(oldAssignee.id, {
      title: `Dossier réaffecté — ${appNumber}`,
      message: `Le dossier ${appNumber} a été réaffecté à ${newAssigneeName}.`,
      type: 'INFO',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    });
  }

  res.json({ success: true });
}));

// GET /api/codir/agents/:role
router.get('/agents/:role', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.companyId!;

  // Fetch all active members and filter by role in-memory (avoids PostgreSQL enum cast issue)
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  const agents = memberships
    .filter(m => m.user.role === role)
    .map(m => ({ id: m.user.id, name: m.user.name, role: m.user.role }));

  res.json({ success: true, data: agents });
}));

// GET /api/codir/timeline
router.get('/timeline', authorize(['codir_dashboard']), asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId!;

  const applications = await prisma.creditApplication.findMany({
    where: {
      companyId,
      status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED'] },
      workflowSteps: { some: { status: { in: ['PENDING', 'IN_REVIEW'] } } },
    },
    include: {
      client:   { select: { companyName: true, branch: true } },
      creator:  { select: { name: true, branch: true } },
      policy: {
        include: {
          steps: {
            orderBy: { order: 'asc' },
            select: { id: true, stepName: true, stepLabel: true, order: true, maxDurationHours: true },
            // stepRoles intentionnellement omis — non utilisé par buildStep
          },
        },
      },
      workflowSteps: {
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();

  const mappedApps = applications.map((app: any) => {
    const wfSteps = app.workflowSteps as any[];

    const oldestPendingStep = wfSteps
      .filter((s: any) => s.status === 'PENDING' || s.status === 'IN_REVIEW')
      .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const daysWaiting = oldestPendingStep
      ? Math.floor((now - oldestPendingStep.createdAt.getTime()) / 86_400_000)
      : 0;
    const isOverdue = wfSteps.some((s: any) => s.isOverdue);

    let steps: any[];
    if (!app.policy) {
      steps = wfSteps.map((ws: any, idx: number) => buildTimelineStep(ws, null, idx + 1, now));
    } else {
      steps = (app.policy.steps as any[]).map((ps: any) => {
        const ws = wfSteps.find((w: any) => w.policyStepId === ps.id) ?? null;
        return buildTimelineStep(ws, ps, ps.order, now);
      });
    }

    return {
      applicationId:     app.id,
      applicationNumber: app.applicationNumber,
      clientName:        app.client.companyName,
      clientBranch:      app.client.branch ?? null,
      amount:            Number(app.amount),
      currency:          app.currency,
      creatorName:       app.creator.name,
      creatorBranch:     app.creator.branch ?? null,
      isOverdue,
      daysWaiting,
      isEscalated:       wfSteps.some((s: any) => s.isEscalated),
      steps,
    };
  });

  // Tri : overdue en premier, puis daysWaiting desc
  mappedApps.sort((a: any, b: any) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysWaiting - a.daysWaiting;
  });

  const clientBranches = [...new Set(mappedApps.map((a: any) => a.clientBranch).filter(Boolean))] as string[];
  const caBranches     = [...new Set(mappedApps.map((a: any) => a.creatorBranch).filter(Boolean))] as string[];

  res.json({ success: true, data: { agences: { client: clientBranches, ca: caBranches }, applications: mappedApps } });
}));

function buildTimelineStep(ws: any | null, ps: any | null, order: number, now: number) {
  const stepLabel        = ps?.stepLabel ?? ws?.stepName ?? `Étape ${order}`;
  const stepName         = ps?.stepName  ?? ws?.stepName ?? `step_${order}`;
  const maxDurationHours = ps?.maxDurationHours ?? 72;

  let status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  let durationHours: number | null = null;
  let isSlaBroken = false;

  if (!ws) {
    status = 'PENDING';
  } else if (['COMPLETED', 'APPROVED', 'REJECTED'].includes(ws.status)) {
    status = 'COMPLETED';
    if (ws.durationMinutes != null) {
      durationHours = ws.durationMinutes / 60;
    } else if (ws.completedAt && ws.startedAt) {
      durationHours = (ws.completedAt.getTime() - ws.startedAt.getTime()) / 3_600_000;
    }
  } else {
    // WorkflowStep exists but not yet completed → active step, display as IN_PROGRESS
    // Do NOT confuse with display 'PENDING' which means no WorkflowStep record exists at all
    status = 'IN_PROGRESS';
    const from = (ws.startedAt ?? ws.createdAt).getTime();
    durationHours = (now - from) / 3_600_000;
    isSlaBroken   = durationHours > maxDurationHours;
  }

  return {
    stepName,
    stepLabel,
    order,
    status,
    agentName:    ws?.assignee?.name ?? null,
    startedAt:    ws?.startedAt?.toISOString()   ?? null,
    completedAt:  ws?.completedAt?.toISOString() ?? null,
    durationHours: durationHours != null ? Math.round(durationHours * 10) / 10 : null,
    isSlaBroken,
  };
}

export default router;
