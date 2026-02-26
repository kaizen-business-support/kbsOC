import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { Announcement } from '../components/AnnouncementModal';

const PRIORITY_OPTIONS = [
  { value: 'INFO',    label: 'Information', color: 'info'    as const },
  { value: 'WARNING', label: 'Attention',   color: 'warning' as const },
  { value: 'URGENT',  label: 'Urgent',      color: 'error'   as const },
];

const toDatetimeLocal = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16);

const defaultForm = () => ({
  title: '',
  message: '',
  priority: 'INFO',
  expiresAt: '',
  isActive: true,
});

const AnnouncementsAdminPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await ApiService.getAllAnnouncements();
    if (res.success && res.data) {
      setAnnouncements(res.data as Announcement[]);
    } else {
      setError(res.error || 'Erreur de chargement');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm());
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditTarget(ann);
    setForm({
      title: ann.title,
      message: ann.message,
      priority: ann.priority,
      expiresAt: toDatetimeLocal(ann.expiresAt),
      isActive: (ann as any).isActive ?? true,
    });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim() || !form.expiresAt) {
      setFormError('Titre, message et date d\'expiration sont requis.');
      return;
    }
    if (new Date(form.expiresAt) <= new Date()) {
      setFormError('La date d\'expiration doit être dans le futur.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      priority: form.priority,
      expiresAt: new Date(form.expiresAt).toISOString(),
      isActive: form.isActive,
    };

    const res = editTarget
      ? await ApiService.updateAnnouncement(editTarget.id, payload)
      : await ApiService.createAnnouncement(payload);

    if (res.success) {
      setSuccess(editTarget ? 'Annonce mise à jour.' : 'Annonce créée.');
      setDialogOpen(false);
      load();
    } else {
      setFormError(res.error || 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await ApiService.deleteAnnouncement(deleteId);
    if (res.success) {
      setSuccess('Annonce supprimée.');
      setAnnouncements(prev => prev.filter(a => a.id !== deleteId));
    } else {
      setError(res.error || 'Erreur lors de la suppression');
    }
    setDeleteId(null);
    setDeleting(false);
  };

  const handleToggleActive = async (ann: Announcement) => {
    const res = await ApiService.updateAnnouncement(ann.id, { isActive: !(ann as any).isActive });
    if (res.success) load();
  };

  const isExpired = (iso: string) => new Date(iso) < new Date();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CampaignIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Notes d'information</Typography>
            <Typography variant="body2" color="text.secondary">
              Gérez les annonces visibles par tous les utilisateurs à la connexion
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nouvelle annonce
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Titre</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Priorité</TableCell>
              <TableCell sx={{ fontWeight: 700, display: { xs: 'none', sm: 'table-cell' } }}>Expiration</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Statut</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Aucune annonce. Cliquez sur "Nouvelle annonce" pour commencer.
                </TableCell>
              </TableRow>
            ) : (
              announcements.map(ann => {
                const cfg = PRIORITY_OPTIONS.find(p => p.value === ann.priority) || PRIORITY_OPTIONS[0];
                const expired = isExpired(ann.expiresAt);
                const active = (ann as any).isActive && !expired;

                return (
                  <TableRow key={ann.id} sx={{ opacity: expired ? 0.55 : 1 }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ann.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                        Expire : {formatDate(ann.expiresAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2" color={expired ? 'error' : 'text.primary'}>
                        {formatDate(ann.expiresAt)}
                        {expired && ' (expirée)'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={expired ? 'Expirée — modifiez la date' : active ? 'Désactiver' : 'Activer'}>
                        <span>
                          <Switch
                            size="small"
                            checked={active}
                            disabled={expired}
                            onChange={() => handleToggleActive(ann)}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => openEdit(ann)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(ann.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Titre *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            fullWidth
            inputProps={{ maxLength: 120 }}
          />

          <TextField
            label="Message *"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            fullWidth
            multiline
            rows={4}
            placeholder="Rédigez le contenu de votre note d'information…"
          />

          <TextField
            select
            label="Priorité"
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            fullWidth
          >
            {PRIORITY_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                <Chip label={opt.label} size="small" color={opt.color} variant="outlined" sx={{ mr: 1 }} />
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Date d'expiration *"
            type="datetime-local"
            value={form.expiresAt}
            onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date(Date.now() + 60000).toISOString().slice(0, 16) }}
            helperText="Après cette date, l'annonce ne sera plus affichée"
          />

          {editTarget && (
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
              }
              label="Annonce active"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editTarget ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Supprimer l'annonce</DialogTitle>
        <DialogContent>
          <Typography>Cette action est irréversible. Confirmer la suppression ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleting}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementsAdminPage;
