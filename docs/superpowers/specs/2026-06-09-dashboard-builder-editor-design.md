# Dashboard Builder — Sous-projet 3 : Éditeur Drag & Drop

**Date :** 2026-06-09
**Statut :** Approuvé
**Projet :** OptimusCredit — Module Constructeur de Rapports & Dashboards Dynamiques
**Sous-projet :** 3 / 4 — Éditeur Drag & Drop

---

## Contexte

Le sous-projet 2 (Widget Library + Data Sources) a livré :
- 5 composants widgets recharts (kpi_card, bar_chart, line_chart, gauge, table)
- `WidgetContainer` (fetch + dispatch)
- `DashboardViewPage` en lecture seule (grille MUI statique)
- Endpoint `GET /api/widget-data`

Ce sous-projet ajoute l'édition interactive : drag & drop des widgets, ajout/suppression/reconfiguration, avec auto-save du layout.

**Décomposition globale du module :**
1. Foundation ✅
2. Widget Library + Data Sources ✅
3. **Éditeur Drag & Drop** ← ce spec
4. Templates avancés + Export PDF/Excel

---

## Décisions de conception

| Question | Décision |
|---|---|
| Mode édition | Toggle inline sur `DashboardViewPage` — bouton bascule lecture/édition |
| Ajout de widget | Panneau latéral (MUI Drawer, anchor=right, 360px) |
| Formulaire config | Progressif : champs essentiels toujours visibles + section "Options avancées" repliable |
| Sauvegarde layout | Auto-save avec debounce 800ms + badge "Modifications non sauvegardées" + bouton "Annuler" |

---

## 1. Backend

**Aucun nouvel endpoint nécessaire.** Tous les endpoints requis existent déjà depuis le sous-projet 1 :

| Endpoint | Usage |
|---|---|
| `PUT /api/dashboards/:id` | Sauvegarde du layout (`{ layout }`) |
| `POST /api/dashboards/:id/widgets` | Ajout d'un widget |
| `PUT /api/dashboards/:id/widgets/:wid` | Mise à jour config + titre d'un widget |
| `DELETE /api/dashboards/:id/widgets/:wid` | Suppression d'un widget |

**3 méthodes à ajouter dans `src/services/api.ts` :**

```typescript
static async addWidget(dashboardId: string, data: {
  type: string; title: string; config: Record<string, any>
}): Promise<ApiResponse<{ widget: DashboardWidget; layout: any[] }>>

static async updateWidget(dashboardId: string, widgetId: string, data: {
  title?: string; config?: Record<string, any>
}): Promise<ApiResponse<DashboardWidget>>

static async deleteWidget(dashboardId: string, widgetId: string): Promise<ApiResponse<void>>
```

---

## 2. Librairie drag & drop

**`react-grid-layout`** — à installer :

```bash
npm install react-grid-layout
npm install --save-dev @types/react-grid-layout
```

Format du layout (déjà dans le schéma Prisma) :
```typescript
type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
```

**Tailles par défaut selon le type de widget :**

| Type | w | h |
|---|---|---|
| kpi_card | 3 | 2 |
| bar_chart | 6 | 4 |
| line_chart | 6 | 4 |
| gauge | 3 | 4 |
| table | 8 | 5 |

Grille : 12 colonnes, rowHeight=80px, compactType="vertical".

---

## 3. Structure des fichiers frontend

```
src/components/dashboard/
  ├── DashboardEditorGrid.tsx   — react-grid-layout wrapper (mode édition)
  ├── WidgetDrawer.tsx          — MUI Drawer latéral (ajout + édition widget)
  ├── WidgetConfigForm.tsx      — formulaire progressif de configuration
  ├── WidgetContainer.tsx       — existant (sub-projet 2, inchangé)
  ├── DashboardPeriodSelector.tsx — existant (sub-projet 2, inchangé)
  ├── index.ts                  — à mettre à jour avec 3 nouveaux exports
  └── widgets/                  — existant (sub-projet 2, inchangé)

src/pages/
  └── DashboardViewPage.tsx     — modifier : toggle edit mode + unsaved indicator
```

