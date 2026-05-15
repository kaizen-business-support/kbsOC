import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Snackbar, Switch, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DataTable, DataTableColumn } from '../common/DataTable';
import { ApiService } from '../../services/api';
import { colors } from '../home/homeTokens';
import { TimeRuleFormDialog, TimeRule } from './TimeRuleFormDialog';
import { useSecurityLock } from '../../hooks/useSecurityLock';

interface SnackState { open: boolean; severity: 'success' | 'error' | 'info'; message: string; }

function formatDays(bitmask: number): string {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return labels.map((l, i) => (bitmask & (1 << i)) ? l : '·').join(' ');
}

const APPLIES_TO_LABEL: Record<string, string> = {
  ALL: 'Tous', BRANCH: 'Agence', DEPARTMENT: 'Département', ROLE: 'Rôle', USER: 'Utilisateur',
};

export function TimeRulesTab() {
  const [rows, setRows] = useState<TimeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeRule | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, severity: 'success', message: '' });
  const { disabled: lockDisabled, reason: lockReason } = useSecurityLock();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.security.timeRules.list({ pageSize: 100 });
      setRows(res.data.items as TimeRule[]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleToggle(row: TimeRule) {
    try {
      await ApiService.security.timeRules.toggle(row.id);
      setSnack({ open: true, severity: 'success', message: row.isActive ? 'Règle désactivée' : 'Règle activée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  async function handleRemove(row: TimeRule) {
    if (!window.confirm(`Supprimer la règle "${row.name}" ?`)) return;
    try {
      await ApiService.security.timeRules.remove(row.id);
      setSnack({ open: true, severity: 'success', message: 'Règle supprimée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  const columns: DataTableColumn<TimeRule>[] = [
    { id: 'name', header: 'Nom', accessor: r => r.name, filter: { type: 'text' } },
    {
      id: 'days', header: 'Jours',
      accessor: r => r.daysOfWeek,
      filter: { type: 'none' }, sortable: false,
      render: r => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{formatDays(r.daysOfWeek)}</Box>,
    },
    {
      id: 'window', header: 'Plage',
      accessor: r => `${r.timeStart}-${r.timeEnd}`,
      filter: { type: 'text' },
      render: r => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.timeStart}–{r.timeEnd}</Box>,
    },
    {
      id: 'timezone', header: 'Timezone',
      accessor: r => r.timezone,
      filter: { type: 'text' },
    },
    {
      id: 'appliesTo', header: 'Portée',
      accessor: r => r.appliesTo,
      filter: {
        type: 'enum',
        options: Object.entries(APPLIES_TO_LABEL).map(([value, label]) => ({ value, label })),
      },
      render: r => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label={APPLIES_TO_LABEL[r.appliesTo] ?? r.appliesTo} size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none' }} />
          {r.companyId === null && (
            <Chip label="Plateforme" size="small" sx={{ bgcolor: colors.accent.muted, color: colors.accent.primary, fontWeight: 600, border: 'none' }} />
          )}
        </Box>
      ),
    },
    {
      id: 'isActive', header: 'Statut',
      accessor: r => (r.isActive ? 'active' : 'inactive'),
      filter: { type: 'enum', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      render: r => <Switch checked={r.isActive} onChange={() => handleToggle(r)} disabled={lockDisabled} size="small" />,
    },
    {
      id: 'actions', header: 'Actions',
      accessor: () => '',
      filter: { type: 'none' }, sortable: false, align: 'right',
      render: r => (
        <>
          <Tooltip title={lockDisabled ? lockReason ?? '' : 'Modifier'}>
            <span>
              <IconButton size="small" disabled={lockDisabled} onClick={() => { setEditing(r); setDialogOpen(true); }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={lockDisabled ? lockReason ?? '' : 'Supprimer'}>
            <span>
              <IconButton size="small" disabled={lockDisabled} onClick={() => handleRemove(r)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          disabled={lockDisabled}
          title={lockDisabled ? lockReason ?? '' : undefined}
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          Ajouter une plage
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        pageSize={20}
        loading={loading}
        emptyMessage="Aucune plage horaire configurée"
      />

      <TimeRuleFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setSnack({ open: true, severity: 'success', message: editing ? 'Règle modifiée' : 'Règle créée' }); reload(); }}
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
