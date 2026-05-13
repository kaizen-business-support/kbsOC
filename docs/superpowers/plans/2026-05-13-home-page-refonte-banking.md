# Refonte home page banking pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la home actuelle (multicolore, gradients) par une page d'accueil claire/sobre/banking pro, avec hero + 4 KPIs adaptés au rôle + grille de modules accessibles, animations subtiles (intensité moyenne) et palette navy unique.

**Architecture:** Décomposer la `HomePage.tsx` actuelle (639 lignes) en composants ciblés (`HomeHero`, `HomeKpiBand`, `HomeKpiCard`, `HomeModuleGrid`, `HomeModuleCard`). Extraire le gating de modules de `Sidebar.tsx` dans un hook partagé `useAccessibleModules()`. Côté backend, ajouter un endpoint dédié `GET /api/home/kpis` qui dispatch les 4 KPIs selon le rôle, en s'appuyant sur les requêtes Prisma déjà disponibles.

**Tech Stack:** React 18 + TypeScript + MUI + axios (front) ; Node.js + Express + Prisma + Jest (back).

**Spec:** `docs/superpowers/specs/2026-05-13-home-page-refonte-banking-design.md`

---

## File structure

- **Backend — Create**
  - `backend/src/services/homeKpiService.ts` — `buildHomeKpisForUser(user, companyId): Promise<HomeKpi[]>`
  - `backend/src/routes/home-kpis.ts` — `GET /api/home/kpis`
  - `backend/src/__tests__/homeKpiService.test.ts` — snapshot par rôle

- **Backend — Modify**
  - `backend/src/server.ts` (ou `backend/src/index.ts`) — monter la nouvelle route

- **Frontend — Create**
  - `src/components/home/homeTokens.ts` — palette + transitions + shadows (export `as const`)
  - `src/components/home/HomeHero.tsx`
  - `src/components/home/HomeKpiCard.tsx`
  - `src/components/home/HomeKpiBand.tsx`
  - `src/components/home/HomeModuleCard.tsx`
  - `src/components/home/HomeModuleGrid.tsx`
  - `src/hooks/useAccessibleModules.ts` — single source of truth Sidebar/Home
  - `src/hooks/useHomeKpis.ts` — fetch + cache local

- **Frontend — Modify**
  - `src/services/api.ts` — `ApiService.getHomeKpis()`
  - `src/components/Sidebar.tsx` — consomme `useAccessibleModules()` + polish visuel (palette, icônes, espacements)
  - `src/pages/HomePage.tsx` — réécriture complète (orchestrateur léger)

---

## Task 1 — Backend : helper de format des KPIs (pur, testable)

**Files:**
- Create: `backend/src/services/homeKpiService.ts`
- Create: `backend/src/__tests__/homeKpiService.test.ts`

Avant de toucher à Prisma, on isole la logique de **mapping rôle → liste des keys de KPI** dans une fonction pure facilement testable. La récupération des valeurs viendra en Task 2.

- [ ] **Step 1.1 — Test qui échoue**

Créer `backend/src/__tests__/homeKpiService.test.ts` :

```typescript
import { getKpiKeysForRole } from '../services/homeKpiService';

describe('getKpiKeysForRole', () => {
  it('CHARGE_AFFAIRES → 4 KPIs orientés portefeuille', () => {
    expect(getKpiKeysForRole('CHARGE_AFFAIRES')).toEqual([
      'my_in_progress', 'my_exposure', 'signed_month', 'alerts',
    ]);
  });

  it('ASSISTANT_COMMERCIAL → identique à CHARGE_AFFAIRES', () => {
    expect(getKpiKeysForRole('ASSISTANT_COMMERCIAL'))
      .toEqual(getKpiKeysForRole('CHARGE_AFFAIRES'));
  });

  it('ANALYSTE_RISQUES / RESPONSABLE_RISQUES / BACK_OFFICE → file & SLA', () => {
    const expected = ['queue', 'sla_pct', 'approval_rate', 'overdue'];
    expect(getKpiKeysForRole('ANALYSTE_RISQUES')).toEqual(expected);
    expect(getKpiKeysForRole('RESPONSABLE_RISQUES')).toEqual(expected);
    expect(getKpiKeysForRole('BACK_OFFICE')).toEqual(expected);
  });

  it('DIRECTION_GENERALE / COMITE_CREDIT / DIR_AG → vue globale', () => {
    const expected = ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'];
    expect(getKpiKeysForRole('DIRECTION_GENERALE')).toEqual(expected);
    expect(getKpiKeysForRole('COMITE_CREDIT')).toEqual(expected);
    expect(getKpiKeysForRole('DIR_AG')).toEqual(expected);
  });

  it('RESPONSABLE_ENGAGEMENTS / DIRECTION_JURIDIQUE → légal', () => {
    const expected = ['queue', 'signed_month', 'legal_avg_duration', 'overdue'];
    expect(getKpiKeysForRole('RESPONSABLE_ENGAGEMENTS')).toEqual(expected);
    expect(getKpiKeysForRole('DIRECTION_JURIDIQUE')).toEqual(expected);
  });

  it('ADMIN / SUPER_ADMIN → vue système', () => {
    const expected = ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'];
    expect(getKpiKeysForRole('ADMIN')).toEqual(expected);
    expect(getKpiKeysForRole('SUPER_ADMIN')).toEqual(expected);
  });

  it('rôle inconnu → fallback générique', () => {
    expect(getKpiKeysForRole('UNKNOWN' as any)).toEqual([
      'my_in_progress', 'signed_month', 'approval_rate', 'alerts',
    ]);
  });
});
```

- [ ] **Step 1.2 — Lancer**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/homeKpiService.test.ts`
Expected: FAIL — `Cannot find module '../services/homeKpiService'`.

- [ ] **Step 1.3 — Implémenter**

Créer `backend/src/services/homeKpiService.ts` :

```typescript
import { UserRole } from '@prisma/client';

/**
 * Identifiants stables de chaque KPI. Le frontend mappe key → label localisé.
 */
