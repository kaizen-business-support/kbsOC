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
import { IPRuleFormDialog, IpRule } from './IPRuleFormDialog';
import { useSecurityLock } from '../../hooks/useSecurityLock';

interface SnackState { open: boolean; severity: 'success' | 'error' | 'info'; message: string; }

export function IPRulesTab() {
  const [rows, setRows] = useState<IpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IpRule | null>(null);
  const [snack, setSnack] = useState<SnackState>({ open: false, severity: 'success', message: '' });
  const { disabled: lockDisabled, reason: lockReason } = useSecurityLock();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.security.ipRules.list({ pageSize: 100 });
      setRows(res.data.items as IpRule[]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleToggle(row: IpRule) {
    try {
      await ApiService.security.ipRules.toggle(row.id);
      setSnack({ open: true, severity: 'success', message: row.isActive ? 'Règle désactivée' : 'Règle activée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  async function handleRemove(row: IpRule) {
    if (!window.confirm(`Supprimer la règle ${row.ipAddress} ?`)) return;
    try {
      await ApiService.security.ipRules.remove(row.id);
      setSnack({ open: true, severity: 'success', message: 'Règle supprimée' });
      reload();
    } catch (e: any) {
      setSnack({ open: true, severity: 'error', message: e?.response?.data?.message ?? 'Erreur' });
    }
  }

  const columns: DataTableColumn<IpRule>[] = [
    {
      id: 'ipAddress', header: 'IP / CIDR',
      accessor: (r) => r.ipAddress,
      filter: { type: 'text' },
      render: (r) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.ipAddress}</Box>
      ),
    },
    {
      id: 'ruleType', header: 'Type',
      accessor: (r) => r.ruleType,
      filter: { type: 'enum', options: [{ value: 'ALLOW', label: 'Autoriser' }, { value: 'DENY', label: 'Bloquer' }] },
      render: (r) => (
        <Chip
          label={r.ruleType === 'ALLOW' ? 'Autoriser' : 'Bloquer'}
          size="small"
          sx={{
            fontWeight: 600,
            bgcolor: r.ruleType === 'ALLOW' ? '#d1fae5' : '#fee2e2',
            color: r.ruleType === 'ALLOW' ? '#065f46' : '#9F1239',
            border: 'none',
          }}
        />
      ),
    },
    {
      id: 'scope', header: 'Portée',
      accessor: (r) => (r.companyId === null ? 'platform' : 'tenant'),
      filter: { type: 'enum', options: [{ value: 'platform', label: 'Plateforme' }, { value: 'tenant', label: 'Tenant' }] },
      render: (r) => r.companyId === null
        ? <Chip label="Plateforme" size="small" sx={{ bgcolor: colors.accent.muted, color: colors.accent.primary, fontWeight: 600, border: 'none' }} />
        : <Chip label="Tenant"    size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none' }} />,
    },
    {
      id: 'description', header: 'Description',
      accessor: (r) => r.description ?? '',
      filter: { type: 'text' },
    },
    {
      id: 'isActive', header: 'Statut',
      accessor: (r) => (r.isActive ? 'active' : 'inactive'),
      filter: { type: 'enum', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      render: (r) => (
        <Switch checked={r.isActive} onChange={() => handleToggle(r)} disabled={lockDisabled} size="small" />
      ),
    },
    {
      id: 'actions', header: 'Actions',
      accessor: () => '',
      filter: { type: 'none' },
      sortable: false,
      align: 'right',
      render: (r) => (
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
          Ajouter une règle
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        pageSize={20}
        loading={loading}
        emptyMessage="Aucune règle IP configurée"
      />

      <IPRuleFormDialog
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
