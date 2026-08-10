/**
 * escalationService.ts
 *
 * Escalade d'une étape de workflow vers le niveau hiérarchique supérieur.
 *
 * Cette logique vivait uniquement dans POST /api/codir/escalade/:stepId, donc
 * uniquement en action manuelle. Elle est extraite ici pour que le moniteur SLA
 * (slaMonitorService) escalade automatiquement selon exactement les mêmes règles
 * et les mêmes notifications, sans réécrire une seconde variante.
 */
import { prisma } from '../server';
import { createInAppNotification } from './notificationService';
import { canonicalRole } from '../utils/roleAliases';

/** Niveau hiérarchique saisi lorsqu'une étape est escaladée. */
export const SUPERVISOR_ROLE: Record<string, string> = {
  CHARGE_AFFAIRES:          'ANALYSTE_RISQUES',
  ANALYSTE_RISQUES:         'RESPONSABLE_RISQUES',
  RESPONSABLE_RISQUES:      'RESPONSABLE_ENGAGEMENTS',
  RESPONSABLE_ENGAGEMENTS:  'COMITE_CREDIT',
  COMITE_CREDIT:            'DIRECTION_GENERALE',
  DIRECTION_GENERALE:       'DIRECTION_GENERALE',
  DIRECTION_JURIDIQUE:      'DIRECTION_GENERALE',
  BACK_OFFICE:              'RESPONSABLE_ENGAGEMENTS',
};

/** Rôle qui doit être saisi lorsque l'étape `role` est en souffrance. */
export function supervisorRoleFor(stepRole: string): string {
  return SUPERVISOR_ROLE[canonicalRole(stepRole)] ?? 'DIRECTION_GENERALE';
}

export type EscalationTrigger = 'MANUAL' | 'SLA';

export interface EscalationResult {
  escalated: boolean;
  /** Renseigné quand `escalated` est false. */
  reason?: 'NOT_FOUND' | 'ALREADY_ESCALATED';
  notifiedSupervisors: number;
}

/**
 * Escalade l'étape `stepId` et notifie les superviseurs du tenant.
 *
 * Idempotent : une étape déjà escaladée n'est ni ré-escaladée ni re-notifiée,
 * ce qui permet au moniteur SLA de repasser à chaque tick sans effet de bord.
 */
export async function escalateWorkflowStep(
  stepId: string,
  companyId: string,
  options: { escalatedById?: string | null; trigger?: EscalationTrigger } = {},
): Promise<EscalationResult> {
  const { escalatedById = null, trigger = 'MANUAL' } = options;

  const step = await prisma.workflowStep.findFirst({
    where: { id: stepId, application: { companyId } },
    include: {
      application: { select: { applicationNumber: true } },
      assignee: { select: { name: true } },
    },
  }) as any;

  if (!step) return { escalated: false, reason: 'NOT_FOUND', notifiedSupervisors: 0 };
  if (step.isEscalated) return { escalated: false, reason: 'ALREADY_ESCALATED', notifiedSupervisors: 0 };

  const supervisorRole = supervisorRoleFor(step.role);
  const appNumber = step.application.applicationNumber;
  const assigneeName = step.assignee?.name ?? 'Agent non assigné';

  // Superviseurs via membership (pas de comparaison d'enum sur CompanyMembership)
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  });
  const supervisorIds = memberships
    .filter(m => m.user.isActive && canonicalRole(m.user.role as string) === supervisorRole)
    .map(m => m.user.id);

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { isEscalated: true, escalatedAt: new Date(), escalatedById },
  });

  const origin = trigger === 'SLA'
    ? 'a dépassé son délai maximum de traitement'
    : 'a été escaladé par la direction';

  await Promise.all(supervisorIds.map(supId =>
    createInAppNotification(supId, {
      title: `Escalade — Dossier ${appNumber}`,
      message: `Le dossier ${appNumber} ${origin}. Étape bloquante : ${step.stepName} — Agent : ${assigneeName}.`,
      type: 'WARNING',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    })
  ));

  return { escalated: true, notifiedSupervisors: supervisorIds.length };
}
