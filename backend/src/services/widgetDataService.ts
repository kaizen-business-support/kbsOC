import { prisma } from '../prismaClient';

export type Period = 'this_month' | 'this_quarter' | 'this_year' | 'last_6_months' | 'last_12_months';

export interface WidgetDataParams {
  source: 'applications' | 'clients' | 'analytics';
  metric: string;
  groupBy?: 'status' | 'month' | 'branch' | 'manager' | 'sector';
  period: Period;
  filter?: Record<string, string>;
  limit?: number;
}

export interface WidgetDataResult {
  value?: number;
  trend?: number;
  label?: string;
  series?: Array<{ name: string; value: number; [key: string]: any }>;
  rows?: Record<string, any>[];
  columns?: Array<{ key: string; label: string }>;
}

export interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

export function getPeriodRange(period: Period): PeriodRange {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now);
  let prevFrom: Date;
  let prevTo: Date;

  switch (period) {
    case 'this_month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
      prevFrom = new Date(now.getFullYear(), (q - 1) * 3, 1);
      prevTo = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'this_year': {
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevFrom = new Date(now.getFullYear() - 1, 0, 1);
      prevTo = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'last_6_months': {
      from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      to = new Date(now);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth() - 6, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_12_months': {
      from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      to = new Date(now);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 24, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth() - 12, 0, 23, 59, 59, 999);
      break;
    }
    default:
      throw new Error(`Période invalide: ${period}`);
  }

  return { from, to, prevFrom, prevTo };
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function buildMonthSeries(
  from: Date, to: Date,
  items: { createdAt: Date; amount?: any }[],
  mode: 'count' | 'sum_amount' = 'count',
): Array<{ name: string; value: number }> {
  const series: Map<string, number> = new Map();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    series.set(monthLabel(cursor), 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const item of items) {
    const key = monthLabel(item.createdAt);
    if (series.has(key)) {
      const increment = mode === 'sum_amount' ? Number(item.amount ?? 0) : 1;
      series.set(key, (series.get(key) ?? 0) + increment);
    }
  }
  return Array.from(series.entries()).map(([name, value]) => ({ name, value }));
}

// ── Source: applications ──────────────────────────────────────────────────────

const APPLICATION_METRICS = ['count', 'sum_amount', 'approval_rate', 'avg_processing_time', 'list'];
const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'];

async function getApplicationsData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!APPLICATION_METRICS.includes(params.metric)) throw new Error(`Metric invalide: ${params.metric} pour applications`);

  const { from, to, prevFrom, prevTo } = getPeriodRange(params.period);
  const rawStatus = params.filter?.status;
  const statusFilter = rawStatus && VALID_STATUSES.includes(rawStatus) ? rawStatus : undefined;
  const baseWhere = {
    companyId,
    ...(statusFilter && { status: statusFilter as any }),
  };

  if (params.metric === 'list') {
    const apps = await prisma.creditApplication.findMany({
      where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      include: { client: { select: { companyName: true } }, creator: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 10,
    });
    return {
      rows: apps.map((a: any) => ({
        id: a.id,
        number: a.applicationNumber,
        client: a.client.companyName,
        amount: Number(a.amount),
        status: a.status,
        date: a.createdAt.toISOString().split('T')[0],
        manager: (a.creator as any)?.name ?? '',
      })),
      columns: [
        { key: 'number', label: 'N° Dossier' },
        { key: 'client', label: 'Client' },
        { key: 'amount', label: 'Montant (XOF)' },
        { key: 'status', label: 'Statut' },
        { key: 'date', label: 'Date' },
        { key: 'manager', label: 'Chargé' },
      ],
    };
  }

  if (params.groupBy === 'month' || params.groupBy === 'status' || params.groupBy === 'branch' || params.groupBy === 'sector') {
    if (params.groupBy === 'sector') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
        select: { amount: true, client: { select: { sector: true } } },
      });
      const map = new Map<string, number>();
      for (const app of apps as any[]) {
        const sector = (app.client?.sector?.trim()) || 'Non renseigné';
        const increment = params.metric === 'sum_amount' ? Number(app.amount ?? 0) : 1;
        map.set(sector, (map.get(sector) ?? 0) + increment);
      }
      return {
        series: Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
      };
    }

    const items = await prisma.creditApplication.findMany({
      where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      select: { createdAt: true, status: true, amount: true },
    });

    if (params.groupBy === 'month') {
      const mode = params.metric === 'sum_amount' ? 'sum_amount' : 'count';
      const series = buildMonthSeries(from, to, items as { createdAt: Date; amount?: any }[], mode);
      return { series };
    }

    if (params.groupBy === 'status') {
      const map = new Map<string, number>();
      for (const item of items as any[]) {
        const increment = params.metric === 'sum_amount' ? Number(item.amount ?? 0) : 1;
        map.set(item.status, (map.get(item.status) ?? 0) + increment);
      }
      return { series: Array.from(map.entries()).map(([name, value]) => ({ name, value })) };
    } else if (params.groupBy === 'branch') {
      throw new Error('groupBy branch non supporté dans cette version');
    }
  }

  if (params.metric === 'count') {
    const [current, previous] = await Promise.all([
      prisma.creditApplication.count({ where: { ...baseWhere, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } } }),
    ]);
    return { value: current, trend: calcTrend(current, previous) };
  }

  if (params.metric === 'sum_amount') {
    const [curr, prev] = await Promise.all([
      prisma.creditApplication.aggregate({ where: { ...baseWhere, createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.creditApplication.aggregate({ where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } }, _sum: { amount: true } }),
    ]);
    const current = Number((curr as any)._sum.amount ?? 0);
    const previous = Number((prev as any)._sum.amount ?? 0);
    return { value: current, trend: calcTrend(current, previous) };
  }

  if (params.metric === 'approval_rate') {
    const [appCurr, rejCurr, appPrev, rejPrev] = await Promise.all([
      prisma.creditApplication.count({ where: { companyId, status: 'APPROVED' as any, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { companyId, status: 'REJECTED' as any, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { companyId, status: 'APPROVED' as any, createdAt: { gte: prevFrom, lte: prevTo } } }),
      prisma.creditApplication.count({ where: { companyId, status: 'REJECTED' as any, createdAt: { gte: prevFrom, lte: prevTo } } }),
    ]);
    const totalCurr = appCurr + rejCurr;
    const totalPrev = appPrev + rejPrev;
    const current = totalCurr === 0 ? 0 : Math.round((appCurr / totalCurr) * 100);
    const previous = totalPrev === 0 ? 0 : Math.round((appPrev / totalPrev) * 100);
    return { value: current, trend: calcTrend(current, previous) };
  }

  if (params.metric === 'avg_processing_time') {
    const [currAgg, prevAgg] = await Promise.all([
      prisma.creditApplication.aggregate({
        where: { companyId, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: from, lte: to } },
        _avg: { totalDurationMinutes: true },
      }),
      prisma.creditApplication.aggregate({
        where: { companyId, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: prevFrom, lte: prevTo } },
        _avg: { totalDurationMinutes: true },
      }),
    ]);
    const current = Math.round((Number((currAgg as any)._avg.totalDurationMinutes ?? 0)) / 60 / 8);
    const previous = Math.round((Number((prevAgg as any)._avg.totalDurationMinutes ?? 0)) / 60 / 8);
    return { value: current, trend: calcTrend(current, previous) };
  }

  return {};
}

