# Spec : Gestion dynamique des profils de modules et périmètres de données

**Date** : 2026-04-28
**Statut** : Approuvé
**Projet** : OptimusCredit — Gestion des droits, rôles et workspace

---

## 1. Contexte et objectif

OptimusCredit est un SaaS multi-tenant bancaire. Le système de permissions actuel repose sur des chaînes de permissions métier (`view_applications`, `create_application`, etc.) stockées dans `RolePermission` (JSON), avec une logique de visibilité des menus hard-codée dans `Sidebar.tsx`.

L'objectif est d'ajouter un système dynamique de **profils de modules** inspiré d'ERPNext, permettant à chaque administrateur tenant de configurer :

- **Quels écrans** sont accessibles par rôle
- **Quelles actions** sont disponibles dans chaque écran (boutons, fonctionnalités)
- **Quelles sections/onglets** sont visibles dans chaque page
- **Quel périmètre de données** chaque utilisateur peut voir (agence, multi-agences, réseau entier)
- **La délégation de périmètre** : un utilisateur maison mère peut déléguer temporairement des droits d'approbation sur un périmètre défini

---

## 2. Décisions de conception

| Question | Décision |
|----------|----------|
| Granularité | Rôle (base) + override par utilisateur |
| Périmètre | Menu + actions + sections/onglets |
| Multi-tenant | Par tenant, rôles types seedés par défaut |
| Emplacement UI | Onglet "Profils de modules" dans UserManagement |
| Coexistence avec l'existant | Couche additionnelle (les deux doivent passer) |
| Qui configure | ADMIN et SUPER_ADMIN uniquement |
| Scope de données | BRANCH_ONLY / MULTI_BRANCH / ALL_BRANCHES |

---

## 3. Architecture générale

```
MODULE_REGISTRY (TypeScript statique)
  Catalogue de tous les écrans, actions, sections disponibles
  Source unique de vérité des modules

        ↓

Backend (Prisma + REST)
  ModuleProfile       ← profil par rôle + companyId
  UserModuleOverride  ← override par userId + companyId
  ScopeDelegate       ← délégation temporaire de périmètre

        ↓  GET /api/module-profiles/me

Frontend — ModuleProfileContext
  Profil fusionné (rôle de base + override user + délégations actives)
  Hook useModuleAccess()
        ↓                    ↓
   Sidebar              Composants/pages
  (menus visibles)   (boutons, onglets, tabs)
```

### Flux au login

1. Authentification → `role` + `companyId` de l'utilisateur connus
2. `GET /api/module-profiles/me` → profil fusionné retourné
3. Chargement dans `ModuleProfileContext`
4. Sidebar et composants lisent via `useModuleAccess()`

### Double vérification (non-breaking)

Les deux conditions doivent être vraies pour afficher un élément :
- **Existante** : `hasPermission('view_applications')` — permission métier
- **Nouvelle** : `canAccess('approvals')` — visibilité module

---

## 4. Catalogue de modules (Module Registry)

Fichier : `src/config/moduleRegistry.ts`

### Types

```typescript
export interface ModuleAction {
  id: string;    // 'create' | 'edit' | 'delete' | 'export' | 'approve' | ...
  label: string;
}

export interface ModuleSection {
  id: string;    // 'pending' | 'history' | 'portfolio' | ...
  label: string;
}

export interface ModuleDefinition {
  id: PageType;
  label: string;
  icon: string;        // nom icône MUI
  group: ModuleGroup;  // groupe d'appartenance dans la sidebar
  actions: ModuleAction[];
  sections: ModuleSection[];
}

export type ModuleGroup =
  | 'Processus Crédit'
  | 'Analyse Financière'
  | 'Configuration'
  | 'Administration';
```

### Catalogue des modules principaux

