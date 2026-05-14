/**
 * bruteForceFlow.test.ts
 *
 * Test d'intégration end-to-end : 5 logins échoués → 6ᵉ est bloqué (429),
 * audit security_block_history créé, email enqueué (mocké).
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dataMap = new Map<string, string>();
const fakeRedis = {
  async incr(key: string): Promise<number> {
    const cur = Number(dataMap.get(key) ?? 0);
    dataMap.set(key, String(cur + 1));
    return cur + 1;
  },
  async expire(_key: string, _sec: number): Promise<number> { return 1; },
  async set(key: string, value: string): Promise<'OK'> { dataMap.set(key, value); return 'OK'; },
  async exists(key: string): Promise<number> { return dataMap.has(key) ? 1 : 0; },
  async ttl(_key: string): Promise<number> { return 900; },
  async del(key: string): Promise<number> { return dataMap.delete(key) ? 1 : 0; },
  async get(_key: string): Promise<string | null> { return null; },
};

jest.mock('../services/redis', () => ({
  __esModule: true,
  default: fakeRedis,
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => {}),
  cacheDel: jest.fn(async () => {}),
  blacklistToken: jest.fn(async () => {}),
  isTokenBlacklisted: jest.fn(async () => false),
}));

const enqueueEmailMock = jest.fn(async (_data: any) => {});
jest.mock('../services/emailQueueService', () => ({
  enqueueEmail: (data: any) => enqueueEmailMock(data),
}));

// ─── Setup express ───────────────────────────────────────────────────────────

import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Mock '../server' pour ne PAS booter l'app entière (auth.ts l'importe).
const prismaForMock = new PrismaClient();
jest.mock('../server', () => ({ prisma: prismaForMock }));

import authRouter from '../routes/auth';

const prisma = prismaForMock;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

const COMPANY = 'co-bf-test';
const USER_EMAIL = 'bf-target@test.local';
const USER_PASSWORD = 'StrongPass!1';

describe('Brute-force flow', () => {
  beforeAll(async () => {
    dataMap.clear();
    enqueueEmailMock.mockClear();
    process.env.BF_THRESHOLD = '5';
    process.env.BF_WINDOW_SEC = '300';
    process.env.BF_BLOCK_DURATION_SEC = '900';

    await prisma.company.create({ data: { id: COMPANY, name: 'BF Test', code: 'bf-test' } });
    const hash = await bcrypt.hash(USER_PASSWORD, 10);
    await prisma.user.create({
      data: {
        id: 'u-bf-target', email: USER_EMAIL, passwordHash: hash, name: 'BF Target',
        role: 'CHARGE_AFFAIRES' as any, isActive: true,
      },
    });
    await prisma.companyMembership.create({
      data: { userId: 'u-bf-target', companyId: COMPANY, role: 'CHARGE_AFFAIRES' as any, isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.securityBlockHistory.deleteMany({ where: { attemptedUserId: 'u-bf-target' } });
    await prisma.companyMembership.deleteMany({ where: { userId: 'u-bf-target' } });
    await prisma.user.deleteMany({ where: { id: 'u-bf-target' } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('5 échecs → audit + email + 6ᵉ retourne 429', async () => {
    const app = makeApp();

    // 4 premiers : 401 (sous le seuil)
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: USER_EMAIL, password: 'wrong' });
      expect(res.status).toBe(401);
    }

    // 5ᵉ : 401, mais le block est posé après cette réponse
    const fifth = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: 'wrong' });
    expect(fifth.status).toBe(401);

    // Vérifier audit créé
    const audit = await prisma.securityBlockHistory.findFirst({
      where: { attemptedUserId: 'u-bf-target', blockReason: 'BRUTE_FORCE' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.status).toBe('BLOCKED');
    expect(audit?.companyId).toBe(COMPANY);

    // Vérifier email enqueué
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
    expect(enqueueEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: USER_EMAIL,
      event: 'brute_force_lockout',
    }));

    // 6ᵉ tentative → 429
    const sixth = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: 'wrong' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toBe('rate_limited');

    // Même avec bon password → 429 (compte verrouillé)
    const seventh = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: USER_PASSWORD });
    expect(seventh.status).toBe(429);
  });
});
