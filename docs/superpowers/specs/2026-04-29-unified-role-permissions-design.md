# Spec : Unification des permissions et gestion des rôles ERPNext-style

**Date** : 2026-04-29
**Statut** : Approuvé
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
| Synchronisation | Temps réel : `PUT /api/module-profiles/:role` met à jour tous les users du rôle |
| Table de mapping | Statique dans le code (`moduleToPermissionsMap.ts`), non configurable |
| UI | Split-view dans l'onglet "Rôles" de `UserManagementPage` |
| Dialog rôle existant | Remplacé par le panneau détail ERPNext-style |
| `PUT /api/roles/:role` | Déprécié (retourne 200 mais ne fait plus rien) |
| SUPER_ADMIN / ADMIN | Toujours `permissions: ['*']`, bypass du calcul |
| UserModuleOverride | Recalcul depuis la fusion (rôle + override), pas depuis le profil rôle seul |
| Breaking changes | Aucun : `authorize()`, `hasPermission()`, `RolePermission`, JWT inchangés |

---

## 3. Architecture globale

```
ModuleProfile (source de configuration admin)
  ↓  PUT /api/module-profiles/:role
  ↓
moduleToPermissionsMap.ts  ←  table de mapping statique côté backend
  ↓  dérive les permission strings
  ↓
Transaction Prisma atomique :
  ├─ UPDATE RolePermission SET permissions = [...]  WHERE role = :role
  └─ UPDATE User SET permissions = [...]  WHERE role = :role AND companyId = :companyId
        ↓
  Invalidation Redis  (clés module-profile:{companyId}:{userId})
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

Fichier : `backend/src/constants/moduleToPermissionsMap.ts`

```typescript
export const MODULE_ACTION_TO_PERMISSIONS: Record<string, string[]> = {
  // Visibilité de module
  'clients.visible':               ['view_client', 'manage_clients'],
  'approvals.visible':             ['view_applications'],
  'analytics.visible':             ['analytics', 'portfolio_analytics'],
  'reports.visible':               ['reports'],
  'dispatching.visible':           ['dispatch_applications', 'view_analyst_workload'],
  'data-input.visible':            ['financial_analysis'],
  'analysis.visible':              ['analyze_credit', 'benchmark_analysis'],
  'user-management.visible':       ['user_management'],
  'credit-policy.visible':         ['policy_configuration'],
  'credit-scoring.visible':        ['score_applications'],
  'raci-matrix.visible':           ['manage_branch'],

  // Actions clients
  'clients.actions.create':        ['create_client'],
  'clients.actions.edit':          ['edit_client_data'],
  'clients.actions.delete':        ['manage_clients'],
  'clients.actions.export':        ['data_export'],

  // Actions approbations
  'approvals.actions.approve':     ['approve_credit', 'approve_applications'],
  'approvals.actions.reject':      ['approve_credit'],
  'approvals.actions.comment':     ['review_applications'],
  'approvals.actions.export':      ['data_export'],
  'approvals.sections.history':    ['audit_logs'],

  // Analytics
  'analytics.actions.export':      ['data_export'],
  'analytics.sections.portfolio':  ['view_portfolio'],
  'analytics.sections.compliance': ['risk_reporting'],

  // Analyse financière
  'data-input.actions.save_draft': ['edit_analysis'],
  'analysis.actions.export':       ['data_export'],

  // Administration
  'user-management.actions.create_user':    ['role_assignment'],
  'user-management.actions.edit_user':      ['user_management'],
  'user-management.actions.reset_password': ['system_administration'],
  'user-management.actions.deactivate':     ['user_management'],

  // Politique de crédit
  'credit-policy.actions.edit_policy': ['policy_configuration'],
  'credit-policy.actions.activate':    ['policy_configuration'],

  // Workflow & juridique
  'workflow.actions.edit_workflow':         ['manage_branch'],
  'legal-step.actions.validate':            ['manage_contract_templates'],
  'legal-step.actions.reject':              ['manage_contract_templates'],
  'contract-templates.actions.upload':      ['manage_contract_templates'],
  'contract-templates.actions.edit':        ['manage_contract_templates'],
  'contract-templates.actions.delete':      ['manage_contract_templates'],
};
```

### Fonction de dérivation

```typescript
export function derivePermissions(modules: Record<string, ModuleAccess>): string[] {
  const perms = new Set<string>();

  for (const [moduleKey, access] of Object.entries(modules)) {
    if (!access.visible) continue;

    const visKey = `${moduleKey}.visible`;
    MODULE_ACTION_TO_PERMISSIONS[visKey]?.forEach(p => perms.add(p));

    for (const action of access.actions) {
      const actKey = `${moduleKey}.actions.${action}`;
      MODULE_ACTION_TO_PERMISSIONS[actKey]?.forEach(p => perms.add(p));
    }

    for (const section of access.sections) {
      const secKey = `${moduleKey}.sections.${section}`;
      MODULE_ACTION_TO_PERMISSIONS[secKey]?.forEach(p => perms.add(p));
    }
  }

  return Array.from(perms);
}
```

---

## 5. Backend : Modifications

### `PUT /api/module-profiles/:role` (enrichi)

```typescript
// Étapes exécutées en séquence après la sauvegarde du profil :

// 1. Sauvegarder le ModuleProfile
const saved = await prisma.moduleProfile.upsert({ ... });

// 2. Dériver les permissions
const permissions = derivePermissions(saved.modules as Record<string, ModuleAccess>);

