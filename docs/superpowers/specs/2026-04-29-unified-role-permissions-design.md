# Spec : Unification des permissions et gestion des rôles ERPNext-style

**Date** : 2026-04-29
**Statut** : Approuvé (v2 post-review)
**Projet** : OptimusCredit — Unification des droits et UI de gestion des rôles

---

## 1. Contexte et objectif

OptimusCredit dispose actuellement de deux systèmes de droits distincts et non synchronisés :

1. **Permissions strings** : tableau `user.permissions[]` (ex : `approve_credit`, `view_applications`) stocké dans la table `RolePermission` et sur chaque `User`. Utilisé par le middleware `authorize()` pour protéger les routes API.

2. **Profils de modules** : objet JSON `ModuleProfile.modules` (ex : `approvals.visible`, `approvals.actions.approve`) défini par rôle et tenant. Utilisé par le frontend (`useModuleAccess()`) pour afficher/masquer menus, boutons et sections.

Ces deux systèmes coexistent sans liaison — un admin qui modifie un profil de module ne touche pas les permissions backend, et vice versa. Objectif : **unifier en faisant du profil de module la source de configuration unique**, les permissions strings devenant un artefact calculé automatiquement.

L'UI de gestion des rôles sera redesignée en **split-view ERPNext-style** : liste des rôles à gauche, éditeur détaillé du rôle sélectionné à droite.

---

## 2. Décisions de conception

