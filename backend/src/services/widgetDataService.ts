import { prisma } from '../prismaClient';

export type Period = 'this_month' | 'this_quarter' | 'this_year' | 'last_6_months' | 'last_12_months';

export interface WidgetDataParams {
  source: 'applications' | 'clients' | 'analytics' | 'portfolio' | 'performance';
  metric: string;
  groupBy?: 'status' | 'month' | 'branch' | 'manager' | 'sector' | 'credit_type';
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

const APPLICATION_METRICS = ['count', 'sum_amount', 'approval_rate', 'avg_processing_time', 'list', 'gantt'];
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

  if (params.metric === 'gantt') {
    const apps = await prisma.creditApplication.findMany({
      where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      include: {
        client:     { select: { companyName: true } },
        creator:    { select: { name: true, branch: true } },
        creditType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 15,
    });

    const TERMINAL = new Set(['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED']);
    const now = Date.now();

    const sortFn = (a: any, b: any): number => {
      if (params.groupBy === 'branch')      return (a.creator?.branch ?? '').localeCompare(b.creator?.branch ?? '') || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (params.groupBy === 'manager')     return (a.creator?.name   ?? '').localeCompare(b.creator?.name   ?? '') || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (params.groupBy === 'status')      return (a.status ?? '').localeCompare(b.status ?? '');
      if (params.groupBy === 'credit_type') return (a.creditType?.name ?? '').localeCompare(b.creditType?.name ?? '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    return {
      rows: (apps as any[]).sort(sortFn).map((a: any) => ({
        id:         a.id,
        label:      `#${a.applicationNumber}`,
        client:     a.client?.companyName ?? '',
        status:     a.status,
        branch:     a.creator?.branch  ?? '',
        manager:    a.creator?.name    ?? '',
        creditType: a.creditType?.name ?? '',
        start:      new Date(a.createdAt).getTime(),
        end:        TERMINAL.has(a.status) ? new Date(a.updatedAt).getTime() : now,
      })),
      columns: [],
    };
  }

  if (['month', 'status', 'branch', 'manager', 'sector', 'credit_type'].includes(params.groupBy as string)) {

    // Taux d'approbation groupé
    if (params.metric === 'approval_rate') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: from, lte: to } },
        select: { status: true, createdAt: true, creator: { select: { branch: true, name: true } }, client: { select: { sector: true } }, creditType: { select: { name: true } } },
      });
      const map = new Map<string, { approved: number; total: number }>();
      for (const app of apps as any[]) {
        const key = getDimValue(app, params.groupBy as PivotDimension);
        const curr = map.get(key) ?? { approved: 0, total: 0 };
        curr.total++;
        if (app.status === 'APPROVED') curr.approved++;
        map.set(key, curr);
      }
      return {
        series: Array.from(map.entries())
          .map(([name, { approved, total }]) => ({ name, value: total === 0 ? 0 : Math.round((approved / total) * 100) }))
          .sort((a, b) => b.value - a.value),
      };
    }

    // Délai moyen groupé
    if (params.metric === 'avg_processing_time') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, updatedAt: true, creator: { select: { branch: true, name: true } }, client: { select: { sector: true } }, creditType: { select: { name: true } }, totalDurationMinutes: true },
      });
      const map = new Map<string, { sum: number; count: number }>();
      for (const app of apps as any[]) {
        const key = getDimValue(app, params.groupBy as PivotDimension);
        const curr = map.get(key) ?? { sum: 0, count: 0 };
        const minutes = Number((app as any).totalDurationMinutes) ||
          Math.max(0, (new Date((app as any).updatedAt).getTime() - new Date(app.createdAt).getTime()) / 60000);
        curr.sum += minutes;
        curr.count++;
        map.set(key, curr);
      }
      return {
        series: Array.from(map.entries())
          .map(([name, { sum, count }]) => ({ name, value: count === 0 ? 0 : Math.round(sum / count / 60 / 8) }))
          .sort((a, b) => a.value - b.value),
      };
    }

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

    if (params.groupBy === 'branch') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
        select: { amount: true, creator: { select: { branch: true } } },
      });
      const map = new Map<string, number>();
      for (const app of apps as any[]) {
        const branch = app.creator?.branch?.trim() || 'Non renseigné';
        const increment = params.metric === 'sum_amount' ? Number(app.amount ?? 0) : 1;
        map.set(branch, (map.get(branch) ?? 0) + increment);
      }
      return { series: Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) };
    }

    if (params.groupBy === 'manager') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
        select: { amount: true, creator: { select: { name: true } } },
      });
      const map = new Map<string, number>();
      for (const app of apps as any[]) {
        const manager = app.creator?.name?.trim() || 'Non renseigné';
        const increment = params.metric === 'sum_amount' ? Number(app.amount ?? 0) : 1;
        map.set(manager, (map.get(manager) ?? 0) + increment);
      }
      return { series: Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) };
    }

    if (params.groupBy === 'credit_type') {
      const apps = await prisma.creditApplication.findMany({
        where: { ...baseWhere, createdAt: { gte: from, lte: to } },
        select: { amount: true, creditType: { select: { name: true } } },
      });
      const map = new Map<string, number>();
      for (const app of apps as any[]) {
        const creditType = (app as any).creditType?.name?.trim() || 'Non renseigné';
        const increment = params.metric === 'sum_amount' ? Number(app.amount ?? 0) : 1;
        map.set(creditType, (map.get(creditType) ?? 0) + increment);
      }
      return { series: Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) };
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
    const [currApps, prevApps] = await Promise.all([
      prisma.creditApplication.findMany({
        where: { companyId, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, updatedAt: true, totalDurationMinutes: true },
      }),
      prisma.creditApplication.findMany({
        where: { companyId, status: { in: ['APPROVED', 'REJECTED'] as any }, createdAt: { gte: prevFrom, lte: prevTo } },
        select: { createdAt: true, updatedAt: true, totalDurationMinutes: true },
      }),
    ]);
    const avgDays = (apps: any[]) => {
      if (apps.length === 0) return 0;
      const total = apps.reduce((s: number, a: any) => {
        const mins = Number(a.totalDurationMinutes) ||
          Math.max(0, (new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / 60000);
        return s + mins;
      }, 0);
      return Math.round(total / apps.length / 60 / 8);
    };
    const current = avgDays(currApps as any[]);
    const previous = avgDays(prevApps as any[]);
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

// ── Source: portfolio ─────────────────────────────────────────────────────────

const PORTFOLIO_METRICS = ['encours_actif', 'dossiers_pipeline', 'concentration', 'top_clients'];

async function getPortfolioData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!PORTFOLIO_METRICS.includes(params.metric)) throw new Error(`Metric invalide: ${params.metric} pour portfolio`);
  const { from, to, prevFrom, prevTo } = getPeriodRange(params.period);

  if (params.metric === 'encours_actif') {
    const [curr, prev] = await Promise.all([
      prisma.creditApplication.aggregate({
        where: { companyId, status: { in: ['DISBURSED', 'APPROVED'] as any }, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.creditApplication.aggregate({
        where: { companyId, status: { in: ['DISBURSED', 'APPROVED'] as any }, createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { amount: true },
      }),
    ]);
    return { value: Number((curr as any)._sum.amount ?? 0), trend: calcTrend(Number((curr as any)._sum.amount ?? 0), Number((prev as any)._sum.amount ?? 0)) };
  }

  if (params.metric === 'dossiers_pipeline') {
    const [curr, prev] = await Promise.all([
      prisma.creditApplication.count({ where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] as any }, createdAt: { gte: from, lte: to } } }),
      prisma.creditApplication.count({ where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] as any }, createdAt: { gte: prevFrom, lte: prevTo } } }),
    ]);
    return { value: curr, trend: calcTrend(curr, prev) };
  }

  if (params.metric === 'concentration') {
    const dim = (params.groupBy ?? 'sector') as PivotDimension;
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: { in: ['DISBURSED', 'APPROVED'] as any }, createdAt: { gte: from, lte: to } },
      select: { amount: true, creator: { select: { branch: true, name: true } }, client: { select: { sector: true } }, creditType: { select: { name: true } } },
    });
    const map = new Map<string, number>();
    let total = 0;
    for (const app of apps as any[]) {
      const key = getDimValue(app, dim);
      const inc = Number(app.amount ?? 0);
      map.set(key, (map.get(key) ?? 0) + inc);
      total += inc;
    }
    return {
      series: Array.from(map.entries())
        .map(([name, value]) => ({ name, value, pct: total === 0 ? 0 : Math.round((value / total) * 1000) / 10 }))
        .sort((a, b) => b.value - a.value),
    };
  }

  if (params.metric === 'top_clients') {
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: { in: ['DISBURSED', 'APPROVED'] as any }, createdAt: { gte: from, lte: to } },
      select: { amount: true, client: { select: { companyName: true, sector: true } } },
    });
    const map = new Map<string, { sector: string; total: number; count: number }>();
    for (const app of apps as any[]) {
      const name = app.client?.companyName ?? 'N/D';
      const curr = map.get(name) ?? { sector: app.client?.sector ?? '', total: 0, count: 0 };
      curr.total += Number(app.amount ?? 0);
      curr.count++;
      map.set(name, curr);
    }
    const rows = Array.from(map.entries()).map(([name, v]) => ({ ...v, name })).sort((a, b) => b.total - a.total).slice(0, params.limit ?? 10);
    return {
      rows: rows.map((r, i) => ({ rang: i + 1, client: r.name, secteur: r.sector, encours: r.total, dossiers: r.count })),
      columns: [
        { key: 'rang', label: '#' }, { key: 'client', label: 'Client' },
        { key: 'secteur', label: 'Secteur' }, { key: 'encours', label: 'Encours (XOF)' }, { key: 'dossiers', label: 'Dossiers' },
      ],
    };
  }

  return {};
}

