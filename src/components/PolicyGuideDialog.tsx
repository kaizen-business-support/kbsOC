import React, { useEffect, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  AccountBalance as BankIcon,
  Schedule as ScheduleIcon,
  Verified as VerifiedIcon,
  CalendarMonth as CalIcon,
  Route as RouteIcon,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolicyStep {
  id: string;
  order: number;
  stepName: string;
  stepLabel: string;
  stepType: string;
  assignedRole: string;
  expectedDurationHours: number;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  isRequired: boolean;
}

export interface PolicyGuide {
  id: string;
  name: string;
  code: string;
  description: string | null;
  version: number;
  validFrom: string;
  validTo: string | null;
  steps: PolicyStep[];
}

interface PolicyGuideDialogProps {
  open: boolean;
  policy: PolicyGuide | null;
  onClose: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const DARK  = '#0D1B2A';
const DARK2 = '#132030';
const DARK3 = '#1A2B3C';
const ACCENT = '#14B8A6';     // teal
const GOLD   = '#F59E0B';
const WHITE  = '#FFFFFF';
const MUTED  = 'rgba(255,255,255,0.5)';
const BORDER = 'rgba(255,255,255,0.08)';

// ─── Step type config ─────────────────────────────────────────────────────────

type StepTypeCfg = { label: string; color: string; bg: string; dot: string };

const STEP_CFG: Record<string, StepTypeCfg> = {
  CREATION:  { label: 'Création',    color: '#6366F1', bg: '#EEF2FF', dot: '#6366F1' },
  DISPATCH:  { label: 'Dispatching', color: '#0EA5E9', bg: '#E0F2FE', dot: '#0EA5E9' },
  ANALYSIS:  { label: 'Analyse',     color: '#8B5CF6', bg: '#F5F3FF', dot: '#8B5CF6' },
  APPROVAL:  { label: 'Approbation', color: '#F59E0B', bg: '#FFFBEB', dot: '#F59E0B' },
  COMMITTEE: { label: 'Comité',      color: '#EC4899', bg: '#FDF2F8', dot: '#EC4899' },
  LEGAL:     { label: 'Juridique',   color: '#14B8A6', bg: '#F0FDFA', dot: '#14B8A6' },
};

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES:         'Chargé d\'Affaires',
  ANALYSTE_RISQUES:        'Analyste Risques',
  RESPONSABLE_RISQUES:     'Resp. Risques',
  RESPONSABLE_ENGAGEMENTS: 'Resp. Engagements',
  DIRECTION_GENERALE:      'Direction Générale',
  DIRECTION_JURIDIQUE:     'Direction Juridique',
  COMITE_CREDIT:           'Comité de Crédit',
  BACK_OFFICE:             'Back Office',
  ADMIN:                   'Administrateur',
  SUPER_ADMIN:             'Super Admin',
};

function cfg(type: string): StepTypeCfg {
  return STEP_CFG[type] ?? { label: type, color: '#64748B', bg: '#F8FAFC', dot: '#94A3B8' };
}

function rl(role: string) {
  return ROLE_LABELS[role] || role;
}

function sla(hours: number) {
  if (hours < 24) return `${hours} h`;
  const d = Math.round(hours / 24);
  return `${d} j`;
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) + ' FCFA';
}

// ─── Left sidebar stat pill ───────────────────────────────────────────────────

const StatPill: React.FC<{ icon: React.ReactNode; label: string; value: string; delay: number }> = ({
  icon, label, value, delay,
}) => {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateX(-12px)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 2,
        bgcolor: 'rgba(20,184,166,0.15)',
        border: '1px solid rgba(20,184,166,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ACCENT, flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ color: MUTED, fontSize: '10.5px', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography sx={{ color: WHITE, fontSize: '13px', fontWeight: 700, lineHeight: 1.2, mt: 0.1 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
};

// ─── Step row ─────────────────────────────────────────────────────────────────

