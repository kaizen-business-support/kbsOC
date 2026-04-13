import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormGroup, FormControlLabel, Checkbox,
  MenuItem, Select, InputLabel, FormControl, Alert, CircularProgress,
  Box, Typography,
} from '@mui/material';
import {
  DELEGATION_ACTION_LABELS,
  DelegatableAction,
  CreateDelegationPayload,
} from '../types/delegation';
import { ApiService } from '../services/api';

interface DelegationFormProps {
  open:        boolean;
  onClose:     () => void;
  onSuccess:   () => void;
  delegatorId: string;
  users:       { id: string; name: string; role: string; branch?: string | null }[];
  isAdmin?:    boolean;
}

const DelegationForm: React.FC<DelegationFormProps> = ({
  open, onClose, onSuccess, delegatorId: delegatorIdProp, users, isAdmin = false,
}) => {
  // Quand l'admin crée pour n'importe quel utilisateur, delegatorIdProp peut être vide
  const [effectiveDelegatorId, setEffectiveDelegatorId] = useState(delegatorIdProp);
  const [delegateId,  setDelegateId]  = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [reason,      setReason]      = useState('');
  const [permissions, setPermissions] = useState<DelegatableAction[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  // Le délégant peut être sélectionné par l'admin si non fourni via prop
  const showDelegatorSelector = isAdmin && !delegatorIdProp;

  const togglePermission = (action: DelegatableAction) => {
    setPermissions(prev =>
      prev.includes(action) ? prev.filter(p => p !== action) : [...prev, action]
    );
  };

  const handleSubmit = async () => {
    if (!effectiveDelegatorId || !delegateId || !startDate || !endDate || permissions.length === 0) {
      setError('Veuillez remplir tous les champs obligatoires et sélectionner au moins une action.');
      return;
    }
    if (endDate <= startDate) {
      setError('La date de fin doit être après la date de début.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: CreateDelegationPayload = {
        delegatorId: effectiveDelegatorId,
        delegateId,
        startDate: new Date(startDate).toISOString(),
        endDate:   new Date(endDate + 'T23:59:59').toISOString(),
        reason:    reason || undefined,
        permissions,
      };
      const res = await ApiService.createDelegation(payload);
      if (!res.success) throw new Error(res.error);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  // Reset form on open
  useEffect(() => {
    if (open) {
      setEffectiveDelegatorId(delegatorIdProp);
      setDelegateId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setPermissions([]);
      setError(null);
    }
  }, [open]);

  const availableUsers = users.filter(u => u.id !== effectiveDelegatorId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Créer une délégation de pouvoir</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {showDelegatorSelector && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="delegator-label">Délégant (utilisateur en congé) *</InputLabel>
            <Select
              labelId="delegator-label"
              value={effectiveDelegatorId}
              onChange={e => setEffectiveDelegatorId(e.target.value)}
              label="Délégant (utilisateur en congé) *"
            >
              {users.map(u => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="delegate-label">Délégué *</InputLabel>
          <Select
            labelId="delegate-label"
            value={delegateId}
            onChange={e => setDelegateId(e.target.value)}
            label="Délégué *"
          >
            {availableUsers.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
                {u.branch ? ` — ${u.branch}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Date de début *"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: today }}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <TextField
            label="Date de fin *"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: startDate || today }}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </Box>

        <TextField
          label="Motif (optionnel)"
          multiline
          rows={2}
          fullWidth
          placeholder="Ex: Congé annuel du 15 au 30 avril"
          value={reason}
          onChange={e => setReason(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" gutterBottom>
          Actions déléguées * <Typography component="span" variant="caption" color="text.secondary">(sélectionner au moins une)</Typography>
        </Typography>
        <FormGroup>
          {(Object.keys(DELEGATION_ACTION_LABELS) as DelegatableAction[]).map(action => (
            <FormControlLabel
              key={action}
              control={
                <Checkbox
                  checked={permissions.includes(action)}
                  onChange={() => togglePermission(action)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  {DELEGATION_ACTION_LABELS[action]}
                </Typography>
              }
            />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Créer la délégation
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DelegationForm;
