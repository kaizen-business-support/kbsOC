import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, IconButton, MenuItem, Paper, Snackbar, TextField, Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DataTable, DataTableColumn } from '../common/DataTable';
import { ApiService } from '../../services/api';
import { colors } from '../home/homeTokens';
import { UnblockDialog } from './UnblockDialog';

interface BlockHistoryRow {
  id: string;
  blockedIp: string;
  attemptedUser: { id: string; name: string } | null;
  blockReason: 'IP_BLACKLISTED' | 'OUTSIDE_TIME_WINDOW' | 'BRUTE_FORCE' | 'MANUAL';
  requestPath: string | null;
  userAgent: string | null;
  status: 'BLOCKED' | 'UNBLOCKED';
  unblocker: { id: string; name: string } | null;
  unblockedAt: string | null;
  unblockNote: string | null;
  createdAt: string;
}

const REASON_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  IP_BLACKLISTED:      { bg: '#fee2e2', color: '#9F1239', label: 'IP bloquée' },
  OUTSIDE_TIME_WINDOW: { bg: '#fef3c7', color: '#92400e', label: 'Hors plage' },
  BRUTE_FORCE:         { bg: '#fce7f3', color: '#9d174d', label: 'Brute-force' },
  MANUAL:              { bg: '#f1f5f9', color: '#475569', label: 'Manuel' },
};

const REASON_OPTIONS = Object.entries(REASON_COLORS).map(([value, c]) => ({ value, label: c.label }));

interface SnackState { open: boolean; severity: 'success' | 'error' | 'info' | 'warning'; message: string; }

