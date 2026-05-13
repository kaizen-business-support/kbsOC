/**
 * homeKpiService.ts
 *
 * Calcul des KPIs affichés sur la page d'accueil, adapté au rôle.
 * Chaque rôle voit 4 KPIs choisis dans une liste fixe.
 *
 * Les valeurs sont calculées indépendamment : une agrégation qui échoue
 * renvoie `value: null` + `error: true` sans casser les autres.
 */

import { UserRole } from '@prisma/client';
import { prisma } from '../prismaClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomeKpiKey =
  | 'my_in_progress' | 'my_exposure' | 'signed_month' | 'alerts'
  | 'queue' | 'sla_pct' | 'approval_rate' | 'overdue'
  | 'volume_total' | 'exposure_total' | 'avg_duration' | 'legal_avg_duration'
  | 'active_users_30d';

export type HomeKpiFormat = 'number' | 'currency' | 'percent' | 'duration';

export interface HomeKpi {
  key: HomeKpiKey;
  label: string;
  value: number | null;
  format: HomeKpiFormat;
  trend?: { delta: number; direction: 'up' | 'down' } | null;
  error?: boolean;
}

interface UserCtx {
  id: string;
  role: string;
}

// ─── Mapping rôle → liste des KPIs ────────────────────────────────────────────

const ROLE_KPI_MAP: Record<string, HomeKpiKey[]> = {
  CHARGE_AFFAIRES:         ['my_in_progress', 'my_exposure', 'signed_month', 'alerts'],
  ASSISTANT_COMMERCIAL:    ['my_in_progress', 'my_exposure', 'signed_month', 'alerts'],
  ANALYSTE_RISQUES:        ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  RESPONSABLE_RISQUES:     ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  BACK_OFFICE:             ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  DIRECTION_GENERALE:      ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  COMITE_CREDIT:           ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  DIR_AG:                  ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  RESPONSABLE_ENGAGEMENTS: ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  DIRECTION_JURIDIQUE:     ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  ADMIN:                   ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'],
  SUPER_ADMIN:             ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'],
};

const FALLBACK_KPIS: HomeKpiKey[] = ['my_in_progress', 'signed_month', 'approval_rate', 'alerts'];

export function getKpiKeysForRole(role: UserRole | string): HomeKpiKey[] {
  return ROLE_KPI_MAP[role as string] ?? FALLBACK_KPIS;
}

// ─── Labels & formats ─────────────────────────────────────────────────────────

const LABELS: Record<HomeKpiKey, string> = {
  my_in_progress:     'Mes dossiers en cours',
  my_exposure:        'Encours de mes clients',
  signed_month:       'Contrats signés (mois)',
  alerts:             'Échéances en alerte',
  queue:              'À traiter',
  sla_pct:            'SLA respecté',
  approval_rate:      "Taux d'approbation",
  overdue:            'Étapes en retard',
  volume_total:       'Volume global',
  exposure_total:     'Encours total',
  avg_duration:       'Durée moyenne traitement',
  legal_avg_duration: 'Délai juridique moyen',
  active_users_30d:   'Utilisateurs actifs (30j)',
};

const FORMATS: Record<HomeKpiKey, HomeKpiFormat> = {
  my_in_progress: 'number',
  my_exposure: 'currency',
  signed_month: 'number',
  alerts: 'number',
  queue: 'number',
  sla_pct: 'percent',
  approval_rate: 'percent',
  overdue: 'number',
  volume_total: 'number',
  exposure_total: 'currency',
  avg_duration: 'duration',
  legal_avg_duration: 'duration',
  active_users_30d: 'number',
};

// ─── Calcul des valeurs ───────────────────────────────────────────────────────

async function safeNumber(fn: () => Promise<number | null>): Promise<{ value: number | null; error: boolean }> {
  try {
    const v = await fn();
    return { value: v, error: false };
  } catch (e) {
    console.warn('[homeKpiService] KPI computation failed', e);
    return { value: null, error: true };
  }
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function computeKpi(key: HomeKpiKey, user: UserCtx, companyId: string): Promise<HomeKpi> {
  const { value, error } = await safeNumber(async () => {
    switch (key) {
      case 'my_in_progress':
        return prisma.creditApplication.count({
          where: { companyId, createdBy: user.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        });
      case 'my_exposure': {
        const r = await prisma.creditApplication.aggregate({
          _sum: { amount: true },
          where: { companyId, createdBy: user.id, status: 'DISBURSED' },
        });
        return Number(r._sum.amount ?? 0);
      }
      case 'signed_month':
        return prisma.document.count({
          where: {
            category: 'CONTRACT',
            createdAt: { gte: startOfMonth() },
            application: { companyId },
          },
        });
      case 'alerts':
      case 'overdue':
        return prisma.workflowStep.count({
          where: {
            application: { companyId },
            deadline: { lt: new Date() },
            completedAt: null,
          },
        });
      case 'queue':
        return prisma.workflowStep.count({
          where: {
            application: { companyId },
            role: user.role,
            status: { in: ['PENDING', 'IN_REVIEW'] },
          },
        });
      case 'sla_pct': {
        const completed = await prisma.workflowStep.findMany({
          where: {
            application: { companyId },
            role: user.role,
            completedAt: { not: null },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
          },
          select: { isOverdue: true },
        });
        if (completed.length === 0) return null;
        const onTime = completed.filter(s => !s.isOverdue).length;
        return Math.round((onTime / completed.length) * 100);
      }
      case 'approval_rate': {
        const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
        const apps = await prisma.creditApplication.findMany({
          where: { companyId, status: { in: ['APPROVED', 'REJECTED'] }, updatedAt: { gte: since } },
          select: { status: true },
        });
        if (apps.length === 0) return null;
        const ok = apps.filter(a => a.status === 'APPROVED').length;
        return Math.round((ok / apps.length) * 100);
      }
      case 'volume_total':
        return prisma.creditApplication.count({ where: { companyId } });
      case 'exposure_total': {
        const r = await prisma.creditApplication.aggregate({
          _sum: { amount: true },
          where: { companyId, status: 'DISBURSED' },
        });
        return Number(r._sum.amount ?? 0);
      }
      case 'avg_duration': {
        const apps = await prisma.creditApplication.findMany({
          where: { companyId, totalDurationMinutes: { not: null } },
          select: { totalDurationMinutes: true },
        });
        if (apps.length === 0) return null;
        const sum = apps.reduce((s, a) => s + (a.totalDurationMinutes ?? 0), 0);
        return Math.round(sum / apps.length);
      }
      case 'legal_avg_duration': {
        const steps = await prisma.workflowStep.findMany({
          where: {
            application: { companyId },
            durationMinutes: { not: null },
            policyStep: { stepType: 'LEGAL' },
          },
          select: { durationMinutes: true },
        });
        if (steps.length === 0) return null;
        const sum = steps.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
        return Math.round(sum / steps.length);
      }
      case 'active_users_30d':
        // L'appartenance au tenant passe par CompanyMembership (User n'a pas companyId direct).
        return prisma.user.count({
          where: {
            memberships: { some: { companyId, isActive: true } },
            lastLogin: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
          },
        });
    }
  });
  return {
    key,
    label: LABELS[key],
    value,
    format: FORMATS[key],
    error: error || undefined,
  };
}

export async function buildHomeKpisForUser(user: UserCtx, companyId: string): Promise<HomeKpi[]> {
  const keys = getKpiKeysForRole(user.role);
  return Promise.all(keys.map(k => computeKpi(k, user, companyId)));
}
