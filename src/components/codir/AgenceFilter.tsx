import React from 'react';
import {
  Box, ToggleButtonGroup, ToggleButton, FormControl,
  InputLabel, Select, MenuItem, Typography,
} from '@mui/material';

interface Props {
  agences: { client: string[]; ca: string[] };
  type: 'client' | 'ca';
  value: string;
  onChange: (type: 'client' | 'ca', value: string) => void;
}

export const AgenceFilter: React.FC<Props> = ({ agences, type, value, onChange }) => {
  const options = type === 'client' ? agences.client : agences.ca;

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: 'client' | 'ca' | null) => {
    if (!newType) return;
    onChange(newType, 'all');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ToggleButtonGroup
        size="small"
        value={type}
        exclusive
        onChange={handleTypeChange}
        sx={{ height: 32 }}
      >
        <ToggleButton value="client" sx={{ px: 1.5, fontSize: '0.75rem' }}>
          Agence client
        </ToggleButton>
        <ToggleButton value="ca" sx={{ px: 1.5, fontSize: '0.75rem' }}>
          Agence CA
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel sx={{ fontSize: '0.8rem' }}>Agence</InputLabel>
        <Select
          value={value}
          label="Agence"
          onChange={e => onChange(type, e.target.value)}
          sx={{ fontSize: '0.8rem', height: 32 }}
        >
          <MenuItem value="all">
            <Typography variant="body2">Toutes les agences</Typography>
          </MenuItem>
          {options.map(agence => (
            <MenuItem key={agence} value={agence}>
              <Typography variant="body2">{agence}</Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
