# Module Profiles & Data Scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un système dynamique de profils de modules (ERPNext-style) permettant à chaque admin tenant de configurer quels écrans, actions et sections chaque rôle peut voir, avec périmètres de données (agence/réseau) et délégation de périmètre.

**Architecture:** Le catalogue de modules est défini statiquement dans `moduleRegistry.ts`. Les assignations rôle→modules et les overrides par utilisateur sont stockés en base Prisma (ModuleProfile + UserModuleOverride). Un contexte React (`ModuleProfileContext`) charge le profil fusionné au login et expose un hook `useModuleAccess()` consommé par la Sidebar et les composants.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript, React/TypeScript, MUI v5, Jest (backend), Redis (cache)

---

## Fichiers créés / modifiés

### Backend
| Fichier | Action | Rôle |
|---------|--------|------|
| `backend/prisma/schema.prisma` | Modifier | Ajouter DataScope enum + 3 modèles |
| `backend/prisma/migrations/` | Créer | Migration auto via `prisma migrate dev` |
| `backend/src/constants/defaultModuleProfiles.ts` | Créer | Profils par défaut pour les 10 rôles |
| `backend/src/services/moduleProfileService.ts` | Créer | Logique de fusion rôle + override + délégation |
| `backend/src/routes/module-profiles.ts` | Créer | CRUD profils + overrides utilisateurs |
| `backend/src/routes/scope-delegates.ts` | Créer | CRUD délégations de périmètre |
| `backend/src/middleware/scopeFilter.ts` | Créer | Injecte `req.branchFilter` selon scope effectif |
| `backend/src/server.ts` | Modifier | Enregistrer les 2 nouvelles routes |
| `backend/src/__tests__/moduleProfileService.test.ts` | Créer | Tests unitaires fusion scope |
| `backend/src/__tests__/scopeFilter.test.ts` | Créer | Tests d'intégration middleware scopeFilter |

### Frontend
| Fichier | Action | Rôle |
|---------|--------|------|
| `src/config/moduleRegistry.ts` | Créer | Catalogue statique de tous les modules |
| `src/contexts/ModuleProfileContext.tsx` | Créer | Contexte global profil fusionné |
| `src/hooks/useModuleAccess.ts` | Créer | Hook `canAccess / canAction / canSeeSection` |
| `src/services/api.ts` | Modifier | Ajouter méthodes module-profiles + scope-delegates |
| `src/components/module-profiles/RoleProfileEditor.tsx` | Créer | Éditeur visuel par rôle |
| `src/components/module-profiles/UserScopeEditor.tsx` | Créer | Override scope + modules par utilisateur |
| `src/components/module-profiles/ScopeDelegateManager.tsx` | Créer | Gestion délégations de périmètre |
| `src/components/module-profiles/ModuleProfileTab.tsx` | Créer | Onglet orchestrateur dans UserManagement |
| `src/pages/UserManagementPage.tsx` | Modifier | Ajouter l'onglet "Profils de modules" (index 7) |
| `src/components/Sidebar.tsx` | Modifier | Ajouter `canAccess()` sur chaque item de menu |
| `src/App.tsx` | Modifier | Envelopper avec `ModuleProfileProvider` |

---

## Task 1 : Prisma — Enum DataScope + 3 nouveaux modèles

**Fichiers :**
- Modifier : `backend/prisma/schema.prisma`

- [ ] **Étape 1 : Ajouter l'enum DataScope dans schema.prisma**

Ouvrir `backend/prisma/schema.prisma`. Chercher `enum PolicyStatus`. Ajouter **avant** :

```prisma
enum DataScope {
  BRANCH_ONLY  @map("branch_only")
  MULTI_BRANCH @map("multi_branch")
  ALL_BRANCHES @map("all_branches")

  @@map("data_scope")
}
```

- [ ] **Étape 2 : Ajouter le modèle ModuleProfile**

À la fin du fichier (avant la dernière accolade si elle existe, sinon à la fin) :

```prisma
model ModuleProfile {
  id              String    @id @default(cuid())
  companyId       String    @map("company_id")
  role            UserRole
  label           String
  modules         Json
  defaultScope    DataScope @default(BRANCH_ONLY) @map("default_scope")
  allowedBranches String[]  @default([]) @map("allowed_branches")
  isDefault       Boolean   @default(false) @map("is_default")
  createdById     String    @map("created_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  company   Company @relation(fields: [companyId], references: [id])
  createdBy User    @relation("ModuleProfileCreatedBy", fields: [createdById], references: [id])

  @@unique([companyId, role])
  @@index([companyId])
  @@map("module_profiles")
}
```

- [ ] **Étape 3 : Ajouter le modèle UserModuleOverride**

```prisma
model UserModuleOverride {
  id              String     @id @default(cuid())
  userId          String     @map("user_id")
  companyId       String     @map("company_id")
  modules         Json?
  dataScope       DataScope? @map("data_scope")
  allowedBranches String[]   @default([]) @map("allowed_branches")
  createdById     String     @map("created_by_id")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  user      User    @relation(fields: [userId], references: [id])
  company   Company @relation(fields: [companyId], references: [id])
  createdBy User    @relation("OverrideCreatedBy", fields: [createdById], references: [id])

  @@unique([userId, companyId])
  @@map("user_module_overrides")
}
```

- [ ] **Étape 4 : Ajouter le modèle ScopeDelegate**

```prisma
model ScopeDelegate {
  id              String    @id @default(cuid())
  delegatorId     String    @map("delegator_id")
  delegateId      String    @map("delegate_id")
  companyId       String    @map("company_id")
  scope           DataScope
  allowedBranches String[]  @default([]) @map("allowed_branches")
  allowedActions  String[]  @default([]) @map("allowed_actions")
  startDate       DateTime  @map("start_date")
  endDate         DateTime? @map("end_date")
  isActive        Boolean   @default(true) @map("is_active")
  revokedAt       DateTime? @map("revoked_at")
  revokedById     String?   @map("revoked_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")

  delegator User    @relation("ScopeDelegatorRel", fields: [delegatorId], references: [id])
  delegate  User    @relation("ScopeDelegateRel", fields: [delegateId], references: [id])
  company   Company @relation(fields: [companyId], references: [id])
  revokedBy User?   @relation("ScopeRevokedBy", fields: [revokedById], references: [id])

  @@index([delegateId, isActive])
  @@index([companyId])
  @@map("scope_delegates")
}
```

- [ ] **Étape 5 : Ajouter les relations manquantes sur Company et User**

Dans `model Company`, ajouter dans le bloc des relations :
```prisma
  moduleProfiles      ModuleProfile[]
  userModuleOverrides UserModuleOverride[]
  scopeDelegates      ScopeDelegate[]
```

Dans `model User`, ajouter :
```prisma
  createdModuleProfiles   ModuleProfile[]      @relation("ModuleProfileCreatedBy")
  moduleOverride          UserModuleOverride?
  createdOverrides        UserModuleOverride[] @relation("OverrideCreatedBy")
  scopeDelegationsGiven   ScopeDelegate[]      @relation("ScopeDelegatorRel")
  scopeDelegationsReceived ScopeDelegate[]     @relation("ScopeDelegateRel")
  scopeDelegationsRevoked ScopeDelegate[]      @relation("ScopeRevokedBy")
```

- [ ] **Étape 6 : Lancer la migration**

```bash
cd backend && npx prisma migrate dev --name add_module_profiles
```

Résultat attendu : `✔ Generated Prisma Client` + 3 nouvelles tables dans la DB.

- [ ] **Étape 7 : Vérifier que le client Prisma compile**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Étape 8 : Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): ajouter DataScope, ModuleProfile, UserModuleOverride, ScopeDelegate"
```

---

## Task 2 : Constante DEFAULT_ROLE_PROFILES

**Fichiers :**
- Créer : `backend/src/constants/defaultModuleProfiles.ts`

- [ ] **Étape 1 : Créer le fichier**

```typescript
// backend/src/constants/defaultModuleProfiles.ts

export interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export interface ModuleProfileData {
  label: string;
  defaultScope: 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES';
  allowedBranches: string[];
  modules: Record<string, ModuleAccess>;
}

