import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert, Snackbar,
  Select, MenuItem, FormControl, InputLabel, Accordion,
  AccordionSummary, AccordionDetails, Switch, FormControlLabel,
  Chip, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import { TENANT_MODULES } from '../../config/moduleRegistry';
import { moduleProfileApi } from '../../services/api';
import { USER_ROLE_LABELS } from '../../types';

const SCOPE_LABELS: Record<string, string> = {
  BRANCH_ONLY: 'Agence uniquement',
  MULTI_BRANCH: 'Multi-agences',
  ALL_BRANCHES: 'Tout le réseau',
};

interface ModuleState { visible: boolean; actions: string[]; sections: string[]; }

interface Props {
  userId: string;
  userName: string;
  userRole: string;
}

export const UserScopeEditor: React.FC<Props> = ({ userId, userName, userRole }) => {
  const [override, setOverride] = useState<any>(null);
  const [mergedProfile, setMergedProfile] = useState<any>(null);
  const [modules, setModules] = useState<Record<string, ModuleState>>({});
  const [dataScope, setDataScope] = useState<string | null>(null);
  const [hasCustomModules, setHasCustomModules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const load = async () => {
    setLoading(true);
    const res = await moduleProfileApi.getUserOverride(userId);
    if (res.success) {
      setOverride(res.data.override);
      setMergedProfile(res.data.mergedProfile);
      if (res.data.override?.modules) {
        setModules(res.data.override.modules as Record<string, ModuleState>);
        setHasCustomModules(true);
      } else {
        const base = res.data.mergedProfile?.modules ?? {};
        const filled: Record<string, ModuleState> = {};
        TENANT_MODULES.forEach(m => { filled[m.key] = base[m.key] ?? { visible: false, actions: [], sections: [] }; });
        setModules(filled);
        setHasCustomModules(false);
      }
      setDataScope(res.data.override?.dataScope ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

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
    const res = await moduleProfileApi.updateUserOverride(userId, {
      modules: hasCustomModules ? modules : undefined,
      dataScope: dataScope ?? undefined,
    });
    setSaving(false);
    if (res.success) {
      await load();
      setSnack({ open: true, msg: 'Override sauvegardé', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  const deleteOverride = async () => {
    setSaving(true);
    const res = await moduleProfileApi.deleteUserOverride(userId);
    setSaving(false);
    if (res.success) {
      await load();
      setSnack({ open: true, msg: 'Override supprimé, retour au profil du rôle', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>{userName}</Typography>
        <Chip label={(USER_ROLE_LABELS as Record<string, string>)[userRole] ?? userRole} size="small" variant="outlined" />
        {override && <Chip label="Override actif" size="small" color="warning" />}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Périmètre de données</InputLabel>
          <Select
            value={dataScope ?? ''}
            label="Périmètre de données"
            displayEmpty
            onChange={e => setDataScope(e.target.value || null)}
          >
            <MenuItem value=""><em>Hériter du rôle ({SCOPE_LABELS[mergedProfile?.dataScope ?? 'BRANCH_ONLY']})</em></MenuItem>
            {Object.entries(SCOPE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={hasCustomModules} onChange={e => setHasCustomModules(e.target.checked)} size="small" />}
          label={<Typography variant="caption">Override modules personnalisés</Typography>}
        />
      </Box>

      {hasCustomModules && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
          {TENANT_MODULES.map(mod => {
            const state = modules[mod.key] ?? { visible: false, actions: [], sections: [] };
            return (
              <Accordion key={mod.key} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: state.visible ? 'primary.light' : 'divider', borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
                    <FormControlLabel
                      control={<Switch size="small" checked={state.visible} onChange={() => toggleVisible(mod.key)} onClick={e => e.stopPropagation()} />}
                      label=""
                      sx={{ m: 0 }}
                    />
                    <Typography variant="body2" fontWeight={state.visible ? 600 : 400}>{mod.label}</Typography>
                  </Box>
                </AccordionSummary>
                {state.visible && (mod.actions.length > 0 || mod.sections.length > 0) && (
                  <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    {mod.actions.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Actions</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {mod.actions.map(a => (
                            <Chip key={a.key} label={a.label} size="small"
                              onClick={() => toggleAction(mod.key, a.key)}
                              color={state.actions.includes(a.key) ? 'primary' : 'default'}
                              variant={state.actions.includes(a.key) ? 'filled' : 'outlined'}
                              sx={{ cursor: 'pointer', fontSize: '0.7rem' }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {mod.sections.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Sections</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {mod.sections.map(s => (
                            <Chip key={s.key} label={s.label} size="small"
                              onClick={() => toggleSection(mod.key, s.key)}
                              color={state.sections.includes(s.key) ? 'secondary' : 'default'}
                              variant={state.sections.includes(s.key) ? 'filled' : 'outlined'}
                              sx={{ cursor: 'pointer', fontSize: '0.7rem' }} />
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

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={save} disabled={saving}>
          Sauvegarder
        </Button>
        {override && (
          <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />}
            onClick={deleteOverride} disabled={saving}>
            Supprimer l'override
          </Button>
        )}
      </Box>

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(p => ({ ...p, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
