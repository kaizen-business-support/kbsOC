import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Select, MenuItem, InputLabel, FormControl, Box, Typography,
  Chip, Stack, Alert, IconButton, Checkbox, FormControlLabel, OutlinedInput, Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { contractTemplateApi, creditPolicyApi } from '../../services/api';
import { ContractTemplate, ContractCustomField, CustomFieldType } from '../../types/contracts';

interface Props {
  template: ContractTemplate;
  onClose: () => void;
  onSaved: () => void;
}

export function ContractTemplateEditDialog({ template, onClose, onSaved }: Props) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [creditTypeIds, setCreditTypeIds] = useState<string[]>(template.creditTypeIds);
  const [customFields, setCustomFields] = useState<ContractCustomField[]>(template.customFields);
  const [isActive, setIsActive] = useState(template.isActive);
  const [creditTypes, setCreditTypes] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    creditPolicyApi.getCreditTypes().then((r) => {
      if (r.success) setCreditTypes(r.data || []);
    });
  }, []);

  const updateCF = (i: number, patch: Partial<ContractCustomField>) => {
    setCustomFields((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const handleSave = async () => {
    setError(null); setLoading(true);
    const r = await contractTemplateApi.update(template.id, {
      name, description, creditTypeIds, customFields, isActive,
    });
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    onSaved();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Modifier le modèle
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField
            label="Nom du modèle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth size="small"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline minRows={2} fullWidth size="small"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Types de crédit</InputLabel>
            <Select
              multiple
              value={creditTypeIds}
              onChange={(e) => setCreditTypeIds(typeof e.target.value === 'string' ? [] : e.target.value)}
              input={<OutlinedInput label="Types de crédit" />}
              renderValue={(selected) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {selected.map((id) => {
                    const ct = creditTypes.find((c) => c.id === id);
                    return <Chip key={id} size="small" label={ct?.name || id} />;
                  })}
                </Stack>
              )}
            >
              {creditTypes.map((ct) => (
                <MenuItem key={ct.id} value={ct.id}>{ct.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {customFields.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#7e22ce', mb: 1 }}>
                Variables personnalisées
              </Typography>
              <Stack spacing={1.5}>
                {customFields.map((cf, i) => (
                  <Box key={cf.name} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip label={`{{${cf.name}}}`} size="small" sx={{ fontFamily: 'monospace' }} />
                    <TextField
                      size="small"
                      label="Libellé"
                      value={cf.label}
                      onChange={(e) => updateCF(i, { label: e.target.value })}
                      sx={{ flex: 1, minWidth: 180 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={cf.type}
                        label="Type"
                        onChange={(e) => updateCF(i, { type: e.target.value as CustomFieldType })}
                      >
                        <MenuItem value="text">Texte</MenuItem>
                        <MenuItem value="number">Nombre</MenuItem>
                        <MenuItem value="date">Date</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={cf.required}
                          onChange={(e) => updateCF(i, { required: e.target.checked })}
                        />
                      }
                      label="Requis"
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Modèle actif"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