export type HomeKpiKey =
  | 'my_in_progress' | 'my_exposure' | 'signed_month' | 'alerts'
  | 'queue' | 'sla_pct' | 'approval_rate' | 'overdue'
  | 'volume_total' | 'exposure_total' | 'avg_duration' | 'legal_avg_duration'
  | 'active_users_30d';

export type HomeKpiFormat = 'number' | 'currency' | 'percent' | 'duration';

export interface HomeKpi {
  key: HomeKpiKey;
  label: string;          // français, prêt à afficher
  value: number | null;   // null si erreur d'agrégation
  format: HomeKpiFormat;
  trend?: { delta: number; direction: 'up' | 'down' } | null;
  error?: boolean;
}

const ROLE_KPI_MAP: Record<UserRole, HomeKpiKey[]> = {
  CHARGE_AFFAIRES:         ['my_in_progress', 'my_exposure', 'signed_month', 'alerts'],
  ASSISTANT_COMMERCIAL:    ['my_in_progress', 'my_exposure', 'signed_month', 'alerts'],
  ANALYSTE_RISQUES:        ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  RESPONSABLE_RISQUES:     ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  BACK_OFFICE:             ['queue', 'sla_pct', 'approval_rate', 'overdue'],
  DIRECTION_GENERALE:      ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  COMITE_CREDIT:           ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  DIR_AG:                  ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'],
  RESPONSABLE_ENGAGEMENTS: ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  DIRECTION_JURIDIQUE:     ['queue', 'signed_month', 'legal_avg_duration', 'overdue'],
  ADMIN:                   ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'],
  SUPER_ADMIN:             ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'],
};

const FALLBACK_KPIS: HomeKpiKey[] = ['my_in_progress', 'signed_month', 'approval_rate', 'alerts'];

export function getKpiKeysForRole(role: UserRole | string): HomeKpiKey[] {
  return ROLE_KPI_MAP[role as UserRole] ?? FALLBACK_KPIS;
}
```

- [ ] **Step 1.4 — Vérifier**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/homeKpiService.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 1.5 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/services/homeKpiService.ts backend/src/__tests__/homeKpiService.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home-kpis): mapping rôle → liste de KPIs (pur, testable)"
```

---

## Task 2 — Backend : calcul des valeurs KPI + route Express

**Files:**
- Modify: `backend/src/services/homeKpiService.ts` — ajouter `buildHomeKpisForUser`
- Create: `backend/src/routes/home-kpis.ts`
- Modify: `backend/src/server.ts` — monter la route
- Create: `backend/src/__tests__/homeKpisRoute.test.ts` — test d'intégration light

- [ ] **Step 2.1 — Test d'intégration**

Créer `backend/src/__tests__/homeKpisRoute.test.ts` :

```typescript
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import homeKpisRouter from '../routes/home-kpis';

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

const prisma = new PrismaClient();
const COMPANY = 'company-home-kpis';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/home', homeKpisRouter);
  return app;
}

const BO = { id: 'u-bo-h', role: 'BACK_OFFICE', branch: null, department: null, companyId: COMPANY, permissions: [] };
const CA = { id: 'u-ca-h', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_X', department: null, companyId: COMPANY, permissions: [] };

describe('GET /api/home/kpis', () => {
  beforeAll(async () => {
    await prisma.company.create({ data: { id: COMPANY, name: 'KPI Test', slug: 'kpi-test' } });
    await prisma.user.createMany({
      data: [BO, CA].map(u => ({
        id: u.id, email: `${u.id}@test.local`, password: 'x', name: u.id, role: u.role as any,
        branch: u.branch, department: u.department, companyId: u.companyId,
      })),
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { companyId: COMPANY } });
    await prisma.company.delete({ where: { id: COMPANY } });
    await prisma.$disconnect();
  });

  it('renvoie 4 KPIs pour BACK_OFFICE avec les bonnes keys', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(BO));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.kpis).toHaveLength(4);
    expect(res.body.kpis.map((k: any) => k.key)).toEqual(['queue', 'sla_pct', 'approval_rate', 'overdue']);
  });

  it('renvoie 4 KPIs pour CHARGE_AFFAIRES avec les bonnes keys', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(CA));
    expect(res.status).toBe(200);
    expect(res.body.kpis.map((k: any) => k.key))
      .toEqual(['my_in_progress', 'my_exposure', 'signed_month', 'alerts']);
  });

  it('chaque KPI a label, value (nullable) et format', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify(BO));
    for (const k of res.body.kpis) {
      expect(typeof k.label).toBe('string');
      expect(['number', 'currency', 'percent', 'duration']).toContain(k.format);
      expect(k.value === null || typeof k.value === 'number').toBe(true);
    }
  });

  it('403 si pas de companyId', async () => {
    const res = await request(makeApp())
      .get('/api/home/kpis')
      .set('x-test-user', JSON.stringify({ ...BO, companyId: undefined }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2.2 — Lancer**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/homeKpisRoute.test.ts`
Expected: FAIL — la route et `buildHomeKpisForUser` n'existent pas.

- [ ] **Step 2.3 — Implémenter le calcul des valeurs**