| Question | Décision |
|----------|----------|
| Source de vérité | Profil de module (l'admin ne configure que ça) |
| Permissions strings | Conservées en DB, calculées automatiquement depuis le profil |
| Synchronisation | Temps réel : `PUT /api/module-profiles/:role` et `POST /api/module-profiles/reset/:role` mettent à jour tous les users du rôle |
| Table de mapping | Statique dans le code (`moduleToPermissionsMap.ts`), non configurable |
| UI | Split-view dans l'onglet "Rôles" de `UserManagementPage` |
| Dialog rôle existant | Remplacé par le panneau détail ERPNext-style |
| `PUT /api/roles/:role` | Déprécié — retourne **410 Gone** avec message de redirection |
| SUPER_ADMIN / ADMIN | Toujours `permissions: ['*']`, bypass du calcul |
| UserModuleOverride | Recalcul depuis la fusion (rôle + override via `mergeModuleProfile`), pas depuis le profil rôle seul |
| Breaking changes | Aucun : `authorize()`, `hasPermission()`, `RolePermission`, JWT inchangés |
| `derivePermissions` côté frontend | Dupliqué dans `src/utils/derivePermissions.ts` pour le preview live (source canonique reste backend) |
| Permissions SUPER_ADMIN only | `manage_backup`, `manage_2fa_config`, `system_administration` non mappées : attribuées uniquement via `['*']` (rôles ADMIN/SUPER_ADMIN) |
| Permissions de scope de données | `view_all`, `view_branch`, `view_own` dérivées depuis `defaultScope` (voir Section 4) |

---

## 3. Architecture globale

```
ModuleProfile (source de configuration admin)
  ↓  PUT /api/module-profiles/:role
  ↓  POST /api/module-profiles/reset/:role
  ↓
moduleToPermissionsMap.ts  ←  table de mapping statique côté backend
  ↓  derivePermissions(modules, defaultScope)
  ↓
Transaction Prisma atomique :
  ├─ UPSERT RolePermission SET permissions = [...]  WHERE role = :role
  └─ UPDATE User SET permissions = [...]
       WHERE role = :role AND memberships some { companyId }
        ↓
  Invalidation Redis : pour chaque userId du rôle dans le tenant,
    DEL module-profile:{companyId}:{userId}
        ↓
  middleware authenticate  →  lit user.permissions[] depuis DB à chaque requête
        ↓
  authorize()  (inchangé)
```

### Flux au login (inchangé)

1. Authentification → `role` + `companyId` connus
2. `GET /api/module-profiles/me` → profil fusionné (rôle + override + délégations)
3. Chargement dans `ModuleProfileContext`
4. Sidebar et composants lisent via `useModuleAccess()`
5. Routes API protégées via `authorize()` → lit `user.permissions[]`

---

## 4. Table de mapping statique

### Fichiers

- **Backend** : `backend/src/constants/moduleToPermissionsMap.ts` (source canonique)
- **Frontend** : `src/utils/derivePermissions.ts` (copie identique, utilisée uniquement pour le preview live dans `DerivedPermissionsSection`)

> La duplication est intentionnelle et limitée. Si le mapping évolue, les deux fichiers doivent être mis à jour ensemble. Une note `// keep in sync with backend/src/constants/moduleToPermissionsMap.ts` est ajoutée dans le fichier frontend.

### Table `MODULE_ACTION_TO_PERMISSIONS`

```typescript
export const MODULE_ACTION_TO_PERMISSIONS: Record<string, string[]> = {
  // ── Visibilité de module ─────────────────────────────────────────────
  'clients.visible':                  ['view_client', 'manage_clients'],
  'credit-application.visible':       ['view_applications'],
  'approvals.visible':                ['view_applications', 'application_review'],
  'analytics.visible':                ['analytics', 'portfolio_analytics'],
  'reports.visible':                  ['reports'],
  'dispatching.visible':              ['dispatch_applications', 'view_analyst_workload'],
  'data-input.visible':               ['financial_analysis'],
  'analysis.visible':                 ['analyze_credit', 'benchmark_analysis'],
  'user-management.visible':          ['user_management'],
  'credit-policy.visible':            ['policy_configuration'],
  'credit-scoring.visible':           ['score_applications'],
  'raci-matrix.visible':              ['manage_branch'],
  'notifications-config.visible':     ['manage_notifications'],
  'announcements.visible':            ['manage_announcements'],
  'contract-templates.visible':       ['view_contracts'],
  'legal-step.visible':               ['view_contracts'],

  // ── Actions clients ──────────────────────────────────────────────────
  'clients.actions.create':           ['create_client'],
  'clients.actions.edit':             ['edit_client_data'],
  'clients.actions.delete':           ['manage_clients'],
  'clients.actions.export':           ['data_export'],

  // ── Actions demandes de crédit ───────────────────────────────────────
  'credit-application.actions.create': ['create_application'],
  'credit-application.actions.submit': ['create_application'],

  // ── Actions approbations ─────────────────────────────────────────────
  'approvals.actions.approve':        ['approve_credit', 'approve_applications',
                                       'committee_review', 'committee_vote', 'final_approval'],
  'approvals.actions.reject':         ['approve_credit', 'risk_override'],
  'approvals.actions.comment':        ['review_applications'],
  'approvals.actions.export':         ['data_export'],
  'approvals.sections.history':       ['audit_logs'],

  // ── Analytics ────────────────────────────────────────────────────────
  'analytics.actions.export':         ['data_export'],
  'analytics.sections.portfolio':     ['view_portfolio'],
  'analytics.sections.compliance':    ['risk_reporting'],

  // ── Analyse financière ───────────────────────────────────────────────
  'data-input.actions.save_draft':    ['edit_analysis'],
  'analysis.actions.export':          ['data_export'],

  // ── Administration ───────────────────────────────────────────────────
  'user-management.actions.create_user':    ['role_assignment'],
  'user-management.actions.edit_user':      ['user_management'],
  'user-management.actions.reset_password': ['system_configuration'],
  'user-management.actions.deactivate':     ['user_management'],
  'user-management.sections.roles':         ['role_assignment'],
  'bank-holidays-admin.visible':            ['system_configuration'],
  'notifications-config.actions.edit':      ['manage_notifications'],
  'announcements.actions.create':           ['manage_announcements'],
  'announcements.actions.edit':             ['manage_announcements'],
  'announcements.actions.delete':           ['manage_announcements'],

  // ── Politique de crédit ──────────────────────────────────────────────
  'credit-policy.actions.edit_policy':  ['policy_configuration', 'policy_exceptions'],
  'credit-policy.actions.activate':     ['policy_configuration'],
  'credit-policy.actions.archive':      ['policy_configuration'],

  // ── Rapports ─────────────────────────────────────────────────────────
  'reports.actions.export':            ['data_export'],
  // reports.actions.print : print est purement UI (rendu navigateur), pas de permission backend

  // ── Workflow & équipe ────────────────────────────────────────────────
  // workflow.visible : la visibilité du module workflow ne confère aucune permission backend
  //   (l'accès lecture au workflow est public pour tout user authentifié du tenant)
  'workflow.actions.edit_workflow':     ['manage_branch', 'workflow_override'],
  'raci-matrix.actions.edit':           ['manage_team'],
  'raci-matrix.actions.import':         ['manage_team'],
  'dispatching.actions.dispatch':       ['dispatch_applications', 'assign_analyst'],

  // ── Juridique & contrats ─────────────────────────────────────────────
  'legal-step.actions.validate':        ['manage_contract_templates'],
  'legal-step.actions.reject':          ['manage_contract_templates'],
  'contract-templates.actions.upload':  ['manage_contract_templates', 'generate_contracts'],
  'contract-templates.actions.edit':    ['manage_contract_templates', 'generate_contracts'],
  'contract-templates.actions.delete':  ['manage_contract_templates'],

  // ── Modules intentionnellement sans mapping backend ──────────────────
  // home            : page d'accueil display-only, pas de permission backend
  // credit-simulation : outil de calcul frontend-only
  // credit-types    : gestion métier admin, visibilité contrôlée par user-management.visible
  // approval-limits : idem
};

// Permissions non mappables via module (ADMIN/SUPER_ADMIN seulement via ['*']) :
// manage_backup, manage_2fa_config, system_administration
//
// view_client : produit par clients.visible — ABSENT de PERMISSION_GROUPS dans UserManagementPage.tsx.
//   Action requise lors de l'implémentation : ajouter view_client dans la catégorie
//   "Visibilité des données" de PERMISSION_GROUPS pour que le chip s'affiche dans DerivedPermissionsSection.
```

### Permissions dérivées depuis `defaultScope`

Ces permissions de visibilité des données sont dérivées du périmètre, pas d'une action de module :

```typescript
const SCOPE_TO_PERMISSIONS: Record<string, string[]> = {
  BRANCH_ONLY:   ['view_own', 'view_branch'],
  MULTI_BRANCH:  ['view_branch'],
  ALL_BRANCHES:  ['view_all', 'view_branch'],
};
```

### Fonction `derivePermissions`

```typescript
export function derivePermissions(
  modules: Record<string, ModuleAccess>,
  defaultScope: 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES'
): string[] {
  const perms = new Set<string>();

  // Permissions de scope
  SCOPE_TO_PERMISSIONS[defaultScope]?.forEach(p => perms.add(p));

  for (const [moduleKey, access] of Object.entries(modules)) {
    if (!access.visible) continue;

    MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.visible`]
      ?.forEach(p => perms.add(p));

    for (const action of access.actions) {
      MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.actions.${action}`]
        ?.forEach(p => perms.add(p));
    }

    for (const section of access.sections) {
      MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.sections.${section}`]
        ?.forEach(p => perms.add(p));
    }
  }

  return Array.from(perms);
}
```

---

## 5. Backend : Modifications

### Helper `syncPermissionsForRole`

Extrait dans un helper réutilisé par `PUT /api/module-profiles/:role` ET `POST /api/module-profiles/reset/:role` :

```typescript
async function syncPermissionsForRole(
  role: string,
  modules: Record<string, ModuleAccess>,
  defaultScope: DataScope,
  companyId: string,
  prismaClient: PrismaClient
): Promise<void> {
  const isAdminRole = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const permissions = isAdminRole ? ['*'] : derivePermissions(modules, defaultScope);

  // Vérifier que la relation companyMembership existe sur le modèle User
  // (prisma schema: User → CompanyMembership[] via memberships)
  await prismaClient.$transaction([
    prismaClient.rolePermission.upsert({  // upsert et non update (rôle custom peut ne pas exister)
      where:  { role: role as UserRole },
      update: { permissions },
      create: { role: role as any, label: role, permissions, isActive: true },
    }),
    prismaClient.user.updateMany({
      where: {
        role: role as UserRole,
        memberships: { some: { companyId } },  // isolation tenant
      },
      data: { permissions },
    }),
  ]);

  // Invalider le cache Redis pour chaque user du rôle dans ce tenant
  await invalidateRoleProfileCache(companyId, role, prismaClient);
}
```

### Helper `invalidateRoleProfileCache`

Fichier : `backend/src/services/moduleProfileService.ts` (même fichier que `syncPermissionsForRole`)

```typescript
/**
 * Invalide les clés Redis module-profile:{companyId}:{userId}
 * pour tous les membres du tenant ayant le rôle donné.
 * Si Redis est indisponible, log un warning et continue (mode dégradé).
 */
