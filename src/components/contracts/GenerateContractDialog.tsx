import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Stack, Alert, Typography, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { contractApi } from '../../services/api';
import { ContractTemplate } from '../../types/contracts';

interface Props {
  template: ContractTemplate;
  applicationId: string;
  onClose: () => void;
  onGenerated: () => void;
}

export function GenerateContractDialog({ template, applicationId, onClose, onGenerated }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setVal = (name: string, v: any) => setValues((p) => ({ ...p, [name]: v }));

  const validate = (): string | null => {
    for (const f of template.customFields) {
      if (f.required) {
        const v = values[f.name];
        if (v === undefined || v === null || v === '') {
          return `Le champ "${f.label}" est obligatoire`;
        }
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null); setLoading(true);
    const r = await contractApi.generate({
      templateId: template.id,
      applicationId,
      customValues: values,
    });
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    onGenerated();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Générer le contrat
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Modèle : <strong>{template.name}</strong>
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {template.customFields.length === 0 ? (
          <Alert severity="info">
            Aucune variable personnalisée à saisir. Cliquez sur "Générer".
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">
              Saisissez les valeurs pour chaque variable personnalisée du modèle.
            </Typography>
            {template.customFields.map((f) => (
              <TextField
                key={f.name}
                label={f.label + (f.required ? ' *' : '')}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => setVal(f.name, e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleGenerate} variant="contained" disabled={loading}>
          {loading ? 'Génération…' : 'Générer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