| Module (PageType) | Groupe | Actions | Sections |
|-------------------|--------|---------|----------|
| `home` | Processus Crédit | — | — |
| `clients` | Processus Crédit | `create`, `edit`, `delete`, `export` | — |
| `credit-application` | Processus Crédit | `create`, `submit` | — |
| `dispatching` | Processus Crédit | `dispatch` | — |
| `approvals` | Processus Crédit | `approve`, `reject`, `comment`, `export` | `pending`, `history` |
| `workflow` | Processus Crédit | `edit_workflow` | — |
| `analytics` | Processus Crédit | `export` | `portfolio`, `performance`, `compliance` |
| `credit-scoring` | Processus Crédit | — | — |
| `credit-simulation` | Processus Crédit | — | — |
| `data-input` | Analyse Financière | `save_draft` | `balance-sheet`, `income-statement` |
| `analysis` | Analyse Financière | `export` | `ratios`, `benchmarks`, `bceao` |
| `reports` | Analyse Financière | `export`, `print` | — |
| `credit-policy` | Configuration | `edit_policy`, `activate`, `archive` | — |
| `credit-types` | Configuration | `create`, `edit`, `delete` | — |
| `approval-limits` | Configuration | `edit` | — |
| `contract-templates` | Configuration | `upload`, `edit`, `delete` | — |
| `legal-step` | Configuration | `validate`, `reject` | — |
| `raci-matrix` | Configuration | `edit`, `import` | — |
| `user-management` | Administration | `create_user`, `edit_user`, `reset_password`, `deactivate` | `users`, `roles`, `module-profiles` |
| `bank-holidays-admin` | Administration | `create`, `edit`, `delete` | — |
| `notifications-config` | Administration | `edit` | — |
| `announcements` | Administration | `create`, `edit`, `delete` | — |
| `backup` | Administration | `create_backup`, `restore` | — |
| `platform-admin` | Administration | — | — |

### Structure JSON d'un profil stocké

```json
{
  "modules": {
    "clients": {
      "visible": true,
      "actions": ["create", "edit"],
      "sections": []
    },
    "approvals": {
      "visible": true,
      "actions": ["approve", "reject", "comment"],
      "sections": ["pending", "history"]
    },
    "analytics": {
      "visible": false,
      "actions": [],
      "sections": []
    }
  }
}
```

---

## 5. Modèle de données (Prisma)

### Enum DataScope

```prisma
enum DataScope {
  BRANCH_ONLY    @map("branch_only")
  MULTI_BRANCH   @map("multi_branch")
  ALL_BRANCHES   @map("all_branches")
  @@map("data_scope")
}
```

### ModuleProfile

```prisma
model ModuleProfile {
  id            String    @id @default(cuid())
  companyId     String    @map("company_id")
  role          UserRole
  label         String
  modules       Json                        // ModuleAccess JSON
  defaultScope  DataScope @default(BRANCH_ONLY) @map("default_scope")
  isDefault     Boolean   @default(false) @map("is_default")
  createdById   String    @map("created_by_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  company       Company   @relation(fields: [companyId], references: [id])
  createdBy     User      @relation("ModuleProfileCreatedBy", fields: [createdById], references: [id])

  @@unique([companyId, role])
  @@index([companyId])
  @@map("module_profiles")
}
```

### UserModuleOverride

```prisma
model UserModuleOverride {
  id              String     @id @default(cuid())
  userId          String     @map("user_id")
  companyId       String     @map("company_id")
  modules         Json?                        // delta par rapport au profil rôle
  dataScope       DataScope? @map("data_scope")
  allowedBranches String[]   @default([]) @map("allowed_branches")
  createdById     String     @map("created_by_id")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  user            User       @relation(fields: [userId], references: [id])
  company         Company    @relation(fields: [companyId], references: [id])
  createdBy       User       @relation("OverrideCreatedBy", fields: [createdById], references: [id])

  @@unique([userId, companyId])
  @@map("user_module_overrides")
}
```

### ScopeDelegate

```prisma
model ScopeDelegate {
  id              String    @id @default(cuid())
  delegatorId     String    @map("delegator_id")   // utilisateur maison mère
  delegateId      String    @map("delegate_id")    // bénéficiaire
  companyId       String    @map("company_id")
  scope           DataScope
  allowedBranches String[]  @default([]) @map("allowed_branches")
  allowedActions  String[]  @default([]) @map("allowed_actions")  // ex: ["APPROVE_WORKFLOW","REJECT_WORKFLOW"]
  startDate       DateTime  @map("start_date")
  endDate         DateTime? @map("end_date")
  isActive        Boolean   @default(true) @map("is_active")
  revokedAt       DateTime? @map("revoked_at")
  revokedById     String?   @map("revoked_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")

  delegator       User      @relation("ScopeDelegatorRel", fields: [delegatorId], references: [id])
  delegate        User      @relation("ScopeDelegateRel", fields: [delegateId], references: [id])
  company         Company   @relation(fields: [companyId], references: [id])
  revokedBy       User?     @relation("ScopeRevokedBy", fields: [revokedById], references: [id])

  @@index([delegateId, isActive])
  @@index([companyId])
  @@map("scope_delegates")
}
```

