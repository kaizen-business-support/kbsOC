import React, { useState, useEffect } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemText, ListItemAvatar,
  Avatar, Typography, TextField, InputAdornment, Button, Divider,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SecurityIcon from '@mui/icons-material/Security';
import { RoleProfileEditor } from '../module-profiles/RoleProfileEditor';
import { ApiService } from '../../services/api';

const USER_ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES: "Chargé d'Affaires",
  ANALYSTE_RISQUES: 'Analyste Risques',
  RESPONSABLE_RISQUES: 'Responsable Risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable Engagements',
  COMITE_CREDIT: 'Comité de Crédit',
  DIRECTION_GENERALE: 'Direction Générale',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super Administrateur',
  BACK_OFFICE: 'Back Office',
  DIRECTION_JURIDIQUE: 'Direction Juridique',
};

interface Role {
  id: string;
  name: string;
  label: string;
  userCount?: number;
  isReadOnly?: boolean;
}

interface Props {
  canEdit: boolean;
  onRoleSaved?: () => void;
}

interface CreateForm {
  role: string;
  label: string;
  description: string;
}

const EMPTY_FORM: CreateForm = { role: '', label: '', description: '' };

export const RoleManagerPanel: React.FC<Props> = ({ canEdit, onRoleSaved }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await ApiService.getRoles();
    if (res.success && res.data) {
      setRoles(res.data);
      if (!selectedRole && res.data.length > 0) setSelectedRole(res.data[0].name);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = roles.filter(r =>
    r.label.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRoleData = roles.find(r => r.name === selectedRole);

  const openCreate = () => { setForm(EMPTY_FORM); setCreateError(null); setCreateOpen(true); };

  const handleCreate = async () => {
    if (!form.role.trim() || !form.label.trim()) {
      setCreateError('Le nom du rôle et le libellé sont obligatoires.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    const res = await ApiService.createRole({
      role: form.role.trim(),
      label: form.label.trim(),
      description: form.description.trim(),
      permissions: [],
    });
    setCreating(false);
    if (res.success) {
      setCreateOpen(false);
      await load();
      onRoleSaved?.();
      setSelectedRole(form.role.trim().toUpperCase().replace(/\s+/g, '_'));
    } else {
      setCreateError(res.error || 'Erreur lors de la création du rôle.');
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 0, height: '100%', minHeight: 600 }}>
      {/* Panneau gauche — liste des rôles */}
      <Box sx={{
        width: '30%', minWidth: 220, maxWidth: 280,
        borderRight: '1px solid', borderColor: 'divider',
        display: 'flex', flexDirection: 'column',
      }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense disablePadding sx={{ flex: 1, overflow: 'auto' }}>
            {filtered.map(role => (
              <React.Fragment key={role.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedRole === role.name}
                    onClick={() => setSelectedRole(role.name)}
                    sx={{ py: 1.5 }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: selectedRole === role.name ? 'primary.main' : 'grey.200' }}>
                        <SecurityIcon fontSize="small" sx={{ color: selectedRole === role.name ? 'white' : 'grey.600' }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={selectedRole === role.name ? 600 : 400}>
                          {role.label || USER_ROLE_LABELS[role.name] || role.name}
                        </Typography>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {role.userCount !== undefined && (
                            <Typography variant="caption" color="text.secondary">
                              {role.userCount} utilisateur{role.userCount !== 1 ? 's' : ''}
                            </Typography>
                          )}
                          {role.isReadOnly && (
                            <Typography variant="caption" color="warning.main" fontWeight={600}>
                              · lecture seule
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}

        {canEdit && (
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={openCreate}
            >
              Ajouter un rôle
            </Button>
          </Box>
        )}
      </Box>

      {/* Panneau droit — éditeur du rôle */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {selectedRole ? (
          <RoleProfileEditor
            selectedRole={selectedRole}
            userCount={selectedRoleData?.userCount ?? 0}
            isReadOnly={selectedRoleData?.isReadOnly ?? false}
            onSaved={load}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">Sélectionner un rôle dans la liste</Typography>
          </Box>
        )}
      </Box>

      {/* Dialog création de rôle */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Créer un nouveau rôle</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
            Le nom du rôle sera automatiquement mis en majuscules (ex : ANALYSTE_SENIOR).
          </DialogContentText>
          <TextField
            label="Nom du rôle *"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={form.role}
            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            placeholder="ANALYSTE_SENIOR"
            helperText="Lettres, chiffres et underscores uniquement"
          />
          <TextField
            label="Libellé d'affichage *"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Analyste Senior"
          />
          <TextField
            label="Description (optionnel)"
            fullWidth
            size="small"
            multiline
            rows={2}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          {createError && (
            <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
              {createError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !form.role.trim() || !form.label.trim()}
            startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
