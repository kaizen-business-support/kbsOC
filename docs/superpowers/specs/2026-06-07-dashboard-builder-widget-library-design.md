# Dashboard Builder — Sous-projet 2 : Widget Library + Data Sources

**Date :** 2026-06-07
**Statut :** Approuvé
**Projet :** OptimusCredit — Module Constructeur de Rapports & Dashboards Dynamiques
**Sous-projet :** 2 / 4 — Widget Library + Data Sources

---

## Contexte

Le sous-projet 1 (Foundation) a posé les bases : schéma DB, permissions, API CRUD dashboards/templates, page skeleton. Les widgets sont stockés en base (`DashboardWidget.config` JSON) mais aucun composant ne les rend encore.

Ce sous-projet livre :
1. **Backend** : endpoint unifié `GET /api/widget-data` + service métier par source
2. **Frontend** : 5 composants widgets + `WidgetContainer` + `DashboardPeriodSelector`
3. **Vue détail dashboard** : clic sur une card → affichage lecture seule des widgets réels

**Décomposition globale du module :**
1. Foundation ✅
2. **Widget Library + Data Sources** ← ce spec
3. Dashboard Builder (éditeur drag & drop)
4. Templates avancés + Export PDF/Excel

---

## Décisions de conception

| Question | Décision |
|---|---|
| Types de widgets | `kpi_card`, `bar_chart`, `line_chart`, `gauge`, `table` (applications ou clients) |
| Architecture frontend | Container / Presenter — `WidgetContainer` gère fetch + états, widgets = pure renderers |
| Endpoint data | Endpoint unifié `GET /api/widget-data` — découplé des endpoints existants |
| Période | Sélecteur global sur le dashboard + override optionnel par widget dans sa config |
| Vue détail | Lecture seule pour ce sous-projet — le drag & drop est sub-projet 3 |

---

## 1. Backend : endpoint unifié + service

### 1.1 Nouveau fichier : `backend/src/routes/widget-data.ts`

```
GET /api/widget-data
  ?source=applications|clients|analytics
  &metric=count|sum_amount|approval_rate|avg_processing_time|trend|npl_ratio|solvency_ratio|liquidity_ratio|list
  &groupBy=status|month|branch|manager        (optionnel)
  &period=this_month|this_quarter|this_year|last_6_months|last_12_months
  &filter[status]=APPROVED                    (optionnel, répétable)
  &limit=10                                   (optionnel, pour table)
```

**Réponse unifiée :**
```json
{
  "success": true,
  "data": {
    "value": 42,
    "trend": 5.2,
    "label": "Dossiers en cours",
    "series": [{ "name": "Jan", "value": 12 }, { "name": "Fév", "value": 18 }],
    "rows": [],
    "columns": []
  },
  "period": { "from": "2026-01-01", "to": "2026-06-30" }
}
```

- `value` + `trend` : remplis pour `kpi_card` et `gauge`
- `series` : rempli pour `bar_chart` et `line_chart`
- `rows` + `columns` : remplis pour `table`
- `trend` : variation en % par rapport à la période précédente équivalente (ex: `this_month` → compare au mois précédent)

### 1.2 Service : `backend/src/services/widgetDataService.ts`

Contient toute la logique métier, testable indépendamment du routing.

**Fonction principale :**
```typescript
export async function getWidgetData(params: WidgetDataParams, companyId: string): Promise<WidgetDataResult>
```

**Sources implémentées :**

#### Source `applications`

| metric | description |
|---|---|
| `count` | Nombre de dossiers (avec filtre status optionnel) |
| `sum_amount` | Somme des montants demandés |
| `approval_rate` | % de dossiers approuvés / total traités |
| `avg_processing_time` | Délai moyen en jours (créé → décision) |
| `list` | Liste paginée (pour table) |

Avec `groupBy=month` → agrégation par mois sur la période, retourne `series`.
Avec `groupBy=status` → répartition par statut, retourne `series`.
Avec `groupBy=branch` → performance par agence, retourne `series`.

**Calcul trend :** Pour `this_month`, compare au mois précédent. Pour `this_quarter`, compare au trimestre précédent. Pour `this_year`, compare à l'année précédente. Pour `last_6_months` / `last_12_months`, compare aux 6/12 mois précédents.

#### Source `clients`

| metric | description |
|---|---|
| `count` | Nombre de clients actifs |
| `list` | Liste paginée avec colonnes configurables |

#### Source `analytics`

| metric | description |
|---|---|
| `solvency_ratio` | Ratio de solvabilité (%) |
| `liquidity_ratio` | Ratio de liquidité (%) |
| `npl_ratio` | Créances douteuses (%) |
| `approval_rate` | Taux d'approbation global |

