import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Select, MenuItem, Button, Chip, Alert,
  CircularProgress, Divider, Tooltip, FormControl, InputLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as ValidateIcon,
  PlayArrow as ActivateIcon,
  Archive as ArchiveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';
import { creditPolicyApi } from '../../services/api';
import {
  CreditPolicyFull, PolicyStep, PolicyStepType, CreditType, STEP_TYPE_CONFIG,
} from '../../types/creditPolicyBuilder';
import { StepPalette } from './StepPalette';
import { StepList } from './StepList';
import { WorkflowPreview } from './WorkflowPreview';

function generateTempId() {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createStep(type: PolicyStepType, order: number): PolicyStep {
  const cfg = STEP_TYPE_CONFIG[type];
  return {
    id: generateTempId(),
    policyId: '',
    stepName: type.toLowerCase(),
    stepLabel: cfg.label,
    order,
    stepType: type,
    assignedRole: 'CHARGE_AFFAIRES',
    conditionMinAmount: null,
    conditionMaxAmount: null,
    expectedDurationHours: 24,
    maxDurationHours: 72,
    isRequired: true,
    isActive: true,
    description: null,
    creditTypeIds: [],
    guards: null,
  };
}

function validateStepsClient(steps: PolicyStep[]): PolicyStep[] {
  return steps.map((s) => {
    if (!s.stepLabel.trim()) return { ...s, _error: 'Nom obligatoire' };
    if (!s.assignedRole) return { ...s, _error: 'Rôle obligatoire' };
    return { ...s, _error: undefined };
  });
}

function statusColor(status: string) {
  if (status === 'ACTIVE') return { bg: '#e8f5e9', color: '#2e7d32' };
  if (status === 'DRAFT') return { bg: '#fff3e0', color: '#e65100' };
  return { bg: '#f5f5f5', color: '#757575' };
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'DRAFT') return 'Brouillon';
  return 'Archivée';
}

