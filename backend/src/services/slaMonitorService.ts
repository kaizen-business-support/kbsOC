/**
 * slaMonitorService.ts
 *
 * Surveillance automatique des délais du circuit d'approbation.
 *
 * Jusqu'ici, `workflow_steps.is_overdue` n'était JAMAIS écrit : le champ n'était
 * que lu (tableaux de bord CODIR, KPI d'accueil, statistiques de politique). Une
 * étape pouvait donc dépasser son échéance de plusieurs semaines sans qu'aucun
 * indicateur ne bascule, sans relance et sans escalade — relance et escalade
 * n'existant que comme actions manuelles depuis l'écran CODIR.
 *
 * Ce service comble le trou :
 *   1. marque en retard les étapes ouvertes dont la `deadline` est passée ;
 *   2. relance la personne assignée — ou, à défaut, les porteurs du rôle de
 *      l'étape — sans répéter la relance à chaque tick ;
 *   3. escalade au-delà de `maxDurationHours` défini par l'étape de politique,
 *      en réutilisant escalationService (même logique que l'action manuelle).
 *
 * Les décisions vivent dans slaRules (pur, sans Prisma) ; `runSlaMonitor` se
 * contente de les orchestrer sur les données réelles.
 */
import { prisma } from '../server';
import { logger } from '../utils/logger';
import { createInAppNotification } from './notificationService';
import { escalateWorkflowStep } from './escalationService';
import { canonicalRole } from '../utils/roleAliases';
import {
  SlaStep,
  shouldMarkOverdue,
  shouldNotifyOverdue,
  shouldEscalate,
  DEFAULT_RELANCE_COOLDOWN_HOURS,
} from './slaRules';

export * from './slaRules';

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface SlaMonitorReport {
  scanned: number;
  markedOverdue: number;
  notified: number;
  escalated: number;
}

/**
 * Un passage complet du moniteur. Idempotent : rejouable sans dupliquer les
 * effets (drapeau déjà posé, relance sous cooldown, étape déjà escaladée).
 */
export async function runSlaMonitor(
  now: Date = new Date(),
  options: { cooldownHours?: number } = {},
): Promise<SlaMonitorReport> {
  const cooldownHours = options.cooldownHours ?? DEFAULT_RELANCE_COOLDOWN_HOURS;

  const rows = await prisma.workflowStep.findMany({
    where: {
      completedAt: null,
      status: { in: ['PENDING', 'IN_REVIEW'] },
      application: { status: { notIn: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
    },
    include: {
      policyStep: { select: { maxDurationHours: true, stepLabel: true } },
      application: { select: { applicationNumber: true, companyId: true } },
    },
  }) as any[];

  const report: SlaMonitorReport = { scanned: rows.length, markedOverdue: 0, notified: 0, escalated: 0 };

  for (const row of rows) {
    const step: SlaStep = {
      id: row.id,
      completedAt: row.completedAt,
      deadline: row.deadline,
      isOverdue: row.isOverdue,
      notifiedAt: row.notifiedAt,
      isEscalated: row.isEscalated,
      startedAt: row.startedAt,
      createdAt: row.createdAt,
      assigneeId: row.assigneeId,
      maxDurationHours: row.policyStep?.maxDurationHours ?? null,
    };

    const companyId: string | null = row.application?.companyId ?? null;
    if (!companyId) continue; // isolation multi-tenant : pas de dossier orphelin

    try {
      if (shouldMarkOverdue(step, now)) {
        await prisma.workflowStep.update({
          where: { id: step.id },
          data: { isOverdue: true, overdueAt: now },
        });
        report.markedOverdue++;
      }

      if (shouldNotifyOverdue(step, now, cooldownHours)) {
        const sent = await notifyLateStep(row, step, companyId, now);
        if (sent) {
          await prisma.workflowStep.update({
            where: { id: step.id },
            data: { notifiedAt: now },
          });
          report.notified++;
        }
      }

      if (shouldEscalate(step, now)) {
        const result = await escalateWorkflowStep(step.id, companyId, { trigger: 'SLA' });
        if (result.escalated) report.escalated++;
      }
    } catch (err) {
      // Une étape en erreur ne doit pas interrompre le balayage.
      logger.error(`Moniteur SLA — étape ${step.id} ignorée :`, err);
    }
  }

  return report;
}

/**
 * Relance les personnes concernées par une étape en retard.
 *
 * Étape assignée → son assigné. Étape non assignée → tous les porteurs actifs du
 * rôle de l'étape dans ce tenant, puisque n'importe lequel peut s'en saisir.
 */
async function notifyLateStep(row: any, step: SlaStep, companyId: string, now: Date): Promise<boolean> {
  const appNumber = row.application?.applicationNumber ?? 'sans numéro';
  const label = row.policyStep?.stepLabel ?? row.stepName;
  const daysLate = step.deadline
    ? Math.max(1, Math.floor((now.getTime() - step.deadline.getTime()) / 86_400_000))
    : 1;

  const title = `Retard — Dossier ${appNumber}`;
  const message = `L'étape « ${label} » du dossier ${appNumber} a dépassé son échéance depuis ${daysLate} jour(s). Merci de la traiter sans délai.`;

  const recipientIds: string[] = [];

  if (step.assigneeId) {
    recipientIds.push(step.assigneeId);
  } else {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId, isActive: true },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    const wanted = canonicalRole(row.role);
    for (const m of memberships) {
      if (m.user.isActive && canonicalRole(m.user.role as string) === wanted) {
        recipientIds.push(m.user.id);
      }
    }
  }

  if (recipientIds.length === 0) return false;

  await Promise.all(recipientIds.map(userId =>
    createInAppNotification(userId, {
      title,
      message,
      type: 'WARNING',
      relatedType: 'workflow_step',
      relatedId: step.id,
      companyId,
    })
  ));

  return true;
}
