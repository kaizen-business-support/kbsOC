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
  ArrowForward as ArrowForwardIcon,
  CheckCircleOutline as FinalApproverIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { creditPolicyApi, ApiService } from '../services/api';
import { WorkflowPolicyBuilder } from '../components/workflow-builder/WorkflowPolicyBuilder';

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
  { value: 'ASSISTANT_COMMERCIAL',    label: 'Assistant Commercial' },
  { value: 'CHARGE_AFFAIRES',         label: "Chargé d'Affaires" },
  { value: 'ANALYSTE_RISQUES',        label: 'Analyste Risques' },
  { value: 'RESPONSABLE_RISQUES',     label: 'Responsable Risques' },
  { value: 'RESPONSABLE_ENGAGEMENTS', label: 'Responsable Engagements' },
  { value: 'DIR_AG',                  label: "Directeur d'Agence" },
  { value: 'COMITE_CREDIT',           label: 'Comité de Crédit' },
  { value: 'DIRECTION_GENERALE',      label: 'Direction Générale' },
  { value: 'DIRECTION_JURIDIQUE',     label: 'Direction Juridique' },
  { value: 'BACK_OFFICE',             label: 'Back Office' },
];

const EMPTY_STEP: Omit<CreditPolicyStep, 'id' | 'policyId'> = {
  stepName: '',
  stepLabel: '',
  order: 1,
  stepType: 'APPROVAL',
  assignedRole: 'CHARGE_AFFAIRES',
  conditionMinAmount: null,
  conditionMaxAmount: null,
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

export function CreditPolicyPage({ initialTab = 0, compact = false }: { initialTab?: number; compact?: boolean }) {
  const { isRole } = useUser();
  const isAdmin = isRole('admin') || isRole('management');

  const [tab, setTab] = useState(initialTab);
  const [policies, setPolicies] = useState<CreditPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<CreditPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  // Erreurs inline dans les dialogs (visibles même quand le dialog est ouvert)
  const [policyDialogError, setPolicyDialogError] = useState<string | null>(null);
  const [stepDialogError, setStepDialogError] = useState<string | null>(null);

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
  const [approvalLimits, setApprovalLimits] = useState<any[]>([]);

  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingStep, setSavingStep]     = useState(false);

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

  const loadApprovalLimits = useCallback(async () => {
    const res = await ApiService.getApprovalLimits();
    if (res.success && res.data) setApprovalLimits(res.data);
  }, []);

  useEffect(() => { loadPolicies(); loadCreditTypes(); loadApprovalLimits(); }, [loadPolicies, loadCreditTypes, loadApprovalLimits]);

  // ── Gestion des politiques ──────────────────────────────────────────────────

  const openEditPolicy = (p: CreditPolicy) => {
    setEditingPolicy(p);
    setPolicyForm({
      name: p.name,
      code: p.code,
      description: p.description || '',
      validFrom: p.validFrom?.slice(0, 10) || '',
      validTo: p.validTo?.slice(0, 10) || '',
    });
    setPolicyDialogError(null);
    setPolicyDialogOpen(true);
  };

  const openCreatePolicy = () => {
    setEditingPolicy(null);
    setPolicyForm({ name: '', code: '', description: '', validFrom: '', validTo: '' });
    setPolicyDialogError(null);
    setPolicyDialogOpen(true);
  };

  const savePolicy = async () => {
    if (!policyForm.name || !policyForm.code) return;
    setSavingPolicy(true);
    setPolicyDialogError(null);
    try {
      const payload = {
        name: policyForm.name,
        code: policyForm.code,
        description: policyForm.description || null,
        validFrom: policyForm.validFrom || undefined,
        validTo: policyForm.validTo || null,
      };
      if (editingPolicy) {
        const res = await creditPolicyApi.updatePolicy(editingPolicy.id, payload);
        if (res.success) {
          showSnack('Politique mise à jour');
          setPolicyDialogOpen(false);
          loadPolicies();
        } else {
          setPolicyDialogError(res.error || 'Erreur lors de la sauvegarde. Vérifiez que le serveur est accessible.');
        }
      } else {
        const res = await creditPolicyApi.createPolicy(payload);
        if (res.success) {
          showSnack('Politique créée');
          setPolicyDialogOpen(false);
          loadPolicies();
        } else {
          setPolicyDialogError(res.error || 'Erreur lors de la création. Vérifiez que le code est unique.');
        }
      }
    } catch (e: any) {
      setPolicyDialogError(e?.message || 'Erreur inattendue. Vérifiez votre connexion.');
    } finally {
      setSavingPolicy(false);
    }
  };

  // ── Gestion des étapes ──────────────────────────────────────────────────────

  const openAddStep = () => {
    if (!selectedPolicy) return;
    setEditingStep(null);
    const nextOrder = (selectedPolicy.steps?.length ?? 0) + 1;
    setStepForm({ ...EMPTY_STEP, order: nextOrder });
    setStepDialogError(null);
    setStepDialogOpen(true);
  };

  const openEditStep = (step: CreditPolicyStep) => {
    setEditingStep(step);
    setStepForm({
      ...step,
      order:                Number(step.order),
      conditionMinAmount:   step.conditionMinAmount !== null ? Number(step.conditionMinAmount) : null,
      conditionMaxAmount:   step.conditionMaxAmount !== null ? Number(step.conditionMaxAmount) : null,
      expectedDurationHours: Number(step.expectedDurationHours),
      maxDurationHours:     Number(step.maxDurationHours),
    });
    setStepDialogError(null);
    setStepDialogOpen(true);
  };

  const saveStep = async () => {
    if (!selectedPolicy || !stepForm.stepName || !stepForm.stepLabel) return;
    setSavingStep(true);
    setStepDialogError(null);
    try {
      const res = editingStep
        ? await creditPolicyApi.updateStep(selectedPolicy.id, editingStep.id, stepForm)
        : await creditPolicyApi.createStep(selectedPolicy.id, stepForm);
      if (res.success) {
        showSnack(editingStep ? 'Étape mise à jour' : 'Étape ajoutée');
        setStepDialogOpen(false);
        loadPolicies();
      } else {
        setStepDialogError(res.error || 'Erreur lors de la sauvegarde. Vérifiez que le serveur est accessible.');
      }
    } catch (e: any) {
      setStepDialogError(e?.message || 'Erreur inattendue. Vérifiez votre connexion.');
    } finally {
      setSavingStep(false);
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
    <Box sx={{ p: compact ? 0 : { xs: 2, md: 3 } }}>
      {/* Header — masqué en mode compact (rendu dans CreditManagementPage) */}
      {!compact && (
        <>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <PolicyIcon sx={{ fontSize: 36, color: 'primary.main' }} />
            <Box flex={1}>
              <Typography variant="h5" fontWeight={700}>Politique de Crédit</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPolicy
                  ? <>{selectedPolicy.name} — <em>v{selectedPolicy.version}</em></>
                  : 'Circuit de traitement, profils valideurs et approbations par montant'}
              </Typography>
            </Box>
            {selectedPolicy && (
              <Tooltip title="Modifier la politique">
                <IconButton size="small" onClick={() => openEditPolicy(selectedPolicy)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreatePolicy}>
              Nouvelle politique
            </Button>
            <Chip label="Admin" color="primary" size="small" />
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Étapes de crédit" disabled={!selectedPolicy} />
            <Tab label="Simulation du circuit" />
            <Tab label="Éditeur visuel" icon={<PolicyIcon />} iconPosition="start" />
          </Tabs>
        </>
      )}

      {/* En mode compact : toolbar section */}
      {compact && (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Circuit de traitement</Typography>
            {selectedPolicy && (
              <Typography variant="caption" color="text.secondary">
                {selectedPolicy.name} — v{selectedPolicy.version}
                {selectedPolicy.isActive && (
                  <Chip label="Active" size="small" color="success"
                    sx={{ ml: 1, height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.8 } }} />
                )}
              </Typography>
            )}
          </Box>
          {selectedPolicy && (
            <Tooltip title="Modifier la politique">
              <IconButton size="small" onClick={() => openEditPolicy(selectedPolicy)}
                sx={{ border: 1, borderColor: 'divider' }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* ── État vide ─────────────────────────────────────────────────────────── */}
      {!loading && !selectedPolicy && (
        <Alert severity="info" sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" startIcon={<AddIcon />} onClick={openCreatePolicy}>
              Créer
            </Button>
          }
        >
          Aucune politique de crédit active. Créez-en une pour configurer le circuit de traitement.
        </Alert>
      )}

      {/* ── Section Étapes ────────────────────────────────────────────────────── */}
      {(compact || tab === 0) && selectedPolicy && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h6">Circuit de traitement</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chaque étape définit qui intervient, quelle action est réalisée et dans quel délai —
                  chaque valideur doit compléter son étape pour que le dossier progresse.
                </Typography>
              </Box>
              <Button startIcon={<AddIcon />} onClick={openAddStep} variant="contained" size="small">
                Ajouter une étape
              </Button>
            </Box>

            {/* Visualisation du flux */}
            {steps.length > 0 && (
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={2}
                sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1.5 }}>
                {[...steps].sort((a, b) => a.order - b.order).map((step, i, arr) => {
                  const ti = STEP_TYPES.find(t => t.value === step.stepType);
                  return (
                    <React.Fragment key={step.id}>
                      <Box sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        bgcolor: 'white', border: '1px solid', borderColor: 'divider',
                        borderRadius: 1.5, px: 1.5, py: 0.75, minWidth: 90,
                        borderTop: `3px solid ${ti?.color ?? '#999'}`,
                        opacity: step.isActive ? 1 : 0.45,
                      }}>
                        <Typography variant="caption" fontWeight={700} fontSize={10}
                          sx={{ color: ti?.color ?? '#999', textTransform: 'uppercase' }}>
                          {ti?.label ?? step.stepType}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} fontSize={11} noWrap>
                          {step.stepLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontSize={10}>
                          {ROLES.find(r => r.value === step.assignedRole)?.label ?? step.assignedRole}
                        </Typography>
                      </Box>
                      {i < arr.length - 1 && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 18 }}>→</Typography>
                      )}
                    </React.Fragment>
                  );
                })}
              </Box>
            )}

            {steps.length === 0 ? (
              <Alert severity="info">
                Aucune étape configurée. Ajoutez les étapes du circuit (dispatch → analyse → approbation…).
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 700 }}>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell align="center" width={40}>#</TableCell>
                      <TableCell>Étape</TableCell>
                      <TableCell align="center">Type</TableCell>
                      <TableCell>Responsable</TableCell>
                      <TableCell>Activation par montant</TableCell>
                      <TableCell align="center">SLA</TableCell>
                      <TableCell align="center">Statut</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...steps].sort((a, b) => a.order - b.order).map((step) => {
                      const typeInfo = STEP_TYPES.find(t => t.value === step.stepType);
                      const roleInfo = ROLES.find(r => r.value === step.assignedRole);
                      return (
                        <TableRow key={step.id} hover sx={{ opacity: step.isActive ? 1 : 0.55 }}>
                          <TableCell align="center">
                            <Typography variant="caption" fontWeight={700}>{step.order}</Typography>
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
                            <Typography variant="caption" color={step.conditionMinAmount !== null || step.conditionMaxAmount !== null ? 'warning.dark' : 'text.secondary'}>
                              {step.conditionMinAmount !== null || step.conditionMaxAmount !== null
                                ? `${fmt(step.conditionMinAmount)} → ${fmt(step.conditionMaxAmount)}`
                                : 'Toujours active'}
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

      {/* ── Section Simulation ───────────────────────────────────────────────── */}
      {compact && <Divider sx={{ my: 3 }} />}
      {(compact || tab === 1) && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <PreviewIcon color="primary" />
              <Typography variant="h6">Simuler le circuit de traitement</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Saisissez un type de crédit et un montant pour visualiser le circuit complet — étapes actives, étapes hors condition, et approbateur compétent.
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

            {previewResult && (() => {
              const amount = Number(previewAmount);
              // Étapes actives pour ce montant (IDs)
              const activeStepIds = new Set((previewResult.steps ?? []).map((s: any) => s.stepName));
              // Circuit complet = allSteps, ou steps si allSteps absent (rétrocompat)
              const fullSteps: any[] = previewResult.allSteps ?? previewResult.steps ?? [];

              // Chaîne d'approbation : trouver l'approbateur final (celui dont la plage couvre le montant),
              // puis inclure tous les approbateurs actifs avec order ≤ order de l'approbateur final.
              const sortedLimits = approvalLimits
                .filter((l: any) => l.isActive !== false)
                .sort((a: any, b: any) => a.order - b.order);
              const finalApprover = sortedLimits.find((l: any) => amount >= Number(l.minAmount) && amount <= Number(l.maxAmount));
              const approvalChain = finalApprover
                ? sortedLimits.filter((l: any) => l.order <= finalApprover.order)
                : [];

              return (
                <Box mt={4}>
                  <Divider sx={{ mb: 2 }} />

                  {/* Résumé */}
                  <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
                    <Chip
                      label={previewResult.policyName ? `Politique : ${previewResult.policyName}` : 'Circuit par type de crédit (pas de politique active)'}
                      color={previewResult.policyName ? 'primary' : 'warning'}
                    />
                    <Chip label={`${previewResult.steps?.length ?? 0} étape(s) active(s) pour ce montant`} color="success" variant="outlined" />
                    <Chip label={`~${previewResult.estimatedDurationDays}j estimés`} variant="outlined" />
                  </Box>

                  {/* Chaîne d'approbation pour ce montant */}
                  {approvalLimits.length > 0 && (
                    <Box mb={3} p={2} sx={{ bgcolor: finalApprover ? 'primary.50' : 'warning.50', borderRadius: 2, border: '1px solid', borderColor: finalApprover ? 'primary.200' : 'warning.200' }}>
                      <Typography variant="caption" fontWeight={700} color={finalApprover ? 'primary.dark' : 'warning.dark'} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                        Chaîne d'approbation pour {Number(previewAmount).toLocaleString('fr-FR')} XOF
                      </Typography>
                      {finalApprover ? (
                        <Box display="flex" alignItems="center" flexWrap="wrap" gap={0.5}>
                          {approvalChain.map((l: any, idx: number) => {
                            const isFinal = l.id === finalApprover.id;
                            return (
                              <React.Fragment key={l.id}>
                                <Box
                                  display="flex" alignItems="center" gap={0.75}
                                  sx={{
                                    px: 1.5, py: 0.75, borderRadius: 1.5,
                                    bgcolor: isFinal ? 'primary.main' : 'white',
                                    color: isFinal ? 'white' : 'text.primary',
                                    border: '1px solid',
                                    borderColor: isFinal ? 'primary.main' : 'grey.300',
                                    fontWeight: isFinal ? 700 : 400,
                                  }}
                                >
                                  {isFinal && <FinalApproverIcon sx={{ fontSize: 15, color: 'white' }} />}
                                  <Typography variant="body2" fontWeight={isFinal ? 700 : 500} sx={{ color: 'inherit' }}>
                                    {l.displayName}
                                  </Typography>
                                  {isFinal && (
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', ml: 0.5 }}>
                                      (décision finale)
                                    </Typography>
                                  )}
                                </Box>
                                {idx < approvalChain.length - 1 && (
                                  <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="warning.dark">
                          Aucun approbateur configuré pour ce montant dans les Limites d'Approbation.
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Circuit complet */}
                  <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 600 }}>
                      <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                          <TableCell align="center" width={40}>#</TableCell>
                          <TableCell>Étape</TableCell>
                          <TableCell align="center">Type</TableCell>
                          <TableCell>Responsable</TableCell>
                          <TableCell align="center">Durée</TableCell>
                          <TableCell>Condition</TableCell>
                          <TableCell align="center">Statut</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fullSteps.map((s: any, i: number) => {
                          const isActive = activeStepIds.has(s.stepName);
                          const typeInfo = STEP_TYPES.find(t => t.value === s.stepType);
                          const roleInfo = ROLES.find(r => r.value === s.role);
                          return (
                            <TableRow key={i} sx={{ opacity: isActive ? 1 : 0.45, bgcolor: isActive ? 'inherit' : 'grey.50' }}>
                              <TableCell align="center">
                                <Typography variant="caption" fontWeight={700} color={isActive ? 'text.primary' : 'text.disabled'}>
                                  {s.order ?? i + 1}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{s.stepLabel}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                {s.stepType
                                  ? <Chip label={typeInfo?.label ?? s.stepType} size="small"
                                      sx={{ bgcolor: (typeInfo?.color ?? '#999') + '22', color: typeInfo?.color ?? '#999', opacity: isActive ? 1 : 0.6 }} />
                                  : <Typography variant="caption" color="text.disabled">—</Typography>}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color={isActive ? 'text.primary' : 'text.disabled'}>
                                  {roleInfo?.label ?? s.role}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="caption" color={isActive ? 'text.primary' : 'text.disabled'}>
                                  {fmtHours(s.expectedDurationHours ?? (s.durationDays ?? 1) * 24)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {s.isConditional ? (
                                  <Tooltip title={
                                    [
                                      s.conditionMinAmount != null ? `Min : ${Number(s.conditionMinAmount).toLocaleString('fr-FR')} XOF` : null,
                                      s.conditionMaxAmount != null ? `Max : ${Number(s.conditionMaxAmount).toLocaleString('fr-FR')} XOF` : null,
                                    ].filter(Boolean).join(' / ') || 'Condition'
                                  }>
                                    <Chip
                                      label={[
                                        s.conditionMinAmount != null ? `≥ ${fmt(s.conditionMinAmount)}` : null,
                                        s.conditionMaxAmount != null ? `≤ ${fmt(s.conditionMaxAmount)}` : null,
                                      ].filter(Boolean).join(' ')}
                                      size="small" color="warning" variant="outlined"
                                    />
                                  </Tooltip>
                                ) : (
                                  <Chip label="Toujours active" size="small" color="success" variant="outlined" />
                                )}
                              </TableCell>
                              <TableCell align="center">
                                {isActive
                                  ? <Chip label="S'applique" size="small" color="success" />
                                  : <Chip label="Hors condition" size="small" variant="outlined" />}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ── Dialog : Politique ──────────────────────────────────────────────── */}
      <Dialog open={policyDialogOpen} onClose={() => setPolicyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPolicy ? 'Modifier la politique de crédit' : 'Nouvelle politique de crédit'}</DialogTitle>
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
            {policyDialogError && (
              <Alert severity="error" sx={{ mt: 1 }}>{policyDialogError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPolicyDialogOpen(false); setPolicyDialogError(null); }} disabled={savingPolicy}>Annuler</Button>
          <Button
            variant="contained"
            onClick={savePolicy}
            disabled={!policyForm.name || !policyForm.code || savingPolicy}
            startIcon={savingPolicy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editingPolicy ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Étape ──────────────────────────────────────────────────── */}
      <Dialog open={stepDialogOpen} onClose={() => setStepDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStep ? 'Modifier l\'étape' : 'Ajouter une étape au circuit'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>

            {/* ── Identification ──────────────────────────────────── */}
            <Grid item xs={12} sm={8}>
              <TextField
                label="Libellé de l'étape *" fullWidth size="small" required
                placeholder="Ex : Validation Superviseur"
                value={stepForm.stepLabel}
                onChange={e => {
                  const label = e.target.value;
                  const slug = label
                    .toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s]/g, '')
                    .trim()
                    .replace(/\s+/g, '_');
                  setStepForm(f => ({ ...f, stepLabel: label, stepName: slug }));
                }}
                helperText="Nom affiché aux utilisateurs dans le workflow"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Identifiant généré" fullWidth size="small"
                value={stepForm.stepName}
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input': { bgcolor: 'grey.50', color: 'text.secondary', fontSize: 12 } }}
                helperText="Auto-généré depuis le libellé"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select label="Type d'étape *" fullWidth size="small" required
                value={stepForm.stepType}
                onChange={e => setStepForm(f => ({ ...f, stepType: e.target.value as any }))}
                helperText="Nature de l'action réalisée"
              >
                {STEP_TYPES.map(t => (
                  <MenuItem key={t.value} value={t.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color }} />
                      <Box>
                        <Typography variant="body2">{t.label}</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                select label="Rôle responsable *" fullWidth size="small" required
                value={stepForm.assignedRole}
                onChange={e => setStepForm(f => ({ ...f, assignedRole: e.target.value }))}
                helperText="Qui traite cette étape"
              >
                {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Ordre" type="number" fullWidth size="small"
                value={stepForm.order || ''}
                onChange={e => setStepForm(f => ({ ...f, order: e.target.value === '' ? 1 : parseInt(e.target.value, 10) }))}
                inputProps={{ min: 1 }}
                helperText="Position dans le flux"
              />
            </Grid>

            {/* ── Condition d'activation ───────────────────────────── */}
            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  CONDITION D'ACTIVATION PAR MONTANT (optionnel)
                </Typography>
              </Divider>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Laisser vide = étape toujours active, quel que soit le montant du crédit
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Montant minimum du crédit (XOF)" type="number" fullWidth size="small"
                value={stepForm.conditionMinAmount ?? ''}
                onChange={e => setStepForm(f => ({
                  ...f,
                  conditionMinAmount: e.target.value === '' ? null : parseFloat(e.target.value),
                }))}
                inputProps={{ min: 0 }}
                placeholder="Ex : 5000000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Montant maximum du crédit (XOF)" type="number" fullWidth size="small"
                value={stepForm.conditionMaxAmount ?? ''}
                onChange={e => setStepForm(f => ({
                  ...f,
                  conditionMaxAmount: e.target.value === '' ? null : parseFloat(e.target.value),
                }))}
                inputProps={{ min: 0 }}
                placeholder="Ex : 50000000"
              />
            </Grid>

            {/* ── Délais SLA ───────────────────────────────────────── */}
            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  DÉLAIS (SLA)
                </Typography>
              </Divider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Durée attendue (heures)" type="number" fullWidth size="small"
                value={stepForm.expectedDurationHours || ''}
                onChange={e => setStepForm(f => ({
                  ...f,
                  expectedDurationHours: e.target.value === '' ? 1 : parseInt(e.target.value, 10),
                }))}
                inputProps={{ min: 1 }}
                helperText={stepForm.expectedDurationHours ? `≈ ${fmtHours(stepForm.expectedDurationHours)}` : ' '}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Délai maximum (heures)" type="number" fullWidth size="small"
                value={stepForm.maxDurationHours || ''}
                onChange={e => setStepForm(f => ({
                  ...f,
                  maxDurationHours: e.target.value === '' ? 1 : parseInt(e.target.value, 10),
                }))}
                inputProps={{ min: 1 }}
                helperText={stepForm.maxDurationHours ? `≈ ${fmtHours(stepForm.maxDurationHours)} — alerte au-delà` : ' '}
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
          {stepDialogError && (
            <Grid item xs={12}>
              <Alert severity="error">{stepDialogError}</Alert>
            </Grid>
          )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setStepDialogOpen(false); setStepDialogError(null); }} disabled={savingStep}>Annuler</Button>
          <Button
            variant="contained"
            onClick={saveStep}
            disabled={!stepForm.stepName || !stepForm.stepLabel || savingStep}
            startIcon={savingStep ? <CircularProgress size={16} color="inherit" /> : undefined}
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

      {/* Tab 2 — Éditeur visuel */}
      {tab === 2 && (
        <Box sx={{ height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
          <WorkflowPolicyBuilder />
        </Box>
      )}

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