// ── Source: performance ───────────────────────────────────────────────────────

const PERFORMANCE_METRICS = ['productivite', 'productivite_volume', 'taux_transformation', 'rejets_motif'];

async function getPerformanceData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!PERFORMANCE_METRICS.includes(params.metric)) throw new Error(`Metric invalide: ${params.metric} pour performance`);
  const { from, to } = getPeriodRange(params.period);

  if (params.metric === 'productivite') {
    // Nombre de dossiers traités (décidés) par chargé
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: { in: ['APPROVED', 'REJECTED', 'DISBURSED'] as any }, createdAt: { gte: from, lte: to } },
      select: { amount: true, creator: { select: { name: true, branch: true } } },
    });
    const dim = (params.groupBy === 'branch') ? 'branch' : 'manager';
    const map = new Map<string, { count: number; amount: number }>();
    for (const app of apps as any[]) {
      const key = dim === 'branch' ? (app.creator?.branch?.trim() || 'Non renseigné') : (app.creator?.name?.trim() || 'Non renseigné');
      const curr = map.get(key) ?? { count: 0, amount: 0 };
      curr.count++;
      curr.amount += Number(app.amount ?? 0);
      map.set(key, curr);
    }
    return {
      series: Array.from(map.entries())
        .map(([name, v]) => ({ name, value: v.count }))
        .sort((a, b) => b.value - a.value),
    };
  }

  if (params.metric === 'productivite_volume') {
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: { in: ['APPROVED', 'REJECTED', 'DISBURSED'] as any }, createdAt: { gte: from, lte: to } },
      select: { amount: true, creator: { select: { name: true, branch: true } } },
    });
    const dim = (params.groupBy === 'branch') ? 'branch' : 'manager';
    const map = new Map<string, number>();
    for (const app of apps as any[]) {
      const key = dim === 'branch' ? (app.creator?.branch?.trim() || 'Non renseigné') : (app.creator?.name?.trim() || 'Non renseigné');
      map.set(key, (map.get(key) ?? 0) + Number(app.amount ?? 0));
    }
    return {
      series: Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }

  if (params.metric === 'taux_transformation') {
    // Soumis → Approuvé par agence ou chargé
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'UNDER_REVIEW'] as any }, createdAt: { gte: from, lte: to } },
      select: { status: true, creator: { select: { name: true, branch: true } }, creditType: { select: { name: true } }, client: { select: { sector: true } } },
    });
    const dim = (params.groupBy ?? 'branch') as PivotDimension;
    const map = new Map<string, { approved: number; total: number }>();
    for (const app of apps as any[]) {
      const key = getDimValue(app, dim);
      const curr = map.get(key) ?? { approved: 0, total: 0 };
      curr.total++;
      if (app.status === 'APPROVED') curr.approved++;
      map.set(key, curr);
    }
    return {
      series: Array.from(map.entries())
        .map(([name, { approved, total }]) => ({ name, value: total === 0 ? 0 : Math.round((approved / total) * 100) }))
        .sort((a, b) => b.value - a.value),
    };
  }

  if (params.metric === 'rejets_motif') {
    // Répartition des rejets par type de crédit ou secteur
    const apps = await prisma.creditApplication.findMany({
      where: { companyId, status: 'REJECTED' as any, createdAt: { gte: from, lte: to } },
      select: { amount: true, creator: { select: { branch: true, name: true } }, client: { select: { sector: true } }, creditType: { select: { name: true } } },
    });
    const dim = (params.groupBy ?? 'credit_type') as PivotDimension;
    const map = new Map<string, number>();
    for (const app of apps as any[]) {
      const key = getDimValue(app, dim);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return {
      series: Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }

  return {};
}

// ── Tableau croisé dynamique ──────────────────────────────────────────────────

export type PivotDimension = 'branch' | 'manager' | 'month' | 'sector' | 'credit_type' | 'status';

export interface PivotDataResult {
  pivotRows: string[];
  pivotCols: string[];
  pivotMatrix: Record<string, Record<string, number>>;
  pivotRowTotals: Record<string, number>;
  pivotColTotals: Record<string, number>;
  pivotGrand: number;
}

function getDimValue(app: any, dim: PivotDimension): string {
  switch (dim) {
    case 'branch':      return app.creator?.branch?.trim() || 'Non renseigné';
    case 'manager':     return app.creator?.name?.trim()   || 'Non renseigné';
    case 'month':       return monthLabel(new Date(app.createdAt));
    case 'sector':      return app.client?.sector?.trim()  || 'Non renseigné';
    case 'credit_type': return app.creditType?.name?.trim()|| 'Non renseigné';
    case 'status':      return app.status ?? 'N/A';
  }
}

export async function getPivotData(
  params: { rowDimension: PivotDimension; colDimension: PivotDimension; metric: 'count' | 'sum_amount'; period: Period },
  companyId: string
): Promise<PivotDataResult> {
  const { from, to } = getPeriodRange(params.period);

  const apps = await prisma.creditApplication.findMany({
    where: { companyId, createdAt: { gte: from, lte: to } },
    select: {
      amount: true, status: true, createdAt: true,
      creator:    { select: { branch: true, name: true } },
      client:     { select: { sector: true } },
      creditType: { select: { name: true } },
    },
  });

  const matrix: Record<string, Record<string, number>> = {};
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const app of apps as any[]) {
    const row = getDimValue(app, params.rowDimension);
    const col = getDimValue(app, params.colDimension);
    const inc = params.metric === 'sum_amount' ? Number(app.amount ?? 0) : 1;
    rowSet.add(row);
    colSet.add(col);
    if (!matrix[row]) matrix[row] = {};
    matrix[row][col] = (matrix[row][col] ?? 0) + inc;
  }

  const pivotRowTotals: Record<string, number> = {};
  const pivotColTotals: Record<string, number> = {};
  let pivotGrand = 0;
  for (const row of rowSet) {
    pivotRowTotals[row] = Object.values(matrix[row] ?? {}).reduce((s, v) => s + v, 0);
    pivotGrand += pivotRowTotals[row];
  }
  for (const col of colSet) {
    pivotColTotals[col] = Array.from(rowSet).reduce((s, r) => s + (matrix[r]?.[col] ?? 0), 0);
  }

  const pivotRows = Array.from(rowSet).sort((a, b) => (pivotRowTotals[b] ?? 0) - (pivotRowTotals[a] ?? 0));
  const pivotCols = Array.from(colSet).sort((a, b) => (pivotColTotals[b] ?? 0) - (pivotColTotals[a] ?? 0));

  return { pivotRows, pivotCols, pivotMatrix: matrix, pivotRowTotals, pivotColTotals, pivotGrand };
}

// ── Point d'entrée ─────────────────────────────────────────────────────────────

const VALID_SOURCES = ['applications', 'clients', 'analytics', 'portfolio', 'performance'];

export async function getWidgetData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult> {
  if (!VALID_SOURCES.includes(params.source)) throw new Error(`Source invalide: ${params.source}`);

  switch (params.source) {
    case 'applications': return getApplicationsData(params, companyId);
    case 'clients':      return getClientsData(params, companyId);
    case 'analytics':    return getAnalyticsData(params, companyId);
    case 'portfolio':    return getPortfolioData(params, companyId);
    case 'performance':  return getPerformanceData(params, companyId);
    default:             throw new Error(`Source invalide: ${params.source}`);
  }
}
