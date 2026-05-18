# Onboarding première connexion — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter un tour guidé première connexion (ERPNext-style) avec coachmarks ancrés sur la sidebar/header, filtrés par permissions, persistance via `User.onboardingCompletedAt` en DB, et accès ultérieur via le menu profil.

**Architecture:** Backend = 1 champ Prisma nullable + 3 endpoints REST sous `/api/users/me/onboarding`. Frontend = `shepherd.js` + `react-shepherd` piloté par un `OnboardingProvider` qui filtre les étapes selon les permissions. Tooltip stylé Prestige Light via CSS override.

**Tech Stack:** React 18 + TypeScript + MUI, `shepherd.js@^14`, `react-shepherd@^6`, axios via `window.location.origin/api`, Prisma + PostgreSQL, Express, Jest + Supertest pour les tests backend.

**Spec source:** [docs/superpowers/specs/2026-05-18-onboarding-first-login-design.md](../specs/2026-05-18-onboarding-first-login-design.md)

---

## File structure

**Backend:**
- Modify: `backend/prisma/schema.prisma` (add `onboardingCompletedAt` field on `User`)
- Create: `backend/prisma/migrations/YYYYMMDDHHMMSS_add_onboarding_completed_at/migration.sql`
- Create: `backend/src/routes/onboarding.ts` (3 endpoints, mounted under `/api/users/me/onboarding`)
- Modify: `backend/src/server.ts` (register the new sub-router)
- Create: `backend/src/__tests__/onboardingRoute.test.ts`

**Frontend (new):**
- Create: `src/services/onboardingApi.ts` (3 axios functions)
- Create: `src/components/onboarding/onboardingSteps.ts` (pure function `buildSteps()`)
- Create: `src/components/onboarding/useOnboarding.ts` (hook returning the context value)
- Create: `src/components/onboarding/OnboardingProvider.tsx` (provider + ShepherdJourneyProvider)
- Create: `src/styles/shepherd.css` (Prestige Light overrides)

**Frontend (modified):**
- Modify: `src/App.tsx` (wrap with `OnboardingProvider`)
- Modify: `src/components/Sidebar.tsx` (add `data-tour="..."` attributes on the 4 `SectionHeader` wrappers)
- Modify: `src/components/Header.tsx` (add `data-tour` attrs on avatar + hamburger; add menu item "Refaire le tour")
- Modify: `src/index.tsx` (import shepherd CSS files)
- Modify: `package.json` (add `shepherd.js`, `react-shepherd` deps)

---

## Task 1: Backend — schema migration + types

**Files:**
- Modify: `backend/prisma/schema.prisma` (User model)

- [ ] **Step 1: Add the field to the User model**

Edit `backend/prisma/schema.prisma`. Locate the `User` model (around line 61) and add this line right after the existing `lastLogin` field (around line 76):

```prisma
  lastLogin                DateTime?              @map("last_login")
  onboardingCompletedAt    DateTime?              @map("onboarding_completed_at")
```

- [ ] **Step 2: Generate the migration**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma migrate dev --name add_onboarding_completed_at --create-only
```

Expected: creates `backend/prisma/migrations/YYYYMMDDHHMMSS_add_onboarding_completed_at/migration.sql` with content:

```sql
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
```

If the generated SQL adds any `DEFAULT`, remove it — we want the column nullable with no default (existing rows must remain `NULL` so they see the onboarding on next login, per spec decision).

- [ ] **Step 3: Apply the migration locally**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma migrate dev
```

Expected: migration applied, Prisma Client regenerated.

- [ ] **Step 4: Verify the field is queryable**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.findFirst({ select: { id: true, onboardingCompletedAt: true } }).then(r => { console.log(r); return p.\$disconnect(); });"
```

Expected: prints `{ id: '...', onboardingCompletedAt: null }` for the first user. No TypeScript error on `onboardingCompletedAt`.

- [ ] **Step 5: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add backend/prisma/schema.prisma backend/prisma/migrations/ && git commit -m "feat(db): add User.onboardingCompletedAt for first-login onboarding"
```

---

## Task 2: Backend — onboarding route file

**Files:**
- Create: `backend/src/routes/onboarding.ts`

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/onboarding.ts` with the following content:

```typescript
import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Sub-router mounted under /api/users/me/onboarding by server.ts.
// All endpoints require authentication; the user is identified by req.user.id (set by authenticate middleware).
// No cross-tenant possible: we only ever read/write the current user's own row.
router.use(authenticate);