export function BlockHistoryTab() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    blockedIp: searchParams.get('blockedIp') ?? '',
    reason:    searchParams.get('reason') ?? '',
    status:    searchParams.get('status') ?? '',
    userId:    searchParams.get('userId') ?? '',
    dateFrom:  searchParams.get('dateFrom') ?? '',
    dateTo:    searchParams.get('dateTo') ?? '',
  }), [searchParams]);

  const [rows, setRows] = useState<BlockHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, severity: 'success', message: '' });

  const [unblockEntry, setUnblockEntry] = useState<BlockHistoryRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  const buildParams = useCallback(() => {
    const out: Record<string, string> = {};
    if (filters.blockedIp) out.blockedIp = filters.blockedIp;
    if (filters.reason)    out.reason    = filters.reason;
    if (filters.status)    out.status    = filters.status;
    if (filters.userId)    out.userId    = filters.userId;
    if (filters.dateFrom)  out.dateFrom  = filters.dateFrom;
    if (filters.dateTo)    out.dateTo    = filters.dateTo;
    return out;
  }, [filters]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.security.blockHistory.list({ ...buildParams(), pageSize: 100 } as any);
      setRows(res.data.items as BlockHistoryRow[]);
      setTotal(res.data.total);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { reload(); }, [reload]);

  async function handleUnblockOne(note: string) {
    if (!unblockEntry) return;
    await ApiService.security.blockHistory.unblock(unblockEntry.id, note);
    setSnack({ open: true, severity: 'success', message: 'Entrée débloquée' });
    reload();
  }

  async function handleUnblockBulk(note: string) {
    const res = await ApiService.security.blockHistory.unblockAll(buildParams(), note);
    setSnack({ open: true, severity: 'success', message: `${res.data.affected} entrées débloquées` });
    reload();
  }

  function handleExport() {
    const url = ApiService.security.blockHistory.exportCsvUrl(buildParams());
    window.location.href = url;
  }

  const blockedCount = rows.filter(r => r.status === 'BLOCKED').length;

  const columns: DataTableColumn<BlockHistoryRow>[] = [
    {
      id: 'createdAt', header: 'Date',
      accessor: r => r.createdAt,
      filter: { type: 'none' }, sortable: true,
      render: r => <Box component="span" sx={{ fontSize: 12.5, fontFamily: 'monospace' }}>{new Date(r.createdAt).toLocaleString('fr-FR')}</Box>,
    },
    {
      id: 'blockedIp', header: 'IP',
      accessor: r => r.blockedIp,
      filter: { type: 'none' },
      render: r => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.blockedIp}</Box>,
    },
    {
      id: 'blockReason', header: 'Raison',
      accessor: r => r.blockReason,
      filter: { type: 'none' },
      render: r => {
        const c = REASON_COLORS[r.blockReason] ?? { bg: '#f1f5f9', color: '#475569', label: r.blockReason };
        return <Chip label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, border: 'none' }} />;
      },
    },
    {
      id: 'user', header: 'Utilisateur',
      accessor: r => r.attemptedUser?.name ?? '',
      filter: { type: 'none' },
      render: r => r.attemptedUser
        ? <span>{r.attemptedUser.name}</span>
        : <span style={{ color: colors.text.muted, fontStyle: 'italic' }}>—</span>,
    },
    {
      id: 'path', header: 'Path',
      accessor: r => r.requestPath ?? '',
      filter: { type: 'none' },
      render: r => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.requestPath ?? '—'}</Box>,
    },
    {
      id: 'status', header: 'Statut',
      accessor: r => r.status,
      filter: { type: 'none' },
      render: r => (
        <Chip
          label={r.status === 'BLOCKED' ? 'Bloquée' : 'Débloquée'}
          size="small"
          sx={{
            bgcolor: r.status === 'BLOCKED' ? '#fee2e2' : '#d1fae5',
            color:   r.status === 'BLOCKED' ? '#9F1239' : '#065f46',
            fontWeight: 600, border: 'none',
          }}
        />
      ),
    },
    {
      id: 'unblocker', header: 'Débloqué par',
      accessor: r => r.unblocker?.name ?? '',
      filter: { type: 'none' },
      render: r => r.unblocker
        ? <Box sx={{ fontSize: 12.5 }}>
            {r.unblocker.name}
            <Box sx={{ color: colors.text.muted, fontSize: 11 }}>{r.unblockedAt ? new Date(r.unblockedAt).toLocaleDateString('fr-FR') : ''}</Box>
          </Box>
        : <span style={{ color: colors.text.muted }}>—</span>,
    },
    {
      id: 'actions', header: 'Actions',
      accessor: () => '',
      filter: { type: 'none' }, sortable: false, align: 'right',
      render: r => r.status === 'BLOCKED' ? (
        <Tooltip title="Débloquer">
          <IconButton size="small" onClick={() => setUnblockEntry(r)}>
            <LockOpenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null,
    },
  ];

  return (
    <Box sx={{ mt: 3 }}>
      {/* Header actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Box sx={{ fontSize: 13, color: colors.text.secondary }}>
          {total > 0 ? `${total} entrée${total > 1 ? 's' : ''} au total` : 'Aucune entrée'}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {blockedCount > 0 && (
            <Button
              startIcon={<LockOpenIcon />}
              variant="outlined"
              size="small"
              onClick={() => setBulkOpen(true)}
            >
              Débloquer tout ({blockedCount})
            </Button>
          )}
          <Button
            startIcon={<DownloadIcon />}
            variant="contained"
            size="small"
            onClick={handleExport}
            sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
          >
            Exporter CSV
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, border: `1px solid ${colors.border.default}`, boxShadow: 'none' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, gap: 1.5 }}>
          <TextField size="small" label="IP" value={filters.blockedIp} onChange={e => updateFilter('blockedIp', e.target.value)} />
          <TextField select size="small" label="Raison" value={filters.reason} onChange={e => updateFilter('reason', e.target.value)}>
            <MenuItem value=""><em>Toutes</em></MenuItem>
            {REASON_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Statut" value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
            <MenuItem value=""><em>Tous</em></MenuItem>
            <MenuItem value="BLOCKED">Bloquée</MenuItem>
            <MenuItem value="UNBLOCKED">Débloquée</MenuItem>
          </TextField>
          <TextField size="small" label="User ID" value={filters.userId} onChange={e => updateFilter('userId', e.target.value)} />
          <TextField size="small" type="date" label="Du" InputLabelProps={{ shrink: true }} value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} />
          <TextField size="small" type="date" label="Au" InputLabelProps={{ shrink: true }} value={filters.dateTo}   onChange={e => updateFilter('dateTo', e.target.value)} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button size="small" startIcon={<RestartAltIcon />} onClick={resetFilters}>Reset filtres</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={r => r.id}
        pageSize={20}
        loading={loading}
        emptyMessage="Aucune entrée correspondante"
      />

      <UnblockDialog
        open={!!unblockEntry}
        entry={unblockEntry}
        onClose={() => setUnblockEntry(null)}
        onConfirm={handleUnblockOne}
      />

      <UnblockDialog
        open={bulkOpen}
        bulkCount={blockedCount}
        onClose={() => setBulkOpen(false)}
        onConfirm={handleUnblockBulk}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
