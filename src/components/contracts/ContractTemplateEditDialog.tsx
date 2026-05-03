import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Select, MenuItem, InputLabel, FormControl, Box, Typography,
  Chip, Stack, Alert, IconButton, Checkbox, FormControlLabel, OutlinedInput, Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { contractTemplateApi, creditPolicyApi } from '../../services/api';
import { ContractTemplate, ContractCustomField, CustomFieldType } from '../../types/contracts';
import { serializeEditorContent, deserializeHtmlToQuill } from './VariableBlot';
import { QUILL_MODULES } from './quillConfig';
import { VariableCatalogPanel } from './VariableCatalogPanel';

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
  const [htmlContent, setHtmlContent] = useState<string>(template.htmlContent ?? '');
  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    creditPolicyApi.getCreditTypes().then((r) => {
      if (r.success) setCreditTypes(r.data || []);
    });
  }, []);

  useEffect(() => {
    if (template.fileFormat !== 'RICH_TEXT') return;
    const q = quillRef.current?.getEditor();
    if (!q || !template.htmlContent) return;
    deserializeHtmlToQuill(template.htmlContent, q);
  }, []);

  const updateCF = (i: number, patch: Partial<ContractCustomField>) => {
    setCustomFields((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const handleSave = async () => {
    setError(null); setLoading(true);
    const payload: any = { name, description, creditTypeIds, isActive };
    if (template.fileFormat === 'RICH_TEXT' && quillRef.current) {
      payload.htmlContent = serializeEditorContent(quillRef.current.getEditor());
    } else {
      payload.customFields = customFields;
    }
    const r = await contractTemplateApi.update(template.id, payload);
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

          {template.fileFormat === 'RICH_TEXT' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 7 }}>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Contenu du contrat</Typography>
                <ReactQuill
                  ref={quillRef}
                  value={htmlContent}
                  onChange={setHtmlContent}
                  modules={QUILL_MODULES}
                  style={{ height: 350, marginBottom: 42 }}
                />
              </Box>
              <Box sx={{ flex: 5 }}>
                <VariableCatalogPanel
                  onInsert={(variable, label, group) => {
                    const q = quillRef.current?.getEditor();
                    if (!q) return;
                    const range = q.getSelection(true);
                    q.insertEmbed(range.index, 'variable', { variable, label, group });
                    q.setSelection(range.index + 1);
                  }}
                />
              </Box>
            </Box>
          )}

          {template.fileFormat !== 'RICH_TEXT' && customFields.length > 0 && (
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
