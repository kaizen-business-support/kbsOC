import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress
} from '@mui/material';
import { ApiService } from '../services/api';

interface CompanyEntry {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  _count?: { memberships: number; applications: number; clients: number };
}

const PlatformAdminPage: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleToggle = async (id: string, isActive: boolean) => {
    await ApiService.patch(`/platform/companies/${id}`, { isActive: !isActive });
    fetchCompanies();
  };

  const handleCreate = async () => {
    if (!newName || !newCode) return;
    setCreating(true);
    try {
      await ApiService.post('/platform/companies', { name: newName, code: newCode });
      setCreateOpen(false);
      setNewName(''); setNewCode('');
      fetchCompanies();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Administration Plateforme</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>Nouvelle compagnie</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Membres</TableCell>
              <TableCell>Dossiers</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell><Chip label={c.code} size="small" /></TableCell>
                <TableCell>{c._count?.memberships ?? '-'}</TableCell>
                <TableCell>{c._count?.applications ?? '-'}</TableCell>
                <TableCell>
                  <Chip label={c.isActive ? 'Actif' : 'Inactif'} color={c.isActive ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleToggle(c.id, c.isActive)}>
                    {c.isActive ? 'Désactiver' : 'Activer'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle compagnie</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" value={newName} onChange={e => setNewName(e.target.value)} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="Code" value={newCode} onChange={e => setNewCode(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newName || !newCode}>
            {creating ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformAdminPage;