export function WorkflowPolicyBuilder() {
  const { hasPermission } = useUser();
  const canEdit = hasPermission('manage_credit_policy');

  const [policies, setPolicies] = useState<CreditPolicyFull[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [steps, setSteps] = useState<PolicyStep[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [polRes, ctRes] = await Promise.all([
      creditPolicyApi.getPolicies(),
      creditPolicyApi.getCreditTypes(),
    ]);
    if (polRes.success && polRes.data) {
      setPolicies(polRes.data);
      const active = polRes.data.find((p: CreditPolicyFull) => p.status === 'ACTIVE')
        ?? polRes.data.find((p: CreditPolicyFull) => p.status === 'DRAFT')
        ?? polRes.data[0];
      if (active) {
        setSelectedPolicyId(active.id);
        setSteps(active.steps ?? []);
        setCurrentVersion(active.version);
      }
    }
    if (ctRes.success && ctRes.data) setCreditTypes(ctRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPolicy = (id: string) => {
    const pol = policies.find((p) => p.id === id);
    if (!pol) return;
    setSelectedPolicyId(id);
    setSteps(pol.steps ?? []);
    setCurrentVersion(pol.version);
    setMessage(null);
  };

  const handleAddStep = (type: PolicyStepType) => {
    if (!canEdit || selectedPolicy?.status !== 'DRAFT') return;
    setSteps((prev) => [...prev, createStep(type, prev.length + 1)]);
  };

  const handleSave = async () => {
    if (!selectedPolicyId || !canEdit) return;
    const validated = validateStepsClient(steps);
    setSteps(validated);
    if (validated.some((s) => s._error)) {
      setMessage({ text: 'Corrigez les erreurs avant de sauvegarder', type: 'error' });
      return;
    }
    setSaving(true);
    const res = await creditPolicyApi.savePolicyWithSteps(selectedPolicyId, {
      steps: validated.map((s) => { const { _error, ...rest } = s; return rest; }),
      expectedVersion: currentVersion,
    });
    setSaving(false);
    if (res.success) {
      const newVersion = res.data?.version ?? currentVersion + 1;
      setCurrentVersion(newVersion);
      // Rafraîchir les étapes avec les IDs persistés
      if (res.data?.steps) setSteps(res.data.steps);
      setMessage({ text: `Politique sauvegardée (v${newVersion})`, type: 'success' });
    } else if (res.conflict) {
      setMessage({ text: res.error, type: 'warning' });
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleValidate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.validatePolicy(selectedPolicyId);
    if (res.data?.valid) {
      setMessage({ text: 'Workflow valide — vous pouvez activer la politique', type: 'success' });
    } else {
      const errMsgs = (res.errors ?? []).map((e: any) => e.message).join(' | ');
      setMessage({ text: errMsgs || res.error || 'Workflow invalide', type: 'error' });
    }
  };

  const handleActivate = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.activatePolicy(selectedPolicyId);
    if (res.success) {
      setMessage({ text: 'Politique activée avec succès', type: 'success' });
      await loadData();
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!selectedPolicyId) return;
    const res = await creditPolicyApi.archivePolicy(selectedPolicyId);
    if (res.success) {
      setMessage({ text: 'Politique archivée', type: 'info' });
      await loadData();
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
  };

  const handleNewPolicy = async () => {
    const name = `Politique ${new Date().getFullYear()}-DRAFT`;
    const code = `POL-${Date.now()}`;
    const res = await creditPolicyApi.createPolicy({ name, code, description: '' });
    if (res.success && res.data) {
      await loadData();
      setSelectedPolicyId(res.data.id);
      setSteps([]);
      setCurrentVersion(1);
    }
  };

  const isDraft = selectedPolicy?.status === 'DRAFT';
  const isActive = selectedPolicy?.status === 'ACTIVE';

  if (loading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
        bgcolor: 'background.paper', borderRadius: 2, flexWrap: 'wrap',
        boxShadow: 1,
      }}>
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Politique de crédit</InputLabel>
          <Select
            value={selectedPolicyId}
            label="Politique de crédit"
            onChange={(e) => handleSelectPolicy(e.target.value)}
          >
            {policies.map((p) => {
              const sc = statusColor(p.status);
              return (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ flex: 1 }}>{p.name} — v{p.version}</Box>
                    <Chip
                      size="small"
                      label={statusLabel(p.status)}
                      sx={{ fontSize: 10, bgcolor: sc.bg, color: sc.color, fontWeight: 700 }}
                    />
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        {canEdit && (
          <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={handleNewPolicy}>
            Nouvelle politique
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {canEdit && isDraft && (
          <>
            <Button
              size="small" variant="outlined"
              startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              Sauvegarder
            </Button>
            <Button size="small" variant="outlined" color="info" startIcon={<ValidateIcon />} onClick={handleValidate}>
              Valider
            </Button>
            <Button size="small" variant="contained" color="success" startIcon={<ActivateIcon />} onClick={handleActivate}>
              Activer
            </Button>
          </>
        )}

        {canEdit && isActive && (
          <Tooltip title="Archiver cette politique (la rend lecture seule)">
            <Button size="small" variant="outlined" color="warning" startIcon={<ArchiveIcon />} onClick={handleArchive}>
              Archiver
            </Button>
          </Tooltip>
        )}
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {!isDraft && selectedPolicy && (
        <Alert severity="info">
          Cette politique est en statut <strong>{statusLabel(selectedPolicy.status)}</strong> — lecture seule.
          {isActive && ' Archivez-la pour créer une nouvelle version modifiable.'}
        </Alert>
      )}

      {/* Corps 3 colonnes */}
      <Box sx={{
        display: 'flex', flex: 1, overflow: 'hidden',
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1,
      }}>
        {/* Palette */}
        <Box sx={{ bgcolor: '#fafafa', borderRight: '1px solid', borderColor: 'divider' }}>
          <StepPalette onAddStep={handleAddStep} readOnly={!canEdit || !isDraft} />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Liste des étapes */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <StepList
            steps={steps}
            onStepsChange={setSteps}
            creditTypes={creditTypes}
            readOnly={!canEdit || !isDraft}
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Aperçu React Flow */}
        <Box sx={{ width: 380, display: 'flex', flexDirection: 'column', borderLeft: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{
            p: 1.5, fontWeight: 700, textTransform: 'uppercase',
            borderBottom: '1px solid', borderColor: 'divider',
          }}>
            Aperçu du workflow
          </Typography>
          <WorkflowPreview steps={steps} />
        </Box>
      </Box>
    </Box>
  );
}
