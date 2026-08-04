/**
 * notificationRecipients.ts
 *
 * Résolution des destinataires d'une notification de workflow.
 *
 * Historiquement, triggerNotification diffusait à TOUS les utilisateurs du tenant
 * portant l'un des rôles de NotificationRule.recipientRoles. Tant que la politique
 * de crédit appliquait le même circuit à tous les dossiers, cette liste statique
 * coïncidait à peu près avec la ligne d'approbation réelle.
 *
 * Depuis la validation cumulative par paliers (échelle d'escalade), un dossier
 * n'active qu'un SOUS-ENSEMBLE des étapes décisionnelles selon son montant : sur un
 * petit dossier, le comité de crédit et la direction générale n'ont aucune étape —
 * et recevaient pourtant « Action requise » à chaque transition.
 *
 * Ce module recalcule les destinataires depuis la ligne d'approbation effective du
 * dossier (ses WorkflowStep), en miroir de ce que l'utilisateur verrait dans
 * « Mes approbations » (cf. GET /workflows/pending-approvals) :
 *
 *   - étape ANALYSIS  → seul l'assigné la voit dans sa file ;
 *   - autre étape     → n'importe quel porteur du rôle peut la traiter.
 *
 * Le créateur du dossier est toujours notifié : c'est son dossier.
 */
import { canonicalRole } from '../utils/roleAliases';

export interface RecipientStep {
  role: string;
  status: string;
  /** PolicyStepType de l'étape de politique associée (null pour les étapes legacy). */
  stepType?: string | null;
  assigneeId?: string | null;
  /** CreditPolicyStep.order — ordonne la ligne bien plus sûrement que createdAt. */
  order?: number | null;
  createdAt: Date;
}

export interface RecipientCandidate {
  id: string;
  role: string;
}

export interface ResolveRecipientsInput {
  event: string;
  /** Toutes les étapes du dossier — c'est la ligne d'approbation effective. */
  steps: RecipientStep[];
  creatorId: string;
  /** Utilisateurs actifs du tenant, seuls destinataires possibles. */
  candidates: RecipientCandidate[];
  recipientRoles: string[];
  /** Utilisateur explicitement visé (dispatching vers un analyste précis). */
  targetUserId?: string | null;
  /** Rôle de l'étape qui vient d'être ouverte, fourni par la route appelante. */
  nextRole?: string | null;
}

/** Étapes encore à traiter — celles qui apparaissent dans une file d'attente. */
const OPEN_STATUSES = new Set(['PENDING', 'IN_REVIEW']);

/**
 * Événements de dossier : déclenchés une seule fois dans la vie du dossier.
 * Ils tolèrent une copie aux rôles configurés par l'administrateur, à condition
 * que ces rôles participent réellement à la ligne d'approbation du dossier.
 */
const DOSSIER_EVENTS = new Set([
  'APPLICATION_SUBMITTED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
]);

/**
 * Événements informant d'une décision : les personnes ayant déjà traité une étape
 * du dossier sont concernées par la suite donnée à leur travail.
 */
const PARTICIPANT_EVENTS = new Set([
  'STEP_APPROVED',
  'STEP_REJECTED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
]);

/** Une étape d'analyse n'est visible que par son assigné (cf. pending-approvals). */
function isAnalysisStep(step: RecipientStep): boolean {
  return canonicalStepType(step.stepType) === 'ANALYSIS';
}

function canonicalStepType(stepType?: string | null): string | null {
  return stepType ? stepType.toUpperCase() : null;
}

/**
 * Étape en cours de traitement. `nextRole` est fourni par les routes qui viennent
 * d'ouvrir une étape précise ; sinon on prend la première étape ouverte de la ligne.
 */
function pickCurrentStep(steps: RecipientStep[], nextRole?: string | null): RecipientStep | undefined {
  const open = steps
    .filter(s => OPEN_STATUSES.has(s.status.toUpperCase()))
    .sort((a, b) => {
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  if (nextRole) {
    const wanted = canonicalRole(nextRole);
    const match = open.find(s => canonicalRole(s.role) === wanted);
    if (match) return match;
  }
  return open[0];
}

/**
 * Destinataires d'une notification pour un dossier donné.
 * Retourne des IDs utilisateurs, dédoublonnés, tous issus de `candidates`
 * (donc actifs et rattachés au tenant du dossier).
 */
export function resolveNotificationRecipients(input: ResolveRecipientsInput): string[] {
  const { event, steps, creatorId, candidates, recipientRoles, targetUserId, nextRole } = input;

  const known = new Set(candidates.map(c => c.id));
  const recipients = new Set<string>();
  const add = (userId?: string | null) => {
    if (userId && known.has(userId)) recipients.add(userId);
  };
  const addRole = (role: string) => {
    const wanted = canonicalRole(role);
    for (const c of candidates) {
      if (canonicalRole(c.role) === wanted) recipients.add(c.id);
    }
  };

  // 1. Le créateur — c'est son dossier, il suit son avancement de bout en bout.
  add(creatorId);

  // 2. L'utilisateur explicitement visé (dispatching vers un analyste nommé).
  //    Il prime sur la diffusion au rôle : ses collègues ne sont pas concernés.
  const hasExplicitTarget = Boolean(targetUserId && known.has(targetUserId));
  if (targetUserId) add(targetUserId);

  // 3. Les acteurs de l'étape en cours, en miroir de « Mes approbations ».
  if (!hasExplicitTarget) {
    const current = pickCurrentStep(steps, nextRole);
    if (current) {
      if (isAnalysisStep(current) && current.assigneeId) {
        // Étape d'analyse déjà affectée : elle n'est dans la file que de son assigné.
        add(current.assigneeId);
      } else {
        // Étape décisionnelle, juridique, de dispatch — ou analyse pas encore
        // affectée : tout porteur du rôle peut s'en saisir, et doit le savoir.
        addRole(current.role);
      }
    }
  }

  // 4. Les personnes ayant déjà traité une étape du dossier.
  if (PARTICIPANT_EVENTS.has(event)) {
    for (const s of steps) add(s.assigneeId);
  }

  // 5. Copie aux rôles configurés dans la règle — uniquement sur les événements de
  //    dossier, et uniquement si ce rôle porte réellement une étape de CE dossier.
  //    C'est ce qui écarte définitivement les paliers élagués par l'escalade, ainsi
  //    que les rôles de supervision (ADMIN, SUPER_ADMIN) qui ne sont jamais une étape.
  if (DOSSIER_EVENTS.has(event)) {
    const lineRoles = new Set(steps.map(s => canonicalRole(s.role)));
    for (const role of recipientRoles) {
      if (lineRoles.has(canonicalRole(role))) addRole(role);
    }
  }

  return [...recipients];
}
