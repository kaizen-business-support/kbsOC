import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Avatar, Tooltip, IconButton,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as UploadIcon,
  Edit as EditIcon,
  PowerSettingsNew as ToggleIcon,
} from '@mui/icons-material';
import { ApiService, tokenManager } from '../services/api';

interface CompanyEntry {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { memberships: number; applications: number; clients: number };
}

// ── helpers ──────────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api';

async function uploadLogoFile(companyId: string, file: File): Promise<{ logoUrl: string }> {
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
  return { logoUrl: json.data.logoUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
const PlatformAdminPage: React.FC = () => {
  const [companies, setCompanies]   = useState<CompanyEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newCode, setNewCode]       = useState('');
  const [creating, setCreating]     = useState(false);

  // Edit dialog (name + logo)
  const [editTarget, setEditTarget] = useState<CompanyEntry | null>(null);
  const [editName, setEditName]     = useState('');
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [editFile, setEditFile]     = useState<File | null>(null);
  const [saving, setSaving]         = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);

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

  useEffect(() => { fetchCompanies(); }, []);

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = async (c: CompanyEntry) => {
    await ApiService.patch(`/platform/companies/${c.id}`, { isActive: !c.isActive });
    fetchCompanies();
  };

  // ── Create ─────────────────────────────────────────────────────────────────
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

  // ── Open edit dialog ───────────────────────────────────────────────────────
  const openEdit = (c: CompanyEntry) => {
    setEditTarget(c);
    setEditName(c.name);
    setEditLogoPreview(c.logoUrl ? `${API_BASE.replace('/api', '')}${c.logoUrl}` : null);
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
      // 1. Update name if changed
      if (editName !== editTarget.name) {
        await ApiService.patch(`/platform/companies/${editTarget.id}`, { name: editName });
      }
      // 2. Upload logo file if selected
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

  if (loading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Administration Plateforme</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des tenants — {companies.length} institution{companies.length > 1 ? 's' : ''}
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
              <TableCell>Logo</TableCell>
              <TableCell>Institution</TableCell>
              <TableCell>Code</TableCell>
              <TableCell align="center">Membres</TableCell>
              <TableCell align="center">Dossiers</TableCell>
              <TableCell align="center">Clients</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map(c => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Avatar
                    src={c.logoUrl ? `${API_BASE.replace('/api', '')}${c.logoUrl}` : undefined}
                    variant="rounded"
                    sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}
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
                <TableCell align="center">{c._count?.memberships ?? 0}</TableCell>
                <TableCell align="center">{c._count?.applications ?? 0}</TableCell>
                <TableCell align="center">{c._count?.clients ?? 0}</TableCell>
                <TableCell>
                  <Chip
                    label={c.isActive ? 'Actif' : 'Inactif'}
                    color={c.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Modifier nom / logo">
                      <IconButton size="small" onClick={() => openEdit(c)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={c.isActive ? 'Désactiver le tenant' : 'Activer le tenant'}>
                      <IconButton
                        size="small"
                        color={c.isActive ? 'warning' : 'success'}
                        onClick={() => handleToggle(c)}
                      >
                        <ToggleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau tenant</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Nom de l'institution" value={newName}
            onChange={e => setNewName(e.target.value)} sx={{ mt: 1, mb: 2 }}
          />
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

      {/* ── Edit dialog (nom + logo) ── */}
      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier — {editTarget?.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Nom de l'institution" value={editName}
            onChange={e => setEditName(e.target.value)} sx={{ mt: 1, mb: 3 }}
          />

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
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                size="small"
              >
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
    </Box>
  );
};

export default PlatformAdminPage;
