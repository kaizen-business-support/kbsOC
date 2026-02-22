/**
 * BackupPage.tsx — Admin page for database backup and restore management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { tokenManager } from '../services/api';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  type: string;
}

interface BackupLog {
  id: string;
  filename: string;
  type: string;
  size: number;
  status: string;
  error?: string;
  createdBy?: string;
  createdAt: string;
}

export const BackupPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'files' | 'logs'>('files');

  // Restore dialog
  const [restoreDialog, setRestoreDialog] = useState({ open: false, filename: '' });
  const [otpCode, setOtpCode] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Delete confirm
  const [deleteDialog, setDeleteDialog] = useState({ open: false, filename: '' });
  const [deleting, setDeleting] = useState(false);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` }
  });

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/backup/list`, authHeader());
      setBackups(res.data.backups);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de chargement des sauvegardes');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/backup/logs`, authHeader());
      setLogs(res.data.logs);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchLogs();
  }, [fetchBackups, fetchLogs]);

  const handleCreate = async (type: 'full' | 'partial') => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API_BASE}/backup/create`, { type }, authHeader());
      setSuccess(`Sauvegarde créée : ${res.data.filename}`);
      fetchBackups();
      fetchLogs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/backup/restore`, {
        filename: restoreDialog.filename,
        otpToken: otpCode || undefined,
      }, authHeader());
      setSuccess(`Restauration depuis ${restoreDialog.filename} lancée.`);
      setRestoreDialog({ open: false, filename: '' });
      setOtpCode('');
    } catch (err: any) {
      if (err.response?.status === 428) {
        // 2FA required
        setError('Code 2FA requis. Entrez votre code.');
      } else {
        setError(err.response?.data?.error || 'Erreur de restauration');
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/backup/${deleteDialog.filename}`, authHeader());
      setSuccess(`${deleteDialog.filename} supprimé`);
      setDeleteDialog({ open: false, filename: '' });
      fetchBackups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (filename: string) => {
    const token = tokenManager.getAccessToken();
    const url = `${API_BASE}/backup/download/${filename}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Add token via fetch + blob for auth
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight={600} sx={{ mb: 0.5 }}>
            <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Sauvegarde & Restauration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des sauvegardes de la base de données PostgreSQL
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchBackups(); fetchLogs(); }}
            disabled={loading}
          >
            Actualiser
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleCreate('partial')}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <BackupIcon />}
          >
            Sauvegarde partielle
          </Button>
          <Button
            variant="contained"
            onClick={() => handleCreate('full')}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <BackupIcon />}
          >
            Sauvegarde complète
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Tab selector */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={activeTab === 'files' ? 'contained' : 'outlined'}
          startIcon={<BackupIcon />}
          onClick={() => setActiveTab('files')}
          size="small"
        >
          Fichiers ({backups.length})
        </Button>
        <Button
          variant={activeTab === 'logs' ? 'contained' : 'outlined'}
          startIcon={<HistoryIcon />}
          onClick={() => setActiveTab('logs')}
          size="small"
        >
          Historique ({logs.length})
        </Button>
      </Box>

      {/* Backups Table */}
      {activeTab === 'files' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fichier</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Taille</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center"><CircularProgress size={28} sx={{ my: 2 }} /></TableCell>
                </TableRow>
              ) : backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      Aucune sauvegarde disponible. Créez-en une maintenant.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((b) => (
                  <TableRow key={b.filename} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.filename}</TableCell>
                    <TableCell>
                      <Chip
                        label={b.type === 'full' ? 'Complète' : 'Partielle'}
                        color={b.type === 'full' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatSize(b.size)}</TableCell>
                    <TableCell>{new Date(b.createdAt).toLocaleString('fr-FR')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Télécharger">
                        <IconButton size="small" onClick={() => handleDownload(b.filename)}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restaurer">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => setRestoreDialog({ open: true, filename: b.filename })}
                        >
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, filename: b.filename })}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Logs Table */}
      {activeTab === 'logs' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fichier</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Taille</TableCell>
                <TableCell>Par</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.filename}</TableCell>
                  <TableCell>
                    <Chip label={log.type} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.status === 'success' ? 'Succès' : 'Échec'}
                      color={log.status === 'success' ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatSize(log.size)}</TableCell>
                  <TableCell>{log.createdBy || 'auto'}</TableCell>
                  <TableCell>{new Date(log.createdAt).toLocaleString('fr-FR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialog.open} onClose={() => setRestoreDialog({ open: false, filename: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Restaurer la base de données</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>ATTENTION :</strong> Cette opération remplace TOUTES les données actuelles par
            celles de la sauvegarde. Cette action est irréversible.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Fichier : <code>{restoreDialog.filename}</code>
          </Typography>
          <TextField
            fullWidth
            label="Code 2FA (si activé)"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Code à 6 chiffres"
            inputProps={{ style: { textAlign: 'center', fontSize: 22, letterSpacing: 6 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog({ open: false, filename: '' })}>Annuler</Button>
          <Button
            onClick={handleRestore}
            color="error"
            variant="contained"
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={18} /> : <RestoreIcon />}
          >
            Restaurer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, filename: '' })}>
        <DialogTitle>Supprimer la sauvegarde</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer définitivement <strong>{deleteDialog.filename}</strong> ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, filename: '' })}>Annuler</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} /> : <DeleteIcon />}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BackupPage;
