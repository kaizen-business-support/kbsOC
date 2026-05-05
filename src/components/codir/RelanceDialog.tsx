import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress } from '@mui/material';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RelanceDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultMessage = item
    ? `Le dossier ${item.applicationNumber} — ${item.clientName} attend votre action depuis ${item.daysWaiting} jour(s). Merci de traiter ce dossier en priorité.`
    : '';

  const handleOpen = () => { setMessage(''); setSaving(false); };
  const handleSubmit = async () => {
    if (!item) return;
    setSaving(true);
    const res = await ApiService.codirRelance(item.stepId, message || defaultMessage);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>Relancer — Dossier {item?.applicationNumber}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth multiline rows={4} sx={{ mt: 1 }}
          label="Message de relance"
          value={message || defaultMessage}
          onChange={e => setMessage(e.target.value)}
          placeholder={defaultMessage}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Envoyer la relance
        </Button>
      </DialogActions>
    </Dialog>
  );
};
