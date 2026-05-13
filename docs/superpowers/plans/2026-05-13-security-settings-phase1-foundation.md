# Security Settings — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations du module Security Settings : schema Prisma des 3 tables (ip rules / time rules / block history), migration, et squelette UI (page + onglets vides + entrée Sidebar). Aucune route ni middleware en Phase 1.

**Architecture:** Trois modèles Prisma multi-tenant via `companyId String?` (NULL = règle plateforme), avec FK vers `User`/`Company`. Permission `manage_security` reposée sur le wildcard `*` existant des admins (pas de data migration). Page React avec garde de permission, 3 onglets placeholders prêts à recevoir leur contenu en Phases 2-4.

**Tech Stack:** Prisma + PostgreSQL + Node.js/Express (back) ; React + TypeScript + MUI (front).

**Spec:** `docs/superpowers/specs/2026-05-13-security-settings-phase1-foundation.md`

---

## File structure

- **Backend — Modify**
  - `backend/prisma/schema.prisma` — ajout des 3 modèles + 4 enums + relations inverses sur `Company` et `User`.

- **Backend — Create**
  - `backend/prisma/migrations/YYYYMMDDHHMMSS_add_security_settings_module/migration.sql` — auto-générée par Prisma.

- **Frontend — Create**
  - `src/pages/SecuritySettingsPage.tsx` — page parente avec garde de permission + 3 onglets.
  - `src/components/security/IPRulesTab.tsx` — placeholder Phase 2.
  - `src/components/security/TimeRulesTab.tsx` — placeholder Phase 3.
  - `src/components/security/BlockHistoryTab.tsx` — placeholder Phase 4.

- **Frontend — Modify**
  - `src/types/index.ts` — ajouter `'security-settings'` à `PageType`.
  - `src/App.tsx` — route `/security-settings`.
  - `src/components/Sidebar.tsx` — entrée menu dans la section Configuration.

---

## Task 1 — Backend : Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_security_settings_module/migration.sql` (auto)

- [ ] **Step 1.1 — Localiser le modèle `Company`**

Run: `grep -n "^model Company " /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/prisma/schema.prisma`
Note la ligne de fin du modèle pour insérer les relations inverses.

- [ ] **Step 1.2 — Ajouter les 4 enums en fin de fichier**

Dans `backend/prisma/schema.prisma`, à la fin du fichier (après le dernier enum existant), insérer :

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

- [ ] **Step 1.3 — Ajouter les 3 modèles avant la section enums**

Dans `backend/prisma/schema.prisma`, juste avant le bloc des enums (chercher `// ─── Enums` ou la première occurrence de `enum `), insérer :

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
  id            String             @id @default(cuid())
  name          String
  daysOfWeek    Int                @map("days_of_week")
  timeStart     String             @map("time_start")
  timeEnd       String             @map("time_end")
  timezone      String             @default("UTC")
  appliesTo     SecurityAppliesTo  @map("applies_to")
  targetValues  String[]           @default([]) @map("target_values")
  deniedMessage String?            @map("denied_message")
  isActive      Boolean            @default(true) @map("is_active")
  companyId     String?            @map("company_id")
  company       Company?           @relation(fields: [companyId], references: [id])
  createdBy     String             @map("created_by")
  creator       User               @relation("UserCreatedTimeRules", fields: [createdBy], references: [id])
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")
  deletedAt     DateTime?          @map("deleted_at")

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
  createdAt       DateTime            @default(now()) @map("created_at")

  @@index([companyId, status, createdAt])
  @@index([blockedIp, createdAt])
  @@map("security_block_history")
}
```

- [ ] **Step 1.4 — Ajouter les relations inverses sur `Company`**

Dans le bloc `model Company { ... }`, juste avant la ligne `@@map("companies")`, ajouter :

```prisma
  securityIpRules      SecurityIpRule[]
  securityTimeRules    SecurityTimeRule[]
  securityBlockHistory SecurityBlockHistory[]
```

- [ ] **Step 1.5 — Ajouter les relations inverses sur `User`**

Dans le bloc `model User { ... }`, juste avant la ligne `@@map("users")`, ajouter :

```prisma
  createdIpRules     SecurityIpRule[]       @relation("UserCreatedIpRules")
  createdTimeRules   SecurityTimeRule[]     @relation("UserCreatedTimeRules")
  blockAttempts      SecurityBlockHistory[] @relation("UserBlockAttempts")
  unblocksPerformed  SecurityBlockHistory[] @relation("UserUnblocks")
