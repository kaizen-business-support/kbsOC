import { Router, Request, Response } from 'express';
import { PolicyStatus } from '@prisma/client';
import { prisma } from '../server';
import { createInAppNotification } from '../services/notificationService';
import { resolveDelegation } from '../services/delegationService';
import { createWorkflowStepsForApplication, finalizeStepDuration } from '../services/workflowService';
import { triggerNotification } from '../services/notificationService';

const router = Router();

// ─── Middleware : permission dispatch_applications, rôle autorisé, ou délégation ──
const requireSupervisorOrDelegate = async (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user) return res.status(403).json({ success: false, error: 'Non authentifié' });

  // Tout utilisateur ayant la permission dispatch_applications peut dispatcher
  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes('dispatch_applications')) return next();

  // Fallback rôle : RESPONSABLE_RISQUES, ADMIN, SUPER_ADMIN
  if (['RESPONSABLE_RISQUES', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) return next();

  const userId = user?.userId || user?.id;
  const delegation = await resolveDelegation(userId, 'DISPATCH_APPLICATION');
  if (delegation) {
    (req as any).delegationContext = delegation;
    return next();
  }

  return res.status(403).json({ success: false, error: "Vous n'avez pas la permission de dispatcher des dossiers" });
};

router.use(requireSupervisorOrDelegate);

// Rôles distincts de la politique active (fallback = ANALYSTE_RISQUES si pas de politique)
async function getActivePolicyRoles(companyId: string | undefined): Promise<string[]> {
  if (!companyId) return ['ANALYSTE_RISQUES'];
  const policy = await prisma.creditPolicy.findFirst({
    where: { companyId, status: PolicyStatus.ACTIVE, isActive: true },
    include: { steps: { select: { assignedRole: true } } },
  });
  if (!policy || policy.steps.length === 0) return ['ANALYSTE_RISQUES'];
  return [...new Set(policy.steps.map(s => s.assignedRole as string))];
}

