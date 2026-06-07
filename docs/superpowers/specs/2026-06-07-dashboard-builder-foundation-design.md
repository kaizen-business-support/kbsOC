# Dashboard Builder — Sous-projet 1 : Foundation

**Date :** 2026-06-07
**Statut :** Approuvé
**Projet :** OptimusCredit — Module Constructeur de Rapports & Dashboards Dynamiques
**Sous-projet :** 1 / 4 — Foundation (DB Schema + Permissions + API + Frontend skeleton)

---

## Contexte

OptimusCredit est un SaaS bancaire SYSCOHADA multi-tenant (React + TypeScript + MUI, Express + Prisma + PostgreSQL). Ce sous-projet pose les bases du module Dashboard Builder inspiré d'ERPNext : schéma de données, permissions intégrées dans le système de rôles existant, API CRUD, et intégration dans la navigation.

La page `AnalyticsDashboardPage` (analytiques fixes) est remplacée par le nouveau module. Son contenu devient des templates globaux prédéfinis.

**Décomposition globale du module :**
1. **Foundation** ← ce spec
2. Widget Library + Data Sources
3. Dashboard Builder (éditeur drag & drop)
4. Templates avancés + Export PDF/Excel

---

## Décisions de conception

| Question | Décision |
|---|---|
| Coexistence avec les pages analytics existantes | `AnalyticsDashboardPage` remplacée ; contenu migré en templates |
| Permissions | Via `moduleRegistry.ts` existant — aucune table de permissions custom |
| Partage | Contrôle fin : VIEW ou EDIT, par utilisateur, rôle, ou company entière. `targetId` est toujours non-null (= companyId pour COMPANY) |
| Templates | Copie indépendante à l'application (pas de lien live au template) |
| Stockage layout | Hybride : `Dashboard.layout` = JSON positions react-grid-layout + `DashboardWidget` table pour les configs |

---

## 1. Schéma DB (Prisma)

### 1.1 `Dashboard`

```prisma
model Dashboard {
  id               String   @id @default(cuid())
  name             String
  description      String?
  companyId        String   @map("company_id")
  ownerId          String   @map("owner_id")
  isShared         Boolean  @default(false) @map("is_shared")
  layout           Json     // tableau react-grid-layout [{i, x, y, w, h}]
  templateSourceId String?  @map("template_source_id") // info seulement, pas de FK contrainte
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  company  Company           @relation(fields: [companyId], references: [id])
  owner    User              @relation(fields: [ownerId], references: [id])
  widgets  DashboardWidget[]
  shares   DashboardShare[]

  @@index([companyId])
  @@index([ownerId])
  @@map("dashboards")
}
```

### 1.2 `DashboardWidget`

```prisma
model DashboardWidget {
  id          String  @id @default(cuid())
  dashboardId String  @map("dashboard_id")
  type        String  // 'bar_chart' | 'line_chart' | 'pie_chart' | 'area_chart'
                      // | 'kpi_card' | 'table' | 'gauge'
  title       String
  config      Json    // source de données, filtres, couleurs, agrégation
  order       Int     @default(0)

  dashboard Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  @@index([dashboardId])
  @@map("dashboard_widgets")
}
```

Le champ `layout` de `Dashboard` contient les items react-grid-layout `{i: widgetId, x, y, w, h}`. `i` est l'`id` du `DashboardWidget` correspondant.

### 1.3 `DashboardShare`

```prisma
model DashboardShare {
  id          String   @id @default(cuid())
  dashboardId String   @map("dashboard_id")
  shareType   String   // 'USER' | 'ROLE' | 'COMPANY'
  targetId    String   @map("target_id")
  // USER  → userId
  // ROLE  → nom du rôle (ex: 'ANALYSTE_RISQUES')
  // COMPANY → companyId (jamais null — évite l'ambiguïté NULL != NULL en PostgreSQL)
  permission  String   // 'VIEW' | 'EDIT'
  createdAt   DateTime @default(now()) @map("created_at")

  dashboard Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  @@unique([dashboardId, shareType, targetId])
  @@index([dashboardId])
  @@map("dashboard_shares")
}
```

