import React from 'react';
import {
  Box, Typography, Select, MenuItem, TextField, IconButton,
  Button, ToggleButtonGroup, ToggleButton, Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  GuardsJson, GuardCondition, ConditionField, ConditionOperator, GuardOperator, CreditType,
} from '../../types/creditPolicyBuilder';

interface Props {
  value: GuardsJson | null;
  onChange: (guards: GuardsJson | null) => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

const FIELD_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'amount',       label: 'Montant du dossier (XOF)' },
  { value: 'riskScore',    label: 'Score de risque (0–100)' },
  { value: 'creditTypeId', label: 'Type de crédit' },
];

const NUMERIC_OPS: { value: ConditionOperator; label: string }[] = [
  { value: 'BETWEEN', label: 'Entre' },
  { value: 'GTE',     label: '≥' },
  { value: 'LTE',     label: '≤' },
  { value: 'GT',      label: '>' },
  { value: 'LT',      label: '<' },
];

const LIST_OPS: { value: ConditionOperator; label: string }[] = [
  { value: 'IN',     label: 'Dans la liste' },
  { value: 'NOT_IN', label: 'Pas dans la liste' },
];

function emptyCondition(): GuardCondition {
  return { field: 'amount', operator: 'GTE', value: 0 };
}

function emptyGuards(): GuardsJson {
  return { operator: 'AND', conditions: [] };
}

export function GuardRulesEditor({ value, onChange, creditTypes, readOnly = false }: Props) {
  const guards = value ?? emptyGuards();

  const setOperator = (op: GuardOperator) => onChange({ ...guards, operator: op });

  const addCondition = () => onChange({ ...guards, conditions: [...guards.conditions, emptyCondition()] });

  const removeCondition = (i: number) => {
    const updated = guards.conditions.filter((_, idx) => idx !== i);
    onChange(updated.length === 0 ? null : { ...guards, conditions: updated });
  };

  const updateCondition = (i: number, patch: Partial<GuardCondition>) => {
    const conditions = guards.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    onChange({ ...guards, conditions });
  };

  const renderValueInput = (cond: GuardCondition, i: number) => {
    if (cond.field === 'creditTypeId') {
      const selected = Array.isArray(cond.value) ? cond.value as string[] : [];
      return (
        <Select
          multiple size="small" value={selected} disabled={readOnly}
          onChange={(e) => updateCondition(i, { value: e.target.value as string[] })}
          renderValue={(vals) => (vals as string[]).map((v) => creditTypes.find((ct) => ct.id === v)?.name ?? v).join(', ')}
          sx={{ minWidth: 180 }}
        >
          {creditTypes.map((ct) => (
            <MenuItem key={ct.id} value={ct.id}>{ct.name}</MenuItem>
          ))}
        </Select>
      );
    }

    if (cond.operator === 'BETWEEN') {
      const val = (cond.value as { min: number; max: number }) ?? { min: 0, max: 0 };
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField size="small" type="number" label="Min" value={val.min} disabled={readOnly}
            onChange={(e) => updateCondition(i, { value: { ...val, min: Number(e.target.value) } })}
            sx={{ width: 110 }} />
          <Typography variant="body2">et</Typography>
          <TextField size="small" type="number" label="Max" value={val.max} disabled={readOnly}
            onChange={(e) => updateCondition(i, { value: { ...val, max: Number(e.target.value) } })}
            sx={{ width: 110 }} />
        </Box>
      );
    }

    return (
      <TextField size="small" type="number" label="Valeur" value={cond.value as number} disabled={readOnly}
        onChange={(e) => updateCondition(i, { value: Number(e.target.value) })}
        sx={{ width: 110 }} />
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
          Conditions d'activation
        </Typography>
        {guards.conditions.length > 1 && (
          <ToggleButtonGroup size="small" value={guards.operator} exclusive
            onChange={(_, v) => v && setOperator(v)}>
            <ToggleButton value="AND" disabled={readOnly}>ET</ToggleButton>
            <ToggleButton value="OR"  disabled={readOnly}>OU</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {guards.conditions.map((cond, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {i > 0 && (
            <Chip label={guards.operator} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          )}
          <Select size="small" value={cond.field} disabled={readOnly}
            onChange={(e) => updateCondition(i, { field: e.target.value as ConditionField, operator: 'GTE', value: 0 })}>
            {FIELD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>

          <Select size="small" value={cond.operator} disabled={readOnly}
            onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator, value: 0 })}>
            {(cond.field === 'creditTypeId' ? LIST_OPS : NUMERIC_OPS).map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>

          {renderValueInput(cond, i)}

          {!readOnly && (
            <IconButton size="small" color="error" onClick={() => removeCondition(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}

      {!readOnly && (
        <Button size="small" startIcon={<AddIcon />} onClick={addCondition} sx={{ mt: 0.5 }}>
          Ajouter une condition
        </Button>
      )}
    </Box>
  );
}
