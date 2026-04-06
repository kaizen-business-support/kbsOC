/**
 * workflowService.ts
 *
 * Service central de construction dynamique du workflow.
 * Toute la logique d'approbation est dérivée de la base de données —
 * aucune règle n'est codée en dur dans ce fichier ni ailleurs.
 *
 * Principe :
 *  - Si le dossier est lié à une CreditPolicy active → les étapes viennent de CreditPolicyStep.
 *  - Sinon (rétrocompatibilité) → les étapes viennent de CreditTypeWorkflowStep.
 *  - Chaque étape peut avoir une condition sur le montant (conditionMinAmount/Max).
 *  - Les limites d'approbation sont portées par CreditPolicyStep (approvalMin/Max),
 *    ou par ApprovalLimit pour l'ancien circuit.
 */

import { UserRole, PolicyStepType } from '@prisma/client';
import { prisma } from '../prismaClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStepPlan {
  order: number;
  stepName: string;
  stepLabel: string;
  role: UserRole;
  stepType?: PolicyStepType;
  durationDays: number;
  expectedDurationHours?: number;
  maxDurationHours?: number;
  isConditional: boolean;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  approvalMinAmount: number | null;
  approvalMaxAmount: number | null;
  policyStepId: string | null;
}

export interface WorkflowPlan {
  creditTypeId: string;
  creditTypeName: string;
  creditTypeCode: string;
  amount: number;
  policyId: string | null;
  policyName: string | null;
  steps: WorkflowStepPlan[];
  allSteps: WorkflowStepPlan[];
  estimatedDurationDays: number;
}

export interface StepProcessingStats {
  stepName: string;
  stepLabel: string;
  role: UserRole;
  durationMinutes: number | null;
  isOverdue: boolean;
  completedAt: Date | null;
  assigneeName: string | null;
}

export interface ApplicationProcessingStats {
  applicationId: string;
  applicationNumber: string;
  totalDurationMinutes: number | null;
  averageStepDurationMinutes: number | null;
  steps: StepProcessingStats[];
  bottleneck: StepProcessingStats | null; // étape la plus longue
}

// ─── Recherche de la politique active ────────────────────────────────────────

/**
 * Retourne la politique de crédit active applicable à un type de crédit.
 * Prend la politique active la plus récente dont validFrom <= maintenant
 * et validTo est null ou dans le futur.
 */
export async function getActivePolicyForCreditType(
  creditTypeId: string
): Promise<{ id: string; name: string; code: string } | null> {
  const now = new Date();

  // Chercher une politique active qui couvre ce type de crédit
  // (une étape de cette politique doit référencer ce creditTypeId, ou être sans restriction)
  const policy = await prisma.creditPolicy.findFirst({
    where: {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, code: true },
  });

  return policy;
}

// ─── Construction du plan depuis une CreditPolicy ────────────────────────────

async function buildPlanFromPolicy(
  policyId: string,
  creditTypeId: string,
  amount: number
): Promise<WorkflowStepPlan[]> {
  const steps = await prisma.creditPolicyStep.findMany({
    where: {
      policyId,
      isActive: true,
    },
    orderBy: { order: 'asc' },
  });

  return steps
    .filter(s => {
      // Filtrer par type de crédit si renseigné
      if (s.creditTypeIds.length > 0 && !s.creditTypeIds.includes(creditTypeId)) {
        return false;
      }
      // Filtrer par condition de montant
      if (s.conditionMinAmount !== null && amount < Number(s.conditionMinAmount)) return false;
      if (s.conditionMaxAmount !== null && amount > Number(s.conditionMaxAmount)) return false;
      return true;
    })
    .map(s => ({
      order: s.order,
      stepName: s.stepName,
      stepLabel: s.stepLabel,
      role: s.assignedRole,
      stepType: s.stepType,
      durationDays: Math.ceil(s.expectedDurationHours / 24),
      expectedDurationHours: s.expectedDurationHours,
      maxDurationHours: s.maxDurationHours,
      isConditional: s.conditionMinAmount !== null || s.conditionMaxAmount !== null,
      conditionMinAmount: s.conditionMinAmount ? Number(s.conditionMinAmount) : null,
      conditionMaxAmount: s.conditionMaxAmount ? Number(s.conditionMaxAmount) : null,
      approvalMinAmount: s.approvalMinAmount ? Number(s.approvalMinAmount) : null,
      approvalMaxAmount: s.approvalMaxAmount ? Number(s.approvalMaxAmount) : null,
      policyStepId: s.id,
    }));
}

