/**
 * slaRules.ts
 *
 * Règles de décision du moniteur SLA — quand une étape est en retard, quand la
 * relancer, quand l'escalader.
 *
 * Volontairement séparé de slaMonitorService : ce module n'importe NI Prisma NI
 * le serveur Express, ce qui le rend testable instantanément et sans effet de
 * bord. slaMonitorService se charge de l'accès aux données et des notifications.
 */

/** Délai minimum entre deux relances d'une même étape. */
export const DEFAULT_RELANCE_COOLDOWN_HOURS = 24;

const HOUR_MS = 3_600_000;

/** Étape telle qu'évaluée par le moniteur. */
export interface SlaStep {
  id: string;
  completedAt: Date | null;
  deadline: Date | null;
  isOverdue: boolean;
  notifiedAt: Date | null;
  isEscalated: boolean;
  startedAt: Date | null;
  createdAt: Date;
  assigneeId: string | null;
  /** CreditPolicyStep.maxDurationHours — null pour les étapes legacy. */
  maxDurationHours: number | null;
}

/** L'étape est-elle ouverte et son échéance dépassée ? */
export function isStepOverdue(step: SlaStep, now: Date): boolean {
  if (step.completedAt !== null) return false;
  if (!step.deadline) return false;
  return step.deadline.getTime() < now.getTime();
}

/** Faut-il écrire le drapeau de retard ? (idempotence : seulement s'il est absent) */
export function shouldMarkOverdue(step: SlaStep, now: Date): boolean {
  return isStepOverdue(step, now) && !step.isOverdue;
}

/**
 * Faut-il relancer ? Uniquement sur une étape en retard, et pas plus d'une fois
 * par `cooldownHours` — sans quoi chaque tick du cron enverrait une notification.
 */
export function shouldNotifyOverdue(
  step: SlaStep,
  now: Date,
  cooldownHours: number = DEFAULT_RELANCE_COOLDOWN_HOURS,
): boolean {
  if (!isStepOverdue(step, now)) return false;
  if (!step.notifiedAt) return true;
  return now.getTime() - step.notifiedAt.getTime() >= cooldownHours * HOUR_MS;
}

/** Temps écoulé depuis la prise en charge (ou la création) de l'étape, en heures. */
export function elapsedHours(step: SlaStep, now: Date): number {
  const start = (step.startedAt ?? step.createdAt).getTime();
  return (now.getTime() - start) / HOUR_MS;
}

/**
 * Faut-il escalader ? Au-delà du délai maximum de l'étape de politique, et une
 * seule fois (isEscalated fait office de verrou).
 */
export function shouldEscalate(step: SlaStep, now: Date): boolean {
  if (step.completedAt !== null) return false;
  if (step.isEscalated) return false;
  if (!step.maxDurationHours || step.maxDurationHours <= 0) return false;
  return elapsedHours(step, now) > step.maxDurationHours;
}
