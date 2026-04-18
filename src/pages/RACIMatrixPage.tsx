import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Divider, ToggleButton, ToggleButtonGroup, Tab, Tabs,
  CircularProgress, Alert, Button, Avatar, AvatarGroup, Menu, MenuItem,
  ListItemText, Switch, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, FormControl, InputLabel, IconButton,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { raciMatrixApi, RaciMatrix, RaciStep, RaciStepRole, ChineseWallRule, RaciCode, NewStep, UpdateStepPayload } from '../services/raciMatrixApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_ROLES = [
  { key: 'CHARGE_AFFAIRES',         short: 'CA',    label: "Chargé d'Affaires",     color: '#2563EB' },
  { key: 'ANALYSTE_RISQUES',        short: 'ANA',   label: 'Analyste Risques',       color: '#7C3AED' },
  { key: 'RESPONSABLE_RISQUES',     short: 'R.Ris', label: 'Resp. Risques',          color: '#6D28D9' },
  { key: 'RESPONSABLE_ENGAGEMENTS', short: 'R.Eng', label: 'Resp. Engagements',      color: '#0891B2' },
  { key: 'COMITE_CREDIT',           short: 'CC',    label: 'Comité de Crédit',       color: '#D97706' },
  { key: 'DIRECTION_GENERALE',      short: 'DG',    label: 'Direction Générale',     color: '#DC2626' },
  { key: 'DIRECTION_JURIDIQUE',     short: 'Jur',   label: 'Direction Juridique',    color: '#059669' },
  { key: 'BACK_OFFICE',             short: 'BO',    label: 'Back Office',            color: '#6B7280' },
] as const;

const RACI_CONFIG: Record<RaciCode, { label: string; color: string; bg: string }> = {
  R: { label: 'Responsible',  color: '#1D4ED8', bg: '#EFF6FF' },
  A: { label: 'Accountable',  color: '#B45309', bg: '#FFFBEB' },
  C: { label: 'Consulted',    color: '#6D28D9', bg: '#F5F3FF' },
  I: { label: 'Informed',     color: '#6B7280', bg: '#F9FAFB' },
};

const PHASE_COLORS: Record<string, string> = {
  'Montage dossier': '#2563EB',
  'Analyse risques': '#7C3AED',
  'Approbation':     '#D97706',
  'Mise en place':   '#059669',
};

const POLICY_STEP_TYPES = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];

const CONCERNED_WALL_ROLES = ALL_ROLES.filter(r =>
  ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'RESPONSABLE_ENGAGEMENTS'].includes(r.key)
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRaciForRole(step: RaciStep, roleKey: string): RaciCode | '' {
  if (step.assignedRole === roleKey) return 'R';
  const entry = step.roles.find(r => r.role === roleKey);
  return (entry?.raciCode as RaciCode) ?? '';
}

function getUserInitials(name: string): string {
  return name.split(' ').map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
}

// ─── Sous-composant : cellule RACI ───────────────────────────────────────────

interface RaciCellProps {
  code: RaciCode | '';
  editable: boolean;
  onSet: (code: RaciCode | '') => void;
}