// GET /api/users/me/onboarding — returns { shouldShow: boolean }
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { onboardingCompletedAt: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({
      success: true,
      shouldShow: user.onboardingCompletedAt === null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/users/me/onboarding/complete — set onboardingCompletedAt = now (idempotent)
router.post('/complete', async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/users/me/onboarding/reset — set onboardingCompletedAt = null
router.post('/reset', async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompletedAt: null },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
```

- [ ] **Step 2: Register the router in server.ts**

Edit `backend/src/server.ts`. Find the line that imports user routes (around line 29):

```typescript
import userRoutes from './routes/users';
```

Add right below:

```typescript
import onboardingRoutes from './routes/onboarding';
```

Then find the route mounting (around line 249):

```typescript
app.use('/api/users',                   ...protect, userRoutes);
```

Add right below:

```typescript
app.use('/api/users/me/onboarding',     ...protect, onboardingRoutes);
```

The path `/api/users/me/onboarding` is mounted as a separate prefix so the sub-router uses `/`, `/complete`, `/reset` internally (cleaner than nesting inside `userRoutes`).

- [ ] **Step 3: Type-check the backend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add backend/src/routes/onboarding.ts backend/src/server.ts && git commit -m "feat(api): add onboarding status/complete/reset endpoints"
```

---

## Task 3: Backend — tests for the onboarding route

**Files:**
- Create: `backend/src/__tests__/onboardingRoute.test.ts`

- [ ] **Step 1: Write the test file**

Create `backend/src/__tests__/onboardingRoute.test.ts`:

```typescript
import express from 'express';
import request from 'supertest';

// Mock auth middleware: read user from x-test-user header.
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : null;
    if (!req.user) return _res.status(401).end();
    next();
  },
  requireCompany: (req: any, _res: any, next: any) => next(),
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
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx jest src/__tests__/onboardingRoute.test.ts --verbose
```

Expected: 5 tests pass (3 in GET, 1 in complete, 1 in reset).

- [ ] **Step 3: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add backend/src/__tests__/onboardingRoute.test.ts && git commit -m "test(api): cover onboarding status/complete/reset endpoints"
```

---

## Task 4: Frontend — install shepherd dependencies

**Files:**
- Modify: `package.json` (root, not backend)

- [ ] **Step 1: Install shepherd.js**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm install shepherd.js@^14
```

Expected: `shepherd.js` added to `dependencies` in `package.json`, `package-lock.json` updated.

We only install `shepherd.js` (not `react-shepherd`) because the provider in Task 7 uses the `Shepherd.Tour` class directly. `react-shepherd` only adds JSX helpers we don't need, and avoiding it keeps the bundle smaller.

- [ ] **Step 2: Verify import works**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && node -e "const s = require('shepherd.js'); console.log('shepherd OK, version:', s.default?.Tour ? 'has Tour class' : 'check API');"
```

Expected: prints "shepherd OK".

- [ ] **Step 3: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add package.json package-lock.json && git commit -m "feat(deps): add shepherd.js and react-shepherd for guided tour"
```

---

## Task 5: Frontend — onboarding API service

**Files:**
- Create: `src/services/onboardingApi.ts`

- [ ] **Step 1: Create the service file**

Create `src/services/onboardingApi.ts`:

```typescript
import axios from 'axios';
import { tokenManager } from './api';

const apiBase = () => `${window.location.origin}/api`;

const authHeader = () => {
  const token = tokenManager.getAccessToken() || localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function getOnboardingStatus(): Promise<{ shouldShow: boolean }> {
  const res = await axios.get(`${apiBase()}/users/me/onboarding`, { headers: authHeader() });
  return { shouldShow: Boolean(res.data?.shouldShow) };
}

export async function completeOnboarding(): Promise<void> {
  await axios.post(`${apiBase()}/users/me/onboarding/complete`, {}, { headers: authHeader() });
}

export async function resetOnboarding(): Promise<void> {
  await axios.post(`${apiBase()}/users/me/onboarding/reset`, {}, { headers: authHeader() });
}
```

The pattern (re-using `tokenManager` from `services/api.ts` for the bearer token) follows the existing convention. The `window.location.origin/api` base URL respects the proxy convention (memory: never hardcode `localhost:3001`).

- [ ] **Step 2: Type-check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/services/onboardingApi.ts && git commit -m "feat(api): add onboardingApi service"
```

---

## Task 6: Frontend — onboardingSteps pure function

**Files:**
- Create: `src/components/onboarding/onboardingSteps.ts`

- [ ] **Step 1: Create the steps builder**

Create `src/components/onboarding/onboardingSteps.ts`:

```typescript
import type { StepOptions } from 'shepherd.js';

export interface OnboardingPermissions {
  canViewAnalytics: boolean;
  canViewReports: boolean;
  canViewCodir: boolean;
  canViewApplications: boolean;
  canFinancialAnalysis: boolean;
  canViewConfiguration: boolean;
}

export interface BuildStepsArgs {
  permissions: OnboardingPermissions;
  isMobile: boolean;
  roleLabel: string;
  onComplete: () => void;
  onSkip: () => void;
}

const baseButtons = (label: string) => [
  { text: 'Précédent', action: function () { (this as any).back(); }, classes: 'shepherd-btn-secondary' },
  { text: label, action: function () { (this as any).next(); }, classes: 'shepherd-btn-primary' },
];

export function buildSteps({ permissions, isMobile, roleLabel, onComplete, onSkip }: BuildStepsArgs): StepOptions[] {
  const p = permissions;
  const steps: StepOptions[] = [];

  // Étape 1 — Welcome (always, centered).
  steps.push({
    id: 'welcome',
    title: 'Bienvenue sur OptimusCredit',
    text: `Découvrez en quelques étapes les fonctionnalités adaptées à votre profil${roleLabel ? ` <strong>${roleLabel}</strong>` : ''}.`,
    buttons: [
      { text: 'Commencer', action: function () { (this as any).next(); }, classes: 'shepherd-btn-primary' },
    ],
    cancelIcon: { enabled: true },
  });

  // Mobile: replace steps 2-5 with a single hamburger-targeted step.
  if (isMobile) {
    if (p.canViewAnalytics || p.canViewReports || p.canViewCodir || p.canViewApplications || p.canFinancialAnalysis || p.canViewConfiguration) {
      steps.push({
        id: 'mobile-menu',
        title: 'Vos modules',
        text: "Tous les modules de la plateforme sont accessibles depuis ce menu, adaptés à votre rôle.",
        attachTo: { element: '[data-tour="mobile-menu-trigger"]', on: 'bottom' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
  } else {
    if (p.canViewAnalytics || p.canViewReports || p.canViewCodir) {
      steps.push({
        id: 'sidebar-dashboard',
        title: 'Pilotage & Rapports',
        text: 'Retrouvez ici vos tableaux de bord (Home, CODIR, Analytics) et le centre de rapports de crédit.',
        attachTo: { element: '[data-tour="sidebar-dashboard"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canViewApplications) {
      steps.push({
        id: 'sidebar-credit',
        title: 'Processus Crédit',
        text: 'Créez, suivez et approuvez les demandes de crédit, et consultez les workflows en cours.',
        attachTo: { element: '[data-tour="sidebar-credit"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canFinancialAnalysis) {
      steps.push({
        id: 'sidebar-analysis',
        title: 'Analyse financière',
        text: 'Effectuez des analyses hors processus : saisie manuelle, analyse, et rapports financiers.',
        attachTo: { element: '[data-tour="sidebar-analysis"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
    if (p.canViewConfiguration) {
      steps.push({
        id: 'sidebar-config',
        title: 'Configuration',
        text: 'Paramétrez les types de crédit, politiques, utilisateurs et options de la plateforme.',
        attachTo: { element: '[data-tour="sidebar-config"]', on: 'right' },
        buttons: baseButtons('Suivant'),
        cancelIcon: { enabled: true },
      });
    }
  }

  // Étape header-profile (always).
  steps.push({
    id: 'header-profile',
    title: 'Profil & paramètres',
    text: "Accédez à votre profil, vos paramètres de compte, la 2FA, et vos notifications depuis ce menu.",
    attachTo: { element: '[data-tour="header-profile"]', on: 'bottom-end' },
    buttons: baseButtons('Suivant'),
    cancelIcon: { enabled: true },
  });

  // Étape finale (always, centered, calls onComplete).
  steps.push({
    id: 'done',
    title: "C'est parti",
    text: 'Vous êtes prêt à utiliser OptimusCredit. Vous pourrez refaire ce tour à tout moment depuis votre menu profil.',
    buttons: [
      { text: 'Précédent', action: function () { (this as any).back(); }, classes: 'shepherd-btn-secondary' },
      { text: 'Terminer', action: function () { onComplete(); (this as any).complete(); }, classes: 'shepherd-btn-primary' },
    ],
    cancelIcon: { enabled: true },
  });

  return steps;
}
```

Notes:
- Pure function: no DOM access, no side effects beyond the callbacks. Easy to test in isolation.
- The `cancelIcon.enabled: true` shows shepherd's built-in X button (top-right) on every step — this is our "Passer le tour" trigger. Shepherd fires the `cancel` event when clicked, which the provider will hook to call `onSkip`.
- Buttons use plain `function () { (this as any).next(); }` (not arrow functions) so `this` binds to the shepherd Tour instance per shepherd's API.
- Mobile detection is passed in by the provider (NOT done here) so this function stays pure.

- [ ] **Step 2: Type-check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors. If `StepOptions` is not exported by `shepherd.js`, fallback to `any[]` return type with a TODO comment — but try the typed import first.

- [ ] **Step 3: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/components/onboarding/onboardingSteps.ts && git commit -m "feat(onboarding): add buildSteps pure function"
```

---

## Task 7: Frontend — OnboardingProvider + useOnboarding hook

**Files:**
- Create: `src/components/onboarding/useOnboarding.ts`
- Create: `src/components/onboarding/OnboardingProvider.tsx`

- [ ] **Step 1: Create the context + hook file**

Create `src/components/onboarding/useOnboarding.ts`:

```typescript
import { createContext, useContext } from 'react';

export interface OnboardingContextValue {
  start: () => void;
  restart: () => Promise<void>;
  skip: () => void;
  isActive: boolean;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    // Provider absent — return no-ops so consumers (e.g. Header menu item) don't crash before App mounts the provider.
    return { start: () => {}, restart: async () => {}, skip: () => {}, isActive: false };
  }
  return ctx;
}
```

- [ ] **Step 2: Create the provider**

Create `src/components/onboarding/OnboardingProvider.tsx`:

```typescript
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { useUser } from '../../contexts/UserContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { getOnboardingStatus, completeOnboarding, resetOnboarding } from '../../services/onboardingApi';
import { buildSteps, OnboardingPermissions } from './onboardingSteps';
import { OnboardingContext } from './useOnboarding';

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES: "Chargé d'affaires",
  ANALYSTE_RISQUES: 'Analyste risques',
  RESPONSABLE_RISQUES: 'Responsable risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable engagements',
  COMITE_CREDIT: 'Comité de crédit',
  DIRECTION_GENERALE: 'Direction Générale',
  DIRECTION_JURIDIQUE: 'Direction Juridique',
  BACK_OFFICE: 'Back-office',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super Administrateur',
};

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { state: userState } = useUser();
  const { canAccess } = useModuleAccess();
  const isMobile = useMediaQuery('(max-width:600px)');

  const tourRef = useRef<any | null>(null);
  const [isActive, setIsActive] = useState(false);

  const user = userState.currentUser;
  const userId = user?.id ?? null;

  const computePermissions = useCallback((): OnboardingPermissions => {
    const perms = (user?.permissions ?? []) as string[];
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const has = (p: string) => perms.includes(p) || perms.includes('*');
    return {
      canViewAnalytics: has('analytics') && canAccess('analytics'),
      canViewReports: (has('reports') || isAdmin) && canAccess('analytics'),
      canViewCodir: (has('codir_dashboard') || isAdmin) && canAccess('codir-dashboard'),
      canViewApplications: (has('view_applications') || has('view_own') || isAdmin) && canAccess('credit-application'),
      canFinancialAnalysis: has('financial_analysis') || has('analyze_credit'),
      canViewConfiguration: has('user_management') || isAdmin,
    };
  }, [user?.permissions, user?.role, canAccess]);

  const destroyTour = useCallback(() => {
    if (tourRef.current) {
      try { tourRef.current.complete(); } catch { /* already done */ }
      tourRef.current = null;
    }
    setIsActive(false);
  }, []);

  const buildAndStartTour = useCallback(() => {
    if (!user) return;
    destroyTour();

    const roleLabel = ROLE_LABELS[user.role] ?? '';
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 4,
        modalOverlayOpeningRadius: 8,
        classes: 'optimus-shepherd',
      },
      exitOnEsc: true,
      keyboardNavigation: true,
    });

    const steps = buildSteps({
      permissions: computePermissions(),
      isMobile,
      roleLabel,
      onComplete: () => { completeOnboarding().catch(e => console.warn('onboarding complete failed', e)); },
      onSkip: () => { completeOnboarding().catch(e => console.warn('onboarding skip failed', e)); },
    });
    steps.forEach(s => tour.addStep(s));

    tour.on('complete', () => { setIsActive(false); tourRef.current = null; });
    tour.on('cancel', () => {
      // 'cancel' fires when user presses Esc or clicks the X. Treat as skip.
      completeOnboarding().catch(e => console.warn('onboarding cancel failed', e));
      setIsActive(false);
      tourRef.current = null;
    });

    tourRef.current = tour;
    setIsActive(true);
    tour.start();
  }, [user, computePermissions, isMobile, destroyTour]);

  const start = useCallback(() => {
    buildAndStartTour();
  }, [buildAndStartTour]);

  const skip = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.cancel();
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await resetOnboarding();
    } catch (e) {
      console.warn('onboarding reset failed', e);
    }
    // Small delay so the avatar menu close animation completes before the tour spotlight grabs focus.
    setTimeout(() => buildAndStartTour(), 300);
  }, [buildAndStartTour]);

  // Auto-launch on first login.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getOnboardingStatus()
      .then(({ shouldShow }) => {
        if (cancelled || !shouldShow) return;
        // Wait 600ms after user mounts so HomePage (and Sidebar) finish their initial render and data-tour selectors exist.
        setTimeout(() => { if (!cancelled) buildAndStartTour(); }, 600);
      })
      .catch(e => console.warn('onboarding status fetch failed', e));

    return () => {
      cancelled = true;
      destroyTour();
    };
  }, [userId, buildAndStartTour, destroyTour]);

  const value = useMemo(() => ({ start, restart, skip, isActive }), [start, restart, skip, isActive]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};
```

Notes:
- Uses `Shepherd.Tour` directly (not `react-shepherd`'s `ShepherdJourneyProvider`). Simpler: one provider, direct control over the tour lifecycle. `react-shepherd` is mainly useful when you want the `<ShepherdButton>` JSX helpers — we don't need them since our steps are data-driven, which is why Task 4 installs only `shepherd.js`.
- The `useEffect` cleanup destroys the tour on logout/unmount.
- `useMediaQuery` re-runs on resize; if a user resizes mid-tour, the existing tour keeps its steps. New tours pick up the new viewport. Acceptable for v1.

- [ ] **Step 3: Type-check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors. If you see "Cannot find module 'shepherd.js'", verify Task 4 install.

- [ ] **Step 4: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/components/onboarding/ && git commit -m "feat(onboarding): provider + useOnboarding hook with auto-start on first login"
```

---

## Task 8: Frontend — shepherd CSS overrides (Prestige Light)

**Files:**
- Create: `src/styles/shepherd.css`
- Modify: `src/index.tsx`

- [ ] **Step 1: Create the CSS file**

Create `src/styles/shepherd.css`:

```css
/* OptimusCredit — Prestige Light overrides for shepherd.js */

.shepherd-element.optimus-shepherd {
  max-width: 380px;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.18);
  font-family: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.shepherd-element.optimus-shepherd.shepherd-enabled {
  opacity: 1;
  transform: translateY(0);
}

.shepherd-element.optimus-shepherd .shepherd-content {
  background: transparent;
  border-radius: 12px;
  padding: 0;
}

.shepherd-element.optimus-shepherd .shepherd-header {
  background: transparent;
  padding: 20px 24px 8px;
  border: none;
}

.shepherd-element.optimus-shepherd .shepherd-title {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: #1E293B;
  line-height: 1.3;
}

.shepherd-element.optimus-shepherd .shepherd-cancel-icon {
  color: #94A3B8;
  font-size: 22px;
  line-height: 1;
  padding: 0;
  margin-left: 12px;
  transition: color 120ms;
}
.shepherd-element.optimus-shepherd .shepherd-cancel-icon:hover {
  color: #1E293B;
}

.shepherd-element.optimus-shepherd .shepherd-text {
  padding: 4px 24px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}

.shepherd-element.optimus-shepherd .shepherd-text strong {
  color: #1E293B;
  font-weight: 600;
}

.shepherd-element.optimus-shepherd .shepherd-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid #F1F5F9;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.shepherd-element.optimus-shepherd .shepherd-button {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  padding: 8px 16px;
  border: none;
  cursor: pointer;
  transition: background 150ms, color 150ms, transform 80ms;
}

.shepherd-element.optimus-shepherd .shepherd-button.shepherd-btn-primary {
  background: #1F4E79;
  color: #FFFFFF;
}
.shepherd-element.optimus-shepherd .shepherd-button.shepherd-btn-primary:hover {
  background: #163E5E;
}
.shepherd-element.optimus-shepherd .shepherd-button.shepherd-btn-primary:active {
  transform: scale(0.98);
}

.shepherd-element.optimus-shepherd .shepherd-button.shepherd-btn-secondary {
  background: transparent;
  color: #64748B;
}
.shepherd-element.optimus-shepherd .shepherd-button.shepherd-btn-secondary:hover {
  color: #1E293B;
  background: #F1F5F9;
}

/* Arrow color matches border */
.shepherd-element.optimus-shepherd .shepherd-arrow:before {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
}

/* Modal overlay */
.shepherd-modal-overlay-container {
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .shepherd-element.optimus-shepherd {
    transition: none;
  }
}
```

- [ ] **Step 2: Import the CSS in the entry file**

Edit `src/index.tsx`. Find the line `import './index.css';` and replace it with:

```typescript
import './index.css';
import './styles/shepherd.css';
```

(`shepherd.js/dist/css/shepherd.css` is already imported by `OnboardingProvider.tsx` so our override comes after at runtime because Vite resolves imports in dependency order.)

- [ ] **Step 3: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/styles/shepherd.css src/index.tsx && git commit -m "feat(onboarding): Prestige Light theme for shepherd tooltips"
```

---

## Task 9: Frontend — wire the provider into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the provider**

Edit `src/App.tsx`. Find the imports block (around line 10) and add after `ModuleProfileProvider`:

```typescript
import { ModuleProfileProvider } from './contexts/ModuleProfileContext';
import { OnboardingProvider } from './components/onboarding/OnboardingProvider';
```

- [ ] **Step 2: Wrap children with OnboardingProvider**

Locate the provider nesting (around line 592):

```typescript
      <CompanyProvider>
        <UserProvider>
          <AppProvider>
            <ModuleProfileProvider>
              {/* existing children */}
            </ModuleProfileProvider>
          </AppProvider>
        </UserProvider>
      </CompanyProvider>
```

Wrap the children of `ModuleProfileProvider` with `OnboardingProvider`:

```typescript
      <CompanyProvider>
        <UserProvider>
          <AppProvider>
            <ModuleProfileProvider>
              <OnboardingProvider>
                {/* existing children */}
              </OnboardingProvider>
            </ModuleProfileProvider>
          </AppProvider>
        </UserProvider>
      </CompanyProvider>
```

`OnboardingProvider` must be **inside** `UserProvider`, `CompanyProvider`, and `ModuleProfileProvider` because it consumes `useUser()` and `useModuleAccess()` (which depends on the module profile context).

- [ ] **Step 3: Type-check + dev build**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/App.tsx && git commit -m "feat(onboarding): mount OnboardingProvider in App tree"
```

---

## Task 10: Frontend — add `data-tour` selectors in Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Wrap the 4 SectionHeader sections with data-tour markers**

Edit `src/components/Sidebar.tsx`. The four target sections are at lines 479, 497, 515, 612 (approx). For each section, wrap the existing `<>...</>` fragment with a `<Box data-tour="...">` that contains the SectionHeader and the Collapse.

**Section 1 — Pilotage & Rapports (line ~478)**

Find:
```tsx
        {/* Tableaux de bord & Rapports */}
        {dashboardItems.length > 0 && (
          <>
            <SectionHeader
              label="Pilotage & Rapports"
```

Replace with:
```tsx
        {/* Tableaux de bord & Rapports */}
        {dashboardItems.length > 0 && (
          <Box data-tour="sidebar-dashboard">
            <SectionHeader
              label="Pilotage & Rapports"
```

And the matching closing `</>` of that conditional block becomes `</Box>`.

**Section 2 — Processus Crédit (line ~497)**

Find:
```tsx
        {/* Processus Crédit — masqué si aucun item accessible */}
        {creditProcessItems.length > 0 && (
          <>
            <SectionHeader
              label={t('navigation.creditProcess')}
```

Replace the opening `<>` with `<Box data-tour="sidebar-credit">` and the matching closing `</>` with `</Box>`.

**Section 3 — Analyse hors-processus (line ~515)**

Find:
```tsx
        {/* Analyse hors-processus — uniquement pour les profils financiers */}
        {outOfProcessItems.length > 0 && (
          <>
            <SectionHeader
              label={t('navigation.outOfProcessAnalysis')}
```

Replace the opening `<>` with `<Box data-tour="sidebar-analysis">` and the matching closing `</>` with `</Box>`.

**Section 4 — Configuration (line ~612)**

Find:
```tsx
        {/* Configuration — admin seulement */}
        {configItems.length > 0 && (
          <>
            <SectionHeader
              label="Configuration"
```

Replace the opening `<>` with `<Box data-tour="sidebar-config">` and the matching closing `</>` with `</Box>`.

Make sure `Box` is already imported from `@mui/material` (it is — used throughout the file).

- [ ] **Step 2: Type-check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Visual sanity check (manual)**

Start the dev server if not running:
```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

Open the app, login, open DevTools, run in the console:
```js
['sidebar-dashboard','sidebar-credit','sidebar-analysis','sidebar-config'].forEach(s => console.log(s, document.querySelector(`[data-tour="${s}"]`)));
```

Expected: each present section logs an HTMLElement (sections hidden by permissions log `null`, that's fine).

- [ ] **Step 4: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/components/Sidebar.tsx && git commit -m "feat(onboarding): add data-tour selectors on Sidebar sections"
```

---

## Task 11: Frontend — Header data-tour + "Refaire le tour" menu item

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add data-tour on mobile hamburger**

Edit `src/components/Header.tsx`. Find the IconButton that opens the drawer (around line 154):

```tsx
        <IconButton
          aria-label="open drawer"
          onClick={onMenuClick}
```

Add the `data-tour` attribute:

```tsx
        <IconButton
          data-tour="mobile-menu-trigger"
          aria-label="open drawer"
          onClick={onMenuClick}
```

- [ ] **Step 2: Add data-tour on the avatar trigger**

Find the avatar IconButton (around line 354-355):

```tsx
              <Tooltip title="Mon compte" enterDelay={400}>
                <IconButton
                  onClick={handleUserMenuClick}
```

Wrap or modify to add `data-tour`. The simplest is to put it on the IconButton:

```tsx
              <Tooltip title="Mon compte" enterDelay={400}>
                <IconButton
                  data-tour="header-profile"
                  onClick={handleUserMenuClick}
```

- [ ] **Step 3: Import the hook and the icon**

Near the top of `src/components/Header.tsx`, add:

```tsx
import TourIcon from '@mui/icons-material/TourOutlined';
import { useOnboarding } from './onboarding/useOnboarding';
```

Then inside the `Header` component body (near where other hooks are called like `useUser`):

```tsx
  const { restart: restartOnboarding } = useOnboarding();
```

- [ ] **Step 4: Add the menu item**

Find the user menu items section (around line 469-472):

```tsx
                <MenuItem onClick={handleChangePasswordClick}>
                  <ListItemIcon><LockIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Changer mon mot de passe" />
                </MenuItem>

                <Divider sx={{ borderColor: HDR.menuDivider }} />
```

Insert a new MenuItem right before the `<Divider>`:

```tsx
                <MenuItem onClick={handleChangePasswordClick}>
                  <ListItemIcon><LockIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Changer mon mot de passe" />
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    restartOnboarding();
                  }}
                >
                  <ListItemIcon><TourIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Refaire le tour de bienvenue" />
                </MenuItem>

                <Divider sx={{ borderColor: HDR.menuDivider }} />
```

`handleUserMenuClose` is already defined in the component (used by other menu items). `restartOnboarding` handles the API reset + delay + tour start internally.

- [ ] **Step 5: Type-check**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git add src/components/Header.tsx && git commit -m "feat(onboarding): add 'Refaire le tour' menu item and data-tour selectors"
```

---

## Task 12: End-to-end manual verification

**Files:** (no edits — verification only)

- [ ] **Step 1: Start the full stack**

In two terminals:

```bash
# Terminal 1 — backend
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev
```

```bash
# Terminal 2 — frontend
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

- [ ] **Step 2: Reset onboarding for the test user via SQL**

Pick a test user (e.g. a CHARGE_AFFAIRES from the BCI seed). In a third terminal:

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.updateMany({ where: { email: 'charge1@bci.test' }, data: { onboardingCompletedAt: null } }).then(r => { console.log('updated', r.count); return p.\$disconnect(); });"
```

Replace `charge1@bci.test` with an actual email from your seed.

- [ ] **Step 3: Login and observe the tour**

Open the app, login as the test user. Expected:
- HomePage loads first.
- After ~600ms, the welcome modal appears centered with title "Bienvenue sur OptimusCredit" and a "Commencer" button.
- The X icon (top-right of the tooltip) is visible and styled in light grey.

- [ ] **Step 4: Walk through the tour**

Click "Commencer". Expected:
- Spotlight darkens the background, highlights the "Pilotage & Rapports" sidebar section.
- Tooltip with title and text, "Précédent" + "Suivant" buttons, and "Étape 2/N" indicator (built-in shepherd).
- Step through to the end. The last step shows "Terminer".

- [ ] **Step 5: Verify completion is persisted**

After clicking "Terminer", in the SQL terminal:

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.findFirst({ where: { email: 'charge1@bci.test' }, select: { onboardingCompletedAt: true } }).then(r => { console.log(r); return p.\$disconnect(); });"
```

Expected: `{ onboardingCompletedAt: <recent ISO date> }`.

- [ ] **Step 6: Verify no auto-relaunch**

Log out, log back in. Expected: HomePage loads, no tour appears.

- [ ] **Step 7: Verify "Refaire le tour"**

Open avatar menu, click "Refaire le tour de bienvenue". Expected:
- Menu closes.
- After ~300ms, the welcome modal reappears.
- DB: `onboardingCompletedAt` is briefly null then re-set after completion.

- [ ] **Step 8: Verify permission filtering**

Logout. Reset onboarding for a user without `financial_analysis` permission (e.g. a COMITE_CREDIT seed user). Login. Expected: the "Analyse financière" step is **skipped** — the tour jumps from sidebar-credit to sidebar-config (or to header-profile if config is also missing).

- [ ] **Step 9: Verify mobile fallback**

Open DevTools, set viewport to 375x800 (mobile). Reset onboarding, reload, login. Expected:
- Welcome modal appears.
- Next step: spotlight on the hamburger icon with text about modules being in the menu.
- Steps 2-5 from desktop are collapsed into this single step.
- Profile step at the end still works (avatar is visible in mobile header).

- [ ] **Step 10: Verify keyboard accessibility**

Reset onboarding. Login. Use only the keyboard:
- `Tab` to focus the "Commencer" button → `Enter` → next step.
- `→` arrow → advances.
- `←` arrow → goes back.
- `Esc` → tour closes, `onboardingCompletedAt` is set (verify via SQL).

- [ ] **Step 11: Verify API failure doesn't crash UX**

Stop the backend. In the browser, open the avatar menu and click "Refaire le tour". Expected:
- Console shows `onboarding reset failed` warning.
- After 300ms, the tour starts anyway (the failure of reset doesn't block the tour from launching — the local `buildAndStartTour` runs regardless).
- On next login (after backend restored), depending on whether `onboardingCompletedAt` was successfully nulled, behavior may vary. This is acceptable: the user clearly attempted a manual relaunch, the offline-first behavior is sensible.

- [ ] **Step 12: Final commit (if any pending changes)**

If verification revealed any small fixes (typo in step text, etc.), commit them now:

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && git status && git diff
# Then add + commit any fixes
```

---

## Self-review checklist (run after writing this plan)

- [x] **Spec coverage:**
  - Migration Prisma + 3 endpoints → Tasks 1-3 ✓
  - Provider + filtering by permissions → Tasks 6-7 ✓
  - Coachmark + welcome/done modal → Task 6 (buildSteps) ✓
  - Mobile variant → Task 6 ✓
  - Prestige Light styling → Task 8 ✓
  - data-tour selectors → Tasks 10-11 ✓
  - "Refaire le tour" menu item → Task 11 ✓
  - No-backfill decision honored (migration has no UPDATE) → Task 1 step 2 ✓
- [x] **Placeholder scan:** none found.
- [x] **Type consistency:**
  - `OnboardingPermissions` interface used identically in Tasks 6 & 7 ✓
  - `getOnboardingStatus / completeOnboarding / resetOnboarding` named identically in Tasks 5, 7 ✓
  - Field name `onboardingCompletedAt` consistent across schema, route, service, provider ✓
  - `data-tour` selector values consistent between Tasks 6 (consumer), 10 (producer Sidebar), 11 (producer Header) ✓
