import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import { PolicyStepType, STEP_TYPE_CONFIG, ROLES } from '../../types/creditPolicyBuilder';

interface Props {
  onAddStep: (type: PolicyStepType) => void;
  readOnly?: boolean;
}

const STEP_TYPES: PolicyStepType[] = ['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE'];

export function StepPalette({ onAddStep, readOnly = false }: Props) {
  return (
    <Box sx={{ width: 220, flexShrink: 0, p: 1.5 }}>
      <Typography variant="caption" color="text.secondary"
        sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
        Types d'étapes
      </Typography>

      {STEP_TYPES.map((type) => {
        const cfg = STEP_TYPE_CONFIG[type];
        return (
          <Paper
            key={type}
            elevation={0}
            onClick={() => !readOnly && onAddStep(type)}
            sx={{
              border: `2px dashed ${cfg.color}`,
              bgcolor: cfg.bgColor,
              borderRadius: 2,
              p: 1,
              mb: 1,
              cursor: readOnly ? 'not-allowed' : 'pointer',
              opacity: readOnly ? 0.5 : 1,
              transition: 'all 0.15s',
              '&:hover': readOnly ? {} : { boxShadow: 2, transform: 'translateY(-1px)' },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color }}>
              + {cfg.label}
            </Typography>
          </Paper>
        );
      })}

      <Divider sx={{ my: 2 }} />

      <Typography variant="caption" color="text.secondary"
        sx={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
        Rôles disponibles
      </Typography>

      {ROLES.map((r) => (
        <Typography key={r.value} variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5, pl: 0.5 }}>
          • {r.label}
        </Typography>
      ))}
    </Box>
  );
}
