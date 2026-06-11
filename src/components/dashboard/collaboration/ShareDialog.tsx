import React, { useEffect, useState } from 'react';
import {
  Autocomplete, Avatar, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, List,
  ListItem, ListItemAvatar, ListItemText, MenuItem, Select, TextField, Typography,
} from '@mui/material';
import { Delete as DeleteIcon, Share as ShareIcon } from '@mui/icons-material';
import { ApiService } from '../../../services/api';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardName: string;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const PERM_LABELS: Record<string, string> = { VIEW: 'Lecture', EDIT: 'Modification', view: 'Lecture', edit: 'Modification' };

export const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, dashboardId, dashboardName }) => {
  const [allUsers, setAllUsers]     = useState<any[]>([]);
  const [shares, setShares]         = useState<any[]>([]);
  const [selected, setSelected]     = useState<any | null>(null);
  const [permission, setPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!open) return;
    ApiService.getUsers().then(r => { if (r.success && r.data) setAllUsers(r.data); });
    ApiService.getDashboardShares(dashboardId).then(r => { if (r.success && r.data) setShares(r.data); });
  }, [open, dashboardId]);

  const sharedIds = new Set(shares.map((s: any) => s.targetId));
  const candidates = allUsers.filter(u => !sharedIds.has(u.id));

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    const res = await ApiService.addDashboardShare(dashboardId, selected.id, permission);
    if (res.success) {
      setShares(prev => [...prev, { ...res.data, userName: selected.name, userEmail: selected.email }]);
      setSelected(null);
    } else {
      setError(res.error ?? 'Erreur');
    }
    setSaving(false);
  };

  const handleRemove = async (shareId: string) => {
    const res = await ApiService.removeDashboardShare(dashboardId, shareId);
    if (res.success) setShares(prev => prev.filter(s => s.id !== shareId));
  };

  const getUser = (targetId: string) => allUsers.find(u => u.id === targetId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <ShareIcon fontSize="small" color="primary" />
        <Typography fontWeight={700}>Partager — {dashboardName}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>

        {/* Add user */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Autocomplete
            options={candidates}
            getOptionLabel={u => `${u.name} (${u.email})`}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            renderInput={params => <TextField {...params} label="Rechercher un utilisateur" size="small" />}
            sx={{ flex: 1 }}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Permission</InputLabel>
            <Select value={permission} label="Permission" onChange={e => setPermission(e.target.value as 'VIEW' | 'EDIT')}>
              <MenuItem value="VIEW">Lecture</MenuItem>
              <MenuItem value="EDIT">Modification</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" size="small" onClick={handleAdd} disabled={!selected || saving} sx={{ borderRadius: 2, px: 2 }}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Partager'}
          </Button>
        </Box>
        {error && <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>{error}</Typography>}

        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Accès partagés ({shares.length})
        </Typography>

        {shares.length === 0 ? (
          <Typography variant="caption" color="text.disabled">Aucun partage — seul le propriétaire y a accès.</Typography>
        ) : (
          <List dense disablePadding>
            {shares.map((s: any) => {
              const u = getUser(s.targetId);
              const name = u?.name ?? s.targetId;
              return (
                <ListItem key={s.id} disableGutters
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={PERM_LABELS[s.permission] ?? s.permission} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                      <IconButton size="small" onClick={() => handleRemove(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar sx={{ minWidth: 38 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.65rem', bgcolor: '#1565c0' }}>{initials(name)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={600}>{name}</Typography>}
                    secondary={<Typography variant="caption" color="text.disabled">{u?.email ?? ''}</Typography>}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small">Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};
