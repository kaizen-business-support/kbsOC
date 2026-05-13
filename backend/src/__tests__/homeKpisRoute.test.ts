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

jest.mock('../services/homeKpiService', () => ({
  buildHomeKpisForUser: jest.fn(async (user: any) => {
    const map: Record<string, string[]> = {
      BACK_OFFICE: ['queue', 'sla_pct', 'approval_rate', 'overdue'],
      CHARGE_AFFAIRES: ['my_in_progress', 'my_exposure', 'signed_month', 'alerts'],
    };
    const keys = map[user.role] ?? ['my_in_progress', 'signed_month', 'approval_rate', 'alerts'];
    return keys.map(k => ({ key: k, label: `Label ${k}`, value: 42, format: 'number' as const }));
  }),
}));

import homeKpisRouter from '../routes/home-kpis';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/home', homeKpisRouter);
  return app;
}

const BO = { id: 'u-bo', role: 'BACK_OFFICE', companyId: 'co-1', permissions: [] };
const CA = { id: 'u-ca', role: 'CHARGE_AFFAIRES', companyId: 'co-1', permissions: [] };

describe('GET /api/home/kpis', () => {
  it('renvoie 4 KPIs avec les keys du rôle BACK_OFFICE', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(BO));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.kpis).toHaveLength(4);
    expect(res.body.kpis.map((k: any) => k.key)).toEqual(['queue', 'sla_pct', 'approval_rate', 'overdue']);
  });

  it('renvoie les bonnes keys pour CHARGE_AFFAIRES', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(CA));
    expect(res.body.kpis.map((k: any) => k.key))
      .toEqual(['my_in_progress', 'my_exposure', 'signed_month', 'alerts']);
  });

  it('chaque KPI a label, value, format', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(BO));
    for (const k of res.body.kpis) {
      expect(typeof k.label).toBe('string');
      expect(typeof k.value === 'number' || k.value === null).toBe(true);
      expect(['number', 'currency', 'percent', 'duration']).toContain(k.format);
    }
  });

  it('403 si pas de companyId', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify({ ...BO, companyId: undefined }));
    expect(res.status).toBe(403);
  });
});