```

- [ ] **Step 1.6 — Format + validation du schema**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma format`
Expected: schema formaté sans erreur.

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma validate`
Expected: "The schema at `prisma/schema.prisma` is valid 🚀".

- [ ] **Step 1.7 — Générer la migration**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma migrate dev --name add_security_settings_module --create-only`
Expected: création d'un dossier `prisma/migrations/<timestamp>_add_security_settings_module/` avec un `migration.sql` contenant les `CREATE TYPE` (enums) et `CREATE TABLE` (3 tables) + indexes + FKs.

Si Prisma demande de réinitialiser la base (data loss), répondre `n` et corriger en mode `--create-only` qui ne touche pas à la DB.

- [ ] **Step 1.8 — Inspecter le SQL généré**

Run: `cat /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend/prisma/migrations/*add_security_settings_module*/migration.sql | head -80`
Expected: voir les `CREATE TYPE "security_rule_type" AS ENUM ('allow', 'deny')` et les 3 `CREATE TABLE`. Vérifier que les `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` pointent vers `companies` et `users`.

- [ ] **Step 1.9 — Appliquer la migration en local**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx prisma migrate dev`
Expected: "Database is now in sync with your schema." + `prisma generate` automatique.

- [ ] **Step 1.10 — Vérification TypeScript backend**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit`
Expected: aucun output (les nouveaux types Prisma sont générés et utilisables).

- [ ] **Step 1.11 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add backend/prisma/schema.prisma backend/prisma/migrations
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): schéma Prisma + migration des tables security_*

Ajoute SecurityIpRule, SecurityTimeRule, SecurityBlockHistory et
leurs enums. Multi-tenant via companyId nullable (NULL = règle
plateforme). Aucune route ni middleware en Phase 1."
```

---

## Task 2 — Frontend : ajouter `'security-settings'` au type `PageType`

**Files:**
- Modify: `src/types/index.ts` (ligne 114 : type union `PageType`)

- [ ] **Step 2.1 — Ajouter la valeur au type**

Read `src/types/index.ts` ligne 114. Trouver le type `export type PageType = 'home' | 'configuration' | ... | 'codir-dashboard';` et ajouter `'security-settings'` à la fin de l'union :

```typescript
export type PageType = 'home' | 'configuration' | 'data-input' | 'upload' | 'manual-input' | 'analysis' | 'reports' | 'settings' | 'documentation' | 'clients' | 'credit-scoring' | 'credit-application' | 'workflow' | 'analytics' | 'bank-holidays-admin' | 'user-management' | 'approval-limits' | 'credit-simulation' | 'credit-types' | 'profile' | 'backup' | 'announcements' | 'notifications-config' | 'dispatching' | 'credit-policy' | 'workflow-builder' | 'company-settings' | 'platform-admin' | 'raci-matrix' | 'approvals' | 'contract-templates' | 'legal-step' | 'codir-dashboard' | 'security-settings';
```

- [ ] **Step 2.2 — Vérification TS frontend**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: aucun output.

- [ ] **Step 2.3 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/types/index.ts
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(types): ajoute 'security-settings' au type PageType"
```

---

## Task 3 — Frontend : 3 composants placeholders

**Files:**
- Create: `src/components/security/IPRulesTab.tsx`
- Create: `src/components/security/TimeRulesTab.tsx`
- Create: `src/components/security/BlockHistoryTab.tsx`

Tous trois sont des placeholders identiques en structure (texte différent). Pas de logique réelle — comportement implémenté en Phases 2/3/4.

- [ ] **Step 3.1 — IPRulesTab**

Créer `src/components/security/IPRulesTab.tsx` :

```tsx
import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { colors } from '../home/homeTokens';

export function IPRulesTab() {
  return (
    <Box sx={{ mt: 3 }}>
      <Alert
        severity="info"
        icon={<ConstructionOutlinedIcon />}
        sx={{ borderRadius: 2, bgcolor: colors.bg.surface, border: `1px solid ${colors.border.default}` }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Règles IP — bientôt disponible</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.text.secondary }}>
          Filtrage par adresse IP (whitelist / blacklist, IPv4 / IPv6 / CIDR) avec enforcement
          temps-réel via middleware. Disponible dans la prochaine mise à jour.
        </Typography>
      </Alert>
    </Box>
  );
}
```

