import React from 'react';
import {
  Box, TextField, Select, MenuItem, InputLabel, FormControl,
  Typography, Divider, Chip, Collapse, IconButton, Tooltip,
} from '@mui/material';
import { ExpandMore, ExpandLess, Delete as DeleteIcon } from '@mui/icons-material';
import { PolicyStep, ROLES, STEP_TYPE_CONFIG, CreditType } from '../../types/creditPolicyBuilder';
import { GuardRulesEditor } from './GuardRulesEditor';

interface Props {
  step: PolicyStep;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<PolicyStep>) => void;
  onDelete: () => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

export function StepConfigPanel({ step, expanded, onToggle, onChange, onDelete, creditTypes, readOnly = false }: Props) {
  const cfg = STEP_TYPE_CONFIG[step.stepType];
  const hasError = !!step._error;

  return (
    <Box
      sx={{
        border: `2px solid ${hasError ? '#f44336' : cfg.color}`,
        borderRadius: 2,
        mb: 1,
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
          bgcolor: cfg.bgColor, borderRadius: expanded ? '6px 6px 0 0' : 2, cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color, minWidth: 20 }}>
          {step.order}.
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {step.stepLabel || '(sans nom)'}
        </Typography>
        <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.color, color: '#fff', fontWeight: 700, fontSize: 11 }} />
        {!readOnly && (
          <Tooltip title="Supprimer l'étape">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </Box>

      {hasError && (
        <Typography variant="caption" color="error" sx={{ px: 2, py: 0.5, display: 'block', bgcolor: '#ffebee' }}>
          {step._error}
        </Typography>
      )}

      {/* Body */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nom de l'étape" size="small" fullWidth disabled={readOnly}
            value={step.stepLabel}
            onChange={(e) => onChange({
              stepLabel: e.target.value,
              stepName: e.target.value.toLowerCase().replace(/\s+/g, '_'),
            })}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Rôle assigné</InputLabel>
            <Select value={step.assignedRole} label="Rôle assigné" disabled={readOnly}
              onChange={(e) => onChange({ assignedRole: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="SLA attendu (h)" size="small" type="number" disabled={readOnly}
              value={step.expectedDurationHours}
              onChange={(e) => onChange({ expectedDurationHours: Number(e.target.value) })}
              sx={{ flex: 1 }} />
            <TextField label="SLA max (h)" size="small" type="number" disabled={readOnly}
              value={step.maxDurationHours}
              onChange={(e) => onChange({ maxDurationHours: Number(e.target.value) })}
              sx={{ flex: 1 }} />
          </Box>

          <Divider />

          <GuardRulesEditor
            value={step.guards}
            onChange={(guards) => onChange({ guards })}
            creditTypes={creditTypes}
            readOnly={readOnly}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
