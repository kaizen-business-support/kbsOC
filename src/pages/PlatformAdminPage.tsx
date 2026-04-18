import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Avatar, Tooltip, IconButton,
  Stack, Collapse, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemAvatar, ListItemText, Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as UploadIcon,
  Edit as EditIcon,
  PowerSettingsNew as ToggleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PersonAdd as PersonAddIcon,
  PersonOff as PersonOffIcon,
} from '@mui/icons-material';
import { ApiService, tokenManager } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyEntry {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { memberships: number; applications: number; clients: number };
}

interface MemberEntry {
  id: string;
  role: string;
  isActive: boolean;
  user: { id: string; email: string; name: string; role: string; jobTitle?: string; department?: string };
}

const ROLES = [
  'CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE',
  'DIRECTION_JURIDIQUE', 'BACK_OFFICE', 'ADMIN',
];

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES: "Chargé d'Affaires", ANALYSTE_RISQUES: 'Analyste Risques',
  RESPONSABLE_RISQUES: 'Resp. Risques', RESPONSABLE_ENGAGEMENTS: 'Resp. Engagements',
  COMITE_CREDIT: 'Comité de Crédit', DIRECTION_GENERALE: 'Direction Générale',
  DIRECTION_JURIDIQUE: 'Direction Juridique', BACK_OFFICE: 'Back Office', ADMIN: 'Administrateur',
};

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api';