const ALL_MODULES: Record<string, ModuleAccess> = {
  home:                 { visible: true,  actions: [], sections: [] },
  clients:              { visible: true,  actions: ['create','edit','delete','export'], sections: [] },
  'credit-application': { visible: true,  actions: ['create','submit'], sections: [] },
  dispatching:          { visible: true,  actions: ['dispatch'], sections: [] },
  approvals:            { visible: true,  actions: ['approve','reject','comment','export'], sections: ['pending','history'] },
  workflow:             { visible: true,  actions: ['edit_workflow'], sections: [] },
  analytics:            { visible: true,  actions: ['export'], sections: ['portfolio','performance','compliance'] },
  'credit-scoring':     { visible: true,  actions: [], sections: [] },
  'credit-simulation':  { visible: true,  actions: [], sections: [] },
  'data-input':         { visible: true,  actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
  analysis:             { visible: true,  actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
  reports:              { visible: true,  actions: ['export','print'], sections: [] },
  'credit-policy':      { visible: true,  actions: ['edit_policy','activate','archive'], sections: [] },
  'credit-types':       { visible: true,  actions: ['create','edit','delete'], sections: [] },
  'approval-limits':    { visible: true,  actions: ['edit'], sections: [] },
  'contract-templates': { visible: true,  actions: ['upload','edit','delete'], sections: [] },
  'legal-step':         { visible: true,  actions: ['validate','reject'], sections: [] },
  'raci-matrix':        { visible: true,  actions: ['edit','import'], sections: [] },
  'user-management':    { visible: true,  actions: ['create_user','edit_user','reset_password','deactivate'], sections: ['users','roles','module-profiles'] },
  'bank-holidays-admin':{ visible: true,  actions: ['create','edit','delete'], sections: [] },
  'notifications-config':{ visible: true, actions: ['edit'], sections: [] },
  announcements:        { visible: true,  actions: ['create','edit','delete'], sections: [] },
};

const none = (overrides: Partial<Record<string, Partial<ModuleAccess>>> = {}): Record<string, ModuleAccess> => {
  const base: Record<string, ModuleAccess> = {};
  for (const key of Object.keys(ALL_MODULES)) {
    base[key] = { visible: false, actions: [], sections: [] };
  }
  for (const [key, val] of Object.entries(overrides)) {
    base[key] = { visible: true, actions: [], sections: [], ...val };
  }
  return base;
};

export const DEFAULT_ROLE_PROFILES: Record<string, ModuleProfileData> = {
  CHARGE_AFFAIRES: {
    label: "Chargé d'Affaires",
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:                 {},
      clients:              { actions: ['create','edit'] },
      'credit-application': { actions: ['create','submit'] },
      approvals:            { actions: ['comment'], sections: ['pending'] },
      workflow:             {},
    }),
  },
  ANALYSTE_RISQUES: {
    label: 'Analyste Risques',
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:       {},
      clients:    { actions: ['edit'] },
      approvals:  { actions: ['comment'], sections: ['pending','history'] },
      'data-input': { actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
      analysis:   { actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
      reports:    { actions: ['export'] },
      'credit-scoring': {},
    }),
  },
  RESPONSABLE_RISQUES: {
    label: 'Responsable Risques',
    defaultScope: 'MULTI_BRANCH',
    allowedBranches: [],
    modules: none({
      home:       {},
      clients:    { actions: ['edit','export'] },
      approvals:  { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      'data-input': { actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
      analysis:   { actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
      reports:    { actions: ['export','print'] },
      analytics:  { sections: ['portfolio','performance'] },
      'credit-scoring': {},
    }),
  },
  RESPONSABLE_ENGAGEMENTS: {
    label: 'Responsable Engagements',
    defaultScope: 'MULTI_BRANCH',
    allowedBranches: [],
    modules: none({
      home:       {},
      clients:    { actions: ['export'] },
      approvals:  { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      analytics:  { actions: ['export'], sections: ['portfolio','performance','compliance'] },
      'credit-policy': { actions: [] },
      workflow:   {},
    }),
  },
  COMITE_CREDIT: {
    label: 'Comité de Crédit',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: none({
      home:        {},
      clients:     { actions: ['export'] },
      approvals:   { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      analytics:   { actions: ['export'], sections: ['portfolio','performance','compliance'] },
      'credit-policy': {},
      workflow:    {},
    }),
  },
  DIRECTION_GENERALE: {
    label: 'Direction Générale',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: { ...ALL_MODULES },
  },
  BACK_OFFICE: {
    label: 'Back Office',
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:        {},
      clients:     { actions: ['edit'] },
      workflow:    {},
      'legal-step':{ actions: ['validate','reject'] },
      'contract-templates': { actions: ['upload'] },
    }),
  },
  DIRECTION_JURIDIQUE: {
    label: 'Direction Juridique',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: none({
      home:        {},
      clients:     { actions: ['export'] },
      'legal-step':{ actions: ['validate','reject'] },
      'contract-templates': { actions: ['upload','edit','delete'] },
      approvals:   { actions: ['comment'], sections: ['history'] },
    }),
  },
  ADMIN: {
    label: 'Administrateur',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: (() => {
      const m = { ...ALL_MODULES };
      return m;
    })(),
  },
  SUPER_ADMIN: {
    label: 'Super Administrateur',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: { ...ALL_MODULES },
  },
};
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/constants/defaultModuleProfiles.ts
git commit -m "feat(module-profiles): ajouter les profils par défaut des 10 rôles"
```

---

## Task 3 : Service de fusion moduleProfileService

**Fichiers :**
- Créer : `backend/src/services/moduleProfileService.ts`
- Créer : `backend/src/__tests__/moduleProfileService.test.ts`

- [ ] **Étape 1 : Écrire les tests d'abord**

```typescript
// backend/src/__tests__/moduleProfileService.test.ts
import { mergeModuleProfile, resolveDataScope } from '../services/moduleProfileService';
import { ModuleAccess } from '../constants/defaultModuleProfiles';

describe('resolveDataScope', () => {
  const base = 'BRANCH_ONLY' as const;
  const multi = 'MULTI_BRANCH' as const;
  const all = 'ALL_BRANCHES' as const;

  it('retourne le scope de base si pas d\'override ni délégation', () => {
    expect(resolveDataScope(base, null, null)).toBe('BRANCH_ONLY');
  });

  it('l\'override remplace le scope de base', () => {
    expect(resolveDataScope(base, multi, null)).toBe('MULTI_BRANCH');
  });

  it('la délégation étend au-delà de l\'override (prend le max)', () => {
    expect(resolveDataScope(multi, null, all)).toBe('ALL_BRANCHES');
  });

  it('order: BRANCH_ONLY < MULTI_BRANCH < ALL_BRANCHES', () => {
    expect(resolveDataScope(all, base, multi)).toBe('ALL_BRANCHES');
  });
});

describe('mergeModuleProfile', () => {
  const baseModules: Record<string, ModuleAccess> = {
    clients:  { visible: true,  actions: ['create','edit'], sections: [] },
    approvals:{ visible: false, actions: [], sections: [] },
  };
  const overrideModules: Record<string, ModuleAccess> = {
    approvals:{ visible: true, actions: ['approve'], sections: ['pending'] },
  };

  it('le profil rôle seul est retourné intact si pas d\'override', () => {
    const result = mergeModuleProfile(baseModules, null);
    expect(result['clients'].visible).toBe(true);
    expect(result['approvals'].visible).toBe(false);
  });

  it('l\'override remplace le module concerné', () => {
    const result = mergeModuleProfile(baseModules, overrideModules);
    expect(result['approvals'].visible).toBe(true);
    expect(result['approvals'].actions).toContain('approve');
  });

  it('les modules non overridés restent inchangés', () => {
    const result = mergeModuleProfile(baseModules, overrideModules);
    expect(result['clients'].actions).toContain('create');
  });
});
```

- [ ] **Étape 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd backend && npx jest moduleProfileService --no-coverage
```

Résultat attendu : FAIL — `Cannot find module '../services/moduleProfileService'`

- [ ] **Étape 3 : Implémenter le service**

```typescript
// backend/src/services/moduleProfileService.ts
import { ModuleAccess, ModuleProfileData, DEFAULT_ROLE_PROFILES } from '../constants/defaultModuleProfiles';
import { prisma } from '../server';

type DataScopeValue = 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES';
const SCOPE_ORDER: DataScopeValue[] = ['BRANCH_ONLY', 'MULTI_BRANCH', 'ALL_BRANCHES'];

export function resolveDataScope(
  base: DataScopeValue,
  override: DataScopeValue | null,
  delegation: DataScopeValue | null
): DataScopeValue {
  const effective = override ?? base;
  if (!delegation) return effective;
  return SCOPE_ORDER.indexOf(delegation) > SCOPE_ORDER.indexOf(effective) ? delegation : effective;
}

export function mergeModuleProfile(
  baseModules: Record<string, ModuleAccess>,
  overrideModules: Record<string, ModuleAccess> | null
): Record<string, ModuleAccess> {
  if (!overrideModules) return { ...baseModules };
  return { ...baseModules, ...overrideModules };
}

export async function getMergedProfile(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new Error('User not found');

  const roleKey = user.role as string;

  // 1. Profil rôle du tenant (ou défaut système)
  let roleProfile = await prisma.moduleProfile.findUnique({
    where: { companyId_role: { companyId, role: user.role } }
  });

  if (!roleProfile) {
    // Seed automatique à la première demande
    const def = DEFAULT_ROLE_PROFILES[roleKey];
    if (!def) throw new Error(`No default profile for role ${roleKey}`);

    const adminUser = await prisma.user.findFirst({
      where: { companyId: undefined, role: 'SUPER_ADMIN' as any }
    });

    roleProfile = await prisma.moduleProfile.create({
      data: {
        companyId,
        role: user.role,
        label: def.label,
        modules: def.modules as any,
        defaultScope: def.defaultScope as any,
        allowedBranches: def.allowedBranches,
        isDefault: true,
        createdById: userId,
      }
    });
  }

  // 2. Override utilisateur
  const userOverride = await prisma.userModuleOverride.findUnique({
    where: { userId_companyId: { userId, companyId } }
  });

  // 3. Délégation active
  const now = new Date();
  const delegation = await prisma.scopeDelegate.findFirst({
    where: {
      delegateId: userId,
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }]
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. Fusion scope
  const baseScope = (userOverride?.dataScope ?? roleProfile.defaultScope) as DataScopeValue;
  const delegationScope = delegation?.scope as DataScopeValue | null ?? null;
  const finalScope = resolveDataScope(
    roleProfile.defaultScope as DataScopeValue,
    userOverride?.dataScope as DataScopeValue | null ?? null,
    delegationScope
  );

  // 5. Branches effectives
  const baseBranches = userOverride?.allowedBranches?.length
    ? userOverride.allowedBranches
    : roleProfile.allowedBranches;
  const finalBranches = delegation
    ? [...new Set([...baseBranches, ...delegation.allowedBranches])]
    : baseBranches;

  // 6. Fusion modules
  const baseModules = roleProfile.modules as Record<string, ModuleAccess>;
  const overrideModules = userOverride?.modules as Record<string, ModuleAccess> | null ?? null;
  const finalModules = mergeModuleProfile(baseModules, overrideModules);

  return {
    role: roleKey,
    label: roleProfile.label,
    modules: finalModules,
    dataScope: finalScope,
    allowedBranches: finalBranches,
    delegationActive: !!delegation,
    delegationActions: delegation?.allowedActions ?? [],
  };
}

export async function seedDefaultProfiles(companyId: string, createdById: string) {
  for (const [roleKey, def] of Object.entries(DEFAULT_ROLE_PROFILES)) {
    await prisma.moduleProfile.upsert({
      where: { companyId_role: { companyId, role: roleKey as any } },
      update: {},
      create: {
        companyId,
        role: roleKey as any,
        label: def.label,
        modules: def.modules as any,
        defaultScope: def.defaultScope as any,
        allowedBranches: def.allowedBranches,
        isDefault: true,
        createdById,
      }
    });
  }
}
```

- [ ] **Étape 4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd backend && npx jest moduleProfileService --no-coverage
```

Résultat attendu : PASS (les fonctions pures `resolveDataScope` et `mergeModuleProfile` sont testées sans DB).

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/services/moduleProfileService.ts backend/src/__tests__/moduleProfileService.test.ts
git commit -m "feat(module-profiles): service de fusion rôle + override + délégation (TDD)"
```

---

## Task 4 : Route backend module-profiles

**Fichiers :**
- Créer : `backend/src/routes/module-profiles.ts`

- [ ] **Étape 1 : Créer la route**

```typescript
// backend/src/routes/module-profiles.ts
import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { getMergedProfile, seedDefaultProfiles } from '../services/moduleProfileService';
import { DEFAULT_ROLE_PROFILES } from '../constants/defaultModuleProfiles';
import { cacheGet, cacheSet, cacheDel } from '../services/redis';

const CACHE_TTL = 300; // 5 minutes
const cacheKey = (companyId: string, userId: string) => `module-profile:${companyId}:${userId}`;

const router = express.Router();

const requireAdmin = (req: Request, res: Response, next: express.NextFunction) => {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// GET /api/module-profiles/me — profil fusionné de l'utilisateur connecté (avec cache Redis)
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const companyId = req.user!.companyId;
  if (!companyId) throw new AppError('Company context required', 400, 'NO_COMPANY');

  const key = cacheKey(companyId, userId);
  const cached = await cacheGet(key);
  if (cached) return res.json({ success: true, data: JSON.parse(cached) });

  const profile = await getMergedProfile(userId, companyId);
  await cacheSet(key, JSON.stringify(profile), CACHE_TTL);
  res.json({ success: true, data: profile });
}));

// GET /api/module-profiles — liste tous les profils du tenant
router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  if (!companyId) throw new AppError('Company context required', 400, 'NO_COMPANY');

  const profiles = await prisma.moduleProfile.findMany({ where: { companyId } });
  res.json({ success: true, data: profiles });
}));

// GET /api/module-profiles/:role — profil d'un rôle précis
router.get('/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.user!.companyId!;

  const profile = await prisma.moduleProfile.findUnique({
    where: { companyId_role: { companyId, role: role as any } }
  });

  if (!profile) throw new AppError('Profile not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: profile });
}));

// PUT /api/module-profiles/:role — créer/mettre à jour le profil d'un rôle
router.put('/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const { modules, defaultScope, allowedBranches, label } = req.body;
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;

  if (!modules || !defaultScope) {
    throw new AppError('modules et defaultScope sont requis', 400, 'MISSING_FIELDS');
  }

  const profile = await prisma.moduleProfile.upsert({
    where: { companyId_role: { companyId, role: role as any } },
    update: { modules, defaultScope, allowedBranches: allowedBranches ?? [], label, isDefault: false },
    create: { companyId, role: role as any, label: label ?? role, modules, defaultScope, allowedBranches: allowedBranches ?? [], isDefault: false, createdById: userId }
  });

  // Invalider le cache de tous les utilisateurs du tenant ayant ce rôle
  const affected = await prisma.companyMembership.findMany({ where: { companyId, role: role as any } });
  await Promise.all(affected.map(m => cacheDel(cacheKey(companyId, m.userId))));

  res.json({ success: true, data: profile });
}));

// POST /api/module-profiles/reset/:role — réinitialiser au profil système
router.post('/reset/:role', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;
  const def = DEFAULT_ROLE_PROFILES[role];
  if (!def) throw new AppError('Rôle inconnu', 404, 'UNKNOWN_ROLE');

  const profile = await prisma.moduleProfile.upsert({
    where: { companyId_role: { companyId, role: role as any } },
    update: { modules: def.modules as any, defaultScope: def.defaultScope as any, allowedBranches: def.allowedBranches, isDefault: true },
    create: { companyId, role: role as any, label: def.label, modules: def.modules as any, defaultScope: def.defaultScope as any, allowedBranches: def.allowedBranches, isDefault: true, createdById: userId }
  });

  res.json({ success: true, data: profile });
}));

// GET /api/module-profiles/users/:userId — override d'un utilisateur
router.get('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const companyId = req.user!.companyId!;

  const override = await prisma.userModuleOverride.findUnique({
    where: { userId_companyId: { userId, companyId } }
  });

  const mergedProfile = await getMergedProfile(userId, companyId);
  res.json({ success: true, data: { override, mergedProfile } });
}));

// PUT /api/module-profiles/users/:userId — créer/mettre à jour un override utilisateur
router.put('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { modules, dataScope, allowedBranches } = req.body;
  const companyId = req.user!.companyId!;
  const createdById = req.user!.id;

  const override = await prisma.userModuleOverride.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: { modules: modules ?? null, dataScope: dataScope ?? null, allowedBranches: allowedBranches ?? [] },
    create: { userId, companyId, modules: modules ?? null, dataScope: dataScope ?? null, allowedBranches: allowedBranches ?? [], createdById }
  });

  res.json({ success: true, data: override });
}));

// DELETE /api/module-profiles/users/:userId — supprimer l'override
router.delete('/users/:userId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const companyId = req.user!.companyId!;

  await prisma.userModuleOverride.deleteMany({ where: { userId, companyId } });
  await cacheDel(cacheKey(companyId, userId));
  res.json({ success: true, message: 'Override supprimé' });
}));

// PUT /api/module-profiles/users/:userId — invalider aussi le cache
// (ajout de l'invalidation dans le handler existant)
// Après l'upsert, ajouter : await cacheDel(cacheKey(companyId, userId));

// POST /api/module-profiles/seed — seeder les profils par défaut du tenant
router.post('/seed', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId!;
  const userId = req.user!.id;
  await seedDefaultProfiles(companyId, userId);
  res.json({ success: true, message: `Profils par défaut créés pour le tenant` });
}));

export default router;
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/routes/module-profiles.ts
git commit -m "feat(module-profiles): routes CRUD profils rôles + overrides utilisateurs"
```

---

## Task 5 : Route backend scope-delegates

**Fichiers :**
- Créer : `backend/src/routes/scope-delegates.ts`

- [ ] **Étape 1 : Créer la route**

```typescript
// backend/src/routes/scope-delegates.ts
import express, { Request, Response } from 'express';
import { prisma } from '../server';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

const requireAllBranchesScope = async (req: Request, res: Response, next: express.NextFunction) => {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'DIRECTION_GENERALE') {
    const companyId = req.user!.companyId!;
    const userId = req.user!.id;
    const profile = await prisma.moduleProfile.findUnique({
      where: { companyId_role: { companyId, role: req.user!.role as any } }
    });
    if (profile?.defaultScope !== 'ALL_BRANCHES') {
      return res.status(403).json({ success: false, error: 'Scope ALL_BRANCHES requis pour déléguer' });
    }
  }
  next();
};

// GET /api/scope-delegates
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.user!.companyId!;
  const now = new Date();

  const delegates = await prisma.scopeDelegate.findMany({
    where: {
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }]
    },
    include: {
      delegator: { select: { id: true, name: true, role: true } },
      delegate:  { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: delegates });
}));

// POST /api/scope-delegates
router.post('/', requireAllBranchesScope, asyncHandler(async (req: Request, res: Response) => {
  const { delegateId, scope, allowedBranches, allowedActions, startDate, endDate } = req.body;
  const companyId = req.user!.companyId!;
  const delegatorId = req.user!.id;

  if (!delegateId || !scope || !startDate) {
    throw new AppError('delegateId, scope et startDate sont requis', 400, 'MISSING_FIELDS');
  }

  const delegate = await prisma.scopeDelegate.create({
    data: {
      delegatorId,
      delegateId,
      companyId,
      scope,
      allowedBranches: allowedBranches ?? [],
      allowedActions: allowedActions ?? [],
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    }
  });

  res.status(201).json({ success: true, data: delegate });
}));

// PUT /api/scope-delegates/:id
router.put('/:id', requireAllBranchesScope, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { scope, allowedBranches, allowedActions, startDate, endDate } = req.body;

  const updated = await prisma.scopeDelegate.update({
    where: { id },
    data: {
      ...(scope && { scope }),
      ...(allowedBranches && { allowedBranches }),
      ...(allowedActions && { allowedActions }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    }
  });

  res.json({ success: true, data: updated });
}));

// DELETE /api/scope-delegates/:id — révocation
router.delete('/:id', requireAllBranchesScope, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const revokedById = req.user!.id;

  await prisma.scopeDelegate.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date(), revokedById }
  });

  res.json({ success: true, message: 'Délégation révoquée' });
}));

export default router;
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/routes/scope-delegates.ts
git commit -m "feat(scope-delegates): routes CRUD délégations de périmètre"
```

---

## Task 6 : Middleware scopeFilter + enregistrement des routes

**Fichiers :**
- Créer : `backend/src/middleware/scopeFilter.ts`
- Modifier : `backend/src/server.ts`

- [ ] **Étape 1 : Créer le middleware scopeFilter**

```typescript
// backend/src/middleware/scopeFilter.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

declare global {
  namespace Express {
    interface Request {
      branchFilter?: { branchId?: { in: string[] } } | {};
    }
  }
}

export const scopeFilter = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.companyId || !req.user?.id) return next();

  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    // Scope du profil rôle
    const roleProfile = await prisma.moduleProfile.findUnique({
      where: { companyId_role: { companyId, role: req.user.role as any } }
    });

    // Override utilisateur
    const userOverride = await prisma.userModuleOverride.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });

    const scope = userOverride?.dataScope ?? roleProfile?.defaultScope ?? 'BRANCH_ONLY';
    let branches = userOverride?.allowedBranches?.length
      ? userOverride.allowedBranches
      : roleProfile?.allowedBranches ?? [];

    // Délégation active
    const now = new Date();
    const delegation = await prisma.scopeDelegate.findFirst({
      where: {
        delegateId: userId,
        companyId,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }]
      }
    });

    const finalScope = (() => {
      const order = ['BRANCH_ONLY', 'MULTI_BRANCH', 'ALL_BRANCHES'];
      const base = order.indexOf(scope as string);
      const del = delegation ? order.indexOf(delegation.scope as string) : -1;
      return del > base ? delegation!.scope : scope;
    })();

    if (finalScope === 'ALL_BRANCHES') {
      req.branchFilter = {};
    } else {
      if (delegation) {
        branches = [...new Set([...branches, ...delegation.allowedBranches])];
      }
      const userBranch = (req.user as any).branch;
      if (finalScope === 'BRANCH_ONLY' && userBranch) {
        branches = [userBranch];
      }
      req.branchFilter = branches.length ? { branchId: { in: branches } } : {};
    }
  } catch {
    req.branchFilter = {};
  }

  next();
};
```

- [ ] **Étape 2 : Enregistrer les routes dans server.ts**

Ouvrir `backend/src/server.ts`. En haut avec les autres imports de routes, ajouter :

```typescript
import moduleProfileRoutes from './routes/module-profiles';
import scopeDelegateRoutes from './routes/scope-delegates';
```

Dans le bloc des `app.use(...)`, après la ligne `app.use('/api/roles', authenticate, roleRoutes);`, ajouter :

```typescript
app.use('/api/module-profiles', authenticate, moduleProfileRoutes);
app.use('/api/scope-delegates', authenticate, scopeDelegateRoutes);
```

- [ ] **Étape 3 : Vérifier la compilation complète**

```bash
cd backend && npx tsc --noEmit
```

Résultat attendu : 0 erreur.

- [ ] **Étape 4 : Démarrer le backend et tester manuellement**

```bash
cd backend && npm run dev
```

Tester avec curl (remplacer TOKEN par un token valide) :
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/module-profiles/me
```

Résultat attendu : `{ "success": true, "data": { "role": "...", "modules": {...}, "dataScope": "..." } }`

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/middleware/scopeFilter.ts backend/src/server.ts
git commit -m "feat(module-profiles): middleware scopeFilter + enregistrement des routes"
```

---

## Task 7 : Frontend — moduleRegistry.ts (catalogue statique)

**Fichiers :**
- Créer : `src/config/moduleRegistry.ts`

- [ ] **Étape 1 : Créer le fichier**

```typescript
// src/config/moduleRegistry.ts
import { PageType } from '../types';

export interface ModuleAction {
  id: string;
  label: string;
}

export interface ModuleSection {
  id: string;
  label: string;
}

export type ModuleGroup = 'Processus Crédit' | 'Analyse Financière' | 'Configuration' | 'Administration';

export interface ModuleDefinition {
  id: PageType;
  label: string;
  icon: string;        // nom icône MUI (ex: 'GroupsOutlined')
  group: ModuleGroup;
  actions: ModuleAction[];
  sections: ModuleSection[];
  superAdminOnly?: boolean;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  // Processus Crédit
  { id: 'home',               label: 'Tableau de bord',     icon: 'DashboardOutlined',    group: 'Processus Crédit',  actions: [], sections: [] },
  { id: 'clients',            label: 'Clients',              icon: 'GroupsOutlined',       group: 'Processus Crédit',  actions: [
    { id: 'create', label: 'Créer' }, { id: 'edit', label: 'Éditer' },
    { id: 'delete', label: 'Supprimer' }, { id: 'export', label: 'Exporter' }
  ], sections: [] },
  { id: 'credit-application', label: 'Nouvelle Demande',     group: 'Processus Crédit',  actions: [
    { id: 'create', label: 'Créer' }, { id: 'submit', label: 'Soumettre' }
  ], sections: [] },
  { id: 'dispatching',        label: 'Dispatching',          group: 'Processus Crédit',  actions: [
    { id: 'dispatch', label: 'Dispatcher' }
  ], sections: [] },
  { id: 'approvals',          label: 'Approbations',         group: 'Processus Crédit',  actions: [
    { id: 'approve', label: 'Approuver' }, { id: 'reject', label: 'Rejeter' },
    { id: 'comment', label: 'Commenter' }, { id: 'export', label: 'Exporter' }
  ], sections: [
    { id: 'pending', label: 'En attente' }, { id: 'history', label: 'Historique' }
  ] },
  { id: 'workflow',           label: 'Workflow',             group: 'Processus Crédit',  actions: [
    { id: 'edit_workflow', label: 'Modifier le workflow' }
  ], sections: [] },
  { id: 'analytics',         label: 'Analytique',           group: 'Processus Crédit',  actions: [
    { id: 'export', label: 'Exporter' }
  ], sections: [
    { id: 'portfolio', label: 'Portefeuille' }, { id: 'performance', label: 'Performance' },
    { id: 'compliance', label: 'Conformité' }
  ] },
  { id: 'credit-scoring',    label: 'Scoring Crédit',       group: 'Processus Crédit',  actions: [], sections: [] },
  { id: 'credit-simulation', label: 'Simulation Crédit',    group: 'Processus Crédit',  actions: [], sections: [] },

  // Analyse Financière
  { id: 'data-input',        label: 'Saisie des données',   group: 'Analyse Financière', actions: [
    { id: 'save_draft', label: 'Enregistrer brouillon' }
  ], sections: [
    { id: 'balance-sheet', label: 'Bilan' }, { id: 'income-statement', label: 'Compte de résultat' }
  ] },
  { id: 'analysis',          label: 'Analyse Financière',   group: 'Analyse Financière', actions: [
    { id: 'export', label: 'Exporter' }
  ], sections: [
    { id: 'ratios', label: 'Ratios' }, { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'bceao', label: 'Normes BCEAO' }
  ] },
  { id: 'reports',           label: 'Rapports',             group: 'Analyse Financière', actions: [
    { id: 'export', label: 'Exporter' }, { id: 'print', label: 'Imprimer' }
  ], sections: [] },

  // Configuration
  { id: 'credit-policy',     label: 'Politique de Crédit',  group: 'Configuration', actions: [
    { id: 'edit_policy', label: 'Modifier' }, { id: 'activate', label: 'Activer' },
    { id: 'archive', label: 'Archiver' }
  ], sections: [] },
  { id: 'credit-types',      label: 'Types de Crédit',      group: 'Configuration', actions: [
    { id: 'create', label: 'Créer' }, { id: 'edit', label: 'Éditer' }, { id: 'delete', label: 'Supprimer' }
  ], sections: [] },
  { id: 'approval-limits',   label: 'Limites d\'Approbation', group: 'Configuration', actions: [
    { id: 'edit', label: 'Modifier' }
  ], sections: [] },
  { id: 'contract-templates',label: 'Modèles de Contrats',  group: 'Configuration', actions: [
    { id: 'upload', label: 'Importer' }, { id: 'edit', label: 'Éditer' }, { id: 'delete', label: 'Supprimer' }
  ], sections: [] },
  { id: 'legal-step',        label: 'Étape Juridique',      group: 'Configuration', actions: [
    { id: 'validate', label: 'Valider' }, { id: 'reject', label: 'Rejeter' }
  ], sections: [] },
  { id: 'raci-matrix',       label: 'Matrice RACI',         group: 'Configuration', actions: [
    { id: 'edit', label: 'Modifier' }, { id: 'import', label: 'Importer' }
  ], sections: [] },

  // Administration
  { id: 'user-management',   label: 'Gestion des Utilisateurs', group: 'Administration', actions: [
    { id: 'create_user', label: 'Créer un utilisateur' }, { id: 'edit_user', label: 'Modifier' },
    { id: 'reset_password', label: 'Réinitialiser mot de passe' }, { id: 'deactivate', label: 'Désactiver' }
  ], sections: [
    { id: 'users', label: 'Utilisateurs' }, { id: 'roles', label: 'Rôles' },
    { id: 'module-profiles', label: 'Profils de modules' }
  ] },
  { id: 'bank-holidays-admin', label: 'Jours Fériés',      group: 'Administration', actions: [
    { id: 'create', label: 'Créer' }, { id: 'edit', label: 'Éditer' }, { id: 'delete', label: 'Supprimer' }
  ], sections: [] },
  { id: 'notifications-config', label: 'Notifications',    group: 'Administration', actions: [
    { id: 'edit', label: 'Modifier' }
  ], sections: [] },
  { id: 'announcements',     label: "Notes d'information", group: 'Administration', actions: [
    { id: 'create', label: 'Créer' }, { id: 'edit', label: 'Éditer' }, { id: 'delete', label: 'Supprimer' }
  ], sections: [] },
  { id: 'backup',            label: 'Sauvegarde',           group: 'Administration', superAdminOnly: true, actions: [], sections: [] },
  { id: 'platform-admin',    label: 'Admin Plateforme',     group: 'Administration', superAdminOnly: true, actions: [], sections: [] },
];

export const TENANT_MODULES = MODULE_REGISTRY.filter(m => !m.superAdminOnly);

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.id === id);
}

export function getModulesByGroup(): Record<ModuleGroup, ModuleDefinition[]> {
  return TENANT_MODULES.reduce((acc, mod) => {
    if (!acc[mod.group]) acc[mod.group] = [];
    acc[mod.group].push(mod);
    return acc;
  }, {} as Record<ModuleGroup, ModuleDefinition[]>);
}
```

- [ ] **Étape 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/config/moduleRegistry.ts
git commit -m "feat(module-profiles): registre statique de tous les modules"
```

---

## Task 8 : Frontend — ApiService (méthodes module-profiles)

**Fichiers :**
- Modifier : `src/services/api.ts`

- [ ] **Étape 1 : Ajouter les interfaces et méthodes dans ApiService**

Trouver la fin de la classe `ApiService` dans `src/services/api.ts` (avant le `}` fermant). Ajouter :

```typescript
  // ── Module Profiles ────────────────────────────────────────────────────────

  static async getMyModuleProfile(): Promise<ApiResponse<any>> {
    const response = await api.get('/module-profiles/me');
    return response.data;
  }

  static async getModuleProfiles(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/module-profiles');
    return response.data;
  }

  static async getModuleProfile(role: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/module-profiles/${role}`);
    return response.data;
  }

  static async updateModuleProfile(role: string, data: {
    modules: Record<string, any>;
    defaultScope: string;
    allowedBranches: string[];
    label?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.put(`/module-profiles/${role}`, data);
    return response.data;
  }

  static async resetModuleProfile(role: string): Promise<ApiResponse<any>> {
    const response = await api.post(`/module-profiles/reset/${role}`);
    return response.data;
  }

  static async getUserModuleOverride(userId: string): Promise<ApiResponse<any>> {
    const response = await api.get(`/module-profiles/users/${userId}`);
    return response.data;
  }

  static async updateUserModuleOverride(userId: string, data: {
    modules?: Record<string, any> | null;
    dataScope?: string | null;
    allowedBranches?: string[];
  }): Promise<ApiResponse<any>> {
    const response = await api.put(`/module-profiles/users/${userId}`, data);
    return response.data;
  }

  static async deleteUserModuleOverride(userId: string): Promise<ApiResponse<void>> {
    const response = await api.delete(`/module-profiles/users/${userId}`);
    return response.data;
  }

  // ── Scope Delegates ────────────────────────────────────────────────────────

  static async getScopeDelegates(): Promise<ApiResponse<any[]>> {
    const response = await api.get('/scope-delegates');
    return response.data;
  }

  static async createScopeDelegate(data: {
    delegateId: string;
    scope: string;
    allowedBranches?: string[];
    allowedActions?: string[];
    startDate: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    const response = await api.post('/scope-delegates', data);
    return response.data;
  }

  static async updateScopeDelegate(id: string, data: Partial<{
    scope: string;
    allowedBranches: string[];
    allowedActions: string[];
    startDate: string;
    endDate: string | null;
  }>): Promise<ApiResponse<any>> {
    const response = await api.put(`/scope-delegates/${id}`, data);
    return response.data;
  }

  static async revokeScopeDelegate(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete(`/scope-delegates/${id}`);
    return response.data;
  }
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/services/api.ts
git commit -m "feat(module-profiles): ajouter méthodes ApiService pour les profils et délégations"
```

---

## Task 9 : Frontend — ModuleProfileContext + useModuleAccess

**Fichiers :**
- Créer : `src/contexts/ModuleProfileContext.tsx`
- Créer : `src/hooks/useModuleAccess.ts`

- [ ] **Étape 1 : Créer ModuleProfileContext.tsx**

```typescript
// src/contexts/ModuleProfileContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from '../services/api';
import { useUser } from './UserContext';

export interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export interface ModuleProfile {
  role: string;
  label: string;
  modules: Record<string, ModuleAccess>;
  dataScope: 'branch_only' | 'multi_branch' | 'all_branches';
  allowedBranches: string[];
  delegationActive: boolean;
  delegationActions: string[];
}

interface ModuleProfileContextValue {
  profile: ModuleProfile | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

const ModuleProfileContext = createContext<ModuleProfileContextValue>({
  profile: null,
  isLoading: true,
  reload: async () => {},
});

export const ModuleProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ModuleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { state: userState } = useUser();

  const load = async () => {
    if (!userState.isAuthenticated || !userState.currentUser) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await ApiService.getMyModuleProfile();
      if (res.success) setProfile(res.data);
    } catch {
      // fail-open : profile reste null, canAccess() retournera true
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [userState.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ModuleProfileContext.Provider value={{ profile, isLoading, reload: load }}>
      {children}
    </ModuleProfileContext.Provider>
  );
};

export const useModuleProfile = () => useContext(ModuleProfileContext);
```

- [ ] **Étape 2 : Créer useModuleAccess.ts**

```typescript
// src/hooks/useModuleAccess.ts
import { useModuleProfile } from '../contexts/ModuleProfileContext';

export function useModuleAccess() {
  const { profile, isLoading } = useModuleProfile();

  // fail-open : si le profil n'est pas encore chargé, on laisse passer
  // La sécurité réelle est assurée côté backend (scopeFilter + permissions métier)
  const canAccess = (moduleId: string): boolean => {
    if (!profile) return true;
    return profile.modules[moduleId]?.visible ?? true;
  };

  const canAction = (moduleId: string, actionId: string): boolean => {
    if (!profile) return true;
    const mod = profile.modules[moduleId];
    if (!mod?.visible) return false;
    return mod.actions.includes(actionId);
  };

  const canSeeSection = (moduleId: string, sectionId: string): boolean => {
    if (!profile) return true;
    const mod = profile.modules[moduleId];
    if (!mod?.visible) return false;
    if (mod.sections.length === 0) return true;
    return mod.sections.includes(sectionId);
  };

  return {
    canAccess,
    canAction,
    canSeeSection,
    dataScope: profile?.dataScope ?? 'branch_only',
    allowedBranches: profile?.allowedBranches ?? [],
    delegationActive: profile?.delegationActive ?? false,
    delegationActions: profile?.delegationActions ?? [],
    isLoading,
  };
}
```

- [ ] **Étape 3 : Envelopper App.tsx avec ModuleProfileProvider**

Ouvrir `src/App.tsx`. Importer le provider et l'ajouter autour du contenu principal (après `UserProvider` et `CompanyProvider`). Chercher le JSX racine et ajouter :

```typescript
import { ModuleProfileProvider } from './contexts/ModuleProfileContext';

// Dans le JSX, envelopper le contenu avec :
<ModuleProfileProvider>
  {/* contenu existant */}
</ModuleProfileProvider>
```

- [ ] **Étape 4 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 5 : Commit**

```bash
git add src/contexts/ModuleProfileContext.tsx src/hooks/useModuleAccess.ts src/App.tsx
git commit -m "feat(module-profiles): contexte ModuleProfile + hook useModuleAccess"
```

---

## Task 10 : Frontend — Intégration canAccess() dans Sidebar

**Fichiers :**
- Modifier : `src/components/Sidebar.tsx`

- [ ] **Étape 1 : Importer le hook**

En haut de `src/components/Sidebar.tsx`, ajouter l'import :

```typescript
import { useModuleAccess } from '../hooks/useModuleAccess';
```

- [ ] **Étape 2 : Appeler le hook dans le composant**

Dans le corps du composant `Sidebar`, après la ligne `const { isRole, hasPermission, state: userState } = useUser();`, ajouter :

```typescript
const { canAccess } = useModuleAccess();
```

- [ ] **Étape 3 : Ajouter canAccess() sur chaque item des sections**

Pour la section `creditProcessItems`, modifier chaque entrée conditionnelle pour ajouter `&& canAccess('...')` :

```typescript
const creditProcessItems = [
  ...(canViewClients      && canAccess('clients')           ? [{ id: 'clients'            as PageType, label: t('navigation.clients'),     icon: ClientsIcon     }] : []),
  ...(canCreateApplication && canAccess('credit-application') ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande',          icon: ApplicationIcon }] : []),
  ...(canDispatching      && canAccess('dispatching')        ? [{ id: 'dispatching'          as PageType, label: 'Dispatching',              icon: DispatchIcon    }] : []),
  ...(canViewApplications  && canAccess('approvals')          ? [{ id: 'approvals'            as PageType, label: 'Approbations',             icon: ApprovalMenuIcon, badgeCount: pendingApprovalsCount }] : []),
  ...(canViewApplications  && canAccess('workflow')           ? [{ id: 'workflow'             as PageType, label: t('navigation.workflow'),   icon: WorkflowIcon    }] : []),
  ...(canViewAnalytics    && canAccess('analytics')           ? [{ id: 'analytics'            as PageType, label: t('navigation.analytics'), icon: InsightsIcon    }] : []),
];

const outOfProcessItems = canFinancialAnalysis ? [
  ...(canAccess('data-input') ? [{ id: 'data-input' as PageType, label: t('navigation.dataInput'), icon: DataInputIcon }] : []),
  ...(canAccess('analysis')   ? [{ id: 'analysis'   as PageType, label: t('navigation.analysis'),  icon: AnalysisIcon, requiresData: true }] : []),
  ...(canViewReports && canAccess('reports') ? [{ id: 'reports' as PageType, label: t('navigation.reports'), icon: ReportsIcon, requiresData: true }] : []),
] : [];

const configItems = canViewConfiguration ? [
  ...(canAccess('user-management')       ? [{ id: 'user-management'      as PageType, label: t('navigation.userManagement'), icon: UserManagementIcon }] : []),
  ...(canAccess('bank-holidays-admin')   ? [{ id: 'bank-holidays-admin'  as PageType, label: 'Jours Fériés',                icon: HolidayIcon }] : []),
  ...(canAccess('backup')                ? [{ id: 'backup'               as PageType, label: 'Sauvegarde',                  icon: BackupIcon }] : []),
  ...(canAccess('announcements')         ? [{ id: 'announcements'        as PageType, label: "Notes d'information",         icon: CampaignIcon }] : []),
  ...(canAccess('notifications-config')  ? [{ id: 'notifications-config' as PageType, label: 'Notifications',               icon: NotificationsActiveIcon }] : []),
  ...(canViewPlatformAdmin && canAccess('platform-admin') ? [{ id: 'platform-admin' as PageType, label: 'Admin Plateforme', icon: PolicyIcon }] : []),
] : [];
```

- [ ] **Étape 4 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 5 : Tester visuellement**

Démarrer le frontend (`npm start`) et vérifier :
- Les menus se chargent normalement (fail-open si le profil n'est pas encore chargé)
- Aucune régression visuelle dans la sidebar

- [ ] **Étape 6 : Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(module-profiles): intégrer canAccess() dans la sidebar (non-breaking)"
```

---

## Task 11 : Frontend — RoleProfileEditor

**Fichiers :**
- Créer : `src/components/module-profiles/RoleProfileEditor.tsx`

- [ ] **Étape 1 : Créer le composant**

```typescript
// src/components/module-profiles/RoleProfileEditor.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, FormControlLabel, Switch, Checkbox,
  FormGroup, Chip, Button, CircularProgress, Alert,
  RadioGroup, Radio, FormControl, FormLabel, Autocomplete, TextField,
  Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ApiService } from '../../services/api';
import { TENANT_MODULES, getModulesByGroup, ModuleDefinition } from '../../config/moduleRegistry';
import { USER_ROLE_LABELS } from '../../types';

interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

interface RoleProfileEditorProps {
  role: string;
  branches: string[];
  onSaved?: () => void;
}

const SCOPE_OPTIONS = [
  { value: 'BRANCH_ONLY',  label: 'Agence uniquement' },
  { value: 'MULTI_BRANCH', label: 'Multi-agences' },
  { value: 'ALL_BRANCHES', label: 'Tout le réseau' },
];

export const RoleProfileEditor: React.FC<RoleProfileEditorProps> = ({ role, branches, onSaved }) => {
  const [modules, setModules] = useState<Record<string, ModuleAccess>>({});
  const [scope, setScope] = useState('BRANCH_ONLY');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ApiService.getModuleProfile(role);
        if (res.success && res.data) {
          setModules(res.data.modules as Record<string, ModuleAccess>);
          setScope(res.data.defaultScope);
          setSelectedBranches(res.data.allowedBranches ?? []);
          setLabel(res.data.label);
        } else {
          // Initialiser avec tous modules visibles par défaut
          const init: Record<string, ModuleAccess> = {};
          TENANT_MODULES.forEach(m => { init[m.id] = { visible: true, actions: [], sections: [] }; });
          setModules(init);
        }
      } catch {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role]);

  const toggleModule = (moduleId: string, visible: boolean) => {
    setModules(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], visible, actions: visible ? prev[moduleId]?.actions ?? [] : [], sections: visible ? prev[moduleId]?.sections ?? [] : [] }
    }));
  };

  const toggleAction = (moduleId: string, actionId: string, checked: boolean) => {
    setModules(prev => {
      const current = prev[moduleId]?.actions ?? [];
      return {
        ...prev,
        [moduleId]: {
          ...prev[moduleId],
          actions: checked ? [...current, actionId] : current.filter(a => a !== actionId)
        }
      };
    });
  };

  const toggleSection = (moduleId: string, sectionId: string, checked: boolean) => {
    setModules(prev => {
      const current = prev[moduleId]?.sections ?? [];
      return {
        ...prev,
        [moduleId]: {
          ...prev[moduleId],
          sections: checked ? [...current, sectionId] : current.filter(s => s !== sectionId)
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await ApiService.updateModuleProfile(role, { modules, defaultScope: scope, allowedBranches: selectedBranches, label });
      setSuccess(true);
      onSaved?.();
    } catch {
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await ApiService.resetModuleProfile(role);
      if (res.success && res.data) {
        setModules(res.data.modules);
        setScope(res.data.defaultScope);
        setSelectedBranches(res.data.allowedBranches ?? []);
        setSuccess(true);
      }
    } catch {
      setError('Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  const grouped = getModulesByGroup();

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>Profil enregistré avec succès</Alert>}

      {/* Sections par groupe */}
      {(Object.entries(grouped) as [string, ModuleDefinition[]][]).map(([group, mods]) => (
        <Accordion key={group} defaultExpanded sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>{group}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {mods.map(mod => {
              const access = modules[mod.id] ?? { visible: false, actions: [], sections: [] };
              return (
                <Box key={mod.id} sx={{ mb: 2, pl: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch checked={access.visible} onChange={e => toggleModule(mod.id, e.target.checked)}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0F766E' } }} />
                    }
                    label={<Typography fontWeight={500}>{mod.label}</Typography>}
                  />
                  {access.visible && mod.actions.length > 0 && (
                    <Box sx={{ pl: 4, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Actions :</Typography>
                      <FormGroup row>
                        {mod.actions.map(action => (
                          <FormControlLabel key={action.id}
                            control={
                              <Checkbox size="small" checked={access.actions.includes(action.id)}
                                onChange={e => toggleAction(mod.id, action.id, e.target.checked)}
                                sx={{ color: '#0F766E', '&.Mui-checked': { color: '#0F766E' } }} />
                            }
                            label={<Typography variant="body2">{action.label}</Typography>}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  )}
                  {access.visible && mod.sections.length > 0 && (
                    <Box sx={{ pl: 4, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Sections visibles :</Typography>
                      <FormGroup row>
                        {mod.sections.map(section => (
                          <FormControlLabel key={section.id}
                            control={
                              <Checkbox size="small" checked={access.sections.length === 0 || access.sections.includes(section.id)}
                                onChange={e => toggleSection(mod.id, section.id, e.target.checked)}
                                sx={{ color: '#0F766E', '&.Mui-checked': { color: '#0F766E' } }} />
                            }
                            label={<Typography variant="body2">{section.label}</Typography>}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  )}
                  <Divider sx={{ mt: 1 }} />
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Périmètre de données */}
      <Box sx={{ border: '1px solid #E2E8F0', borderRadius: 2, p: 2, mt: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Périmètre de données</Typography>
        <FormControl>
          <RadioGroup value={scope} onChange={e => setScope(e.target.value)}>
            {SCOPE_OPTIONS.map(opt => (
              <FormControlLabel key={opt.value} value={opt.value} control={<Radio sx={{ color: '#0F766E', '&.Mui-checked': { color: '#0F766E' } }} />} label={opt.label} />
            ))}
          </RadioGroup>
        </FormControl>
        {scope === 'MULTI_BRANCH' && (
          <Autocomplete
            multiple
            options={branches}
            value={selectedBranches}
            onChange={(_, val) => setSelectedBranches(val)}
            renderTags={(val, getTagProps) =>
              val.map((opt, idx) => <Chip label={opt} size="small" {...getTagProps({ index: idx })} key={opt} />)
            }
            renderInput={params => <TextField {...params} label="Agences autorisées" size="small" sx={{ mt: 1 }} />}
          />
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={handleReset} disabled={saving} sx={{ color: '#64748B', borderColor: '#CBD5E1' }}>
          Réinitialiser les défauts
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Enregistrer'}
        </Button>
      </Box>
    </Box>
  );
};
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/module-profiles/RoleProfileEditor.tsx
git commit -m "feat(module-profiles): éditeur visuel de profil par rôle"
```

---

## Task 12 : Frontend — UserScopeEditor

**Fichiers :**
- Créer : `src/components/module-profiles/UserScopeEditor.tsx`

- [ ] **Étape 1 : Créer le composant**

```typescript
// src/components/module-profiles/UserScopeEditor.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert, Chip,
  RadioGroup, Radio, FormControlLabel, Autocomplete, TextField,
  Switch, FormGroup, Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ApiService } from '../../services/api';
import { TENANT_MODULES, getModulesByGroup, ModuleDefinition } from '../../config/moduleRegistry';

interface ModuleAccess { visible: boolean; actions: string[]; sections: string[]; }

interface UserScopeEditorProps {
  userId: string;
  userName: string;
  branches: string[];
  onSaved?: () => void;
}

const SCOPE_OPTIONS = [
  { value: 'BRANCH_ONLY',  label: 'Agence uniquement (défaut du rôle)' },
  { value: 'MULTI_BRANCH', label: 'Multi-agences' },
  { value: 'ALL_BRANCHES', label: 'Tout le réseau' },
];

export const UserScopeEditor: React.FC<UserScopeEditorProps> = ({ userId, userName, branches, onSaved }) => {
  const [mergedProfile, setMergedProfile] = useState<any>(null);
  const [overrideModules, setOverrideModules] = useState<Record<string, ModuleAccess> | null>(null);
  const [overrideScope, setOverrideScope] = useState<string | null>(null);
  const [overrideBranches, setOverrideBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await ApiService.getUserModuleOverride(userId);
        if (res.success) {
          setMergedProfile(res.data.mergedProfile);
          const ov = res.data.override;
          if (ov) {
            setOverrideModules(ov.modules ?? null);
            setOverrideScope(ov.dataScope ?? null);
            setOverrideBranches(ov.allowedBranches ?? []);
          }
        }
      } catch { setError('Erreur de chargement'); }
      finally { setLoading(false); }
    };
    load();
  }, [userId]);

  const toggleModule = (moduleId: string, visible: boolean) => {
    setOverrideModules(prev => ({
      ...(prev ?? {}),
      [moduleId]: { visible, actions: [], sections: [] }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await ApiService.updateUserModuleOverride(userId, {
        modules: overrideModules,
        dataScope: overrideScope,
        allowedBranches: overrideBranches,
      });
      setSuccess(true);
      onSaved?.();
    } catch { setError('Erreur lors de l\'enregistrement'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await ApiService.deleteUserModuleOverride(userId);
      setOverrideModules(null);
      setOverrideScope(null);
      setOverrideBranches([]);
      setSuccess(true);
    } catch { setError('Erreur lors de la réinitialisation'); }
    finally { setSaving(false); }
  };

  const grouped = getModulesByGroup();
  const hasOverride = overrideModules !== null || overrideScope !== null;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">{userName}</Typography>
        {hasOverride && <Chip label="Personnalisé" size="small" color="warning" />}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>Sauvegardé</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Seuls les modules différents du profil de rôle sont affichés ici. Laissez vide pour hériter du rôle.
      </Typography>

      {/* Override de scope */}
      <Box sx={{ border: '1px solid #E2E8F0', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Périmètre de données (override)</Typography>
        <RadioGroup value={overrideScope ?? ''} onChange={e => setOverrideScope(e.target.value || null)}>
          <FormControlLabel value="" control={<Radio />} label="Hériter du rôle" />
          {SCOPE_OPTIONS.map(opt => (
            <FormControlLabel key={opt.value} value={opt.value} control={<Radio sx={{ color: '#0F766E', '&.Mui-checked': { color: '#0F766E' } }} />} label={opt.label} />
          ))}
        </RadioGroup>
        {overrideScope === 'MULTI_BRANCH' && (
          <Autocomplete
            multiple options={branches} value={overrideBranches}
            onChange={(_, val) => setOverrideBranches(val)}
            renderTags={(val, getTagProps) =>
              val.map((opt, idx) => <Chip label={opt} size="small" {...getTagProps({ index: idx })} key={opt} />)
            }
            renderInput={params => <TextField {...params} label="Agences autorisées" size="small" sx={{ mt: 1 }} />}
          />
        )}
      </Box>

      {/* Override de modules (delta) */}
      {(Object.entries(grouped) as [string, ModuleDefinition[]][]).map(([group, mods]) => (
        <Accordion key={group} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={500}>{group}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {mods.map(mod => {
              const baseVisible = mergedProfile?.modules?.[mod.id]?.visible ?? true;
              const overrideVal = overrideModules?.[mod.id];
              const effectiveVisible = overrideVal !== undefined ? overrideVal.visible : baseVisible;
              const isCustomized = overrideVal !== undefined && overrideVal.visible !== baseVisible;

              return (
                <Box key={mod.id} sx={{ mb: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch checked={effectiveVisible}
                        onChange={e => toggleModule(mod.id, e.target.checked)}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#0F766E' } }} />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">{mod.label}</Typography>
                        {isCustomized && <Chip label="modifié" size="small" color="warning" sx={{ height: 16, fontSize: 10 }} />}
                      </Box>
                    }
                  />
                  <Divider />
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
        {hasOverride && (
          <Button variant="outlined" onClick={handleReset} disabled={saving}
            sx={{ color: '#EF4444', borderColor: '#FCA5A5' }}>
            Réinitialiser au profil du rôle
          </Button>
        )}
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Enregistrer'}
        </Button>
      </Box>
    </Box>
  );
};
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/module-profiles/UserScopeEditor.tsx
git commit -m "feat(module-profiles): éditeur d'override de modules et scope par utilisateur"
```

---

## Task 13 : Frontend — ScopeDelegateManager

**Fichiers :**
- Créer : `src/components/module-profiles/ScopeDelegateManager.tsx`

- [ ] **Étape 1 : Créer le composant**

```typescript
// src/components/module-profiles/ScopeDelegateManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Autocomplete,
  CircularProgress, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { ApiService } from '../../services/api';

interface ScopeDelegateManagerProps {
  users: { id: string; name: string; role: string }[];
  branches: string[];
}

const SCOPE_OPTIONS = [
  { value: 'BRANCH_ONLY',  label: 'Agence uniquement' },
  { value: 'MULTI_BRANCH', label: 'Multi-agences' },
  { value: 'ALL_BRANCHES', label: 'Tout le réseau' },
];

const SCOPE_COLOR: Record<string, 'default' | 'warning' | 'error'> = {
  BRANCH_ONLY: 'default', MULTI_BRANCH: 'warning', ALL_BRANCHES: 'error'
};

export const ScopeDelegateManager: React.FC<ScopeDelegateManagerProps> = ({ users, branches }) => {
  const [delegates, setDelegates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    delegateId: '', scope: 'MULTI_BRANCH', allowedBranches: [] as string[],
    allowedActions: ['APPROVE_WORKFLOW', 'REJECT_WORKFLOW'],
    startDate: new Date().toISOString().split('T')[0], endDate: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getScopeDelegates();
      if (res.success) setDelegates(res.data ?? []);
    } catch { setError('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await ApiService.createScopeDelegate({
        delegateId: form.delegateId,
        scope: form.scope,
        allowedBranches: form.allowedBranches,
        allowedActions: form.allowedActions,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
      });
      setDialogOpen(false);
      load();
    } catch { setError('Erreur lors de la création'); }
  };

  const handleRevoke = async (id: string) => {
    try {
      await ApiService.revokeScopeDelegate(id);
      load();
    } catch { setError('Erreur lors de la révocation'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Délégations de périmètre actives</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
          sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
          Nouvelle délégation
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Délégant</TableCell>
            <TableCell>Bénéficiaire</TableCell>
            <TableCell>Périmètre</TableCell>
            <TableCell>Actions autorisées</TableCell>
            <TableCell>Du</TableCell>
            <TableCell>Au</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {delegates.length === 0 && (
            <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary">Aucune délégation active</Typography></TableCell></TableRow>
          )}
          {delegates.map(d => (
            <TableRow key={d.id}>
              <TableCell>{d.delegator?.name}</TableCell>
              <TableCell>{d.delegate?.name}</TableCell>
              <TableCell>
                <Chip label={SCOPE_OPTIONS.find(s => s.value === d.scope)?.label ?? d.scope}
                  size="small" color={SCOPE_COLOR[d.scope] ?? 'default'} />
                {d.allowedBranches?.length > 0 && (
                  <Typography variant="caption" display="block">{d.allowedBranches.join(', ')}</Typography>
                )}
              </TableCell>
              <TableCell>
                {(d.allowedActions ?? []).map((a: string) => (
                  <Chip key={a} label={a.replace('_WORKFLOW', '')} size="small" sx={{ mr: 0.5 }} />
                ))}
              </TableCell>
              <TableCell>{new Date(d.startDate).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell>{d.endDate ? new Date(d.endDate).toLocaleDateString('fr-FR') : '—'}</TableCell>
              <TableCell>
                <IconButton size="small" color="error" onClick={() => handleRevoke(d.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog création */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle délégation de périmètre</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Bénéficiaire</InputLabel>
            <Select value={form.delegateId} label="Bénéficiaire" onChange={e => setForm(f => ({ ...f, delegateId: e.target.value }))}>
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Périmètre délégué</InputLabel>
            <Select value={form.scope} label="Périmètre délégué" onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
              {SCOPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          {form.scope === 'MULTI_BRANCH' && (
            <Autocomplete multiple options={branches} value={form.allowedBranches}
              onChange={(_, val) => setForm(f => ({ ...f, allowedBranches: val }))}
              renderInput={params => <TextField {...params} label="Agences" size="small" />}
            />
          )}
          <TextField type="date" label="Date de début" value={form.startDate} size="small"
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="Date de fin (optionnel)" value={form.endDate} size="small"
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.delegateId}
            sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#0D6560' } }}>
            Créer la délégation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/module-profiles/ScopeDelegateManager.tsx
git commit -m "feat(module-profiles): gestionnaire de délégations de périmètre"
```

---

## Task 14 : Frontend — ModuleProfileTab (orchestrateur)

**Fichiers :**
- Créer : `src/components/module-profiles/ModuleProfileTab.tsx`

- [ ] **Étape 1 : Créer le composant**

```typescript
// src/components/module-profiles/ModuleProfileTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, Tabs, Tab, FormControl, InputLabel, Select, MenuItem,
  Typography, CircularProgress
} from '@mui/material';
import { RoleProfileEditor } from './RoleProfileEditor';
import { UserScopeEditor } from './UserScopeEditor';
import { ScopeDelegateManager } from './ScopeDelegateManager';
import { ApiService } from '../../services/api';
import { USER_ROLE_LABELS } from '../../types';

const ROLES = Object.keys(USER_ROLE_LABELS).filter(r => r !== 'super_admin');

interface ModuleProfileTabProps {
  users: { id: string; name: string; role: string }[];
}

export const ModuleProfileTab: React.FC<ModuleProfileTabProps> = ({ users }) => {
  const [subTab, setSubTab] = useState(0);
  const [selectedRole, setSelectedRole] = useState(ROLES[0] ?? '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ApiService.getBranches();
        if (res.success) setBranches((res.data ?? []).map((b: any) => b.name));
      } catch {}
      finally { setLoadingBranches(false); }
    };
    load();
  }, []);

  const selectedUser = users.find(u => u.id === selectedUserId);

  if (loadingBranches) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E2E8F0' }}>
        <Tab label="Par rôle" />
        <Tab label="Par utilisateur" />
        <Tab label="Délégations de périmètre" />
      </Tabs>

      {/* Onglet Par rôle */}
      {subTab === 0 && (
        <Box>
          <FormControl size="small" sx={{ minWidth: 260, mb: 3 }}>
            <InputLabel>Sélectionner un rôle</InputLabel>
            <Select value={selectedRole} label="Sélectionner un rôle" onChange={e => setSelectedRole(e.target.value)}>
              {ROLES.map(r => (
                <MenuItem key={r} value={r}>{USER_ROLE_LABELS[r as keyof typeof USER_ROLE_LABELS] ?? r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedRole && (
            <RoleProfileEditor key={selectedRole} role={selectedRole.toUpperCase()} branches={branches} />
          )}
        </Box>
      )}

      {/* Onglet Par utilisateur */}
      {subTab === 1 && (
        <Box>
          <FormControl size="small" sx={{ minWidth: 300, mb: 3 }}>
            <InputLabel>Sélectionner un utilisateur</InputLabel>
            <Select value={selectedUserId} label="Sélectionner un utilisateur" onChange={e => setSelectedUserId(e.target.value)}>
              {users.map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name} — {u.role}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedUserId && selectedUser && (
            <UserScopeEditor key={selectedUserId} userId={selectedUserId} userName={selectedUser.name} branches={branches} />
          )}
          {!selectedUserId && (
            <Typography color="text.secondary">Sélectionnez un utilisateur pour configurer son profil individuel.</Typography>
          )}
        </Box>
      )}

      {/* Onglet Délégations */}
      {subTab === 2 && (
        <ScopeDelegateManager users={users} branches={branches} />
      )}
    </Box>
  );
};
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/module-profiles/ModuleProfileTab.tsx
git commit -m "feat(module-profiles): onglet orchestrateur avec sous-tabs rôle/utilisateur/délégations"
```

---

## Task 15 : Frontend — Ajouter l'onglet dans UserManagementPage

**Fichiers :**
- Modifier : `src/pages/UserManagementPage.tsx`

- [ ] **Étape 1 : Importer le composant**

En haut de `UserManagementPage.tsx`, ajouter :

```typescript
import { ModuleProfileTab } from '../components/module-profiles/ModuleProfileTab';
import AppsIcon from '@mui/icons-material/Apps';
```

- [ ] **Étape 2 : Ajouter l'onglet dans le composant `<Tabs>`**

Trouver le bloc `<Tabs>` (autour de la ligne 1575). Après l'onglet `Délégations` et avant la fermeture conditionnelle du "Journal d'activité", ajouter :

```tsx
<Tab
  label="Profils de modules"
  icon={<AppsIcon />}
  iconPosition="start"
/>
```

- [ ] **Étape 3 : Ajouter le contenu de l'onglet**

Dans le bloc `<CardContent>`, après le contenu de l'onglet Délégations (activeTab === 5), ajouter :

```tsx
{/* Module Profiles Tab */}
{activeTab === 6 && canEditUserManagement && (
  <ModuleProfileTab users={users.map(u => ({ id: u.id, name: u.name, role: u.role }))} />
)}
```

- [ ] **Étape 4 : Décaler l'index du Journal d'activité**

L'onglet "Journal d'activité" était à `activeTab === 6`. Il passe maintenant à `activeTab === 7`. Mettre à jour les 2 occurrences :

```typescript
// Ligne ~639 — condition de fetch
if (activeTab === 7 && canEditUserManagement) {
// Ligne ~648
if (activeTab === 7) fetchAuditLogs(...)
// Ligne ~2420
{activeTab === 7 && canEditUserManagement && (
```

- [ ] **Étape 5 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

- [ ] **Étape 6 : Test visuel complet**

Démarrer le frontend et naviguer vers Gestion des Utilisateurs :
- Vérifier que l'onglet "Profils de modules" apparaît
- Vérifier que le sélecteur de rôle charge un profil
- Vérifier que les toggles fonctionnent et que Save envoie la requête
- Vérifier que le Journal d'activité fonctionne toujours (index 7)

- [ ] **Étape 7 : Commit**

```bash
git add src/pages/UserManagementPage.tsx
git commit -m "feat(module-profiles): ajouter onglet Profils de modules dans UserManagement"
```

---

## Task 16 : Seed des profils pour les tenants existants

Le seed est réalisé via l'endpoint `POST /api/module-profiles/seed` (Task 4) pour éviter toute dépendance sur `dist/`. Il suffit d'appeler l'endpoint une fois par tenant après déploiement.

**Fichiers :**
- Créer : `backend/prisma/seed-module-profiles.sh`

- [ ] **Étape 1 : Créer un script shell d'appel**

```bash
#!/bin/bash
# backend/prisma/seed-module-profiles.sh
# Usage: ./seed-module-profiles.sh <API_URL> <ADMIN_TOKEN>
# Example: ./seed-module-profiles.sh https://api.bank.com eyJhbGci...

API_URL=${1:-http://localhost:5000}
TOKEN=$2

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <API_URL> <ADMIN_TOKEN>"
  exit 1
fi

echo "Seeding module profiles via $API_URL/api/module-profiles/seed ..."
curl -s -X POST "$API_URL/api/module-profiles/seed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

echo "Done."
```

- [ ] **Étape 2 : Rendre le script exécutable**

```bash
chmod +x backend/prisma/seed-module-profiles.sh
```

- [ ] **Étape 3 : Exécuter pour chaque tenant (exemple BCI)**

Se connecter en tant qu'ADMIN BCI, récupérer le token JWT, puis :

```bash
./backend/prisma/seed-module-profiles.sh http://localhost:5000 <TOKEN_ADMIN_BCI>
```

Résultat attendu : `{ "success": true, "message": "Profils par défaut créés pour le tenant" }`

- [ ] **Étape 4 : Commit**

```bash
git add backend/prisma/seed-module-profiles.sh
git commit -m "feat(module-profiles): script de seed des profils via API pour les tenants existants"
```

---

## Task 17 : Tests d'intégration middleware scopeFilter

**Fichiers :**
- Créer : `backend/src/__tests__/scopeFilter.test.ts`

- [ ] **Étape 1 : Écrire les tests (mock Prisma)**

```typescript
// backend/src/__tests__/scopeFilter.test.ts
// Mock prisma avant l'import du middleware
jest.mock('../server', () => ({
  prisma: {
    moduleProfile: {
      findUnique: jest.fn(),
    },
    userModuleOverride: {
      findUnique: jest.fn(),
    },
    scopeDelegate: {
      findFirst: jest.fn(),
    },
  }
}));

import { prisma } from '../server';
import { scopeFilter } from '../middleware/scopeFilter';
import { Request, Response, NextFunction } from 'express';

const mockReq = (overrides = {}): Partial<Request> => ({
  user: { id: 'user1', email: 'test@test.com', role: 'CHARGE_AFFAIRES', permissions: [], companyId: 'company1' },
  ...overrides,
});

const mockRes = (): Partial<Response> => ({});
const mockNext = (): NextFunction => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('scopeFilter middleware', () => {
  it('BRANCH_ONLY + pas de délégation → branchFilter avec la branche de l\'user', async () => {
    (prisma.moduleProfile.findUnique as jest.Mock).mockResolvedValue({ defaultScope: 'BRANCH_ONLY', allowedBranches: [] });
    (prisma.userModuleOverride.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.scopeDelegate.findFirst as jest.Mock).mockResolvedValue(null);

    const req = mockReq({ user: { id: 'u1', email: '', role: 'CHARGE_AFFAIRES', permissions: [], companyId: 'c1', branch: 'Abidjan' } }) as Request;
    const next = mockNext();

    await scopeFilter(req, mockRes() as Response, next);

    expect(req.branchFilter).toEqual({ branchId: { in: ['Abidjan'] } });
    expect(next).toHaveBeenCalled();
  });

  it('ALL_BRANCHES → branchFilter vide (aucun filtre)', async () => {
    (prisma.moduleProfile.findUnique as jest.Mock).mockResolvedValue({ defaultScope: 'ALL_BRANCHES', allowedBranches: [] });
    (prisma.userModuleOverride.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.scopeDelegate.findFirst as jest.Mock).mockResolvedValue(null);

    const req = mockReq() as Request;
    const next = mockNext();
    await scopeFilter(req, mockRes() as Response, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('délégation ALL_BRANCHES étend un scope BRANCH_ONLY', async () => {
    (prisma.moduleProfile.findUnique as jest.Mock).mockResolvedValue({ defaultScope: 'BRANCH_ONLY', allowedBranches: [] });
    (prisma.userModuleOverride.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.scopeDelegate.findFirst as jest.Mock).mockResolvedValue({
      scope: 'ALL_BRANCHES', allowedBranches: [], isActive: true
    });

    const req = mockReq() as Request;
    const next = mockNext();
    await scopeFilter(req, mockRes() as Response, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('Redis en erreur → fail-open (next appelé)', async () => {
    (prisma.moduleProfile.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));
    (prisma.userModuleOverride.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));
    (prisma.scopeDelegate.findFirst as jest.Mock).mockRejectedValue(new Error('DB down'));

    const req = mockReq() as Request;
    const next = mockNext();
    await scopeFilter(req, mockRes() as Response, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Étape 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd backend && npx jest scopeFilter --no-coverage
```

Résultat attendu : FAIL (middleware pas encore créé ou import échoue).

- [ ] **Étape 3 : Vérifier que les tests passent après Task 6**

```bash
cd backend && npx jest scopeFilter --no-coverage
```

Résultat attendu : PASS (4 tests).

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/__tests__/scopeFilter.test.ts
git commit -m "test(module-profiles): tests d'intégration middleware scopeFilter"
```

---

## Checklist de validation finale

- [ ] `npx tsc --noEmit` passe sans erreur (backend et frontend)
- [ ] `cd backend && npx jest --no-coverage` passe (tests `moduleProfileService`)
- [ ] `GET /api/module-profiles/me` retourne un profil valide pour un utilisateur connecté
- [ ] L'onglet "Profils de modules" est visible dans Gestion des Utilisateurs pour un ADMIN
- [ ] Modifier un profil de rôle → l'utilisateur du rôle concerné voit les changements après reconnexion
- [ ] La Sidebar ne régresse pas (menus existants toujours présents)
- [ ] Un utilisateur sans `ModuleProfile` reçoit un profil seeded automatiquement

```bash
git tag v1.0-module-profiles
```
