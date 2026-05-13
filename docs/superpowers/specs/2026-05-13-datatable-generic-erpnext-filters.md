# DataTable générique style ERPNext + pagination 20

**Date :** 2026-05-13
**Statut :** design validé, prêt pour plan d'implémentation

## 1. Contexte & objectif

L'utilisateur veut, sur le tableau de bord CODIR (et à terme sur d'autres tables de l'app), des filtres style ERPNext (un input par colonne sous le header, type-aware) ainsi qu'une pagination fixe à 20 lignes. Plutôt que d'adapter chaque table individuellement, on construit un **composant générique réutilisable** (`DataTable`) qui pilote filtres / tri / pagination depuis une déclaration de colonnes — approche similaire à `frappe.DataTable` dans ERPNext.

Premier consommateur : `PendingDecisionsTable` du tableau de bord CODIR (`src/pages/CodirDashboardPage.tsx` onglet 0). Les autres tables (Approbations, ClientManagement, Workflow…) pourront migrer ultérieurement sans nouvelle conception.

## 2. API du composant

`src/components/common/DataTable.tsx` :

```ts
interface DataTableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => unknown;
  render?: (row: T) => React.ReactNode;
  filter?:
    | { type: 'text' }
    | { type: 'number' }
    | { type: 'enum'; options: { value: string; label: string }[] }
    | { type: 'date' }
    | { type: 'custom'; render: (value: any, onChange: (v: any) => void) => React.ReactNode; match: (row: T, value: any) => boolean }
    | { type: 'none' };
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;          // défaut 20
  loading?: boolean;
  emptyMessage?: string;
  dense?: boolean;
  onRowClick?: (row: T) => void;
  initialSort?: { columnId: string; direction: 'asc' | 'desc' };
}
```

Comportement :
- Première ligne du `<TableHead>` = titres + tri (cliquables si `sortable !== false` et `filter.type !== 'none'`).
- Deuxième ligne = inputs de filtres selon `filter.type`.
- Tri & filtre & pagination chaînés côté client via `useMemo`.
- Footer : `← Préc | Page X / Y | Suiv →` + compteur de lignes filtrées vs total.

## 3. Filtres par type

| Type | Rendu | Match |
|---|---|---|
| `text` | `TextField` size=small | `String(accessor).toLowerCase().includes(value.toLowerCase())` |
| `number` | Deux `TextField` (min, max) côte à côte | `min ≤ accessor ≤ max` (bornes facultatives) |
| `enum` | `Select` multi-options (avec "Tous") | `value === '' || accessor === value` |
| `date` | Deux `TextField type="date"` (du / au) | range inclusif |
| `custom` | Fourni par le caller | Fourni par le caller |
| `none` | Pas de cellule de filtre, colonne non triable | — |

## 4. État & hook

Le hook interne `useDataTableState<T>(rows, columns, pageSize)` retourne :
- `filteredSortedPaged: T[]` — les lignes visibles sur la page courante.
- `total`, `filteredTotal`, `pageCount`, `page`, `setPage`.
- `filters: Record<columnId, any>`, `setFilter(columnId, value)`, `clearFilters()`.
- `sort: { columnId, direction } | null`, `setSort(columnId)` (toggle asc → desc → null).

Le composant utilise ce hook ; les consommateurs n'ont qu'à fournir `rows` + `columns`.

## 5. Style

- Aligné sur les tokens de la home : `colors.border.default`, `colors.bg.surface`, `colors.bg.subtle` pour la ligne de filtres, `colors.accent.primary` pour le tri actif.
- Row hover discret (`colors.bg.subtle`).
- Cellules de filtres `py: 0.5`, inputs `size="small"`.

## 6. Migration CODIR

### 6.1 `PendingDecisionsTable`

Réécriture interne : la `<Table>` actuelle est remplacée par un `<DataTable>`. Les filtres existants (agent, overdueOnly, stepFilter) deviennent :
- **Étape** : colonne avec filter `enum` (options = liste des stepName distincts).
- **Agent** : colonne `enum` (options = agents distincts).
- **SLA** : colonne `custom` avec un Select { tous / en retard / dans les délais }.
- **Numéro dossier** : colonne `text`.
- **Client** : colonne `text`.
- **Montant** : colonne `number` (range min/max).

Le `stepFilter` venu de `BottleneckKpiBar` (parent) reste contrôlé extérieurement : il pré-remplit le filtre `step` de la table via `initialColumnFilters`. (Petite extension de l'API : optionnel.)

### 6.2 `CodirTimelineTab`

Inspection rapide : si la timeline est rendue comme une liste de cards (pas une `<Table>`), on **ne touche pas** à l'onglet timeline. Hors périmètre.

## 7. Hors-périmètre

- Pas de pagination serveur-side.
- Pas d'export CSV (à ajouter ultérieurement).
- Pas de sélection multi-ligne / actions groupées.
- Pas de réorganisation de colonnes (drag & drop).
- Pas de migration des autres tables (Approbations, Clients, etc.) — fait dans des PRs séparées.

## 8. Tests

- `useDataTableState.test.ts` (unit) : filter text/number/enum, sort asc/desc/clear, pagination, navigation page, reset filters.
- Smoke manuel CODIR : filtres par colonne fonctionnels, tri, pagination 20.

## 9. Migration / déploiement

Aucun changement DB. Aucun changement API. Pure UI front. Désactivable trivialement (revert du commit `PendingDecisionsTable`).