export async function invalidateRoleProfileCache(
  companyId: string,
  role: string,
  prismaClient: PrismaClient
): Promise<void> {
  try {
    const memberships = await prismaClient.companyMembership.findMany({
      where: { companyId, user: { role: role as UserRole } },
      select: { userId: true },
    });
    await Promise.all(
      memberships.map(({ userId }) =>
        del(`module-profile:${companyId}:${userId}`).catch(err =>
          logger.warn(`Redis invalidation failed for ${userId}:`, err)
        )
      )
    );
  } catch (err) {
    logger.warn('invalidateRoleProfileCache: Redis unavailable, skipping cache invalidation', err);
  }
}
```

> **Note schema** : vérifier que `User` possède la relation `memberships: CompanyMembership[]` dans `schema.prisma` avant l'implémentation. Si la relation n'est pas définie, remplacer par une sous-requête `prisma.companyMembership.findMany` puis `user.updateMany({ where: { id: { in: userIds } } })`.

### `PUT /api/module-profiles/:role` (enrichi)

```typescript
// Après upsert du ModuleProfile :
await syncPermissionsForRole(role, saved.modules, saved.defaultScope, companyId, prisma);
```

### `POST /api/module-profiles/reset/:role` (enrichi)

```typescript
// Après reset du ModuleProfile depuis DEFAULT_ROLE_PROFILES :
await syncPermissionsForRole(role, resetProfile.modules, resetProfile.defaultScope, companyId, prisma);
```

### `PUT /api/module-profiles/users/:userId` — UserModuleOverride

```typescript
// Recalcul individuel depuis la fusion rôle + override
const mergedModules = mergeModuleProfile(roleProfile.modules, override.modules);
const userPermissions = isAdminRole ? ['*'] : derivePermissions(mergedModules, effectiveScope);
await prisma.user.update({ where: { id: userId }, data: { permissions: userPermissions } });
await del(`module-profile:${companyId}:${userId}`);
```

> **Correction** : la fonction de fusion s'appelle `mergeModuleProfile` (définie dans `moduleProfileService.ts`), pas `mergeModules`.

### `PUT /api/roles/:role` (déprécié)

```typescript
// HTTP 410 Gone — ne modifie plus rien
res.status(410).json({
  success: false,
  deprecated: true,
  message: 'Cette route est dépréciée. Utilisez PUT /api/module-profiles/:role.',
});
```

### `POST /api/roles` — Nouveau rôle personnalisé

Après création d'un rôle via `POST /api/roles`, seed automatique d'un `ModuleProfile` vide (tous modules `visible: false`) pour éviter un état indéfini :

```typescript
// Dans le handler POST /api/roles, après prisma.rolePermission.create :
await prisma.moduleProfile.create({
  data: {
    companyId,
    role: sanitizedRole,
    label,
    modules: buildEmptyModuleProfile(),  // tous visible: false
    defaultScope: 'BRANCH_ONLY',
    isDefault: false,
    createdById: req.user!.id,
  },
});
```

### Express — Ordre des routes (risque existant)

`GET /api/module-profiles/users/:userId` est enregistré APRÈS `GET /api/module-profiles/:role` dans le router actuel — Express capture `users` comme valeur du paramètre `:role`. **Corriger l'ordre** : enregistrer `/me`, `/users/:userId` et `/reset/:role` AVANT `/:role`.

---

## 6. Frontend : UI Split-view

### Structure du composant

```
UserManagementPage
  └─ Tab "Rôles" (index 2)
       └─ RoleManagerPanel  (remplace le dialog existant)
            ├─ RoleList          (panneau gauche 30%)
            │    ├─ SearchInput
            │    ├─ RoleListItem (× N rôles)
            │    └─ AddRoleButton
            └─ RoleDetailPanel   (panneau droit 70%)
                 ├─ RoleHeader (nom, nb users, bouton Réinitialiser)
                 ├─ ModuleGroupSection (× 4 groupes)
                 │    └─ ModuleRow (visible toggle + actions checkboxes + sections checkboxes)
                 ├─ DataScopeSection (BRANCH_ONLY / MULTI_BRANCH / ALL_BRANCHES)
                 ├─ DerivedPermissionsSection (chips read-only, preview live)
                 └─ ActionBar (Annuler / Enregistrer)
