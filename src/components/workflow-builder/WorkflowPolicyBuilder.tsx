import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Select, MenuItem, Button, Chip, Alert,
  CircularProgress, Tooltip, FormControl, IconButton, Divider,
  Snackbar,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useUser } from '../../contexts/UserContext';
import { creditPolicyApi, ApiService } from '../../services/api';
import {
  CreditPolicyFull, PolicyStep, PolicyStepType, CreditType, STEP_TYPE_CONFIG,
} from '../../types/creditPolicyBuilder';
import { StepPalette } from './StepPalette';
import { StepList } from './StepList';
import { WorkflowPreview } from './WorkflowPreview';
import { RaciImportModal } from './RaciImportModal';

// Mini sidebar width from Sidebar.tsx
const SIDEBAR_W = 64;
const HEADER_H  = 64;

function generateTempId() {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createStep(type: PolicyStepType, order: number, existingSteps: PolicyStep[] = []): PolicyStep {
  const cfg = STEP_TYPE_CONFIG[type];
  const baseName = type.toLowerCase();
  const baseLabel = cfg.label;
  const sameTypeCount = existingSteps.filter(s => s.stepType === type).length;
  const stepName  = sameTypeCount === 0 ? baseName  : `${baseName}_${sameTypeCount + 1}`;
  const stepLabel = sameTypeCount === 0 ? baseLabel : `${baseLabel} ${sameTypeCount + 1}`;
  return {
    id: generateTempId(), policyId: '',
    stepName, stepLabel,
    order, stepType: type, assignedRole: 'CHARGE_AFFAIRES',
    conditionMinAmount: null, conditionMaxAmount: null,
    expectedDurationHours: 24, maxDurationHours: 72,
    isRequired: true, isActive: true, description: null,
    creditTypeIds: [], guards: null, allowedActions: [],
  };
}

function validateStepsClient(steps: PolicyStep[]): PolicyStep[] {
  return steps.map((s) => {
    if (!s.stepLabel.trim()) return { ...s, _error: 'Nom obligatoire' };
    if (!s.assignedRole)    return { ...s, _error: 'Rôle obligatoire' };
    return { ...s, _error: undefined };
  });
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  ACTIVE:   { bg: '#e8f5e9', color: '#2e7d32', label: 'Active',    dot: '#4caf50' },
  DRAFT:    { bg: '#fff8e1', color: '#f57f17', label: 'Brouillon', dot: '#ffc107' },
  ARCHIVED: { bg: '#f5f5f5', color: '#757575', label: 'Archivée',  dot: '#9e9e9e' },
};

export function WorkflowPolicyBuilder() {
  const { hasPermission } = useUser();
  const canEdit = hasPermission('manage_credit_policy') || hasPermission('policy_configuration');

  const [policies, setPolicies]               = useState<CreditPolicyFull[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [steps, setSteps]                     = useState<PolicyStep[]>([]);
  const [currentVersion, setCurrentVersion]   = useState(1);
  const [creditTypes, setCreditTypes]         = useState<CreditType[]>([]);
  const [roles, setRoles]                     = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [snack, setSnack]                     = useState<{ msg: string; sev: 'success'|'error'|'warning'|'info' } | null>(null);
  const [selectedStepId, setSelectedStepId]   = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen]         = useState(true);
  const [configOpen, setConfigOpen]           = useState(true);
  const [raciOpen, setRaciOpen]               = useState(false);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) ?? null;
  const isDraft  = selectedPolicy?.status === 'DRAFT';
  const isActive = selectedPolicy?.status === 'ACTIVE';
  const sc = selectedPolicy ? (STATUS_CFG[selectedPolicy.status] ?? STATUS_CFG.ARCHIVED) : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [polRes, ctRes, rolesRes] = await Promise.all([
      creditPolicyApi.getPolicies(),
      creditPolicyApi.getCreditTypes(),
      ApiService.getRoles(),
    ]);
    if (polRes.success && polRes.data) {
      setPolicies(polRes.data);
      const best = polRes.data.find((p: CreditPolicyFull) => p.status === 'DRAFT')
        ?? polRes.data.find((p: CreditPolicyFull) => p.status === 'ACTIVE')
        ?? polRes.data[0];
      if (best) { setSelectedPolicyId(best.id); setSteps(best.steps ?? []); setCurrentVersion(best.version); }
    }
    if (ctRes.success && ctRes.data) setCreditTypes(ctRes.data);
    if (rolesRes.success && rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => ({ value: r.name, label: r.label || r.name })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPolicy = (id: string) => {
    const pol = policies.find((p) => p.id === id);
    if (!pol) return;
    setSelectedPolicyId(id);
    setSteps(pol.steps ?? []);
    setCurrentVersion(pol.version);
    setSelectedStepId(null);
  };

  const handleAddStep = (type: PolicyStepType) => {
    if (!canEdit || !isDraft) return;
    const s = createStep(type, steps.length + 1, steps);
    setSteps((prev) => [...prev, s]);
    setSelectedStepId(s.id);
    if (!configOpen) setConfigOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPolicyId || !canEdit) return;
    const validated = validateStepsClient(steps);
    setSteps(validated);
    if (validated.some((s) => s._error)) {
      setSnack({ msg: 'Corrigez les erreurs avant de sauvegarder', sev: 'error' });
      return;
    }
    setSaving(true);
    const res = await creditPolicyApi.savePolicyWithSteps(selectedPolicyId, {
      steps: validated.map(({ _error, ...rest }) => rest),
      expectedVersion: currentVersion,
    });
    setSaving(false);
    if (res.success) {
      const v = res.data?.version ?? currentVersion + 1;
      setCurrentVersion(v);
      if (res.data?.steps) setSteps(res.data.steps);
      setSnack({ msg: `Sauvegardé — v${v}`, sev: 'success' });
    } else if (res.conflict) {
      setSnack({ msg: res.error, sev: 'warning' });
    } else {
      setSnack({ msg: res.error, sev: 'error' });
    }
  };

  const handleValidate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.validatePolicy(selectedPolicyId);
    if (res.data?.valid) {
      setSnack({ msg: 'Workflow valide — vous pouvez activer la politique', sev: 'success' });
    } else {
      const errs = (res.errors ?? []).map((e: any) => e.message).join(' · ');
      setSnack({ msg: errs || res.error || 'Workflow invalide', sev: 'error' });
    }
  };

  const handleActivate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.activatePolicy(selectedPolicyId);
    if (res.success) { setSnack({ msg: 'Politique activée', sev: 'success' }); await loadData(); }
    else setSnack({ msg: res.error, sev: 'error' });
  };

  const handleArchive = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.archivePolicy(selectedPolicyId);
    if (res.success) { setSnack({ msg: 'Politique archivée', sev: 'info' }); await loadData(); }
    else setSnack({ msg: res.error, sev: 'error' });
  };

  const handleRaciImport = async (importedSteps: PolicyStep[]) => {
    if (!isDraft) return;
    const reordered = importedSteps.map((s, i) => ({ ...s, policyId: selectedPolicyId, order: i + 1 }));
    setSaving(true);
    const res = await creditPolicyApi.savePolicyWithSteps(selectedPolicyId, {
      steps: reordered.map(({ _error, ...rest }: any) => rest),
      expectedVersion: currentVersion,
    });
    setSaving(false);
    if (res.success) {
      const v = res.data?.version ?? currentVersion + 1;
      setCurrentVersion(v);
      setSteps(res.data?.steps || reordered);
      setSelectedStepId(null);
      setSnack({ msg: `${reordered.length} étapes importées et sauvegardées (v${v})`, sev: 'success' });
    } else {
      setSnack({ msg: res.error || 'Erreur lors de la sauvegarde des étapes RACI', sev: 'error' });
    }
  };

  const handleNewPolicy = async () => {
    const name = `Politique ${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const res = await creditPolicyApi.createPolicy({ name, code: `POL-${Date.now()}`, description: '' });
    if (res.success && res.data) {
      await loadData();
      setSelectedPolicyId(res.data.id);
      setSteps(res.data.steps ?? []);
    setCurrentVersion(res.data.version ?? 1);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      position: 'fixed',
      top: HEADER_H,
      left: SIDEBAR_W,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#f0f2f5',
      zIndex: 10,
    }}>

      {/* ══ TOOLBAR ══ */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, height: 52, flexShrink: 0,
        bgcolor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* Titre */}
        <AccountTreeIcon sx={{ fontSize: 20, color: '#1d4ed8' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1e293b', mr: 0.5 }}>
          Éditeur de Workflow
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />

        {/* Label politique */}
        <Typography sx={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
          Politique :
        </Typography>

        {/* Sélecteur politique — fond blanc, texte sombre */}
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <Select
            value={selectedPolicyId}
            onChange={(e) => handleSelectPolicy(e.target.value)}
            displayEmpty
            sx={{ fontSize: 13, bgcolor: '#f8fafc', color: '#1e293b' }}
          >
            {policies.map((p) => {
              const s = STATUS_CFG[p.status] ?? STATUS_CFG.ARCHIVED;
              return (
                <MenuItem key={p.id} value={p.id} sx={{ fontSize: 13 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.dot, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, color: '#1e293b' }}>{p.name}</Box>
                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>v{p.version} · {s.label}</Typography>
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        {/* Chip statut */}
        {sc && (
          <Chip size="small" label={sc.label}
            sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, fontSize: 11, height: 22 }} />
        )}

        {loading && <CircularProgress size={16} sx={{ color: '#1d4ed8' }} />}

        {/* Badge mode */}
        {canEdit && isDraft && (
          <Chip size="small" label="✏️ Mode édition"
            sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11, height: 22 }} />
        )}
        {(!canEdit || !isDraft) && selectedPolicy && (
          <Chip size="small" label="🔒 Lecture seule"
            sx={{ bgcolor: '#fef9c3', color: '#854d0e', fontWeight: 700, fontSize: 11, height: 22 }} />
        )}

        <Box sx={{ flex: 1 }} />

        {/* Bouton RACI — toujours visible */}
        <Tooltip title="Consulter la matrice RACI, télécharger le modèle ou importer un workflow">
          <Button size="small" variant="outlined" color="inherit"
            startIcon={<TableChartIcon sx={{ fontSize: 15 }} />}
            onClick={() => setRaciOpen(true)}
            sx={{ fontSize: 12, textTransform: 'none', borderColor: '#e2e8f0', color: '#475569' }}
          >
            Matrice RACI
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />

        {/* Boutons d'action */}
        {canEdit && isDraft && (
          <>
            <Tooltip title="Vérifier la cohérence du workflow avant activation">
              <Button size="small" variant="outlined" color="inherit"
                startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
                onClick={handleValidate}
                sx={{ fontSize: 12, textTransform: 'none', borderColor: '#e2e8f0', color: '#475569' }}
              >
                Valider
              </Button>
            </Tooltip>
            <Button size="small" variant="outlined" color="primary"
              startIcon={saving ? <CircularProgress size={13} /> : <SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSave} disabled={saving}
              sx={{ fontSize: 12, textTransform: 'none' }}
            >
              Enregistrer
            </Button>
            <Button size="small" variant="contained" color="success"
              startIcon={<PlayArrowIcon sx={{ fontSize: 15 }} />}
              onClick={handleActivate}
              sx={{ fontSize: 12, textTransform: 'none' }}
            >
              Activer
            </Button>
          </>
        )}
        {canEdit && isActive && (
          <Tooltip title="Archiver (rend la politique lecture seule)">
            <Button size="small" variant="outlined" color="warning"
              startIcon={<ArchiveIcon sx={{ fontSize: 15 }} />}
              onClick={handleArchive}
              sx={{ fontSize: 12, textTransform: 'none' }}
            >
              Archiver
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Créer une nouvelle politique vierge">
          <IconButton size="small" onClick={handleNewPolicy} sx={{ color: '#94a3b8', ml: 0.5 }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ══ ALERTES ══ */}
      {!isDraft && selectedPolicy && (
        <Alert severity="info" sx={{ borderRadius: 0, py: 0.4, fontSize: 12 }}>
          Politique <strong>{sc?.label}</strong> — lecture seule.
          {isActive && ' Archivez-la pour la modifier.'}
        </Alert>
      )}

      {/* ══ CORPS 3 COLONNES ══ */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Palette gauche ── */}
        <Box sx={{
          width: paletteOpen ? 185 : 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          flexShrink: 0,
          bgcolor: '#fff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Éléments
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <StepPalette onAddStep={handleAddStep} readOnly={!canEdit || !isDraft} />
          </Box>
        </Box>

        {/* Toggle palette */}
        <Box sx={{
          width: 20, flexShrink: 0, bgcolor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', '&:hover': { bgcolor: '#e2e8f0' }, transition: 'background 0.15s',
        }} onClick={() => setPaletteOpen(o => !o)}>
          {paletteOpen
            ? <ChevronLeftIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
            : <ChevronRightIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
        </Box>

        {/* ── Canvas centre ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc' }}>
          <Box sx={{
            px: 2, py: 0.8, borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, bgcolor: '#fff',
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Schéma du workflow
            </Typography>
            {steps.length > 0 && !selectedStepId && (
              <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                👆 Cliquez sur un nœud pour le configurer
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {selectedStepId && (
              <Chip
                size="small"
                label={`Étape sélectionnée — modifiez dans le panel droit →`}
                onDelete={() => setSelectedStepId(null)}
                sx={{ fontSize: 10, height: 22, bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}
              />
            )}
            <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>
              Molette pour zoomer · Cliquer-glisser pour naviguer
            </Typography>
          </Box>
          <WorkflowPreview
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={(id) => { setSelectedStepId(id); if (!configOpen) setConfigOpen(true); }}
          />
        </Box>

        {/* Toggle config */}
        <Box sx={{
          width: 20, flexShrink: 0, bgcolor: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', '&:hover': { bgcolor: '#e2e8f0' }, transition: 'background 0.15s',
        }} onClick={() => setConfigOpen(o => !o)}>
          {configOpen
            ? <ChevronRightIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
            : <ChevronLeftIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
        </Box>

        {/* ── Panel config droite ── */}
        <Box sx={{
          width: configOpen ? 360 : 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          flexShrink: 0,
          bgcolor: '#fff',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
        }}>
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #e2e8f0', flexShrink: 0, bgcolor: '#f8fafc' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Configuration des étapes
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#94a3b8', mt: 0.2 }}>
              {steps.length} étape{steps.length !== 1 ? 's' : ''} · cliquez un nœud pour cibler
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.5, overflowY: 'auto' }}>
            <StepList
              steps={steps}
              onStepsChange={setSteps}
              creditTypes={creditTypes}
              roles={roles}
              readOnly={!canEdit || !isDraft}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
            />
          </Box>
        </Box>

      </Box>

      {/* ══ MODAL RACI ══ */}
      <RaciImportModal
        open={raciOpen}
        onClose={() => setRaciOpen(false)}
        onImport={handleRaciImport}
        canEdit={canEdit && isDraft}
      />

      {/* ══ SNACKBAR ══ */}
      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} sx={{ minWidth: 280 }}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
