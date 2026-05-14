import express from 'express';
import request from 'supertest';

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    req.companyId = req.user?.companyId;
    next();
  },
  authorize: () => (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).end();
    const isAdminLike = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    const hasWildcard = (req.user.permissions || []).includes('*');
    if (isAdminLike || hasWildcard) return next();
    return res.status(403).end();
  },
  requireCompany: (req: any, res: any, next: any) => req.companyId ? next() : res.status(403).end(),
}));

import { PrismaClient } from '@prisma/client';
import timeRulesRouter from '../routes/security-time-rules';

const prisma = new PrismaClient();
const COMPANY = 'co-time-rules-test';
const ADMIN   = { id: 'u-admin-t',   role: 'ADMIN',           companyId: COMPANY, permissions: [] as string[] };
const ANALYST = { id: 'u-analyst-t', role: 'ANALYSTE_RISQUES', companyId: COMPANY, permissions: [] as string[] };
const SUPER   = { id: 'u-super-t',   role: 'SUPER_ADMIN',     companyId: COMPANY, permissions: ['*'] };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/security/time-rules', (req: any, _r, next) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    req.companyId = req.user?.companyId;
    next();
  }, timeRulesRouter);
  return app;
}

describe('Routes /api/security/time-rules', () => {
  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'Time Rules Test', code: 'time-test' } });
    await prisma.user.create({ data: { id: ADMIN.id,   email: 'admin-t@test.local',   name: 'Admin',   role: 'ADMIN' as any } });
    await prisma.user.create({ data: { id: ANALYST.id, email: 'analyst-t@test.local', name: 'Analyst', role: 'ANALYSTE_RISQUES' as any } });
    await prisma.user.create({ data: { id: SUPER.id,   email: 'super-t@test.local',   name: 'Super',   role: 'SUPER_ADMIN' as any } });
  });

  afterAll(async () => {
    await prisma.securityTimeRule.deleteMany({
      where: { OR: [{ companyId: COMPANY }, { createdBy: { in: [ADMIN.id, ANALYST.id, SUPER.id] } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ADMIN.id, ANALYST.id, SUPER.id] } } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  const baseRule = {
    name: 'Heures ouvrées',
    daysOfWeek: 31,
    timeStart: '09:00',
    timeEnd: '18:00',
    timezone: 'Europe/Paris',
    appliesTo: 'ALL' as const,
  };

  it('ANALYSTE → 403', async () => {
    const res = await request(makeApp()).get('/api/security/time-rules').set('x-test-user', JSON.stringify(ANALYST));
    expect(res.status).toBe(403);
  });

  it('ADMIN crée règle ALL → 201', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send(baseRule);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Heures ouvrées');
    expect(res.body.data.companyId).toBe(COMPANY);
  });

  it('daysOfWeek=0 → 400 invalid_days', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ...baseRule, daysOfWeek: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_days');
  });

  it('timeStart format invalide → 400', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ...baseRule, timeStart: '9h' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_time_start');
  });

  it('timezone invalide → 400', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ...baseRule, timezone: 'Invalide/Zone' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_timezone');
  });

  it('appliesTo=BRANCH sans targetValues → 400 missing_targets', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ...baseRule, appliesTo: 'BRANCH', targetValues: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_targets');
  });

  it('SUPER_ADMIN crée règle plateforme', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ ...baseRule, companyId: null });
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBeNull();
  });

  it('ADMIN ne peut pas créer règle plateforme → 403', async () => {
    const res = await request(makeApp())
      .post('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ...baseRule, companyId: null });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden_platform_scope');
  });

  it('preview /:id/preview → 7 entrées avec slots', async () => {
    const created = await prisma.securityTimeRule.create({
      data: { ...baseRule, appliesTo: 'ALL', targetValues: [], companyId: COMPANY, createdBy: ADMIN.id },
    });
    const res = await request(makeApp())
      .get(`/api/security/time-rules/${created.id}/preview`)
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.preview).toHaveLength(7);
    const allowedDays = res.body.data.preview.filter((d: any) => d.allowed);
    expect(allowedDays.length).toBeGreaterThanOrEqual(4);
    expect(allowedDays.length).toBeLessThanOrEqual(5);
  });

  it('soft delete → la règle disparaît de la liste', async () => {
    const created = await prisma.securityTimeRule.create({
      data: { ...baseRule, appliesTo: 'ALL', targetValues: [], companyId: COMPANY, createdBy: ADMIN.id },
    });
    const del = await request(makeApp())
      .delete(`/api/security/time-rules/${created.id}`)
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(del.status).toBe(200);

    const list = await request(makeApp())
      .get('/api/security/time-rules')
      .set('x-test-user', JSON.stringify(ADMIN));
    const ids = list.body.data.items.map((r: any) => r.id);
    expect(ids).not.toContain(created.id);
  });
});
