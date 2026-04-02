import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Tabs, Tab, Alert, Snackbar, Switch, FormControlLabel, Tooltip,
  Grid, Divider, CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Policy as PolicyIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Visibility as PreviewIcon,
  BarChart as AnalyticsIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { creditPolicyApi } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPolicyStep {
  id: string;
  policyId: string;
  stepName: string;
  stepLabel: string;
  order: number;
  stepType: 'DISPATCH' | 'ANALYSIS' | 'APPROVAL' | 'COMMITTEE';
  assignedRole: string;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  approvalMinAmount: number | null;
  approvalMaxAmount: number | null;
  expectedDurationHours: number;
  maxDurationHours: number;
  isRequired: boolean;
  isActive: boolean;
  description: string | null;
  creditTypeIds: string[];
}

interface CreditPolicy {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  version: number;
  validFrom: string;
  validTo: string | null;
  steps: CreditPolicyStep[];
  _count?: { steps: number; applications: number };
}

const STEP_TYPES = [
  { value: 'DISPATCH',  label: 'Dispatch',     color: '#2196f3' },
  { value: 'ANALYSIS',  label: 'Analyse',      color: '#ff9800' },
  { value: 'APPROVAL',  label: 'Approbation',  color: '#4caf50' },
  { value: 'COMMITTEE', label: 'Comité',       color: '#9c27b0' },
];

const ROLES = [
  { value: 'ACCOUNT_MANAGER',    label: 'Chargé de Compte' },
  { value: 'CREDIT_ANALYST',     label: 'Analyste Crédit' },
  { value: 'ANALYST_SUPERVISOR', label: 'Superviseur Analyste' },
  { value: 'BRANCH_MANAGER',     label: 'Directeur d\'Agence' },
  { value: 'CREDIT_COMMITTEE',   label: 'Comité de Crédit' },
  { value: 'MANAGEMENT',         label: 'Direction' },
];

const EMPTY_STEP: Omit<CreditPolicyStep, 'id' | 'policyId'> = {
  stepName: '',
  stepLabel: '',
  order: 1,
  stepType: 'APPROVAL',
  assignedRole: 'CREDIT_ANALYST',
  conditionMinAmount: null,
  conditionMaxAmount: null,
  approvalMinAmount: null,
  approvalMaxAmount: null,
  expectedDurationHours: 24,
  maxDurationHours: 72,
  isRequired: true,
  isActive: true,
  description: null,
  creditTypeIds: [],
};

const fmt = (n: number | null) =>
  n !== null ? n.toLocaleString('fr-FR') + ' XOF' : '—';

const fmtHours = (h: number) =>
  h < 24 ? `${h}h` : `${Math.round(h / 24)}j`;

// ─── Page principale ──────────────────────────────────────────────────────────

