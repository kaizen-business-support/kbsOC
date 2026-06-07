# Dashboard Builder Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les bases du module Dashboard Builder : schéma DB, permissions dans le système de rôles existant, 15 endpoints API REST, et page skeleton frontend — tout en supprimant l'AnalyticsDashboardPage fixe.

**Architecture:** 5 nouveaux modèles Prisma (Dashboard, DashboardWidget, DashboardShare, DashboardTemplate, DashboardTemplateWidget) avec cloisonnement `companyId`. Le module `dashboard-builder` est ajouté au registre de modules existant (`moduleRegistry.ts` frontend + `defaultModuleProfiles.ts` backend). Les routes backend suivent le pattern Express + `authenticate` + `requireCompany` du projet.

**Tech Stack:** Prisma + PostgreSQL, Express Router, React + MUI, TypeScript, Jest + Supertest

**Spec:** `docs/superpowers/specs/2026-06-07-dashboard-builder-foundation-design.md`

---

## File Map

| Statut | Fichier | Rôle |
|---|---|---|
| Modifier | `backend/prisma/schema.prisma` | Ajout des 5 modèles |
| Créer | `backend/prisma/seed-dashboards.ts` | 3 templates globaux |
| Modifier | `backend/src/constants/defaultModuleProfiles.ts` | Droits dashboard-builder par rôle |
| Créer | `backend/src/routes/dashboards.ts` | CRUD dashboards + widgets + shares |
| Créer | `backend/src/routes/dashboard-templates.ts` | CRUD templates + apply |
| Modifier | `backend/src/server.ts` | Enregistrement des nouvelles routes |
| Créer | `backend/src/__tests__/dashboardsRoute.test.ts` | Tests routes dashboards |
| Créer | `backend/src/__tests__/dashboardTemplatesRoute.test.ts` | Tests routes templates |
| Modifier | `src/config/moduleRegistry.ts` | Déclaration module frontend |
| Créer | `src/pages/DashboardsPage.tsx` | Page skeleton |
| Modifier | `src/services/api.ts` | Méthodes ApiService dashboards |
| Modifier | `src/components/Sidebar.tsx` | Nouvelle entrée, suppression analytics |
| Modifier | `src/App.tsx` | Nouvelle route, suppression analytics |
| Supprimer | `src/pages/AnalyticsDashboardPage.tsx` | Remplacée par templates |

---

## Task 1 — Schéma Prisma : 5 nouveaux modèles

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1.1 : Ajouter les 5 modèles à la fin de schema.prisma**

Ouvrir `backend/prisma/schema.prisma` et ajouter à la fin du fichier :

```prisma
model Dashboard {
  id               String   @id @default(cuid())
  name             String
  description      String?
  companyId        String   @map("company_id")
  ownerId          String   @map("owner_id")
  isShared         Boolean  @default(false) @map("is_shared")
  layout           Json     @default("[]")
  templateSourceId String?  @map("template_source_id")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  company Company           @relation(fields: [companyId], references: [id])
  owner   User              @relation("DashboardOwner", fields: [ownerId], references: [id])
  widgets DashboardWidget[]
  shares  DashboardShare[]

  @@index([companyId])
  @@index([ownerId])
  @@map("dashboards")
}

model DashboardWidget {
  id          String @id @default(cuid())
  dashboardId String @map("dashboard_id")
  type        String
  title       String
  config      Json   @default("{}")
  order       Int    @default(0)

  dashboard Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  @@index([dashboardId])
  @@map("dashboard_widgets")
}

model DashboardShare {
  id          String   @id @default(cuid())
  dashboardId String   @map("dashboard_id")
  shareType   String
  targetId    String   @map("target_id")
  permission  String
  createdAt   DateTime @default(now()) @map("created_at")

  dashboard Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  @@unique([dashboardId, shareType, targetId])
  @@index([dashboardId])
  @@map("dashboard_shares")
}

model DashboardTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  companyId   String?  @map("company_id")
  isGlobal    Boolean  @default(false) @map("is_global")
  layout      Json     @default("[]")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company?                  @relation(fields: [companyId], references: [id])
  widgets DashboardTemplateWidget[]

  @@index([companyId])
  @@map("dashboard_templates")
}

model DashboardTemplateWidget {
  id         String @id @default(cuid())
  templateId String @map("template_id")
  type       String
  title      String
  config     Json   @default("{}")
  order      Int    @default(0)

  template DashboardTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@map("dashboard_template_widgets")
}
```

- [ ] **Step 1.2 : Ajouter les relations inverses sur User et Company**

Dans le modèle `User` existant (chercher `model User {`), ajouter dans les relations :
```prisma
  ownedDashboards Dashboard[] @relation("DashboardOwner")
```

Dans le modèle `Company` existant, ajouter :
```prisma
  dashboards         Dashboard[]
  dashboardTemplates DashboardTemplate[]
```

- [ ] **Step 1.3 : Générer et appliquer la migration**

```bash
cd backend
npx prisma migrate dev --name dashboard_builder_foundation
```

Résultat attendu : `The following migration(s) have been applied: .../dashboard_builder_foundation`

- [ ] **Step 1.4 : Vérifier que les tables existent**

