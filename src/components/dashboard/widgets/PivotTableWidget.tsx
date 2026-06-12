import React from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { WidgetDataResult } from '../../../types';

interface PivotTableWidgetProps {
  data: WidgetDataResult;
  height?: number;
  metric?: 'count' | 'sum_amount';
}

function fmt(v: number): string {
  return v.toLocaleString('fr-FR');
}

const STATUS_FR: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
  PENDING: 'En attente',
};

function label(v: string) { return STATUS_FR[v] ?? v; }

export const PivotTableWidget: React.FC<PivotTableWidgetProps> = ({ data, height = 240, metric = 'count' }) => {
  const { pivotRows, pivotCols, pivotMatrix, pivotRowTotals, pivotColTotals, pivotGrand } = data;

  if (!pivotRows?.length || !pivotCols?.length) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Aucune donnée disponible</Typography>
      </Box>
    );
  }

  const maxRow = Math.max(...Object.values(pivotRowTotals ?? {}), 1);

  const cellBg = (v: number) =>
    v > 0 ? `rgba(21,101,192,${(0.06 + (v / maxRow) * 0.28).toFixed(2)})` : 'transparent';

  const th = { fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' as const, py: 0.6, px: 0.8 };
  const td = { fontSize: '0.70rem', py: 0.5, px: 0.8 };

  return (
    <TableContainer sx={{ height, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...th, bgcolor: '#f5f6fa', minWidth: 110, position: 'sticky', left: 0, zIndex: 3 }} />
            {pivotCols.map(col => (
              <TableCell key={col} align="center" sx={{ ...th, bgcolor: '#f5f6fa', maxWidth: 90 }}>
                {label(col)}
              </TableCell>
            ))}
            <TableCell align="center" sx={{ ...th, bgcolor: '#e8eaf6', color: '#1565c0' }}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pivotRows.map(row => (
            <TableRow key={row} hover>
              <TableCell
                sx={{ ...td, fontWeight: 600, bgcolor: '#fafafa', position: 'sticky', left: 0, zIndex: 1,
                      maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={row}
              >
                {row}
              </TableCell>
              {pivotCols.map(col => {
                const v = pivotMatrix?.[row]?.[col] ?? 0;
                return (
                  <TableCell key={col} align="center" sx={{ ...td, bgcolor: cellBg(v), color: v ? '#1a1a2e' : '#ccc' }}>
                    {v ? fmt(v) : '—'}
                  </TableCell>
                );
              })}
              <TableCell align="center" sx={{ ...td, fontWeight: 700, bgcolor: '#e8eaf6', color: '#1565c0' }}>
                {fmt(pivotRowTotals?.[row] ?? 0)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ ...td, fontWeight: 800, bgcolor: '#e8eaf6', color: '#1565c0', position: 'sticky', left: 0, zIndex: 1 }}>
              Total
            </TableCell>
            {pivotCols.map(col => (
              <TableCell key={col} align="center" sx={{ ...td, fontWeight: 700, bgcolor: '#e8eaf6', color: '#1565c0' }}>
                {fmt(pivotColTotals?.[col] ?? 0)}
              </TableCell>
            ))}
            <TableCell align="center" sx={{ ...td, fontWeight: 800, bgcolor: '#c5cae9', color: '#1a237e' }}>
              {fmt(pivotGrand ?? 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};
