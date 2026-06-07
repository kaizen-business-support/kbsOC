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

const mockDashboard = {
  id: 'd-1',
  name: 'Mon Dashboard',
  description: null,
  companyId: 'co-1',
  ownerId: 'u-1',
  isShared: false,
  layout: [],
  templateSourceId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  widgets: [],
  shares: [],
  owner: { id: 'u-1', name: 'Alice', email: 'alice@test.com' },
};

const mockPrisma = {
  dashboard: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  dashboardWidget: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  dashboardShare: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../prismaClient', () => ({ prisma: mockPrisma }));

jest.mock('../services/moduleProfileService', () => ({
  getMergedProfile: jest.fn(async () => ({
    modules: {
      'dashboard-builder': { visible: true, actions: ['create','edit','delete','share','manage','export','templates_use'], sections: [] },
    },
  })),
}));

import dashboardsRouter from '../routes/dashboards';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboards', dashboardsRouter);
  return app;
}

const ADMIN = { id: 'u-1', role: 'ADMIN', companyId: 'co-1', permissions: [] };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/dashboards', () => {
  it('retourne les dashboards de la company', async () => {
    mockPrisma.dashboard.findMany.mockResolvedValue([mockDashboard]);
    const res = await request(makeApp())
      .get('/api/dashboards')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('d-1');
  });

  it('403 sans companyId', async () => {
    const res = await request(makeApp()).get('/api/dashboards');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/dashboards', () => {
  it('crée un dashboard et retourne 201', async () => {
    mockPrisma.dashboard.create.mockResolvedValue({ ...mockDashboard, name: 'Nouveau' });
    const res = await request(makeApp())
      .post('/api/dashboards')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ name: 'Nouveau', description: 'desc' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Nouveau');
  });

  it('400 si name manquant', async () => {
    const res = await request(makeApp())
      .post('/api/dashboards')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/dashboards/:id', () => {
  it('retourne le dashboard avec widgets et shares', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue(mockDashboard);
    const res = await request(makeApp())
      .get('/api/dashboards/d-1')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('d-1');
    expect(Array.isArray(res.body.data.widgets)).toBe(true);
  });

  it('404 si dashboard non trouvé', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue(null);
    const res = await request(makeApp())
      .get('/api/dashboards/inexistant')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(404);
  });

  it('403 si dashboard appartient à une autre company', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue({ ...mockDashboard, companyId: 'co-autre' });
    const res = await request(makeApp())
      .get('/api/dashboards/d-1')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/dashboards/:id', () => {
  it('met à jour le dashboard (owner)', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue(mockDashboard);
    mockPrisma.dashboard.update.mockResolvedValue({ ...mockDashboard, name: 'Modifié' });
    const res = await request(makeApp())
      .put('/api/dashboards/d-1')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ name: 'Modifié' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Modifié');
  });
});

describe('DELETE /api/dashboards/:id', () => {
  it('supprime le dashboard (owner)', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue(mockDashboard);
    mockPrisma.dashboard.delete.mockResolvedValue(mockDashboard);
    const res = await request(makeApp())
      .delete('/api/dashboards/d-1')
      .set('x-test-user', JSON.stringify(ADMIN));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/dashboards/:id/widgets', () => {
  it('ajoute un widget et met à jour le layout', async () => {
    mockPrisma.dashboard.findUnique.mockResolvedValue(mockDashboard);
    const newWidget = { id: 'w-1', dashboardId: 'd-1', type: 'kpi_card', title: 'CA Total', config: {}, order: 0 };
    mockPrisma.dashboardWidget.create.mockResolvedValue(newWidget);
    mockPrisma.dashboard.update.mockResolvedValue({ ...mockDashboard, layout: [{ i: 'w-1', x: 0, y: 0, w: 4, h: 2 }] });
    const res = await request(makeApp())
      .post('/api/dashboards/d-1/widgets')
      .set('x-test-user', JSON.stringify(ADMIN))
      .send({ type: 'kpi_card', title: 'CA Total', config: {}, position: { x: 0, y: 0, w: 4, h: 2 } });
    expect(res.status).toBe(201);
    expect(res.body.data.widget.type).toBe('kpi_card');
  });
});