```

### Fichiers

```
src/
├─ utils/
│   └─ derivePermissions.ts          // copie du mapping — keep in sync with backend
├─ components/
│   └─ role-manager/
│       ├─ RoleManagerPanel.tsx      // remplace le dialog rôle existant
│       ├─ RoleList.tsx
│       ├─ RoleDetailPanel.tsx
│       ├─ ModuleGroupSection.tsx
│       └─ DerivedPermissionsSection.tsx
└─ pages/
    └─ UserManagementPage.tsx        // modifier l'onglet "Rôles" (tab index 2)
                                     // supprimer roleDialogOpen, openRoleDialog, closeRoleDialog
```

### Wireframe de l'onglet "Rôles"

```
┌─ Liste (30%) ──────────┐  ┌─ Détail du rôle (70%) ──────────────────────┐
│                        │  │                                              │
│  🔍 Rechercher...      │  │  ANALYSTE RISQUES              [Réinitialiser]│
│                        │  │  Analyste Risques  •  12 utilisateurs        │
│  ○ Chargé d'Affaires   │  │  ──────────────────────────────────────────  │
│  ● Analyste Risques    │  │                                              │
│  ○ Resp. Risques       │  │  ┌─ Processus Crédit ──────────────────────┐ │
│  ○ Resp. Engagements   │  │  │  Clients       ☑  créer  ☑ éditer  ☐ sup│ │
│  ○ Comité de Crédit    │  │  │  Approbations  ☑  commenter             │ │
│  ○ Direction Générale  │  │  │    Sections : ☑ En attente  ☑ Historique│ │
│  ○ Back Office         │  │  │  Dispatching   ☐                        │ │
│  ○ Direction Juridique │  │  └────────────────────────────────────────┘ │
│  ○ Admin               │  │                                              │
│  ○ Super Admin         │  │  ┌─ Analyse Financière ────────────────────┐ │
│                        │  │  │  Saisie données  ☑  save_draft          │ │
│  [+ Ajouter un rôle]   │  │  │  Analyse         ☑  export             │ │
│                        │  │  │  Rapports        ☑  export  ☑ print    │ │
│                        │  │  │  Scoring crédit  ☑                     │ │
└────────────────────────┘  │  └────────────────────────────────────────┘ │
                             │                                              │
                             │  ┌─ Périmètre de données ──────────────────┐ │
                             │  │  ◉ Agence uniquement                    │ │
                             │  │  ○ Multi-agences                        │ │
                             │  │  ○ Tout le réseau                       │ │
                             │  └────────────────────────────────────────┘ │
                             │                                              │
                             │  ┌─ Permissions dérivées (calculées) ──────┐ │
                             │  │  view_applications  •  analyze_credit   │ │
                             │  │  financial_analysis  •  edit_analysis   │ │
                             │  │  review_applications  •  data_export    │ │
                             │  │  ⓘ Propagées aux 12 utilisateurs        │ │
                             │  └────────────────────────────────────────┘ │
                             │                                              │
                             │              [Annuler]  [Enregistrer]        │
                             └──────────────────────────────────────────────┘
