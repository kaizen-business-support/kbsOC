import React, { useState } from 'react';
import {
  Box, Tabs, Tab, Typography, Button, CircularProgress, Alert,
  Snackbar, List, ListItem, ListItemButton, ListItemText, ListItemAvatar,
  Avatar, Divider,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import PersonIcon from '@mui/icons-material/Person';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { UserScopeEditor } from './UserScopeEditor';
import { ScopeDelegateManager } from './ScopeDelegateManager';
import { RoleManagerPanel } from '../role-manager/RoleManagerPanel';
import { moduleProfileApi } from '../../services/api';
import { USER_ROLE_LABELS } from '../../types';

interface User { id: string; name: string; role: string; isActive: boolean; }

interface Props {
  users: User[];
}

export const ModuleProfileTab: React.FC<Props> = ({ users }) => {
  const [section, setSection] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const seed = async () => {
    setSeeding(true);
    const res = await moduleProfileApi.seed();
    setSeeding(false);
    if (res.success) {
      setSnack({ open: true, msg: 'Profils par défaut initialisés pour ce tenant', severity: 'success' });
    } else {
      setSnack({ open: true, msg: res.error || 'Erreur', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>Profils de modules</Typography>
          <Typography variant="body2" color="text.secondary">
            Configurez les écrans, actions et sections accessibles par rôle ou par utilisateur.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={seed}
          disabled={seeding}
          startIcon={seeding ? <CircularProgress size={14} /> : undefined}
        >
          Initialiser les profils par défaut
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={section} onChange={(_, v) => { setSection(v); setSelectedUser(null); }}>
          <Tab icon={<TuneIcon />} iconPosition="start" label="Par rôle" />
          <Tab icon={<PersonIcon />} iconPosition="start" label="Par utilisateur" />
          <Tab icon={<CompareArrowsIcon />} iconPosition="start" label="Délégations de scope" />
        </Tabs>
      </Box>

      {section === 0 && <RoleManagerPanel canEdit={true} />}

      {section === 1 && (
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <Box sx={{ width: 260, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">UTILISATEURS ACTIFS</Typography>
            </Box>
            <List dense disablePadding sx={{ maxHeight: 520, overflow: 'auto' }}>
              {users.filter(u => u.isActive).map(u => (
                <React.Fragment key={u.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedUser?.id === u.id}
                      onClick={() => setSelectedUser(u)}
                      sx={{ py: 1 }}
                    >
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.light' }}>
                          {u.name.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" noWrap>{u.name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{(USER_ROLE_LABELS as Record<string, string>)[u.role] ?? u.role}</Typography>}
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Box>

          <Box sx={{ flex: 1 }}>
            {selectedUser ? (
              <UserScopeEditor
                userId={selectedUser.id}
                userName={selectedUser.name}
                userRole={selectedUser.role}
              />
            ) : (
              <Alert severity="info">Sélectionnez un utilisateur dans la liste pour configurer son profil personnalisé.</Alert>
            )}
          </Box>
        </Box>
      )}

      {section === 2 && <ScopeDelegateManager users={users} />}

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(p => ({ ...p, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};
