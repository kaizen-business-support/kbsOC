import React from 'react';
import { Box, Typography, Divider, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AssessmentIcon from '@mui/icons-material/Assessment';
import VerifiedIcon from '@mui/icons-material/Verified';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { PolicyStepType, STEP_TYPE_CONFIG, ROLES } from '../../types/creditPolicyBuilder';

const TYPE_ICONS: Record<PolicyStepType, React.ReactNode> = {
  DISPATCH:  <SendIcon sx={{ fontSize: 15 }} />,
  ANALYSIS:  <AssessmentIcon sx={{ fontSize: 15 }} />,
  APPROVAL:  <VerifiedIcon sx={{ fontSize: 15 }} />,
  COMMITTEE: <GroupsIcon sx={{ fontSize: 15 }} />,
};

const STEP_TYPES: PolicyStepType[] = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];

interface Props {
  onAddStep: (type: PolicyStepType) => void;
  readOnly?: boolean;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8',
      fontSize: 10, letterSpacing: 0.8, display: 'block', mb: 1,
    }}>
      {children}
    </Typography>
  );
}

export function StepPalette({ onAddStep, readOnly = false }: Props) {
  return (
    <Box sx={{ width: 190, flexShrink: 0, p: 1.5, height: '100%', overflowY: 'auto' }}>

      {!readOnly && (
        <Box sx={{
          mb: 1.5, p: 1, bgcolor: '#eff6ff', borderRadius: 1.5,
          border: '1px dashed #93c5fd',
        }}>
          <Typography sx={{ fontSize: 10, color: '#1d4ed8', lineHeight: 1.5 }}>
            👆 <strong>Cliquez</strong> sur un type d'étape pour l'ajouter au workflow
          </Typography>
        </Box>
      )}

      {readOnly && (
        <Box sx={{
          mb: 1.5, p: 1, bgcolor: '#fef9c3', borderRadius: 1.5,
          border: '1px dashed #fbbf24',
        }}>
          <Typography sx={{ fontSize: 10, color: '#92400e', lineHeight: 1.5 }}>
            🔒 Mode <strong>lecture seule</strong>. Sélectionnez un brouillon pour modifier.
          </Typography>
        </Box>
      )}

      <Label>Types d'étapes</Label>

      {STEP_TYPES.map((type) => {
        const cfg = STEP_TYPE_CONFIG[type];
        return (
          <Tooltip
            key={type}
            title={readOnly ? 'Sélectionnez un brouillon pour modifier' : `Cliquer pour ajouter une étape "${cfg.label}"`}
            placement="right"
          >
            <Box
              onClick={() => !readOnly && onAddStep(type)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.2,
                bgcolor: '#fff',
                border: `1.5px solid ${cfg.color}30`,
                borderLeft: `4px solid ${cfg.color}`,
                borderRadius: '6px',
                p: '8px 10px',
                mb: 0.7,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                opacity: readOnly ? 0.5 : 1,
                transition: 'all 0.15s',
                '&:hover': readOnly ? {} : {
                  bgcolor: cfg.bgColor,
                  borderColor: cfg.color,
                  transform: 'translateX(3px)',
                  boxShadow: `0 2px 8px ${cfg.color}25`,
                },
              }}
            >
              <Box sx={{ color: cfg.color, display: 'flex', flexShrink: 0 }}>
                {TYPE_ICONS[type]}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, color: cfg.color, fontSize: 12, lineHeight: 1 }}>
                  {cfg.label}
                </Typography>
                {!readOnly && (
                  <Typography sx={{ fontSize: 9, color: '#94a3b8', mt: 0.2 }}>
                    + cliquer pour ajouter
                  </Typography>
                )}
              </Box>
            </Box>
          </Tooltip>
        );
      })}

      <Divider sx={{ my: 2 }} />
      <Label>Connexions</Label>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 0.5 }}>
        {[
          { label: 'Flux par défaut', dashed: false },
          { label: 'Flux conditionnel', dashed: true },
        ].map(({ label, dashed }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative', width: 34, height: 2, flexShrink: 0 }}>
              <Box sx={{
                position: 'absolute', inset: 0,
                ...(dashed
                  ? { backgroundImage: 'repeating-linear-gradient(90deg,#78909c 0,#78909c 4px,transparent 4px,transparent 8px)' }
                  : { bgcolor: '#78909c' }),
              }} />
              <Box sx={{
                position: 'absolute', right: -4, top: '50%',
                transform: 'translateY(-50%)',
                width: 0, height: 0,
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderLeft: '6px solid #78909c',
              }} />
            </Box>
            <Typography sx={{ color: '#546e7a', fontSize: 11 }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />
      <Label>Rôles</Label>

      {ROLES.map((r) => (
        <Box key={r.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.7 }}>
          <PersonOutlineIcon sx={{ fontSize: 13, color: '#90a4ae' }} />
          <Typography sx={{ color: '#546e7a', fontSize: 11 }}>{r.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