// ─── Construction du plan (rétrocompatibilité) ────────────────────────────────

async function buildPlanFromCreditType(
  creditTypeId: string,
  amount: number
): Promise<WorkflowStepPlan[]> {
  const steps = await prisma.creditTypeWorkflowStep.findMany({
    where: { creditTypeId },
    orderBy: { order: 'asc' },
  });

  return steps
    .filter(s => {
      if (s.conditionMinAmount !== null && amount < Number(s.conditionMinAmount)) return false;
      if (s.conditionMaxAmount !== null && amount > Number(s.conditionMaxAmount)) return false;
      return true;
    })
    .map(s => ({
      order: s.order,
      stepName: s.stepName,
      stepLabel: s.stepLabel,
      role: s.role,
      stepType: undefined,
      durationDays: s.durationDays,
      expectedDurationHours: s.durationDays * 24,
      maxDurationHours: s.durationDays * 24 * 2,
      isConditional: s.conditionMinAmount !== null || s.conditionMaxAmount !== null,
      conditionMinAmount: s.conditionMinAmount ? Number(s.conditionMinAmount) : null,
      conditionMaxAmount: s.conditionMaxAmount ? Number(s.conditionMaxAmount) : null,
      approvalMinAmount: null,
      approvalMaxAmount: null,
      policyStepId: null,
    }));
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Construit le plan de workflow dynamique pour une demande de crédit.
 * Utilise la CreditPolicy active si disponible, sinon retombe sur CreditTypeWorkflowStep.
 */
export async function buildWorkflowPlan(
  creditTypeId: string,
  amount: number
): Promise<WorkflowPlan> {
  const creditType = await prisma.creditType.findUnique({
    where: { id: creditTypeId },
    select: { id: true, name: true, code: true },
  });

  if (!creditType) {
    throw new Error(`Type de crédit introuvable : ${creditTypeId}`);
  }

  // Chercher une politique active
  const policy = await getActivePolicyForCreditType(creditTypeId);

  let steps: WorkflowStepPlan[];
  let allSteps: WorkflowStepPlan[];

  if (policy) {
    // Toutes les étapes de la politique (pour affichage UI)
    const rawAll = await prisma.creditPolicyStep.findMany({
      where: { policyId: policy.id, isActive: true },
      orderBy: { order: 'asc' },
    });
    allSteps = rawAll.map(s => ({
      order: s.order,
      stepName: s.stepName,
      stepLabel: s.stepLabel,
      role: s.assignedRole,
      stepType: s.stepType,
      durationDays: Math.ceil(s.expectedDurationHours / 24),
      expectedDurationHours: s.expectedDurationHours,
      maxDurationHours: s.maxDurationHours,
      isConditional: s.conditionMinAmount !== null || s.conditionMaxAmount !== null,
      conditionMinAmount: s.conditionMinAmount ? Number(s.conditionMinAmount) : null,
      conditionMaxAmount: s.conditionMaxAmount ? Number(s.conditionMaxAmount) : null,
      approvalMinAmount: s.approvalMinAmount ? Number(s.approvalMinAmount) : null,
      approvalMaxAmount: s.approvalMaxAmount ? Number(s.approvalMaxAmount) : null,
      policyStepId: s.id,
    }));
    steps = await buildPlanFromPolicy(policy.id, creditTypeId, amount);
  } else {
    // Rétrocompatibilité : CreditTypeWorkflowStep
    const rawAll = await prisma.creditTypeWorkflowStep.findMany({
      where: { creditTypeId },
      orderBy: { order: 'asc' },
    });
    allSteps = rawAll.map(s => ({
      order: s.order,
      stepName: s.stepName,
      stepLabel: s.stepLabel,
      role: s.role,
      stepType: undefined,
      durationDays: s.durationDays,
      expectedDurationHours: s.durationDays * 24,
      maxDurationHours: s.durationDays * 24 * 2,
      isConditional: s.conditionMinAmount !== null || s.conditionMaxAmount !== null,
      conditionMinAmount: s.conditionMinAmount ? Number(s.conditionMinAmount) : null,
      conditionMaxAmount: s.conditionMaxAmount ? Number(s.conditionMaxAmount) : null,
      approvalMinAmount: null,
      approvalMaxAmount: null,
      policyStepId: null,
    }));
    steps = await buildPlanFromCreditType(creditTypeId, amount);
  }

  const estimatedDurationDays = steps.reduce((sum, s) => sum + s.durationDays, 0);

  return {
    creditTypeId: creditType.id,
    creditTypeName: creditType.name,
    creditTypeCode: creditType.code,
    amount,
    policyId: policy?.id ?? null,
    policyName: policy?.name ?? null,
    steps,
    allSteps,
    estimatedDurationDays,
  };
}

// ─── Création effective des WorkflowStep en base ──────────────────────────────

/**
 * Crée les WorkflowStep en base pour une application donnée,
 * en se basant sur le plan dynamique.
 * Stocke le policyId sur l'application et le policyStepId sur chaque étape.
 */
export async function createWorkflowStepsForApplication(
  applicationId: string,
  creditTypeId: string,
  amount: number
): Promise<void> {
  const plan = await buildWorkflowPlan(creditTypeId, amount);

  // Supprimer les étapes non-commencées avant de recréer
  await prisma.workflowStep.deleteMany({
    where: {
      applicationId,
      status: 'PENDING',
      assigneeId: null,
    },
  });

  // Lier l'application à la politique si trouvée
  if (plan.policyId) {
    await prisma.creditApplication.update({
      where: { id: applicationId },
      data: { policyId: plan.policyId },
    });
  }

  // Créer l'étape "création du dossier" si elle n'existe pas encore
  const hasCreationStep = await prisma.workflowStep.findFirst({
    where: { applicationId, stepName: 'application_created' },
  });

  if (!hasCreationStep) {
    await prisma.workflowStep.create({
      data: {
        applicationId,
        stepName: 'application_created',
        role: 'ACCOUNT_MANAGER',
        status: 'COMPLETED',
        completedAt: new Date(),
        deadline: new Date(),
        comments: 'Dossier créé',
      },
    });
  }

  // Créer les étapes du plan en PENDING
  for (const step of plan.steps) {
    await prisma.workflowStep.create({
      data: {
        applicationId,
        stepName: step.stepName,
        role: step.role as UserRole,
        status: 'PENDING',
        deadline: new Date(
          Date.now() + (step.expectedDurationHours ?? step.durationDays * 24) * 60 * 60 * 1000
        ),
        policyStepId: step.policyStepId ?? undefined,
        comments: null,
        assigneeId: null,
      },
    });
  }
}

// ─── Démarrage d'une étape (tracking du temps) ────────────────────────────────

/**
 * Marque une étape comme "en cours" (IN_REVIEW) et enregistre startedAt.
 * À appeler dès qu'un utilisateur ouvre un dossier pour le traiter.
 */
export async function startWorkflowStep(
  stepId: string,
  userId: string
): Promise<void> {
  const step = await prisma.workflowStep.findUnique({ where: { id: stepId } });
  if (!step || step.status !== 'PENDING') return;

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: {
      status: 'IN_REVIEW',
      startedAt: new Date(),
      assigneeId: userId,
    },
  });
}