Ajouter à `backend/src/services/homeKpiService.ts` (en dessous de l'existant) :

```typescript
import { prisma } from '../prismaClient';

interface UserCtx { id: string; role: string; }

const LABELS: Record<HomeKpiKey, string> = {
  my_in_progress:    'Mes dossiers en cours',
  my_exposure:       'Encours de mes clients',
  signed_month:      'Contrats signés (mois)',
  alerts:            'Échéances en alerte',
  queue:             'À traiter',
  sla_pct:           'SLA respecté',
  approval_rate:     "Taux d'approbation",
  overdue:           'Étapes en retard',
  volume_total:      'Volume global',
  exposure_total:    'Encours total',
  avg_duration:      'Durée moyenne traitement',
  legal_avg_duration:'Délai juridique moyen',
  active_users_30d:  'Utilisateurs actifs (30j)',
};

const FORMATS: Record<HomeKpiKey, HomeKpiFormat> = {
  my_in_progress: 'number',
  my_exposure: 'currency',
  signed_month: 'number',
  alerts: 'number',
  queue: 'number',
  sla_pct: 'percent',
  approval_rate: 'percent',
  overdue: 'number',
  volume_total: 'number',
  exposure_total: 'currency',
  avg_duration: 'duration',
  legal_avg_duration: 'duration',
  active_users_30d: 'number',
};

async function safeNumber(fn: () => Promise<number | null>): Promise<{ value: number | null; error: boolean }> {
  try {
    const v = await fn();
    return { value: v, error: false };
  } catch (e) {
    console.warn('[homeKpiService] KPI computation failed', e);
    return { value: null, error: true };
  }
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function computeKpi(key: HomeKpiKey, user: UserCtx, companyId: string): Promise<HomeKpi> {
  const { value, error } = await safeNumber(async () => {
    switch (key) {
      case 'my_in_progress':
        return prisma.creditApplication.count({
          where: { companyId, createdBy: user.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        });
      case 'my_exposure': {
        const r = await prisma.creditApplication.aggregate({
          _sum: { amount: true },
          where: { companyId, createdBy: user.id, status: 'DISBURSED' },
        });
        return Number(r._sum.amount ?? 0);
      }
      case 'signed_month':
        return prisma.document.count({
          where: {
            category: 'CONTRACT',
            createdAt: { gte: startOfMonth() },
            application: { companyId },
          },
        });
      case 'alerts':
      case 'overdue':
        return prisma.workflowStep.count({
          where: {
            application: { companyId },
            deadline: { lt: new Date() },
            completedAt: null,
          },
        });
      case 'queue':
        return prisma.workflowStep.count({
          where: {
            application: { companyId },
            role: user.role,
            status: { in: ['PENDING', 'IN_REVIEW'] },
          },
        });
      case 'sla_pct': {
        const completed = await prisma.workflowStep.findMany({
          where: {
            application: { companyId },
            role: user.role,
            completedAt: { not: null },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
          },
          select: { isOverdue: true },
        });
        if (completed.length === 0) return null;
        const onTime = completed.filter(s => !s.isOverdue).length;
        return Math.round((onTime / completed.length) * 100);
      }
      case 'approval_rate': {
        const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
        const apps = await prisma.creditApplication.findMany({
          where: { companyId, status: { in: ['APPROVED', 'REJECTED'] }, updatedAt: { gte: since } },
          select: { status: true },
        });
        if (apps.length === 0) return null;
        const ok = apps.filter(a => a.status === 'APPROVED').length;
        return Math.round((ok / apps.length) * 100);
      }
      case 'volume_total':
        return prisma.creditApplication.count({ where: { companyId } });
      case 'exposure_total': {
        const r = await prisma.creditApplication.aggregate({
          _sum: { amount: true },
          where: { companyId, status: 'DISBURSED' },
        });
        return Number(r._sum.amount ?? 0);
      }
      case 'avg_duration': {
        const apps = await prisma.creditApplication.findMany({
          where: { companyId, totalDurationMinutes: { not: null } },
          select: { totalDurationMinutes: true },
        });
        if (apps.length === 0) return null;
        const sum = apps.reduce((s, a) => s + (a.totalDurationMinutes ?? 0), 0);
        return Math.round(sum / apps.length);  // minutes
      }
      case 'legal_avg_duration': {
        const steps = await prisma.workflowStep.findMany({
          where: {
            application: { companyId },
            durationMinutes: { not: null },
            policyStep: { stepType: 'LEGAL' },
          },
          select: { durationMinutes: true },
        });
        if (steps.length === 0) return null;
        const sum = steps.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
        return Math.round(sum / steps.length);
      }
      case 'active_users_30d':
        return prisma.user.count({
          where: {
            companyId,
            lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
          },
        });
    }
  });
  return { key, label: LABELS[key], value, format: FORMATS[key], error: error || undefined };
}

export async function buildHomeKpisForUser(
  user: UserCtx,
  companyId: string
): Promise<HomeKpi[]> {
  const keys = getKpiKeysForRole(user.role);
  return Promise.all(keys.map(k => computeKpi(k, user, companyId)));
}
```

Note : si la colonne `lastLoginAt` n'existe pas sur `User`, remplacer le cas `active_users_30d` par `prisma.user.count({ where: { companyId, updatedAt: { gte: ... } } })` ou laisser fallback à null. Vérifier `backend/prisma/schema.prisma` avant — utiliser `grep -n "lastLoginAt" backend/prisma/schema.prisma`.

- [ ] **Step 2.4 — Implémenter la route**

Créer `backend/src/routes/home-kpis.ts` :

```typescript
import { Router, Request, Response } from 'express';
import { authenticate, requireCompany } from '../middleware/auth';
import { buildHomeKpisForUser } from '../services/homeKpiService';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const kpis = await buildHomeKpisForUser(
      { id: req.user!.id, role: req.user!.role as string },
      req.companyId!
    );
    res.json({ success: true, kpis });
  } catch (error) {
    console.error('Error fetching home KPIs:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des KPIs' });
  }
});

export default router;
```

- [ ] **Step 2.5 — Monter la route**

Trouver le fichier qui monte les routes (probablement `backend/src/server.ts` ou `backend/src/index.ts`). Lire la zone qui contient `app.use('/api/clients', ...)`. Ajouter à côté :

```typescript
import homeKpisRouter from './routes/home-kpis';
// ...
app.use('/api/home', homeKpisRouter);
```

- [ ] **Step 2.6 — Lancer les tests**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/homeKpisRoute.test.ts src/__tests__/homeKpiService.test.ts`
Expected: tous passent (4 + 7 = 11).

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2.7 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/src/services/homeKpiService.ts backend/src/routes/home-kpis.ts backend/src/server.ts backend/src/__tests__/homeKpisRoute.test.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home-kpis): endpoint GET /api/home/kpis avec calcul par rôle

Chaque KPI est calculé indépendamment et isolé en try/catch : une
erreur d'agrégation renvoie value: null + error: true sans casser
les autres."
```

---

## Task 3 — Frontend : design tokens

**Files:**
- Create: `src/components/home/homeTokens.ts`

- [ ] **Step 3.1 — Créer le module**

```typescript
// src/components/home/homeTokens.ts
// Tokens partagés par tous les composants de la home page.
// Aucun usage en dehors de src/components/home/.

export const colors = {
  bg: {
    page:    '#F8FAFC',
    surface: '#FFFFFF',
    subtle:  '#F1F5F9',
  },
  accent: {
    primary: '#1F4E79',
    hover:   '#2A5E92',
    muted:   '#E0E9F2',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#475569',
    muted:     '#94A3B8',
  },
  border: {
    default: '#E2E8F0',
  },
} as const;

export const shadows = {
  card:      '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.02)',
  cardHover: '0 6px 16px rgba(15,23,42,0.08)',
} as const;

export const radii = {
  card: 12,
  chip: 999,
} as const;

export const transitions = {
  fast:  '180ms cubic-bezier(0.22,1,0.36,1)',
  enter: '320ms cubic-bezier(0.22,1,0.36,1)',
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 3.2 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/home/homeTokens.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home): design tokens partagés (palette navy, transitions, shadows)"
```

---

## Task 4 — Frontend : hook useAccessibleModules (single source of truth)

**Files:**
- Create: `src/hooks/useAccessibleModules.ts`
- Create: `src/hooks/__tests__/useAccessibleModules.test.tsx` (si l'infra de test front existe ; sinon créer ailleurs)

Ce hook centralise la logique de gating qui était dans `Sidebar.tsx` (lignes 122-145). On l'extrait dès maintenant pour que Sidebar (Task 5) et HomePage (Task 9) le consomment toutes les deux.

- [ ] **Step 4.1 — Créer le hook**

```typescript
// src/hooks/useAccessibleModules.ts
import {
  GroupsOutlined, NoteAddOutlined, AccountTreeOutlined, InsightsOutlined,
  EditNoteOutlined, QueryStatsOutlined, SummarizeOutlined, ManageAccountsOutlined,
  CreditCardOutlined, GavelOutlined, EventNoteOutlined, BackupOutlined,
  CampaignOutlined, NotificationsNone, TuneOutlined, RequestQuoteOutlined,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useModuleAccess } from './useModuleAccess';

export interface AccessibleModule {
  id: PageType;
  label: string;
  description: string;        // courte, pour les cards de la home
  icon: React.ElementType;
  badge?: 'new' | 'pending';  // optionnel, futur usage
}

export interface AccessibleModuleGroup {
  label: string;
  modules: AccessibleModule[];
}

/**
 * Retourne la liste des modules accessibles à l'utilisateur courant,
 * regroupés par thème. Source unique de vérité — utilisée par la
 * Sidebar (verticale) et par la HomePage (cards).
 *
 * La logique reflète celle qui était hardcodée dans Sidebar.tsx avant
 * extraction (commit ad8c0cb~).
 */
export function useAccessibleModules(): AccessibleModuleGroup[] {
  const { isRole, hasPermission, state: userState } = useUser();
  const { canAccess, canAction } = useModuleAccess();

  const perms = userState.currentUser?.permissions ?? [];
  const isAdmin              = isRole('admin') || perms.includes('*');
  const isManagement         = isRole('management');

  const canViewApplications  = (hasPermission('view_applications') || hasPermission('view_own') || isAdmin) && canAccess('credit-application');
  const canViewClients       = (canViewApplications || hasPermission('create_client') || hasPermission('manage_clients')) && canAccess('clients');
  const canCreateApplication = hasPermission('create_application') && canAccess('credit-application');
  const canDispatching       = hasPermission('dispatch_applications') && canAccess('dispatching');
  const canViewAnalytics     = hasPermission('analytics') && canAccess('analytics');
  const canFinancialAnalysis = hasPermission('financial_analysis') || hasPermission('analyze_credit');
  const canViewReports       = (hasPermission('reports') || isAdmin) && canAccess('analytics');
  const canViewConfiguration = hasPermission('user_management') || isAdmin;
  const canViewPlatformAdmin = perms.includes('manage_platform');
  const canViewCreditPolicy  = (hasPermission('policy_configuration') || isAdmin) && canAccess('credit-policy');
  const canViewCodir         = (hasPermission('codir_dashboard') || isAdmin) && canAccess('codir-dashboard');
  const canManageContractTemplates = hasPermission('manage_contract_templates') || isAdmin || isManagement || canAction('contract-templates', 'upload');

  const creditProcess: AccessibleModule[] = [
    ...(canViewClients       ? [{ id: 'clients'            as PageType, label: 'Clients',           description: 'Annuaire & fiches clients',     icon: GroupsOutlined      }] : []),
    ...(canCreateApplication ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande',  description: 'Créer un dossier de crédit',     icon: NoteAddOutlined     }] : []),
    ...(canDispatching       ? [{ id: 'dispatching'        as PageType, label: 'Dispatching',       description: 'Affecter les dossiers entrants', icon: AccountTreeOutlined }] : []),
    ...(canViewApplications  ? [{ id: 'approvals'          as PageType, label: 'Approbations',      description: 'Étapes en attente de décision',  icon: RequestQuoteOutlined}] : []),
    ...(canViewApplications  ? [{ id: 'workflow'           as PageType, label: 'Workflow',          description: 'Circuit d\'instruction',         icon: AccountTreeOutlined }] : []),
    ...(canViewAnalytics     ? [{ id: 'analytics'          as PageType, label: 'Analytiques',       description: 'Tableaux de bord agrégés',       icon: InsightsOutlined    }] : []),
    ...(canViewCodir         ? [{ id: 'codir-dashboard'    as PageType, label: 'CODIR',             description: 'Vue exécutive temps réel',       icon: InsightsOutlined    }] : []),
  ];

  const outOfProcess: AccessibleModule[] = canFinancialAnalysis ? [
    { id: 'data-input' as PageType, label: 'Saisie de Données', description: 'Importer/saisir des données financières', icon: EditNoteOutlined },
    { id: 'analysis'   as PageType, label: 'Analyse',           description: 'Diagnostic financier détaillé',           icon: QueryStatsOutlined },
    ...(canViewReports ? [{ id: 'reports' as PageType, label: 'Rapports', description: 'Exports & synthèses', icon: SummarizeOutlined }] : []),
  ] : [];

  const configuration: AccessibleModule[] = canViewConfiguration ? [
    { id: 'user-management'      as PageType, label: 'Utilisateurs',         description: 'Gestion des comptes',          icon: ManageAccountsOutlined },
    ...(canViewCreditPolicy ? [{ id: 'credit-policy' as PageType, label: 'Politique de Crédit', description: 'Règles, étapes, plafonds', icon: GavelOutlined }] : []),
    ...(canManageContractTemplates ? [{ id: 'contract-templates' as PageType, label: 'Modèles de contrats', description: 'Templates & variables', icon: CreditCardOutlined }] : []),
    { id: 'bank-holidays-admin'  as PageType, label: 'Jours Fériés',         description: 'Calendrier ouvré',             icon: EventNoteOutlined },
    { id: 'backup'               as PageType, label: 'Sauvegarde',           description: 'Exports & restauration',       icon: BackupOutlined },
    { id: 'announcements'        as PageType, label: "Notes d'information",  description: 'Diffusion interne',            icon: CampaignOutlined },
    { id: 'notifications-config' as PageType, label: 'Notifications',        description: 'Règles & destinataires',       icon: NotificationsNone },
    ...(canViewPlatformAdmin ? [{ id: 'platform-admin' as PageType, label: 'Admin Plateforme', description: 'Réglages globaux', icon: TuneOutlined }] : []),
  ] : [];

  const groups: AccessibleModuleGroup[] = [];
  if (creditProcess.length) groups.push({ label: 'Processus Crédit',         modules: creditProcess });
  if (outOfProcess.length)  groups.push({ label: 'Analyse Hors-Processus',   modules: outOfProcess });
  if (configuration.length) groups.push({ label: 'Configuration',            modules: configuration });
  return groups;
}
```

- [ ] **Step 4.2 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 4.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/hooks/useAccessibleModules.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home): hook useAccessibleModules — source unique de vérité

Extraction de la logique de gating depuis Sidebar.tsx vers un hook
partagé. La Sidebar et la HomePage consommeront ce hook pour rester
parfaitement synchrones."
```

---

## Task 5 — Frontend : Sidebar consomme le hook (refactor sans changement visuel)

**Files:**
- Modify: `src/components/Sidebar.tsx`

Cette étape est un **refactor sans changement comportemental** : la Sidebar lit désormais ses items via `useAccessibleModules()` au lieu de calculer ses propres gates. Le polish visuel viendra en Task 10.

- [ ] **Step 5.1 — Lire la Sidebar et identifier les zones à remplacer**

Read `src/components/Sidebar.tsx` (700+ lignes). Repérer :
- Le bloc des gates de permission (lignes 122-145).
- Les arrays `creditProcessItems` / `outOfProcessItems` / `configItems` (lignes 147-173).

- [ ] **Step 5.2 — Remplacer la logique de gating par le hook**

Dans `Sidebar.tsx`, importer en haut :

```typescript
import { useAccessibleModules } from '../hooks/useAccessibleModules';
```

À la place du bloc des gates + arrays (lignes 122-173), insérer :

```typescript
const accessibleGroups = useAccessibleModules();
const creditProcessItems = accessibleGroups.find(g => g.label === 'Processus Crédit')?.modules ?? [];
const outOfProcessItems  = accessibleGroups.find(g => g.label === 'Analyse Hors-Processus')?.modules ?? [];
const configItems        = accessibleGroups.find(g => g.label === 'Configuration')?.modules ?? [];

// Conserver les variables ad-hoc utilisées ailleurs dans le composant :
const isAdmin = ...                      // garder si encore utilisé pour autre chose que les items
const pendingApprovalsCount = ...        // conservé tel quel pour le badge "Approbations"
```

Vérifier ensuite tous les usages de `canViewApplications`, `canViewClients`, `isAdmin`, etc. dans le reste de la Sidebar. Pour chaque variable :
- Si elle servait uniquement à filtrer les arrays d'items → la supprimer.
- Si elle sert ailleurs (ex : conditionner un bloc de stat) → la **conserver** en la lisant à nouveau via `useUser` / `useModuleAccess`.

Pour le badge "Approbations" : `creditProcessItems` perd le champ `badgeCount`. Solution : enrichir au moment de l'affichage Sidebar uniquement :

```tsx
{creditProcessItems.map(item => {
  const badge = item.id === 'approvals' ? pendingApprovalsCount : undefined;
  return <SidebarItem {...item} badgeCount={badge} ... />;
})}
```

- [ ] **Step 5.3 — Compilation + smoke**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

Manuel : lancer le dev front, vérifier visuellement que tous les menus de la Sidebar apparaissent comme avant (selon le rôle de connexion). Aucun item ne doit avoir disparu ni apparu de nouveau.

- [ ] **Step 5.4 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/Sidebar.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "refactor(sidebar): consomme useAccessibleModules (no behavior change)"
```

---

## Task 6 — Frontend : composant HomeHero

**Files:**
- Create: `src/components/home/HomeHero.tsx`

- [ ] **Step 6.1 — Implémenter**

```tsx
// src/components/home/HomeHero.tsx
import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { keyframes } from '@emotion/react';
import { colors, transitions, prefersReducedMotion } from './homeTokens';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

interface HomeHeroProps {
  userName: string;       // ex: "M. Diop"
  tenantName: string;     // ex: "BCI"
  branchName?: string | null;
  roleLabel?: string;     // ex: "Back-office"
}

export function HomeHero({ userName, tenantName, branchName, roleLabel }: HomeHeroProps) {
  const reduced = prefersReducedMotion();
  const anim = reduced
    ? 'none'
    : `${fadeInUp} ${transitions.enter} both`;

  return (
    <Box
      sx={{
        animation: anim,
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: 3,
        px: { xs: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        flexDirection: { xs: 'column', md: 'row' },
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 28, fontWeight: 700, color: colors.text.primary, lineHeight: 1.2 }}>
          Bonjour, {userName}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14, color: colors.text.muted, fontWeight: 500 }}>
          {formatToday()}{branchName ? ` · ${tenantName} · ${branchName}` : ` · ${tenantName}`}
        </Typography>
      </Box>
      {roleLabel && (
        <Chip
          label={roleLabel}
          size="small"
          sx={{
            bgcolor: colors.accent.muted,
            color: colors.accent.primary,
            fontWeight: 600,
            fontSize: 12,
            border: 'none',
            borderRadius: 999,
            px: 1,
          }}
        />
      )}
    </Box>
  );
}
```

- [ ] **Step 6.2 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 6.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/home/HomeHero.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home): composant HomeHero (bandeau bienvenue + meta + chip rôle)"
```

---

## Task 7 — Frontend : HomeKpiCard + HomeKpiBand + ApiService + hook

**Files:**
- Create: `src/components/home/HomeKpiCard.tsx`
- Create: `src/components/home/HomeKpiBand.tsx`
- Create: `src/hooks/useHomeKpis.ts`
- Modify: `src/services/api.ts` — ajouter `getHomeKpis`

- [ ] **Step 7.1 — ApiService method**

Dans `src/services/api.ts`, juste après `getClientContracts` (Task 4 du sprint précédent, autour ligne 1666), ajouter :

```typescript
  static async getHomeKpis(): Promise<{
    success: boolean;
    kpis: Array<{
      key: string;
      label: string;
      value: number | null;
      format: 'number' | 'currency' | 'percent' | 'duration';
      trend?: { delta: number; direction: 'up' | 'down' } | null;
      error?: boolean;
    }>;
  }> {
    try {
      const response = await api.get('/home/kpis');
      return response.data;
    } catch (error) {
      console.error('getHomeKpis error:', error);
      throw error;
    }
  }
