/**
 * DataTable — composant générique réutilisable.
 *
 * Inspiré de la DataTable de Frappe/ERPNext : déclaration de colonnes
 * type-aware (text, number, enum, date, custom), filtres dans la 2ᵉ
 * ligne du header, tri au clic, pagination côté client (20 par défaut).
 *
 * Style aligné sur les tokens de la home (palette navy).
 */

import React from 'react';
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  TableSortLabel, Typography, IconButton, TextField, MenuItem, Select, FormControl,
  CircularProgress,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import { colors, shadows, radii, transitions } from '../home/homeTokens';
import { useDataTableState, ColumnDef as InternalColumnDef, FilterDef, SortState } from '../../hooks/useDataTableState';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DataTableColumn<T> extends InternalColumnDef<T> {
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

export type { FilterDef } from '../../hooks/useDataTableState';

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  dense?: boolean;
  onRowClick?: (row: T) => void;
  initialSort?: SortState;
}

// ─── Sous-composant : cellule de filtre ──────────────────────────────────────

function FilterCell<T>({
  column,
  value,
  onChange,
}: {
  column: DataTableColumn<T>;
  value: any;
  onChange: (v: any) => void;
}) {
  const filter: FilterDef<T> | undefined = column.filter;
  if (!filter || filter.type === 'none') return <TableCell sx={{ borderBottom: 'none' }} />;

  switch (filter.type) {
    case 'text':
      return (
        <TableCell sx={{ py: 0.75, borderBottom: `1px solid ${colors.border.default}` }}>
          <TextField
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Filtrer…"
            size="small"
            fullWidth
            sx={{
              '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 },
              '& .MuiOutlinedInput-root': { bgcolor: colors.bg.surface },
            }}
          />
        </TableCell>
      );
    case 'number': {
      const range = (value as { min?: string; max?: string }) ?? {};
      return (
        <TableCell sx={{ py: 0.75, borderBottom: `1px solid ${colors.border.default}` }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField
              value={range.min ?? ''}
              onChange={(e) => onChange({ ...range, min: e.target.value })}
              placeholder="Min"
              size="small"
              type="number"
              sx={{ '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 } }}
            />
            <TextField
              value={range.max ?? ''}
              onChange={(e) => onChange({ ...range, max: e.target.value })}
              placeholder="Max"
              size="small"
              type="number"
              sx={{ '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 } }}
            />
          </Box>
        </TableCell>
      );
    }
    case 'enum':
      return (
        <TableCell sx={{ py: 0.75, borderBottom: `1px solid ${colors.border.default}` }}>
          <FormControl size="small" fullWidth>
            <Select
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: colors.bg.surface, '& .MuiSelect-select': { py: 0.6 } }}
            >
              <MenuItem value=""><em>Tous</em></MenuItem>
              {filter.options.map(opt => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12.5 }}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </TableCell>
      );
    case 'date': {
      const range = (value as { min?: string; max?: string }) ?? {};
      return (
        <TableCell sx={{ py: 0.75, borderBottom: `1px solid ${colors.border.default}` }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField
              value={range.min ?? ''}
              onChange={(e) => onChange({ ...range, min: e.target.value })}
              size="small"
              type="date"
              sx={{ '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 } }}
            />
            <TextField
              value={range.max ?? ''}
              onChange={(e) => onChange({ ...range, max: e.target.value })}
              size="small"
              type="date"
              sx={{ '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 } }}
            />
          </Box>
        </TableCell>
      );
    }
    case 'custom':
      return (
        <TableCell sx={{ py: 0.75, borderBottom: `1px solid ${colors.border.default}` }}>
          {(filter as any).render
            ? (filter as any).render(value, onChange)
            : <span style={{ fontSize: 12, color: colors.text.muted }}>—</span>}
        </TableCell>
      );
  }
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  pageSize = 20,
  loading,
  emptyMessage = 'Aucun résultat',
  dense,
  onRowClick,
  initialSort,
}: DataTableProps<T>) {
  const state = useDataTableState<T>(rows, columns, pageSize, initialSort);

  return (
    <Paper
      sx={{
        borderRadius: `${radii.card}px`,
        border: `1px solid ${colors.border.default}`,
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}
    >
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead sx={{ bgcolor: colors.bg.subtle }}>
            {/* Header row 1 : titres + tri */}
            <TableRow>
              {columns.map(col => {
                const isSortable = col.sortable !== false && col.filter?.type !== 'none';
                const isSorted = state.sort?.columnId === col.id;
                return (
                  <TableCell
                    key={col.id}
                    align={col.align ?? 'left'}
                    sx={{
                      fontWeight: 600,
                      fontSize: 12.5,
                      color: colors.text.primary,
                      width: col.width,
                      borderBottom: `1px solid ${colors.border.default}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSortable ? (
                      <TableSortLabel
                        active={isSorted}
                        direction={isSorted ? state.sort!.direction : 'asc'}
                        onClick={() => state.toggleSort(col.id)}
                        sx={{
                          '&.Mui-active': { color: colors.accent.primary },
                          '&.Mui-active .MuiTableSortLabel-icon': { color: colors.accent.primary },
                        }}
                      >
                        {col.header}
                      </TableSortLabel>
                    ) : (
                      col.header
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
            {/* Header row 2 : filtres */}
            <TableRow>
              {columns.map(col => (
                <FilterCell
                  key={col.id}
                  column={col}
                  value={state.filters[col.id]}
                  onChange={(v) => state.setFilter(col.id, v)}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!loading && state.pagedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ color: colors.text.muted, fontSize: 13 }}>
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading && state.pagedRows.map(row => (
              <TableRow
                key={getRowId(row)}
                hover
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: `background ${transitions.fast}`,
                  '&:hover': { bgcolor: colors.bg.subtle },
                }}
              >
                {columns.map(col => (
                  <TableCell
                    key={col.id}
                    align={col.align ?? 'left'}
                    sx={{
                      fontSize: 13,
                      color: colors.text.primary,
                      borderBottom: `1px solid ${colors.border.default}`,
                    }}
                  >
                    {col.render ? col.render(row) : String(col.accessor(row) ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2, py: 1,
          borderTop: `1px solid ${colors.border.default}`,
          bgcolor: colors.bg.surface,
        }}
      >
        <Typography sx={{ fontSize: 12, color: colors.text.muted }}>
          {state.filteredTotal === state.total
            ? `${state.total} ligne${state.total > 1 ? 's' : ''}`
            : `${state.filteredTotal} / ${state.total} ligne${state.total > 1 ? 's' : ''} (filtrées)`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => state.setPage(0)}
            disabled={state.page === 0}
          ><FirstPageIcon fontSize="small" /></IconButton>
          <IconButton
            size="small"
            onClick={() => state.setPage(Math.max(0, state.page - 1))}
            disabled={state.page === 0}
          ><ChevronLeftIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: 12.5, color: colors.text.secondary, px: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            Page {state.page + 1} / {state.pageCount}
          </Typography>
          <IconButton
            size="small"
            onClick={() => state.setPage(Math.min(state.pageCount - 1, state.page + 1))}
            disabled={state.page >= state.pageCount - 1}
          ><ChevronRightIcon fontSize="small" /></IconButton>
          <IconButton
            size="small"
            onClick={() => state.setPage(state.pageCount - 1)}
            disabled={state.page >= state.pageCount - 1}
          ><LastPageIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
    </Paper>
  );
}
