/**
 * workflowService.ts
 *
 * Service central de construction dynamique du workflow.
 * Toute la logique d'approbation est dérivée de la base de données —
 * aucune règle n'est codée en dur dans ce fichier ni ailleurs.
 *
 * Principe :
 *  - Les étapes viennent exclusivement de CreditPolicyStep (politique active).
 *  - Si aucune politique n'est active, buildWorkflowPlan lève une erreur explicite.
 *  - Les dossiers créés avant l'introduction des politiques (policyId null)
 *    continuent d'avancer via leurs étapes existantes en base (getNextWorkflowStep).
 */

import { UserRole, PolicyStepType, PolicyStatus } from '@prisma/client';
import { prisma } from '../prismaClient';
import { STEP_NAME_FR } from '../constants/stepNames';
import { resolveDelegation } from './delegationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStepPlan {
  order: number;
  stepName: string;
  stepLabel: string;
  role: string;
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
  role: string;
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
  creditTypeId: string,
  companyId?: string
): Promise<{ id: string; name: string; code: string } | null> {
  const now = new Date();

  const policy = await prisma.creditPolicy.findFirst({
    where: {
      status: PolicyStatus.ACTIVE,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
      ...(companyId ? { companyId } : {}),
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

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Construit le plan de workflow pour une demande de crédit depuis la CreditPolicy active.
 * Lève une erreur explicite si aucune politique n'est active ou si aucune étape
 * n'est applicable pour ce montant/type de crédit.
 */
export async function buildWorkflowPlan(
  creditTypeId: string,
  amount: number,
  companyId?: string
): Promise<WorkflowPlan> {
  const creditType = await prisma.creditType.findUnique({
    where: { id: creditTypeId },
    select: { id: true, name: true, code: true },
  });

  if (!creditType) {
    throw new Error(`Type de crédit introuvable : ${creditTypeId}`);
  }

  const policy = await getActivePolicyForCreditType(creditTypeId, companyId);

  if (!policy) {
    throw new Error(
      'Aucune politique de crédit active. Veuillez activer une politique via le constructeur de workflows avant de soumettre un dossier.'
    );
  }

  const rawAll = await prisma.creditPolicyStep.findMany({
    where: { policyId: policy.id, isActive: true },
    orderBy: { order: 'asc' },
  });

  const allSteps: WorkflowStepPlan[] = rawAll.map(s => ({
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

  const steps = await buildPlanFromPolicy(policy.id, creditTypeId, amount);

  if (steps.length === 0) {
    throw new Error(
      `La politique "${policy.name}" ne contient aucune étape applicable pour ce montant ou ce type de crédit. Vérifiez les conditions configurées.`
    );
  }

  const estimatedDurationDays = steps.reduce((sum, s) => sum + s.durationDays, 0);

  return {
    creditTypeId: creditType.id,
    creditTypeName: creditType.name,
    creditTypeCode: creditType.code,
    amount,
    policyId: policy.id,
    policyName: policy.name,
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
  // Charger le companyId de l'application pour le filtrage tenant
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { companyId: true },
  });
  const plan = await buildWorkflowPlan(creditTypeId, amount, app?.companyId ?? undefined);

  // Supprimer uniquement les étapes legacy (sans policyStepId) non-commencées.
  // Les étapes de politique déjà créées (policyStepId non-null) sont préservées
  // pour éviter de casser les étapes en attente de démarrage.
  await prisma.workflowStep.deleteMany({
    where: {
      applicationId,
      status: 'PENDING',
      assigneeId: null,
      policyStepId: null,
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
  // et la lier au CreditPolicyStep correspondant pour que la timeline CODIR puisse la retrouver.
  const creationPolicyStep = plan.steps.find(s => s.stepName === 'application_created');
  const hasCreationStep = await prisma.workflowStep.findFirst({
    where: { applicationId, stepName: 'application_created' },
  });

  if (!hasCreationStep) {
    await prisma.workflowStep.create({
      data: {
        applicationId,
        stepName: 'application_created',
        role: 'CHARGE_AFFAIRES',
        status: 'COMPLETED',
        completedAt: new Date(),
        deadline: new Date(),
        comments: 'Dossier créé',
        policyStepId: creationPolicyStep?.policyStepId ?? undefined,
      },
    });
  } else if (creationPolicyStep?.policyStepId && !hasCreationStep.policyStepId) {
    // Rétrospectivement lier l'étape existante à la politique (dossiers créés avant la politique)
    await prisma.workflowStep.update({
      where: { id: hasCreationStep.id },
      data: { policyStepId: creationPolicyStep.policyStepId },
    });
  }

  // Créer les étapes du plan en PENDING.
  // Exclure 'application_created' (toujours COMPLETED dès la soumission).
  // Ne pas recréer une étape si elle existe déjà (même policyStepId ou même stepName en cours).
  for (const step of plan.steps.filter(s => s.stepName !== 'application_created')) {
    const existing = step.policyStepId
      ? await prisma.workflowStep.findFirst({
          where: { applicationId, policyStepId: step.policyStepId },
        })
      : await prisma.workflowStep.findFirst({
          where: { applicationId, stepName: step.stepName, status: { in: ['PENDING', 'IN_REVIEW'] } },
        });
    if (existing) continue;

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
    let duration: number | null = null;
    if (s.durationMinutes != null && s.durationMinutes > 0) {
      duration = s.durationMinutes;
    } else if (s.completedAt) {
      const start = s.startedAt ?? s.createdAt;
      const computed = Math.round((s.completedAt.getTime() - start.getTime()) / 60000);
      if (computed > 0) duration = computed;
    }
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
    select: { creditTypeId: true, amount: true, companyId: true, policyId: true },
  });

  if (!application?.creditTypeId) return null;

  // ── Workflow moderne (policyId renseigné) ─────────────────────────────────
  // Le plan est construit depuis la politique active — les noms d'étapes correspondent.
  if (application.policyId) {
    // Trouver le WorkflowStep DB qui vient d'être complété (policyStepId portant l'order)
    const completedDbStep = await prisma.workflowStep.findFirst({
      where: {
        applicationId,
        stepName: completedStepName,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: { policyStepId: true },
    });

    const plan = await buildWorkflowPlan(
      application.creditTypeId,
      Number(application.amount),
      application.companyId ?? undefined
    );

    if (completedDbStep?.policyStepId) {
      // Obtenir l'order de l'étape complétée
      const completedPolicyStep = await prisma.creditPolicyStep.findUnique({
        where: { id: completedDbStep.policyStepId },
        select: { order: true },
      });
      if (completedPolicyStep) {
        // Trouver la prochaine étape applicable par order croissant
        const next = plan.steps.find(s => s.order > completedPolicyStep.order);
        return next ?? null;
      }
    }

    // Fallback: recherche par stepName (étapes sans policyStepId)
    const currentIndex = plan.steps.findIndex(s => s.stepName === completedStepName);
    if (currentIndex === -1 || currentIndex >= plan.steps.length - 1) return null;
    return plan.steps[currentIndex + 1];
  }

  // ── Dossiers antérieurs à l'introduction des politiques (policyId null) ────
  // Ces dossiers ont leurs WorkflowStep créés en DB — on avance en lisant
  // leur ordre de création. CreditTypeWorkflowStep n'est plus consulté.
  const dbSteps = await prisma.workflowStep.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
  const currentIdx = dbSteps.findIndex(s => s.stepName === completedStepName);
  if (currentIdx === -1 || currentIdx >= dbSteps.length - 1) return null;

  const next = dbSteps[currentIdx + 1];
  return {
    order: currentIdx + 1,
    stepName: next.stepName,
    stepLabel: STEP_NAME_FR[next.stepName] ?? next.stepName,
    role: next.role,
    stepType: undefined,
    durationDays: 7,
    expectedDurationHours: 168,
    maxDurationHours: 336,
    isConditional: false,
    conditionMinAmount: null,
    conditionMaxAmount: null,
    approvalMinAmount: null,
    approvalMaxAmount: null,
    policyStepId: null,
  };
}

// ─── Vérification du droit d'approbation ─────────────────────────────────────

/**
 * Vérifie que l'utilisateur a le rôle requis ET que le montant
 * est dans sa limite d'approbation (CreditPolicyStep si politique, ApprovalLimit sinon).
 */
// Rôles à portée globale : peuvent traiter les dossiers de toutes les agences.
// Seul CHARGE_AFFAIRES est lié à son agence (il gère ses propres clients).
// Tous les autres rôles sont des services centraux (risques, engagements, BO, juridique, etc.)
const GLOBAL_SCOPE_ROLES: UserRole[] = [
  'DIRECTION_GENERALE',
  'ADMIN',
  'COMITE_CREDIT',
  'ANALYSTE_RISQUES',
  'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS',
  'DIRECTION_JURIDIQUE',
  'BACK_OFFICE',
];

export type StepAction = 'approve' | 'reject' | 'request_info' | 'transfer';

export async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string,
  action: StepAction = 'approve',
  stepId?: string,
): Promise<{
  allowed: boolean;
  reason?: string;
  delegationContext?: { delegationId: string; delegatorId: string; delegatorName: string } | null;
}> {
  const [user, application, step] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, branch: true, department: true },
    }),
    prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: {
        companyId: true,
        amount: true,
        policyId: true,
        creator: { select: { branch: true, department: true, name: true } },
      },
    }),
    stepId
      ? prisma.workflowStep.findUnique({ where: { id: stepId } })
      : prisma.workflowStep.findFirst({
          where: { applicationId, stepName, status: { in: ['PENDING', 'IN_REVIEW'] } },
          orderBy: { createdAt: 'desc' },
        }),
  ]);

  if (!user) return { allowed: false, reason: 'Utilisateur introuvable' };
  if (!application) return { allowed: false, reason: 'Demande introuvable' };
  if (!step) return { allowed: false, reason: 'Étape introuvable ou déjà traitée' };

  // ── 0. Vérification de l'ordre séquentiel ────────────────────────────────────
  // Toutes les étapes ayant un ordre inférieur doivent être complétées avant
  // qu'on puisse traiter l'étape courante. Deux cas : politique moderne (policyStepId)
  // et dossiers legacy (sans policyStepId, ordre déterminé par createdAt).
  if (step.policyStepId) {
    const currentPolicyStep = await prisma.creditPolicyStep.findUnique({
      where: { id: step.policyStepId },
      select: { order: true, stepLabel: true },
    });
    if (currentPolicyStep) {
      const blocker = await prisma.workflowStep.findFirst({
        where: {
          applicationId,
          completedAt: null,
          id: { not: step.id },
          policyStep: { order: { lt: currentPolicyStep.order } },
        },
        include: { policyStep: { select: { stepLabel: true, order: true } } },
        orderBy: { policyStep: { order: 'asc' } },
      });
      if (blocker) {
        const blockerLabel = (blocker as any).policyStep?.stepLabel ?? blocker.stepName;
        const blockerOrder = (blocker as any).policyStep?.order ?? '?';
        return {
          allowed: false,
          reason: `Étape bloquée : "${blockerLabel}" (étape ${blockerOrder}) doit être complétée en premier. Le circuit doit être respecté dans l'ordre défini par la politique de crédit.`,
        };
      }
    }
  } else {
    // Dossiers legacy (sans policyStepId) : ordre séquentiel par createdAt
    const legacyBlocker = await prisma.workflowStep.findFirst({
      where: {
        applicationId,
        completedAt: null,
        id: { not: step.id },
        policyStepId: null,
        createdAt: { lt: step.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (legacyBlocker) {
      return {
        allowed: false,
        reason: `Étape bloquée : "${legacyBlocker.stepName}" doit être complétée en premier. Le circuit doit être respecté dans l'ordre d'instruction.`,
      };
    }
  }

  // ── 1. Chinese Wall check (BCEAO non-cumul — hard block before any other check) ──
  // Les règles sont stockées par tenant dans TenantChineseWallRule (plus de dict hardcodé).
  if (!application.companyId) {
    return { allowed: false, reason: 'Application non liée à un tenant — approbation impossible' };
  }
  const wallRules = await prisma.tenantChineseWallRule.findMany({
    where: { companyId: application.companyId, blockedRole: user.role as UserRole, isActive: true },
    select: { forbiddenStep: true, reason: true },
  });
  const blocked = wallRules.find((r) => r.forbiddenStep === stepName);
  if (blocked) return { allowed: false, reason: blocked.reason ?? 'Mur chinois : opération non autorisée pour ce rôle' };

  // ── 2. Non-cumul analyse / contre-analyse (même personne physique) ────────
  // Seuls les ANALYSTE_RISQUES sont soumis au principe de séparation : l'analyste
  // qui a fait l'analyse initiale ne peut pas faire la contre-analyse.
  const ANALYST_ROLES = ['ANALYSTE_RISQUES'];
  if (step.policyStepId && ANALYST_ROLES.includes(user.role as string)) {
    const currentStepType = await prisma.creditPolicyStep.findUnique({
      where: { id: step.policyStepId },
      select: { stepType: true },
    });
    if (currentStepType?.stepType === 'ANALYSIS') {
      const priorAnalysis = await prisma.workflowStep.findFirst({
        where: {
          applicationId,
          assigneeId: userId,
          completedAt: { not: null },
          id: { not: step.id },
          policyStep: { stepType: 'ANALYSIS' },
        },
      });
      if (priorAnalysis) {
        return {
          allowed: false,
          reason: "Non-cumul des analyses : vous avez déjà traité une étape d'analyse sur ce dossier. Un autre analyste doit effectuer cette contre-analyse.",
        };
      }
    }
  }

  // ── 3. Vérification du rôle (direct ou par délégation) ────────────────────
  let effectiveRole   = user.role as UserRole;
  let effectiveBranch = (user as any).branch as string | null;
  let effectiveDept   = (user as any).department as string | null;
  let delegationContext: { delegationId: string; delegatorId: string; delegatorName: string } | null = null;

  if (step.role !== user.role) {
    // Rôle direct insuffisant — vérifier si une délégation couvre APPROVE_WORKFLOW
    const delegation = await resolveDelegation(userId, 'APPROVE_WORKFLOW');
    if (!delegation || delegation.delegatorRole !== step.role) {
      return {
        allowed: false,
        reason: `Rôle requis : ${step.role}, rôle actuel : ${user.role}`,
      };
    }
    // Utiliser le contexte du délégant pour la suite des vérifications
    effectiveRole   = delegation.delegatorRole;
    effectiveBranch = delegation.delegatorBranch;
    effectiveDept   = delegation.delegatorDepartment;
    delegationContext = {
      delegationId:  delegation.delegationId,
      delegatorId:   delegation.delegatorId,
      delegatorName: delegation.delegatorName,
    };
  }

  // ── 4. Vérification de l'agence (basée sur le délégant si délégation) ─────
  // Les rôles globaux (DG, Admin, Comité) ont une portée transversale.
  // Exceptions supplémentaires :
  //  - utilisateur explicitement assigné à cette étape (via dispatching)
  //  - utilisateur rattaché au Siège Social (portée multi-agences par nature)
  if (!GLOBAL_SCOPE_ROLES.includes(effectiveRole)) {
    const approverBranch = effectiveBranch || effectiveDept;
    const creatorBranch  = application.creator?.branch || application.creator?.department;
    const isExplicitlyAssigned = step.assigneeId === userId;
    const isHeadOffice = !!approverBranch && /si[eè]ge/i.test(approverBranch);

    if (!isExplicitlyAssigned && !isHeadOffice && approverBranch && creatorBranch && approverBranch !== creatorBranch) {
      return {
        allowed: false,
        reason: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez traiter que les dossiers de votre agence ("${approverBranch}").`,
      };
    }
  }

  // ── 5. Vérification du plafond d'approbation ───────────────────────────────
  // Le plafond ne s'applique qu'aux étapes décisionnelles de la politique moderne
  // (stepType APPROVAL ou COMMITTEE, avec policyStepId renseigné).
  // Les étapes legacy (sans policyStepId) ignorent ce check : elles ont été
  // créées par l'ancien circuit qui routait par rôle, pas par montant.
  const DECISION_STEP_TYPES: string[] = ['APPROVAL', 'COMMITTEE'];

  let stepType: string | null = null;
  if (step.policyStepId) {
    const policyStep = await prisma.creditPolicyStep.findUnique({
      where: { id: step.policyStepId },
      select: { stepType: true },
    });
    stepType = policyStep?.stepType ?? null;
  }

  // Étapes legacy (pas de policyStepId) → pas de check montant
  const isDecisionStep = !!step.policyStepId && (!stepType || DECISION_STEP_TYPES.includes(stepType));

  if (isDecisionStep) {
    const amount = Number(application.amount);
    const limit = await prisma.approvalLimit.findFirst({
      where: { role: effectiveRole, companyId: application.companyId },
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
  }

  // ── 4. Vérification des actions autorisées sur l'étape de politique ──────────
  if (step.policyStepId) {
    const policyStepForActions = await prisma.creditPolicyStep.findUnique({
      where: { id: step.policyStepId },
      select: { allowedActions: true },
    });
    if (policyStepForActions && policyStepForActions.allowedActions.length > 0) {
      if (!policyStepForActions.allowedActions.includes(action)) {
        return {
          allowed: false,
          reason: `L'action "${action}" n'est pas autorisée sur cette étape`,
        };
      }
    }
  }

  return { allowed: true, delegationContext };
}
