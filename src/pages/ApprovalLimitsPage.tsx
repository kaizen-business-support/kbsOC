import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Snackbar, CircularProgress, Tooltip, Divider, Switch,
  FormControlLabel,
} from '@mui/material';
import {
  GavelOutlined as LimitsIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  Person as PersonIcon,
  Groups as CommitteeIcon,
  Business as ManagementIcon,
  TrendingUp as BranchIcon,
  Psychology as AnalystIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalLimit {
  id: string;
  role: string;
  displayName: string;
  minAmount: number;
  maxAmount: number;
  currency: string;
  order: number;
  reviewDuration: number;       // minutes
  maxReviewDuration: number | null;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  role: '',
  displayName: '',
  minAmount: 0,
  maxAmount: 0,
  currency: 'XOF',
  order: 1,
  reviewDuration: 480,
  maxReviewDuration: 960,
  isActive: true,
  description: '',
};

const ROLES = [
  { value: 'ACCOUNT_MANAGER',    label: 'Chargé de Compte',       icon: PersonIcon,     color: '#64b5f6' },
  { value: 'CREDIT_ANALYST',     label: 'Analyste Crédit',         icon: AnalystIcon,    color: '#81c784' },
  { value: 'ANALYST_SUPERVISOR', label: 'Superviseur Analyste',    icon: PersonIcon,     color: '#aed581' },
  { value: 'BRANCH_MANAGER',     label: 'Directeur d\'Agence',     icon: BranchIcon,     color: '#ffb74d' },
  { value: 'CREDIT_COMMITTEE',   label: 'Comité de Crédit',        icon: CommitteeIcon,  color: '#ba68c8' },
  { value: 'MANAGEMENT',         label: 'Direction Générale',      icon: ManagementIcon, color: '#ef5350' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} K`;
  return n.toLocaleString('fr-FR');
};

const fmtHours = (min: number) => {
  const h = min / 60;
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}j`;
};

const roleInfo = (role: string) => ROLES.find(r => r.value === role) ?? {
  label: role, icon: PersonIcon, color: '#9e9e9e',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props { onNavigate: (page: any) => void }

export const ApprovalLimitsPage: React.FC<Props> = () => {
  const { isRole } = useUser();
  const isAdmin     = isRole('admin');
  const canView     = isRole('admin') || isRole('management');

  const [limits, setLimits]   = useState<ApprovalLimit[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [formError, setFormError]       = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: '', ok: true });
  const show = (msg: string, ok = true) => setSnack({ open: true, msg, ok });

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const res = await ApiService.getApprovalLimits();
    if (res.success && res.data) setLimits(res.data);
    else show(res.error || 'Erreur chargement', false);
    setLoading(false);
  }, []);

  useEffect(() => { if (canView) load(); }, [canView, load]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    const nextOrder = limits.length > 0 ? Math.max(...limits.map(l => l.order ?? 1)) + 1 : 1;
    setForm({ ...EMPTY_FORM, order: nextOrder });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (l: ApprovalLimit) => {
    setEditingId(l.id);
    setForm({
      role:             l.role,
      displayName:      l.displayName,
      minAmount:        Number(l.minAmount),
      maxAmount:        Number(l.maxAmount),
      currency:         l.currency,
      order:            l.order ?? 1,
      reviewDuration:   l.reviewDuration ?? 480,
      maxReviewDuration: l.maxReviewDuration ? Number(l.maxReviewDuration) : 960,
      isActive:         l.isActive,
      description:      l.description || '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.role || !form.displayName) {
      setFormError('Rôle et libellé sont obligatoires.');
      return;
    }
    if (form.maxAmount <= form.minAmount) {
      setFormError('Le montant maximum doit être supérieur au montant minimum.');
      return;
    }
    setSaving(true);
    const payload = {
      role:             form.role,
      displayName:      form.displayName,
      minAmount:        form.minAmount,
      maxAmount:        form.maxAmount,
      currency:         form.currency,
      order:            form.order,
      reviewDuration:   form.reviewDuration,
      maxReviewDuration: form.maxReviewDuration || undefined,
      isActive:         form.isActive,
      description:      form.description || undefined,
    };
    const res = editingId
      ? await ApiService.updateApprovalLimit(editingId, payload)
      : await ApiService.createApprovalLimit(payload);
    if (res.success) {
      show(editingId ? 'Limite mise à jour' : 'Limite créée');
      setDialogOpen(false);
      load();
    } else {
      setFormError(res.error || 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await ApiService.deleteApprovalLimit(deleteId);
    if (res.success) { show('Limite supprimée'); load(); }
    else show(res.error || 'Erreur suppression', false);
    setDeleteId(null);
  };

  // ── Render guard ────────────────────────────────────────────────────────────

  if (!canView) {
    return (
      <Box p={4}>
        <Alert severity="error">Accès réservé aux administrateurs et à la Direction.</Alert>
      </Box>
    );
  }

  const sorted = [...limits].sort((a, b) => (a.order ?? 1) - (b.order ?? 1));

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <LimitsIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Approbation par Limite de Crédit</Typography>
          <Typography variant="body2" color="text.secondary">
            Définit qui approuve une demande de crédit en fonction du montant demandé
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading} size="small">
          Actualiser
        </Button>
        {isAdmin && (
          <Button startIcon={<AddIcon />} onClick={openAdd} variant="contained" size="small">
            Nouvelle limite
          </Button>
        )}
        <Chip label={isAdmin ? 'Admin' : 'Lecture seule'} color={isAdmin ? 'primary' : 'default'} size="small" />
      </Box>

      {/* ── Visualisation dynamique de la hiérarchie ────────────────────────── */}
      {!loading && sorted.filter(l => l.isActive).length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'grey.50' }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5, display: 'block' }}>
              Hiérarchie d'approbation — parcours dynamique selon le montant
            </Typography>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              {sorted.filter(l => l.isActive).map((l, i, arr) => {
                const ri = roleInfo(l.role);
                const Icon = ri.icon;
                return (
                  <React.Fragment key={l.id}>
                    <Box
                      sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        bgcolor: 'white', border: '1px solid', borderColor: 'divider',
                        borderRadius: 2, px: 2, py: 1, minWidth: 120,
                        borderLeft: `4px solid ${ri.color}`,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={0.5} mb={0.3}>
                        <Icon sx={{ fontSize: 16, color: ri.color }} />
                        <Typography variant="caption" fontWeight={700} fontSize={11}>
                          {ri.label}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontSize={10}>
                        {fmtAmt(Number(l.minAmount))} → {fmtAmt(Number(l.maxAmount))} XOF
                      </Typography>
                    </Box>
                    {i < arr.length - 1 && (
                      <ArrowIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Table des limites ───────────────────────────────────────────────── */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : limits.length === 0 ? (
        <Alert severity="info">
          Aucune limite d'approbation configurée. Cliquez sur "Nouvelle limite" pour commencer.
        </Alert>
      ) : (
        <Card>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell align="center" width={50}>Niv.</TableCell>
                  <TableCell>Rôle / Libellé</TableCell>
                  <TableCell>Plage d'approbation (XOF)</TableCell>
                  <TableCell align="center">Durée traitement</TableCell>
                  <TableCell align="center">Statut</TableCell>
                  {isAdmin && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map(l => {
                  const ri = roleInfo(l.role);
                  const Icon = ri.icon;
                  return (
                    <TableRow key={l.id} hover>
                      <TableCell align="center">
                        <Chip label={`N°${l.order ?? '—'}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Icon sx={{ fontSize: 18, color: ri.color }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{l.displayName}</Typography>
                            <Typography variant="caption" color="text.secondary">{ri.label}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {fmtAmt(Number(l.minAmount))}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">→</Typography>
                          <Typography variant="body2" fontWeight={600} color="error.main">
                            {fmtAmt(Number(l.maxAmount))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{l.currency}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={l.maxReviewDuration ? `Max : ${fmtHours(l.maxReviewDuration)}` : 'Pas de max'}>
                          <Typography variant="caption">{fmtHours(l.reviewDuration)}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={l.isActive ? 'Actif' : 'Inactif'}
                          color={l.isActive ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={() => openEdit(l)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" color="error" onClick={() => setDeleteId(l.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* ── Dialog : Créer / Modifier ───────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Modifier la limite d\'approbation' : 'Nouvelle limite d\'approbation'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>

            {/* Rôle */}
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Rôle *" required
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                disabled={!!editingId}
                helperText={editingId ? 'Le rôle ne peut pas être modifié' : ''}
              >
                {ROLES.map(r => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Libellé affiché */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Libellé affiché *" required
                placeholder="Ex : Approbation Directeur Agence"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  PLAGE D'APPROBATION (montants en XOF)
                </Typography>
              </Divider>
            </Grid>

            {/* Montant min */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Montant minimum (XOF)" type="number"
                value={form.minAmount}
                onChange={e => setForm(f => ({ ...f, minAmount: Number(e.target.value) }))}
                helperText="Montant à partir duquel ce rôle intervient"
                inputProps={{ min: 0 }}
              />
            </Grid>

            {/* Montant max */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Montant maximum (XOF)" type="number"
                value={form.maxAmount}
                onChange={e => setForm(f => ({ ...f, maxAmount: Number(e.target.value) }))}
                helperText="Montant jusqu'auquel ce rôle peut approuver"
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  DÉLAIS DE TRAITEMENT
                </Typography>
              </Divider>
            </Grid>

            {/* Durée de traitement */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Durée attendue (minutes)" type="number"
                value={form.reviewDuration}
                onChange={e => setForm(f => ({ ...f, reviewDuration: Number(e.target.value) }))}
                helperText={`≈ ${fmtHours(form.reviewDuration)} — durée normale d'examen`}
                inputProps={{ min: 30, step: 60 }}
              />
            </Grid>

            {/* Durée max */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Durée maximale (minutes)" type="number"
                value={form.maxReviewDuration ?? ''}
                onChange={e => setForm(f => ({ ...f, maxReviewDuration: e.target.value ? Number(e.target.value) : 0 }))}
                helperText={form.maxReviewDuration ? `≈ ${fmtHours(form.maxReviewDuration)} — au-delà : alerte retard` : 'Laisser 0 = pas de max'}
                inputProps={{ min: 0, step: 60 }}
              />
            </Grid>

            {/* Ordre + Devise */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Niveau hiérarchique" type="number"
                value={form.order}
                onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                helperText="1 = premier niveau d'approbation"
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Devise"
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              >
                {['XOF', 'EUR', 'USD'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Description (optionnel)" multiline rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </Grid>

            {/* Actif */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    size="small"
                  />
                }
                label="Limite active"
              />
            </Grid>

            {formError && (
              <Grid item xs={12}>
                <Alert severity="error">{formError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !form.role || !form.displayName}
          >
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            {editingId ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Confirmation suppression ──────────────────────────────── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Supprimer la limite</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Cette action est irréversible. Les demandes de crédit en cours ne seront pas affectées,
            mais les nouvelles demandes dans cette plage de montant ne trouveront plus d'approbateur.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ────────────────────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.ok ? 'success' : 'error'} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};