- [ ] **Step 3.2 — TimeRulesTab**

Créer `src/components/security/TimeRulesTab.tsx` :

```tsx
import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { colors } from '../home/homeTokens';

export function TimeRulesTab() {
  return (
    <Box sx={{ mt: 3 }}>
      <Alert
        severity="info"
        icon={<ConstructionOutlinedIcon />}
        sx={{ borderRadius: 2, bgcolor: colors.bg.surface, border: `1px solid ${colors.border.default}` }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Plages horaires — bientôt disponible</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.text.secondary }}>
          Restriction d'accès par fenêtre horaire (timezone-aware), ciblage par branche /
          département / rôle / utilisateur. Disponible dans la prochaine mise à jour.
        </Typography>
      </Alert>
    </Box>
  );
}
```

- [ ] **Step 3.3 — BlockHistoryTab**

Créer `src/components/security/BlockHistoryTab.tsx` :

```tsx
import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { colors } from '../home/homeTokens';

export function BlockHistoryTab() {
  return (
    <Box sx={{ mt: 3 }}>
      <Alert
        severity="info"
        icon={<ConstructionOutlinedIcon />}
        sx={{ borderRadius: 2, bgcolor: colors.bg.surface, border: `1px solid ${colors.border.default}` }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Journal des blocages — bientôt disponible</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.text.secondary }}>
          Historique des accès refusés (IP blacklist, hors plage horaire, brute force), avec
          filtres, déblocage manuel et export CSV. Disponible dans la prochaine mise à jour.
        </Typography>
      </Alert>
    </Box>
  );
}
```

- [ ] **Step 3.4 — Vérification TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: aucun output.

- [ ] **Step 3.5 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/components/security
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): placeholders IPRulesTab + TimeRulesTab + BlockHistoryTab"
```

---

## Task 4 — Frontend : page `SecuritySettingsPage` + route + Sidebar

**Files:**
- Create: `src/pages/SecuritySettingsPage.tsx`
- Modify: `src/App.tsx` (ajouter la route)
- Modify: `src/components/Sidebar.tsx` (ajouter l'item de menu dans `configItems`)

- [ ] **Step 4.1 — Créer la page**

Créer `src/pages/SecuritySettingsPage.tsx` :

```tsx
import React, { useState } from 'react';
import { Alert, Box, Tabs, Tab, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { colors } from '../components/home/homeTokens';
import { IPRulesTab } from '../components/security/IPRulesTab';
import { TimeRulesTab } from '../components/security/TimeRulesTab';
import { BlockHistoryTab } from '../components/security/BlockHistoryTab';

interface Props {
  onNavigate: (page: PageType) => void;
}

export const SecuritySettingsPage: React.FC<Props> = () => {
  const { hasPermission } = useUser();
  const [tab, setTab] = useState(0);

  if (!hasPermission('manage_security')) {
    return (
      <Box sx={{ bgcolor: colors.bg.page, minHeight: '100%', p: { xs: 2, md: 4 } }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Accès réservé. Cette page nécessite le droit « manage_security ».
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: colors.bg.page, minHeight: '100%', p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <ShieldOutlinedIcon sx={{ color: colors.accent.primary, fontSize: 28 }} />
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: colors.text.primary }}>
          Paramètres de sécurité
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13.5, color: colors.text.secondary, mb: 3 }}>
        Règles IP, plages horaires d'accès et journal des blocages.
      </Typography>

      <Box sx={{ borderBottom: `1px solid ${colors.border.default}` }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13.5 },
            '& .Mui-selected': { color: `${colors.accent.primary} !important` },
            '& .MuiTabs-indicator': { backgroundColor: colors.accent.primary },
          }}
        >
          <Tab label="Règles IP" />
          <Tab label="Plages horaires" />
          <Tab label="Journal des blocages" />
        </Tabs>
      </Box>

      {tab === 0 && <IPRulesTab />}
      {tab === 1 && <TimeRulesTab />}
      {tab === 2 && <BlockHistoryTab />}
    </Box>
  );
};