### 1.4 `DashboardTemplate`

```prisma
model DashboardTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  companyId   String?  @map("company_id") // null = template global (SUPER_ADMIN)
  isGlobal    Boolean  @default(false) @map("is_global")
  layout      Json     // même structure que Dashboard.layout
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company  Company?                  @relation(fields: [companyId], references: [id])
  widgets  DashboardTemplateWidget[]

  @@index([companyId])
  @@map("dashboard_templates")
}
```

### 1.5 `DashboardTemplateWidget`

```prisma
model DashboardTemplateWidget {
  id         String @id @default(cuid())
  templateId String @map("template_id")
  type       String
  title      String
  config     Json
  order      Int    @default(0)

  template DashboardTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@map("dashboard_template_widgets")
}
```

---

## 2. Permissions (moduleRegistry)

Ajout dans `src/config/moduleRegistry.ts`, dans `MODULE_REGISTRY` (avant `superAdminOnly` blocks) :

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

### Droits par défaut (seed de migration)

| Rôle | Actions accordées |
|---|---|
| VIEWER | *(aucune — voit uniquement les dashboards explicitement partagés avec lui)* |
| CHARGE_AFFAIRES / ANALYSTE_RISQUES | `create`, `edit`, `delete`, `share`, `export`, `templates_use` |
| RESPONSABLE_RISQUES / RESPONSABLE_ENGAGEMENTS / COMITE_CREDIT / BACK_OFFICE | `create`, `edit`, `delete`, `share`, `export`, `templates_use` |
| DIRECTION_GENERALE / ADMIN | + `manage`, `templates_create` |
| SUPER_ADMIN | Tout + templates globaux (`companyId = null`) |

Ces droits sont injectés via la migration seed dans `moduleProfileApi`. Le `RoleProfileEditor` existant affiche automatiquement la section "Dashboards & Rapports" sans modification de l'UI.

---

## 3. API Endpoints

Tous les handlers vérifient `dashboard.companyId === user.activeCompanyId`. Un SUPER_ADMIN peut lire tous les dashboards en lecture seule via son panel admin — jamais écrire sur une autre company.

### 3.1 Dashboards

```
GET    /api/dashboards
       → liste : mes dashboards (ownerId) + ceux partagés avec moi (VIEW ou EDIT)
       Query params : ?shared=true|false, ?page, ?limit

POST   /api/dashboards
       → créer un dashboard vide
       Permission : canAction('dashboard-builder', 'create')
       Body : { name, description? }

GET    /api/dashboards/:id
       → dashboard complet avec widgets[] et shares[]
       Accès : owner | share VIEW/EDIT | permission manage

PUT    /api/dashboards/:id
       → mettre à jour name, description, layout (positions)
       Accès : owner | share EDIT | permission manage

DELETE /api/dashboards/:id
       → supprimer dashboard + widgets + shares (cascade DB)
       Accès : owner | permission manage
```

### 3.2 Widgets

```
POST   /api/dashboards/:id/widgets
       → ajouter un widget ; retourne widget créé + layout mis à jour
       Body : { type, title, config, position: {x, y, w, h} }

PUT    /api/dashboards/:id/widgets/:wid
       → modifier type, title, config
       Body : { type?, title?, config? }

DELETE /api/dashboards/:id/widgets/:wid
       → supprimer widget + retirer son entrée du layout
```

### 3.3 Partage

```
GET    /api/dashboards/:id/shares
       → liste des partages actifs

POST   /api/dashboards/:id/shares
       → ajouter un partage
       Permission : canAction('dashboard-builder', 'share')
       Body : { shareType, targetId?, permission }

PUT    /api/dashboards/:id/shares/:sid
       → changer VIEW ↔ EDIT
       Body : { permission }

DELETE /api/dashboards/:id/shares/:sid
       → révoquer un partage
```

### 3.4 Templates

