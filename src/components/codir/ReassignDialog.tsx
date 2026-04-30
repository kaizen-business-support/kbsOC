import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem, Typography,
} from '@mui/material';
import { PendingDecisionItem } from '../../types';
import { ApiService } from '../../services/api';

interface Props {
  item: PendingDecisionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignDialog: React.FC<Props> = ({ item, onClose, onSuccess }) => {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNewAssigneeId(''); setComment('');
    setLoadingAgents(true);
    ApiService.codirGetAgents(item.assignedRole).then(res => {
      if (res.success) setAgents((res.data ?? []).filter(a => a.id !== item.assigneeId));
      setLoadingAgents(false);
    });
  }, [item]);

  const handleSubmit = async () => {
    if (!item || !newAssigneeId) return;
    setSaving(true);
    const res = await ApiService.codirReassign(item.stepId, newAssigneeId, comment || undefined);
    setSaving(false);
    if (res.success) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Réaffecter — Dossier {item?.applicationNumber}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        {loadingAgents ? <CircularProgress size={24} sx={{ alignSelf: 'center' }} /> : (
          <>
            {agents.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun autre agent disponible pour le rôle {item?.assignedRole}.
              </Typography>
            )}
            <FormControl fullWidth size="small" disabled={agents.length === 0}>
              <InputLabel>Nouvel agent</InputLabel>
              <Select value={newAssigneeId} label="Nouvel agent" onChange={e => setNewAssigneeId(e.target.value)}>
                {agents.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Commentaire (optionnel)" value={comment}
              onChange={e => setComment(e.target.value)} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit}
          disabled={saving || !newAssigneeId || loadingAgents}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          Réaffecter
        </Button>
      </DialogActions>
    </Dialog>
  );
};
