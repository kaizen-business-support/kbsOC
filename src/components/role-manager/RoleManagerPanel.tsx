import React, { useState, useEffect } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemText, ListItemAvatar,
  Avatar, Typography, TextField, InputAdornment, Button, Divider,
  CircularProgress,
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
}

interface Props {
  canEdit: boolean;
}

export const RoleManagerPanel: React.FC<Props> = ({ canEdit }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
                        role.userCount !== undefined
                          ? `${role.userCount} utilisateur${role.userCount !== 1 ? 's' : ''}`
                          : undefined
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
              disabled
              title="Fonctionnalité à venir"
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
            onSaved={load}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">Sélectionner un rôle dans la liste</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
