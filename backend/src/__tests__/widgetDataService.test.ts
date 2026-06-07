import { getWidgetData, getPeriodRange } from '../services/widgetDataService';

// Mock Prisma
jest.mock('../prismaClient', () => ({
  prisma: {
    creditApplication: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    client: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma as mockPrismaRaw } from '../prismaClient';
const mockPrisma = mockPrismaRaw as unknown as {
  creditApplication: {
    count: jest.Mock;
    aggregate: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  client: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

beforeEach(() => jest.clearAllMocks());

describe('getPeriodRange', () => {
  it('this_month retourne le mois courant et le mois précédent', () => {
    const { from, to, prevFrom, prevTo } = getPeriodRange('this_month');
    const now = new Date();
    expect(from.getMonth()).toBe(now.getMonth());
    expect(prevTo < from).toBe(true);
    expect(prevFrom < prevTo).toBe(true);
  });

  it('last_6_months retourne 6 mois et les 6 mois précédents', () => {
    const { from, to, prevFrom, prevTo } = getPeriodRange('last_6_months');
    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(170); // ~6 mois
    expect(prevFrom < from).toBe(true);
  });
});

describe('getWidgetData — source: applications, metric: count', () => {
  it('retourne value + trend pour kpi_card', async () => {
    mockPrisma.creditApplication.count
      .mockResolvedValueOnce(42)   // période courante
      .mockResolvedValueOnce(30);  // période précédente
    const result = await getWidgetData(
      { source: 'applications', metric: 'count', period: 'this_month' },
      'co-1'
    );
    expect(result.value).toBe(42);
    expect(result.trend).toBeCloseTo(40, 0); // (42-30)/30*100 = 40%
  });

  it('filtre par status si filter.status fourni', async () => {
    mockPrisma.creditApplication.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8);
    await getWidgetData(
      { source: 'applications', metric: 'count', period: 'this_month', filter: { status: 'APPROVED' } },
      'co-1'
    );
    expect(mockPrisma.creditApplication.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }) })
    );
  });
});

describe('getWidgetData — source: applications, metric: count, groupBy: month', () => {
  it('retourne series pour bar_chart/line_chart', async () => {
    mockPrisma.creditApplication.findMany.mockResolvedValue([
      { createdAt: new Date('2026-01-15') },
      { createdAt: new Date('2026-01-20') },
      { createdAt: new Date('2026-02-10') },
    ]);
    const result = await getWidgetData(
      { source: 'applications', metric: 'count', groupBy: 'month', period: 'last_6_months' },
      'co-1'
    );
    expect(Array.isArray(result.series)).toBe(true);
    expect(result.series!.length).toBeGreaterThan(0);
    const jan = result.series!.find(s => s.name.includes('Jan') || s.name.includes('janv'));
    expect(jan?.value).toBe(2);
  });
});

describe('getWidgetData — source: applications, metric: approval_rate', () => {
  it('calcule le taux correctement', async () => {
    mockPrisma.creditApplication.count
      .mockResolvedValueOnce(80)   // approved période courante
      .mockResolvedValueOnce(20)   // rejected période courante
      .mockResolvedValueOnce(60)   // approved période précédente
      .mockResolvedValueOnce(40);  // rejected période précédente
    const result = await getWidgetData(
      { source: 'applications', metric: 'approval_rate', period: 'this_month' },
      'co-1'
    );
    expect(result.value).toBe(80); // 80/(80+20)*100
    expect(result.trend).toBeCloseTo(33.33, 0); // (80-60)/60*100 = 33.33%
  });

  it('retourne 0 si aucun dossier traité', async () => {
    mockPrisma.creditApplication.count.mockResolvedValue(0);
    const result = await getWidgetData(
      { source: 'applications', metric: 'approval_rate', period: 'this_month' },
      'co-1'
    );
    expect(result.value).toBe(0);
    expect(result.trend).toBe(0);
  });
});

describe('getWidgetData — source: applications, metric: list', () => {
  it('retourne rows + columns', async () => {
    mockPrisma.creditApplication.findMany.mockResolvedValue([
      {
        id: 'a-1', applicationNumber: 'APP-001',
        amount: 500000, status: 'APPROVED', createdAt: new Date('2026-01-01'),
        client: { companyName: 'SARL Diallo' },
        creator: { name: 'Alice', branch: 'Dakar' },
      },
    ]);
    const result = await getWidgetData(
      { source: 'applications', metric: 'list', period: 'this_month', limit: 10 },
      'co-1'
    );
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows!.length).toBe(1);
    expect(result.rows![0].client).toBe('SARL Diallo');
    expect(Array.isArray(result.columns)).toBe(true);
  });
});

describe('getWidgetData — source: clients, metric: count', () => {
  it('retourne le nombre de clients actifs', async () => {
    mockPrisma.client.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(20);
    const result = await getWidgetData(
      { source: 'clients', metric: 'count', period: 'this_month' },
      'co-1'
    );
    expect(result.value).toBe(25);
  });
});

describe('getWidgetData — source: clients, metric: list', () => {
  it('retourne rows + columns', async () => {
    mockPrisma.client.findMany.mockResolvedValue([
      { id: 'c-1', companyName: 'BTP Sénégal', branch: 'Dakar', createdAt: new Date(), applications: [{ status: 'APPROVED' }] },
    ]);
    const result = await getWidgetData(
      { source: 'clients', metric: 'list', period: 'this_month', limit: 10 },
      'co-1'
    );
    expect(result.rows!.length).toBe(1);
    expect(result.rows![0].name).toBe('BTP Sénégal');
  });
});

describe('getWidgetData — validation', () => {
  it('lance une erreur si source invalide', async () => {
    await expect(
      getWidgetData({ source: 'unknown' as any, metric: 'count', period: 'this_month' }, 'co-1')
    ).rejects.toThrow('Source invalide');
  });

  it('lance une erreur si metric invalide pour la source', async () => {
    await expect(
      getWidgetData({ source: 'clients', metric: 'solvency_ratio' as any, period: 'this_month' }, 'co-1')
    ).rejects.toThrow('Metric invalide');
  });
});
