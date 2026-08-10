import { Router, Request, Response } from 'express';
import { PolicyStatus } from '@prisma/client';
import { prisma } from '../server';
import { createInAppNotification } from '../services/notificationService';
import { resolveDelegation } from '../services/delegationService';
import { createWorkflowStepsForApplication, finalizeStepDuration } from '../services/workflowService';
import { triggerNotification } from '../services/notificationService';
import { rolesMatching, canonicalRole } from '../utils/roleAliases';
import {
  toGuardStep,
  resolveDispatchStep,
  pickAssignmentTarget,
  findSequentialBlocker,
  sequentialBlockReason,
  checkBranchScope,
} from '../services/workflowGuards';

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

    // Une app est "à dispatcher" tant qu'il reste au moins une étape DISPATCH
    // non encore complétée. Cela couvre les workflows à plusieurs étapes DISPATCH
    // (ex: dispatch initial + dispatch_2 pour une seconde affectation) et exclut
    // les apps qui n'ont plus aucun DISPATCH en attente.
    const applications = await prisma.creditApplication.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        workflowSteps: {
          some: {
            policyStep: { stepType: 'DISPATCH' },
            completedAt: null,
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
        where: {
          applicationId,
          status: 'PENDING',
          assigneeId: null,
          policyStep: { stepType: { not: 'DISPATCH' } },
        },
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
    // users.role passe par l'enum Prisma : le rôle issu de workflow_steps.role
    // (String libre, parfois en @map snake_case) doit être normalisé, sinon la
    // requête lève une erreur de validation au lieu de filtrer.
    const agents = await prisma.user.findMany({
      where: {
        role: canonicalRole(neededRole) as any,
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

    // Portée d'agence : même règle que l'approbation (canApproveStep §4). Le tri se
    // faisait auparavant sur la seule charge de travail, si bien qu'un compte d'une
    // autre agence — souvent à zéro dossier, donc score minimal — arrivait en tête.
    const creatorBranch = (application as any).creator?.branch || (application as any).creator?.department || null;

    const ranked = agents
      .map(a => {
        const overdueCount = a.assignedSteps.filter(
          s => s.deadline && new Date(s.deadline) < new Date()
        ).length;
        const scope = checkBranchScope(
          { role: a.role as string, branch: (a as any).branch, department: a.department },
          creatorBranch,
          { requireAttachment: true },
        );
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          branch: (a as any).branch ?? null,
          department: a.department,
          jobTitle: a.jobTitle,
          activeCount: a.assignedSteps.length,
          pendingCount: a.assignedSteps.filter(s => s.status === 'PENDING').length,
          inReviewCount: a.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
          overdueCount,
          eligible: scope.allowed,
          ineligibleReason: scope.allowed ? null : (scope.reason ?? 'Hors périmètre'),
          workloadScore: a.assignedSteps.length + overdueCount * 2,
        };
      })
      // Les profils hors périmètre restent visibles — pour que l'UI puisse expliquer
      // leur absence — mais jamais en tête : ils sont relégués après les éligibles.
      .sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return a.workloadScore - b.workloadScore;
      });

    const eligible = ranked.filter(a => a.eligible);

    if (eligible.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Aucun profil "${neededRole}" ne relève de l'agence "${creatorBranch ?? 'non définie'}". Rattachez un profil à cette agence ou confiez le dossier à un service transversal.`,
      });
    }

    res.json({
      success: true,
      data: {
        suggested: eligible[0],
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
    // Accept userId (new) or analystId (backward compat).
    // dispatchStepId désigne l'étape DISPATCH sur laquelle le dispatcheur a agi :
    // sans elle, une affectation pouvait clôturer un DISPATCH situé plus loin dans
    // le circuit et sauter les étapes intermédiaires.
    const { applicationId, userId, analystId, comment, isReassign, dispatchStepId } = req.body;
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
            include: { policyStep: { select: { stepType: true, order: true, stepLabel: true } } },
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

    let guardSteps = application.workflowSteps.map(toGuardStep);

    // Si le circuit n'existe pas encore et que le dossier vient d'être soumis,
    // le générer avant toute résolution d'étape.
    const hasAssignableStep = guardSteps.some(
      (s: any) => s.completedAt === null && s.policyStep?.stepType !== 'DISPATCH'
    );
    if (!hasAssignableStep && !isReassign && application.creditTypeId) {
      try {
        await createWorkflowStepsForApplication(application.id, application.creditTypeId, Number(application.amount));
        const updated = await prisma.creditApplication.findUnique({
          where: { id: applicationId },
          include: {
            workflowSteps: {
              orderBy: { createdAt: 'asc' },
              include: { policyStep: { select: { stepType: true, order: true, stepLabel: true } } },
            },
          },
        });
        guardSteps = (updated?.workflowSteps ?? []).map(toGuardStep);
      } catch (circuitErr: any) {
        console.warn('[dispatching] Circuit non généré :', circuitErr.message);
        return res.status(400).json({
          success: false,
          error: `Circuit non généré : ${circuitErr.message}`,
        });
      }
    }

    // ── Résolution de l'étape DISPATCH réellement traitée ─────────────────────
    // En affectation initiale seulement : une ré-affectation ne clôture aucun DISPATCH.
    let dispatchStep = null as ReturnType<typeof toGuardStep> | null;
    if (!isReassign) {
      dispatchStep = resolveDispatchStep(guardSteps, dispatchStepId);
      if (!dispatchStep) {
        return res.status(409).json({
          success: false,
          error: dispatchStepId
            ? "L'étape de dispatching indiquée est introuvable ou déjà traitée. Rafraîchissez la liste des dossiers à affecter."
            : 'Ce dossier a déjà été entièrement dispatché. Utilisez la réaffectation depuis l\'historique pour le modifier.',
        });
      }

      // Garde séquentiel — identique à celui de l'approbation (canApproveStep §0).
      // Sans lui, le dispatching clôturait un DISPATCH alors qu'une étape d'ordre
      // inférieur restait à traiter, fabriquant l'incohérence que l'approbation
      // bloquait ensuite définitivement.
      const blocker = findSequentialBlocker(guardSteps, dispatchStep);
      if (blocker) {
        return res.status(409).json({ success: false, error: sequentialBlockReason(blocker) });
      }
    }

    // ── Étape cible ───────────────────────────────────────────────────────────
    // Première étape non-DISPATCH d'ordre supérieur au DISPATCH traité. En
    // ré-affectation, la première étape ouverte du circuit.
    const targetStep = pickAssignmentTarget(guardSteps, dispatchStep, { isReassign: Boolean(isReassign) });

    if (!targetStep) {
      return res.status(400).json({
        success: false,
        error: dispatchStep
          ? "Aucune étape à affecter après cette étape de dispatching. Vérifiez le circuit défini par la politique de crédit."
          : "Aucune étape en attente pour ce dossier. Vérifiez qu'une politique de crédit active est configurée.",
      });
    }

    // Non-cumul : empêcher l'affectation du même analyste sur deux étapes ANALYSIS
    {
      if (targetStep.policyStep?.stepType === 'ANALYSIS') {
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

    // Validate the agent's role matches the step's role.
    // rolesMatching tolère les deux encodages (legacy UPPER_CASE / @map snake_case) :
    // workflow_steps.role est un String libre alimenté par la politique, alors que
    // users.role passe par l'enum — la comparaison stricte échouait selon l'historique.
    if (!rolesMatching(targetStep.role).includes(agent.role as string)) {
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

    // ── Contrôle du rôle du dispatcheur ───────────────────────────────────────
    // Le DISPATCH porte un rôle : seul un profil de ce rôle peut le clôturer.
    // Sans ce contrôle, n'importe qui pouvait clôturer le dispatch d'un autre service.
    const delegCtx = (req as any).delegationContext as {
      delegatorBranch: string | null;
      delegatorDepartment: string | null;
      delegatorRole: string;
    } | undefined;

    const effectiveRole   = delegCtx ? delegCtx.delegatorRole : (supervisorUser?.role ?? '');
    const effectiveBranch = delegCtx
      ? (delegCtx.delegatorBranch || delegCtx.delegatorDepartment)
      : ((supervisorUser as any)?.branch || (supervisorUser as any)?.department);

    if (dispatchStep && !rolesMatching(dispatchStep.role).includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: `L'étape "${dispatchStep.policyStep?.stepLabel ?? dispatchStep.stepName}" est réservée au rôle "${dispatchStep.role}". Votre rôle ("${effectiveRole}") ne permet pas de la traiter.`,
      });
    }

    // ── Portée d'agence ───────────────────────────────────────────────────────
    // Règle unique partagée avec canApproveStep §4 (workflowGuards). Elle s'applique
    // désormais aussi à la personne AFFECTÉE : un compte hors périmètre recevait
    // jusqu'ici des étapes d'analyse que lui seul pouvait traiter, rendant le
    // dossier intraitable par tout le monde.
    const creatorBranch = (application as any).creator?.branch || (application as any).creator?.department;

    const dispatcherScope = checkBranchScope(
      { role: effectiveRole, branch: effectiveBranch },
      creatorBranch,
    );
    if (!dispatcherScope.allowed) {
      return res.status(403).json({
        success: false,
        error: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez affecter que les dossiers de votre agence ("${effectiveBranch}").`,
      });
    }

    const agentScope = checkBranchScope(
      { role: agent.role as string, branch: (agent as any).branch, department: (agent as any).department },
      creatorBranch,
      { requireAttachment: true },
    );
    if (!agentScope.allowed) {
      return res.status(403).json({
        success: false,
        error: `${agent.name} ne peut pas recevoir ce dossier. ${agentScope.reason}`,
      });
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
        stepName: 'Affectation initiale',
      });
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
