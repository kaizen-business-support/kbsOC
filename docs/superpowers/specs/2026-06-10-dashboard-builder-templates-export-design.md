# Dashboard Builder — Sous-projet 4 : Templates Avancés + Export PDF/Excel

**Date :** 2026-06-10
**Statut :** Approuvé
**Projet :** OptimusCredit — Module Constructeur de Rapports & Dashboards Dynamiques
**Sous-projet :** 4 / 4 — Templates Avancés + Export PDF/Excel

---

## Contexte

Les sous-projets précédents ont livré :
1. Foundation ✅ — schéma DB, API CRUD, permissions
2. Widget Library ✅ — 5 composants widgets, WidgetContainer, endpoint `/api/widget-data`
3. Éditeur Drag & Drop ✅ — DashboardEditorGrid, WidgetDrawer, WidgetConfigForm, auto-save

Ce sous-projet complète le module avec :
- Une galerie de templates dans `DashboardsPage`
- La sauvegarde d'un dashboard comme template (permission `templates_create`)
- L'export du dashboard en PDF et des données en Excel (client-side)

**Décomposition globale du module :**
1. Foundation ✅
2. Widget Library + Data Sources ✅
3. Éditeur Drag & Drop ✅
4. **Templates avancés + Export PDF/Excel** ← ce spec

---

## Ce qui existe déjà (ne change pas)

| Élément | État |
|---|---|
| `backend/src/routes/dashboard-templates.ts` | CRUD complet + `POST /:id/apply` ✅ |
| `ApiService.getDashboardTemplates()` | ✅ |
| `ApiService.applyDashboardTemplate(id, name?)` | ✅ |
| Permissions `templates_use` / `templates_create` | ✅ |
| Schéma Prisma `DashboardTemplate` + `DashboardTemplateWidget` | ✅ |

**Aucun nouvel endpoint backend.** Tout est client-side.

---

## 1. Nouveaux packages

```bash
npm install html2canvas jspdf xlsx
npm install --save-dev @types/xlsx
```

| Package | Usage |
|---|---|
| `html2canvas` | Capture DOM → canvas |
| `jspdf` | Canvas → PDF |
| `xlsx` (SheetJS) | Données → fichier .xlsx |

---

## 2. Structure des fichiers

```
src/
  services/
    exportService.ts              — créer : exportToPDF + exportToExcel
    api.ts                        — modifier : +createDashboardTemplate
  components/dashboard/
    ExportMenu.tsx                — créer : dropdown PDF/Excel
    SaveAsTemplateDialog.tsx      — créer : modal save-as-template
    index.ts                      — modifier : +ExportMenu +SaveAsTemplateDialog
  pages/
    DashboardsPage.tsx            — modifier : section templates
    DashboardViewPage.tsx         — modifier : ExportMenu + SaveAsTemplateDialog + gridRef
```

---

## 3. Méthodes à ajouter dans `ApiService`

Deux méthodes à ajouter dans `src/services/api.ts` :

```typescript
static async createDashboardTemplate(data: {
  name: string;
  description?: string;
  layout: any[];
  widgets: Array<{ type: string; title: string; config: Record<string, any> }>;
}): Promise<ApiResponse<DashboardTemplate>> {
  try {
    const res = await api.post('/dashboard-templates', data);
    return res.data;
  } catch (e: any) {
    return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
  }
}

static async deleteDashboardTemplate(id: string): Promise<ApiResponse<void>> {
  try {
    await api.delete(`/dashboard-templates/${id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.response?.data?.error || 'Erreur réseau' };
  }
}
```

---

## 4. `src/services/exportService.ts`

Deux fonctions pures, sans effet de bord, sans appels API.

```typescript
export async function exportToPDF(element: HTMLElement, filename: string): Promise<void>
export function exportToExcel(
  sheets: Array<{ name: string; rows: Record<string, any>[] }>,
  filename: string
): void
```

**`exportToPDF`** :
1. `html2canvas(element, { scale: 2, useCORS: true, logging: false })`
2. Crée un `jsPDF` en paysage A4 (`orientation: 'landscape'`)
3. Calcule le ratio pour que l'image tienne en pleine largeur
4. `pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width, height)`
5. `pdf.save(filename)`

**`exportToExcel`** :
1. `const wb = XLSX.utils.book_new()`
2. Pour chaque `sheet` : `XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)`
3. `XLSX.writeFile(wb, filename)`

---

## 5. `ExportMenu.tsx`

```typescript
interface ExportMenuProps {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  globalPeriod: Period;
  gridRef: React.RefObject<HTMLDivElement>;
}
```

Affichage :
- `IconButton` avec `DownloadIcon` + `Tooltip` "Exporter"
- Ouvre un `Menu` MUI avec deux `MenuItem` :
  - "Exporter en PDF" → `handleExportPDF()`
  - "Exporter les données (Excel)" → `handleExportExcel()`

**`handleExportPDF()`** :
1. `setExporting(true)` (affiche un `CircularProgress` overlay sur le grid)
2. Attend `requestAnimationFrame` (laisse React re-render l'overlay)
3. Appelle `exportToPDF(gridRef.current!, 'dashboard-<slug>-<YYYY-MM-DD>.pdf')`
4. `setExporting(false)`

**`handleExportExcel()`** :
1. `setExportingExcel(true)` (désactive le bouton)
2. Pour chaque widget, appelle `ApiService.getWidgetData({ source, metric, groupBy, period: globalPeriod, filter, limit: 500 })` en `Promise.all`
3. Convertit chaque résultat en `rows: Record<string, any>[]` :
   - `value` présent → `[{ Métrique: widget.title, Valeur: data.value, Tendance: data.trend ?? '' }]`
   - `series` présent → `data.series.map(s => ({ Nom: s.name, Valeur: s.value }))`
   - `rows` présent → `data.rows` tel quel
4. Appelle `exportToExcel(sheets, 'dashboard-<slug>-<YYYY-MM-DD>.xlsx')`
5. `setExportingExcel(false)`

Le slug est le nom du dashboard en lowercase, espaces remplacés par tirets, accents supprimés.

---

## 6. `SaveAsTemplateDialog.tsx`

```typescript
interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  layout: LayoutItem[];
}
```

MUI `Dialog` (maxWidth="sm") avec :
- Titre : "Sauvegarder comme template"
- `TextField` **Nom** (obligatoire, pré-rempli `dashboard.name`)
- `TextField` **Description** (optionnel, multiline 2 lignes)
- Bouton "Annuler" + bouton "Sauvegarder" (disabled si nom vide ou loading)

Sur submit :
1. `setLoading(true)`
2. Appelle `ApiService.createDashboardTemplate({ name, description, layout, widgets: widgets.map(w => ({ type: w.type, title: w.title, config: w.config })) })`
3. Si succès → ferme le dialog + MUI `Snackbar` "Template sauvegardé"
4. Si erreur → affiche l'erreur dans le dialog
5. `finally { setLoading(false) }`

---

## 7. Section templates dans `DashboardsPage`

Structure de la page après modification :

```
[Header + bouton "Nouveau dashboard"]
[Mes dashboards]     ← existant
  [grille de cards]
