import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Divider, Tab, Tabs, CircularProgress, Alert, Button, Avatar,
  AvatarGroup, Menu, MenuItem, ListItemText, Switch, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, FormControl, InputLabel,
  IconButton, SelectChangeEvent, Chip, Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountTree as PolicyIcon,
  Shield as WallIcon,
  ListAlt as StepsIcon,
  GridOn as MatrixIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as EmptyIcon,
} from '@mui/icons-material';
import {
  raciMatrixApi, RaciMatrix, RaciStep, ChineseWallRule, RaciCode,
  NewStep, UpdateStepPayload,
} from '../services/raciMatrixApi';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_ROLES = [
  { key: 'CHARGE_AFFAIRES',         short: 'CA',   label: "Chargé d'Affaires",    color: '#2563EB', bg: '#EFF6FF' },
  { key: 'ANALYSTE_RISQUES',        short: 'ANA',  label: 'Analyste Risques',      color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'RESPONSABLE_RISQUES',     short: 'R.R',  label: 'Resp. Risques',         color: '#6D28D9', bg: '#F5F3FF' },
  { key: 'RESPONSABLE_ENGAGEMENTS', short: 'R.E',  label: 'Resp. Engagements',     color: '#0891B2', bg: '#ECFEFF' },
  { key: 'COMITE_CREDIT',           short: 'CC',   label: 'Comité de Crédit',      color: '#B45309', bg: '#FFFBEB' },
  { key: 'DIRECTION_GENERALE',      short: 'DG',   label: 'Direction Générale',    color: '#DC2626', bg: '#FEF2F2' },
  { key: 'DIRECTION_JURIDIQUE',     short: 'Jur',  label: 'Direction Juridique',   color: '#059669', bg: '#F0FDF4' },
  { key: 'BACK_OFFICE',             short: 'BO',   label: 'Back Office',           color: '#64748B', bg: '#F8FAFC' },
] as const;

const RACI_CONFIG: Record<RaciCode, { label: string; description: string; color: string; border: string; bg: string; dot: string }> = {
  R: { label: 'Responsable',  description: 'Réalise la tâche',        color: '#1D4ED8', border: '#BFDBFE', bg: '#EFF6FF', dot: '#3B82F6' },
  A: { label: 'Approbateur',  description: 'Valide et rend compte',   color: '#92400E', border: '#FDE68A', bg: '#FFFBEB', dot: '#F59E0B' },
  C: { label: 'Consulté',     description: 'Consulté avant décision', color: '#5B21B6', border: '#DDD6FE', bg: '#F5F3FF', dot: '#8B5CF6' },
  I: { label: 'Informé',      description: 'Informé après décision',  color: '#374151', border: '#E5E7EB', bg: '#F9FAFB', dot: '#9CA3AF' },
};

const PHASES: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'Montage dossier', label: 'Montage dossier', color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'Analyse risques', label: 'Analyse risques', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'Approbation',     label: 'Approbation',     color: '#B45309', bg: '#FFFBEB' },
  { key: 'Mise en place',   label: 'Mise en place',   color: '#059669', bg: '#F0FDF4' },
];

const PHASE_MAP: Record<string, { color: string; bg: string }> = Object.fromEntries(
  PHASES.map(p => [p.key, { color: p.color, bg: p.bg }])
);

const POLICY_STEP_TYPES = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];
const STEP_TYPE_LABELS: Record<string, string> = {
  DISPATCH: 'Dispatching', ANALYSIS: 'Analyse', APPROVAL: 'Approbation', COMMITTEE: 'Comité',
};

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

// ─── Cellule RACI ─────────────────────────────────────────────────────────────

interface RaciCellProps {
  code: RaciCode | '';
  editable: boolean;
  onSet: (code: RaciCode | '') => void;
}