```bash
npx prisma studio
```

Ou via psql : `\dt dashboards dashboard_widgets dashboard_shares dashboard_templates dashboard_template_widgets`

- [ ] **Step 1.5 : Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add Dashboard, Widget, Share, Template Prisma models"
```

---

## Task 2 — Permissions backend : defaultModuleProfiles.ts

**Files:**
- Modify: `backend/src/constants/defaultModuleProfiles.ts`

- [ ] **Step 2.1 : Ajouter dashboard-builder dans ALL_MODULES**

Dans `ALL_MODULES`, après la clé `'codir-dashboard'`, ajouter :

```typescript
  'dashboard-builder': {
    visible: true,
    actions: ['create','edit','delete','share','manage','export','templates_use','templates_create'],
    sections: [],
  },
```

- [ ] **Step 2.2 : Ajouter les droits par rôle dans DEFAULT_ROLE_PROFILES**

Pour chaque entrée de `DEFAULT_ROLE_PROFILES`, ajouter le module `dashboard-builder` dans l'appel `none({...})` :

**CHARGE_AFFAIRES, ANALYSTE_RISQUES, RESPONSABLE_RISQUES, RESPONSABLE_ENGAGEMENTS, COMITE_CREDIT, BACK_OFFICE, DIRECTION_JURIDIQUE** → accès analytique sans gestion :
```typescript
'dashboard-builder': { actions: ['create','edit','delete','share','export','templates_use'] },
```

**DIRECTION_GENERALE, ADMIN** → accès complet company :
```typescript
'dashboard-builder': { actions: ['create','edit','delete','share','manage','export','templates_use','templates_create'] },
```

**SUPER_ADMIN** → déjà dans `ALL_MODULES` qui est utilisé directement pour ce rôle. Vérifier que `ALL_MODULES` est passé au profil SUPER_ADMIN (il contient déjà toutes les actions).

- [ ] **Step 2.3 : Vérifier le test existant moduleProfileService.test.ts**

```bash
cd backend
npx jest src/__tests__/moduleProfileService.test.ts --passWithNoTests
```

Résultat attendu : tous les tests passent (les profils par défaut sont régénérés avec le nouveau module).

- [ ] **Step 2.4 : Commit**

```bash
git add backend/src/constants/defaultModuleProfiles.ts
git commit -m "feat(roles): add dashboard-builder module to all role profiles"
```

---

## Task 3 — Permissions frontend : moduleRegistry.ts

**Files:**
- Modify: `src/config/moduleRegistry.ts`

- [ ] **Step 3.1 : Ajouter le module dashboard-builder dans MODULE_REGISTRY**

Dans `src/config/moduleRegistry.ts`, dans le tableau `MODULE_REGISTRY`, avant les blocs `superAdminOnly`, ajouter :

```typescript
  {
    key: 'dashboard-builder',
    label: 'Dashboards & Rapports',
    actions: [
      { key: 'create',           label: 'Créer un dashboard' },
      { key: 'edit',             label: 'Modifier ses dashboards' },
      { key: 'delete',           label: 'Supprimer ses dashboards' },
      { key: 'share',            label: 'Partager un dashboard' },
      { key: 'manage',           label: 'Gérer tous les dashboards (company)' },
      { key: 'export',           label: 'Exporter en PDF/Excel' },
      { key: 'templates_use',    label: 'Utiliser les templates' },
      { key: 'templates_create', label: 'Créer/modifier des templates' },
    ],
    sections: [],
  },
```

- [ ] **Step 3.2 : Vérifier le build TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | grep moduleRegistry
```

Résultat attendu : aucune erreur sur moduleRegistry.ts.

- [ ] **Step 3.3 : Commit**

```bash
git add src/config/moduleRegistry.ts
git commit -m "feat(roles): declare dashboard-builder module in frontend registry"
```

---

## Task 4 — Backend : route dashboards (CRUD + widgets + shares)

**Files:**
- Create: `backend/src/routes/dashboards.ts`
- Create: `backend/src/__tests__/dashboardsRoute.test.ts`

- [ ] **Step 4.1 : Écrire les tests en premier**

Créer `backend/src/__tests__/dashboardsRoute.test.ts` :

```typescript
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
const VIEWER = { id: 'u-viewer', role: 'VIEWER', companyId: 'co-1', permissions: [] };

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
```