```

- [ ] **Step 7.2 — Hook**

```typescript
// src/hooks/useHomeKpis.ts
import { useEffect, useState } from 'react';
import { ApiService } from '../services/api';

type HomeKpi = Awaited<ReturnType<typeof ApiService.getHomeKpis>>['kpis'][number];

export function useHomeKpis(): { kpis: HomeKpi[] | null; loading: boolean; error: string | null } {
  const [kpis, setKpis] = useState<HomeKpi[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiService.getHomeKpis()
      .then(res => { if (!cancelled) setKpis(res.kpis); })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.error ?? 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { kpis, loading, error };
}
```

- [ ] **Step 7.3 — Composant HomeKpiCard (avec compteur animé)**

```tsx
// src/components/home/HomeKpiCard.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { colors, shadows, radii, transitions, prefersReducedMotion } from './homeTokens';

type KpiFormat = 'number' | 'currency' | 'percent' | 'duration';

function formatXOF(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mds`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(1)} M`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(1)} K`;
  return value.toLocaleString('fr-FR');
}

function formatDuration(minutes: number): string {
  const days  = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0)  return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case 'currency': return `${formatXOF(value)} XOF`;
    case 'percent':  return `${value}%`;
    case 'duration': return formatDuration(value);
    default:         return value.toLocaleString('fr-FR');
  }
}

interface Props {
  label: string;
  value: number | null;
  format: KpiFormat;
  loading?: boolean;
  trend?: { delta: number; direction: 'up' | 'down' } | null;
  delayMs?: number;       // pour effet séquentiel
}

export function HomeKpiCard({ label, value, format, loading, trend, delayMs = 0 }: Props) {
  const [displayed, setDisplayed] = useState(prefersReducedMotion() ? (value ?? 0) : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || prefersReducedMotion()) {
      setDisplayed(value ?? 0);
      return;
    }
    const start    = performance.now() + delayMs;
    const duration = 800;
    const from     = 0;
    const to       = value;
    const ease     = (t: number) => 1 - Math.pow(1 - t, 3);  // cubic ease-out

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / duration);
      setDisplayed(from + (to - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, delayMs]);

  return (
    <Box
      sx={{
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: `${radii.card}px`,
        p: 2.5,
        boxShadow: shadows.card,
        transition: `box-shadow ${transitions.fast}, transform ${transitions.fast}`,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 500,
          color: colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={120} height={36} sx={{ mt: 0.5 }} />
      ) : (
        <Typography
          sx={{
            mt: 0.5,
            fontSize: 26,
            fontWeight: 700,
            color: colors.text.primary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}
        >
          {value === null
            ? '—'
            : formatValue(format === 'duration' ? Math.round(displayed) : Math.round(displayed), format)}
        </Typography>
      )}
      {trend && value !== null && (
        <Typography
          sx={{
            mt: 0.5, fontSize: 11.5, fontWeight: 600,
            color: trend.direction === 'up' ? '#0F766E' : '#9F1239',
          }}
        >
          {trend.direction === 'up' ? '▲' : '▼'} {(Math.abs(trend.delta) * 100).toFixed(1)}%
        </Typography>
      )}
    </Box>
  );
}
```

- [ ] **Step 7.4 — Composant HomeKpiBand**

```tsx
// src/components/home/HomeKpiBand.tsx
import React from 'react';
import { Box, Grid } from '@mui/material';
import { HomeKpiCard } from './HomeKpiCard';
import { useHomeKpis } from '../../hooks/useHomeKpis';

export function HomeKpiBand() {
  const { kpis, loading } = useHomeKpis();
  const items = kpis ?? new Array(4).fill(null).map((_, i) => ({
    key: `placeholder-${i}`, label: '', value: null, format: 'number' as const,
  }));

  return (
    <Box sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        {items.map((k, i) => (
          <Grid item xs={12} sm={6} md={3} key={k.key}>
            <HomeKpiCard
              label={k.label || ' '}
              value={k.value}
              format={k.format as any}
              loading={loading}
              trend={k.trend ?? null}
              delayMs={i * 80}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
```

- [ ] **Step 7.5 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 7.6 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/services/api.ts src/hooks/useHomeKpis.ts src/components/home/HomeKpiCard.tsx src/components/home/HomeKpiBand.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home): HomeKpiBand + HomeKpiCard (compteurs animés, palette navy)