const RaciCell: React.FC<RaciCellProps> = ({ code, editable, onSet }) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const cfg = code ? RACI_CONFIG[code] : null;

  const badge = cfg ? (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: '8px',
      bgcolor: cfg.bg,
      border: `1.5px solid ${cfg.border}`,
      cursor: editable ? 'pointer' : 'default',
      transition: 'all 0.15s ease',
      '&:hover': editable ? { transform: 'scale(1.12)', boxShadow: `0 2px 8px ${cfg.dot}40` } : {},
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: '0.5px', fontFamily: 'monospace' }}>
        {code}
      </Typography>
    </Box>
  ) : (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: '8px',
      border: editable ? '1.5px dashed #CBD5E1' : 'none',
      cursor: editable ? 'pointer' : 'default',
      transition: 'all 0.15s ease',
      '&:hover': editable ? { borderColor: '#94A3B8', bgcolor: '#F8FAFC' } : {},
    }}>
      <Typography sx={{ fontSize: 16, color: '#CBD5E1', lineHeight: 1 }}>·</Typography>
    </Box>
  );

  if (!editable) {
    return (
      <TableCell align="center" sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
        <Tooltip title={cfg ? `${cfg.label} — ${cfg.description}` : '—'} arrow placement="top">
          {badge}
        </Tooltip>
      </TableCell>
    );
  }

  return (
    <TableCell align="center" sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
      <Tooltip title={cfg ? `${cfg.label} — ${cfg.description}` : 'Cliquer pour assigner'} arrow placement="top">
        <Box onClick={e => setAnchor(e.currentTarget)}>{badge}</Box>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { minWidth: 200, p: 0.5 } }}
      >
        {(['R', 'A', 'C', 'I'] as RaciCode[]).map(c => (
          <MenuItem
            key={c}
            onClick={() => { onSet(c); setAnchor(null); }}
            selected={code === c}
            sx={{ borderRadius: '7px', gap: 1.5, py: 1 }}
          >
            <Box sx={{
              width: 28, height: 28, borderRadius: '7px',
              bgcolor: RACI_CONFIG[c].bg, border: `1.5px solid ${RACI_CONFIG[c].border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: RACI_CONFIG[c].color, fontFamily: 'monospace' }}>{c}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{RACI_CONFIG[c].label}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{RACI_CONFIG[c].description}</Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { onSet(''); setAnchor(null); }} sx={{ borderRadius: '7px', color: 'text.secondary', gap: 1.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', border: '1.5px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 16, color: '#CBD5E1' }}>·</Typography>
          </Box>
          <Typography sx={{ fontSize: 13 }}>Effacer</Typography>
        </MenuItem>
      </Menu>
    </TableCell>
  );
};

// ─── Onglet Matrice RACI ──────────────────────────────────────────────────────

interface MatrixTabProps {
  steps: RaciStep[];
  editing: boolean;
  onCellChange: (stepId: string, role: string, code: RaciCode | '') => void;
}

const MatrixTab: React.FC<MatrixTabProps> = ({ steps, editing, onCellChange }) => {
  const [activePhase, setActivePhase] = useState<string>('all');

  const presentPhases = steps
    .map(s => s.phase ?? 'Sans phase')
    .filter((p, i, arr) => arr.indexOf(p) === i);

  const presentRoles = useMemo(() =>
    ALL_ROLES.filter(r =>
      steps.some(s => s.assignedRole === r.key || s.roles.some(sr => sr.role === r.key))
    ),
  [steps]);

  const filtered = activePhase === 'all' ? steps : steps.filter(s => (s.phase ?? 'Sans phase') === activePhase);

  // Calcul des stats de couverture
  const totalCells = filtered.length * presentRoles.length;
  const filledCells = filtered.reduce((acc, step) =>
    acc + presentRoles.filter(r => getRaciForRole(step, r.key) !== '').length, 0
  );
  const coverage = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  return (
    <Box>
      {/* Légende RACI */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5, mb: 3,
          background: 'linear-gradient(135deg, #FAFAFA 0%, #F8FAFC 100%)',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
          {(Object.entries(RACI_CONFIG) as [RaciCode, typeof RACI_CONFIG[RaciCode]][]).map(([code, cfg]) => (
            <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{
                width: 30, height: 30, borderRadius: '8px',
                bgcolor: cfg.bg, border: `1.5px solid ${cfg.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: cfg.color, fontFamily: 'monospace' }}>{code}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: cfg.color, lineHeight: 1.2 }}>{cfg.label}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>{cfg.description}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {/* Taux de couverture */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Couverture
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: coverage >= 80 ? '#059669' : coverage >= 50 ? '#B45309' : '#DC2626', lineHeight: 1 }}>
              {coverage}%
            </Typography>
          </Box>
          <Box sx={{
            width: 48, height: 48, borderRadius: '50%',
            background: `conic-gradient(${coverage >= 80 ? '#10B981' : coverage >= 50 ? '#F59E0B' : '#EF4444'} ${coverage * 3.6}deg, #E2E8F0 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'white' }} />
          </Box>
        </Box>
      </Paper>

      {/* Filtre phases */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        {['all', ...presentPhases].map(p => {
          const phaseInfo = PHASE_MAP[p];
          const active = activePhase === p;
          return (
            <Box
              key={p}
              onClick={() => setActivePhase(p)}
              sx={{
                px: 2, py: 0.75,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.2px',
                transition: 'all 0.15s ease',
                border: '1.5px solid',
                borderColor: active ? (phaseInfo?.color ?? '#0F766E') : '#E2E8F0',
                bgcolor: active ? (phaseInfo?.bg ?? 'rgba(15,118,110,0.08)') : '#FFFFFF',
                color: active ? (phaseInfo?.color ?? '#0F766E') : '#64748B',
                '&:hover': {
                  borderColor: phaseInfo?.color ?? '#0F766E',
                  color: phaseInfo?.color ?? '#0F766E',
                  bgcolor: phaseInfo?.bg ?? 'rgba(15,118,110,0.06)',
                },
              }}
            >
              {p === 'all' ? 'Toutes les phases' : p}
            </Box>
          );
        })}
      </Box>

      {/* Tableau */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
        }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 700, tableLayout: 'auto' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                <TableCell
                  sx={{
                    minWidth: 220,
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: '#64748B',
                    borderBottom: '2px solid #E2E8F0',
                    py: 1.5,
                    pl: 2.5,
                    position: 'sticky',
                    left: 0,
                    bgcolor: '#F8FAFC',
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Étape de processus
                </TableCell>
                {presentRoles.map(r => {
                  const usersForRole = Array.from(
                    new Map(steps.flatMap(s => s.users[r.key] ?? []).map(u => [u.id, u])).values()
                  );
                  return (
                    <TableCell
                      key={r.key}
                      align="center"
                      sx={{
                        minWidth: 80,
                        px: 1,
                        borderBottom: '2px solid #E2E8F0',
                        py: 1.5,
                        bgcolor: '#F8FAFC',
                      }}
                    >
                      <Tooltip title={r.label} arrow placement="top">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                          <Box sx={{
                            px: 1.25, py: 0.4, borderRadius: '6px',
                            bgcolor: r.bg, border: `1.5px solid ${r.color}30`,
                          }}>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: r.color, letterSpacing: '0.3px' }}>
                              {r.short}
                            </Typography>
                          </Box>
                          {usersForRole.length > 0 && (
                            <AvatarGroup
                              max={3}
                              sx={{
                                '& .MuiAvatar-root': {
                                  width: 20, height: 20, fontSize: 8,
                                  border: '1.5px solid #fff',
                                  fontWeight: 700,
                                },
                              }}
                            >
                              {usersForRole.map(u => (
                                <Tooltip key={u.id} title={`${u.name} · ${u.email}`} arrow>
                                  <Avatar sx={{ bgcolor: r.color }}>
                                    {getUserInitials(u.name)}
                                  </Avatar>
                                </Tooltip>
                              ))}
                            </AvatarGroup>
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((step, idx) => {
                const prevPhase = idx > 0 ? (filtered[idx - 1].phase ?? 'Sans phase') : null;
                const currentPhase = step.phase ?? 'Sans phase';
                const showPhase = currentPhase !== prevPhase;
                const phaseInfo = PHASE_MAP[currentPhase] ?? { color: '#64748B', bg: '#F8FAFC' };

                return (
                  <React.Fragment key={step.id}>
                    {showPhase && (
                      <TableRow>
                        <TableCell
                          colSpan={presentRoles.length + 1}
                          sx={{
                            py: 0.75, px: 0,
                            bgcolor: phaseInfo.bg,
                            borderBottom: 'none',
                            borderTop: idx > 0 ? `1px solid ${phaseInfo.color}20` : 'none',
                          }}
                        >
                          <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            pl: 2.5,
                            borderLeft: `3px solid ${phaseInfo.color}`,
                          }}>
                            <Box sx={{
                              width: 6, height: 6, borderRadius: '50%',
                              bgcolor: phaseInfo.color, flexShrink: 0,
                            }} />
                            <Typography sx={{
                              fontSize: 10, fontWeight: 800, color: phaseInfo.color,
                              textTransform: 'uppercase', letterSpacing: '0.8px',
                            }}>
                              {currentPhase}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: phaseInfo.color, opacity: 0.6 }}>
                              · {filtered.filter(s => (s.phase ?? 'Sans phase') === currentPhase).length} étape(s)
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      sx={{
                        '&:hover': { bgcolor: '#FAFBFF' },
                        transition: 'background-color 0.12s ease',
                        bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
                      }}
                    >
                      <TableCell
                        sx={{
                          py: 1.5, pl: 2.5,
                          borderBottom: '1px solid #F1F5F9',
                          position: 'sticky',
                          left: 0,
                          bgcolor: 'inherit',
                          zIndex: 1,
                          borderLeft: `3px solid ${phaseInfo.color}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                          {step.stepLabel}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.4 }}>
                          <Typography sx={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
                            {step.stepName}
                          </Typography>
                          {step.stepType && (
                            <Box sx={{
                              px: 0.75, py: 0.15, borderRadius: '4px',
                              bgcolor: '#F1F5F9', border: '1px solid #E2E8F0',
                            }}>
                              <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#64748B', letterSpacing: '0.3px' }}>
                                {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      {presentRoles.map(r => (
                        <RaciCell
                          key={r.key}
                          code={getRaciForRole(step, r.key)}
                          editable={editing}
                          onSet={code => onCellChange(step.id, r.key, code)}
                        />
                      ))}
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
};

// ─── Onglet Mur Chinois ───────────────────────────────────────────────────────

interface ChineseWallTabProps {
  rules: ChineseWallRule[];
  steps: RaciStep[];
  editing: boolean;
  onChange: (rules: ChineseWallRule[]) => void;
}

const ChineseWallTab: React.FC<ChineseWallTabProps> = ({ rules, steps, editing, onChange }) => {
  const totalBlocked = rules.length;

  const toggleRule = (role: string, stepName: string) => {
    const exists = rules.find(r => r.blockedRole === role && r.forbiddenStep === stepName);
    if (exists) {
      onChange(rules.filter(r => !(r.blockedRole === role && r.forbiddenStep === stepName)));
    } else {
      onChange([...rules, { blockedRole: role, forbiddenStep: stepName, reason: 'Séparation des fonctions — BCEAO' }]);
    }
  };

  return (
    <Box>
      {/* En-tête informatif */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5, mb: 3,
          background: 'linear-gradient(135deg, #FEF9E7 0%, #FFFBEB 100%)',
          border: '1px solid #FDE68A',
          borderRadius: '12px',
          display: 'flex',
          gap: 3,
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px',
          bgcolor: '#FEF3C7', border: '1.5px solid #FCD34D',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <WallIcon sx={{ fontSize: 20, color: '#B45309' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#92400E', mb: 0.5 }}>
            Principe de séparation des fonctions — BCEAO
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
            Les cellules activées <strong>interdisent</strong> l'intervention du rôle concerné sur l'étape correspondante.
            Ce contrôle est appliqué en temps réel lors du traitement des dossiers et garantit la conformité réglementaire.
          </Typography>
        </Box>
        <Box sx={{
          flexShrink: 0, textAlign: 'center',
          px: 2, py: 1, borderRadius: '10px',
          bgcolor: '#FEF3C7', border: '1.5px solid #FCD34D',
        }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#B45309', lineHeight: 1 }}>{totalBlocked}</Typography>
          <Typography sx={{ fontSize: 10, color: '#92400E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>restriction(s)</Typography>
        </Box>
      </Paper>

      {/* Tableau du Mur */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
        }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                <TableCell sx={{
                  minWidth: 200, fontWeight: 700, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  color: '#64748B', borderBottom: '2px solid #E2E8F0',
                  py: 1.5, pl: 2.5,
                  position: 'sticky', left: 0, bgcolor: '#F8FAFC', zIndex: 2,
                }}>
                  Rôle
                </TableCell>
                {steps.map(s => (
                  <TableCell
                    key={s.id}
                    align="center"
                    sx={{
                      bgcolor: '#F8FAFC', minWidth: 90,
                      borderBottom: '2px solid #E2E8F0', py: 1.5, px: 1,
                    }}
                  >
                    <Tooltip title={s.stepLabel} arrow placement="top">
                      <Box>
                        <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#64748B', fontWeight: 600 }}>
                          {s.stepName.length > 14 ? `${s.stepName.slice(0, 13)}…` : s.stepName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {CONCERNED_WALL_ROLES.map((role, idx) => (
                <TableRow
                  key={role.key}
                  sx={{
                    bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
                    '&:hover': { bgcolor: '#FFF8F0' },
                    transition: 'background-color 0.12s ease',
                  }}
                >
                  <TableCell
                    sx={{
                      py: 1.5, pl: 2.5,
                      borderBottom: '1px solid #F1F5F9',
                      position: 'sticky', left: 0, bgcolor: 'inherit', zIndex: 1,
                      borderLeft: `3px solid ${role.color}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box sx={{
                        px: 1, py: 0.25, borderRadius: '5px',
                        bgcolor: role.bg, border: `1.5px solid ${role.color}30`,
                      }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 800, color: role.color, letterSpacing: '0.3px' }}>
                          {role.short}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                        {role.label}
                      </Typography>
                    </Box>
                  </TableCell>
                  {steps.map(s => {
                    const blocked = rules.some(r => r.blockedRole === role.key && r.forbiddenStep === s.stepName);
                    return (
                      <TableCell
                        key={s.id}
                        align="center"
                        sx={{
                          px: 1, py: 1.5,
                          borderBottom: '1px solid #F1F5F9',
                          bgcolor: blocked ? 'rgba(239,68,68,0.06)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <Tooltip
                          title={blocked
                            ? `Interdit · ${role.label} ne peut pas traiter "${s.stepLabel}"`
                            : `Autorisé · Cliquer pour restreindre`
                          }
                          arrow
                          placement="top"
                        >
                          <Box
                            onClick={() => editing && toggleRule(role.key, s.stepName)}
                            sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: editing ? 'pointer' : 'default',
                              transition: 'transform 0.12s ease',
                              '&:hover': editing ? { transform: 'scale(1.15)' } : {},
                            }}
                          >
                            {blocked ? (
                              <Box sx={{
                                width: 28, height: 28, borderRadius: '8px',
                                bgcolor: '#FEE2E2', border: '1.5px solid #FECACA',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Box sx={{ width: 10, height: 2, bgcolor: '#DC2626', borderRadius: '1px' }} />
                              </Box>
                            ) : (
                              <Box sx={{
                                width: 28, height: 28, borderRadius: '8px',
                                bgcolor: '#F0FDF4', border: '1.5px solid #BBF7D0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <CheckIcon sx={{ fontSize: 14, color: '#16A34A' }} />
                              </Box>
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Légende */}
      <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: '#F0FDF4', border: '1.5px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon sx={{ fontSize: 12, color: '#16A34A' }} />
          </Box>
          <Typography sx={{ fontSize: 12, color: '#475569' }}>Autorisé</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: '#FEE2E2', border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: 8, height: 2, bgcolor: '#DC2626', borderRadius: '1px' }} />
          </Box>
          <Typography sx={{ fontSize: 12, color: '#475569' }}>Interdit (Mur Chinois)</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Onglet Étapes ────────────────────────────────────────────────────────────

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

  const grouped = steps.reduce<Record<string, RaciStep[]>>((acc, s) => {
    const phase = s.phase ?? 'Sans phase';
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(s);
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            {steps.length} étape{steps.length > 1 ? 's' : ''} dans le processus
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#64748B' }}>
            {Object.keys(grouped).length} phase{Object.keys(grouped).length > 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Ajouter une étape
        </Button>
      </Box>

      {Object.entries(grouped).map(([phase, phaseSteps]) => {
        const phaseInfo = PHASE_MAP[phase] ?? { color: '#64748B', bg: '#F8FAFC' };
        return (
          <Box key={phase} sx={{ mb: 3 }}>
            {/* En-tête de phase */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1,
              bgcolor: phaseInfo.bg,
              borderRadius: '8px 8px 0 0',
              borderLeft: `3px solid ${phaseInfo.color}`,
              border: `1px solid ${phaseInfo.color}20`,
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: phaseInfo.color }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: phaseInfo.color, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                {phase}
              </Typography>
              <Chip
                label={`${phaseSteps.length} étape${phaseSteps.length > 1 ? 's' : ''}`}
                size="small"
                sx={{ height: 18, fontSize: 10, bgcolor: phaseInfo.bg, color: phaseInfo.color, border: `1px solid ${phaseInfo.color}30`, ml: 'auto' }}
              />
            </Box>

            {/* Liste des étapes */}
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${phaseInfo.color}20`,
                borderTop: 'none',
                borderRadius: '0 0 10px 10px',
                overflow: 'hidden',
              }}
            >
              {phaseSteps.map((step, idx) => (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2.5,
                    py: 1.75,
                    gap: 2,
                    borderBottom: idx < phaseSteps.length - 1 ? '1px solid #F1F5F9' : 'none',
                    bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
                    transition: 'background-color 0.12s ease',
                    '&:hover': { bgcolor: '#F8FAFC' },
                  }}
                >
                  {/* Numéro d'ordre */}
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                    bgcolor: phaseInfo.bg, border: `1.5px solid ${phaseInfo.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: phaseInfo.color }}>
                      {step.order}
                    </Typography>
                  </Box>

                  {/* Infos étape */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                      {step.stepLabel}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
                        {step.stepName}
                      </Typography>
                      <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#CBD5E1' }} />
                      {(() => {
                        const roleInfo = ALL_ROLES.find(r => r.key === step.assignedRole);
                        return roleInfo ? (
                          <Box sx={{
                            px: 0.75, py: 0.15, borderRadius: '4px',
                            bgcolor: roleInfo.bg, border: `1px solid ${roleInfo.color}30`,
                          }}>
                            <Typography sx={{ fontSize: 9, fontWeight: 700, color: roleInfo.color }}>
                              {roleInfo.short}
                            </Typography>
                          </Box>
                        ) : null;
                      })()}
                    </Box>
                  </Box>

                  {/* Type */}
                  <Box sx={{
                    px: 1.25, py: 0.4, borderRadius: '6px', flexShrink: 0,
                    bgcolor: '#F1F5F9', border: '1px solid #E2E8F0',
                  }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.3px' }}>
                      {STEP_TYPE_LABELS[step.stepType ?? ''] ?? step.stepType}
                    </Typography>
                  </Box>

                  {/* SLA */}
                  {step.expectedDurationHours && (
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                        {step.expectedDurationHours}h
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>SLA</Typography>
                    </Box>
                  )}

                  {/* Supprimer */}
                  <Tooltip title="Désactiver cette étape" arrow>
                    <IconButton
                      size="small"
                      onClick={() => onDelete(step.id)}
                      sx={{
                        color: '#CBD5E1', flexShrink: 0,
                        '&:hover': { color: '#EF4444', bgcolor: '#FEE2E2' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Paper>
          </Box>
        );
      })}

      {/* Dialog ajout */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle étape</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important' }}>
          <TextField
            label="Identifiant interne (slug)"
            value={form.stepName}
            onChange={e => setForm(f => ({ ...f, stepName: e.target.value }))}
            size="small" fullWidth required
            helperText="Minuscules, underscores uniquement — ex: analyse_credit"
          />
          <TextField
            label="Libellé affiché"
            value={form.stepLabel}
            onChange={e => setForm(f => ({ ...f, stepLabel: e.target.value }))}
            size="small" fullWidth required
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Phase</InputLabel>
            <Select value={form.phase} label="Phase" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, phase: e.target.value }))}>
              {PHASES.map(p => <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>)}
              <MenuItem value="">Sans phase</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Rôle Responsable (R)</InputLabel>
            <Select value={form.assignedRole} label="Rôle Responsable (R)" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, assignedRole: e.target.value }))}>
              {ALL_ROLES.map(r => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Type d'étape</InputLabel>
            <Select value={form.stepType ?? 'DISPATCH'} label="Type d'étape" onChange={(e: SelectChangeEvent) => setForm(f => ({ ...f, stepType: e.target.value }))}>
              {POLICY_STEP_TYPES.map(t => <MenuItem key={t} value={t}>{STEP_TYPE_LABELS[t] ?? t}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="SLA cible (heures)"
              type="number"
              value={form.expectedDurationHours}
              onChange={e => setForm(f => ({ ...f, expectedDurationHours: Number(e.target.value) }))}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="SLA maximum (heures)"
              type="number"
              value={form.maxDurationHours}
              onChange={e => setForm(f => ({ ...f, maxDurationHours: Number(e.target.value) }))}
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.stepName || !form.stepLabel}>
            Créer l'étape
          </Button>
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
  const [saving, setSaving] = useState(false);

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
    setEditing(false); setDirty(false);
    if (matrix) { setEditSteps(matrix.steps); setEditWallRules(matrix.chineseWallRules); }
  };

  const handleCellChange = useCallback((stepId: string, role: string, code: RaciCode | '') => {
    setEditSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      if (code === 'R') {
        return { ...step, assignedRole: role, roles: step.roles.filter(r => r.raciCode !== 'R') };
      }
      const filtered = step.roles.filter(r => r.role !== role);
      if (!code) return step.assignedRole === role ? step : { ...step, roles: filtered };
      return { ...step, roles: [...filtered, { role, raciCode: code }] };
    }));
    setDirty(true);
  }, []);

  const handleWallRulesChange = (rules: ChineseWallRule[]) => {
    setEditWallRules(rules); setDirty(true);
  };

  const handleSave = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      for (const step of editSteps) {
        const orig = matrix.steps.find(s => s.id === step.id);
        if (!orig) continue;
        if (orig.assignedRole !== step.assignedRole) {
          await raciMatrixApi.updateStep(step.id, { assignedRole: step.assignedRole } as UpdateStepPayload);
        }
        const origStr = JSON.stringify([...orig.roles].sort((a, b) => a.role.localeCompare(b.role)));
        const newStr  = JSON.stringify([...step.roles].sort((a, b) => a.role.localeCompare(b.role)));
        if (origStr !== newStr) {
          await raciMatrixApi.updateStepRoles(step.id, step.roles);
        }
      }
      const origWall = JSON.stringify([...matrix.chineseWallRules].sort((a, b) => `${a.blockedRole}:${a.forbiddenStep}`.localeCompare(`${b.blockedRole}:${b.forbiddenStep}`)));
      const newWall  = JSON.stringify([...editWallRules].sort((a, b) => `${a.blockedRole}:${a.forbiddenStep}`.localeCompare(`${b.blockedRole}:${b.forbiddenStep}`)));
      if (origWall !== newWall) {
        await raciMatrixApi.updateChineseWall(editWallRules.map(({ blockedRole, forbiddenStep, reason }) => ({ blockedRole, forbiddenStep, reason })));
      }
      setEditing(false); setDirty(false);
      await load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? e.message)
        : e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg ?? 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
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
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
        <CircularProgress size={36} thickness={3} sx={{ color: '#0F766E' }} />
        <Typography sx={{ fontSize: 13, color: '#64748B' }}>Chargement de la matrice…</Typography>
      </Box>
    );
  }

  const tabDefs = [
    { icon: <MatrixIcon sx={{ fontSize: 16 }} />, label: 'Matrice RACI' },
    { icon: <WallIcon sx={{ fontSize: 16 }} />, label: 'Mur Chinois' },
    { icon: <StepsIcon sx={{ fontSize: 16 }} />, label: `Étapes (${editSteps.length})` },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>

      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        {/* Titre + actions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(15,118,110,0.30)',
              }}>
                <MatrixIcon sx={{ fontSize: 18, color: '#fff' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                  Matrice RACI
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#64748B' }}>
                  Gouvernance · Processus d'octroi de crédit
                </Typography>
              </Box>
            </Box>

            {/* Politique active */}
            {matrix?.policy ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 0.5,
                  borderRadius: '8px',
                  bgcolor: 'rgba(15,118,110,0.08)',
                  border: '1px solid rgba(15,118,110,0.18)',
                }}>
                  <PolicyIcon sx={{ fontSize: 13, color: '#0F766E' }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#0F766E' }}>
                    {matrix.policy.name}
                  </Typography>
                  <Box sx={{ width: 1, height: 12, bgcolor: 'rgba(15,118,110,0.25)' }} />
                  <Typography sx={{ fontSize: 11, color: '#0D9488' }}>
                    v{matrix.policy.version}
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 1.25, py: 0.5,
                  borderRadius: '8px',
                  bgcolor: '#F0FDF4', border: '1px solid #BBF7D0',
                }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#16A34A', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>Active</Typography>
                </Box>
              </Box>
            ) : (
              <Typography sx={{ fontSize: 13, color: '#94A3B8', mt: 1 }}>
                Aucune politique active
              </Typography>
            )}
          </Box>

          {/* Boutons */}
          {matrix?.policy && (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {editing ? (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={cancelEditing}
                    color="inherit"
                    sx={{ borderColor: '#E2E8F0', color: '#475569' }}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    sx={{ minWidth: 140 }}
                  >
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={startEditing}
                  sx={{ borderColor: '#0F766E', color: '#0F766E', '&:hover': { bgcolor: 'rgba(15,118,110,0.06)' } }}
                >
                  Modifier la matrice
                </Button>
              )}
            </Stack>
          )}
        </Box>

        {/* Bandeau mode édition */}
        {editing && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1,
            borderRadius: '8px',
            bgcolor: '#FFFBEB',
            border: '1px solid #FDE68A',
          }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F59E0B', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
              Mode édition actif — cliquez sur une cellule pour modifier son code RACI · Les modifications ne sont pas encore sauvegardées
            </Typography>
            {dirty && (
              <Chip
                label="Modifications en attente"
                size="small"
                sx={{ ml: 'auto', bgcolor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', height: 20, fontSize: 10, fontWeight: 700 }}
              />
            )}
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!matrix?.policy ? (
        <Paper
          elevation={0}
          sx={{
            p: 5, textAlign: 'center',
            border: '1px dashed #CBD5E1',
            borderRadius: '16px',
            bgcolor: '#FAFBFF',
          }}
        >
          <PolicyIcon sx={{ fontSize: 48, color: '#CBD5E1', mb: 2 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#334155', mb: 1 }}>
            Aucune politique de crédit active
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', maxWidth: 420, mx: 'auto' }}>
            Rendez-vous dans <strong>Politique de Crédit</strong> pour créer et activer une politique avant de configurer la matrice RACI.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* ── Onglets ─────────────────────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              mb: 3,
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                px: 1,
                pt: 0.5,
                '& .MuiTab-root': {
                  minHeight: 44,
                  py: 1.25,
                  px: 2,
                  borderRadius: '8px',
                  mr: 0.5,
                  gap: 0.75,
                  flexDirection: 'row',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#64748B',
                  textTransform: 'none',
                  '&.Mui-selected': { color: '#0F766E', fontWeight: 700 },
                },
                '& .MuiTabs-indicator': {
                  height: 2,
                  borderRadius: '2px 2px 0 0',
                  background: 'linear-gradient(90deg, #0F766E 0%, #14B8A6 100%)',
                },
              }}
            >
              {tabDefs.map((t, i) => (
                <Tab key={i} icon={t.icon} label={t.label} iconPosition="start" />
              ))}
            </Tabs>
          </Paper>

          {/* ── Contenu ─────────────────────────────────────────────── */}
          {tab === 0 && (
            <MatrixTab steps={editSteps} editing={editing} onCellChange={handleCellChange} />
          )}
          {tab === 1 && (
            <ChineseWallTab rules={editWallRules} steps={editSteps} editing={editing} onChange={handleWallRulesChange} />
          )}
          {tab === 2 && (
            <StepsTab steps={editSteps} onDelete={handleDeleteStep} onAdd={handleAddStep} />
          )}
        </>
      )}
    </Box>
  );
};

export default RACIMatrixPage;