export function CreditPolicyPage() {
  const { isRole } = useUser();
  const isAdmin = isRole('admin') || isRole('management');

  const [tab, setTab] = useState(0);
  const [policies, setPolicies] = useState<CreditPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<CreditPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<CreditPolicy | null>(null);
  const [editingStep, setEditingStep] = useState<CreditPolicyStep | null>(null);

  // Forms
  const [policyForm, setPolicyForm] = useState({ name: '', code: '', description: '', validFrom: '', validTo: '' });
  const [stepForm, setStepForm] = useState<Omit<CreditPolicyStep, 'id' | 'policyId'>>(EMPTY_STEP);

  // Preview
  const [previewCreditTypeId, setPreviewCreditTypeId] = useState('');
  const [previewAmount, setPreviewAmount] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creditTypes, setCreditTypes] = useState<{ id: string; name: string }[]>([]);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  const showSnack = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnack({ open: true, message, severity });

  // ── Chargement ──────────────────────────────────────────────────────────────

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    const res = await creditPolicyApi.getPolicies();
    if (res.success && res.data) {
      setPolicies(res.data);
      const active = res.data.find((p: CreditPolicy) => p.isActive) || res.data[0] || null;
      setSelectedPolicy(active);
    }
    setLoading(false);
  }, []);

  const loadCreditTypes = useCallback(async () => {
    const res = await creditPolicyApi.getCreditTypes();
    if (res.success && res.data) setCreditTypes(res.data);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    const res = await creditPolicyApi.getAnalytics();
    if (res.success) setAnalytics(res.data);
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadPolicies(); loadCreditTypes(); }, [loadPolicies, loadCreditTypes]);
  useEffect(() => { if (tab === 3) loadAnalytics(); }, [tab, loadAnalytics]);

  // ── Gestion des politiques ──────────────────────────────────────────────────

  const openCreatePolicy = () => {
    setEditingPolicy(null);
    setPolicyForm({ name: '', code: '', description: '', validFrom: '', validTo: '' });
    setPolicyDialogOpen(true);
  };

  const openEditPolicy = (p: CreditPolicy) => {
    setEditingPolicy(p);
    setPolicyForm({
      name: p.name,
      code: p.code,
      description: p.description || '',
      validFrom: p.validFrom?.slice(0, 10) || '',
      validTo: p.validTo?.slice(0, 10) || '',
    });
    setPolicyDialogOpen(true);
  };

  const savePolicy = async () => {
    if (!policyForm.name || !policyForm.code) return;
    const payload = {
      name: policyForm.name,
      code: policyForm.code,
      description: policyForm.description || null,
      validFrom: policyForm.validFrom || undefined,
      validTo: policyForm.validTo || null,
    };
    const res = editingPolicy
      ? await creditPolicyApi.updatePolicy(editingPolicy.id, payload)
      : await creditPolicyApi.createPolicy(payload);
    if (res.success) {
      showSnack(editingPolicy ? 'Politique mise à jour' : 'Politique créée et activée');
      setPolicyDialogOpen(false);
      loadPolicies();
    } else {
      showSnack(res.error || 'Erreur', 'error');
    }
  };

  const togglePolicyActive = async (p: CreditPolicy) => {
    const res = await creditPolicyApi.updatePolicy(p.id, { isActive: !p.isActive });
    if (res.success) { showSnack(`Politique ${p.isActive ? 'désactivée' : 'activée'}`); loadPolicies(); }
    else showSnack(res.error || 'Erreur', 'error');
  };

  // ── Gestion des étapes ──────────────────────────────────────────────────────

  const openAddStep = () => {
    if (!selectedPolicy) return;
    setEditingStep(null);
    const nextOrder = (selectedPolicy.steps?.length ?? 0) + 1;
    setStepForm({ ...EMPTY_STEP, order: nextOrder });
    setStepDialogOpen(true);
  };

  const openEditStep = (step: CreditPolicyStep) => {
    setEditingStep(step);
    setStepForm({ ...step });
    setStepDialogOpen(true);
  };

  const saveStep = async () => {
    if (!selectedPolicy || !stepForm.stepName || !stepForm.stepLabel) return;
    const res = editingStep
      ? await creditPolicyApi.updateStep(selectedPolicy.id, editingStep.id, stepForm)
      : await creditPolicyApi.createStep(selectedPolicy.id, stepForm);
    if (res.success) {
      showSnack(editingStep ? 'Étape mise à jour' : 'Étape ajoutée');
      setStepDialogOpen(false);
      loadPolicies();
    } else {
      showSnack(res.error || 'Erreur', 'error');
    }
  };

  const deleteStep = async () => {
    if (!selectedPolicy || !deleteStepId) return;
    const res = await creditPolicyApi.deleteStep(selectedPolicy.id, deleteStepId);
    if (res.success) { showSnack('Étape supprimée'); setDeleteStepId(null); loadPolicies(); }
    else showSnack(res.error || 'Erreur', 'error');
  };

  // ── Prévisualisation ────────────────────────────────────────────────────────

  const runPreview = async () => {
    if (!previewCreditTypeId || !previewAmount) return;
    setPreviewLoading(true);
    const res = await creditPolicyApi.preview(previewCreditTypeId, Number(previewAmount));
    if (res.success) setPreviewResult(res.data);
    else showSnack(res.error || 'Erreur prévisualisation', 'error');
    setPreviewLoading(false);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <Box p={4}>
        <Alert severity="warning">
          Accès réservé aux administrateurs et à la Direction.
        </Alert>
      </Box>
    );
  }

  const steps = selectedPolicy?.steps ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <PolicyIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Politique de Crédit</Typography>
          <Typography variant="body2" color="text.secondary">
            Définissez le circuit de traitement, les profils valideurs et les plafonds d'approbation
          </Typography>
        </Box>
        <Chip label="Admin" color="primary" size="small" />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Politiques" />
        <Tab label={`Étapes${selectedPolicy ? ` — ${selectedPolicy.name}` : ''}`} disabled={!selectedPolicy} />
        <Tab label="Prévisualisation" />
        <Tab label="Analytiques" />
      </Tabs>

      {/* ── Tab 0 : Liste des politiques ────────────────────────────────────── */}
      {tab === 0 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Politiques configurées</Typography>
              <Box display="flex" gap={1}>
                <Button startIcon={<RefreshIcon />} onClick={loadPolicies} disabled={loading} size="small">
                  Actualiser
                </Button>
                <Button startIcon={<AddIcon />} onClick={openCreatePolicy} variant="contained" size="small">
                  Nouvelle politique
                </Button>
              </Box>
            </Box>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : policies.length === 0 ? (
              <Alert severity="info">
                Aucune politique configurée. Créez la première politique de crédit.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell>Politique</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell align="center">Version</TableCell>
                      <TableCell align="center">Étapes</TableCell>
                      <TableCell align="center">Dossiers</TableCell>
                      <TableCell>Validité</TableCell>
                      <TableCell align="center">Statut</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {policies.map(p => (
                      <TableRow
                        key={p.id}
                        hover
                        selected={selectedPolicy?.id === p.id}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => { setSelectedPolicy(p); setTab(1); }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                            {p.description && (
                              <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell><code style={{ fontSize: 12 }}>{p.code}</code></TableCell>
                        <TableCell align="center">
                          <Chip label={`v${p.version}`} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">{p._count?.steps ?? p.steps?.length ?? 0}</TableCell>
                        <TableCell align="center">{p._count?.applications ?? '—'}</TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(p.validFrom).toLocaleDateString('fr-FR')}
                            {p.validTo ? ` → ${new Date(p.validTo).toLocaleDateString('fr-FR')}` : ' → ∞'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={p.isActive ? <ActiveIcon /> : <InactiveIcon />}
                            label={p.isActive ? 'Active' : 'Inactive'}
                            color={p.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={p.isActive ? 'Désactiver' : 'Activer'}>
                            <Switch
                              size="small"
                              checked={p.isActive}
                              onClick={e => { e.stopPropagation(); togglePolicyActive(p); }}
                            />
                          </Tooltip>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); openEditPolicy(p); }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab 1 : Étapes de la politique sélectionnée ─────────────────────── */}
      {tab === 1 && selectedPolicy && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h6">Circuit de traitement</Typography>
                <Typography variant="body2" color="text.secondary">
                  Politique : <strong>{selectedPolicy.name}</strong> — v{selectedPolicy.version}
                </Typography>
              </Box>
              <Button startIcon={<AddIcon />} onClick={openAddStep} variant="contained" size="small">
                Ajouter une étape
              </Button>
            </Box>

            {steps.length === 0 ? (
              <Alert severity="info">
                Aucune étape configurée. Ajoutez les étapes du circuit (dispatch → analyse → approbation…).
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell align="center" width={50}>#</TableCell>
                      <TableCell>Étape</TableCell>
                      <TableCell align="center">Type</TableCell>
                      <TableCell>Profil responsable</TableCell>
                      <TableCell>Conditions montant</TableCell>
                      <TableCell>Plafond approbation</TableCell>
                      <TableCell align="center">SLA</TableCell>
                      <TableCell align="center">Statut</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...steps].sort((a, b) => a.order - b.order).map((step, idx) => {
                      const typeInfo = STEP_TYPES.find(t => t.value === step.stepType);
                      const roleInfo = ROLES.find(r => r.value === step.assignedRole);
                      return (
                        <TableRow key={step.id} hover>
                          <TableCell align="center">
                            <Box display="flex" flexDirection="column" alignItems="center" gap={0.2}>
                              <Typography variant="caption" fontWeight={700}>{step.order}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{step.stepLabel}</Typography>
                            <Typography variant="caption" color="text.secondary">{step.stepName}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={typeInfo?.label ?? step.stepType}
                              size="small"
                              sx={{ bgcolor: typeInfo?.color + '22', color: typeInfo?.color, fontWeight: 600, fontSize: 11 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{roleInfo?.label ?? step.assignedRole}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {step.conditionMinAmount !== null || step.conditionMaxAmount !== null
                                ? `${fmt(step.conditionMinAmount)} → ${fmt(step.conditionMaxAmount)}`
                                : 'Toujours actif'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {step.approvalMinAmount !== null || step.approvalMaxAmount !== null
                                ? `${fmt(step.approvalMinAmount)} → ${fmt(step.approvalMaxAmount)}`
                                : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={`Max : ${fmtHours(step.maxDurationHours)}`}>
                              <Typography variant="caption">
                                {fmtHours(step.expectedDurationHours)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={step.isActive ? 'Actif' : 'Inactif'}
                              color={step.isActive ? 'success' : 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Modifier">
                              <IconButton size="small" onClick={() => openEditStep(step)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton size="small" color="error" onClick={() => setDeleteStepId(step.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab 2 : Prévisualisation du circuit ─────────────────────────────── */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <PreviewIcon color="primary" />
              <Typography variant="h6">Simuler le circuit de traitement</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Saisissez un type de crédit et un montant pour visualiser quelles étapes s'appliqueront selon la politique active.
            </Alert>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} sm={5}>
                <TextField
                  select fullWidth size="small" label="Type de crédit"
                  value={previewCreditTypeId}
                  onChange={e => setPreviewCreditTypeId(e.target.value)}
                >
                  {creditTypes.map(ct => (
                    <MenuItem key={ct.id} value={ct.id}>{ct.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="Montant (XOF)" type="number"
                  value={previewAmount}
                  onChange={e => setPreviewAmount(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button
                  fullWidth variant="contained"
                  onClick={runPreview}
                  disabled={!previewCreditTypeId || !previewAmount || previewLoading}
                  startIcon={previewLoading ? <CircularProgress size={16} /> : <PreviewIcon />}
                >
                  Simuler
                </Button>
              </Grid>
            </Grid>

            {previewResult && (
              <Box mt={4}>
                <Divider sx={{ mb: 2 }} />
                <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                  <Chip label={`Politique : ${previewResult.policyName ?? 'Ancien circuit'}`} color="primary" />
                  <Chip label={`${previewResult.steps?.length} étapes applicables`} />
                  <Chip label={`~${previewResult.estimatedDurationDays}j estimés`} variant="outlined" />
                </Box>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Étape</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Profil</TableCell>
                        <TableCell>Durée estimée</TableCell>
                        <TableCell>Conditionnel</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewResult.steps?.map((s: any, i: number) => {
                        const typeInfo = STEP_TYPES.find(t => t.value === s.stepType);
                        const roleInfo = ROLES.find(r => r.value === s.role);
                        return (
                          <TableRow key={i}>
                            <TableCell>{s.order ?? i + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.stepLabel}</Typography>
                            </TableCell>
                            <TableCell>
                              {s.stepType ? (
                                <Chip label={typeInfo?.label ?? s.stepType} size="small"
                                  sx={{ bgcolor: (typeInfo?.color ?? '#999') + '22', color: typeInfo?.color ?? '#999' }} />
                              ) : '—'}
                            </TableCell>
                            <TableCell>{roleInfo?.label ?? s.role}</TableCell>
                            <TableCell>{fmtHours(s.expectedDurationHours ?? s.durationDays * 24)}</TableCell>
                            <TableCell>
                              {s.isConditional
                                ? <Chip label="Conditionnel" size="small" color="warning" variant="outlined" />
                                : <Chip label="Toujours" size="small" color="success" variant="outlined" />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab 3 : Analytiques ─────────────────────────────────────────────── */}
      {tab === 3 && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <AnalyticsIcon color="primary" />
              <Typography variant="h6">Temps de traitement par étape</Typography>
              <Box flex={1} />
              <Button startIcon={<RefreshIcon />} onClick={loadAnalytics} disabled={analyticsLoading} size="small">
                Actualiser
              </Button>
            </Box>

            {analyticsLoading ? (
              <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
            ) : !analytics ? (
              <Alert severity="info">Aucune donnée disponible.</Alert>
            ) : (
              <>
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {analytics.totalApplications}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Dossiers analysés</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {analytics.averageTotalDurationMinutes !== null
                          ? `${Math.round(analytics.averageTotalDurationMinutes / 60)}h`
                          : '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Durée moyenne totale</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {analytics.stepAverages?.filter((s: any) => s.overdueRate > 0).length ?? 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Étapes avec retards</Typography>
                    </Card>
                  </Grid>
                </Grid>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell>Étape</TableCell>
                        <TableCell align="center">Dossiers traités</TableCell>
                        <TableCell align="center">Durée moyenne</TableCell>
                        <TableCell align="center">Taux de retard</TableCell>
                        <TableCell>Indicateur</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.stepAverages
                        ?.sort((a: any, b: any) => b.averageDurationMinutes - a.averageDurationMinutes)
                        .map((s: any) => (
                          <TableRow key={s.stepName} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.stepName}</Typography>
                            </TableCell>
                            <TableCell align="center">{s.count}</TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight={600}>
                                {s.averageDurationMinutes < 60
                                  ? `${s.averageDurationMinutes} min`
                                  : `${Math.round(s.averageDurationMinutes / 60)} h`}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${s.overdueRate}%`}
                                size="small"
                                color={s.overdueRate > 30 ? 'error' : s.overdueRate > 10 ? 'warning' : 'success'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{
                                  height: 6,
                                  width: `${Math.min(100, (s.averageDurationMinutes / 480) * 100)}%`,
                                  minWidth: 4,
                                  bgcolor: s.overdueRate > 30 ? 'error.main' : s.overdueRate > 10 ? 'warning.main' : 'success.main',
                                  borderRadius: 3,
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dialog : Politique ──────────────────────────────────────────────── */}
      <Dialog open={policyDialogOpen} onClose={() => setPolicyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPolicy ? 'Modifier la politique' : 'Nouvelle politique de crédit'}</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Nom de la politique" fullWidth size="small" required
              value={policyForm.name}
              onChange={e => setPolicyForm(f => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Code unique" fullWidth size="small" required
              placeholder="POL-2024-001"
              value={policyForm.code}
              onChange={e => setPolicyForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              disabled={!!editingPolicy}
              helperText={editingPolicy ? 'Le code ne peut pas être modifié' : ''}
            />
            <TextField
              label="Description" fullWidth size="small" multiline rows={2}
              value={policyForm.description}
              onChange={e => setPolicyForm(f => ({ ...f, description: e.target.value }))}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Valide à partir du" type="date" fullWidth size="small"
                  InputLabelProps={{ shrink: true }}
                  value={policyForm.validFrom}
                  onChange={e => setPolicyForm(f => ({ ...f, validFrom: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Valide jusqu'au" type="date" fullWidth size="small"
                  InputLabelProps={{ shrink: true }}
                  value={policyForm.validTo}
                  onChange={e => setPolicyForm(f => ({ ...f, validTo: e.target.value }))}
                  helperText="Laisser vide = indéfini"
                />
              </Grid>
            </Grid>
            {!editingPolicy && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                La création d'une nouvelle politique désactivera automatiquement la politique actuellement active.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={savePolicy}
            disabled={!policyForm.name || !policyForm.code}
          >
            {editingPolicy ? 'Mettre à jour' : 'Créer et activer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Étape ──────────────────────────────────────────────────── */}
      <Dialog open={stepDialogOpen} onClose={() => setStepDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingStep ? 'Modifier l\'étape' : 'Ajouter une étape au circuit'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Identifiant (slug)" fullWidth size="small" required
                placeholder="supervisor_approval"
                value={stepForm.stepName}
                onChange={e => setStepForm(f => ({ ...f, stepName: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                helperText="Identifiant technique sans espaces"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Libellé affiché" fullWidth size="small" required
                placeholder="Validation Superviseur"
                value={stepForm.stepLabel}
                onChange={e => setStepForm(f => ({ ...f, stepLabel: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select label="Type d'étape" fullWidth size="small" required
                value={stepForm.stepType}
                onChange={e => setStepForm(f => ({ ...f, stepType: e.target.value as any }))}
              >
                {STEP_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color }} />
                      {t.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select label="Profil responsable" fullWidth size="small" required
                value={stepForm.assignedRole}
                onChange={e => setStepForm(f => ({ ...f, assignedRole: e.target.value }))}
              >
                {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Ordre" type="number" fullWidth size="small"
                value={stepForm.order}
                onChange={e => setStepForm(f => ({ ...f, order: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                CONDITION D'ACTIVATION PAR MONTANT (laisser vide = toujours actif)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Montant minimum (XOF)" type="number" fullWidth size="small"
                value={stepForm.conditionMinAmount ?? ''}
                onChange={e => setStepForm(f => ({ ...f, conditionMinAmount: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Ex : 5000000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Montant maximum (XOF)" type="number" fullWidth size="small"
                value={stepForm.conditionMaxAmount ?? ''}
                onChange={e => setStepForm(f => ({ ...f, conditionMaxAmount: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Ex : 50000000"
              />
            </Grid>

            {(stepForm.stepType === 'APPROVAL' || stepForm.stepType === 'COMMITTEE') && (
              <>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    PLAFOND D'APPROBATION DE CE PROFIL (laisser vide = illimité)
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Montant minimum approuvable (XOF)" type="number" fullWidth size="small"
                    value={stepForm.approvalMinAmount ?? ''}
                    onChange={e => setStepForm(f => ({ ...f, approvalMinAmount: e.target.value ? Number(e.target.value) : null }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Montant maximum approuvable (XOF)" type="number" fullWidth size="small"
                    value={stepForm.approvalMaxAmount ?? ''}
                    onChange={e => setStepForm(f => ({ ...f, approvalMaxAmount: e.target.value ? Number(e.target.value) : null }))}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                DÉLAIS (SLA)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Durée attendue (heures)" type="number" fullWidth size="small"
                value={stepForm.expectedDurationHours}
                onChange={e => setStepForm(f => ({ ...f, expectedDurationHours: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
                helperText={`≈ ${fmtHours(stepForm.expectedDurationHours)}`}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Délai maximum (heures)" type="number" fullWidth size="small"
                value={stepForm.maxDurationHours}
                onChange={e => setStepForm(f => ({ ...f, maxDurationHours: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
                helperText={`≈ ${fmtHours(stepForm.maxDurationHours)} — au-delà : alerte envoyée`}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description" fullWidth size="small" multiline rows={2}
                value={stepForm.description ?? ''}
                onChange={e => setStepForm(f => ({ ...f, description: e.target.value || null }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={stepForm.isRequired}
                    onChange={e => setStepForm(f => ({ ...f, isRequired: e.target.checked }))}
                  />
                }
                label="Étape obligatoire"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={stepForm.isActive}
                    onChange={e => setStepForm(f => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label="Étape active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStepDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={saveStep}
            disabled={!stepForm.stepName || !stepForm.stepLabel}
          >
            {editingStep ? 'Mettre à jour' : 'Ajouter l\'étape'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Confirmation suppression étape ─────────────────────────── */}
      <Dialog open={!!deleteStepId} onClose={() => setDeleteStepId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Supprimer l'étape</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Cette action est irréversible. Les dossiers en cours ne seront pas affectés, mais les nouveaux dossiers ne passeront plus par cette étape.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteStepId(null)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={deleteStep}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
