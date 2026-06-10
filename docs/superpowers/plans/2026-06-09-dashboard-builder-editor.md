# Dashboard Builder — Éditeur Drag & Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un éditeur interactif drag & drop sur `DashboardViewPage` permettant de repositionner/redimensionner, ajouter, reconfigurer et supprimer des widgets avec auto-save du layout.

**Architecture:** `DashboardEditorGrid` encapsule `react-grid-layout` pour le drag & drop ; `WidgetDrawer` + `WidgetConfigForm` forment le panneau latéral de création/édition. `DashboardViewPage` gère le toggle lecture/édition, l'auto-save debounce 800ms, et le delete optimiste avec undo 4s.

**Tech Stack:** React + TypeScript, MUI v5, react-grid-layout, recharts (déjà installé), Axios via `ApiService`

---

## Fichiers

| Chemin | Action |
|---|---|
| `src/services/api.ts` | Modifier — ajouter `addWidget`, `updateWidget`, `deleteWidget` après `getWidgetData` (ligne 1882) |
| `src/components/dashboard/DashboardEditorGrid.tsx` | Créer |
| `src/components/dashboard/WidgetConfigForm.tsx` | Créer |
| `src/components/dashboard/WidgetDrawer.tsx` | Créer |
| `src/pages/DashboardViewPage.tsx` | Réécrire — toggle edit + auto-save + FAB + WidgetDrawer |
| `src/components/dashboard/index.ts` | Modifier — ajouter 3 exports |

---

### Task 1: Installer react-grid-layout + ajouter 3 méthodes ApiService

**Files:**
- Modify: `src/services/api.ts:1882-1883`