const RaciCell: React.FC<RaciCellProps> = ({ code, editable, onSet }) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const cfg = code ? RACI_CONFIG[code] : null;

  const content = cfg ? (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '6px',
      bgcolor: cfg.bg, border: `1px solid ${cfg.color}22`,
      cursor: editable ? 'pointer' : 'default',
    }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>
        {code}
      </Typography>
    </Box>
  ) : (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '6px',
      border: editable ? '1px dashed #E5E7EB' : 'none',
      cursor: editable ? 'pointer' : 'default',
    }}>
      <Typography sx={{ fontSize: 14, color: '#D1D5DB' }}>–</Typography>
    </Box>
  );

  if (!editable) {
    return (
      <TableCell align="center" sx={{ px: 1 }}>
        <Tooltip title={cfg?.label ?? '—'} arrow>{content}</Tooltip>
      </TableCell>
    );
  }

  return (
    <TableCell align="center" sx={{ px: 1 }}>
      <Tooltip title={cfg?.label ?? 'Cliquer pour assigner'} arrow>
        <Box onClick={(e) => setAnchor(e.currentTarget)}>{content}</Box>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {(['R', 'A', 'C', 'I'] as RaciCode[]).map(c => (
          <MenuItem key={c} onClick={() => { onSet(c); setAnchor(null); }}
            selected={code === c}
            sx={{ gap: 1 }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '4px', bgcolor: RACI_CONFIG[c].bg, border: `1px solid ${RACI_CONFIG[c].color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: RACI_CONFIG[c].color }}>{c}</Typography>
            </Box>
            <ListItemText primary={RACI_CONFIG[c].label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { onSet(''); setAnchor(null); }}>
          <ListItemText primary="Effacer" sx={{ color: 'text.secondary' }} />
        </MenuItem>
      </Menu>
    </TableCell>
  );
};

// ─── Onglet 1 : Matrice RACI ──────────────────────────────────────────────────

interface MatrixTabProps {
  steps: RaciStep[];
  editing: boolean;
  onCellChange: (stepId: string, role: string, code: RaciCode | '') => void;
}

const MatrixTab: React.FC<MatrixTabProps> = ({ steps, editing, onCellChange }) => {
  const [activePhase, setActivePhase] = useState<string>('all');

  const phases = steps
    .map(s => s.phase ?? 'Sans phase')
    .filter((p, i, arr) => arr.indexOf(p) === i);

  const filtered = activePhase === 'all' ? steps : steps.filter(s => (s.phase ?? 'Sans phase') === activePhase);

  const presentRoles = useMemo(() =>
    ALL_ROLES.filter(r =>
      steps.some(s => s.assignedRole === r.key || s.roles.some(sr => sr.role === r.key))
    ),
  [steps]);

  return (
    <Box>
      {/* Légende */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }} elevation={0} variant="outlined">
        {(Object.entries(RACI_CONFIG) as [RaciCode, typeof RACI_CONFIG[RaciCode]][]).map(([code, cfg]) => (
          <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 22, height: 22, borderRadius: '4px', bgcolor: cfg.bg, border: `1px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{code}</Typography>
            </Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary">{code} — {cfg.label}</Typography>
          </Box>
        ))}
      </Paper>

      {/* Filtre phases */}
      <ToggleButtonGroup value={activePhase} exclusive onChange={(_, v) => v && setActivePhase(v)} size="small" sx={{ mb: 2 }}>
        <ToggleButton value="all">Toutes</ToggleButton>
        {phases.map(p => (
          <ToggleButton key={p} value={p} sx={{ color: PHASE_COLORS[p] ?? 'text.primary' }}>{p}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Tableau */}
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 200, bgcolor: '#F8FAFC', fontWeight: 700 }}>Étape</TableCell>
              {presentRoles.map(r => (
                <TableCell key={r.key} align="center" sx={{ bgcolor: '#F8FAFC', minWidth: 70, px: 1 }}>
                  <Tooltip title={r.label} arrow>
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.short}</Typography>
                    </Box>
                  </Tooltip>
                  {steps.flatMap(s => s.users[r.key] ?? []).length > 0 && (
                    <AvatarGroup max={3} sx={{ justifyContent: 'center', mt: 0.5, '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 9, border: `1px solid ${r.color}40` } }}>
                      {Array.from(new Map(steps.flatMap(s => s.users[r.key] ?? []).map(u => [u.id, u])).values()).map(u => (
                        <Tooltip key={u.id} title={`${u.name} — ${u.email}`} arrow>
                          <Avatar sx={{ bgcolor: `${r.color}18`, color: r.color, fontWeight: 700 }}>
                            {getUserInitials(u.name)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((step, idx) => {
              const prevPhase = idx > 0 ? (filtered[idx - 1].phase ?? 'Sans phase') : null;
              const currentPhase = step.phase ?? 'Sans phase';
              const showPhase = currentPhase !== prevPhase;
              const phaseColor = PHASE_COLORS[currentPhase] ?? '#6B7280';

              return (
                <React.Fragment key={step.id}>
                  {showPhase && (
                    <TableRow>
                      <TableCell colSpan={presentRoles.length + 1}
                        sx={{ bgcolor: `${phaseColor}12`, borderLeft: `3px solid ${phaseColor}`, py: 0.5, px: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: phaseColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {currentPhase}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow hover>
                    <TableCell sx={{ py: 1 }}>
                      <Typography fontSize={13} fontWeight={600}>{step.stepLabel}</Typography>
                      <Typography fontSize={11} color="text.secondary" fontFamily="monospace">{step.stepName}</Typography>
                    </TableCell>
                    {presentRoles.map(r => (
                      <RaciCell
                        key={r.key}
                        code={getRaciForRole(step, r.key)}
                        editable={editing}
                        onSet={(code) => onCellChange(step.id, r.key, code)}
                      />
                    ))}
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

// ─── Onglet 2 : Mur Chinois ───────────────────────────────────────────────────

interface ChineseWallTabProps {
  rules: ChineseWallRule[];
  steps: RaciStep[];
  editing: boolean;
  onChange: (rules: ChineseWallRule[]) => void;
}

const ChineseWallTab: React.FC<ChineseWallTabProps> = ({ rules, steps, editing, onChange }) => {
  const toggleRule = (role: string, stepName: string) => {
    const exists = rules.find(r => r.blockedRole === role && r.forbiddenStep === stepName);
    if (exists) {
      onChange(rules.filter(r => !(r.blockedRole === role && r.forbiddenStep === stepName)));
    } else {
      onChange([...rules, { blockedRole: role, forbiddenStep: stepName, reason: 'Mur chinois' }]);
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Les rôles cochés sont <strong>interdits</strong> d'intervenir sur les étapes marquées. Principe BCEAO de non-cumul des fonctions.
      </Typography>
      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAFC', minWidth: 180 }}>Rôle bloqué ↓ / Étape →</TableCell>
              {steps.map(s => (
                <TableCell key={s.id} align="center" sx={{ bgcolor: '#F8FAFC', minWidth: 90, fontSize: 11, px: 1 }}>
                  <Tooltip title={s.stepLabel} arrow>
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                      {s.stepName}
                    </Typography>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {CONCERNED_WALL_ROLES.map(role => (
              <TableRow key={role.key} hover>
                <TableCell>
                  <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: `${role.color}18`, color: role.color, fontWeight: 700, fontSize: 11 }}>{role.short}</Box>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{role.label}</Typography>
                </TableCell>
                {steps.map(s => {
                  const blocked = rules.some(r => r.blockedRole === role.key && r.forbiddenStep === s.stepName);
                  return (
                    <TableCell key={s.id} align="center" sx={{ px: 0 }}>
                      <Tooltip title={blocked ? 'Interdit — cliquer pour autoriser' : 'Autorisé — cliquer pour bloquer'} arrow>
                        <Switch
                          checked={blocked}
                          onChange={() => editing && toggleRule(role.key, s.stepName)}
                          size="small"
                          color="error"
                          disabled={!editing}
                          sx={{ '& .MuiSwitch-thumb': { width: 12, height: 12 } }}
                        />
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

// ─── Onglet 3 : Étapes ────────────────────────────────────────────────────────

interface StepsTabProps {
  steps: RaciStep[];
  onDelete: (stepId: string) => void;
  onAdd: (step: NewStep) => void;
}

const StepsTab: React.FC<StepsTabProps> = ({ steps, onDelete, onAdd }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewStep>({
    stepName: '', stepLabel: '', phase: '', assignedRole: 'CHARGE_AFFAIRES',
    stepType: 'DISPATCH', expectedDurationHours: 24, maxDurationHours: 72,
  });

  const handleAdd = () => {
    if (!form.stepName || !form.stepLabel) return;
    onAdd(form);
    setDialogOpen(false);
    setForm({ stepName: '', stepLabel: '', phase: '', assignedRole: 'CHARGE_AFFAIRES', stepType: 'DISPATCH', expectedDurationHours: 24, maxDurationHours: 72 });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Ajouter une étape
        </Button>
      </Box>
      <Paper variant="outlined">
        {steps.map((step, idx) => (
          <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: idx < steps.length - 1 ? '1px solid #F1F5F9' : 'none', gap: 2 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: `${PHASE_COLORS[step.phase ?? ''] ?? '#6B7280'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: PHASE_COLORS[step.phase ?? ''] ?? '#6B7280' }}>{step.order}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={13} fontWeight={600}>{step.stepLabel}</Typography>
              <Typography fontSize={11} color="text.secondary" fontFamily="monospace">{step.stepName} • {step.phase ?? '—'} • {step.assignedRole}</Typography>
            </Box>
            <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, border: '1px solid #E5E7EB', fontSize: 10 }}>{step.stepType}</Box>
            <Tooltip title="Supprimer l'étape (désactivation)">
              <IconButton size="small" color="error" onClick={() => onDelete(step.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle étape</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Slug (stepName)" value={form.stepName} onChange={e => setForm(f => ({ ...f, stepName: e.target.value }))} size="small" fullWidth required helperText="ex: ma_nouvelle_etape (sans espaces)" />
          <TextField label="Libellé affiché" value={form.stepLabel} onChange={e => setForm(f => ({ ...f, stepLabel: e.target.value }))} size="small" fullWidth required />
          <TextField label="Phase" value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} size="small" fullWidth helperText="ex: Montage dossier" />
          <FormControl size="small" fullWidth>
            <InputLabel>Rôle Responsible (R)</InputLabel>
            <Select value={form.assignedRole} label="Rôle Responsible (R)" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, assignedRole: e.target.value }))}>
              {ALL_ROLES.map(r => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Type d'étape</InputLabel>
            <Select value={form.stepType ?? 'DISPATCH'} label="Type d'étape" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, stepType: e.target.value }))}>
              {POLICY_STEP_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="SLA attendu (h)" type="number" value={form.expectedDurationHours} onChange={e => setForm(f => ({ ...f, expectedDurationHours: Number(e.target.value) }))} size="small" />
            <TextField label="SLA max (h)" type="number" value={form.maxDurationHours} onChange={e => setForm(f => ({ ...f, maxDurationHours: Number(e.target.value) }))} size="small" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.stepName || !form.stepLabel}>Créer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

const RACIMatrixPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<RaciMatrix | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [editSteps, setEditSteps] = useState<RaciStep[]>([]);
  const [editWallRules, setEditWallRules] = useState<ChineseWallRule[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await raciMatrixApi.getMatrix();
      setMatrix(res.data);
      setEditSteps(res.data.steps);
      setEditWallRules(res.data.chineseWallRules);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg ?? 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEditing = () => { setEditing(true); setDirty(false); };

  const cancelEditing = () => {
    setEditing(false);
    setDirty(false);
    if (matrix) {
      setEditSteps(matrix.steps);
      setEditWallRules(matrix.chineseWallRules);
    }
  };

  const handleCellChange = useCallback((stepId: string, role: string, code: RaciCode | '') => {
    setEditSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;

      if (code === 'R') {
        const rolesWithoutR = step.roles.filter(r => r.raciCode !== 'R');
        return { ...step, assignedRole: role, roles: rolesWithoutR };
      }

      const filtered = step.roles.filter(r => r.role !== role);

      if (!code) {
        if (step.assignedRole === role) return step;
        return { ...step, roles: filtered };
      }

      return { ...step, roles: [...filtered, { role, raciCode: code }] };
    }));
    setDirty(true);
  }, []);

  const handleWallRulesChange = (rules: ChineseWallRule[]) => {
    setEditWallRules(rules);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!matrix) return;
    try {
      const original = matrix.steps;
      for (const step of editSteps) {
        const orig = original.find(s => s.id === step.id);
        if (!orig) continue;

        if (orig.assignedRole !== step.assignedRole) {
          const payload: UpdateStepPayload = { assignedRole: step.assignedRole };
          await raciMatrixApi.updateStep(step.id, payload);
        }

        const origRolesStr = JSON.stringify([...orig.roles].sort((a, b) => a.role.localeCompare(b.role)));
        const newRolesStr  = JSON.stringify([...step.roles].sort((a, b) => a.role.localeCompare(b.role)));
        if (origRolesStr !== newRolesStr) {
          await raciMatrixApi.updateStepRoles(step.id, step.roles);
        }
      }

      await raciMatrixApi.updateChineseWall(
        editWallRules.map(({ blockedRole, forbiddenStep, reason }) => ({ blockedRole, forbiddenStep, reason }))
      );

      setEditing(false);
      setDirty(false);
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg ?? 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!window.confirm('Désactiver cette étape ?')) return;
    try {
      await raciMatrixApi.deleteStep(stepId);
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg ?? 'Erreur lors de la suppression');
    }
  };

  const handleAddStep = async (step: NewStep) => {
    try {
      await raciMatrixApi.createStep(step);
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg ?? 'Erreur lors de la création');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Matrice RACI — Processus Crédit</Typography>
          <Typography variant="body2" color="text.secondary">
            {matrix?.policy
              ? `Politique active : ${matrix.policy.name} (v${matrix.policy.version})`
              : 'Aucune politique active — créez une CreditPolicy pour commencer.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {editing ? (
            <>
              <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={cancelEditing}>Annuler</Button>
              <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty}>
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={startEditing} disabled={!matrix?.policy}>
              Modifier
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!matrix?.policy ? (
        <Alert severity="info">Aucune politique de crédit active. Rendez-vous dans <strong>Politique de Crédit</strong> pour en créer une.</Alert>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E5E7EB' }}>
            <Tab label="Matrice RACI" />
            <Tab label="Mur Chinois" />
            <Tab label={`Étapes (${editSteps.length})`} />
          </Tabs>

          {tab === 0 && (
            <MatrixTab
              steps={editSteps}
              editing={editing}
              onCellChange={handleCellChange}
            />
          )}

          {tab === 1 && (
            <ChineseWallTab
              rules={editWallRules}
              steps={editSteps}
              editing={editing}
              onChange={handleWallRulesChange}
            />
          )}

          {tab === 2 && (
            <StepsTab
              steps={editSteps}
              onDelete={handleDeleteStep}
              onAdd={handleAddStep}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default RACIMatrixPage;