Respecte prefers-reduced-motion (compteur désactivé). Format des valeurs
homogène : currency (M/Mds XOF), percent, duration (Xj Yh), number."
```

---

## Task 8 — Frontend : HomeModuleCard + HomeModuleGrid

**Files:**
- Create: `src/components/home/HomeModuleCard.tsx`
- Create: `src/components/home/HomeModuleGrid.tsx`

- [ ] **Step 8.1 — HomeModuleCard**

```tsx
// src/components/home/HomeModuleCard.tsx
import React from 'react';
import { Box, Typography, ButtonBase } from '@mui/material';
import { colors, shadows, radii, transitions } from './homeTokens';
import { AccessibleModule } from '../../hooks/useAccessibleModules';

interface Props {
  module: AccessibleModule;
  onClick: () => void;
  delayMs?: number;
}

export function HomeModuleCard({ module, onClick, delayMs = 0 }: Props) {
  const Icon = module.icon;
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: `${radii.card}px`,
        p: 2.5,
        display: 'block',
        boxShadow: shadows.card,
        transition: `transform ${transitions.fast}, box-shadow ${transitions.fast}, border-color ${transitions.fast}`,
        opacity: 0,
        animation: `kbsFadeUp 320ms ${delayMs}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        '@keyframes kbsFadeUp': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: shadows.cardHover,
          borderColor: colors.accent.primary,
          '& .home-card-icon': {
            bgcolor: colors.accent.primary,
            color: '#FFFFFF',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
          animation: 'none',
          '&:hover': { transform: 'none' },
        },
      }}
    >
      <Box
        className="home-card-icon"
        sx={{
          width: 40, height: 40, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: colors.accent.muted,
          color: colors.accent.primary,
          transition: `background ${transitions.fast}, color ${transitions.fast}`,
          mb: 1.5,
        }}
      >
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: colors.text.primary }}>
        {module.label}
      </Typography>
      <Typography sx={{ mt: 0.4, fontSize: 13, color: colors.text.secondary, lineHeight: 1.4 }}>
        {module.description}
      </Typography>
    </ButtonBase>
  );
}
```

- [ ] **Step 8.2 — HomeModuleGrid**

```tsx
// src/components/home/HomeModuleGrid.tsx
import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useAccessibleModules } from '../../hooks/useAccessibleModules';
import { HomeModuleCard } from './HomeModuleCard';
import { colors } from './homeTokens';
import { PageType } from '../../types';

interface Props {
  onNavigate: (page: PageType) => void;
}

export function HomeModuleGrid({ onNavigate }: Props) {
  const groups = useAccessibleModules();

  return (
    <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {groups.map((group, gIdx) => (
        <Box key={group.label}>
          <Typography
            sx={{
              fontSize: 14, fontWeight: 600,
              color: colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              mb: 0.5,
            }}
          >
            {group.label}
          </Typography>
          <Box sx={{ height: 2, width: 32, bgcolor: colors.accent.primary, borderRadius: 1, mb: 2 }} />
          <Grid container spacing={2}>
            {group.modules.map((module, mIdx) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={module.id}>
                <HomeModuleCard
                  module={module}
                  onClick={() => onNavigate(module.id)}
                  delayMs={gIdx * 120 + mIdx * 60 + 480}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 8.3 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 8.4 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/home/HomeModuleCard.tsx src/components/home/HomeModuleGrid.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(home): HomeModuleGrid + HomeModuleCard

Cards monochrome (icône navy sur fond muted), hover = lift + accent
primary, séquence d'entrée. Pas de gradients."
```

---

## Task 9 — Frontend : HomePage orchestrateur (rewrite)

**Files:**
- Modify: `src/pages/HomePage.tsx` — réécriture complète (639 lignes → ~120 lignes)

L'ancienne implémentation contient les `MODULE_GROUPS` hardcodés, les gradients, et la grille couleur. On la **remplace** par une composition légère.

- [ ] **Step 9.1 — Réécrire HomePage.tsx**

```tsx
// src/pages/HomePage.tsx
import React from 'react';
import { Box } from '@mui/material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';
import { HomeHero } from '../components/home/HomeHero';
import { HomeKpiBand } from '../components/home/HomeKpiBand';
import { HomeModuleGrid } from '../components/home/HomeModuleGrid';
import { colors } from '../components/home/homeTokens';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

const ROLE_LABELS: Record<string, string> = {
  account_manager:     'Chargé d\'affaires',
  assistant_commercial:'Assistant commercial',
  credit_analyst:      'Analyste risques',
  analyst_supervisor:  'Responsable risques',
  branch_manager:      'Responsable engagements',
  credit_committee:    'Comité de crédit',
  management:          'Direction Générale',
  admin:               'Administrateur',
  super_admin:         'Super Administrateur',
  back_office:         'Back-office',
  direction_juridique: 'Direction Juridique',
  dir_ag:              'Directeur d\'Agence',
};

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { state: userState } = useUser();
  const { activeCompany } = useCompany();

  const userName    = userState.currentUser?.name ?? 'Utilisateur';
  const tenantName  = activeCompany?.name ?? 'OptimusCredit';
  const branchName  = (userState.currentUser as any)?.branch ?? null;
  const roleKey     = userState.currentUser?.role ?? '';
  const roleLabel   = ROLE_LABELS[roleKey] ?? roleKey;

  return (
    <Box sx={{ bgcolor: colors.bg.page, minHeight: '100%', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
      <HomeHero userName={userName} tenantName={tenantName} branchName={branchName} roleLabel={roleLabel} />
      <HomeKpiBand />
      <HomeModuleGrid onNavigate={onNavigate} />
    </Box>
  );
};

export default HomePage;
```

(Si l'ancien `HomePage.tsx` exporte en `default function HomePage(...)` ou autrement, conserver exactement la même signature d'export pour ne pas casser l'import dans `App.tsx`.)

- [ ] **Step 9.2 — Vérifier l'export et l'import**

Run: `grep -n "import.*HomePage" /Users/fofana/Bitrix24/kaizen-b/kbsOC/src/App.tsx`
Confirm que l'import est `import HomePage from './pages/HomePage';` (default). Si nommé, ajuster l'export.

- [ ] **Step 9.3 — Compilation TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 9.4 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/pages/HomePage.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "refactor(home): réécriture HomePage en orchestrateur léger

639 → ~120 lignes. Délègue à HomeHero, HomeKpiBand, HomeModuleGrid.
Plus aucun gradient, palette navy unique."
```

---

## Task 10 — Frontend : polish visuel Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

Périmètre strict : palette, espacements, icônes. Pas de changement de structure (déjà fait Task 5).

- [ ] **Step 10.1 — Repérer les constantes de palette**

Read `src/components/Sidebar.tsx` lignes 1-90 pour trouver les variables type `SB.activeBg`, `SB.activeBorder`, `brand.gradient`. Modifier ces constantes pour les aligner sur `homeTokens` :

- Active background : `#F1F5F9` (`colors.bg.subtle`)
- Active text/icon : `#1F4E79` (`colors.accent.primary`) — remplacer le `brand.gradient` text-fill par une couleur unie navy.
- Hover background : `rgba(31,78,121,0.04)`
- Item border-left actif : `2px solid #1F4E79`
- Séparateurs entre groupes : `border-top: 1px solid #E2E8F0`
- Espacement vertical des items : `py: 1` (8px)

- [ ] **Step 10.2 — Appliquer les remplacements**

Dans `Sidebar.tsx`, les `sx` `activeItemSx` et `inactiveItemSx` doivent refléter la nouvelle palette. Supprimer le `WebkitBackgroundClip: 'text'` qui imite un gradient.

Exemple — `activeItemSx` :

```typescript
const activeItemSx = {
  borderRadius: '7px',
  mx: 1,
  py: 1,
  color: colors.accent.primary,
  background: colors.bg.subtle,
  borderLeft: `2px solid ${colors.accent.primary}`,
  pl: '14px',
  transition: `all ${transitions.fast}`,
  '& .MuiListItemIcon-root': { color: colors.accent.primary },
  '& .MuiListItemText-primary': { fontWeight: 600, color: colors.accent.primary },
  '&:hover': { background: colors.bg.subtle },
};
```

Importer `colors` et `transitions` depuis `../components/home/homeTokens`.

- [ ] **Step 10.3 — Icônes : passer en *Outlined si pas déjà fait**

`grep -n "from '@mui/icons-material'" /Users/fofana/Bitrix24/kaizen-b/kbsOC/src/components/Sidebar.tsx` — vérifier que toutes les icônes finissent par `Outlined` ou sont neutres (ex: `GroupsOutlined`, pas `Groups`). Remplacer les exceptions.

- [ ] **Step 10.4 — Compilation TS + visuel**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: clean.

Manuel : lancer le front, comparer Sidebar avant/après. La sélection active doit être bleu navy uni (pas de gradient text-fill), les hover subtils, les icônes outlined.

- [ ] **Step 10.5 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/Sidebar.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "style(sidebar): polish palette navy + icônes outlined

Aligne la Sidebar sur les tokens de la home. Sélections en navy plein,
hover en bg.subtle, icônes outlined partout. Pas de changement
fonctionnel."
```

---

## Task 11 — Smoke test manuel + push

**Files:** aucun.

- [ ] **Step 11.1 — Lancer back + front**

```bash
# Terminal 1
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev
# Terminal 2
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

- [ ] **Step 11.2 — Scénarios à vérifier**

Pour chaque scénario, se connecter avec le rôle indiqué, ouvrir la home, vérifier :

| Rôle | Hero | KPI band | Modules visibles | Animations |
|---|---|---|---|---|
| **BACK_OFFICE** | nom + date + tenant + chip "Back-office" | "À traiter", "SLA respecté", "Taux d'approbation", "Étapes en retard" | Clients, Approbations, Workflow, Analytics, CODIR (selon perms) | fade séquentiel + compteurs |
| **CHARGE_AFFAIRES** | idem + chip "Chargé d'affaires" | "Mes dossiers en cours", "Encours de mes clients", "Contrats signés (mois)", "Échéances en alerte" | Clients, Nouvelle Demande, Workflow | idem |
| **DIRECTION_GENERALE** | idem + chip "Direction Générale" | "Volume global", "Encours total", "Taux d'approbation", "Durée moyenne traitement" | Clients, Workflow, Analytics, CODIR | idem |
| **ADMIN** | idem | "Volume global", "Encours total", "Utilisateurs actifs (30j)", "Échéances en alerte" | + section Configuration complète | idem |

Vérifier aussi :
- `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate CSS media feature) : les compteurs s'affichent directement, pas de fade-in.
- Sidebar : les mêmes modules apparaissent (cohérence avec la home).
- Cliquer sur une card module → navigue à la page correspondante.
- API `/api/home/kpis` : tester directement via DevTools Network — voir le payload avec `key`, `value`, `format`.

- [ ] **Step 11.3 — Lancer toute la suite de tests backend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest
```
Expected: pas de régression.

- [ ] **Step 11.4 — Push**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC push origin release/v1.0
```

---

## Self-Review checklist

- **Spec §2 (design tokens)** → couvert par Task 3 (`homeTokens.ts`).
- **Spec §3 (layout)** → couvert par Tasks 6, 7, 8.
- **Spec §4 (KPIs adaptés au rôle)** → Tasks 1 + 2 (backend) + Task 7 (front).
- **Spec §5 (permissions/gating)** → Tasks 4 (hook) + 5 (Sidebar refactor).
- **Spec §6 (animations)** → Tasks 6, 7, 8 (fade séquentiel + compteurs + hover + `prefers-reduced-motion`).
- **Spec §7 (décomposition composants)** → Tasks 3, 6, 7, 8, 9 (HomePage devient orchestrateur).
- **Spec §8 (polish Sidebar)** → Task 10.
- **Spec §11 (tests)** → Tasks 1 et 2 (backend), Task 11 (smoke front).

Aucun "TBD" ni "TODO". Tous les noms de fichiers, fonctions, et constantes sont identiques entre les tasks (`useAccessibleModules`, `buildHomeKpisForUser`, `homeTokens`, `HomeKpiCard`, etc.).
