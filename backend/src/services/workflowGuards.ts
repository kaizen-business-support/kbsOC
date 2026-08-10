/**
 * workflowGuards.ts
 *
 * Règles transverses du circuit d'approbation, écrites une seule fois.
 *
 * Deux d'entre elles existaient jusqu'ici en plusieurs exemplaires divergents :
 *
 *  - L'ORDRE SÉQUENTIEL (« aucune étape d'ordre N tant qu'une étape d'ordre < N
 *    est incomplète ») était dupliqué entre canApproveStep §0 et la liste
 *    /workflows/pending-approvals — et absent du dispatching, qui pouvait donc
 *    créer les incohérences que canApproveStep bloquait ensuite.
 *
 *  - La PORTÉE D'AGENCE existait en deux versions incompatibles : canApproveStep §4
 *    (GLOBAL_SCOPE_ROLES, comparaison `branch || department`) et le garde local du
 *    dispatching (trois rôles globaux seulement). Le dispatching ne l'appliquait
 *    d'ailleurs qu'au dispatcheur, jamais à la personne affectée.
 *
 * Les fonctions sont pures : elles travaillent sur des étapes déjà chargées, ce qui
 * les rend testables sans base de données et évite de multiplier les allers-retours
 * Prisma dans les boucles d'appel.
 */
import { canonicalRole } from '../utils/roleAliases';

/** Étape de workflow telle qu'attendue par les gardes. */
export interface GuardStep {
  id: string;
  stepName: string;
  role: string;
  status: string;
  completedAt: Date | null;
  assigneeId: string | null;
  createdAt: Date;
  policyStep?: { order: number; stepLabel?: string | null; stepType?: string | null } | null;
}

/** Acteur soumis au contrôle de portée. */
export interface ScopedActor {
  role: string;
  branch?: string | null;
  department?: string | null;
}

/**
 * Rôles à portée transversale : services centraux, ils traitent les dossiers de
 * toutes les agences. Identique à GLOBAL_SCOPE_ROLES de workflowService — seul
 * CHARGE_AFFAIRES (et ASSISTANT_COMMERCIAL) est rattaché à son agence.
 */
export const GLOBAL_SCOPE_ROLES: readonly string[] = [
  'DIRECTION_GENERALE',
  'ADMIN',
  'SUPER_ADMIN',
  'COMITE_CREDIT',
  'ANALYSTE_RISQUES',
  'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS',
  'DIRECTION_JURIDIQUE',
  'BACK_OFFICE',
];

/**
 * Convertit une WorkflowStep Prisma (chargée avec sa relation policyStep) en
 * GuardStep. Centralisé ici pour que tous les appelants exposent exactement les
 * mêmes champs aux gardes.
 */
export function toGuardStep(step: {
  id: string;
  stepName: string;
  role: string;
  status: unknown;
  completedAt: Date | null;
  assigneeId: string | null;
  createdAt: Date;
  policyStep?: { order: number; stepLabel?: string | null; stepType?: string | null } | null;
}): GuardStep {
  return {
    id: step.id,
    stepName: step.stepName,
    role: step.role,
    status: String(step.status),
    completedAt: step.completedAt,
    assigneeId: step.assigneeId,
    createdAt: step.createdAt,
    policyStep: step.policyStep ?? null,
  };
}

// ─── Ordre des étapes ─────────────────────────────────────────────────────────

/** Une étape est-elle encore à traiter ? */
export function isOpen(step: GuardStep): boolean {
  return step.completedAt === null;
}

/**
 * Ordre d'une étape dans le circuit. Les étapes de politique portent un `order`
 * explicite ; les étapes legacy n'en ont pas et sont ordonnées par createdAt.
 */
export function stepOrder(step: GuardStep): number | null {
  return step.policyStep?.order ?? null;
}

// ─── Garde 1 : ordre séquentiel ───────────────────────────────────────────────

