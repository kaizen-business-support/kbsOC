import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Chip, CircularProgress, Alert,
  Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { scopeDelegateApi } from '../../services/api';

const SCOPE_LABELS: Record<string, string> = {
  BRANCH_ONLY: 'Agence uniquement',
  MULTI_BRANCH: 'Multi-agences',
  ALL_BRANCHES: 'Tout le réseau',
};

interface ScopeDelegate {
  id: string;
  scope: string;
  allowedBranches: string[];
  allowedActions: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  delegator: { id: string; name: string; role: string };
  delegate: { id: string; name: string; role: string };
}

interface User { id: string; name: string; role: string; isActive: boolean; }

interface Props {
  users: User[];
}

const emptyForm = {
  delegateId: '',
  scope: 'BRANCH_ONLY',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
};

export const ScopeDelegateManager: React.FC<Props> = ({ users }) => {
  const [delegates, setDelegates] = useState<ScopeDelegate[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const load = async () => {
    setLoading(true);
    const res = await scopeDelegateApi.list();
    if (res.success) setDelegates(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDialog = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const create = async () => {
    if (!form.delegateId || !form.scope || !form.startDate) return;
    setSaving(true);
    const res = await scopeDelegateApi.create({
      delegateId: form.delegateId,
      scope: form.scope,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    });
    setSaving(false);
    if (res.success) {
      setDialogOpen(false);
      await load();
      setSnack({ open: true, msg: 'Délégation de scope créée', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  const revoke = async (id: string) => {
    const res = await scopeDelegateApi.revoke(id);
    if (res.success) {
      await load();
      setSnack({ open: true, msg: 'Délégation révoquée', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Délégations de périmètre de données</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openDialog}>
          Nouvelle délégation
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
        Ces délégations permettent à un utilisateur d'approuver ou d'accéder aux données d'agences
        supplémentaires pendant une période définie. Elles élargissent le scope, ne le réduisent pas.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : delegates.length === 0 ? (
        <Alert severity="info">Aucune délégation de scope active.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Délégant</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Délégué</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Scope accordé</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Période</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {delegates.map(d => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{d.delegator.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{d.delegator.role}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{d.delegate.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{d.delegate.role}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={SCOPE_LABELS[d.scope] ?? d.scope}
                      size="small"
                      color={d.scope === 'ALL_BRANCHES' ? 'error' : d.scope === 'MULTI_BRANCH' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                    {new Date(d.startDate).toLocaleDateString('fr-FR')}
                    {d.endDate ? ` → ${new Date(d.endDate).toLocaleDateString('fr-FR')}` : ' (indéfini)'}
                  </TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={() => revoke(d.id)}>
                      Révoquer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle délégation de périmètre</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Utilisateur délégué</InputLabel>
            <Select
              value={form.delegateId}
              label="Utilisateur délégué"
              onChange={e => setForm(p => ({ ...p, delegateId: e.target.value }))}
            >
              {users.filter(u => u.isActive).map(u => (
                <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Scope à déléguer</InputLabel>
            <Select
              value={form.scope}
              label="Scope à déléguer"
              onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
            >
              {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Date de début"
            type="date"
            size="small"
            value={form.startDate}
            onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Date de fin (optionnel)"
            type="date"
            size="small"
            value={form.endDate}
            onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={create}
            disabled={!form.delegateId || saving}
            startIcon={saving ? <CircularProgress size={14} /> : undefined}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(p => ({ ...p, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
