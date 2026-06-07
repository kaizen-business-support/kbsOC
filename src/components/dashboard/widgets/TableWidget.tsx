import React, { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, IconButton,
} from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { WidgetDataResult } from '../../../types';

interface TableWidgetProps {
  data: WidgetDataResult;
  title: string;
  pageSize?: number;
}

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  APPROVED: 'success', DISBURSED: 'info',
  REJECTED: 'error', UNDER_REVIEW: 'warning',
  SUBMITTED: 'default', DRAFT: 'default', CANCELLED: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approuvé', DISBURSED: 'Décaissé', REJECTED: 'Rejeté',
  UNDER_REVIEW: 'En analyse', SUBMITTED: 'Soumis', DRAFT: 'Brouillon', CANCELLED: 'Annulé',
};

function formatCell(value: any, key: string): React.ReactNode {
  if (key === 'status') {
    return (
      <Chip
        label={STATUS_LABELS[value] ?? value}
        color={STATUS_COLORS[value] ?? 'default'}
        size="small"
        sx={{ fontSize: '0.65rem', height: 20 }}
      />
    );
  }
  if (key === 'amount' || key === 'outstanding') {
    return Number(value).toLocaleString('fr-FR') + ' XOF';
  }
  return value ?? '—';
}

export const TableWidget: React.FC<TableWidgetProps> = ({ data, title, pageSize = 5 }) => {
  const [page, setPage] = useState(0);
  const rows = data.rows ?? [];
  const columns = data.columns ?? [];
  const totalPages = Math.ceil(rows.length / pageSize);
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  if (rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Typography variant="caption" color="text.disabled">Aucune donnée</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell key={col.key} sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc', py: 0.75 }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row, i) => (
              <TableRow key={row.id ?? i} hover>
                {columns.map(col => (
                  <TableCell key={col.key} sx={{ fontSize: '0.75rem', py: 0.5 }}>
                    {formatCell(row[col.key], col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pt: 0.5 }}>
          <IconButton size="small" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <NavigateBefore fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">{page + 1}/{totalPages}</Typography>
          <IconButton size="small" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            <NavigateNext fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};