// ─── GET /api/dispatching/workload ─────────────────────────────────────────────
router.get('/workload', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string | undefined;
    const policyRoles = await getActivePolicyRoles(companyId);

    const agents = await prisma.user.findMany({
      where: {
        role: { in: policyRoles as any[] },
        isActive: true,
        ...(companyId ? { memberships: { some: { companyId, isActive: true } } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        jobTitle: true,
        assignedSteps: {
          where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
          select: {
            id: true,
            status: true,
            stepName: true,
            deadline: true,
            application: {
              select: {
                id: true,
                applicationNumber: true,
                amount: true,
                currency: true,
                status: true,
                client: { select: { companyName: true } }
              }
            }
          }
        }
      }
    });

    const workload = agents.map(agent => {
      const overdueCount = agent.assignedSteps.filter(
        s => s.deadline && new Date(s.deadline) < new Date()
      ).length;

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        department: agent.department,
        jobTitle: agent.jobTitle,
        activeCount: agent.assignedSteps.length,
        pendingCount: agent.assignedSteps.filter(s => s.status === 'PENDING').length,
        inReviewCount: agent.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
        overdueCount,
        activeDossiers: agent.assignedSteps.map(s => ({
          stepId: s.id,
          applicationId: s.application.id,
          applicationNumber: s.application.applicationNumber,
          clientName: s.application.client.companyName,
          amount: Number(s.application.amount),
          currency: s.application.currency,
          appStatus: s.application.status,
          stepStatus: s.status,
          deadline: s.deadline
        })),
        workloadScore: agent.assignedSteps.length + overdueCount * 2
      };
    });

    workload.sort((a, b) => a.workloadScore - b.workloadScore);

    res.json({ success: true, data: workload });
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/pending ─────────────────────────────────────────────
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string | undefined;

    // Une app est "à dispatcher" si et seulement si elle n'a pas encore d'étape
    // DISPATCH complétée. Cela évite qu'une app réapparaisse dans le tableau
    // à cause des étapes suivantes (analyse, comité...) créées en PENDING dès le départ.
    const applications = await prisma.creditApplication.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        NOT: {
          workflowSteps: {
            some: {
              policyStep: { stepType: 'DISPATCH' },
              completedAt: { not: null },
            },
          },
        },
      },
      include: {
        client: true,
        creator: true,
        creditType: true,
        workflowSteps: {
          orderBy: { createdAt: 'asc' },
          include: {
            policyStep: { select: { stepLabel: true, order: true, stepType: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const data = applications.map(app => {
      // Priorité : l'étape DISPATCH en attente ; sinon première étape PENDING sans assignee
      const dispatchStep = app.workflowSteps.find(
        s => s.policyStep?.stepType === 'DISPATCH' && !s.completedAt
      );
      const currentStep = dispatchStep
        ?? app.workflowSteps.find(s => s.status === 'PENDING' && !s.assigneeId)
        ?? null;

      const daysPending = Math.floor(
        (Date.now() - new Date(app.submittedAt || app.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: app.id,
        applicationNumber: app.applicationNumber,
        clientName: app.client.companyName,
        clientSector: app.client.sector,
        branch: app.creator.department || 'Non définie',
        amount: Number(app.amount),
        currency: app.currency,
        purpose: app.purpose,
        durationMonths: app.durationMonths,
        status: app.status,
        createdAt: app.createdAt,
        submittedAt: app.submittedAt,
        daysPending,
        accountManager: app.creator.name,
        accountManagerId: app.creator.id,
        creditType: app.creditType?.name,
        currentStepId: currentStep?.id ?? null,
        currentStepRole: currentStep?.role ?? null,
        currentStepName: currentStep?.stepName ?? null,
        currentStepLabel: currentStep?.policyStep?.stepLabel ?? currentStep?.stepName ?? null,
        needsCircuit: currentStep === null,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Pending dispatching error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/suggest/:applicationId ──────────────────────────────
router.get('/suggest/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    const [application, currentStep] = await Promise.all([
      prisma.creditApplication.findUnique({
        where: { id: applicationId },
        include: { client: true, creator: true }
      }),
      prisma.workflowStep.findFirst({
        where: { applicationId, status: 'PENDING', assigneeId: null },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    if (!application) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    // Si pas d'étape PENDING, chercher la 1ère étape de la politique active
    let neededRole: string | null = (currentStep?.role as string) ?? null;
    if (!neededRole) {
      const companyId = (req as any).companyId as string | undefined;
      const policy = await prisma.creditPolicy.findFirst({
        where: {
          ...(companyId ? { companyId } : {}),
          status: PolicyStatus.ACTIVE,
          isActive: true,
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            take: 1,
            select: { assignedRole: true },
          },
        },
      });
      neededRole = (policy?.steps[0]?.assignedRole as string) ?? 'ANALYSTE_RISQUES';
    }

    const companyId = (req as any).companyId as string | undefined;
    const agents = await prisma.user.findMany({
      where: {
        role: neededRole as any,
        isActive: true,
        ...(companyId ? { memberships: { some: { companyId, isActive: true } } } : {}),
      },
      include: {
        assignedSteps: {
          where: { status: { in: ['PENDING', 'IN_REVIEW'] } }
        }
      }
    });

    if (agents.length === 0) {
      return res.status(404).json({ success: false, error: `Aucun responsable disponible avec le rôle ${neededRole}` });
    }

    const ranked = agents
      .map(a => {
        const overdueCount = a.assignedSteps.filter(
          s => s.deadline && new Date(s.deadline) < new Date()
        ).length;
        const sameDeptBonus = a.department === application.creator?.department ? -0.5 : 0;
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          department: a.department,
          jobTitle: a.jobTitle,
          activeCount: a.assignedSteps.length,
          pendingCount: a.assignedSteps.filter(s => s.status === 'PENDING').length,
          inReviewCount: a.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
          overdueCount,
          workloadScore: a.assignedSteps.length + overdueCount * 2 + sameDeptBonus
        };
      })
      .sort((a, b) => a.workloadScore - b.workloadScore);

    res.json({
      success: true,
      data: {
        suggested: ranked[0],
        ranked,
        neededRole,
        applicationId,
        applicationNumber: application.applicationNumber
      }
    });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/history ─────────────────────────────────────────────
router.get('/history', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string | undefined;

    const steps = await prisma.workflowStep.findMany({
      where: {
        assigneeId: { not: null },
        ...(companyId ? { application: { companyId } } : {})
      },
      include: {
        application: {
          include: {
            client: { select: { companyName: true } },
            creator: { select: { name: true, department: true } }
          }
        },
        assignee: { select: { id: true, name: true, role: true, department: true, jobTitle: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const data = steps.map(s => ({
      stepId: s.id,
      applicationId: (s as any).application.id,
      applicationNumber: (s as any).application.applicationNumber,
      clientName: (s as any).application.client.companyName,
      amount: Number((s as any).application.amount),
      currency: (s as any).application.currency,
      status: s.status,
      appStatus: (s as any).application.status,
      stepRole: s.role,
      stepName: s.stepName,
      assignedTo: (s as any).assignee,
      accountManager: (s as any).application.creator.name,
      branch: (s as any).application.creator.department,
      assignedAt: s.createdAt,
      deadline: s.deadline,
      comments: s.comments
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/dispatching/assign ─────────────────────────────────────────────
router.post('/assign', async (req: Request, res: Response) => {
  try {
    // Accept userId (new) or analystId (backward compat)
    const { applicationId, userId, analystId, comment, isReassign } = req.body;
    const targetUserId = userId || analystId;
    const supervisorId = (req as any).user?.userId || (req as any).user?.id;

    if (!applicationId || !targetUserId) {
      return res.status(400).json({ success: false, error: 'applicationId et userId requis' });
    }

    const [application, agent] = await Promise.all([
      prisma.creditApplication.findUnique({
        where: { id: applicationId },
        include: {
          workflowSteps: {
            orderBy: { createdAt: 'asc' },
            include: { policyStep: { select: { stepType: true } } },
          },
          client: { select: { companyName: true } },
          creator: { select: { branch: true, department: true } }
        }
      }),
      prisma.user.findUnique({ where: { id: targetUserId } })
    ]);

    if (!application) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    if (!agent) return res.status(400).json({ success: false, error: 'Utilisateur introuvable' });

    // Guard multi-tenant : l'agent doit appartenir à la même société
    const companyId = (req as any).companyId as string | undefined;
    if (companyId) {
      const membership = await prisma.companyMembership.findFirst({
        where: { userId: targetUserId, companyId, isActive: true },
      });
      if (!membership) {
        return res.status(403).json({
          success: false,
          error: "Cet utilisateur n'appartient pas à votre organisation.",
        });
      }
    }

    // Guard anti-double-dispatch : si le dispatch initial est déjà complété, bloquer.
    if (!isReassign) {
      const completedDispatch = application.workflowSteps.find(
        (s: any) => s.policyStep?.stepType === 'DISPATCH' && s.completedAt !== null
      );
      if (completedDispatch) {
        return res.status(409).json({
          success: false,
          error: 'Ce dossier a déjà été dispatché. Utilisez la réaffectation depuis l\'historique pour le modifier.',
        });
      }
    }

    // Find the step to assign: for reassign, first PENDING/IN_REVIEW; for initial, first PENDING unassigned
    let targetStep = isReassign
      ? application.workflowSteps.find((s: any) => ['PENDING', 'IN_REVIEW'].includes(s.status))
      : application.workflowSteps.find((s: any) => s.status === 'PENDING' && !s.assigneeId);

    // Si aucune étape PENDING et que l'application est SUBMITTED, tenter de générer le circuit
    if (!targetStep && !isReassign && application.creditTypeId) {
      try {
        await createWorkflowStepsForApplication(application.id, application.creditTypeId, Number(application.amount));
        // Recharger les étapes
        const updated = await prisma.creditApplication.findUnique({
          where: { id: applicationId },
          include: {
            workflowSteps: {
              orderBy: { createdAt: 'asc' },
              include: { policyStep: { select: { stepType: true } } },
            },
          },
        });
        targetStep = updated?.workflowSteps.find((s: any) => s.status === 'PENDING' && !s.assigneeId) ?? undefined;
      } catch (circuitErr: any) {
        console.warn('[dispatching] Circuit non généré :', circuitErr.message);
        return res.status(400).json({
          success: false,
          error: `Circuit non généré : ${circuitErr.message}`,
        });
      }
    }

    if (!targetStep) {
      return res.status(400).json({ success: false, error: 'Aucune étape en attente pour ce dossier. Vérifiez qu\'une politique de crédit active est configurée.' });
    }

    // Non-cumul : empêcher l'affectation du même analyste sur deux étapes ANALYSIS
    if (targetStep.policyStepId) {
      const stepTypeInfo = await prisma.creditPolicyStep.findUnique({
        where: { id: targetStep.policyStepId },
        select: { stepType: true },
      });
      if (stepTypeInfo?.stepType === 'ANALYSIS') {
        const priorAnalysis = await prisma.workflowStep.findFirst({
          where: {
            applicationId,
            assigneeId: targetUserId,
            completedAt: { not: null },
            id: { not: targetStep.id },
            policyStep: { stepType: 'ANALYSIS' },
          },
        });
        if (priorAnalysis) {
          return res.status(403).json({
            success: false,
            error: `Non-cumul des analyses : ${agent.name} a déjà traité une étape d'analyse sur ce dossier. Choisissez un autre analyste pour la contre-analyse.`,
          });
        }
      }
    }

    // Validate the agent's role matches the step's role
    if (agent.role !== targetStep.role) {
      return res.status(400).json({
        success: false,
        error: `Cette étape requiert un responsable avec le rôle "${targetStep.role}". L'utilisateur sélectionné a le rôle "${agent.role}".`
      });
    }

    const supervisorUser = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { name: true, role: true, branch: true, department: true }
    });
    const supervisorName = supervisorUser?.name || 'Responsable';

    // ── Guard agence ──────────────────────────────────────────────────────────
    const GLOBAL_ROLES = ['RESPONSABLE_RISQUES', 'DIRECTION_GENERALE', 'ADMIN'];
    const delegCtx = (req as any).delegationContext as {
      delegatorBranch: string | null;
      delegatorDepartment: string | null;
      delegatorRole: string;
    } | undefined;

    const effectiveRole   = delegCtx ? delegCtx.delegatorRole : (supervisorUser?.role ?? '');
    const effectiveBranch = delegCtx
      ? (delegCtx.delegatorBranch || delegCtx.delegatorDepartment)
      : ((supervisorUser as any)?.branch || (supervisorUser as any)?.department);

    if (!GLOBAL_ROLES.includes(effectiveRole)) {
      // Vérifier que le dossier appartient bien à l'agence du dispatcher
      const creatorBranch = (application as any).creator?.branch || (application as any).creator?.department;
      if (effectiveBranch && creatorBranch && effectiveBranch !== creatorBranch) {
        return res.status(403).json({
          success: false,
          error: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez affecter que les dossiers de votre agence ("${effectiveBranch}").`,
        });
      }
      // Pas de restriction sur la branche de l'analyste : les analystes risques sont
      // centralisés et peuvent recevoir des dossiers de toutes les agences.
    }

    const dateStr = new Date().toLocaleDateString('fr-FR');

    await prisma.workflowStep.update({
      where: { id: targetStep.id },
      data: {
        assigneeId: targetUserId,
        status: 'PENDING',
        comments: comment ||
          (isReassign
            ? `Ré-affecté à ${agent.name} par ${supervisorName} le ${dateStr}`
            : `Affecté à ${agent.name} par ${supervisorName} le ${dateStr}`)
      }
    });

    if (application.status === 'SUBMITTED') {
      await prisma.creditApplication.update({
        where: { id: applicationId },
        data: { status: 'UNDER_REVIEW' }
      });
    }

    // Compléter l'étape DISPATCH du dispatcher (uniquement sur l'affectation initiale)
    // Cela retire le dossier de la liste pending du dispatcher et empêche un re-dispatch.
    if (!isReassign) {
      const dispatchStep = await prisma.workflowStep.findFirst({
        where: {
          applicationId,
          completedAt: null,
          policyStep: { stepType: 'DISPATCH' },
        },
      });
      if (dispatchStep) {
        const dur = await finalizeStepDuration(dispatchStep.id);
        await prisma.workflowStep.update({
          where: { id: dispatchStep.id },
          data: {
            status: 'APPROVED' as any,
            completedAt: new Date(),
            assigneeId: supervisorId,
            durationMinutes: dur ?? undefined,
            comments: `Dispatch complété par ${supervisorName} le ${dateStr} — affecté à ${agent.name}`,
          },
        });
        triggerNotification('STEP_ASSIGNED', applicationId, {
          targetUserId,
          assigneeName: agent.name,
          stepName: isReassign ? 'Ré-affectation' : 'Affectation initiale',
        });
      }
    }

    const clientName = (application as any).client?.companyName ?? 'Client';
    await createInAppNotification(targetUserId, {
      title: isReassign
        ? `Dossier ré-affecté — ${application.applicationNumber}`
        : `Nouveau dossier à traiter — ${application.applicationNumber}`,
      message: `Le dossier de ${clientName} (${application.applicationNumber}) vous a été ${isReassign ? 'ré-affecté' : 'affecté'} par ${supervisorName}. Veuillez procéder au traitement.`,
      type: 'ACTION_REQUIRED',
      relatedType: 'application',
      relatedId: applicationId,
      actionUrl: `/workflow?applicationId=${applicationId}`,
    });

    res.json({
      success: true,
      message: isReassign
        ? `Dossier ${application.applicationNumber} ré-affecté à ${agent.name}`
        : `Dossier ${application.applicationNumber} affecté à ${agent.name}`,
      data: { applicationId, userId: targetUserId, agentName: agent.name }
    });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ success: false, error: "Erreur lors de l'affectation" });
  }
});

export default router;
