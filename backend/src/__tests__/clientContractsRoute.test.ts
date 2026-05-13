import express from 'express';
import request from 'supertest';

// Mock ../server so importing clients.ts doesn't bootstrap the full Express app.
// Re-export prisma from the shared prismaClient module so both the route and
// the test setup/teardown hit the same DB connection.
jest.mock('../server', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require('../prismaClient');
  return { prisma };
});

// Mock du middleware d'auth : injecte req.user et req.companyId
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

import clientsRouter from '../routes/clients';

// Use the same prisma instance as the route (via the mocked server module)
import { prisma } from '../prismaClient';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', clientsRouter);
  return app;
}

const COMPANY = 'company-test-contracts';
const BACK_OFFICE_USER = {
  id: 'u-bo', role: 'BACK_OFFICE', branch: null, department: null, companyId: COMPANY, permissions: [],
};
const CA_SAME_BRANCH = {
  id: 'u-ca1', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null, companyId: COMPANY, permissions: [],
};
const CA_OTHER_BRANCH = {
  id: 'u-ca2', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_THIES', department: null, companyId: COMPANY, permissions: [],
};

describe('GET /api/clients/:id/contracts', () => {
  let clientId: string;
  let docContractApprovedId: string;
  let docContractDraftId: string;
  let docFinancialId: string;

  beforeAll(async () => {
    // Company uses `code` not `slug` in this schema
    await prisma.company.create({ data: { id: COMPANY, name: 'Test Co', code: 'test-co' } });

    // User uses `passwordHash` not `password`; no direct companyId field on User
    await prisma.user.create({
      data: {
        id: 'u-creator', email: 'creator@test.local', passwordHash: 'x', name: 'Creator',
        role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR',
      },
    });
    await prisma.user.createMany({
      data: [BACK_OFFICE_USER, CA_SAME_BRANCH, CA_OTHER_BRANCH].map(u => ({
        id: u.id, email: `${u.id}@test.local`, passwordHash: 'x', name: u.id, role: u.role as any,
        branch: u.branch, department: u.department,
      })),
    });

    const client = await prisma.client.create({
      data: {
        companyName: 'ACME', accountNumber: 'CLT-TEST-1', createdBy: 'u-creator', companyId: COMPANY,
      },
    });
    clientId = client.id;

    const appApproved = await prisma.creditApplication.create({
      data: {
        applicationNumber: 'DOS-T-1', clientId, amount: 1000, purpose: 'test',
        status: 'APPROVED', createdBy: 'u-creator', companyId: COMPANY,
      },
    });
    const appDraft = await prisma.creditApplication.create({
      data: {
        applicationNumber: 'DOS-T-2', clientId, amount: 1000, purpose: 'test',
        status: 'DRAFT', createdBy: 'u-creator', companyId: COMPANY,
      },
    });

    const docA = await prisma.document.create({
      data: {
        applicationId: appApproved.id, filename: 'contract-signed.pdf',
        filePath: '/tmp/contract-signed.pdf', mimeType: 'application/pdf',
        category: 'CONTRACT', uploadedBy: 'u-creator',
      },
    });
    docContractApprovedId = docA.id;
    const docB = await prisma.document.create({
      data: {
        applicationId: appDraft.id, filename: 'contract-draft.pdf',
        filePath: '/tmp/contract-draft.pdf', mimeType: 'application/pdf',
        category: 'CONTRACT', uploadedBy: 'u-creator',
      },
    });
    docContractDraftId = docB.id;
    const docC = await prisma.document.create({
      data: {
        applicationId: appApproved.id, filename: 'balance.pdf',
        filePath: '/tmp/balance.pdf', mimeType: 'application/pdf',
        category: 'FINANCIAL', uploadedBy: 'u-creator',
      },
    });
    docFinancialId = docC.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { application: { companyId: COMPANY } } });
    await prisma.creditApplication.deleteMany({ where: { companyId: COMPANY } });
    await prisma.client.deleteMany({ where: { companyId: COMPANY } });
    // Users have no direct companyId; delete by known ids
    await prisma.user.deleteMany({
      where: { id: { in: ['u-creator', 'u-bo', 'u-ca1', 'u-ca2'] } },
    });
    await prisma.company.delete({ where: { id: COMPANY } });
  });

  it('renvoie uniquement les contrats des dossiers APPROVED/DISBURSED/UNDER_REVIEW', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(BACK_OFFICE_USER));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.contracts.map((c: any) => c.id);
    expect(ids).toContain(docContractApprovedId);
    expect(ids).not.toContain(docContractDraftId);
    expect(ids).not.toContain(docFinancialId);
  });

  it('expose canDownload=true pour BACK_OFFICE', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(BACK_OFFICE_USER));
    expect(res.body.contracts[0].canDownload).toBe(true);
  });

  it('expose canDownload=true pour CHARGE_AFFAIRES de la même branche', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(CA_SAME_BRANCH));
    expect(res.status).toBe(200);
    expect(res.body.contracts[0].canDownload).toBe(true);
  });

  it("404 si CHARGE_AFFAIRES d'une autre branche (scope CREATOR_ONLY)", async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify(CA_OTHER_BRANCH));
    expect(res.status).toBe(404);
  });

  it('404 si le client appartient à un autre tenant', async () => {
    const res = await request(makeApp())
      .get(`/api/clients/${clientId}/contracts`)
      .set('x-test-user', JSON.stringify({ ...BACK_OFFICE_USER, companyId: 'other-company' }));
    expect(res.status).toBe(404);
  });
});
