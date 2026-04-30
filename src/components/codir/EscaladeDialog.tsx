import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EscaladeDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!item) return;
    setSaving(true);
    const res = await ApiService.codirEscalade(item.stepId);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Escalader le dossier
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Escalader le dossier <strong>{item?.applicationNumber}</strong> au niveau supérieur ?
          Cette action notifie le supérieur hiérarchique et marque le dossier comme escaladé de façon permanente.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" color="warning" onClick={handleSubmit} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Confirmer l'escalade
        </Button>
      </DialogActions>
    </Dialog>
  );
};
