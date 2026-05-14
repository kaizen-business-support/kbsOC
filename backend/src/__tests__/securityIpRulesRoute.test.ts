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
import ipRulesRouter from '../routes/security-ip-rules';
import { extractRealIp } from '../middleware/extractRealIp';

const prisma = new PrismaClient();
const COMPANY = 'co-ip-rules-test';
const ADMIN   = { id: 'u-admin-ip',   role: 'ADMIN',           companyId: COMPANY, permissions: [] as string[] };
const ANALYST = { id: 'u-analyst-ip', role: 'ANALYSTE_RISQUES', companyId: COMPANY, permissions: [] as string[] };
const SUPER   = { id: 'u-super-ip',   role: 'SUPER_ADMIN',     companyId: COMPANY, permissions: ['*'] };

function makeApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(extractRealIp);
  app.use('/api/security/ip-rules', (req: any, _r, next) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    req.companyId = req.user?.companyId;
    next();
  }, ipRulesRouter);
  return app;
}

describe('Routes /api/security/ip-rules', () => {
  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'IP Rules Test', code: 'ip-test' } });
    await prisma.user.create({ data: { id: ADMIN.id,   email: 'admin-ip@test.local',   name: 'Admin',   role: 'ADMIN' as any } });
    await prisma.user.create({ data: { id: ANALYST.id, email: 'analyst-ip@test.local', name: 'Analyst', role: 'ANALYSTE_RISQUES' as any } });
    await prisma.user.create({ data: { id: SUPER.id,   email: 'super-ip@test.local',   name: 'Super',   role: 'SUPER_ADMIN' as any } });
  });

  afterAll(async () => {
    await prisma.securityIpRule.deleteMany({
      where: { OR: [{ companyId: COMPANY }, { createdBy: { in: [ADMIN.id, ANALYST.id, SUPER.id] } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ADMIN.id, ANALYST.id, SUPER.id] } } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('ANALYSTE → 403', async () => {
    const res = await request(makeApp()).get('/api/security/ip-rules').set('x-test-user', JSON.stringify(ANALYST));
    expect(res.status).toBe(403);
  });

  it('ADMIN crée une règle ALLOW → 201', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: '203.0.113.0/24', ruleType: 'ALLOW', description: 'Bureau' });
    expect(res.status).toBe(201);
    expect(res.body.data.ipAddress).toBe('203.0.113.0/24');
    expect(res.body.data.companyId).toBe(COMPANY);
  });

  it('IP invalide → 400', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: 'pas-une-ip', ruleType: 'ALLOW' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_ip');
  });

  it("DENY qui couvre l'IP requester → 422 self_lockout_prevented", async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .set('x-forwarded-for', '198.51.100.42')
      .send({ ipAddress: '198.51.100.0/24', ruleType: 'DENY' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('self_lockout_prevented');
  });

  it('ADMIN ne peut pas créer une règle plateforme (companyId: null) → 403', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ ipAddress: '10.0.0.0/24', ruleType: 'ALLOW', companyId: null });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden_platform_scope');
  });

  it('SUPER_ADMIN peut créer une règle plateforme', async () => {
    const res = await request(makeApp())
      .post('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ ipAddress: '10.0.0.0/24', ruleType: 'ALLOW', companyId: null });
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBeNull();
  });

  it("Toggle d'une règle DENY existante qui couvrirait l'IP → 422", async () => {
    const created = await prisma.securityIpRule.create({
      data: { ipAddress: '198.51.100.0/24', ruleType: 'DENY', isActive: false, companyId: COMPANY, createdBy: ADMIN.id },
    });
    const res = await request(makeApp())
      .patch(`/api/security/ip-rules/${created.id}/toggle`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .set('x-forwarded-for', '198.51.100.42');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('self_lockout_prevented');
  });

  it("Soft delete → la règle n'apparaît plus dans la liste", async () => {
    const created = await prisma.securityIpRule.create({
      data: { ipAddress: '203.0.113.99', ruleType: 'ALLOW', isActive: true, companyId: COMPANY, createdBy: ADMIN.id },
    });
    const del = await request(makeApp())
      .delete(`/api/security/ip-rules/${created.id}`)
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(del.status).toBe(200);

    const list = await request(makeApp())
      .get('/api/security/ip-rules')
      .set('x-test-user', JSON.stringify(ADMIN));
    const ids = list.body.data.items.map((r: any) => r.id);
    expect(ids).not.toContain(created.id);
  });
});
