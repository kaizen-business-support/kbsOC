import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  AccountBalance as BankIcon,
  Person as PersonIcon,
  Gavel as GavelIcon,
  Group as CommitteeIcon,
  LocalShipping as DispatchIcon,
  Analytics as AnalysisIcon,
  Assignment as AssignmentIcon,
  KeyboardArrowRight as ArrowIcon,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES: 'Chargé d\'Affaires',
  ANALYSTE_RISQUES: 'Analyste Risques',
  RESPONSABLE_RISQUES: 'Responsable Risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable Engagements',
  DIRECTION_GENERALE: 'Direction Générale',
  DIRECTION_JURIDIQUE: 'Direction Juridique',
  COMITE_CREDIT: 'Comité de Crédit',
  BACK_OFFICE: 'Back Office',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super Administrateur',
};

const STEP_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  CREATION:  { color: '#0F766E', bg: '#F0FDFA', icon: <AssignmentIcon sx={{ fontSize: 18 }} /> },
  DISPATCH:  { color: '#0369A1', bg: '#EFF6FF', icon: <DispatchIcon  sx={{ fontSize: 18 }} /> },
  ANALYSIS:  { color: '#7C3AED', bg: '#F5F3FF', icon: <AnalysisIcon  sx={{ fontSize: 18 }} /> },
  APPROVAL:  { color: '#B45309', bg: '#FFFBEB', icon: <GavelIcon     sx={{ fontSize: 18 }} /> },
  COMMITTEE: { color: '#BE185D', bg: '#FDF2F8', icon: <CommitteeIcon sx={{ fontSize: 18 }} /> },
  LEGAL:     { color: '#0F766E', bg: '#F0FDFA', icon: <BankIcon      sx={{ fontSize: 18 }} /> },
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role;
}

function stepConfig(type: string) {
  return STEP_TYPE_CONFIG[type] || { color: '#64748B', bg: '#F8FAFC', icon: <PersonIcon sx={{ fontSize: 18 }} /> };
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.round(hours / 24);
  return `${d}j`;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 0 }).format(n);
}

// ─── Step card ────────────────────────────────────────────────────────────────

const StepCard: React.FC<{ step: PolicyStep; index: number; total: number; delay: number }> = ({
  step, index, total, delay,
}) => {
  const [visible, setVisible] = useState(false);
  const cfg = stepConfig(step.stepType);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const hasCondition = step.conditionMinAmount !== null || step.conditionMaxAmount !== null;

  return (
    <Box sx={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(16px)',
      transition: 'opacity 0.45s ease, transform 0.45s ease',
      display: 'flex',
      alignItems: 'stretch',
      gap: 0,
    }}>
      {/* Numéro + ligne verticale */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2, minWidth: 36 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '50%',
          bgcolor: cfg.color, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, flexShrink: 0,
          boxShadow: `0 2px 8px ${cfg.color}50`,
        }}>
          {index + 1}
        </Box>
        {index < total - 1 && (
          <Box sx={{ width: 2, flexGrow: 1, mt: 0.5, mb: 0.5, bgcolor: '#E2E8F0', borderRadius: 1, minHeight: 20 }} />
        )}
      </Box>

      {/* Contenu */}
      <Box sx={{
        flex: 1,
        mb: index < total - 1 ? 2.5 : 0,
        bgcolor: cfg.bg,
        borderRadius: 2.5,
        border: `1px solid ${cfg.color}25`,
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          bgcolor: cfg.color,
          borderRadius: '4px 0 0 4px',
        },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.5,
              bgcolor: `${cfg.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cfg.color, flexShrink: 0,
            }}>
              {cfg.icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', lineHeight: 1.3 }}>
                {step.stepLabel}
              </Typography>
              <Typography sx={{ fontSize: '11.5px', color: '#64748B', mt: 0.2 }}>
                {roleLabel(step.assignedRole)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            <Chip
              label={formatDuration(step.expectedDurationHours)}
              size="small"
              sx={{ bgcolor: `${cfg.color}15`, color: cfg.color, fontWeight: 600, fontSize: '11px', height: 20 }}
            />
            {!step.isRequired && (
              <Chip label="Conditionnel" size="small" sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontSize: '10px', height: 18 }} />
            )}
          </Box>
        </Box>

        {hasCondition && (
          <Box sx={{ mt: 1, pt: 1, borderTop: `1px dashed ${cfg.color}25`, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {step.conditionMinAmount !== null && (
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Dossiers ≥ <strong>{formatAmount(step.conditionMinAmount)} FCFA</strong>
              </Typography>
            )}
            {step.conditionMaxAmount !== null && (
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Dossiers ≤ <strong>{formatAmount(step.conditionMaxAmount)} FCFA</strong>
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
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setHeaderVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setHeaderVisible(false);
    }
  }, [open]);

  if (!policy) return null;

  const validFromDate = new Date(policy.validFrom).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Filtrer l'étape application_created du schéma (c'est une étape système)
  const visibleSteps = policy.steps.filter(s => s.stepName !== 'application_created');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          maxHeight: '90vh',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        },
      }}
      TransitionProps={{ timeout: { enter: 350, exit: 200 } }}
    >
      {/* ── Header dégradé ── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #0F766E 0%, #0369A1 100%)',
        px: 3, pt: 3.5, pb: 3,
        position: 'relative',
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute', top: 12, right: 12,
            color: 'rgba(255,255,255,0.8)',
            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.15)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BankIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Politique de crédit active
            </Typography>
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '18px', lineHeight: 1.2 }}>
              {policy.name}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={policy.code}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '11px' }}
          />
          <Chip
            label={`v${policy.version}`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}
          />
          <Chip
            label={`En vigueur depuis le ${validFromDate}`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}
          />
        </Box>

        {policy.description && (
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '12.5px', mt: 1.5, lineHeight: 1.5 }}>
            {policy.description}
          </Typography>
        )}
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 2, overflowY: 'auto' }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5 }}>
            Circuit d'instruction — {visibleSteps.length} étape{visibleSteps.length > 1 ? 's' : ''}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
            Les dossiers de crédit suivent ce circuit dans l'ordre indiqué.
          </Typography>
        </Box>

        <Divider sx={{ mb: 2.5 }} />

        {/* Steps */}
        <Box>
          {visibleSteps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              total={visibleSteps.length}
              delay={120 + i * 90}
            />
          ))}
        </Box>

        {/* Légende */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 2.5, border: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, mb: 1 }}>
            Légende
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Obligatoire', color: '#0F766E', bg: '#F0FDFA' },
              { label: 'Conditionnel', color: '#B45309', bg: '#FEF3C7' },
            ].map(({ label, color, bg }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                <Typography sx={{ fontSize: '11px', color: '#64748B' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>

      {/* ── Footer ── */}
      <Box sx={{
        px: 3, py: 2.5,
        borderTop: '1px solid #F1F5F9',
        display: 'flex',
        justifyContent: 'flex-end',
        bgcolor: 'white',
      }}>
        <Button
          onClick={onClose}
          variant="contained"
          startIcon={<CheckIcon />}
          sx={{
            bgcolor: '#0F766E',
            '&:hover': { bgcolor: '#0D6B63' },
            borderRadius: 2.5,
            fontWeight: 700,
            px: 3,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(15,118,110,0.3)',
          }}
        >
          J'ai compris
        </Button>
      </Box>
    </Dialog>
  );
};
