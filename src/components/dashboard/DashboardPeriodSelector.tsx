import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Period } from '../../types';

interface DashboardPeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'this_month',    label: 'Ce mois' },
  { value: 'this_quarter',  label: 'Ce trimestre' },
  { value: 'this_year',     label: 'Cette année' },
  { value: 'last_6_months', label: '6 derniers mois' },
  { value: 'last_12_months',label: '12 derniers mois' },
];

export const DashboardPeriodSelector: React.FC<DashboardPeriodSelectorProps> = ({ value, onChange }) => (
  <FormControl size="small" sx={{ minWidth: 180 }}>
    <InputLabel>Période</InputLabel>
    <Select
      value={value}
      label="Période"
      onChange={e => onChange(e.target.value as Period)}
      sx={{ borderRadius: 2 }}
    >
      {OPTIONS.map(o => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
);