- [ ] **Step 1: Installer les dépendances**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npm install react-grid-layout
npm install --save-dev @types/react-grid-layout
```

Résultat attendu : `added X packages` sans erreur. `node_modules/react-grid-layout` et `node_modules/@types/react-grid-layout` créés.

- [ ] **Step 2: Ajouter les 3 méthodes dans `src/services/api.ts`**

Après la fermeture de `getWidgetData` (ligne 1882, la `}` qui ferme la méthode), avant la ligne `static security = {`, insérer :

```typescript
  static async addWidget(
    dashboardId: string,
    data: { type: string; title: string; config: Record<string, any>; position?: { x: number; y: number; w: number; h: number } }
  ): Promise<ApiResponse<{ widget: DashboardWidget; layout: any[] }>> {
    try {
      const res = await api.post(`/dashboards/${dashboardId}/widgets`, data);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async updateWidget(
    dashboardId: string,
    widgetId: string,
    data: { title?: string; config?: Record<string, any> }
  ): Promise<ApiResponse<DashboardWidget>> {
    try {
      const res = await api.put(`/dashboards/${dashboardId}/widgets/${widgetId}`, data);
      return res.data;
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

  static async deleteWidget(dashboardId: string, widgetId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
    }
  }

```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts package.json package-lock.json
git commit -m "feat(frontend): install react-grid-layout and add widget CRUD to ApiService"
```

---

### Task 2: Créer `DashboardEditorGrid.tsx`

**Files:**
- Create: `src/components/dashboard/DashboardEditorGrid.tsx`

- [ ] **Step 1: Créer le fichier**

```typescript
// src/components/dashboard/DashboardEditorGrid.tsx
import React from 'react';
import ReactGridLayout, { WidthProvider, Layout } from 'react-grid-layout';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import { DashboardWidget, Period } from '../../types';
import { WidgetContainer } from './WidgetContainer';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const GridLayout = WidthProvider(ReactGridLayout);

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

interface DashboardEditorGridProps {
  widgets: DashboardWidget[];
  layout: LayoutItem[];
  globalPeriod: Period;
  onLayoutChange: (layout: LayoutItem[]) => void;
  onDeleteWidget: (widgetId: string) => void;
  onEditWidget: (widget: DashboardWidget) => void;
}

const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [16, 16];

export const DashboardEditorGrid: React.FC<DashboardEditorGridProps> = ({
  widgets, layout, globalPeriod, onLayoutChange, onDeleteWidget, onEditWidget,
}) => {
  const handleLayoutChange = (newLayout: Layout[]) => {
    const simplified = newLayout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }));
    const changed = simplified.some(item => {
      const old = layout.find(l => l.i === item.i);
      return !old || old.x !== item.x || old.y !== item.y || old.w !== item.w || old.h !== item.h;
    });
    if (changed) onLayoutChange(simplified);
  };

  return (
    <GridLayout
      layout={layout}
      cols={12}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".drag-handle"
      compactType="vertical"
    >
      {widgets.map(widget => {
        const layoutItem = layout.find(l => l.i === widget.id);
        const h = layoutItem?.h ?? 4;
        const widgetHeight = h * ROW_HEIGHT + (h - 1) * MARGIN[1];
        return (
          <Box key={widget.id} sx={{ position: 'relative', height: '100%' }}>
            <Box
              className="drag-handle"
              sx={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                cursor: 'grab', '&:active': { cursor: 'grabbing' },
                borderRadius: 3,
                border: '2px dashed rgba(21,101,192,0.3)',
                bgcolor: 'rgba(21,101,192,0.03)',
              }}
            />
            <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', gap: 0.5 }}>
              <Tooltip title="Modifier la configuration">
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); onEditWidget(widget); }}
                  sx={{ bgcolor: 'white', boxShadow: 1, width: 24, height: 24, '&:hover': { bgcolor: '#e3f2fd' } }}
                >
                  <EditIcon sx={{ fontSize: 14, color: '#1565c0' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Supprimer">
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); onDeleteWidget(widget.id); }}
                  sx={{ bgcolor: 'white', boxShadow: 1, width: 24, height: 24, '&:hover': { bgcolor: '#ffebee' } }}
                >
                  <CloseIcon sx={{ fontSize: 14, color: '#c62828' }} />
                </IconButton>
              </Tooltip>
            </Box>
            <WidgetContainer widget={widget} globalPeriod={globalPeriod} height={widgetHeight} />
          </Box>
        );
      })}
    </GridLayout>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardEditorGrid.tsx
git commit -m "feat(frontend): add DashboardEditorGrid drag-and-drop grid component"
```

---

### Task 3: Créer `WidgetConfigForm.tsx`

**Files:**
- Create: `src/components/dashboard/WidgetConfigForm.tsx`

- [ ] **Step 1: Créer le fichier**

```typescript
// src/components/dashboard/WidgetConfigForm.tsx
import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button,
  CircularProgress, FormControl, InputLabel, MenuItem, Select,
  TextField, Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Period } from '../../types';

export interface WidgetFormValues {
  title: string;
  type: 'kpi_card' | 'bar_chart' | 'line_chart' | 'gauge' | 'table';
  source: 'applications' | 'clients' | 'analytics';
  metric: string;
  groupBy?: 'month' | 'status' | 'branch';
  filterStatus?: string;
  periodOverride?: Period;
  colorScheme?: 'blue' | 'green' | 'orange' | 'red';
  color?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
  limit?: number;
}

interface WidgetConfigFormProps {
  initialValues?: Partial<WidgetFormValues>;
  onSubmit: (values: WidgetFormValues) => void;
  loading?: boolean;
}

const SOURCE_BY_TYPE: Record<string, string[]> = {
  kpi_card:   ['applications', 'clients', 'analytics'],
  bar_chart:  ['applications'],
  line_chart: ['applications'],
  gauge:      ['analytics'],
  table:      ['applications', 'clients'],
};

const METRICS_BY_SOURCE: Record<string, Array<{ value: string; label: string; tableOnly?: boolean }>> = {
  applications: [
    { value: 'count',               label: 'Nombre de dossiers' },
    { value: 'sum_amount',          label: 'Montant total' },
    { value: 'approval_rate',       label: "Taux d'approbation" },
    { value: 'avg_processing_time', label: 'Délai moyen (jours)' },
    { value: 'list',                label: 'Liste des dossiers', tableOnly: true },
  ],
  clients: [
    { value: 'count', label: 'Nombre de clients actifs' },
    { value: 'list',  label: 'Liste des clients', tableOnly: true },
  ],
  analytics: [
    { value: 'approval_rate',   label: "Taux d'approbation" },
    { value: 'npl_ratio',       label: 'Ratio NPL (%)' },
    { value: 'solvency_ratio',  label: 'Ratio de solvabilité (%)' },
    { value: 'liquidity_ratio', label: 'Ratio de liquidité (%)' },
  ],
};

const STATUS_OPTIONS = ['APPROVED', 'REJECTED', 'UNDER_REVIEW', 'SUBMITTED', 'DISBURSED', 'CANCELLED', 'DRAFT'];
const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
};
const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'this_month',    label: 'Ce mois' },
  { value: 'this_quarter',  label: 'Ce trimestre' },
  { value: 'this_year',     label: 'Cette année' },
  { value: 'last_6_months', label: '6 derniers mois' },
  { value: 'last_12_months', label: '12 derniers mois' },
];
const PRESET_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#c62828', '#7b1fa2', '#f9a825'];

const DEFAULT_VALUES: WidgetFormValues = {
  title: '', type: 'kpi_card', source: 'applications', metric: 'count',
};

export const WidgetConfigForm: React.FC<WidgetConfigFormProps> = ({ initialValues, onSubmit, loading }) => {
  const [values, setValues] = useState<WidgetFormValues>({ ...DEFAULT_VALUES, ...initialValues });

  useEffect(() => {
    const sources = SOURCE_BY_TYPE[values.type] ?? ['applications'];
    if (!sources.includes(values.source)) {
      setValues(v => ({ ...v, source: sources[0] as WidgetFormValues['source'], metric: '' }));
    }
  }, [values.type]);

  useEffect(() => {
    const isTable = values.type === 'table';
    const available = (METRICS_BY_SOURCE[values.source] ?? []).filter(m => !m.tableOnly || isTable);
    if (!available.find(m => m.value === values.metric)) {
      setValues(v => ({ ...v, metric: available[0]?.value ?? '' }));
    }
  }, [values.source, values.type]);

  const set = (key: keyof WidgetFormValues, val: any) => setValues(v => ({ ...v, [key]: val }));

  const availableSources = SOURCE_BY_TYPE[values.type] ?? ['applications'];
  const availableMetrics = (METRICS_BY_SOURCE[values.source] ?? []).filter(
    m => !m.tableOnly || values.type === 'table'
  );

  const showGroupBy     = values.type === 'bar_chart' || values.type === 'line_chart';
  const showFilterStatus = values.source === 'applications';
  const showColorScheme = values.type === 'kpi_card';
  const showColor       = values.type === 'bar_chart' || values.type === 'line_chart';
  const showThreshold   = values.type === 'gauge';
  const showLimit       = values.metric === 'list';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Titre" required size="small" fullWidth
        value={values.title} onChange={e => set('title', e.target.value)}
      />
      <FormControl size="small" fullWidth required>
        <InputLabel>Type</InputLabel>
        <Select value={values.type} label="Type" onChange={e => set('type', e.target.value)}>
          <MenuItem value="kpi_card">KPI Card</MenuItem>
          <MenuItem value="bar_chart">Bar Chart</MenuItem>
          <MenuItem value="line_chart">Line Chart</MenuItem>
          <MenuItem value="gauge">Gauge</MenuItem>
          <MenuItem value="table">Table</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth required>
        <InputLabel>Source</InputLabel>
        <Select value={values.source} label="Source" onChange={e => set('source', e.target.value)}>
          {availableSources.map(s => (
            <MenuItem key={s} value={s}>
              {s === 'applications' ? 'Dossiers de crédit' : s === 'clients' ? 'Clients' : 'Analytique BCEAO'}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth required>
        <InputLabel>Métrique</InputLabel>
        <Select value={values.metric} label="Métrique" onChange={e => set('metric', e.target.value)}>
          {availableMetrics.map(m => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">Options avancées</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
          {showGroupBy && (
            <FormControl size="small" fullWidth>
              <InputLabel>Grouper par</InputLabel>
              <Select value={values.groupBy ?? ''} label="Grouper par" onChange={e => set('groupBy', e.target.value || undefined)}>
                <MenuItem value=""><em>Aucun</em></MenuItem>
                <MenuItem value="month">Mois</MenuItem>
                <MenuItem value="status">Statut</MenuItem>
                <MenuItem value="branch">Agence</MenuItem>
              </Select>
            </FormControl>
          )}
          {showFilterStatus && (
            <FormControl size="small" fullWidth>
              <InputLabel>Filtre statut</InputLabel>
              <Select value={values.filterStatus ?? ''} label="Filtre statut" onChange={e => set('filterStatus', e.target.value || undefined)}>
                <MenuItem value=""><em>Tous</em></MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" fullWidth>
            <InputLabel>Override période</InputLabel>
            <Select value={values.periodOverride ?? ''} label="Override période" onChange={e => set('periodOverride', e.target.value as Period || undefined)}>
              <MenuItem value=""><em>Période globale</em></MenuItem>
              {PERIOD_OPTIONS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          {showColorScheme && (
            <FormControl size="small" fullWidth>
              <InputLabel>Couleur</InputLabel>
              <Select value={values.colorScheme ?? 'blue'} label="Couleur" onChange={e => set('colorScheme', e.target.value)}>
                <MenuItem value="blue">Bleu</MenuItem>
                <MenuItem value="green">Vert</MenuItem>
                <MenuItem value="orange">Orange</MenuItem>
                <MenuItem value="red">Rouge</MenuItem>
              </Select>
            </FormControl>
          )}
          {showColor && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Couleur du graphique</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {PRESET_COLORS.map(c => (
                  <Box
                    key={c}
                    onClick={() => set('color', c)}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: values.color === c ? '3px solid #1a1a2e' : '2px solid transparent',
                      transition: 'border 0.15s',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {showThreshold && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Seuil warning (%)" type="number" size="small"
                value={values.thresholdWarning ?? 70}
                onChange={e => set('thresholdWarning', parseInt(e.target.value))}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Seuil critique (%)" type="number" size="small"
                value={values.thresholdCritical ?? 50}
                onChange={e => set('thresholdCritical', parseInt(e.target.value))}
                sx={{ flex: 1 }}
              />
            </Box>
          )}
          {showLimit && (
            <TextField
              label="Nombre de lignes" type="number" size="small" fullWidth
              value={values.limit ?? 10}
              onChange={e => set('limit', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 50 }}
            />
          )}
        </AccordionDetails>
      </Accordion>

      <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ borderRadius: 2, mt: 1 }}>
        {loading ? <CircularProgress size={20} color="inherit" /> : (initialValues ? 'Enregistrer' : 'Ajouter le widget')}
      </Button>
    </Box>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/WidgetConfigForm.tsx
git commit -m "feat(frontend): add WidgetConfigForm with cascading dropdowns and advanced options"
```

---

### Task 4: Créer `WidgetDrawer.tsx`

**Files:**
- Create: `src/components/dashboard/WidgetDrawer.tsx`

- [ ] **Step 1: Créer le fichier**

```typescript
// src/components/dashboard/WidgetDrawer.tsx
import React, { useState } from 'react';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { ApiService } from '../../services/api';
import { DashboardWidget } from '../../types';
import { WidgetConfigForm, WidgetFormValues } from './WidgetConfigForm';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

interface WidgetDrawerProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  editingWidget: DashboardWidget | null;
  onWidgetAdded: (widget: DashboardWidget, newLayout: any[]) => void;
  onWidgetUpdated: (widget: DashboardWidget) => void;
  currentLayout: LayoutItem[];
}

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  kpi_card:   { w: 3, h: 2 },
  bar_chart:  { w: 6, h: 4 },
  line_chart: { w: 6, h: 4 },
  gauge:      { w: 3, h: 4 },
  table:      { w: 8, h: 5 },
};

function buildConfig(values: WidgetFormValues): Record<string, any> {
  const config: Record<string, any> = { source: values.source, metric: values.metric };
  if (values.groupBy)         config.groupBy = values.groupBy;
  if (values.filterStatus)    config.filter = { status: values.filterStatus };
  if (values.periodOverride)  config.periodOverride = values.periodOverride;
  if (values.colorScheme)     config.colorScheme = values.colorScheme;
  if (values.color)           config.color = values.color;
  if (values.thresholdWarning !== undefined || values.thresholdCritical !== undefined) {
    config.threshold = { warning: values.thresholdWarning ?? 70, critical: values.thresholdCritical ?? 50 };
  }
  if (values.limit)           config.limit = values.limit;
  return config;
}

export const WidgetDrawer: React.FC<WidgetDrawerProps> = ({
  open, onClose, dashboardId, editingWidget, onWidgetAdded, onWidgetUpdated, currentLayout,
}) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: WidgetFormValues) => {
    setLoading(true);
    const config = buildConfig(values);

    if (editingWidget) {
      const res = await ApiService.updateWidget(dashboardId, editingWidget.id, { title: values.title, config });
      if (res.success && res.data) onWidgetUpdated(res.data);
    } else {
      const size = DEFAULT_SIZES[values.type] ?? { w: 4, h: 3 };
      const maxY = currentLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const res = await ApiService.addWidget(dashboardId, {
        type: values.type,
        title: values.title,
        config,
        position: { x: 0, y: maxY, ...size },
      });
      if (res.success && res.data) onWidgetAdded(res.data.widget, res.data.layout);
    }
    setLoading(false);
  };

  const initialValues: Partial<WidgetFormValues> | undefined = editingWidget
    ? {
        title:             editingWidget.title,
        type:              editingWidget.type as WidgetFormValues['type'],
        source:            editingWidget.config.source ?? 'applications',
        metric:            editingWidget.config.metric ?? 'count',
        groupBy:           editingWidget.config.groupBy,
        filterStatus:      editingWidget.config.filter?.status,
        periodOverride:    editingWidget.config.periodOverride,
        colorScheme:       editingWidget.config.colorScheme,
        color:             editingWidget.config.color,
        thresholdWarning:  editingWidget.config.threshold?.warning,
        thresholdCritical: editingWidget.config.threshold?.critical,
        limit:             editingWidget.config.limit,
      }
    : undefined;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 360, p: 3 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          {editingWidget ? 'Modifier le widget' : 'Ajouter un widget'}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <WidgetConfigForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </Drawer>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/WidgetDrawer.tsx
git commit -m "feat(frontend): add WidgetDrawer for widget add/edit side panel"
```

---

### Task 5: Réécrire `DashboardViewPage.tsx` avec mode édition

**Files:**
- Modify: `src/pages/DashboardViewPage.tsx` (réécriture complète)

Ce fichier passe de 94 lignes (lecture seule) à une page complète avec toggle édition, auto-save debounce 800ms, indicateur de sauvegarde, FAB, WidgetDrawer, et delete optimiste avec undo 4s.

- [ ] **Step 1: Réécrire le fichier**

```typescript
// src/pages/DashboardViewPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Fab,
  Grid, IconButton, Snackbar, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import { Dashboard, DashboardWidget, Period } from '../types';
import { useUser } from '../contexts/UserContext';
import {
  DashboardEditorGrid,
  DashboardPeriodSelector,
  WidgetContainer,
  WidgetDrawer,
} from '../components/dashboard';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type SaveStatus = 'saved' | 'saving' | 'unsaved';

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  kpi_card: { w: 3, h: 2 }, bar_chart: { w: 6, h: 4 },
  line_chart: { w: 6, h: 4 }, gauge: { w: 3, h: 4 }, table: { w: 8, h: 5 },
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (status === 'saved') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [status]);
  if (!visible) return null;
  return (
    <Chip
      size="small"
      icon={status === 'saving' ? <CircularProgress size={12} color="inherit" /> : undefined}
      label={
        status === 'unsaved' ? '• Non sauvegardé' :
        status === 'saving'  ? 'Sauvegarde...' : '✓ Sauvegardé'
      }
      sx={{
        bgcolor: status === 'unsaved' ? '#fff3e0' : status === 'saving' ? '#e3f2fd' : '#e8f5e9',
        color:  status === 'unsaved' ? '#e65100' : status === 'saving' ? '#1565c0' : '#2e7d32',
        fontWeight: 600, fontSize: '0.72rem',
      }}
    />
  );
}

export const DashboardViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useUser();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalPeriod, setGlobalPeriod] = useState<Period>('this_month');

  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [pendingLayout, setPendingLayout] = useState<LayoutItem[]>([]);
  const [layoutSnapshot, setLayoutSnapshot] = useState<LayoutItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const [deletedWidget, setDeletedWidget] = useState<DashboardWidget | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ApiService.getDashboard(id).then(res => {
      if (res.success && res.data) {
        setDashboard(res.data);
        setWidgets(res.data.widgets);
        setPendingLayout(res.data.layout as LayoutItem[]);
      } else {
        setError(res.error ?? 'Dashboard introuvable');
      }
      setLoading(false);
    });
  }, [id]);

  const canEdit = dashboard
    ? dashboard.ownerId === state.currentUser?.id ||
      dashboard.shares.some(s =>
        (s.shareType === 'USER' && s.targetId === state.currentUser?.id && s.permission === 'EDIT') ||
        (s.shareType === 'ROLE' && s.targetId === state.currentUser?.role && s.permission === 'EDIT')
      )
    : false;

  const enterEditMode = () => {
    setLayoutSnapshot([...pendingLayout]);
    setIsEditMode(true);
    setSaveStatus('saved');
  };

  const cancelEditMode = () => {
    setPendingLayout(layoutSnapshot);
    setIsEditMode(false);
    setSaveStatus('saved');
  };

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setPendingLayout(newLayout);
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await ApiService.updateDashboard(id!, { layout: newLayout });
      setSaveStatus('saved');
    }, 800);
  };

  const handleDeleteWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setPendingLayout(prev => prev.filter(l => l.i !== widgetId));
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletedWidget(widget);
    setSnackbarOpen(true);
    deleteTimerRef.current = setTimeout(async () => {
      await ApiService.deleteWidget(id!, widgetId);
      setDeletedWidget(null);
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (!deletedWidget || !deleteTimerRef.current) return;
    clearTimeout(deleteTimerRef.current);
    setWidgets(prev => [...prev, deletedWidget]);
    const { w, h } = DEFAULT_SIZES[deletedWidget.type] ?? { w: 4, h: 3 };
    const maxY = pendingLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setPendingLayout(prev => [...prev, { i: deletedWidget.id, x: 0, y: maxY, w, h }]);
    setDeletedWidget(null);
    setSnackbarOpen(false);
  };

  const handleWidgetAdded = (widget: DashboardWidget, newLayout: any[]) => {
    setWidgets(prev => [...prev, widget]);
    setPendingLayout(newLayout as LayoutItem[]);
    setDrawerOpen(false);
  };

  const handleWidgetUpdated = (widget: DashboardWidget) => {
    setWidgets(prev => prev.map(w => w.id === widget.id ? widget : w));
    setDrawerOpen(false);
    setEditingWidget(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !dashboard) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error ?? 'Dashboard introuvable'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Tooltip title="Retour aux dashboards">
          <IconButton onClick={() => navigate('/dashboard-builder')} size="small">
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e">{dashboard.name}</Typography>
          {dashboard.description && (
            <Typography variant="body2" color="text.secondary">{dashboard.description}</Typography>
          )}
        </Box>
        {isEditMode && <SaveIndicator status={saveStatus} />}
        <DashboardPeriodSelector value={globalPeriod} onChange={setGlobalPeriod} />
        {canEdit && !isEditMode && (
          <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={enterEditMode} sx={{ borderRadius: 2 }}>
            Modifier
          </Button>
        )}
        {isEditMode && (
          <Button variant="text" size="small" startIcon={<CloseIcon />} onClick={cancelEditMode} color="error" sx={{ borderRadius: 2 }}>
            Annuler
          </Button>
        )}
      </Box>

      {widgets.length === 0 && !isEditMode ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography variant="h6" color="text.secondary">Ce dashboard n'a pas encore de widgets.</Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={enterEditMode} sx={{ mt: 2, borderRadius: 2 }}>
              Ajouter des widgets
            </Button>
          )}
        </Box>
      ) : isEditMode ? (
        <DashboardEditorGrid
          widgets={widgets}
          layout={pendingLayout}
          globalPeriod={globalPeriod}
          onLayoutChange={handleLayoutChange}
          onDeleteWidget={handleDeleteWidget}
          onEditWidget={w => { setEditingWidget(w); setDrawerOpen(true); }}
        />
      ) : (
        <Grid container spacing={2.5}>
          {widgets.map(widget => (
            <Grid
              item
              key={widget.id}
              xs={12}
              sm={widget.type === 'kpi_card' ? 6 : 12}
              md={widget.type === 'kpi_card' ? 3 : widget.type === 'table' ? 8 : 6}
            >
              <WidgetContainer
                widget={widget}
                globalPeriod={globalPeriod}
                height={widget.type === 'kpi_card' ? 140 : widget.type === 'table' ? 320 : 280}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {isEditMode && (
        <Fab
          color="primary"
          onClick={() => { setEditingWidget(null); setDrawerOpen(true); }}
          sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1200 }}
        >
          <AddIcon />
        </Fab>
      )}

      <WidgetDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingWidget(null); }}
        dashboardId={id!}
        editingWidget={editingWidget}
        onWidgetAdded={handleWidgetAdded}
        onWidgetUpdated={handleWidgetUpdated}
        currentLayout={pendingLayout}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message="Widget supprimé"
        action={
          <Button color="warning" size="small" onClick={handleUndoDelete}>
            Annuler
          </Button>
        }
      />
    </Box>
  );
};
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DashboardViewPage.tsx
git commit -m "feat(frontend): add edit mode with drag-and-drop, auto-save, FAB and delete undo to DashboardViewPage"
```

---

### Task 6: Mettre à jour `src/components/dashboard/index.ts`

**Files:**
- Modify: `src/components/dashboard/index.ts`

- [ ] **Step 1: Ajouter les 3 nouveaux exports**

Remplacer le contenu complet de `src/components/dashboard/index.ts` par :

```typescript
export { WidgetContainer } from './WidgetContainer';
export { DashboardPeriodSelector } from './DashboardPeriodSelector';
export { DashboardEditorGrid } from './DashboardEditorGrid';
export { WidgetDrawer } from './WidgetDrawer';
export { WidgetConfigForm } from './WidgetConfigForm';
export type { WidgetFormValues } from './WidgetConfigForm';
export { KpiCardWidget } from './widgets/KpiCardWidget';
export { BarChartWidget } from './widgets/BarChartWidget';
export { LineChartWidget } from './widgets/LineChartWidget';
export { GaugeWidget } from './widgets/GaugeWidget';
export { TableWidget } from './widgets/TableWidget';
```

- [ ] **Step 2: Vérifier TypeScript + build complet**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit 2>&1 | head -30
```

Résultat attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/index.ts
git commit -m "feat(frontend): export DashboardEditorGrid, WidgetDrawer, WidgetConfigForm from dashboard index"
```

---

## Vérification finale

Après les 6 tasks, exécuter :

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC
npx tsc --noEmit
```

Résultat attendu : aucune erreur TypeScript.

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend
npx jest --passWithNoTests 2>&1 | tail -5
```

Résultat attendu : tous les tests passent (aucun changement backend dans ce sous-projet).
