import express from 'express';
import request from 'supertest';

// Mock auth middleware: read user from x-test-user header.
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : null;
    if (!req.user) return res.status(401).end();
    next();
  },
  requireCompany: (_req: any, _res: any, next: any) => next(),
}));

// Mock prisma.
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../server', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

import onboardingRouter from '../routes/onboarding';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users/me/onboarding', onboardingRouter);
  return app;
}

const USER = { id: 'u-1', role: 'CHARGE_AFFAIRES', companyId: 'co-1', permissions: [] };

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
});

describe('GET /api/users/me/onboarding', () => {
  it('returns shouldShow=true when onboardingCompletedAt is null', async () => {
    mockFindUnique.mockResolvedValue({ onboardingCompletedAt: null });
    const res = await request(makeApp())
      .get('/api/users/me/onboarding')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, shouldShow: true });
  });

  it('returns shouldShow=false when onboardingCompletedAt is set', async () => {
    mockFindUnique.mockResolvedValue({ onboardingCompletedAt: new Date() });
    const res = await request(makeApp())
      .get('/api/users/me/onboarding')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
    expect(res.body.shouldShow).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(makeApp()).get('/api/users/me/onboarding');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/me/onboarding/complete', () => {
  it('sets onboardingCompletedAt to a Date and returns success', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(makeApp())
      .post('/api/users/me/onboarding/complete')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { onboardingCompletedAt: expect.any(Date) },
    });
  });
});

describe('POST /api/users/me/onboarding/reset', () => {
  it('sets onboardingCompletedAt to null and returns success', async () => {
    mockUpdate.mockResolvedValue({});
    const res = await request(makeApp())
      .post('/api/users/me/onboarding/reset')
      .set('x-test-user', JSON.stringify(USER));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { onboardingCompletedAt: null },
    });
  });
});