---

## 4. Composants détaillés

### 4.1 `DashboardEditorGrid`

```typescript
interface DashboardEditorGridProps {
  widgets: DashboardWidget[];
  layout: LayoutItem[];
  globalPeriod: Period;
  onLayoutChange: (layout: LayoutItem[]) => void;
  onDeleteWidget: (widgetId: string) => void;
  onEditWidget: (widget: DashboardWidget) => void;
}
```

- Utilise `<ReactGridLayout>` avec `isDraggable`, `isResizable`, `cols={12}`, `rowHeight={80}`
- Chaque cellule contient un `WidgetContainer` + overlay en mode édition avec :
  - Icône `×` (suppression) en haut à droite
  - Icône `✏️` (reconfiguration) en haut à gauche
  - Curseur `grab` pour indiquer le drag
- Sur `onLayoutChange(newLayout)` → appelle `props.onLayoutChange(newLayout)`
- Import CSS : `import 'react-grid-layout/css/styles.css'` et `import 'react-resizable/css/styles.css'`

### 4.2 `WidgetDrawer`

```typescript
interface WidgetDrawerProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  editingWidget: DashboardWidget | null;  // null = mode ajout
  onWidgetAdded: (widget: DashboardWidget, newLayout: any[]) => void;
  onWidgetUpdated: (widget: DashboardWidget) => void;
}
```

- MUI `Drawer` anchor="right", largeur 360px
- Titre : "Ajouter un widget" ou "Modifier le widget"
- Contient `WidgetConfigForm`
- Bouton "Ajouter" / "Enregistrer" → appelle `ApiService.addWidget` ou `ApiService.updateWidget`
- Gère loading state du bouton

### 4.3 `WidgetConfigForm`

```typescript
interface WidgetConfigFormProps {
  initialValues?: Partial<WidgetFormValues>;
  onSubmit: (values: WidgetFormValues) => void;
  loading?: boolean;
}

interface WidgetFormValues {
  title: string;
  type: 'kpi_card' | 'bar_chart' | 'line_chart' | 'gauge' | 'table';
  source: 'applications' | 'clients' | 'analytics';
  metric: string;
  // Options avancées
  groupBy?: 'month' | 'status' | 'branch';
  filterStatus?: string;
  periodOverride?: Period;
  colorScheme?: 'blue' | 'green' | 'orange' | 'red';
  color?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
  limit?: number;
}
```

**Champs de base (toujours visibles) :**
- `titre` — TextField
- `type` — Select avec 5 options
- `source` — Select dont les options dépendent du type :
  - kpi_card : applications, clients, analytics
  - bar_chart / line_chart : applications
  - gauge : analytics
  - table : applications, clients
- `metric` — Select dont les options dépendent de source :
  - applications : count, sum_amount, approval_rate, avg_processing_time, list (table seulement)
  - clients : count, list (table seulement)
  - analytics : approval_rate, npl_ratio, solvency_ratio, liquidity_ratio

**Section "Options avancées" (MUI Accordion, replié par défaut) :**
- `groupBy` — visible si type = bar_chart ou line_chart
- `filterStatus` — visible si source = applications
- `periodOverride` — toujours visible dans la section avancée
- `colorScheme` — visible si type = kpi_card (select : blue/green/orange/red)
- `color` — visible si type = bar_chart ou line_chart (ColorPicker simplifié : 6 couleurs prédéfinies)
- `thresholdWarning` / `thresholdCritical` — visible si type = gauge (NumberField)
- `limit` — visible si metric = list (NumberField, défaut 10)

**Règles de dépendances :**
- Quand `type` change → reset `source` et `metric`
- Quand `source` change → reset `metric`

### 4.4 Modifications de `DashboardViewPage`

**Nouveaux états :**
```typescript
const [isEditMode, setIsEditMode] = useState(false);
const [layoutSnapshot, setLayoutSnapshot] = useState<LayoutItem[]>([]);
const [pendingLayout, setPendingLayout] = useState<LayoutItem[]>([]);
const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
const [drawerOpen, setDrawerOpen] = useState(false);
const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
```