```

### Comportement

- Clic sur un rôle → `GET /api/module-profiles/:role` (attention : enregistrer APRÈS `/me` et `/users/:userId` dans le router)
- Preview permissions dérivées : `derivePermissions(localState, selectedScope)` recalculé à chaque changement de checkbox (côté frontend uniquement, pas d'appel API)
- "Enregistrer" → `PUT /api/module-profiles/:role` → toast avec nb d'utilisateurs mis à jour
- "Réinitialiser" → `POST /api/module-profiles/reset/:role` → recharge depuis `DEFAULT_ROLE_PROFILES`
- ADMIN / SUPER_ADMIN → toutes cases cochées, grisées, badge "Accès total — permissions: ['*']"
- Nouveau rôle → `POST /api/roles` → ouvre le détail du nouveau rôle (profil vide seeded automatiquement)

---

## 7. Gestion des erreurs

| Cas | Comportement |
|-----|-------------|
| Échec de la transaction Prisma | Rollback complet, aucune permission mise à jour, erreur 500 |
| Profil de module absent en DB | Seed automatique depuis `DEFAULT_ROLE_PROFILES` avant la lecture |
| Rôle custom sans `DEFAULT_ROLE_PROFILES` | Seed d'un profil vide (tous modules `visible: false`) |
| `RolePermission` absente en DB | `upsert` (pas `update`) — création si absente |
| `memberships` relation absente sur `User` | Voir note Section 5 — requête alternative via `companyMembership` |
| UserModuleOverride présent | Recalcul individuel déclenché par `PUT /api/module-profiles/users/:userId` uniquement |
| JWT en cours de session | Reste valide jusqu'à expiration — `authenticate` relit `permissions` en DB à chaque requête |
| Redis indisponible | Log warning, sync DB continue sans invalidation cache (mode dégradé) |
| `PUT /api/roles/:role` appelé | HTTP 410 Gone retourné immédiatement |

---

## 8. Plan de migration (ordre de déploiement)

1. **Corriger** l'ordre des routes dans `module-profiles.ts` : `/me`, `/users/:userId`, `/reset/:role` avant `/:role`
2. **Ajouter** `backend/src/constants/moduleToPermissionsMap.ts` (mapping + `derivePermissions` + `SCOPE_TO_PERMISSIONS`)
3. **Ajouter** helper `syncPermissionsForRole` dans `backend/src/services/moduleProfileService.ts`
4. **Modifier** `PUT /api/module-profiles/:role` : appel à `syncPermissionsForRole` après upsert
5. **Modifier** `POST /api/module-profiles/reset/:role` : appel à `syncPermissionsForRole` après reset
6. **Modifier** `POST /api/roles` : seed `ModuleProfile` vide après création du rôle
7. **Déprécier** `PUT /api/roles/:role` : retour 410
8. **Exécuter le script de migration** `backend/scripts/recalculate-permissions-from-profiles.ts` :
   - **Dry-run obligatoire** : flag `--dry-run` affiche les changements sans les appliquer
   - **Backup** : le script sauvegarde l'état actuel de `User.permissions` dans une table temporaire `_permissions_backup` avant toute modification
   - **Rollback** : script `restore-permissions-backup.ts` relit `_permissions_backup` et restaure
   - Pour chaque `ModuleProfile` existant par tenant, dériver et écrire permissions
9. **Ajouter** `src/utils/derivePermissions.ts` (copie frontend du mapping)
10. **Déployer** `RoleManagerPanel` + composants dans `UserManagementPage`
11. **Supprimer** le dialog rôle existant (`roleDialogOpen`, `openRoleDialog`, `closeRoleDialog`, handler `saveRole`)

---

## 9. Tests

- **Backend unitaire** : `derivePermissions()` sur chaque `DEFAULT_ROLE_PROFILES` → vérifier que toutes les permissions attendues sont produites ; vérifier que les 3 permissions SUPER_ADMIN-only sont absentes du résultat
- **Backend intégration** : `PUT /api/module-profiles/:role` → vérifier que `RolePermission` et `User.permissions` sont mis à jour en DB ; `POST /api/module-profiles/reset/:role` → même vérification
- **Backend intégration** : `GET /api/module-profiles/users/:userId` → vérifier que la route n'est pas capturée par `/:role`
- **Frontend unitaire** : `DerivedPermissionsSection` re-rend les bons chips quand les checkboxes changent
- **Frontend unitaire** : `derivePermissions` frontend = `derivePermissions` backend pour les mêmes inputs
- **E2E** : admin modifie profil ANALYSTE_RISQUES → les 12 utilisateurs voient leurs permissions mises à jour à la prochaine requête API authentifiée
- **E2E rollback** : script de migration dry-run + rollback n'altère pas les données de prod