Ces métriques réutilisent les calculs existants dans `analytics.ts`.

### 1.3 Enregistrement dans `server.ts`

```typescript
import widgetDataRoutes from './routes/widget-data';
app.use('/api/widget-data', ...protect, widgetDataRoutes);
```

---

## 2. Contrats de config par type de widget

Chaque widget lit sa config depuis `DashboardWidget.config` (JSON stocké en base).

```typescript
// kpi_card
interface KpiCardConfig {
  source: 'applications' | 'clients' | 'analytics';
  metric: 'count' | 'sum_amount' | 'approval_rate' | 'avg_processing_time' | 'npl_ratio' | 'solvency_ratio' | 'liquidity_ratio';
  filter?: { status?: string; branch?: string };
  periodOverride?: Period;
  colorScheme?: 'blue' | 'green' | 'orange' | 'red';
}

// bar_chart
interface BarChartConfig {
  source: 'applications';
  metric: 'count' | 'sum_amount';
  groupBy: 'status' | 'month' | 'branch' | 'manager';
  periodOverride?: Period;
  colorScheme?: string;
}

// line_chart
interface LineChartConfig {
  source: 'applications';
  metric: 'count' | 'sum_amount' | 'approval_rate';
  groupBy: 'month';
  periodOverride?: Period;
}

// gauge
interface GaugeConfig {
  source: 'analytics';
  metric: 'solvency_ratio' | 'liquidity_ratio' | 'npl_ratio';
  threshold: { warning: number; critical: number };
  maxValue?: number; // défaut 100
}

// table — applications
interface TableApplicationsConfig {
  source: 'applications';
  columns: Array<'client' | 'amount' | 'status' | 'date' | 'branch' | 'manager'>;
  filter?: { status?: string };
  limit?: number; // défaut 10
  periodOverride?: Period;
}

// table — clients
interface TableClientsConfig {
  source: 'clients';
  columns: Array<'name' | 'outstanding' | 'score' | 'applications' | 'branch'>;
  limit?: number; // défaut 10
}

type Period = 'this_month' | 'this_quarter' | 'this_year' | 'last_6_months' | 'last_12_months';
```

---

## 3. Frontend : architecture des composants

### 3.1 Structure de fichiers

```
src/components/dashboard/
  ├── WidgetContainer.tsx          — fetch API + loading + error + dispatch widget
  ├── DashboardPeriodSelector.tsx  — sélecteur global de période (MUI Select)
  ├── widgets/
  │   ├── KpiCardWidget.tsx        — valeur + trend (↑↓) + icône colorée
  │   ├── BarChartWidget.tsx       — recharts BarChart + ResponsiveContainer
  │   ├── LineChartWidget.tsx      — recharts LineChart + ResponsiveContainer
  │   ├── GaugeWidget.tsx          — recharts RadialBarChart + seuils colorés
  │   └── TableWidget.tsx          — MUI Table + colonnes dynamiques
  └── index.ts                     — re-exports
```

### 3.2 WidgetContainer

```typescript
interface WidgetContainerProps {
  widget: DashboardWidget;        // config + type depuis la DB
  globalPeriod: Period;           // période globale du dashboard
  height?: number;                // hauteur en pixels (pour react-grid-layout, sub-projet 3)
}
```

Logique :
1. Construit les query params depuis `widget.config` + `globalPeriod`
2. Appelle `GET /api/widget-data?...` via `ApiService.getWidgetData(params)`
3. Affiche un `CircularProgress` centré pendant le chargement
4. Affiche une `Alert severity="error"` si erreur
5. Dispatch le bon composant selon `widget.type`

### 3.3 Composants widgets

**`KpiCardWidget`**
- Card MUI avec titre, valeur principale (Typography h3 bold), badge trend (vert si positif, rouge si négatif, format `+5.2%`)
- Icône colorée selon `colorScheme` (bleu par défaut)
- Si `data.trend` est absent → pas de badge

**`BarChartWidget`**
- `recharts BarChart` + `ResponsiveContainer` (width="100%" height={height-60})
- Axes X/Y avec formatage des valeurs (montants en K XOF si > 1000)
- Tooltip customisé

**`LineChartWidget`**
- `recharts LineChart` + `ResponsiveContainer`
- Ligne lissée (`type="monotone"`)
- Dot sur les points de données

**`GaugeWidget`**
- `recharts RadialBarChart` avec un seul arc
- Couleur dynamique selon les seuils : vert (OK), orange (warning), rouge (critical)
- Valeur en % au centre + label du seuil actif

