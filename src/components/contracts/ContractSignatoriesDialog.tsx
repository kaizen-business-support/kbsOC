import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Stack, Alert, IconButton, Box, Typography,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { contractApi } from '../../services/api';
import { ContractSignatory, GeneratedContract, SignatoryParty } from '../../types/contracts';

interface Props {
  contract: GeneratedContract;
  defaults?: { bankFullName?: string; bankEmail?: string; clientFullName?: string; clientEmail?: string };
  onClose: () => void;
  onSaved: () => void;
}

type EditableSignatory = Pick<ContractSignatory, 'order' | 'party' | 'fullName' | 'email' | 'role'>;

export function ContractSignatoriesDialog({ contract, defaults, onClose, onSaved }: Props) {
  const initial: EditableSignatory[] = contract.signatories.length > 0
    ? contract.signatories.map((s) => ({
        order: s.order, party: s.party, fullName: s.fullName,
        email: s.email, role: s.role,
      }))
    : [
        { order: 1, party: 'BANK',   fullName: defaults?.bankFullName   || '', email: defaults?.bankEmail   || null, role: 'Représentant de la banque' },
        { order: 2, party: 'CLIENT', fullName: defaults?.clientFullName || '', email: defaults?.clientEmail || null, role: 'Client' },
      ];

  const [list, setList] = useState<EditableSignatory[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (i: number, patch: Partial<EditableSignatory>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) =>
    setList((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));

  const add = () =>
    setList((prev) => [
      ...prev,
      { order: prev.length + 1, party: prev.length % 2 === 0 ? 'BANK' : 'CLIENT', fullName: '', email: null, role: '' },
    ]);

  const handleSave = async () => {
    if (list.some((s) => !s.fullName.trim())) {
      setError('Tous les signataires doivent avoir un nom complet'); return;
    }
    setError(null); setLoading(true);
    const r = await contractApi.setSignatories(contract.id, list);
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    onSaved();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Signataires du contrat
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={1.5}>
          {list.map((s, i) => (
            <Box key={i} sx={{
              display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap',
              p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1,
            }}>
              <Typography sx={{ width: 24, fontWeight: 700, color: '#64748b' }}>{i + 1}.</Typography>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Partie</InputLabel>
                <Select
                  value={s.party}
                  label="Partie"
                  onChange={(e) => update(i, { party: e.target.value as SignatoryParty })}
                >
                  <MenuItem value="BANK">Banque</MenuItem>
                  <MenuItem value="CLIENT">Client</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small" label="Nom complet *"
                value={s.fullName}
                onChange={(e) => update(i, { fullName: e.target.value })}
                sx={{ flex: 2, minWidth: 180 }}
              />
              <TextField
                size="small" label="Email"
                value={s.email || ''}
                onChange={(e) => update(i, { email: e.target.value || null })}
                sx={{ flex: 2, minWidth: 180 }}
              />
              <TextField
                size="small" label="Fonction"
                value={s.role || ''}
                onChange={(e) => update(i, { role: e.target.value || null })}
                sx={{ flex: 1, minWidth: 140 }}
              />
              <IconButton size="small" onClick={() => remove(i)} disabled={list.length === 1}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={add} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
            Ajouter un signataire
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || list.length === 0}>
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