### Logique de fusion du scope effectif

```
1. scope de base   = ModuleProfile.defaultScope (du rôle de l'utilisateur)
2. override user   = UserModuleOverride.dataScope (si défini, remplace le scope de base)
3. délégation      = ScopeDelegate actif (si existant, étend temporairement le scope)
4. scope final     = max(scope_base_ou_override, scope_délégué)
5. filtre SQL      = WHERE branch_id IN (branches_autorisées) | sans filtre si ALL_BRANCHES
```

### Seed initial des profils par défaut

Au démarrage ou via `POST /api/module-profiles/seed`, si aucun `ModuleProfile` n'existe pour un tenant, les profils par défaut sont générés depuis `DEFAULT_ROLE_PROFILES` (constante côté backend couvrant les 10 rôles) :

| Rôle | Scope par défaut | Modules principaux |
|------|-----------------|-------------------|
| `CHARGE_AFFAIRES` | `BRANCH_ONLY` | clients, credit-application, approvals (lecture) |
| `ANALYSTE_RISQUES` | `BRANCH_ONLY` | clients, approvals, data-input, analysis, reports |
| `RESPONSABLE_RISQUES` | `MULTI_BRANCH` | tout Analyse Financière, approvals |
| `RESPONSABLE_ENGAGEMENTS` | `MULTI_BRANCH` | approvals, analytics, credit-policy (lecture) |
| `COMITE_CREDIT` | `ALL_BRANCHES` | approvals, analytics, credit-policy |
| `DIRECTION_GENERALE` | `ALL_BRANCHES` | tous modules |
| `BACK_OFFICE` | `BRANCH_ONLY` | clients, workflow, legal-step |
| `DIRECTION_JURIDIQUE` | `ALL_BRANCHES` | legal-step, contract-templates |
| `ADMIN` | `ALL_BRANCHES` | tous modules sauf platform-admin |
| `SUPER_ADMIN` | `ALL_BRANCHES` | tous modules |

---

## 6. API Backend

### Routes module-profiles

```
GET    /api/module-profiles/me
       Profil fusionné de l'utilisateur connecté (rôle + override + scope + délégations)
       Mis en cache Redis (TTL 5min, invalidé à chaque PUT/DELETE)

GET    /api/module-profiles?companyId=xxx
       Liste tous les profils de rôles du tenant — ADMIN only

GET    /api/module-profiles/:role
       Profil d'un rôle précis pour le tenant courant

PUT    /api/module-profiles/:role
       Créer/mettre à jour le profil d'un rôle — ADMIN only

POST   /api/module-profiles/reset/:role
       Réinitialiser au profil système par défaut — ADMIN only

GET    /api/module-profiles/users/:userId
       Override d'un utilisateur + profil rôle de base

PUT    /api/module-profiles/users/:userId
       Créer/mettre à jour l'override d'un utilisateur — ADMIN only

DELETE /api/module-profiles/users/:userId
       Supprimer l'override (revient au profil rôle)
```

### Routes scope-delegates

```
GET    /api/scope-delegates?companyId=xxx
       Liste les délégations de périmètre actives

POST   /api/scope-delegates
       Créer une délégation — requiert ALL_BRANCHES scope sur le délégant

PUT    /api/scope-delegates/:id
       Modifier dates ou périmètre

DELETE /api/scope-delegates/:id
       Révoquer une délégation
```

### Middleware scopeFilter

Fichier : `backend/src/middleware/scopeFilter.ts`

Injecte `req.branchFilter` sur chaque requête authentifiée. Les routes `applications`, `clients`, `approvals`, `analytics` appliquent ce filtre automatiquement dans leurs requêtes Prisma.

```typescript
// Résolution :
// 1. Charger UserModuleOverride.dataScope ?? ModuleProfile.defaultScope
// 2. Vérifier ScopeDelegate actif
// 3. Construire req.branchFilter = { branchId: { in: [...] } } | {}
```

---

## 7. Frontend

### Nouveaux fichiers

```
src/
├── config/
│   └── moduleRegistry.ts
├── contexts/
│   └── ModuleProfileContext.tsx
├── hooks/
│   └── useModuleAccess.ts
└── components/
    └── module-profiles/
        ├── ModuleProfileTab.tsx
        ├── RoleProfileEditor.tsx
        ├── UserScopeEditor.tsx
        └── ScopeDelegateManager.tsx
```