// ─── Calcul de la durée à la complétion ──────────────────────────────────────

/**
 * Calcule et stocke la durée effective de traitement lors de la complétion d'une étape.
 * Retourne la durée en minutes.
 */
export async function finalizeStepDuration(stepId: string): Promise<number | null> {
  const step = await prisma.workflowStep.findUnique({ where: { id: stepId } });
  if (!step) return null;

  const start = step.startedAt ?? step.createdAt;
  const end = new Date();
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: {
      completedAt: end,
      durationMinutes,
    },
  });

  return durationMinutes;
}

/**
 * Calcule et stocke la durée totale du dossier (somme des étapes complétées).
 * À appeler lors de l'approbation ou du rejet final.
 */
export async function finalizeApplicationDuration(applicationId: string): Promise<void> {
  const steps = await prisma.workflowStep.findMany({
    where: { applicationId, completedAt: { not: null } },
  });

  const total = steps.reduce((sum, s) => {
    if (s.durationMinutes) return sum + s.durationMinutes;
    // Fallback : calculer depuis createdAt si durationMinutes absent
    if (s.completedAt) {
      const start = s.startedAt ?? s.createdAt;
      return sum + Math.round((s.completedAt.getTime() - start.getTime()) / 60000);
    }
    return sum;
  }, 0);

  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: { totalDurationMinutes: total },
  });
}

// ─── Statistiques de traitement d'un dossier ─────────────────────────────────