/**
 * Première étape d'ordre inférieur encore incomplète, qui interdit de traiter
 * `step`. Reprend à l'identique la règle de canApproveStep §0 :
 *
 *  - étape de politique → comparaison sur `policyStep.order` ;
 *  - étape legacy (sans policyStep) → comparaison sur `createdAt`, et uniquement
 *    contre d'autres étapes legacy.
 *
 * Retourne null si rien ne bloque.
 */
export function findSequentialBlocker(steps: GuardStep[], step: GuardStep): GuardStep | null {
  const currentOrder = stepOrder(step);

  if (currentOrder !== null) {
    const blockers = steps
      .filter(s => s.id !== step.id && isOpen(s))
      .filter(s => {
        const o = stepOrder(s);
        return o !== null && o < currentOrder;
      })
      .sort((a, b) => (stepOrder(a) as number) - (stepOrder(b) as number));
    return blockers[0] ?? null;
  }

  // Dossiers antérieurs aux politiques : ordre d'instruction = ordre de création.
  const legacyBlockers = steps
    .filter(s => s.id !== step.id && isOpen(s) && stepOrder(s) === null)
    .filter(s => s.createdAt.getTime() < step.createdAt.getTime())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return legacyBlockers[0] ?? null;
}

/** Message utilisateur associé à un blocage séquentiel, dans le style existant. */
export function sequentialBlockReason(blocker: GuardStep): string {
  const order = stepOrder(blocker);
  const label = blocker.policyStep?.stepLabel ?? blocker.stepName;
  return order !== null
    ? `Étape bloquée : "${label}" (étape ${order}) doit être complétée en premier. Le circuit doit être respecté dans l'ordre défini par la politique de crédit.`
    : `Étape bloquée : "${label}" doit être complétée en premier. Le circuit doit être respecté dans l'ordre d'instruction.`;
}

export interface OrderInconsistency {
  applicationNumber: string;
  completedStep: string;
  completedOrder: number | null;
  blockingStep: string;
  blockingOrder: number | null;
}

/**
 * Étapes complétées alors qu'une étape d'ordre inférieur ne l'est pas — la trace
 * laissée par un dispatching qui a sauté des étapes. C'est la contrepartie en
 * code de la requête de contrôle attendue sur la base.
 */
export function findOrderInconsistencies(
  applicationNumber: string,
  steps: GuardStep[],
): OrderInconsistency[] {
  const found: OrderInconsistency[] = [];
  for (const step of steps) {
    if (step.completedAt === null) continue;
    const blocker = findSequentialBlocker(steps, step);
    if (!blocker) continue;
    found.push({
      applicationNumber,
      completedStep: step.policyStep?.stepLabel ?? step.stepName,
      completedOrder: stepOrder(step),
      blockingStep: blocker.policyStep?.stepLabel ?? blocker.stepName,
      blockingOrder: stepOrder(blocker),
    });
  }
  return found;
}

// ─── Garde 2 : portée d'agence ────────────────────────────────────────────────

/**
 * L'acteur peut-il intervenir sur un dossier créé dans l'agence `creatorBranch` ?
 *
 * Règle unique, reprise de canApproveStep §4 :
 *  - rôle transversal          → toujours autorisé ;
 *  - rattachement au Siège     → toujours autorisé (portée multi-agences) ;
 *  - rattachement inexploitable→ voir `requireAttachment` ;
 *  - sinon                     → `branch || department` doit correspondre.
 *
 * `requireAttachment` durcit la règle pour le dispatching : un compte sans agence
 * ni département exploitable ne doit pas pouvoir recevoir un dossier d'agence.
 * canApproveStep, lui, laisse passer (le champ manquant n'y est pas discriminant),
 * et ce comportement historique est conservé par défaut.
 */