// ── Source: clients ───────────────────────────────────────────────────────────

const CLIENT_METRICS = ['count', 'list'];

async function getClientsData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!CLIENT_METRICS.includes(params.metric)) throw new Error(`Metric invalide: ${params.metric} pour clients`);

  if (params.metric === 'list') {
    const clients = await prisma.client.findMany({
      where: { companyId, isActive: true },
      include: { applications: { select: { status: true, amount: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 10,
    });
    return {
      rows: (clients as any[]).map((c: any) => ({
        id: c.id,
        name: c.companyName,
        branch: c.branch ?? '',
        applications: c.applications.length,
        outstanding: c.applications
          .filter((a: any) => a.status === 'APPROVED' || a.status === 'DISBURSED')
          .reduce((sum: number, a: any) => sum + Number(a.amount), 0),
      })),
      columns: [
        { key: 'name', label: 'Client' },
        { key: 'branch', label: 'Agence' },
        { key: 'applications', label: 'Dossiers' },
        { key: 'outstanding', label: 'Encours (XOF)' },
      ],
    };
  }

  // count
  const { from, to, prevFrom, prevTo } = getPeriodRange(params.period);
  const [current, previous] = await Promise.all([
    prisma.client.count({ where: { companyId, isActive: true, createdAt: { gte: from, lte: to } } }),
    prisma.client.count({ where: { companyId, isActive: true, createdAt: { gte: prevFrom, lte: prevTo } } }),
  ]);
  return { value: current, trend: calcTrend(current, previous) };
}

// ── Source: analytics ─────────────────────────────────────────────────────────

const ANALYTICS_METRICS = ['approval_rate', 'solvency_ratio', 'liquidity_ratio', 'npl_ratio'];

async function getAnalyticsData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!ANALYTICS_METRICS.includes(params.metric)) throw new Error(`Metric invalide: ${params.metric} pour analytics`);

  const { from, to, prevFrom, prevTo } = getPeriodRange(params.period);

  if (params.metric === 'approval_rate') {
    return getApplicationsData({ ...params, source: 'applications' }, companyId);
  }

  if (params.metric === 'npl_ratio') {
    const [rejected, total, rejPrev, totalPrev] = await Promise.all([
      prisma.creditApplication.count({ where: { companyId, status: 'REJECTED' as any, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { companyId, status: { notIn: ['DRAFT'] as any }, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { companyId, status: 'REJECTED' as any, createdAt: { gte: prevFrom, lte: prevTo } } }),
      prisma.creditApplication.count({ where: { companyId, status: { notIn: ['DRAFT'] as any }, createdAt: { gte: prevFrom, lte: prevTo } } }),
    ]);
    const current = total === 0 ? 0 : Math.round((rejected / total) * 100);
    const previous = totalPrev === 0 ? 0 : Math.round((rejPrev / totalPrev) * 100);
    return { value: current, trend: calcTrend(current, previous) };
  }

  // solvency_ratio et liquidity_ratio — données non disponibles dans le schéma actuel
  return { value: undefined, label: 'N/D — données non disponibles' };
}

// ── Point d'entrée ─────────────────────────────────────────────────────────────

const VALID_SOURCES = ['applications', 'clients', 'analytics'];

export async function getWidgetData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!VALID_SOURCES.includes(params.source)) throw new Error(`Source invalide: ${params.source}`);

  switch (params.source) {
    case 'applications': return getApplicationsData(params, companyId);
    case 'clients':      return getClientsData(params, companyId);
    case 'analytics':    return getAnalyticsData(params, companyId);
    default:             throw new Error(`Source invalide: ${params.source}`);
  }
}
