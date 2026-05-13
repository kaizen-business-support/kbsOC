/**
 * syncApprovalLimits.ts
 *
 * Source de vérité unique : les guards des CreditPolicyStep (APPROVAL / COMMITTEE).
 * À chaque activation d'une politique, on dérive (min_amount, max_amount) par
 * rôle utilisateur et on synchronise la table approval_limits.
 *
 * Évite les deadlocks où une étape était créée mais aucun approbateur n'avait
 * le plafond requis pour la traiter.
 */

import { Prisma, UserRole } from '@prisma/client';

/**
 * Mapping assignedRole (CreditPolicyStep.assignedRole — String libre côté
 * builder) → valeur d'enum UserRole utilisée par ApprovalLimit.
 * Le commentaire de droite rappelle la valeur @map en base.
 */
const ASSIGNED_ROLE_TO_USER_ROLE: Record<string, UserRole> = {
  DIR_AG:                  'DIR_AG'                  as UserRole, // dir_ag
  COMITE_CREDIT:           'COMITE_CREDIT'           as UserRole, // credit_committee
  DIRECTION_GENERALE:      'DIRECTION_GENERALE'      as UserRole, // management
  CHARGE_AFFAIRES:         'CHARGE_AFFAIRES'         as UserRole, // account_manager
  RESPONSABLE_ENGAGEMENTS: 'RESPONSABLE_ENGAGEMENTS' as UserRole, // branch_manager
  RESPONSABLE_RISQUES:     'RESPONSABLE_RISQUES'     as UserRole, // analyst_supervisor
  BACK_OFFICE:             'BACK_OFFICE'             as UserRole, // back_office
  DIRECTION_JURIDIQUE:     'DIRECTION_JURIDIQUE'     as UserRole, // direction_juridique
};

// Borne supérieure utilisée pour la dernière étape (pas d'étape suivante).
const MAX_LIMIT = 999_999_999_999;

// Valeurs par défaut utilisées uniquement à la CRÉATION d'une nouvelle ligne
// (le spec interdit de toucher ces colonnes pour une ligne existante).
const DEFAULT_REVIEW_DURATION = 1440; // 24h en minutes
const DEFAULT_ORDER = 1;

interface MinimalPolicyStep {
  id: string;
  order: number;
  stepType: string;
  assignedRole: string;
  guards: Prisma.JsonValue | null;
}

/**
 * Extrait la valeur du guard { field: "amount", operator: "GTE" }.
 * Retourne 0 si aucun guard GTE amount n'est défini.
 */
function extractGteAmount(guards: Prisma.JsonValue | null): number {
  if (!guards || typeof guards !== 'object' || Array.isArray(guards)) return 0;
  const conditions = (guards as any).conditions;
  if (!Array.isArray(conditions)) return 0;
  const cond = conditions.find(
    (c: any) => c?.field === 'amount' && c?.operator === 'GTE'
  );
  if (!cond) return 0;
  const v = Number(cond.value);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Synchronise approval_limits depuis les étapes APPROVAL / COMMITTEE
 * de la politique passée en argument.
 *
 * - Doit être appelée à l'intérieur d'une transaction Prisma.
 * - N'écrit dans audit_logs que si min/max changent réellement
 *   (ou pour une nouvelle ligne créée).
 */
export async function syncApprovalLimitsFromPolicy(
  tx: Prisma.TransactionClient,
  steps: MinimalPolicyStep[],
  companyId: string,
  userId: string,
): Promise<void> {
  // 1. Étapes décisionnelles, triées par order croissant.
  const approvalSteps = steps
    .filter(s => s.stepType === 'APPROVAL' || s.stepType === 'COMMITTEE')
    .sort((a, b) => a.order - b.order);

  if (approvalSteps.length === 0) return;

  // 2. Dériver (role, minAmount, maxAmount) pour chaque étape.
  type Derived = { role: UserRole; minAmount: number; maxAmount: number };
  const derived: Derived[] = [];

  for (let i = 0; i < approvalSteps.length; i++) {
    const step = approvalSteps[i];
    const role = ASSIGNED_ROLE_TO_USER_ROLE[step.assignedRole];
    if (!role) {
      console.warn(
        `[syncApprovalLimits] assignedRole "${step.assignedRole}" non mappé — étape ignorée (policyStepId=${step.id})`
      );
      continue;
    }

    const minAmount = extractGteAmount(step.guards);
    const nextStep  = approvalSteps[i + 1];
    const maxAmount = nextStep
      ? Math.max(extractGteAmount(nextStep.guards) - 1, minAmount)
      : MAX_LIMIT;

    derived.push({ role, minAmount, maxAmount });
  }

  // 3. Upsert + audit log par ligne effectivement modifiée.
  for (const d of derived) {
    const existing = await tx.approvalLimit.findUnique({
      where: { companyId_role: { companyId, role: d.role } },
      select: { id: true, minAmount: true, maxAmount: true },
    });

    const upserted = await tx.approvalLimit.upsert({
      where: { companyId_role: { companyId, role: d.role } },
      update: {
        minAmount: d.minAmount,
        maxAmount: d.maxAmount,
      },
      create: {
        role: d.role,
        companyId,
        minAmount: d.minAmount,
        maxAmount: d.maxAmount,
        displayName: d.role,
        reviewDuration: DEFAULT_REVIEW_DURATION,
        order: DEFAULT_ORDER,
      },
    });

    const oldMin = existing ? Number(existing.minAmount) : null;
    const oldMax = existing ? Number(existing.maxAmount) : null;
    const changed = !existing || oldMin !== d.minAmount || oldMax !== d.maxAmount;

    if (!changed) continue;

    await tx.auditLog.create({
      data: {
        userId,
        applicationId: null,
        action: 'APPROVAL_LIMIT_SYNC',
        entityType: 'approval_limit',
        entityId: upserted.id,
        oldValues: existing
          ? { min_amount: oldMin, max_amount: oldMax }
          : Prisma.JsonNull,
        newValues: { min_amount: d.minAmount, max_amount: d.maxAmount },
      },
    });
  }
}