export default SecuritySettingsPage;
```

- [ ] **Step 4.2 — Ajouter la route dans `App.tsx`**

Read `src/App.tsx` ligne 270-300 pour repérer le bloc `<Routes>` et l'import lazy d'une page admin proche (ex : `ConfigurationPage`).

Ajouter en haut du fichier, à côté des autres lazy imports :

```typescript
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage').then(m => ({ default: m.SecuritySettingsPage })));
```

Puis dans le bloc `<Routes>`, après la route `/configuration` (ligne 276 environ), ajouter :

```tsx
<Route path="/security-settings" element={<SecuritySettingsPage onNavigate={handlePageChange} />} />
```

- [ ] **Step 4.3 — Ajouter l'entrée Sidebar**

Read `src/components/Sidebar.tsx` aux alentours des lignes 164-173 (le bloc `configItems`). Ajouter en haut du fichier dans les imports d'icônes :

```typescript
import { ShieldOutlined as ShieldIcon } from '@mui/icons-material';
```

Puis dans la zone des gates de permission (vers ligne 133-143), ajouter :

```typescript
const canManageSecurity = hasPermission('manage_security') || isAdmin;
```

Puis dans le tableau `configItems` (ligne 165 environ), ajouter en dernière position avant le `]` fermant :

```typescript
...(canManageSecurity ? [{ id: 'security-settings' as PageType, label: 'Sécurité', icon: ShieldIcon }] : []),
```

- [ ] **Step 4.4 — Vérification TS**

Run: `cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit -p .`
Expected: aucun output.

- [ ] **Step 4.5 — Commit**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC add src/pages/SecuritySettingsPage.tsx src/App.tsx src/components/Sidebar.tsx
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC commit -m "feat(security): page SecuritySettingsPage + route + entrée Sidebar

Page parente avec garde de permission (manage_security, satisfait par
le wildcard '*' des admins). 3 onglets placeholders. Entrée 'Sécurité'
dans la section Configuration de la Sidebar."
```

---

## Task 5 — Smoke test manuel + push

**Files:** aucun.

- [ ] **Step 5.1 — Lancer back + front en dev**

```bash
# Terminal 1
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npm run dev
# Terminal 2
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run dev
```

- [ ] **Step 5.2 — Smoke test en ADMIN**

1. Se connecter avec un compte `ADMIN` ou `SUPER_ADMIN`.
2. Constater l'apparition de "Sécurité" dans la section Configuration de la Sidebar (avec l'icône bouclier).
3. Cliquer → la page s'affiche avec titre, sous-titre, 3 onglets.
4. Naviguer entre les 3 onglets → chaque panneau affiche son `Alert` "bientôt disponible" correspondant.

- [ ] **Step 5.3 — Smoke test en non-admin**

1. Se déconnecter, se reconnecter avec un compte `CHARGE_AFFAIRES` ou similaire.
2. Vérifier que "Sécurité" n'apparaît pas dans la Sidebar.
3. Tenter d'aller directement à `/security-settings` via l'URL → la page affiche l'Alert "Accès réservé. Cette page nécessite le droit « manage_security »".

- [ ] **Step 5.4 — Vérifier les tables en DB**

Run: `psql $DATABASE_URL -c "\dt security_*"` (ou un client SQL équivalent)
Expected: les 3 tables `security_ip_rules`, `security_time_rules`, `security_block_history` sont listées.

- [ ] **Step 5.5 — Push**

```bash
git -C /Users/fofana/Bitrix24/kaizen-b/kbsOC push origin release/v1.0
```

---

## Self-Review checklist

- **Spec §2 (schéma Prisma + enums)** → Task 1 (Steps 1.1 à 1.10).
- **Spec §3 (migration)** → Task 1 (Steps 1.7 à 1.9).
- **Spec §4 (permission `manage_security`)** → couvert implicitement par le wildcard `*` admin → Sidebar gate via `hasPermission('manage_security') || isAdmin` dans Task 4.3 (aucune data migration nécessaire).
- **Spec §5.1 (page shell + garde)** → Task 4.1.
- **Spec §5.2 (PageType)** → Task 2.
- **Spec §5.3 (route)** → Task 4.2.
- **Spec §5.4 (Sidebar)** → Task 4.3.
- **Spec §6 (vérifications)** → Task 5.

Aucun "TBD" ni "TODO". Tous les noms de classes, modèles et permissions sont identiques entre les tasks (`SecurityIpRule`, `SecurityTimeRule`, `SecurityBlockHistory`, `manage_security`, `security-settings`).