- [ ] **Step 4.2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd backend
npx jest src/__tests__/dashboardsRoute.test.ts 2>&1 | tail -20
```

Résultat attendu : `Cannot find module '../routes/dashboards'`

- [ ] **Step 4.3 : Créer le fichier de route**

Créer `backend/src/routes/dashboards.ts` :

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { getMergedProfile } from '../services/moduleProfileService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

async function canDashboardAction(userId: string, companyId: string, action: string): Promise<boolean> {
  try {
    const profile = await getMergedProfile(userId, companyId);
    const mod = (profile.modules as any)?.['dashboard-builder'];
    return mod?.visible === true && Array.isArray(mod?.actions) && mod.actions.includes(action);
  } catch {
    return false;
  }
}

async function getDashboardOrFail(id: string, companyId: string, res: Response): Promise<any | null> {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id },
    include: { widgets: true, shares: true, owner: { select: { id: true, name: true, email: true } } },
  });
  if (!dashboard) { res.status(404).json({ success: false, error: 'Dashboard introuvable' }); return null; }
  if (dashboard.companyId !== companyId) { res.status(403).json({ success: false, error: 'Accès interdit' }); return null; }
  return dashboard;
}

function canAccessDashboard(dashboard: any, userId: string, requiredPermission: 'VIEW' | 'EDIT'): boolean {
  if (dashboard.ownerId === userId) return true;
  return dashboard.shares.some((s: any) => {
    if (s.permission === 'VIEW' && requiredPermission === 'EDIT') return false;
    if (s.shareType === 'USER' && s.targetId === userId) return true;
    if (s.shareType === 'COMPANY' && s.targetId === dashboard.companyId) return true;
    return false;
  });
}

// GET /api/dashboards
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const dashboards = await prisma.dashboard.findMany({
      where: {
        OR: [
          { companyId, ownerId: userId },
          { companyId, shares: { some: { OR: [
            { shareType: 'USER', targetId: userId },
            { shareType: 'COMPANY', targetId: companyId },
          ]}}},
        ],
      },
      include: { widgets: true, shares: true, owner: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: dashboards });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboards
router.post('/', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'Le nom est obligatoire' });
  if (!(await canDashboardAction(req.user!.id, req.companyId!, 'create')))
    return res.status(403).json({ success: false, error: 'Permission create requise' });
  try {
    const dashboard = await prisma.dashboard.create({
      data: { name: name.trim(), description: description ?? null, companyId: req.companyId!, ownerId: req.user!.id, layout: [] },
      include: { widgets: true, shares: true },
    });
    res.status(201).json({ success: true, data: dashboard });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/dashboards/:id
router.get('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'VIEW'))
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  res.json({ success: true, data: dashboard });
});

// PUT /api/dashboards/:id
router.put('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' });
  try {
    const { name, description, layout } = req.body;
    const updated = await prisma.dashboard.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(layout !== undefined && { layout }),
      },
      include: { widgets: true, shares: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  const isOwner = dashboard.ownerId === req.user!.id;
  const canManage = await canDashboardAction(req.user!.id, req.companyId!, 'manage');
  if (!isOwner && !canManage)
    return res.status(403).json({ success: false, error: 'Seul le créateur ou un ADMIN peut supprimer ce dashboard' });
  try {
    await prisma.dashboard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Widgets ────────────────────────────────────────────────────────────────────

// POST /api/dashboards/:id/widgets
router.post('/:id/widgets', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' });
  const { type, title, config = {}, position } = req.body;
  if (!type || !title) return res.status(400).json({ success: false, error: 'type et title sont obligatoires' });
  try {
    const widget = await prisma.dashboardWidget.create({
      data: { dashboardId: req.params.id, type, title, config, order: 0 },
    });
    const currentLayout = Array.isArray(dashboard.layout) ? dashboard.layout as any[] : [];
    const newLayoutItem = { i: widget.id, x: position?.x ?? 0, y: position?.y ?? 0, w: position?.w ?? 4, h: position?.h ?? 2 };
    const updatedDashboard = await prisma.dashboard.update({
      where: { id: req.params.id },
      data: { layout: [...currentLayout, newLayoutItem] },
      include: { widgets: true },
    });
    res.status(201).json({ success: true, data: { widget, layout: updatedDashboard.layout } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboards/:id/widgets/:wid
router.put('/:id/widgets/:wid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' });
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.wid } });
  if (!widget || widget.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Widget introuvable' });
  try {
    const { type, title, config } = req.body;
    const updated = await prisma.dashboardWidget.update({
      where: { id: req.params.wid },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(config !== undefined && { config }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id/widgets/:wid
router.delete('/:id/widgets/:wid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'EDIT') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission edit requise' });
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.wid } });
  if (!widget || widget.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Widget introuvable' });
  try {
    await prisma.dashboardWidget.delete({ where: { id: req.params.wid } });
    const currentLayout = Array.isArray(dashboard.layout) ? dashboard.layout as any[] : [];
    await prisma.dashboard.update({
      where: { id: req.params.id },
      data: { layout: currentLayout.filter((item: any) => item.i !== req.params.wid) },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Shares ────────────────────────────────────────────────────────────────────

// GET /api/dashboards/:id/shares
router.get('/:id/shares', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (!canAccessDashboard(dashboard, req.user!.id, 'VIEW') &&
      !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  const shares = await prisma.dashboardShare.findMany({ where: { dashboardId: req.params.id } });
  res.json({ success: true, data: shares });
});

// POST /api/dashboards/:id/shares
router.post('/:id/shares', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' });
  const { shareType, targetId, permission } = req.body;
  if (!shareType || !targetId || !permission)
    return res.status(400).json({ success: false, error: 'shareType, targetId et permission sont obligatoires' });
  if (!['USER','ROLE','COMPANY'].includes(shareType))
    return res.status(400).json({ success: false, error: 'shareType invalide' });
  if (!['VIEW','EDIT'].includes(permission))
    return res.status(400).json({ success: false, error: 'permission invalide (VIEW ou EDIT)' });
  try {
    const share = await prisma.dashboardShare.create({
      data: { dashboardId: req.params.id, shareType, targetId, permission },
    });
    res.status(201).json({ success: true, data: share });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Ce partage existe déjà' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboards/:id/shares/:sid
router.put('/:id/shares/:sid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' });
  const { permission } = req.body;
  if (!['VIEW','EDIT'].includes(permission))
    return res.status(400).json({ success: false, error: 'permission invalide (VIEW ou EDIT)' });
  const share = await prisma.dashboardShare.findUnique({ where: { id: req.params.sid } });
  if (!share || share.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Partage introuvable' });
  try {
    const updated = await prisma.dashboardShare.update({ where: { id: req.params.sid }, data: { permission } });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboards/:id/shares/:sid
router.delete('/:id/shares/:sid', async (req: Request, res: Response) => {
  const dashboard = await getDashboardOrFail(req.params.id, req.companyId!, res);
  if (!dashboard) return;
  if (dashboard.ownerId !== req.user!.id && !(await canDashboardAction(req.user!.id, req.companyId!, 'manage')))
    return res.status(403).json({ success: false, error: 'Permission share requise' });
  const share = await prisma.dashboardShare.findUnique({ where: { id: req.params.sid } });
  if (!share || share.dashboardId !== req.params.id)
    return res.status(404).json({ success: false, error: 'Partage introuvable' });
  try {
    await prisma.dashboardShare.delete({ where: { id: req.params.sid } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
```