// 3. Bypass ADMIN/SUPER_ADMIN
const isAdminRole = ['ADMIN', 'SUPER_ADMIN'].includes(role);
const finalPermissions = isAdminRole ? ['*'] : permissions;

// 4. Transaction atomique
await prisma.$transaction([
  prisma.rolePermission.update({
    where: { role: role as UserRole },
    data: { permissions: finalPermissions },
  }),
  prisma.user.updateMany({
    where: { role: role as UserRole, memberships: { some: { companyId } } },
    data: { permissions: finalPermissions },
  }),
]);

// 5. Invalider Redis
await invalidateModuleProfileCache(companyId, role);
```

### `PUT /api/roles/:role` (déprécié)

```typescript
// Retourne 200 avec un avertissement — ne modifie plus rien
res.json({
  success: true,
  deprecated: true,
  message: 'Utilisez PUT /api/module-profiles/:role pour modifier les permissions.',
});
```

### Seed initial de recalcul

Script `backend/scripts/recalculate-permissions-from-profiles.ts` :
- Pour chaque `ModuleProfile` existant en DB, dériver les permissions et mettre à jour `RolePermission` + `User`
- Exécuté une seule fois lors du déploiement

### UserModuleOverride

Quand un `UserModuleOverride` existe, les permissions individuelles de cet utilisateur sont recalculées depuis la fusion :

```typescript
const mergedModules = mergeModules(roleProfile.modules, override.modules);
const userPermissions = derivePermissions(mergedModules);
await prisma.user.update({ where: { id: userId }, data: { permissions: userPermissions } });
```

Cette logique est déclenchée par `PUT /api/module-profiles/users/:userId` (déjà prévu dans la spec module-profiles).

---

## 6. Frontend : UI Split-view

### Structure du composant

```
UserManagementPage
  └─ Tab "Rôles" (index 2)
       └─ RoleManagerPanel  (nouveau composant)
            ├─ RoleList          (panneau gauche 30%)
            │    ├─ SearchInput
            │    ├─ RoleListItem (× N rôles)
            │    └─ AddRoleButton
            └─ RoleDetailPanel   (panneau droit 70%)
                 ├─ RoleHeader (nom, nb users, bouton Réinitialiser)
                 ├─ ModuleGroupSection (× 4 groupes)
                 │    └─ ModuleRow (visible toggle + actions + sections)
                 ├─ DataScopeSection (BRANCH_ONLY / MULTI_BRANCH / ALL_BRANCHES)
                 ├─ DerivedPermissionsSection (chips read-only)
                 └─ ActionBar (Annuler / Enregistrer)
```

### Fichiers nouveaux / modifiés

```
src/
├─ components/
│   └─ role-manager/
│       ├─ RoleManagerPanel.tsx      (remplace le dialog rôle)
│       ├─ RoleList.tsx
│       ├─ RoleDetailPanel.tsx
│       ├─ ModuleGroupSection.tsx
│       └─ DerivedPermissionsSection.tsx
└─ pages/
    └─ UserManagementPage.tsx        (modifier l'onglet "Rôles", tab index 2)
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

- Clic sur un rôle dans la liste → charge le `ModuleProfile` du rôle via `GET /api/module-profiles/:role`
- Les permissions dérivées sont recalculées localement en temps réel pendant que l'admin coche/décoche (preview avant sauvegarde)
- "Enregistrer" → `PUT /api/module-profiles/:role` → backend sync → toast succès avec nb d'utilisateurs mis à jour
- "Réinitialiser" → `POST /api/module-profiles/reset/:role` → recharge les valeurs par défaut depuis `DEFAULT_ROLE_PROFILES`
- Si le rôle est ADMIN ou SUPER_ADMIN → toutes les cases cochées en grisé, badge "Accès total"

---

## 7. Gestion des erreurs

| Cas | Comportement |
|-----|-------------|
| Échec de la transaction Prisma | Rollback complet, aucune permission mise à jour, erreur 500 |
| Profil de module absent en DB | Seed automatique depuis `DEFAULT_ROLE_PROFILES` avant la lecture |
| UserModuleOverride présent | Recalcul individuel déclenché par `PUT /api/module-profiles/users/:userId` uniquement |
| JWT en cours de session | Reste valide jusqu'à expiration — `authenticate` relit `permissions` en DB à chaque requête |
| Redis indisponible | Log warning, la sync DB continue sans invalidation cache (mode dégradé) |

---

## 8. Plan de migration (ordre de déploiement)

1. **Ajouter** `backend/src/constants/moduleToPermissionsMap.ts` (mapping + `derivePermissions`)
2. **Modifier** `PUT /api/module-profiles/:role` : ajouter la transaction de sync permissions
3. **Déprécier** `PUT /api/roles/:role` : retour 200 avec message
4. **Exécuter** `recalculate-permissions-from-profiles.ts` sur chaque environnement
5. **Déployer** `RoleManagerPanel` + composants dans `UserManagementPage`
6. **Supprimer** le dialog rôle existant (`roleDialogOpen`, `openRoleDialog`, `closeRoleDialog`)

---

## 9. Tests

- **Backend unitaire** : `derivePermissions()` sur chaque profil par défaut → vérifier les permissions produites
- **Backend intégration** : `PUT /api/module-profiles/:role` → vérifier que `RolePermission` et `User.permissions` sont mis à jour
- **Frontend unitaire** : `DerivedPermissionsSection` affiche les permissions calculées localement
- **E2E** : admin modifie profil ANALYSTE_RISQUES → utilisateur avec ce rôle reçoit les bonnes permissions à sa prochaine requête API