export function checkBranchScope(
  actor: ScopedActor,
  creatorBranch: string | null | undefined,
  options: { requireAttachment?: boolean } = {},
): { allowed: boolean; reason?: string } {
  if (GLOBAL_SCOPE_ROLES.includes(canonicalRole(actor.role))) {
    return { allowed: true };
  }

  const actorBranch = actor.branch || actor.department || null;

  if (actorBranch && isHeadOffice(actorBranch)) {
    return { allowed: true };
  }

  if (!actorBranch) {
    if (options.requireAttachment) {
      return {
        allowed: false,
        reason: "Ce compte n'est rattaché à aucune agence ni département : il ne peut pas recevoir de dossier.",
      };
    }
    return { allowed: true };
  }

  if (creatorBranch && actorBranch !== creatorBranch) {
    return {
      allowed: false,
      reason: `Ce dossier appartient à l'agence "${creatorBranch}". Seuls les profils de cette agence peuvent le traiter (ce compte dépend de "${actorBranch}").`,
    };
  }

  return { allowed: true };
}

/** Le Siège Social a par nature une portée multi-agences. */
export function isHeadOffice(branch: string): boolean {
  return /si[eè]ge/i.test(branch);
}

// ─── Garde 3 : cible d'une affectation ────────────────────────────────────────

/**
 * Étape que le dispatching doit affecter, pour un DISPATCH donné.
 *
 * C'est la première étape non-DISPATCH d'ordre STRICTEMENT SUPÉRIEUR à celui du
 * DISPATCH traité. Prendre « la première étape PENDING du dossier » — ce que
 * faisait l'ancien code — faisait consommer par une affectation une étape située
 * avant le DISPATCH courant, ou sauter des étapes d'analyse intermédiaires.
 *
 * En ré-affectation, on accepte aussi les étapes déjà assignées (PENDING ou
 * IN_REVIEW) ; en affectation initiale, seules les étapes PENDING sans assigné.
 */
export function pickAssignmentTarget(
  steps: GuardStep[],
  dispatchStep: GuardStep | null,
  options: { isReassign?: boolean } = {},
): GuardStep | null {
  // Ré-affectation : aucun DISPATCH n'est traité, donc aucune borne d'ordre.
  const dispatchOrder = dispatchStep ? stepOrder(dispatchStep) : null;

  const eligible = steps
    .filter(s => s.id !== dispatchStep?.id)
    .filter(s => (s.policyStep?.stepType ?? null) !== 'DISPATCH')
    .filter(s => isOpen(s))
    .filter(s =>
      options.isReassign
        ? ['PENDING', 'IN_REVIEW'].includes(s.status.toUpperCase())
        : s.status.toUpperCase() === 'PENDING' && !s.assigneeId,
    )
    .filter(s => {
      if (dispatchOrder === null) return true; // DISPATCH legacy : pas d'ordre exploitable
      const o = stepOrder(s);
      return o !== null && o > dispatchOrder;
    })
    .sort((a, b) => {
      const oa = stepOrder(a);
      const ob = stepOrder(b);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  return eligible[0] ?? null;
}

/**
 * DISPATCH sur lequel porte l'affectation.
 *
 * `dispatchStepId` est fourni par le client à partir de la ligne sur laquelle il a
 * agi. À défaut — anciens clients —, on retombe sur le DISPATCH ouvert d'ordre le
 * PLUS PETIT : c'est le seul repli sûr, puisque tout DISPATCH d'ordre supérieur
 * serait de toute façon refusé par le garde séquentiel.
 */
export function resolveDispatchStep(
  steps: GuardStep[],
  dispatchStepId?: string | null,
): GuardStep | null {
  const openDispatches = steps
    .filter(s => (s.policyStep?.stepType ?? null) === 'DISPATCH' && isOpen(s))
    .sort((a, b) => {
      const oa = stepOrder(a) ?? Number.MAX_SAFE_INTEGER;
      const ob = stepOrder(b) ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  if (dispatchStepId) {
    return openDispatches.find(s => s.id === dispatchStepId) ?? null;
  }
  return openDispatches[0] ?? null;
}
