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

const mockTemplate = {
  id: 't-1', name: 'Suivi Portefeuille', description: 'desc',
  companyId: null, isGlobal: true, layout: [],
  createdAt: new Date(), updatedAt: new Date(),
  widgets: [],
};

const mockPrisma = {
  dashboardTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  dashboard: { create: jest.fn() },
  dashboardWidget: { createMany: jest.fn() },
};

jest.mock('../prismaClient', () => ({ prisma: mockPrisma }));

jest.mock('../services/moduleProfileService', () => ({
  getMergedProfile: jest.fn(async (userId: string) => {
    const isSuperAdmin = userId === 'u-super';
    return {
      modules: {
        'dashboard-builder': {
          visible: true,
          actions: isSuperAdmin
            ? ['create','edit','delete','templates_use','templates_create']
            : ['templates_use'],
        },
      },
    };
  }),
}));

import templatesRouter from '../routes/dashboard-templates';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard-templates', templatesRouter);
  return app;
}

const ADMIN = { id: 'u-admin', role: 'ADMIN', companyId: 'co-1', permissions: [] };
const SUPER = { id: 'u-super', role: 'SUPER_ADMIN', companyId: 'co-1', permissions: [] };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/dashboard-templates', () => {
  it('retourne les templates globaux + company', async () => {
    mockPrisma.dashboardTemplate.findMany.mockResolvedValue([mockTemplate]);
    const res = await request(makeApp())
      .get('/api/dashboard-templates')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('403 sans companyId', async () => {
    const res = await request(makeApp()).get('/api/dashboard-templates');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/dashboard-templates', () => {
  it('403 si pas templates_create (ADMIN ordinaire)', async () => {
    const res = await request(makeApp())
      .post('/api/dashboard-templates')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ name: 'Mon Template' });
    expect(res.status).toBe(403);
  });

  it('SUPER_ADMIN peut créer un template global', async () => {
    mockPrisma.dashboardTemplate.create.mockResolvedValue({ ...mockTemplate, id: 't-new', name: 'Nouveau' });
    const res = await request(makeApp())
      .post('/api/dashboard-templates')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ name: 'Nouveau', isGlobal: true });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Nouveau');
  });

  it('400 si name manquant', async () => {
    const res = await request(makeApp())
      .post('/api/dashboard-templates')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/dashboard-templates/:id', () => {
  it('403 si pas templates_create', async () => {
    const res = await request(makeApp())
      .put('/api/dashboard-templates/t-1')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ name: 'Modifié' });
    expect(res.status).toBe(403);
  });

  it('404 si template inexistant', async () => {
    mockPrisma.dashboardTemplate.findUnique.mockResolvedValue(null);
    const res = await request(makeApp())
      .put('/api/dashboard-templates/inexistant')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ name: 'Modifié' });
    expect(res.status).toBe(404);
  });

  it('SUPER_ADMIN peut modifier un template global', async () => {
    mockPrisma.dashboardTemplate.findUnique.mockResolvedValue({ ...mockTemplate, widgets: [] });
    mockPrisma.dashboardTemplate.update.mockResolvedValue({ ...mockTemplate, name: 'Modifié', widgets: [] });
    const res = await request(makeApp())
      .put('/api/dashboard-templates/t-1')
      .set('x-test-user', JSON.stringify(SUPER))
      .send({ name: 'Modifié' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Modifié');
  });
});

describe('DELETE /api/dashboard-templates/:id', () => {
  it('403 si pas templates_create', async () => {
    const res = await request(makeApp())
      .delete('/api/dashboard-templates/t-1')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(403);
  });

  it('SUPER_ADMIN peut supprimer un template global', async () => {
    mockPrisma.dashboardTemplate.findUnique.mockResolvedValue(mockTemplate);
    mockPrisma.dashboardTemplate.delete.mockResolvedValue(mockTemplate);
    const res = await request(makeApp())
      .delete('/api/dashboard-templates/t-1')
      .set('x-test-user', JSON.stringify(SUPER));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/dashboard-templates/:id/apply', () => {
  it('crée une copie indépendante du template', async () => {
    mockPrisma.dashboardTemplate.findUnique.mockResolvedValue({ ...mockTemplate, widgets: [
      { id: 'tw-1', type: 'kpi_card', title: 'CA', config: {}, order: 0 },
    ]});
    mockPrisma.dashboard.create.mockResolvedValue({
      id: 'd-copy', name: 'Suivi Portefeuille', companyId: 'co-1', ownerId: 'u-admin',
      widgets: [], shares: [], layout: [], isShared: false,
    });
    mockPrisma.dashboardWidget.createMany.mockResolvedValue({ count: 1 });
    const res = await request(makeApp())
      .post('/api/dashboard-templates/t-1/apply')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ name: 'Mon Dashboard' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('d-copy');
  });

  it('403 si pas templates_use', async () => {
    // Override mock pour simuler aucune permission
    const { getMergedProfile } = require('../services/moduleProfileService');
    getMergedProfile.mockResolvedValueOnce({
      modules: { 'dashboard-builder': { visible: true, actions: [] } },
    });
    const res = await request(makeApp())
      .post('/api/dashboard-templates/t-1/apply')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({});
    expect(res.status).toBe(403);
  });

  it('404 si template inexistant', async () => {
    mockPrisma.dashboardTemplate.findUnique.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/dashboard-templates/inexistant/apply')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({});
    expect(res.status).toBe(404);
  });
});