- [ ] **Step 4.4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd backend
npx jest src/__tests__/dashboardsRoute.test.ts --verbose
```

Résultat attendu : tous les tests ✓ PASS

- [ ] **Step 4.5 : Commit**

```bash
git add backend/src/routes/dashboards.ts backend/src/__tests__/dashboardsRoute.test.ts
git commit -m "feat(api): add dashboards CRUD + widgets + shares routes (TDD)"
```

---

## Task 5 — Backend : route dashboard-templates

**Files:**
- Create: `backend/src/routes/dashboard-templates.ts`
- Create: `backend/src/__tests__/dashboardTemplatesRoute.test.ts`

- [ ] **Step 5.1 : Écrire les tests en premier**

Créer `backend/src/__tests__/dashboardTemplatesRoute.test.ts` :

```typescript
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
});

describe('POST /api/dashboard-templates', () => {
  it('403 si pas templates_create', async () => {
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
});
```

- [ ] **Step 5.2 : Vérifier que les tests échouent**

```bash
cd backend
npx jest src/__tests__/dashboardTemplatesRoute.test.ts 2>&1 | tail -10
```

Résultat attendu : `Cannot find module '../routes/dashboard-templates'`

- [ ] **Step 5.3 : Créer la route**

Créer `backend/src/routes/dashboard-templates.ts` :

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { getMergedProfile } from '../services/moduleProfileService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

async function canTemplateAction(userId: string, companyId: string, action: string): Promise<boolean> {
  try {
    const profile = await getMergedProfile(userId, companyId);
    const mod = (profile.modules as any)?.['dashboard-builder'];
    return mod?.visible === true && Array.isArray(mod?.actions) && mod.actions.includes(action);
  } catch {
    return false;
  }
}

// GET /api/dashboard-templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const templates = await prisma.dashboardTemplate.findMany({
      where: { OR: [{ isGlobal: true }, { companyId }] },
      include: { widgets: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: templates });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboard-templates
router.post('/', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' });
  const { name, description, isGlobal = false, layout = [], widgets = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'Le nom est obligatoire' });
  const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
  const companyId = isGlobal && isSuperAdmin ? null : req.companyId!;
  try {
    const template = await prisma.dashboardTemplate.create({
      data: {
        name: name.trim(), description: description ?? null,
        companyId, isGlobal: isGlobal && isSuperAdmin, layout,
        widgets: { create: widgets.map((w: any, i: number) => ({ type: w.type, title: w.title, config: w.config ?? {}, order: i })) },
      },
      include: { widgets: true },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/dashboard-templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' });
  const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id }, include: { widgets: true } });
  if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' });
  if (template.isGlobal && req.user!.role !== 'SUPER_ADMIN')
    return res.status(403).json({ success: false, error: 'Seul SUPER_ADMIN peut modifier les templates globaux' });
  if (!template.isGlobal && template.companyId !== req.companyId)
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  try {
    const { name, description, layout } = req.body;
    const updated = await prisma.dashboardTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(layout !== undefined && { layout }),
      },
      include: { widgets: true },
    });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/dashboard-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_create')))
    return res.status(403).json({ success: false, error: 'Permission templates_create requise' });
  const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' });
  if (template.isGlobal && req.user!.role !== 'SUPER_ADMIN')
    return res.status(403).json({ success: false, error: 'Seul SUPER_ADMIN peut supprimer les templates globaux' });
  if (!template.isGlobal && template.companyId !== req.companyId)
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  try {
    await prisma.dashboardTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/dashboard-templates/:id/apply
router.post('/:id/apply', async (req: Request, res: Response) => {
  if (!(await canTemplateAction(req.user!.id, req.companyId!, 'templates_use')))
    return res.status(403).json({ success: false, error: 'Permission templates_use requise' });
  const template = await prisma.dashboardTemplate.findUnique({ where: { id: req.params.id }, include: { widgets: true } });
  if (!template) return res.status(404).json({ success: false, error: 'Template introuvable' });
  if (!template.isGlobal && template.companyId !== req.companyId)
    return res.status(403).json({ success: false, error: 'Accès interdit' });
  try {
    const name = req.body.name?.trim() || template.name;
    const dashboard = await prisma.dashboard.create({
      data: {
        name, description: template.description ?? null,
        companyId: req.companyId!, ownerId: req.user!.id,
        layout: template.layout, templateSourceId: template.id,
      },
    });
    if (template.widgets.length > 0) {
      await prisma.dashboardWidget.createMany({
        data: template.widgets.map(w => ({
          dashboardId: dashboard.id, type: w.type, title: w.title, config: w.config, order: w.order,
        })),
      });
    }
    const full = await prisma.dashboard.findUnique({
      where: { id: dashboard.id },
      include: { widgets: true, shares: true },
    });
    res.status(201).json({ success: true, data: full });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
```

- [ ] **Step 5.4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd backend
npx jest src/__tests__/dashboardTemplatesRoute.test.ts --verbose
```

Résultat attendu : tous les tests ✓ PASS

- [ ] **Step 5.5 : Commit**

```bash
git add backend/src/routes/dashboard-templates.ts backend/src/__tests__/dashboardTemplatesRoute.test.ts
git commit -m "feat(api): add dashboard-templates CRUD + apply route (TDD)"
```

---

## Task 6 — Enregistrer les routes dans server.ts

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 6.1 : Ajouter les imports**

Dans `backend/src/server.ts`, après les imports existants, ajouter :

```typescript
import dashboardRoutes from './routes/dashboards';
import dashboardTemplateRoutes from './routes/dashboard-templates';
```

- [ ] **Step 6.2 : Enregistrer les routes**

Dans `server.ts`, après la ligne `app.use('/api/analytics', ...protect, analyticsRoutes);`, ajouter :

```typescript
app.use('/api/dashboards',          ...protect, dashboardRoutes);
app.use('/api/dashboard-templates', ...protect, dashboardTemplateRoutes);
```

- [ ] **Step 6.3 : Vérifier le build**

```bash
cd backend
npx tsc --noEmit 2>&1 | grep -E "error|dashboards"
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 6.4 : Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(api): register dashboard and dashboard-template routes"
```

---

## Task 7 — Seed : 3 templates globaux prédéfinis

**Files:**
- Create: `backend/prisma/seed-dashboards.ts`

- [ ] **Step 7.1 : Créer le script de seed**

Créer `backend/prisma/seed-dashboards.ts` :

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_TEMPLATES = [
  {
    name: 'Suivi Portefeuille',
    description: 'Vue d\'ensemble du portefeuille de crédit : dossiers par statut, montants engagés, délais.',
    isGlobal: true,
    layout: [
      { i: 'tpl-w-1', x: 0, y: 0, w: 3, h: 2 },
      { i: 'tpl-w-2', x: 3, y: 0, w: 3, h: 2 },
      { i: 'tpl-w-3', x: 6, y: 0, w: 6, h: 4 },
    ],
    widgets: [
      { type: 'kpi_card', title: 'Dossiers en cours', config: { source: 'applications', metric: 'count', filter: { status: 'IN_PROGRESS' } }, order: 0 },
      { type: 'kpi_card', title: 'Montants engagés (XOF)', config: { source: 'applications', metric: 'sum_amount', filter: { status: 'APPROVED' } }, order: 1 },
      { type: 'bar_chart', title: 'Répartition par statut', config: { source: 'applications', groupBy: 'status' }, order: 2 },
    ],
  },
  {
    name: 'Performance Mensuelle',
    description: 'Suivi de la performance mensuelle : taux d\'approbation, volumes, délais de traitement.',
    isGlobal: true,
    layout: [
      { i: 'tpl-w-4', x: 0, y: 0, w: 6, h: 4 },
      { i: 'tpl-w-5', x: 6, y: 0, w: 6, h: 4 },
      { i: 'tpl-w-6', x: 0, y: 4, w: 4, h: 2 },
    ],
    widgets: [
      { type: 'line_chart', title: 'Nouveaux dossiers / mois', config: { source: 'applications', groupBy: 'month', metric: 'count' }, order: 0 },
      { type: 'bar_chart', title: 'Dossiers approuvés vs rejetés', config: { source: 'applications', groupBy: 'month', split: 'status' }, order: 1 },
      { type: 'kpi_card', title: 'Taux d\'approbation', config: { source: 'applications', metric: 'approval_rate' }, order: 2 },
    ],
  },
  {
    name: 'Conformité BCEAO',
    description: 'Tableau de bord normatif BCEAO : ratios réglementaires et alertes de dépassement.',
    isGlobal: true,
    layout: [
      { i: 'tpl-w-7', x: 0, y: 0, w: 4, h: 3 },
      { i: 'tpl-w-8', x: 4, y: 0, w: 4, h: 3 },
      { i: 'tpl-w-9', x: 8, y: 0, w: 4, h: 3 },
    ],
    widgets: [
      { type: 'gauge', title: 'Ratio de solvabilité', config: { source: 'analytics', metric: 'solvency_ratio', threshold: { warning: 8, critical: 6 } }, order: 0 },
      { type: 'gauge', title: 'Ratio de liquidité', config: { source: 'analytics', metric: 'liquidity_ratio', threshold: { warning: 100, critical: 80 } }, order: 1 },
      { type: 'kpi_card', title: 'Créances douteuses (%)', config: { source: 'analytics', metric: 'npl_ratio' }, order: 2 },
    ],
  },
];

export async function seedDashboardTemplates() {
  console.log('🌱 Seeding dashboard templates...');
  for (const tpl of GLOBAL_TEMPLATES) {
    const existing = await prisma.dashboardTemplate.findFirst({ where: { name: tpl.name, isGlobal: true } });
    if (existing) {
      console.log(`  ⏭  Template "${tpl.name}" already exists, skipping`);
      continue;
    }
    await prisma.dashboardTemplate.create({
      data: {
        name: tpl.name, description: tpl.description,
        companyId: null, isGlobal: tpl.isGlobal, layout: tpl.layout,
        widgets: { create: tpl.widgets },
      },
    });
    console.log(`  ✅ Template "${tpl.name}" created`);
  }
  console.log('✅ Dashboard templates seed complete');
}

if (require.main === module) {
  seedDashboardTemplates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 7.2 : Intégrer dans le seed principal**

Ouvrir `backend/prisma/seed.ts` (ou `seed.js`) et ajouter l'appel à `seedDashboardTemplates` :

```typescript
import { seedDashboardTemplates } from './seed-dashboards';

// Dans la fonction main(), après les seeds existants :
await seedDashboardTemplates();
```

- [ ] **Step 7.3 : Lancer le seed**

```bash
cd backend
npx ts-node prisma/seed-dashboards.ts
```

Résultat attendu :
```
🌱 Seeding dashboard templates...
  ✅ Template "Suivi Portefeuille" created
  ✅ Template "Performance Mensuelle" created
  ✅ Template "Conformité BCEAO" created
✅ Dashboard templates seed complete
```

- [ ] **Step 7.4 : Commit**

```bash
git add backend/prisma/seed-dashboards.ts backend/prisma/seed.ts
git commit -m "feat(seed): add 3 global dashboard templates (Portefeuille, Performance, BCEAO)"
```

---

## Task 8 — Frontend : ApiService — méthodes dashboards

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 8.1 : Ajouter les interfaces TypeScript**

Dans `src/services/api.ts`, après les interfaces existantes (chercher `export interface ApiResponse`), ajouter :

```typescript
export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  companyId: string;
  ownerId: string;
  isShared: boolean;
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  templateSourceId: string | null;
  createdAt: string;
  updatedAt: string;
  widgets: DashboardWidget[];
  shares: DashboardShare[];
  owner: { id: string; name: string; email: string };
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  config: Record<string, any>;
  order: number;
}

export interface DashboardShare {
  id: string;
  dashboardId: string;
  shareType: 'USER' | 'ROLE' | 'COMPANY';
  targetId: string;
  permission: 'VIEW' | 'EDIT';
  createdAt: string;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string | null;
  companyId: string | null;
  isGlobal: boolean;
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  widgets: Array<Omit<DashboardWidget, 'dashboardId'> & { templateId: string }>;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 8.2 : Ajouter les méthodes ApiService**

Dans la classe `ApiService`, à la fin (avant la fermeture `}`), ajouter :

```typescript
  // ── Dashboard Builder ──────────────────────────────────────────────────────

  static async getDashboards(): Promise<ApiResponse<Dashboard[]>> {
    try {
      const res = await api.get('/dashboards');
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async createDashboard(data: { name: string; description?: string }): Promise<ApiResponse<Dashboard>> {
    try {
      const res = await api.post('/dashboards', data);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async getDashboard(id: string): Promise<ApiResponse<Dashboard>> {
    try {
      const res = await api.get(`/dashboards/${id}`);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async updateDashboard(id: string, data: Partial<{ name: string; description: string; layout: any[] }>): Promise<ApiResponse<Dashboard>> {
    try {
      const res = await api.put(`/dashboards/${id}`, data);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async deleteDashboard(id: string): Promise<ApiResponse<void>> {
    try {
      const res = await api.delete(`/dashboards/${id}`);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async getDashboardTemplates(): Promise<ApiResponse<DashboardTemplate[]>> {
    try {
      const res = await api.get('/dashboard-templates');
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async applyDashboardTemplate(templateId: string, name?: string): Promise<ApiResponse<Dashboard>> {
    try {
      const res = await api.post(`/dashboard-templates/${templateId}/apply`, { name });
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }
```

- [ ] **Step 8.3 : Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "api.ts"
```

Résultat attendu : aucune erreur.

- [ ] **Step 8.4 : Commit**

```bash
git add src/services/api.ts
git commit -m "feat(frontend): add Dashboard ApiService methods and TypeScript interfaces"
```

---

## Task 9 — Frontend : DashboardsPage skeleton

**Files:**
- Create: `src/pages/DashboardsPage.tsx`

- [ ] **Step 9.1 : Créer la page**

Créer `src/pages/DashboardsPage.tsx` :

```typescript
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActionArea,
  Grid, Chip, Avatar, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Tabs, Tab,
  IconButton, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  DashboardCustomize as TemplateIcon,
  Dashboard as DashboardIcon,
  Share as ShareIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { ApiService, Dashboard, DashboardTemplate } from '../services/api';
import { useModuleAccess } from '../hooks/useModuleAccess';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 2px 16px rgba(0,0,0,0.07)';

export const DashboardsPage: React.FC = () => {
  const { canAction } = useModuleAccess();
  const canCreate      = canAction('dashboard-builder', 'create');
  const canUseTemplate = canAction('dashboard-builder', 'templates_use');

  const [tabValue, setTabValue] = useState(0);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog : nouveau dashboard
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Dialog : choisir un template
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await ApiService.getDashboards();
    if (res.success && res.data) {
      setDashboards(res.data);
    } else {
      setError(res.error || 'Erreur lors du chargement');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await ApiService.createDashboard({ name: newName.trim(), description: newDesc.trim() || undefined });
    setCreating(false);
    if (res.success) {
      setNewDialogOpen(false);
      setNewName('');
      setNewDesc('');
      load();
    } else {
      setError(res.error || 'Erreur lors de la création');
    }
  };

  const openTemplateDialog = async () => {
    setTemplateDialogOpen(true);
    setLoadingTemplates(true);
    const res = await ApiService.getDashboardTemplates();
    if (res.success && res.data) setTemplates(res.data);
    setLoadingTemplates(false);
  };

  const handleApplyTemplate = async (templateId: string, templateName: string) => {
    setApplyingTemplate(templateId);
    const res = await ApiService.applyDashboardTemplate(templateId, templateName);
    setApplyingTemplate(null);
    if (res.success) {
      setTemplateDialogOpen(false);
      load();
    } else {
      setError(res.error || 'Erreur lors de l\'application du template');
    }
  };

  const myDashboards = dashboards.filter(d => !d.shares?.some(s => s.shareType !== 'USER' || s.targetId !== d.ownerId));
  const sharedDashboards = dashboards.filter(d => d.ownerId !== (dashboards[0]?.ownerId ?? ''));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#1a1a2e">Mes Dashboards</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Créez et gérez vos tableaux de bord personnalisés
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {canUseTemplate && (
            <Button variant="outlined" startIcon={<TemplateIcon />} onClick={openTemplateDialog} sx={{ borderRadius: 3 }}>
              Depuis un template
            </Button>
          )}
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDialogOpen(true)}
              sx={{ borderRadius: 3, background: 'linear-gradient(135deg, #1565c0, #0277bd)', boxShadow: '0 4px 16px rgba(21,101,192,0.35)' }}>
              Nouveau
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`Mes dashboards (${dashboards.length})`} />
          <Tab label="Partagés avec moi" />
        </Tabs>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : dashboards.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <DashboardIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>Aucun dashboard</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Créez votre premier dashboard ou partez d'un template.
          </Typography>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDialogOpen(true)} sx={{ borderRadius: 3 }}>
              Créer un dashboard
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {dashboards.map(d => (
            <Grid item xs={12} sm={6} md={4} key={d.id}>
              <Card sx={{ borderRadius: `${CARD_RADIUS}px`, boxShadow: CARD_SHADOW, border: '1px solid rgba(0,0,0,0.06)', height: '100%' }}>
                <CardActionArea
                  onClick={() => {/* éditeur disponible sous-projet 3 */}}
                  sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  {/* Preview placeholder */}
                  <Box sx={{
                    height: 120, bgcolor: '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                  }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <DashboardIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 0.5 }} />
                      <Typography variant="caption" color="text.disabled">
                        {d.widgets.length} widget{d.widgets.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="#1a1a2e" gutterBottom noWrap>
                      {d.name}
                    </Typography>
                    {d.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        {d.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
                      {d.isShared && <Chip icon={<ShareIcon sx={{ fontSize: 12 }} />} label="Partagé" size="small" color="primary" variant="outlined" />}
                      {d.templateSourceId && <Chip label="Template" size="small" variant="outlined" />}
                      <Chip icon={<ScheduleIcon sx={{ fontSize: 12 }} />} label={formatDate(d.updatedAt)} size="small" sx={{ ml: 'auto', color: 'text.secondary', bgcolor: '#f8fafc' }} />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog : nouveau dashboard */}
      <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Nouveau dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nom *" value={newName}
            onChange={e => setNewName(e.target.value)} sx={{ mt: 1, mb: 2 }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <TextField
            fullWidth label="Description (optionnelle)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)} multiline rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || creating} sx={{ borderRadius: 2 }}>
            {creating ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : templates */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Choisir un template</DialogTitle>
        <DialogContent>
          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {templates.map(t => (
                <Grid item xs={12} sm={6} key={t.id}>
                  <Card variant="outlined" sx={{ borderRadius: 3, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 12px rgba(21,101,192,0.15)' } }}>
                    <CardActionArea onClick={() => handleApplyTemplate(t.id, t.name)} disabled={applyingTemplate === t.id}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <Avatar sx={{ bgcolor: '#e3f2fd', width: 36, height: 36 }}>
                            <TemplateIcon sx={{ fontSize: 18, color: '#1565c0' }} />
                          </Avatar>
                          <Typography variant="subtitle2" fontWeight={700}>{t.name}</Typography>
                          {t.isGlobal && <Chip label="Global" size="small" color="info" sx={{ ml: 'auto', fontSize: '0.65rem' }} />}
                        </Box>
                        {t.description && (
                          <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                        )}
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                          {t.widgets.length} widget{t.widgets.length !== 1 ? 's' : ''}
                        </Typography>
                        {applyingTemplate === t.id && (
                          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTemplateDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
```

- [ ] **Step 9.2 : Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "DashboardsPage"
```

Résultat attendu : aucune erreur.

- [ ] **Step 9.3 : Commit**

```bash
git add src/pages/DashboardsPage.tsx
git commit -m "feat(frontend): add DashboardsPage skeleton with create/template dialogs"
```

---

## Task 10 — Frontend : Sidebar + App.tsx + suppression AnalyticsDashboardPage

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`
- Delete: `src/pages/AnalyticsDashboardPage.tsx`

- [ ] **Step 10.1 : Mettre à jour Sidebar.tsx**

Dans `src/components/Sidebar.tsx` :

**a) Ajouter la permission guard** (après les canView* existants) :
```typescript
const canViewDashboardBuilder = canAccess('dashboard-builder');
```

**b) Dans `dashboardItems`, remplacer l'entrée `analytics` par `dashboard-builder`** :

Trouver le tableau `dashboardItems` et remplacer la ligne avec `canViewAnalytics` :
```typescript
// AVANT :
...(canViewAnalytics ? [{ id: 'analytics' as PageType, label: t('navigation.analytics'), icon: InsightsIcon }] : []),

// APRÈS :
...(canViewDashboardBuilder ? [{ id: 'dashboard-builder' as PageType, label: 'Mes Dashboards', icon: DashboardIcon }] : []),
```

- [ ] **Step 10.2 : Mettre à jour App.tsx**

Dans `src/App.tsx` :

**a) Remplacer l'import lazy AnalyticsDashboardPage** :
```typescript
// SUPPRIMER :
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage').then(m => ({ default: m.AnalyticsDashboardPage })));

// AJOUTER :
const DashboardsPage = lazy(() => import('./pages/DashboardsPage').then(m => ({ default: m.DashboardsPage })));
```

**b) Remplacer la route `/analytics`** :
```typescript
// SUPPRIMER :
<Route path="/analytics" element={
  <ProtectedRoute permissions={['analytics']} moduleKey="analytics">
    <AnalyticsDashboardPage />
  </ProtectedRoute>
} />

// AJOUTER :
<Route path="/dashboard-builder" element={
  <ProtectedRoute moduleKey="dashboard-builder">
    <DashboardsPage />
  </ProtectedRoute>
} />
```

- [ ] **Step 10.3 : Supprimer AnalyticsDashboardPage.tsx**

```bash
git rm src/pages/AnalyticsDashboardPage.tsx
```

Vérifier qu'aucun autre fichier n'importe `AnalyticsDashboardPage` :
```bash
grep -rn "AnalyticsDashboardPage" src/ --include="*.tsx" --include="*.ts"
```

Résultat attendu : aucun résultat.

- [ ] **Step 10.4 : Vérifier le build complet**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 10.5 : Lancer tous les tests backend**

```bash
cd backend
npx jest --passWithNoTests 2>&1 | tail -20
```

Résultat attendu : tous les tests ✓ PASS, aucune régression.

- [ ] **Step 10.6 : Commit final**

```bash
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(frontend): wire dashboard-builder to sidebar + routing, remove AnalyticsDashboardPage"
```

---

## Récapitulatif

| Task | Statut | Commit |
|---|---|---|
| 1 — Prisma schema | | `feat(db): add Dashboard, Widget, Share, Template Prisma models` |
| 2 — defaultModuleProfiles | | `feat(roles): add dashboard-builder module to all role profiles` |
| 3 — moduleRegistry frontend | | `feat(roles): declare dashboard-builder module in frontend registry` |
| 4 — Route dashboards (TDD) | | `feat(api): add dashboards CRUD + widgets + shares routes (TDD)` |
| 5 — Route templates (TDD) | | `feat(api): add dashboard-templates CRUD + apply route (TDD)` |
| 6 — Enregistrement routes | | `feat(api): register dashboard and dashboard-template routes` |
| 7 — Seed templates | | `feat(seed): add 3 global dashboard templates` |
| 8 — ApiService frontend | | `feat(frontend): add Dashboard ApiService methods and TypeScript interfaces` |
| 9 — DashboardsPage | | `feat(frontend): add DashboardsPage skeleton with create/template dialogs` |
| 10 — Sidebar + App.tsx | | `feat(frontend): wire dashboard-builder to sidebar + routing` |

**Résultat livrable :** Module Foundation complet — schéma DB, 15 endpoints API testés, module de permissions enregistré, page skeleton fonctionnelle avec création et choix de template. Prêt pour le sous-projet 2 (Widget Library + Data Sources).