const StepRow: React.FC<{ step: PolicyStep; index: number; isLast: boolean; delay: number }> = ({
  step, index, isLast, delay,
}) => {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);

  const c = cfg(step.stepType);
  const hasMin = step.conditionMinAmount !== null;
  const hasMax = step.conditionMaxAmount !== null;

  return (
    <Box sx={{
      display: 'flex', gap: 0,
      opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(14px)',
      transition: 'opacity 0.45s ease, transform 0.45s ease',
    }}>
      {/* Timeline rail */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2.5, pt: 0.5 }}>
        {/* Dot */}
        <Box sx={{
          width: 32, height: 32, borderRadius: '50%',
          border: `2px solid ${c.color}`,
          bgcolor: `${c.color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, zIndex: 1,
        }}>
          <Typography sx={{ fontWeight: 800, fontSize: '11px', color: c.color }}>
            {index + 1}
          </Typography>
        </Box>
        {/* Connector */}
        {!isLast && (
          <Box sx={{
            width: '2px', flexGrow: 1, mt: 0.75,
            background: `linear-gradient(to bottom, ${c.color}60, ${c.color}10)`,
            minHeight: 28,
          }} />
        )}
      </Box>

      {/* Card */}
      <Box sx={{
        flex: 1,
        mb: isLast ? 0 : 2.5,
        p: '14px 16px',
        borderRadius: '12px',
        bgcolor: WHITE,
        border: `1px solid #F1F5F9`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          boxShadow: `0 4px 24px ${c.color}18`,
          borderColor: `${c.color}40`,
        },
        // Left accent bar
        '&::before': {
          content: '""',
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: '3px',
          background: `linear-gradient(to bottom, ${c.color}, ${c.color}60)`,
          borderRadius: '12px 0 0 12px',
        },
      }}>
        {/* Row top */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A', lineHeight: 1.3 }}>
                {step.stepLabel}
              </Typography>
              {!step.isRequired && (
                <Chip
                  label="Conditionnel"
                  size="small"
                  sx={{ height: 18, fontSize: '9.5px', fontWeight: 600, bgcolor: '#FEF3C7', color: '#B45309', border: 'none', px: 0.2 }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
              {rl(step.assignedRole)}
            </Typography>
          </Box>

          {/* Right badges */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.6, flexShrink: 0 }}>
            <Chip
              label={c.label}
              size="small"
              sx={{
                height: 20, fontSize: '10px', fontWeight: 700,
                bgcolor: c.bg, color: c.color,
                border: `1px solid ${c.color}30`,
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon sx={{ fontSize: 11, color: '#94A3B8' }} />
              <Typography sx={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                {sla(step.expectedDurationHours)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Condition badge */}
        {(hasMin || hasMax) && (
          <Box sx={{ mt: 1.2, pt: 1.2, borderTop: '1px dashed #E2E8F0', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {hasMin && (
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Applicable si montant ≥ <Box component="span" sx={{ fontWeight: 700, color: '#0F172A' }}>{fmtAmount(step.conditionMinAmount!)}</Box>
              </Typography>
            )}
            {hasMax && (
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Applicable si montant ≤ <Box component="span" sx={{ fontWeight: 700, color: '#0F172A' }}>{fmtAmount(step.conditionMaxAmount!)}</Box>
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Main dialog ──────────────────────────────────────────────────────────────

export const PolicyGuideDialog: React.FC<PolicyGuideDialogProps> = ({ open, policy, onClose }) => {
  const [sideVis, setSideVis] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setSideVis(true), 60);
      return () => clearTimeout(t);
    } else {
      setSideVis(false);
    }
  }, [open]);

  if (!policy) return null;

  const visibleSteps = policy.steps.filter(s => s.stepName !== 'application_created');
  const totalSLA = visibleSteps.reduce((sum, s) => sum + s.expectedDurationHours, 0);

  const validFromDate = new Date(policy.validFrom).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '96vw', sm: 860 },
          maxWidth: 860,
          maxHeight: '88vh',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
          m: 2,
        },
      }}
      sx={{ backdropFilter: 'blur(8px)', '& .MuiBackdrop-root': { bgcolor: 'rgba(10,24,44,0.65)' } }}
    >
      {/* ── LEFT SIDEBAR ── */}
      <Box sx={{
        width: { xs: 0, sm: 280 },
        display: { xs: 'none', sm: 'flex' },
        flexDirection: 'column',
        bgcolor: DARK,
        p: 3.5,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        // Subtle mesh gradient
        '&::before': {
          content: '""',
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 20% 20%, rgba(20,184,166,0.12) 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.10) 0%, transparent 60%)`,
          pointerEvents: 'none',
        },
      }}>
        {/* Decorative dots pattern */}
        <Box sx={{
          position: 'absolute', top: 0, right: 0,
          width: 200, height: 200,
          background: `radial-gradient(circle, rgba(20,184,166,0.06) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.8,
          bgcolor: 'rgba(20,184,166,0.15)',
          border: '1px solid rgba(20,184,166,0.25)',
          borderRadius: '20px',
          px: 1.5, py: 0.6,
          mb: 3, alignSelf: 'flex-start',
          opacity: sideVis ? 1 : 0,
          transform: sideVis ? 'none' : 'translateY(8px)',
          transition: 'all 0.45s ease',
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
          <Typography sx={{ color: ACCENT, fontSize: '10.5px', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Politique active
          </Typography>
        </Box>

        {/* Title */}
        <Box sx={{
          mb: 3,
          opacity: sideVis ? 1 : 0,
          transform: sideVis ? 'none' : 'translateY(10px)',
          transition: 'all 0.5s ease 0.08s',
        }}>
          <Typography sx={{
            color: WHITE,
            fontSize: '20px',
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
            mb: 1,
          }}>
            {policy.name}
          </Typography>
          {policy.description && (
            <Typography sx={{ color: MUTED, fontSize: '12px', lineHeight: 1.6 }}>
              {policy.description}
            </Typography>
          )}
        </Box>

        {/* Divider */}
        <Box sx={{ width: '100%', height: '1px', bgcolor: BORDER, mb: 3, opacity: sideVis ? 1 : 0, transition: 'opacity 0.5s ease 0.15s' }} />

        {/* Stats */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <StatPill icon={<VerifiedIcon sx={{ fontSize: 16 }} />} label="Référence" value={policy.code} delay={200} />
          <StatPill icon={<RouteIcon sx={{ fontSize: 16 }} />} label="Étapes du circuit" value={`${visibleSteps.length} étape${visibleSteps.length > 1 ? 's' : ''}`} delay={300} />
          <StatPill icon={<ScheduleIcon sx={{ fontSize: 16 }} />} label="Délai total estimé" value={sla(totalSLA)} delay={400} />
          <StatPill icon={<CalIcon sx={{ fontSize: 16 }} />} label="En vigueur depuis" value={validFromDate} delay={500} />
        </Box>

        {/* Version badge */}
        <Box sx={{
          mt: 'auto', pt: 3,
          opacity: sideVis ? 1 : 0,
          transition: 'opacity 0.5s ease 0.55s',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              px: 1.2, py: 0.5, borderRadius: '6px',
              bgcolor: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600 }}>
                VERSION {policy.version}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── RIGHT PANEL ── */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#F8FAFC',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Panel header */}
        <Box sx={{
          px: 3, pt: 3, pb: 2.5,
          bgcolor: WHITE,
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '16px', color: '#0F172A', letterSpacing: '-0.2px' }}>
              Circuit d'instruction
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#94A3B8', mt: 0.3 }}>
              {visibleSteps.length} étape{visibleSteps.length > 1 ? 's' : ''} · ordre séquentiel obligatoire
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: '#94A3B8',
              bgcolor: '#F1F5F9',
              borderRadius: '8px',
              '&:hover': { bgcolor: '#E2E8F0', color: '#475569' },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Scrollable steps */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#CBD5E1', borderRadius: 2 },
        }}>
          {visibleSteps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              index={i}
              isLast={i === visibleSteps.length - 1}
              delay={180 + i * 75}
            />
          ))}
        </Box>

        {/* Footer */}
        <Box sx={{
          px: 3, py: 2.5,
          bgcolor: WHITE,
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 2,
        }}>
          <Typography sx={{ fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.5, maxWidth: 300 }}>
            Ce guide se réaffiche automatiquement lors de tout changement de politique.
          </Typography>
          <Button
            onClick={onClose}
            variant="contained"
            endIcon={<CheckIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: DARK,
              color: WHITE,
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              px: 2.5,
              py: 1.1,
              textTransform: 'none',
              letterSpacing: 0,
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(13,27,42,0.25)',
              '&:hover': { bgcolor: DARK3, boxShadow: '0 6px 20px rgba(13,27,42,0.32)' },
            }}
          >
            J'ai compris
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};