### Hook useModuleAccess

```typescript
const { canAccess, canAction, canSeeSection, dataScope, allowedBranches } = useModuleAccess();

canAccess('approvals')                    // → boolean : page visible ?
canAction('approvals', 'approve')         // → boolean : action disponible ?
canSeeSection('analytics', 'portfolio')   // → boolean : section visible ?
dataScope                                 // → 'branch_only' | 'multi_branch' | 'all_branches'
allowedBranches                           // → string[] (si MULTI_BRANCH)
```

### Intégration Sidebar (non-breaking)

```typescript
// Pattern appliqué à chaque item de menu :
canViewApplications && canAccess('approvals') && <MenuItem page="approvals" />

// Les checks hasPermission() existants restent inchangés.
// canAccess() s'ajoute en AND — si le profil n'est pas encore chargé,
// canAccess() retourne true par défaut (fail-open) pour éviter de bloquer l'UI.
```

### UI — Onglet "Profils de modules" dans UserManagement

**Vue par rôle (RoleProfileEditor)** :

```
Sélecteur : [CHARGE_AFFAIRES ▼]                [Réinitialiser défauts]

┌─ Processus Crédit ─────────────────────────────────────────────────┐
│  ☑ Clients          Actions : [☑ Créer] [☑ Éditer] [☐ Supprimer]  │
│  ☑ Approbations     Actions : [☑ Approuver] [☑ Rejeter] [☐ Export]│
│     Sections : [☑ En attente] [☑ Historique]                       │
│  ☐ Dispatching                                                     │
│  ☑ Workflow         Actions : [☐ Éditer workflow]                  │
└────────────────────────────────────────────────────────────────────┘

┌─ Périmètre de données ─────────────────────────────────────────────┐
│  ◉ Agence uniquement                                               │
│  ○ Multi-agences    [Abidjan ×] [Bouaké ×] [Ajouter +]            │
│  ○ Tout le réseau                                                  │
└────────────────────────────────────────────────────────────────────┘

[Enregistrer pour ce rôle]
```

**Vue par utilisateur (UserScopeEditor)** — accessible depuis la fiche utilisateur :
- Affiche uniquement les **différences** (delta) par rapport au profil de son rôle
- Badge "Personnalisé" si un override existe
- Bouton "Réinitialiser au profil du rôle"

**Délégations de périmètre (ScopeDelegateManager)** :
- Liste des délégations actives (délégant, bénéficiaire, périmètre, durée)
- Formulaire : sélectionner un utilisateur, définir le scope + agences + actions + dates
- Visible uniquement pour les utilisateurs avec `ALL_BRANCHES` scope

---

## 8. Gestion des erreurs et cas limites

- **Profil absent** : si aucun `ModuleProfile` n'existe pour le rôle du tenant → seed automatique depuis `DEFAULT_ROLE_PROFILES` au premier accès
- **Cache invalidation** : toute mise à jour de profil (rôle ou user) invalide le cache Redis des utilisateurs concernés
- **Fail-open** : si `ModuleProfileContext` n'est pas encore chargé, `canAccess()` retourne `true` pour éviter un écran blanc
- **Délégation expirée** : le middleware vérifie `endDate` et `isActive` à chaque requête
- **SUPER_ADMIN** : bypass total du système de profils (accès à tout)

---

## 9. Tests

- **Backend** : tests unitaires sur la logique de fusion (rôle + override + délégation), tests d'intégration sur les endpoints avec différents scopes
- **Frontend** : tests du hook `useModuleAccess()` avec différents profils mockés, tests de la Sidebar avec profils partiels
- **E2E** : scénario complet — admin configure profil → utilisateur se connecte → voit les bons menus/actions

---

## 10. Plan de migration

1. Migration Prisma : ajouter `DataScope` enum, tables `ModuleProfile`, `UserModuleOverride`, `ScopeDelegate`
2. Seed des profils par défaut pour les tenants existants
3. Déployer backend (nouveaux endpoints + middleware scopeFilter)
4. Déployer frontend (ModuleProfileContext + intégration Sidebar non-breaking)
5. Validation en staging avec BCI seed data
6. Activation progressive : profils permissifs par défaut, l'admin affine ensuite
