/**
 * Tests dédiés au middleware timeRulesGate (Phase 6a).
 * - 423 sur mutation hors fenêtre
 * - GET libéré si toutes les règles applicables ont allowReadOnly=true
 * - GET bloqué si au moins une règle a allowReadOnly=false
 * - dédoublonnage audit (1 entrée max par 5min)
 */

const dataMap = new Map<string, string>();
const fakeRedis = {
  async incr(_k: string) { return 1; },
  async expire() { return 1; },
  async set(k: string, v: string) { dataMap.set(k, v); return 'OK' as const; },
  async exists(k: string) { return dataMap.has(k) ? 1 : 0; },
  async ttl() { return 300; },
  async del(k: string) { return dataMap.delete(k) ? 1 : 0; },
  async get() { return null; },
};

jest.mock('../services/redis', () => ({
  __esModule: true,
  default: fakeRedis,
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => {}),
  cacheDel: jest.fn(async () => {}),
}));

jest.mock('../services/securityRulesCache', () => {
  let platform: any[] = [];
  let tenant: Record<string, any[]> = {};
  return {
    __esModule: true,
    getCachedPlatformIpRules: jest.fn(async () => []),
    getCachedTenantIpRules:   jest.fn(async () => []),
    invalidateIpRulesCache:   jest.fn(async () => {}),
    getCachedPlatformTimeRules: jest.fn(async () => platform),
    getCachedTenantTimeRules:   jest.fn(async (companyId: string) => tenant[companyId] ?? []),
    invalidateTimeRulesCache:   jest.fn(async () => {}),
    __setPlatformTimeRules: (rules: any[]) => { platform = rules; },
    __setTenantTimeRules: (companyId: string, rules: any[]) => { tenant[companyId] = rules; },
    __reset: () => { platform = []; tenant = {}; dataMap.clear(); },
  };
});

import express from 'express';
import request from 'supertest';
import { timeRulesGate } from '../middleware/timeAccess';
const cache = require('../services/securityRulesCache');

function makeApp() {
  const app = express();
  app.use(express.json());
  // Mock req.user + companyId via header
  app.use((req: any, _r, next) => {
    if (req.headers['x-test-user']) {
      req.user = JSON.parse(req.headers['x-test-user'] as string);
      req.companyId = req.user?.companyId;
    }
    next();
  });
  app.use('/api', timeRulesGate);
  app.get('/api/anything', (_req, res) => res.json({ ok: true }));
  app.post('/api/anything', (_req, res) => res.json({ ok: true }));
  app.put('/api/anything', (_req, res) => res.json({ ok: true }));
  app.patch('/api/anything', (_req, res) => res.json({ ok: true }));
  app.delete('/api/anything', (_req, res) => res.json({ ok: true }));
  return app;
}

const USER = { id: 'u-gate', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', companyId: 'co-gate' };
const RULE_CLOSED = {
  id: 'r1', daysOfWeek: 1 /* lundi seulement */, timeStart: '09:00', timeEnd: '09:01',
  timezone: 'Europe/Paris', appliesTo: 'ALL', targetValues: [],
  deniedMessage: 'Test fermé', allowReadOnly: false,
};
const RULE_CLOSED_READONLY = { ...RULE_CLOSED, allowReadOnly: true };

beforeEach(() => { cache.__reset(); });

describe('timeRulesGate Phase 6a', () => {
  it('user non visé par règle → next()', async () => {
    cache.__setTenantTimeRules('co-gate', [{
      ...RULE_CLOSED, appliesTo: 'BRANCH', targetValues: ['AGENCE_THIES'],
    }]);
    const res = await request(makeApp())
      .post('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
  });

  it('POST hors fenêtre → 423 avec next_open et allow_read_only', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED]);
    const res = await request(makeApp())
      .post('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('outside_time_window');
    expect(res.body.message).toBe('Test fermé');
    expect(res.body).toHaveProperty('next_open');
    expect(res.body.allow_read_only).toBe(false);
  });

  it('PUT / PATCH / DELETE hors fenêtre → 423', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED]);
    for (const method of ['put', 'patch', 'delete'] as const) {
      const res = await (request(makeApp()) as any)[method]('/api/anything')
        .set('x-test-user', JSON.stringify(USER));
      expect(res.status).toBe(423);
    }
  });

  it('GET hors fenêtre + allowReadOnly=true → 200 (libéré)', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED_READONLY]);
    const res = await request(makeApp())
      .get('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
  });

  it('GET hors fenêtre + allowReadOnly=false → 423', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED]);
    const res = await request(makeApp())
      .get('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(423);
    expect(res.body.allow_read_only).toBe(false);
  });

  it('GET + mix de règles (une readOnly=false) → 423', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED_READONLY, RULE_CLOSED]);
    const res = await request(makeApp())
      .get('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(423);
    expect(res.body.allow_read_only).toBe(false);
  });

  it('Dédoublonnage audit : flag Redis posé au premier 423', async () => {
    cache.__setTenantTimeRules('co-gate', [RULE_CLOSED]);
    await request(makeApp())
      .post('/api/anything')
      .set('x-test-user', JSON.stringify(USER));
    // Le flag tr:denied:u-gate doit être posé
    expect(dataMap.has('tr:denied:u-gate')).toBe(true);
  });
});
