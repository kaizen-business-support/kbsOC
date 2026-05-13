/**
 * useDataTableState
 *
 * Hook interne du composant DataTable. Gère filtres / tri / pagination
 * en mémoire, sur la base d'une liste de lignes et d'une déclaration
 * de colonnes.
 *
 * Pur (pas de fetch, pas de side-effect réseau) → unit-testable.
 */

import { useMemo, useState } from 'react';

// ─── Types publics ────────────────────────────────────────────────────────────

export type FilterDef<T> =
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'enum'; options: { value: string; label: string }[] }
  | { type: 'date' }
  | { type: 'custom'; match: (row: T, value: any) => boolean }
  | { type: 'none' };

export interface ColumnDef<T> {
  id: string;
  accessor: (row: T) => unknown;
  filter?: FilterDef<T>;
  sortable?: boolean;
}

export interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

export type FilterValue =
  | string                                   // text, enum, date
  | { min?: string; max?: string }           // number range, date range
  | any;                                     // custom

export interface DataTableState<T> {
  // Données résultantes
  pagedRows: T[];
  filteredTotal: number;
  total: number;
  // Pagination
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  // Filtres
  filters: Record<string, FilterValue>;
  setFilter: (columnId: string, value: FilterValue) => void;
  clearFilters: () => void;
  // Tri
  sort: SortState | null;
  toggleSort: (columnId: string) => void;
}

// ─── Match helpers ────────────────────────────────────────────────────────────

function matchText(row: any, accessor: (r: any) => unknown, value: string): boolean {
  if (!value) return true;
  const raw = accessor(row);
  return String(raw ?? '').toLowerCase().includes(value.toLowerCase());
}

function matchNumber(row: any, accessor: (r: any) => unknown, range: { min?: string; max?: string }): boolean {
  if (!range || (!range.min && !range.max)) return true;
  const v = Number(accessor(row));
  if (!Number.isFinite(v)) return false;
  if (range.min && v < Number(range.min)) return false;
  if (range.max && v > Number(range.max)) return false;
  return true;
}

function matchEnum(row: any, accessor: (r: any) => unknown, value: string): boolean {
  if (!value) return true;
  return String(accessor(row)) === value;
}

function matchDate(row: any, accessor: (r: any) => unknown, range: { min?: string; max?: string }): boolean {
  if (!range || (!range.min && !range.max)) return true;
  const raw = accessor(row);
  if (!raw) return false;
  const t = new Date(raw as any).getTime();
  if (!Number.isFinite(t)) return false;
  if (range.min) {
    const minT = new Date(range.min).getTime();
    if (Number.isFinite(minT) && t < minT) return false;
  }
  if (range.max) {
    // inclusif jusqu'à la fin du jour
    const maxT = new Date(range.max).getTime() + 24 * 3600 * 1000 - 1;
    if (Number.isFinite(maxT) && t > maxT) return false;
  }
  return true;
}

function rowPasses<T>(row: T, columns: ColumnDef<T>[], filters: Record<string, FilterValue>): boolean {
  for (const col of columns) {
    const value = filters[col.id];
    if (value === undefined || value === '' || value === null) continue;
    const filter = col.filter;
    if (!filter || filter.type === 'none') continue;
    switch (filter.type) {
      case 'text':
        if (!matchText(row, col.accessor, value as string)) return false;
        break;
      case 'number':
        if (!matchNumber(row, col.accessor, value as { min?: string; max?: string })) return false;
        break;
      case 'enum':
        if (!matchEnum(row, col.accessor, value as string)) return false;
        break;
      case 'date':
        if (!matchDate(row, col.accessor, value as { min?: string; max?: string })) return false;
        break;
      case 'custom':
        if (!filter.match(row, value)) return false;
        break;
    }
  }
  return true;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(a).localeCompare(String(b), 'fr', { numeric: true });
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDataTableState<T>(
  rows: T[],
  columns: ColumnDef<T>[],
  pageSize: number = 20,
  initialSort?: SortState
): DataTableState<T> {
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => rows.filter(r => rowPasses(r, columns, filters)),
    [rows, columns, filters]
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.id === sort.columnId);
    if (!col) return filtered;
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const cmp = compareValues(col.accessor(a), col.accessor(b));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Si on a filtré et la page courante est hors limites, on revient à 0.
  const safePage = page >= pageCount ? 0 : page;
  const pagedRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function setFilter(columnId: string, value: FilterValue): void {
    setFilters(prev => ({ ...prev, [columnId]: value }));
    setPage(0);
  }

  function clearFilters(): void {
    setFilters({});
    setPage(0);
  }

  function toggleSort(columnId: string): void {
    setSort(prev => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: 'asc' };
      if (prev.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  }

  return {
    pagedRows,
    filteredTotal: filtered.length,
    total: rows.length,
    page: safePage,
    pageCount,
    setPage,
    filters,
    setFilter,
    clearFilters,
    sort,
    toggleSort,
  };
}