async function uploadLogoFile(companyId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('logo', file);
  const token = tokenManager.getAccessToken();
  const res = await fetch(`${API_BASE}/platform/companies/${companyId}/logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Upload échoué');
}

// ─────────────────────────────────────────────────────────────────────────────

const PlatformAdminPage: React.FC = () => {
  const [companies, setCompanies]     = useState<CompanyEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [members, setMembers]         = useState<Record<string, MemberEntry[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);

  // Create company dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [newName, setNewName]         = useState('');
  const [newCode, setNewCode]         = useState('');
  const [creating, setCreating]       = useState(false);

  // Edit (name + logo) dialog
  const [editTarget, setEditTarget]   = useState<CompanyEntry | null>(null);
  const [editName, setEditName]       = useState('');
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [editFile, setEditFile]       = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Add member dialog
  const [addMemberTarget, setAddMemberTarget] = useState<CompanyEntry | null>(null);
  const [newUserEmail, setNewUserEmail]   = useState('');
  const [newUserName, setNewUserName]     = useState('');
  const [newUserRole, setNewUserRole]     = useState('CHARGE_AFFAIRES');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [addingMember, setAddingMember]   = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCompanies = async () => {
    try {
      const result = await ApiService.get('/platform/companies') as any;
      if (result.success) setCompanies(result.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (companyId: string) => {
    setMembersLoading(companyId);
    try {
      const result = await ApiService.get(`/platform/companies/${companyId}/members`) as any;
      if (result.success) setMembers(prev => ({ ...prev, [companyId]: result.data }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMembersLoading(null);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  // ── Toggle expand ──────────────────────────────────────────────────────────

  const toggleExpand = (c: CompanyEntry) => {
    if (expandedId === c.id) {
      setExpandedId(null);
    } else {
      setExpandedId(c.id);
      if (!members[c.id]) fetchMembers(c.id);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────

  const handleToggle = async (c: CompanyEntry) => {
    await ApiService.patch(`/platform/companies/${c.id}`, { isActive: !c.isActive });
    fetchCompanies();
  };

  // ── Create company ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newName || !newCode) return;
    setCreating(true);
    setError(null);
    try {
      await ApiService.post('/platform/companies', { name: newName, code: newCode.toUpperCase() });
      setCreateOpen(false);
      setNewName(''); setNewCode('');
      fetchCompanies();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit company (name + logo) ─────────────────────────────────────────────

  const openEdit = (c: CompanyEntry) => {
    setEditTarget(c);
    setEditName(c.name);
    const origin = window.location.origin.replace(':5173', ':3001');
    setEditLogoPreview(c.logoUrl ? `${origin}${c.logoUrl}` : null);
    setEditFile(null);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    try {
      if (editName !== editTarget.name) {
        await ApiService.patch(`/platform/companies/${editTarget.id}`, { name: editName });
      }
      if (editFile) {
        await uploadLogoFile(editTarget.id, editFile);
      }
      setEditTarget(null);
      fetchCompanies();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Add member ─────────────────────────────────────────────────────────────

  const openAddMember = (c: CompanyEntry) => {
    setAddMemberTarget(c);
    setNewUserEmail(''); setNewUserName('');
    setNewUserRole('CHARGE_AFFAIRES'); setNewUserPassword('');
  };

  const handleAddMember = async () => {
    if (!addMemberTarget || !newUserEmail || !newUserName || !newUserRole || !newUserPassword) return;
    setAddingMember(true);
    setError(null);
    try {
      await ApiService.post(`/platform/companies/${addMemberTarget.id}/members`, {
        email: newUserEmail, name: newUserName, role: newUserRole, password: newUserPassword,
      });
      setAddMemberTarget(null);
      // Refresh members if already expanded
      if (expandedId === addMemberTarget.id) fetchMembers(addMemberTarget.id);
      fetchCompanies();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (companyId: string, userId: string) => {
    await ApiService.delete(`/platform/companies/${companyId}/members/${userId}`);
    fetchMembers(companyId);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  const origin = window.location.origin.replace(':5173', ':3001');

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Administration Plateforme</Typography>
          <Typography variant="body2" color="text.secondary">
            {companies.length} tenant{companies.length > 1 ? 's' : ''} — cliquez sur une ligne pour gérer ses membres
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Nouveau tenant
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tenants table */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ width: 56 }}>Logo</TableCell>
              <TableCell>Institution</TableCell>
              <TableCell>Code</TableCell>
              <TableCell align="center">Membres</TableCell>
              <TableCell align="center">Dossiers</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map(c => (
              <React.Fragment key={c.id}>
                {/* Company row */}
                <TableRow
                  hover
                  sx={{ cursor: 'pointer', bgcolor: expandedId === c.id ? 'rgba(58,86,168,0.04)' : undefined }}
                  onClick={() => toggleExpand(c)}
                >
                  <TableCell>
                    {expandedId === c.id ? <ExpandLessIcon sx={{ color: 'text.secondary', fontSize: 20 }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: 20 }} />}
                  </TableCell>
                  <TableCell>
                    <Avatar
                      src={c.logoUrl ? `${origin}${c.logoUrl}` : undefined}
                      variant="rounded"
                      sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}
                    >
                      {c.code.slice(0, 2)}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Créé le {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip label={c.code} size="small" /></TableCell>
                  <TableCell align="center">
                    <Chip label={c._count?.memberships ?? 0} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">{c._count?.applications ?? 0}</TableCell>
                  <TableCell>
                    <Chip label={c.isActive ? 'Actif' : 'Inactif'} color={c.isActive ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Ajouter un utilisateur">
                        <IconButton size="small" color="primary" onClick={() => openAddMember(c)}>
                          <PersonAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Modifier nom / logo">
                        <IconButton size="small" onClick={() => openEdit(c)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={c.isActive ? 'Désactiver' : 'Activer'}>
                        <IconButton size="small" color={c.isActive ? 'warning' : 'success'} onClick={() => handleToggle(c)}>
                          <ToggleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>

                {/* Members panel */}
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expandedId === c.id} timeout="auto" unmountOnExit>
                      <Box sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', px: 4, py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                            Membres — {c.name}
                          </Typography>
                          <Button size="small" startIcon={<PersonAddIcon />} onClick={() => openAddMember(c)}>
                            Ajouter un utilisateur
                          </Button>
                        </Box>

                        {membersLoading === c.id ? (
                          <CircularProgress size={20} />
                        ) : (members[c.id] ?? []).length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Aucun membre — cliquez sur "Ajouter un utilisateur"
                          </Typography>
                        ) : (
                          <List dense disablePadding>
                            {(members[c.id] ?? []).map((m, idx) => (
                              <React.Fragment key={m.id}>
                                {idx > 0 && <Divider component="li" />}
                                <ListItem
                                  disablePadding
                                  sx={{ py: 0.75 }}
                                  secondaryAction={
                                    <Tooltip title="Retirer du tenant">
                                      <IconButton size="small" color="error" onClick={() => handleRemoveMember(c.id, m.user.id)}>
                                        <PersonOffIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  }
                                >
                                  <ListItemAvatar sx={{ minWidth: 44 }}>
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                                      {m.user.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography fontSize={13} fontWeight={600}>{m.user.name}</Typography>
                                        <Chip label={ROLE_LABELS[m.role] ?? m.role} size="small" sx={{ fontSize: 10, height: 18 }} />
                                        {!m.isActive && <Chip label="Inactif" size="small" color="default" sx={{ fontSize: 10, height: 18 }} />}
                                      </Box>
                                    }
                                    secondary={m.user.email}
                                    secondaryTypographyProps={{ fontSize: 11 }}
                                  />
                                </ListItem>
                              </React.Fragment>
                            ))}
                          </List>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Create company dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau tenant</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom de l'institution" value={newName} onChange={e => setNewName(e.target.value)} sx={{ mt: 1, mb: 2 }} />
          <TextField
            fullWidth label="Code (ex: BCI, CBAO)" value={newCode}
            onChange={e => setNewCode(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 10 }}
            helperText="Identifiant court unique, lettres majuscules"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newName || !newCode}>
            {creating ? <CircularProgress size={18} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit company dialog (nom + logo) ── */}
      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier — {editTarget?.name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom de l'institution" value={editName} onChange={e => setEditName(e.target.value)} sx={{ mt: 1, mb: 3 }} />
          <Typography variant="subtitle2" gutterBottom>Logo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={editLogoPreview ?? undefined}
              variant="rounded"
              sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 20, fontWeight: 700 }}
            >
              {editTarget?.code.slice(0, 2)}
            </Avatar>
            <Box>
              <input
                ref={fileInputRef} type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
              <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()} size="small">
                Choisir un fichier
              </Button>
              {editFile && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }} color="text.secondary">
                  {editFile.name} ({(editFile.size / 1024).toFixed(0)} Ko)
                </Typography>
              )}
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                PNG, JPG, WEBP ou SVG — max 2 Mo
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Sauvegarder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add member dialog ── */}
      <Dialog open={Boolean(addMemberTarget)} onClose={() => setAddMemberTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Ajouter un utilisateur — {addMemberTarget?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Si l'email existe déjà sur la plateforme, l'utilisateur sera simplement rattaché à ce tenant.
          </Typography>
          <TextField
            fullWidth label="Email" type="email" value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)} sx={{ mb: 2 }}
          />
          <TextField
            fullWidth label="Nom complet" value={newUserName}
            onChange={e => setNewUserName(e.target.value)} sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rôle</InputLabel>
            <Select value={newUserRole} label="Rôle" onChange={e => setNewUserRole(e.target.value)}>
              {ROLES.map(r => (
                <MenuItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth label="Mot de passe provisoire" type="password" value={newUserPassword}
            onChange={e => setNewUserPassword(e.target.value)}
            helperText="L'utilisateur pourra le changer après sa première connexion"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberTarget(null)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleAddMember}
            disabled={addingMember || !newUserEmail || !newUserName || !newUserRole || !newUserPassword}
          >
            {addingMember ? <CircularProgress size={18} /> : 'Créer et rattacher'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformAdminPage;