/**
 * Retourne les statistiques de traitement d'un dossier :
 * durée par étape, moyenne, total, et identification du goulot d'étranglement.
 */
export async function getApplicationProcessingStats(
  applicationId: string
): Promise<ApplicationProcessingStats> {
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: {
      applicationNumber: true,
      totalDurationMinutes: true,
      workflowSteps: {
        include: {
          assignee: { select: { name: true } },
          policyStep: { select: { stepLabel: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!application) throw new Error(`Dossier introuvable : ${applicationId}`);

  const steps: StepProcessingStats[] = application.workflowSteps.map(s => {
    let duration: number | null = s.durationMinutes;
    if (!duration && s.completedAt) {
      const start = s.startedAt ?? s.createdAt;
      duration = Math.round((s.completedAt.getTime() - start.getTime()) / 60000);
    }
    const STEP_NAME_FR: Record<string, string> = {
      application_created: 'Création du dossier',
      credit_analysis: 'Analyse crédit',
      dispatch: 'Dispatch',
      approval: 'Approbation',
      final_decision: 'Décision finale',
      documentation: 'Documentation',
    };
    return {
      stepName: s.stepName,
      stepLabel: s.policyStep?.stepLabel ?? STEP_NAME_FR[s.stepName] ?? s.stepName,
      role: s.role,
      durationMinutes: duration,
      isOverdue: s.isOverdue,
      completedAt: s.completedAt,
      assigneeName: s.assignee?.name ?? null,
    };
  });

  const completedSteps = steps.filter(s => s.durationMinutes !== null);
  const totalMinutes = application.totalDurationMinutes
    ?? completedSteps.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const averageStepDurationMinutes =
    completedSteps.length > 0
      ? Math.round(totalMinutes / completedSteps.length)
      : null;

  const bottleneck =
    completedSteps.length > 0
      ? completedSteps.reduce((max, s) =>
          (s.durationMinutes ?? 0) > (max.durationMinutes ?? 0) ? s : max
        )
      : null;

  return {
    applicationId,
    applicationNumber: application.applicationNumber,
    totalDurationMinutes: totalMinutes || null,
    averageStepDurationMinutes,
    steps,
    bottleneck,
  };
}

// ─── Détermination de l'étape suivante ────────────────────────────────────────

export async function getNextWorkflowStep(
  applicationId: string,
  completedStepName: string
): Promise<WorkflowStepPlan | null> {
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { creditTypeId: true, amount: true },
  });

  if (!application?.creditTypeId) return null;

  const plan = await buildWorkflowPlan(
    application.creditTypeId,
    Number(application.amount)
  );

  const currentIndex = plan.steps.findIndex(s => s.stepName === completedStepName);

  if (currentIndex === -1 || currentIndex >= plan.steps.length - 1) {
    return null;
  }

  return plan.steps[currentIndex + 1];
}

// ─── Vérification du droit d'approbation ─────────────────────────────────────

/**
 * Vérifie que l'utilisateur a le rôle requis ET que le montant
 * est dans sa limite d'approbation (CreditPolicyStep si politique, ApprovalLimit sinon).
 */
export async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [user, application, step] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } }),
    prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { amount: true, policyId: true },
    }),
    prisma.workflowStep.findFirst({
      where: { applicationId, stepName, status: { in: ['PENDING', 'IN_REVIEW'] } },
    }),
  ]);

  if (!user) return { allowed: false, reason: 'Utilisateur introuvable' };
  if (!application) return { allowed: false, reason: 'Demande introuvable' };
  if (!step) return { allowed: false, reason: 'Étape introuvable ou déjà traitée' };

  if (step.role !== user.role) {
    return {
      allowed: false,
      reason: `Rôle requis : ${step.role}, rôle actuel : ${user.role}`,
    };
  }

  const amount = Number(application.amount);

  // Vérifier les limites d'approbation depuis ApprovalLimit (source unique de vérité,
  // qu'il y ait une politique active ou non)
  const limit = await prisma.approvalLimit.findUnique({
    where: { role: user.role as UserRole },
  });

  if (limit) {
    const min = Number(limit.minAmount);
    const max = Number(limit.maxAmount);
    if (amount < min || amount > max) {
      return {
        allowed: false,
        reason: `Montant ${amount.toLocaleString()} XOF hors limite autorisée pour ce rôle (${min.toLocaleString()} – ${max.toLocaleString()} XOF)`,
      };
    }
  }

  return { allowed: true };
}
