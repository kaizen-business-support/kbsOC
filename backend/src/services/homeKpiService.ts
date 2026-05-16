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
  | 'active_users_30d'
  // v1.0 — KPIs liés au système d'avis et au module Sécurité
  | 'opinion_favorable_pct' | 'pending_opinion_share'
  | 'security_blocks_24h' | 'analyst_favorable_rate';

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
  // v1.0 — substitutions :
  //   CA/AC : alerts → pending_opinion_share (visibilité avis sur leurs dossiers)
  //   Analystes : overdue → analyst_favorable_rate (sentiment de leur production)
  //   Décideurs : avg_duration → opinion_favorable_pct (sentiment du circuit)
  //   Admins : alerts → security_blocks_24h (état du module sécurité)
  CHARGE_AFFAIRES:         ['my_in_progress', 'my_exposure', 'signed_month', 'pending_opinion_share'],
  ASSISTANT_COMMERCIAL:    ['my_in_progress', 'my_exposure', 'signed_month', 'pending_opinion_share'],
  ANALYSTE_RISQUES:        ['queue', 'sla_pct', 'approval_rate', 'analyst_favorable_rate'],
  RESPONSABLE_RISQUES:     ['queue', 'sla_pct', 'approval_rate', 'analyst_favorable_rate'],
  BACK_OFFICE:             ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  DIRECTION_GENERALE:      ['volume_total', 'exposure_total', 'approval_rate', 'opinion_favorable_pct'],
  COMITE_CREDIT:           ['volume_total', 'exposure_total', 'approval_rate', 'opinion_favorable_pct'],
  DIR_AG:                  ['volume_total', 'exposure_total', 'approval_rate', 'opinion_favorable_pct'],
  RESPONSABLE_ENGAGEMENTS: ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  DIRECTION_JURIDIQUE:     ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  ADMIN:                   ['volume_total', 'exposure_total', 'active_users_30d', 'security_blocks_24h'],
  SUPER_ADMIN:             ['volume_total', 'exposure_total', 'active_users_30d', 'security_blocks_24h'],
};

const FALLBACK_KPIS: HomeKpiKey[] = ['my_in_progress', 'signed_month', 'approval_rate', 'alerts'];

export function getKpiKeysForRole(role: UserRole | string): HomeKpiKey[] {
  return ROLE_KPI_MAP[role as string] ?? FALLBACK_KPIS;
}

// ─── Labels & formats ─────────────────────────────────────────────────────────

const LABELS: Record<HomeKpiKey, string> = {
  my_in_progress:         'Mes dossiers en cours',
  my_exposure:            'Encours de mes clients',
  signed_month:           'Contrats signés (mois)',
  alerts:                 'Échéances en alerte',
  queue:                  'À traiter',
  sla_pct:                'SLA respecté',
  approval_rate:          "Taux d'approbation",
  overdue:                'Étapes en retard',
  volume_total:           'Volume global',
  exposure_total:         'Encours total',
  avg_duration:           'Durée moyenne traitement',
  legal_avg_duration:     'Délai juridique moyen',
  active_users_30d:       'Utilisateurs actifs (30j)',
  opinion_favorable_pct:  'Avis favorables (30j)',
  pending_opinion_share:  'Avis rendus sur mes dossiers',
  security_blocks_24h:    'Blocages sécurité (24h)',
  analyst_favorable_rate: 'Mes avis favorables (30j)',
};

const FORMATS: Record<HomeKpiKey, HomeKpiFormat> = {
  my_in_progress:         'number',
  my_exposure:            'currency',
  signed_month:           'number',
  alerts:                 'number',
  queue:                  'number',
  sla_pct:                'percent',
  approval_rate:          'percent',
  overdue:                'number',
  volume_total:           'number',
  exposure_total:         'currency',
  avg_duration:           'duration',
  legal_avg_duration:     'duration',
  active_users_30d:       'number',
  opinion_favorable_pct:  'percent',
  pending_opinion_share:  'percent',
  security_blocks_24h:    'number',
  analyst_favorable_rate: 'percent',
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

      case 'opinion_favorable_pct': {
        // % d'avis favorables sur 30j (parmi les comments[].opinion non null du tenant).
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const apps = await prisma.creditApplication.findMany({
          where: { companyId, updatedAt: { gte: since } },
          select: { analysisResults: true },
        });
        let favorable = 0;
        let total = 0;
        for (const a of apps) {
          const comments = (a.analysisResults as any)?.comments;
          if (!Array.isArray(comments)) continue;
          for (const c of comments) {
            if (c?.opinion === 'favorable') { favorable++; total++; }
            else if (c?.opinion === 'defavorable') { total++; }
          }
        }
        if (total === 0) return null;
        return Math.round((favorable / total) * 100);
      }

      case 'pending_opinion_share': {
        // % des dossiers en cours créés par cet utilisateur où >= 1 avis a été rendu.
        const apps = await prisma.creditApplication.findMany({
          where: {
            companyId,
            createdBy: user.id,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          },
          select: { analysisResults: true },
        });
        if (apps.length === 0) return null;
        let withOpinion = 0;
        for (const a of apps) {
          const comments = (a.analysisResults as any)?.comments;
          if (!Array.isArray(comments)) continue;
          const hasOpinion = comments.some((c: any) =>
            c?.opinion === 'favorable' || c?.opinion === 'defavorable'
          );
          if (hasOpinion) withOpinion++;
        }
        return Math.round((withOpinion / apps.length) * 100);
      }

      case 'security_blocks_24h': {
        // # de blocages enregistrés dans les 24 dernières heures pour ce tenant.
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        return prisma.securityBlockHistory.count({
          where: { companyId, createdAt: { gte: since } },
        });
      }

      case 'analyst_favorable_rate': {
        // % des dossiers traités les 30 derniers jours par cet analyste
        // où count(favorable) > count(défavorable) parmi SES propres avis.
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const apps = await prisma.creditApplication.findMany({
          where: {
            companyId,
            updatedAt: { gte: since },
            workflowSteps: { some: { assigneeId: user.id, completedAt: { not: null } } },
          },
          select: { analysisResults: true },
        });
        if (apps.length === 0) return null;
        let withMyOpinion = 0;
        let myFavorableMajority = 0;
        for (const a of apps) {
          const comments = (a.analysisResults as any)?.comments;
          if (!Array.isArray(comments)) continue;
          const mine = comments.filter((c: any) => c?.userId === user.id);
          const fav = mine.filter((c: any) => c?.opinion === 'favorable').length;
          const def = mine.filter((c: any) => c?.opinion === 'defavorable').length;
          if (fav + def === 0) continue;
          withMyOpinion++;
          if (fav > def) myFavorableMajority++;
        }
        if (withMyOpinion === 0) return null;
        return Math.round((myFavorableMajority / withMyOpinion) * 100);
      }
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
