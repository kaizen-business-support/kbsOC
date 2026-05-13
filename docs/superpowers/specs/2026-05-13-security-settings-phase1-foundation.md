# Security Settings — Phase 1 Foundation

**Date :** 2026-05-13
**Statut :** design validé, prêt pour plan d'implémentation
**Phases ultérieures :** IP Rules (Phase 2), Time Rules (Phase 3), Block History (Phase 4)

## 0. Décomposition du module complet (rappel architecture)

Le module Security Settings est livré en **4 PRs successives** :

| Phase | Périmètre | Dépendances |
|---|---|---|
| **1 (ce spec)** | Schema Prisma + migration + permission + page shell | — |
| 2 | IP Rules CRUD + middleware enforcement + cache Redis + UI tab | Phase 1 |
| 3 | Time Rules CRUD + middleware enforcement + preview + UI tab | Phase 1 |
| 4 | Block History CRUD + export CSV + brute-force detection + UI tab | Phases 2 + 3 (population du journal) |

**Multi-tenant** : chaque table porte `companyId String?`.
- `companyId IS NULL` → règle plateforme (gérée par `SUPER_ADMIN`, s'applique à toutes les requêtes).
- `companyId = X` → règle tenant (gérée par `ADMIN` du tenant X, s'applique aux requêtes de ce tenant).
- Évaluation en cascade : `deny plateforme` > `deny tenant` > `allow tenant` > `allow plateforme implicite`.

**Middleware** (Phase 2+) : règles plateforme vérifiées **avant** auth (pour bloquer aussi la route `/login`), règles tenant vérifiées **après** auth.

## 1. Contexte & objectif Phase 1

Mettre en place les fondations sans aucun comportement d'enforcement :
- Schéma Prisma des 3 tables avec leurs enums et FK.
- Migration.
- Permission `manage_security` ajoutée aux profils ADMIN / SUPER_ADMIN.
- Squelette UI : page + onglets + entrée Sidebar avec garde de permission.

Cette PR est shippable telle quelle : aucune route ne s'expose, aucun middleware n'évalue de règle. L'utilisateur autorisé voit la page avec 3 onglets vides (placeholders explicites).

## 2. Schéma Prisma (à ajouter dans `backend/prisma/schema.prisma`)

### 2.1 Modèles

```prisma
model SecurityIpRule {
  id          String   @id @default(cuid())
  ipAddress   String   @map("ip_address")
  ruleType    SecurityRuleType                @map("rule_type")
  description String?
  isActive    Boolean  @default(true)         @map("is_active")
  companyId   String?  @map("company_id")
  company     Company? @relation(fields: [companyId], references: [id])
  createdBy   String   @map("created_by")
  creator     User     @relation("UserCreatedIpRules", fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())        @map("created_at")
  updatedAt   DateTime @updatedAt             @map("updated_at")
  deletedAt   DateTime?                       @map("deleted_at")

  @@index([companyId, isActive, deletedAt])
  @@index([ipAddress])
  @@map("security_ip_rules")
}

model SecurityTimeRule {
  id            String   @id @default(cuid())
  name          String
  daysOfWeek    Int                              @map("days_of_week")    // bitmask lun=1 .. dim=64
  timeStart     String                           @map("time_start")       // "HH:MM"
  timeEnd       String                           @map("time_end")         // "HH:MM"
  timezone      String   @default("UTC")
  appliesTo     SecurityAppliesTo                @map("applies_to")
  targetValues  String[] @default([])            @map("target_values")
  deniedMessage String?                          @map("denied_message")
  isActive      Boolean  @default(true)          @map("is_active")
  companyId     String?  @map("company_id")
  company       Company? @relation(fields: [companyId], references: [id])
  createdBy     String   @map("created_by")
  creator       User     @relation("UserCreatedTimeRules", fields: [createdBy], references: [id])
  createdAt     DateTime @default(now())         @map("created_at")
  updatedAt     DateTime @updatedAt              @map("updated_at")
  deletedAt     DateTime?                        @map("deleted_at")

  @@index([companyId, isActive, deletedAt])
  @@map("security_time_rules")
}

model SecurityBlockHistory {
  id              String              @id @default(cuid())
  blockedIp       String              @map("blocked_ip")
  attemptedUserId String?             @map("attempted_user_id")
  attemptedUser   User?               @relation("UserBlockAttempts", fields: [attemptedUserId], references: [id])
  blockReason     SecurityBlockReason @map("block_reason")
  attemptCount    Int                 @default(1) @map("attempt_count")
  requestPath     String?             @map("request_path")
  userAgent       String?             @map("user_agent")
  status          SecurityBlockStatus @default(BLOCKED)
  unblockedBy     String?             @map("unblocked_by")
  unblocker       User?               @relation("UserUnblocks", fields: [unblockedBy], references: [id])
  unblockedAt     DateTime?           @map("unblocked_at")
  unblockNote     String?             @map("unblock_note")
  companyId       String?             @map("company_id")
  company         Company?            @relation(fields: [companyId], references: [id])
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([companyId, status, createdAt])
  @@index([blockedIp, createdAt])
  @@map("security_block_history")
}
```

### 2.2 Enums

```prisma
enum SecurityRuleType {
  ALLOW @map("allow")
  DENY  @map("deny")
  @@map("security_rule_type")
}

enum SecurityAppliesTo {
  ALL        @map("all")
  BRANCH     @map("branch")
  DEPARTMENT @map("department")
  ROLE       @map("role")
  USER       @map("user")
  @@map("security_applies_to")
}

enum SecurityBlockReason {
  IP_BLACKLISTED      @map("ip_blacklisted")
  OUTSIDE_TIME_WINDOW @map("outside_time_window")
  BRUTE_FORCE         @map("brute_force")
  MANUAL              @map("manual")
  @@map("security_block_reason")
}

enum SecurityBlockStatus {
  BLOCKED   @map("blocked")
  UNBLOCKED @map("unblocked")
  @@map("security_block_status")
}
```

### 2.3 Relations inverses

Sur `Company` (ajouter) :
```prisma
securityIpRules     SecurityIpRule[]
securityTimeRules   SecurityTimeRule[]
securityBlockHistory SecurityBlockHistory[]
```

Sur `User` (ajouter) :
```prisma
createdIpRules     SecurityIpRule[]       @relation("UserCreatedIpRules")
createdTimeRules   SecurityTimeRule[]     @relation("UserCreatedTimeRules")
blockAttempts      SecurityBlockHistory[] @relation("UserBlockAttempts")
unblocksPerformed  SecurityBlockHistory[] @relation("UserUnblocks")
```

### 2.4 Soft delete

Les modèles `SecurityIpRule` et `SecurityTimeRule` portent un `deletedAt` nullable. Le service applicatif filtrera `deletedAt: null` par défaut. `SecurityBlockHistory` n'a pas de soft delete (immuable, sauf le statut `BLOCKED → UNBLOCKED`).

## 3. Migration

Nouvelle migration Prisma `add_security_settings_module` :
- Crée les 4 enums.
- Crée les 3 tables avec leurs FK vers `companies` et `users`.
- Crée les indexes.
- Aucun seed de données.

Commande de génération : `npx prisma migrate dev --name add_security_settings_module --create-only` puis `prisma migrate dev` pour appliquer.

## 4. Permission `manage_security`

Aucun changement à `UserRole`. On ajoute la chaîne `'manage_security'` aux permissions par défaut :
- Profil `ADMIN` : ajout dans la dérivation `moduleProfileService.derivePermissions` ou directement dans le seed des profils.
- Profil `SUPER_ADMIN` : permission `*` déjà gérée par wildcard, aucun changement nécessaire.

Côté frontend, le test classique `userState.currentUser?.permissions?.includes('manage_security') || perms.includes('*')` gating la visibilité.

## 5. Frontend — page shell

### 5.1 Page `SecuritySettingsPage`

`src/pages/SecuritySettingsPage.tsx` :
- Permission guard : si `!hasPermission('manage_security')` → afficher un placeholder de type 403 ("Accès réservé"). Aucune redirection forcée.
- Layout : `Box` plein écran avec `bgcolor: colors.bg.page` (palette home), padding cohérent.
- Header : titre "Paramètres de sécurité" + sous-titre court ("Règles IP, plages horaires et journal des blocages").
- 3 onglets MUI : "Règles IP" | "Plages horaires" | "Journal des blocages".
- Chaque panneau correspond à un placeholder dédié (composants à créer) :
  - `src/components/security/IPRulesTab.tsx`
  - `src/components/security/TimeRulesTab.tsx`
  - `src/components/security/BlockHistoryTab.tsx`
- Chaque placeholder rend une `Alert severity="info"` discrète "Cette fonctionnalité sera disponible dans la prochaine mise à jour." et un icon `Construction`.

### 5.2 Type `PageType`

Ajouter `'security-settings'` au type `PageType` dans `src/types/index.ts`.

### 5.3 Route

Dans `src/App.tsx` ajouter `<Route path="/security-settings" element={<SecuritySettingsPage onNavigate={handlePageChange} />} />` à côté des autres routes admin. Lazy-load identique aux autres pages admin.

### 5.4 Sidebar — entrée menu

Dans `src/components/Sidebar.tsx`, section Configuration (le bloc `configItems`), ajouter conditionnellement :
```ts
...(canManageSecurity ? [{ id: 'security-settings' as PageType, label: 'Sécurité', icon: ShieldOutlinedIcon }] : []),
```
avec `const canManageSecurity = hasPermission('manage_security') || isAdmin;`.

Icone : `@mui/icons-material/ShieldOutlined`.

## 6. Tests

Phase 1 ne contient aucune logique métier — pas de tests Jest ajoutés. Les tests viendront en Phase 2 (validation IP, middleware) et Phase 3 (timezone, fenêtres horaires).

Vérifications :
- `npx tsc --noEmit` backend + frontend.
- `npx prisma generate` puis `npx prisma migrate dev` sur DB locale, vérifier que les 3 tables existent.
- UI : login en ADMIN → "Sécurité" apparaît dans la Sidebar → clic ouvre la page → les 3 onglets sont visibles avec placeholders.

## 7. Hors-périmètre Phase 1

- Routes `/api/security/*` (Phase 2/3/4).
- Middleware d'enforcement IP / time (Phase 2/3).
- Cache Redis (Phase 2/3).
- Validation IP / CIDR (Phase 2 — utilisera `ipaddr.js`).
- Détection brute-force (Phase 4).
- Export CSV (Phase 4).
- Toasts, modals, filtres URL (Phases 2/3/4).

## 8. Risques connus

- **Migration Prisma** : Si la DB locale dev n'est pas à jour, la migration peut échouer. Mitigation : tester sur une DB de test isolée avant merge.
- **Permission `manage_security` non distribuée** : Si on oublie d'ajouter la permission au profil ADMIN existant, aucun admin ne verra le menu. Mitigation : seed/migration de données qui upsert la permission dans les ModuleProfile existants ADMIN ; idempotent.
- **Conflit de noms** : `SecurityRuleType.ALLOW/DENY` est un nom court qui pourrait collisionner. Préfixé `Security*` partout pour clarté.

## 9. Migration / rollback

Rollback = `prisma migrate resolve --rolled-back add_security_settings_module` puis suppression manuelle des tables. La feature étant additive (aucune route active, aucun middleware), un revert du commit suffit côté code ; les tables peuvent être laissées en DB sans impact.