**Bouton "Modifier" :** visible si `dashboard.ownerId === currentUser.id` ou share avec permission EDIT. Utilise `useAuth` pour obtenir `currentUser`.

**Toggle edit mode :**
- Entrée : `setLayoutSnapshot(dashboard.layout)` + `setPendingLayout(dashboard.layout)` + `setIsEditMode(true)`
- Sortie (Annuler) : `setPendingLayout(layoutSnapshot)` + `setIsEditMode(false)` — pas d'appel API

**Auto-save layout :**
```typescript
useEffect(() => {
  if (!isEditMode || saveStatus === 'saved') return;
  const timer = setTimeout(async () => {
    setSaveStatus('saving');
    await ApiService.updateDashboard(id, { layout: pendingLayout });
    setSaveStatus('saved');
  }, 800);
  return () => clearTimeout(timer);
}, [pendingLayout]);
```

**Suppression widget avec undo :**
- Suppression optimiste : retire le widget du state local immédiatement
- Snackbar "Widget supprimé" avec bouton "Annuler" pendant 4s
- Si "Annuler" cliqué → restaure le widget localement (pas de re-fetch)
- Si timeout → confirme la suppression via `ApiService.deleteWidget`

**Rendu conditionnel :**
- Mode lecture : MUI Grid statique (existant) avec `WidgetContainer`
- Mode édition : `DashboardEditorGrid` + FAB "+" en bas à droite + `WidgetDrawer`

---

## 5. Indicateur de sauvegarde

Dans le header de `DashboardViewPage` en mode édition :

```
[← Retour]  Nom du Dashboard           [Période]  [• Non sauvegardé]  [Annuler]  [Modifier ▼]
```

- `saveStatus === 'unsaved'` → chip orange "• Non sauvegardé"
- `saveStatus === 'saving'` → `<CircularProgress size={14} />` + "Sauvegarde..."
- `saveStatus === 'saved'` → chip vert "✓ Sauvegardé" (disparaît après 2s)

---

## 6. Dépendances des options de config

### Source disponible selon le type de widget

| Type | Sources |
|---|---|
| kpi_card | applications, clients, analytics |
| bar_chart | applications |
| line_chart | applications |
| gauge | analytics |
| table | applications, clients |

### Metric disponible selon la source

| Source | Metrics |
|---|---|
| applications | count, sum_amount, approval_rate, avg_processing_time, list* |
| clients | count, list* |
| analytics | approval_rate, npl_ratio, solvency_ratio, liquidity_ratio |

*`list` uniquement si type = table

---

## 7. Tests

**Backend :** Aucun nouveau test nécessaire (aucun nouvel endpoint).

**Frontend — 3 nouvelles méthodes ApiService :**
- `addWidget` : appelle `POST /dashboards/:id/widgets`, retourne `{ widget, layout }`
- `updateWidget` : appelle `PUT /dashboards/:id/widgets/:wid`
- `deleteWidget` : appelle `DELETE /dashboards/:id/widgets/:wid`

Ces méthodes suivent le même pattern que les autres méthodes ApiService (try/catch, `res.data`). Pas de tests unitaires séparés — couverture suffisante via les tests d'intégration existants sur les routes backend.

---

## 8. Périmètre

**Inclus :**
- Installation `react-grid-layout`
- 3 nouvelles méthodes ApiService (addWidget, updateWidget, deleteWidget)
- `DashboardEditorGrid` — grille draggable/resizable
- `WidgetDrawer` — panneau latéral ajout/édition
- `WidgetConfigForm` — formulaire progressif avec dépendances
- Modifications `DashboardViewPage` — toggle, auto-save, FAB, indicator
- Export `index.ts` mis à jour

**Exclu (sous-projet 4) :**
- Export PDF/Excel
- Gestion avancée des templates (création depuis un dashboard existant)
- Partage avancé de dashboard
