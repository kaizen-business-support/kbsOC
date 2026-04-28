import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, CardHeader, Button, Chip,
  CircularProgress, Alert, Switch, FormControlLabel, Divider,
  Accordion, AccordionSummary, AccordionDetails, Select, MenuItem,
  FormControl, InputLabel, Tooltip, IconButton, Snackbar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { TENANT_MODULES, ModuleDef } from '../../config/moduleRegistry';
import { moduleProfileApi } from '../../services/api';
import { USER_ROLE_LABELS, UserRole } from '../../types';

const TENANT_ROLES: UserRole[] = [
  'CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE',
  'ADMIN', 'BACK_OFFICE', 'DIRECTION_JURIDIQUE',
];

const SCOPE_LABELS: Record<string, string> = {
  BRANCH_ONLY: 'Agence uniquement',
  MULTI_BRANCH: 'Multi-agences',
  ALL_BRANCHES: 'Tout le réseau',
};

interface ModuleState {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export const RoleProfileEditor: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('CHARGE_AFFAIRES');
  const [modules, setModules] = useState<Record<string, ModuleState>>({});
  const [dataScope, setDataScope] = useState<string>('BRANCH_ONLY');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const buildDefault = (): Record<string, ModuleState> =>
    Object.fromEntries(TENANT_MODULES.map(m => [m.key, { visible: false, actions: [], sections: [] }]));

  const load = async (role: UserRole) => {
    setLoading(true);
    const res = await moduleProfileApi.getByRole(role);
    if (res.success && res.data) {
      const raw = res.data.modules as Record<string, ModuleState>;
      const merged = buildDefault();
      for (const key of Object.keys(merged)) {
        if (raw[key]) merged[key] = raw[key];
      }
      setModules(merged);
      setDataScope(res.data.defaultScope ?? 'BRANCH_ONLY');
    } else {
      setModules(buildDefault());
      setDataScope('BRANCH_ONLY');
    }
    setLoading(false);
  };

  useEffect(() => { load(selectedRole); }, [selectedRole]);

  const toggleVisible = (key: string) =>
    setModules(prev => ({ ...prev, [key]: { ...prev[key], visible: !prev[key].visible } }));

  const toggleAction = (moduleKey: string, action: string) =>
    setModules(prev => {
      const mod = prev[moduleKey];
      const actions = mod.actions.includes(action)
        ? mod.actions.filter(a => a !== action)
        : [...mod.actions, action];
      return { ...prev, [moduleKey]: { ...mod, actions } };
    });

  const toggleSection = (moduleKey: string, section: string) =>
    setModules(prev => {
      const mod = prev[moduleKey];
      const sections = mod.sections.includes(section)
        ? mod.sections.filter(s => s !== section)
        : [...mod.sections, section];
      return { ...prev, [moduleKey]: { ...mod, sections } };
    });

  const save = async () => {
    setSaving(true);
    const res = await moduleProfileApi.updateRole(selectedRole, {
      modules,
      defaultScope: dataScope,
      label: USER_ROLE_LABELS[selectedRole],
    });
    setSaving(false);
    if (res.success) {
      setSnack({ open: true, msg: 'Profil sauvegardé', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  const reset = async () => {
    setSaving(true);
    const res = await moduleProfileApi.resetRole(selectedRole);
    setSaving(false);
    if (res.success) {
      await load(selectedRole);
      setSnack({ open: true, msg: 'Profil réinitialisé aux valeurs par défaut', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Rôle</InputLabel>
          <Select
            value={selectedRole}
            label="Rôle"
            onChange={e => setSelectedRole(e.target.value as UserRole)}
          >
            {TENANT_ROLES.map(r => (
              <MenuItem key={r} value={r}>{USER_ROLE_LABELS[r]}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Périmètre de données</InputLabel>
          <Select
            value={dataScope}
            label="Périmètre de données"
            onChange={e => setDataScope(e.target.value)}
          >
            {Object.entries(SCOPE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Tooltip title="Réinitialiser aux valeurs par défaut">
            <span>
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={reset}
                disabled={saving || loading}
                color="warning"
                size="small"
              >
                Réinitialiser
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={save}
            disabled={saving || loading}
            size="small"
          >
            Sauvegarder
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TENANT_MODULES.map((mod: ModuleDef) => {
            const state = modules[mod.key] ?? { visible: false, actions: [], sections: [] };
            return (
              <Accordion key={mod.key} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: state.visible ? 'primary.light' : 'divider', borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={state.visible}
                          onChange={() => toggleVisible(mod.key)}
                          onClick={e => e.stopPropagation()}
                        />
                      }
                      label=""
                      sx={{ m: 0 }}
                    />
                    <Typography variant="body2" fontWeight={state.visible ? 600 : 400}>
                      {mod.label}
                    </Typography>
                    {state.visible && (
                      <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                        <Chip label={`${state.actions.length} action(s)`} size="small" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                        {mod.sections.length > 0 && (
                          <Chip label={`${state.sections.length} section(s)`} size="small" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                        )}
                      </Box>
                    )}
                  </Box>
                </AccordionSummary>
                {state.visible && (mod.actions.length > 0 || mod.sections.length > 0) && (
                  <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    {mod.actions.length > 0 && (
                      <Box sx={{ mb: mod.sections.length > 0 ? 1.5 : 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          Actions autorisées
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {mod.actions.map(a => (
                            <Chip
                              key={a.key}
                              label={a.label}
                              size="small"
                              onClick={() => toggleAction(mod.key, a.key)}
                              color={state.actions.includes(a.key) ? 'primary' : 'default'}
                              variant={state.actions.includes(a.key) ? 'filled' : 'outlined'}
                              sx={{ cursor: 'pointer', fontSize: '0.72rem' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {mod.sections.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          Sections visibles
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {mod.sections.map(s => (
                            <Chip
                              key={s.key}
                              label={s.label}
                              size="small"
                              onClick={() => toggleSection(mod.key, s.key)}
                              color={state.sections.includes(s.key) ? 'secondary' : 'default'}
                              variant={state.sections.includes(s.key) ? 'filled' : 'outlined'}
                              sx={{ cursor: 'pointer', fontSize: '0.72rem' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </AccordionDetails>
                )}
              </Accordion>
            );
          })}
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(p => ({ ...p, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};