**`TableWidget`**
- `MUI Table` (compact) avec colonnes dynamiques selon `config.columns`
- Chip coloré pour la colonne `status` (même mapping couleur que l'app existante)
- Pagination simple (10 lignes, boutons Précédent/Suivant)

### 3.4 DashboardPeriodSelector

```typescript
interface DashboardPeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}
```

MUI `Select` avec options :
- `this_month` → "Ce mois"
- `this_quarter` → "Ce trimestre"
- `this_year` → "Cette année"
- `last_6_months` → "6 derniers mois"
- `last_12_months` → "12 derniers mois"

---

## 4. Vue détail dashboard (lecture seule)

### 4.1 Nouvelle page : `src/pages/DashboardViewPage.tsx`

Route : `/dashboard-builder/:id`

La page :
1. Charge le dashboard complet (`GET /api/dashboards/:id`) — widgets + layout
2. Affiche `DashboardPeriodSelector` en haut
3. Rend chaque `DashboardWidget` dans un `WidgetContainer` positionné selon `dashboard.layout`
4. Pour ce sous-projet : layout fixe en grille CSS (pas de drag & drop — c'est sub-projet 3)

**Layout de fallback :** Si `dashboard.layout` est vide, les widgets sont affichés en grid MUI `xs=12 sm=6 md=4`.

### 4.2 Mise à jour DashboardsPage

Sur le clic d'une card dashboard → `navigate('/dashboard-builder/:id')` au lieu du placeholder actuel.

### 4.3 Mise à jour App.tsx

```tsx
<Route path="/dashboard-builder/:id" element={
  <ProtectedRoute moduleKey="dashboard-builder">
    <DashboardViewPage />
  </ProtectedRoute>
} />
```

---

## 5. ApiService : nouvelle méthode

Dans `src/services/api.ts`, ajouter :

```typescript
static async getWidgetData(params: {
  source: string;
  metric: string;
  groupBy?: string;
  period: string;
  filter?: Record<string, string>;
  limit?: number;
}): Promise<ApiResponse<WidgetDataResult>> {
  try {
    const res = await api.get('/widget-data', { params });
    return res.data;
  } catch (e: any) {
    return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
  }
}
```

Ajouter l'interface `WidgetDataResult` dans `src/types/index.ts` :

```typescript
export interface WidgetDataResult {
  value?: number;
  trend?: number;
  label?: string;
  series?: Array<{ name: string; value: number; [key: string]: any }>;
  rows?: Record<string, any>[];
  columns?: Array<{ key: string; label: string }>;
}
```

---

## 6. Tests

### Backend (TDD)

**`backend/src/__tests__/widgetDataRoute.test.ts`**

Cas à couvrir :
- `GET /api/widget-data?source=applications&metric=count&period=this_month` → retourne `{ value: N, trend: N }`
- `GET /api/widget-data?source=applications&metric=count&groupBy=month&period=last_6_months` → retourne `{ series: [...] }`
- `GET /api/widget-data?source=applications&metric=list&period=this_month` → retourne `{ rows: [...], columns: [...] }`
- `GET /api/widget-data?source=clients&metric=list` → retourne `{ rows: [...], columns: [...] }`
- 400 si `source` manquant
- 400 si `metric` invalide pour la `source`
- 403 sans companyId

**`backend/src/__tests__/widgetDataService.test.ts`**

Teste la logique métier en isolation (mock Prisma) :
- Calcul correct du trend (période courante vs période précédente)
- Agrégation groupBy=month sur 6 mois
- Calcul du ratio solvabilité / liquidité

### Frontend

Pas de tests unitaires pour les composants widgets dans ce sous-projet (les composants recharts sont difficiles à tester en isolation sans jsdom avancé). Tests manuels suffisants pour la Foundation.

---

## Périmètre de ce sous-projet

**Inclus :**
- Endpoint `GET /api/widget-data` + service `widgetDataService`
- 5 composants widgets (KpiCard, BarChart, LineChart, Gauge, Table)
- `WidgetContainer` + `DashboardPeriodSelector`
- `DashboardViewPage` (vue lecture seule)
- Navigation DashboardsPage → DashboardViewPage
- `ApiService.getWidgetData()` + interface `WidgetDataResult`

**Exclu (sous-projets suivants) :**
- Éditeur drag & drop (sous-projet 3)
- Formulaire de configuration des widgets (sous-projet 3)
- Export PDF/Excel (sous-projet 4)
- Gestion des templates avancée (sous-projet 4)
