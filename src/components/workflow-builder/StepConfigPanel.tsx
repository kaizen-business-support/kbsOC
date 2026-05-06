import React from 'react';
import {
  Box, TextField, Select, MenuItem, InputLabel, FormControl,
  Typography, Divider, Chip, Collapse, IconButton, Tooltip,
  Checkbox, FormControlLabel,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { ExpandMore, ExpandLess, Delete as DeleteIcon } from '@mui/icons-material';
import { PolicyStep, ROLES as DEFAULT_ROLES, STEP_TYPE_CONFIG, CreditType } from '../../types/creditPolicyBuilder';
import { GuardRulesEditor } from './GuardRulesEditor';

interface Props {
  step: PolicyStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<PolicyStep>) => void;
  onDelete: () => void;
  creditTypes: CreditType[];
  roles?: { value: string; label: string }[];
  readOnly?: boolean;
}

const ACTIONS = [
  { key: 'approve',      label: 'Approuver' },
  { key: 'reject',       label: 'Refuser' },
  { key: 'request_info', label: 'Demander des informations' },
  { key: 'transfer',     label: 'Transférer' },
];

export function StepConfigPanel({
  step, index, expanded, onToggle, onChange, onDelete, creditTypes, roles, readOnly = false,
}: Props) {
  const availableRoles = (roles && roles.length > 0) ? roles : DEFAULT_ROLES;
  const cfg = STEP_TYPE_CONFIG[step.stepType];
  const hasError = !!step._error;
  const actions = step.allowedActions ?? [];

  const toggleAction = (key: string) => {
    const next = actions.includes(key) ? actions.filter((a) => a !== key) : [...actions, key];
    onChange({ allowedActions: next });
  };

  return (
    <Box sx={{
      border: `1.5px solid ${hasError ? '#ef5350' : '#e0e0e0'}`,
      borderLeft: `4px solid ${hasError ? '#ef5350' : cfg.color}`,
      borderRadius: '8px',
      mb: 1,
      bgcolor: '#fff',
      overflow: 'hidden',
      boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1.2,
          bgcolor: expanded ? cfg.bgColor : '#fff',
          cursor: 'pointer',
          '&:hover': { bgcolor: cfg.bgColor },
          transition: 'background 0.15s',
        }}
        onClick={onToggle}
      >
        {!readOnly && (
          <DragIndicatorIcon sx={{ fontSize: 16, color: '#bdbdbd', flexShrink: 0, cursor: 'grab' }} />
        )}
        <Box sx={{
          width: 22, height: 22, borderRadius: '50%', bgcolor: cfg.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{index + 1}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 600, flex: 1, fontSize: 13, color: '#222' }}>
          {step.stepLabel || '(sans nom)'}
        </Typography>
        <Chip
          label={cfg.label}
          size="small"
          sx={{ bgcolor: `${cfg.color}18`, color: cfg.color, fontWeight: 700, fontSize: 10, height: 20 }}
        />
        {!readOnly && step.stepType !== 'CREATION' && (
          <Tooltip title="Supprimer">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              sx={{ color: '#bdbdbd', '&:hover': { color: '#ef5350' } }}
            >
              <DeleteIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        {expanded ? <ExpandLess sx={{ fontSize: 16, color: '#9e9e9e' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#9e9e9e' }} />}
      </Box>

      {hasError && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: '#ffebee' }}>
          <Typography sx={{ fontSize: 11, color: '#c62828' }}>{step._error}</Typography>
        </Box>
      )}

      <Collapse in={expanded}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Nom */}
          <TextField
            label="Nom de l'étape" size="small" fullWidth disabled={readOnly}
            value={step.stepLabel}
            onChange={(e) => onChange({
              stepLabel: e.target.value,
              stepName: e.target.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            })}
          />

          {/* Type */}
          <FormControl size="small" fullWidth>
            <InputLabel>Type d'étape</InputLabel>
            <Select value={step.stepType} label="Type d'étape" disabled={readOnly || step.stepType === 'CREATION'}
              onChange={(e) => onChange({ stepType: e.target.value as any })}>
              {(['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE', 'LEGAL'] as const).map((t) => (
                <MenuItem key={t} value={t}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STEP_TYPE_CONFIG[t].color }} />
                    {STEP_TYPE_CONFIG[t].label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Rôle */}
          <FormControl size="small" fullWidth>
            <InputLabel>Assignée à</InputLabel>
            <Select value={step.assignedRole} label="Assignée à" disabled={readOnly}
              onChange={(e) => onChange({ assignedRole: e.target.value })}>
              {availableRoles.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>

          {/* SLA */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
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

          {/* Actions autorisées */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#555', mb: 1 }}>
              Actions autorisées
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.2 }}>
              {ACTIONS.map(({ key, label }) => (
                <FormControlLabel
                  key={key}
                  disabled={readOnly}
                  control={
                    <Checkbox
                      checked={actions.length === 0 ? true : actions.includes(key)}
                      onChange={() => toggleAction(key)}
                      size="small"
                      sx={{ py: 0.4 }}
                    />
                  }
                  label={<Typography sx={{ fontSize: 12 }}>{label}</Typography>}
                />
              ))}
            </Box>
          </Box>

          <Divider />

          {/* Gardes */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#555', mb: 1 }}>
              Gardes (Règles)
            </Typography>
            <GuardRulesEditor
              value={step.guards}
              onChange={(guards) => onChange({ guards })}
              creditTypes={creditTypes}
              readOnly={readOnly}
            />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
