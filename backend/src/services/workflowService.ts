/**
 * workflowService.ts
 *
 * Service central de construction dynamique du workflow.
 * Toute la logique d'approbation est dérivée de la base de données —
 * aucune règle n'est codée en dur dans ce fichier ni ailleurs.
 *
 * Principe (Option C) :
 *  - Le type de crédit définit les étapes possibles, dans l'ordre.
 *  - Chaque étape peut avoir une condition sur le montant (conditionMinAmount / conditionMaxAmount).
 *  - Si une étape n'a pas de condition → elle est toujours obligatoire.
 *  - Si une condition est présente → l'étape est incluse seulement si le montant la satisfait.
 *  - Les limites d'approbation (ApprovalLimit) fournissent les tranches de référence
 *    que l'administrateur peut utiliser pour paramétrer ces conditions depuis l'UI.
 */

import { UserRole } from '@prisma/client';
import { prisma } from '../prismaClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStepPlan {
  order: number;
  stepName: string;
  stepLabel: string;
  role: UserRole;
  durationDays: number;
  isConditional: boolean;         // true si l'étape avait une condition montant
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
}

export interface WorkflowPlan {
  creditTypeId: string;
  creditTypeName: string;
  creditTypeCode: string;
  amount: number;
  steps: WorkflowStepPlan[];      // Étapes filtrées et ordonnées pour ce dossier
  allSteps: WorkflowStepPlan[];   // Toutes les étapes configurées (pour affichage UI)
  estimatedDurationDays: number;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Construit le plan de workflow dynamique pour une demande de crédit.
 *
 * @param creditTypeId  ID du type de crédit
 * @param amount        Montant de la demande (en XOF)
 * @returns             WorkflowPlan avec les étapes applicables
 */
export async function buildWorkflowPlan(
  creditTypeId: string,
  amount: number
): Promise<WorkflowPlan> {
  // 1. Charger le type de crédit avec toutes ses étapes configurées
  const creditType = await prisma.creditType.findUnique({
    where: { id: creditTypeId },
    include: {
      workflowSteps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!creditType) {
    throw new Error(`Type de crédit introuvable : ${creditTypeId}`);
  }

  // 2. Construire la liste complète (pour affichage dans l'UI)
  const allSteps: WorkflowStepPlan[] = creditType.workflowSteps.map(s => ({
    order: s.order,
    stepName: s.stepName,
    stepLabel: s.stepLabel,
    role: s.role,
    durationDays: s.durationDays,
    isConditional: s.conditionMinAmount !== null || s.conditionMaxAmount !== null,
    conditionMinAmount: s.conditionMinAmount ? Number(s.conditionMinAmount) : null,
    conditionMaxAmount: s.conditionMaxAmount ? Number(s.conditionMaxAmount) : null,
  }));

  // 3. Filtrer les étapes applicables selon le montant
  const steps: WorkflowStepPlan[] = allSteps.filter(step => {
    // Pas de condition → toujours obligatoire
    if (!step.isConditional) return true;

    // Vérifier conditionMinAmount
    if (step.conditionMinAmount !== null && amount < step.conditionMinAmount) {
      return false;
    }

    // Vérifier conditionMaxAmount
    if (step.conditionMaxAmount !== null && amount > step.conditionMaxAmount) {
      return false;
    }

    return true;
  });

  // 4. Calculer la durée estimée totale
  const estimatedDurationDays = steps.reduce((sum, s) => sum + s.durationDays, 0);

  return {
    creditTypeId: creditType.id,
    creditTypeName: creditType.name,
    creditTypeCode: creditType.code,
    amount,
    steps,
    allSteps,
    estimatedDurationDays,
  };
}

// ─── Création effective des WorkflowStep en base ──────────────────────────────

/**
 * Crée les WorkflowStep en base pour une application donnée,
 * en se basant sur le plan dynamique.
 *
 * @param applicationId   ID de la demande
 * @param creditTypeId    ID du type de crédit
 * @param amount          Montant de la demande
 */
export async function createWorkflowStepsForApplication(
  applicationId: string,
  creditTypeId: string,
  amount: number
): Promise<void> {
  const plan = await buildWorkflowPlan(creditTypeId, amount);

  // Supprimer les étapes existantes non-commencées avant de recréer
  // (utile si le type ou le montant change avant soumission)
  await prisma.workflowStep.deleteMany({
    where: {
      applicationId,
      status: 'PENDING',
      assigneeId: null,
    },
  });

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
        deadline: new Date(),
        comments: 'Dossier créé',
      },
    });
  }

  // Créer les étapes du plan (en commençant par credit_analysis en PENDING)
  for (const step of plan.steps) {
    // L'étape analyste est créée en PENDING, les suivantes aussi
    // Elles seront activées une par une lors des approbations
    await prisma.workflowStep.create({
      data: {
        applicationId,
        stepName: step.stepName,
        role: step.role as UserRole,
        status: 'PENDING',
        deadline: new Date(Date.now() + step.durationDays * 24 * 60 * 60 * 1000),
        comments: null,
        assigneeId: null,
      },
    });
  }
}

// ─── Détermination de l'étape suivante ────────────────────────────────────────

/**
 * Après approbation d'une étape, retourne l'étape suivante applicable.
 * Interroge la base — aucune logique hard-codée.
 *
 * @param applicationId   ID de la demande
 * @param completedStep   Nom de l'étape qui vient d'être complétée
 * @returns               Étape suivante (WorkflowStepPlan) ou null si c'est la dernière
 */
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

  // Trouver l'index de l'étape complétée dans le plan
  const currentIndex = plan.steps.findIndex(s => s.stepName === completedStepName);

  if (currentIndex === -1 || currentIndex >= plan.steps.length - 1) {
    return null; // Dernière étape ou non trouvée
  }

  return plan.steps[currentIndex + 1];
}

// ─── Vérification que l'approbateur a le droit d'approuver ───────────────────

/**
 * Vérifie que l'utilisateur a le rôle requis ET que le montant
 * est dans sa limite d'approbation autorisée.
 *
 * @param userId        ID de l'utilisateur qui approuve
 * @param applicationId ID de la demande
 * @param stepName      Nom de l'étape à approuver
 * @returns             { allowed: boolean, reason?: string }
 */
export async function canApproveStep(
  userId: string,
  applicationId: string,
  stepName: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [user, application, step] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } }),
    prisma.creditApplication.findUnique({ where: { id: applicationId }, select: { amount: true } }),
    prisma.workflowStep.findFirst({ where: { applicationId, stepName, status: { in: ['PENDING', 'IN_REVIEW'] } } }),
  ]);

  if (!user) return { allowed: false, reason: 'Utilisateur introuvable' };
  if (!application) return { allowed: false, reason: 'Demande introuvable' };
  if (!step) return { allowed: false, reason: 'Étape introuvable ou déjà traitée' };

  // Vérifier que le rôle de l'utilisateur correspond à l'étape
  if (step.role !== user.role) {
    return {
      allowed: false,
      reason: `Rôle requis : ${step.role}, rôle actuel : ${user.role}`,
    };
  }

  // Vérifier que le montant est dans la limite d'approbation du rôle
  const limit = await prisma.approvalLimit.findUnique({
    where: { role: user.role as UserRole },
  });

  if (limit) {
    const amount = Number(application.amount);
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
