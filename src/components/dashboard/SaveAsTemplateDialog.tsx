import React, { useEffect, useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField,
} from '@mui/material';
import { ApiService } from '../../services/api';
import { Dashboard, DashboardWidget } from '../../types';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  layout: LayoutItem[];
  onSaved: () => void;
}

export const SaveAsTemplateDialog: React.FC<SaveAsTemplateDialogProps> = ({
  open, onClose, dashboard, widgets, layout, onSaved,
}) => {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(dashboard.name);
      setDescription(dashboard.description ?? '');
      setError(null);
    }
  }, [open, dashboard]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.createDashboardTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        layout,
        widgets: widgets.map(w => ({ type: w.type, title: w.title, config: w.config })),
      });
      if (res.success) {
        onSaved();
        onClose();
      } else {
        setError(res.error ?? 'Erreur lors de la sauvegarde');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Sauvegarder comme template</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus fullWidth required label="Nom"
          value={name} onChange={e => setName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <TextField
          fullWidth label="Description (optionnelle)"
          value={description} onChange={e => setDescription(e.target.value)}
          multiline rows={2}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={!name.trim() || loading}
          sx={{ borderRadius: 2 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