```
GET    /api/dashboard-templates
       → templates globaux (isGlobal=true) + templates de la company courante
       Permission : canAction('dashboard-builder', 'templates_use')

POST   /api/dashboard-templates
       → créer un template
       ADMIN → companyId = activeCompanyId, isGlobal = false
       SUPER_ADMIN → peut passer isGlobal = true (companyId = null)
       Permission : canAction('dashboard-builder', 'templates_create')

PUT    /api/dashboard-templates/:id
       → modifier (même règles d'accès que POST)

DELETE /api/dashboard-templates/:id
       → supprimer

POST   /api/dashboard-templates/:id/apply
       → crée un nouveau Dashboard copie indépendante du template
       Permission : canAction('dashboard-builder', 'templates_use')
       Retourne : le Dashboard créé
```

---

## 4. Intégration Frontend

### 4.1 moduleRegistry.ts

Ajout du module `dashboard-builder` (voir Section 2). Aucune autre modification.

### 4.2 Sidebar.tsx

La section "Tableau de bord" devient :

```
Tableau de bord
  ├── Accueil                    (id: 'home')           — inchangé
  ├── Mes Dashboards             (id: 'dashboard-builder') — NOUVEAU
  ├── Tableau de Bord CODIR      (id: 'codir-dashboard') — inchangé
  └── Rapports de Crédit         (id: 'credit-reports') — inchangé
```

L'entrée `analytics` est supprimée. Guard : `canAccess('dashboard-builder')`.

### 4.3 App.tsx

- Route `analytics` → supprimée (import `AnalyticsDashboardPage` retiré)
- Route `dashboard-builder` ajoutée :
  ```tsx
  <ProtectedRoute moduleKey="dashboard-builder">
    <DashboardsPage />
  </ProtectedRoute>
  ```

### 4.4 Migration de AnalyticsDashboardPage

Le fichier `src/pages/AnalyticsDashboardPage.tsx` est supprimé. Son contenu analytique est converti en **3 templates globaux** insérés via seed Prisma :

| Template | Contenu |
|---|---|
| "Suivi Portefeuille" | Dossiers par statut, montants engagés, délais de traitement |
| "Performance Mensuelle" | Évolution mensuelle CA, taux d'approbation, volume nouveaux dossiers |
| "Conformité BCEAO" | Ratios normatifs, alertes de dépassement |

Ces templates sont globaux (`isGlobal: true`, `companyId: null`) et visibles par toutes les companies.

### 4.5 DashboardsPage.tsx (skeleton)

Page minimale livrable dans cette Foundation :

```
┌─────────────────────────────────────────────────────┐
│  Mes Dashboards                    [+ Nouveau] [Templates]  │
├─────────────────────────────────────────────────────┤
│  [Onglet: Mes dashboards] [Onglet: Partagés avec moi]       │
├─────────────────────────────────────────────────────┤
│  Cards des dashboards existants (nom, date, owner)          │
│  → click → placeholder "Éditeur disponible bientôt"        │
└─────────────────────────────────────────────────────┘
```

Comportements :
- `[+ Nouveau]` : dialog de création (nom + description) → appel `POST /api/dashboards`
- `[Templates]` : dialog de liste des templates → appel `POST /api/dashboard-templates/:id/apply`
- Affichage conditionnel des boutons selon permissions `create` / `templates_use`

---

## Périmètre de ce sous-projet

**Inclus :**
- Migration Prisma (4 nouveaux modèles)
- Seed des 3 templates globaux
- Ajout module dans `moduleRegistry.ts`
- Injection des droits par défaut dans les profils de rôles existants
- 15 endpoints API backend
- Sidebar + routing + `DashboardsPage` skeleton
- Suppression de `AnalyticsDashboardPage`

**Exclu (sous-projets suivants) :**
- Composants widgets (sous-projet 2)
- Couche data sources (sous-projet 2)
- Éditeur drag & drop react-grid-layout (sous-projet 3)
- Export PDF/Excel (sous-projet 4)
- Templates avancés et UI de gestion des templates (sous-projet 4)