[Templates disponibles]   ← nouveau
  [grille de cards avec badge Global/Société]
```

**Chargement :** second `useEffect` parallèle au chargement des dashboards, appelle `ApiService.getDashboardTemplates()`. Si la liste est vide, la section est masquée entièrement.

**Card template :**
- Titre + description (tronquée)
- Badge MUI `Chip` : "Global" (bleu) si `isGlobal`, "Société" (vert) sinon
- Bouton **"Utiliser"** → ouvre `ApplyTemplateDialog` (inline dans `DashboardsPage`) :
  - `TextField` Nom (pré-rempli avec `template.name`)
  - Bouton "Créer" → `ApiService.applyDashboardTemplate(template.id, name)` → `navigate('/dashboard-builder/<newId>')`
- Si `state.currentUser?.role === 'ADMIN' || state.currentUser?.role === 'SUPER_ADMIN'` ET template non-global (ou SUPER_ADMIN pour les templates globaux) → icône poubelle → MUI `Dialog` de confirmation (Annuler / Supprimer) → `ApiService.deleteDashboardTemplate(id)` → retire le template de la liste locale

---

## 8. Modifications de `DashboardViewPage`

**Nouveaux éléments dans le header :**

```
[← Retour]  Nom du Dashboard    [SaveAsTemplate?]  [Export↓]  [Période]  [Modifier]
```

- `ExportMenu` — toujours visible (lecture + édition)
- Bouton **"Sauvegarder comme template"** — visible si `state.currentUser?.role === 'ADMIN' || state.currentUser?.role === 'SUPER_ADMIN'` (proxy pour `templates_create`), icône `BookmarkAddIcon`, libellé court "Template" sur mobile

**`gridRef` :**
- Un `ref={gridRef}` est posé sur un `<Box>` wrapper unique qui entoure le bloc conditionnel (état vide / `DashboardEditorGrid` / `Grid` statique) — ce wrapper existe déjà implicitement ; on lui ajoute simplement `ref={gridRef}`
- Passé à `ExportMenu` pour la capture PDF

**État supplémentaire :**
```typescript
const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
const gridRef = useRef<HTMLDivElement>(null);
```

---

## 9. Mise à jour de `dashboard/index.ts`

Ajouter :
```typescript
export { ExportMenu } from './ExportMenu';
export { SaveAsTemplateDialog } from './SaveAsTemplateDialog';
```

---

## 10. Permissions

| Action | Permission requise |
|---|---|
| Voir les templates | `templates_use` |
| Appliquer un template | `templates_use` |
| Sauvegarder comme template | `templates_create` |
| Supprimer un template société | `templates_create` |
| Exporter PDF / Excel | `export` (permission existante dans dashboard-builder) |

Le bouton export est toujours visible (tous les utilisateurs peuvent exporter leurs dashboards). La permission `export` du profil module n'est pas vérifiée côté frontend dans ce sous-projet — simplification volontaire.

---

## 11. Tests

**Backend :** Aucun nouveau endpoint → aucun nouveau test backend.

**Frontend `ApiService` :**
- `createDashboardTemplate` : POST `/dashboard-templates` — même pattern que les méthodes existantes, pas de test unitaire séparé (couvert par les tests d'intégration existants sur la route backend)
- `deleteDashboardTemplate` : DELETE `/dashboard-templates/:id` — idem

**exportService.ts :**
- Pas de tests unitaires (dépend de `html2canvas`, `jsPDF`, `xlsx` — libs externes difficiles à mocker)
- La correction est vérifiée manuellement via le résultat des fichiers générés

---

## 12. Périmètre

**Inclus :**
- `npm install html2canvas jspdf xlsx`
- `ApiService.createDashboardTemplate` + `ApiService.deleteDashboardTemplate`
- `exportService.ts` (exportToPDF + exportToExcel)
- `ExportMenu.tsx`
- `SaveAsTemplateDialog.tsx`
- Section templates dans `DashboardsPage`
- Modifications `DashboardViewPage` (gridRef + ExportMenu + SaveAsTemplateDialog)
- Mise à jour `dashboard/index.ts`

**Exclu :**
- Édition inline d'un template (formulaire d'édition avancé)
- Partage de template entre sociétés
- Export vers d'autres formats (CSV, PNG)
- Prévisualisation du template avant application
