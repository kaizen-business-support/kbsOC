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
import blockHistoryRouter from '../routes/security-block-history';

const prisma = new PrismaClient();
const COMPANY = 'co-bh-test';
const ADMIN   = { id: 'u-admin-bh',   role: 'ADMIN',           companyId: COMPANY, permissions: [] as string[] };
const ANALYST = { id: 'u-analyst-bh', role: 'ANALYSTE_RISQUES', companyId: COMPANY, permissions: [] as string[] };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/security/block-history', (req: any, _r, next) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    req.companyId = req.user?.companyId;
    next();
  }, blockHistoryRouter);
  return app;
}

describe('Routes /api/security/block-history', () => {
  let row1Id: string;
  let row2Id: string;
  let row3Unblocked: string;

  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'BH Test', code: 'bh-test' } });
    await prisma.user.create({ data: { id: ADMIN.id,   email: 'admin-bh@test.local',   name: 'Admin',   role: 'ADMIN' as any } });
    await prisma.user.create({ data: { id: ANALYST.id, email: 'analyst-bh@test.local', name: 'Analyst', role: 'ANALYSTE_RISQUES' as any } });

    const r1 = await prisma.securityBlockHistory.create({
      data: { blockedIp: '198.51.100.10', blockReason: 'IP_BLACKLISTED', companyId: COMPANY, status: 'BLOCKED' },
    });
    row1Id = r1.id;
    const r2 = await prisma.securityBlockHistory.create({
      data: { blockedIp: '198.51.100.11', blockReason: 'OUTSIDE_TIME_WINDOW', companyId: COMPANY, status: 'BLOCKED' },
    });
    row2Id = r2.id;
    const r3 = await prisma.securityBlockHistory.create({
      data: {
        blockedIp: '198.51.100.12', blockReason: 'IP_BLACKLISTED', companyId: COMPANY,
        status: 'UNBLOCKED', unblockedBy: ADMIN.id, unblockedAt: new Date(), unblockNote: 'déjà débloqué',
      },
    });
    row3Unblocked = r3.id;
  });

  afterAll(async () => {
    await prisma.securityBlockHistory.deleteMany({ where: { companyId: COMPANY } });
    await prisma.user.deleteMany({ where: { id: { in: [ADMIN.id, ANALYST.id] } } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('ANALYSTE → 403', async () => {
    const res = await request(makeApp()).get('/api/security/block-history').set('x-test-user', JSON.stringify(ANALYST));
    expect(res.status).toBe(403);
  });

  it('ADMIN list → 200 avec items + total', async () => {
    const res = await request(makeApp()).get('/api/security/block-history').set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
  });

  it("filtre reason=IP_BLACKLISTED applique", async () => {
    const res = await request(makeApp())
      .get('/api/security/block-history?reason=IP_BLACKLISTED')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.body.data.items.every((r: any) => r.blockReason === 'IP_BLACKLISTED')).toBe(true);
  });

  it("filtre status=UNBLOCKED applique", async () => {
    const res = await request(makeApp())
      .get('/api/security/block-history?status=UNBLOCKED')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].id).toBe(row3Unblocked);
  });

  it("POST unblock sans note → 400 invalid_note", async () => {
    const res = await request(makeApp())
      .post(`/api/security/block-history/${row1Id}/unblock`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_note');
  });

  it("POST unblock note trop courte → 400", async () => {
    const res = await request(makeApp())
      .post(`/api/security/block-history/${row1Id}/unblock`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ note: 'ok' });
    expect(res.status).toBe(400);
  });

  it("POST unblock note valide → 200 + status UNBLOCKED", async () => {
    const res = await request(makeApp())
      .post(`/api/security/block-history/${row1Id}/unblock`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ note: 'Vérification manuelle effectuée' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNBLOCKED');
    expect(res.body.data.unblockNote).toBe('Vérification manuelle effectuée');
  });

  it("POST unblock sur entrée déjà UNBLOCKED → 422", async () => {
    const res = await request(makeApp())
      .post(`/api/security/block-history/${row3Unblocked}/unblock`)
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ note: 'Tentative re-unblock' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('already_unblocked');
  });

  it("POST unblock-all → affected count correct", async () => {
    const res = await request(makeApp())
      .post('/api/security/block-history/unblock-all')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ filter: { reason: 'OUTSIDE_TIME_WINDOW' }, note: 'Déblocage groupé post-incident' });
    expect(res.status).toBe(200);
    expect(res.body.data.affected).toBeGreaterThanOrEqual(1);

    // Vérifier que row2 a bien été UNBLOCKED
    const row2 = await prisma.securityBlockHistory.findUnique({ where: { id: row2Id } });
    expect(row2?.status).toBe('UNBLOCKED');
  });

  it("GET export → 200 + Content-Type text/csv", async () => {
    const res = await request(makeApp())
      .get('/api/security/block-history/export')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('id,blocked_ip,attempted_user_id');
    expect(res.text).toContain('198.51.100');
  });
});
