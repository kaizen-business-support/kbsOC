import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Select, MenuItem, InputLabel, FormControl, Box, Typography,
  Chip, Stack, Alert, IconButton, Checkbox, FormControlLabel,
  Stepper, Step, StepLabel, OutlinedInput,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { contractTemplateApi, creditPolicyApi } from '../../services/api';
import { ContractTemplate, ContractCustomField, CustomFieldType } from '../../types/contracts';
import { VariableCatalogPanel } from './VariableCatalogPanel';

const DOCUMENT_TYPES = [
  { value: 'CONTRACT_LOAN', label: 'Contrat de prêt' },
  { value: 'AMENDMENT', label: 'Avenant' },
  { value: 'GUARANTEE', label: 'Convention de garantie' },
  { value: 'OTHER', label: 'Autre' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ContractTemplateUploadDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('CONTRACT_LOAN');
  const [description, setDescription] = useState('');
  const [creditTypeIds, setCreditTypeIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [creditTypes, setCreditTypes] = useState<{ id: string; name: string }[]>([]);
  const [created, setCreated] = useState<ContractTemplate | null>(null);
  const [customFields, setCustomFields] = useState<ContractCustomField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      creditPolicyApi.getCreditTypes().then((r) => {
        if (r.success) setCreditTypes(r.data || []);
      });
    } else {
      setStep(0); setName(''); setDocumentType('CONTRACT_LOAN'); setDescription('');
      setCreditTypeIds([]); setFile(null); setCreated(null); setCustomFields([]);
      setError(null);
    }
  }, [open]);

  const handleUpload = async () => {
    if (!file || !name) {
      setError('Nom et fichier obligatoires'); return;
    }
    setError(null); setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('documentType', documentType);
    if (description) fd.append('description', description);
    fd.append('creditTypeIds', JSON.stringify(creditTypeIds));

    const r = await contractTemplateApi.create(fd);
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    setCreated(r.data);
    setCustomFields(r.data.customFields || []);
    setStep(1);
  };

  const updateCustomField = (i: number, patch: Partial<ContractCustomField>) => {
    setCustomFields((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const handleFinish = async () => {
    if (!created) return;
    setLoading(true);
    const r = await contractTemplateApi.update(created.id, { customFields });
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    onCreated();
  };

  const detectedCatalog = (created?.detectedVariables || []).filter(
    (v) => !customFields.some((c) => c.name === v),
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Nouveau modèle de contrat
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step><StepLabel>Fichier & métadonnées</StepLabel></Step>
          <Step><StepLabel>Variables détectées</StepLabel></Step>
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 && (
          <Stack spacing={2}>
            <Box sx={{ border: '2px dashed #cbd5e1', borderRadius: 2, p: 3, textAlign: 'center' }}>
              <UploadFileIcon sx={{ fontSize: 32, color: '#64748b', mb: 1 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                {file ? file.name : 'Glisser un fichier .docx ou .pdf (max 5MB)'}
              </Typography>
              <Button variant="outlined" component="label" size="small">
                Choisir un fichier
                <input
                  type="file"
                  accept=".docx,.pdf"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Box>
            <TextField
              label="Nom du modèle *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Type de document</InputLabel>
              <Select
                value={documentType}
                label="Type de document"
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Types de crédit (vide = tous)</InputLabel>
              <Select
                multiple
                value={creditTypeIds}
                onChange={(e) => setCreditTypeIds(typeof e.target.value === 'string' ? [] : e.target.value)}
                input={<OutlinedInput label="Types de crédit (vide = tous)" />}
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
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline minRows={2} fullWidth size="small"
            />
            <Box>
              <VariableCatalogPanel />
            </Box>
          </Stack>
        )}

        {step === 1 && created && (
          <Stack spacing={2}>
            <Alert severity="success">Modèle créé. Configurez les variables détectées.</Alert>

            {detectedCatalog.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#15803d', mb: 1 }}>
                  Variables connues (catalogue) — {detectedCatalog.length}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {detectedCatalog.map((v) => (
                    <Chip key={v} size="small" label={v} color="success" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            {customFields.length > 0 ? (
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#7e22ce', mb: 1 }}>
                  Variables personnalisées — {customFields.length}
                </Typography>
                <Stack spacing={1.5}>
                  {customFields.map((cf, i) => (
                    <Box key={cf.name} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip label={`{{${cf.name}}}`} size="small" sx={{ fontFamily: 'monospace' }} />
                      <TextField
                        size="small"
                        label="Libellé affiché"
                        value={cf.label}
                        onChange={(e) => updateCustomField(i, { label: e.target.value })}
                        sx={{ flex: 1, minWidth: 180 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 110 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={cf.type}
                          label="Type"
                          onChange={(e) => updateCustomField(i, { type: e.target.value as CustomFieldType })}
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
                            onChange={(e) => updateCustomField(i, { required: e.target.checked })}
                          />
                        }
                        label="Requis"
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Alert severity="info">Aucune variable personnalisée détectée.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        {step === 0 && (
          <Button onClick={handleUpload} variant="contained" disabled={!file || !name || loading}>
            Suivant
          </Button>
        )}
        {step === 1 && (
          <Button onClick={handleFinish} variant="contained" disabled={loading}>
            Terminer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
