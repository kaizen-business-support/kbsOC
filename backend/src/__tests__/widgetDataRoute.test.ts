import express from 'express';
import request from 'supertest';

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : null;
    req.companyId = req.user?.companyId;
    next();
  },
  requireCompany: (req: any, res: any, next: any) =>
    req.companyId ? next() : res.status(403).end(),
}));

jest.mock('../services/widgetDataService', () => ({
  getWidgetData: jest.fn(),
}));

import { getWidgetData } from '../services/widgetDataService';
import widgetDataRouter from '../routes/widget-data';

const mockGetWidgetData = getWidgetData as jest.MockedFunction<typeof getWidgetData>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/widget-data', widgetDataRouter);
  return app;
}

const ADMIN = { id: 'u-1', role: 'ADMIN', companyId: 'co-1', permissions: [] };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/widget-data', () => {
  it('400 si source manquant', async () => {
    const res = await request(makeApp())
      .get('/api/widget-data?metric=count&period=this_month')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source/i);
  });

  it('400 si metric manquant', async () => {
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&period=this_month')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/metric/i);
  });

  it('400 si period manquant', async () => {
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/period/i);
  });

  it('400 si period invalide', async () => {
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count&period=invalid')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(400);
  });

  it('retourne 200 + data pour paramètres valides', async () => {
    mockGetWidgetData.mockResolvedValue({ value: 42, trend: 10 });
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count&period=this_month')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.value).toBe(42);
    expect(mockGetWidgetData).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'applications', metric: 'count', period: 'this_month' }),
      'co-1'
    );
  });

  it('passe groupBy et filter au service', async () => {
    mockGetWidgetData.mockResolvedValue({ series: [] });
    await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count&period=this_month&groupBy=month&filter[status]=APPROVED')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(mockGetWidgetData).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'month', filter: { status: 'APPROVED' } }),
      'co-1'
    );
  });

  it('400 si service throw avec message "invalide"', async () => {
    mockGetWidgetData.mockRejectedValue(new Error('Source invalide: xyz'));
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count&period=this_month')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invalide');
  });

  it('403 sans companyId', async () => {
    const res = await request(makeApp())
      .get('/api/widget-data?source=applications&metric=count&period=this_month');
    expect(res.status).toBe(403);
  });
});
