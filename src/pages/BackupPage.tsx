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
  Tooltip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  NotificationsNone as NotificationsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { tokenManager } from '../services/api';
import { PageType } from '../types';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT || '5007'}/api`;

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

interface NotifyEmail {
  id: string;
  email: string;
  name?: string;
  isActive: boolean;
}

interface BackupPageProps {
  onNavigate?: (page: PageType) => void;
}

export const BackupPage: React.FC<BackupPageProps> = ({ onNavigate }) => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'files' | 'logs' | 'notifications'>('files');

  // 2FA status
  const [userHas2FA, setUserHas2FA] = useState<boolean | null>(null);

  // Restore dialog — 2-phase
  const [restoreDialog, setRestoreDialog] = useState({ open: false, filename: '' });
  const [restorePhase, setRestorePhase] = useState<1 | 2>(1);
  const [preChecks, setPreChecks] = useState([false, false, false, false]);
  const [otpCode, setOtpCode] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Delete confirm
  const [deleteDialog, setDeleteDialog] = useState({ open: false, filename: '' });
  const [deleting, setDeleting] = useState(false);

  // Notify emails
  const [notifyEmails, setNotifyEmails] = useState<NotifyEmail[]>([]);
  const [emailEditingId, setEmailEditingId] = useState<string | null>(null);
  const [emailEditData, setEmailEditData] = useState({ email: '', name: '' });
  const [emailSaving, setEmailSaving] = useState(false);

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

  const fetchNotifyEmails = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/backup/notify-emails`, authHeader());
      setNotifyEmails(res.data.emails);
    } catch {
      // non-critical
    }
  }, []);

  const fetch2FAStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`, authHeader());
      setUserHas2FA(res.data.user?.twoFactorEnabled ?? false);
    } catch {
      setUserHas2FA(null);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchLogs();
    fetchNotifyEmails();
    fetch2FAStatus();
  }, [fetchBackups, fetchLogs, fetchNotifyEmails, fetch2FAStatus]);

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

  const openRestoreDialog = (filename: string) => {
    setRestoreDialog({ open: true, filename });
    setRestorePhase(1);
    setPreChecks([false, false, false, false]);
    setOtpCode('');
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/backup/restore`, {
        filename: restoreDialog.filename,
        otpToken: otpCode || undefined,
      }, authHeader());
      setSuccess(`Restauration depuis ${restoreDialog.filename} lancée. Le serveur va redémarrer.`);
      setRestoreDialog({ open: false, filename: '' });
      setOtpCode('');
    } catch (err: any) {
      if (err.response?.status === 428) {
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
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  const startEditEmail = (r: NotifyEmail) => {
    setEmailEditingId(r.id);
    setEmailEditData({ email: r.email, name: r.name || '' });
  };

  const cancelEditEmail = () => {
    setEmailEditingId(null);
    setEmailEditData({ email: '', name: '' });
  };

  const saveEditEmail = async () => {
    if (!emailEditData.email) return;
    setEmailSaving(true);
    try {
      if (emailEditingId === '__new__') {
        await axios.post(`${API_BASE}/backup/notify-emails`, { email: emailEditData.email, name: emailEditData.name || undefined }, authHeader());
      } else {
        await axios.put(`${API_BASE}/backup/notify-emails/${emailEditingId}`, emailEditData, authHeader());
      }
      await fetchNotifyEmails();
      cancelEditEmail();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setEmailSaving(false);
    }
  };

  const startAddEmailRow = () => {
    setEmailEditingId('__new__');
    setEmailEditData({ email: '', name: '' });
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/backup/notify-emails/${id}`, authHeader());
      fetchNotifyEmails();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const allPreChecked = preChecks.every(Boolean);

  const PRE_CHECKS_LABELS = [
    'La sauvegarde sélectionnée est complète et récente',
    'Une nouvelle sauvegarde a été créée juste avant cette restauration',
    'Les utilisateurs connectés ont été notifiés de l\'interruption',
    'Je comprends que TOUTES les données actuelles seront irrémédiablement écrasées',
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600} sx={{ mb: 0.5 }}>
            <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Sauvegarde & Restauration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des sauvegardes de la base de données PostgreSQL
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchBackups(); fetchLogs(); fetchNotifyEmails(); fetch2FAStatus(); }}
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

      {/* 2FA Banner */}
      {userHas2FA === false && (
        <Alert severity="warning" icon={<LockOpenIcon />} sx={{ mb: 2 }}>
          <strong>Authentification 2 facteurs non activée.</strong> La restauration est désactivée jusqu'à l'activation de la 2FA.
          {onNavigate && (
            <Button size="small" sx={{ ml: 2 }} onClick={() => onNavigate('profile')}>
              Activer la 2FA
            </Button>
          )}
        </Alert>
      )}
      {userHas2FA === true && (
        <Alert severity="success" icon={<LockIcon />} sx={{ mb: 2, py: 0.5 }}>
          2FA active — restaurations protégées.
        </Alert>
      )}

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
        <Button
          variant={activeTab === 'notifications' ? 'contained' : 'outlined'}
          startIcon={<NotificationsIcon />}
          onClick={() => setActiveTab('notifications')}
          size="small"
        >
          Notifications ({notifyEmails.length})
        </Button>
      </Box>

      {/* Backups Table */}
      {activeTab === 'files' && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>Fichier</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>Type</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>Taille</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>Date</TableCell>
                <TableCell align="right" sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>Actions</TableCell>
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
                  <TableRow key={b.filename} sx={{ borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' } }}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', py: 1.5, color: '#374151' }}>{b.filename}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={b.type === 'full' ? 'Complète' : 'Partielle'}
                        color={b.type === 'full' ? 'primary' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{formatSize(b.size)}</TableCell>
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{new Date(b.createdAt).toLocaleString('fr-FR')}</TableCell>
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Tooltip title="Télécharger">
                        <IconButton size="small" onClick={() => handleDownload(b.filename)}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={userHas2FA !== true ? 'Activez la 2FA pour restaurer' : 'Restaurer'}>
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            disabled={userHas2FA !== true}
                            onClick={() => openRestoreDialog(b.filename)}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </span>
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
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Fichier</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Type</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Statut</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Taille</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Par</TableCell>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} sx={{ borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' } }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', py: 1.5, color: '#374151' }}>{log.filename}</TableCell>
                  <TableCell sx={{ py: 1.5 }}><Chip label={log.type} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={log.status === 'success' ? 'Succès' : 'Échec'}
                      color={log.status === 'success' ? 'success' : 'error'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{formatSize(log.size)}</TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{log.createdBy || 'auto'}</TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{new Date(log.createdAt).toLocaleString('fr-FR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Paper sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none', p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ces adresses recevront un email lors de chaque sauvegarde complète et en cas d'échec.
            Double-cliquez sur une ligne pour la modifier.
          </Typography>

          <TableContainer sx={{ border: '1px solid #e8ecf0', borderRadius: '8px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notifyEmails.length === 0 && emailEditingId !== '__new__' && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Aucun destinataire configuré.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {notifyEmails.map((r) =>
                  emailEditingId === r.id ? (
                    /* ── Edit row ── */
                    <TableRow key={r.id} sx={{ bgcolor: 'rgba(31,78,121,0.04)' }}>
                      <TableCell>
                        <TextField
                          autoFocus size="small" variant="outlined"
                          placeholder="email@exemple.com" type="email"
                          value={emailEditData.email}
                          onChange={e => setEmailEditData(p => ({ ...p, email: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEditEmail()}
                          sx={{ width: 220 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" variant="outlined"
                          placeholder="Nom (optionnel)"
                          value={emailEditData.name}
                          onChange={e => setEmailEditData(p => ({ ...p, name: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEditEmail()}
                          sx={{ width: 160 }}
                        />
                      </TableCell>
                      <TableCell><Chip label="Actif" color="success" size="small" variant="outlined" /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Enregistrer">
                          <span>
                            <IconButton size="small" color="success" onClick={saveEditEmail}
                              disabled={!emailEditData.email || emailSaving}>
                              {emailSaving ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Annuler">
                          <IconButton size="small" onClick={cancelEditEmail}><CloseIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ) : (
                    /* ── View row ── */
                    <TableRow key={r.id} hover onDoubleClick={() => startEditEmail(r)}>
                      <TableCell sx={{ fontWeight: 500 }}>{r.email}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{r.name || '—'}</TableCell>
                      <TableCell><Chip label="Actif" color="success" size="small" variant="outlined" /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Modifier">
                          <IconButton size="small" onClick={() => startEditEmail(r)}
                            disabled={emailEditingId !== null}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" color="error" onClick={() => handleDeleteEmail(r.id)}
                            disabled={emailEditingId !== null}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                )}

                {/* New row being added inline */}
                {emailEditingId === '__new__' && (
                  <TableRow sx={{ bgcolor: 'rgba(31,78,121,0.04)' }}>
                    <TableCell>
                      <TextField
                        autoFocus size="small" variant="outlined"
                        placeholder="email@exemple.com" type="email"
                        value={emailEditData.email}
                        onChange={e => setEmailEditData(p => ({ ...p, email: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && saveEditEmail()}
                        sx={{ width: 220 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small" variant="outlined"
                        placeholder="Nom (optionnel)"
                        value={emailEditData.name}
                        onChange={e => setEmailEditData(p => ({ ...p, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && saveEditEmail()}
                        sx={{ width: 160 }}
                      />
                    </TableCell>
                    <TableCell><Chip label="Nouveau" color="info" size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Enregistrer">
                        <span>
                          <IconButton size="small" color="success" onClick={saveEditEmail}
                            disabled={!emailEditData.email || emailSaving}>
                            {emailSaving ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Annuler">
                        <IconButton size="small" onClick={cancelEditEmail}><CloseIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={startAddEmailRow}
            disabled={emailEditingId !== null}
            sx={{ mt: 1.5, color: 'primary.main', textTransform: 'none', fontWeight: 500 }}
          >
            Ajouter une adresse
          </Button>
        </Paper>
      )}

      {/* Restore Dialog — 2 phases */}
      <Dialog open={restoreDialog.open} onClose={() => setRestoreDialog({ open: false, filename: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          {restorePhase === 1 ? 'Vérifications préalables à la restauration' : 'Confirmer la restauration'}
        </DialogTitle>
        <DialogContent>
          {restorePhase === 1 ? (
            <Box>
              <Alert severity="error" sx={{ mb: 3 }}>
                <strong>ATTENTION :</strong> Cette opération remplace TOUTES les données actuelles. Action irréversible.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Cochez toutes les cases pour continuer :
              </Typography>
              {PRE_CHECKS_LABELS.map((label, i) => (
                <FormControlLabel
                  key={i}
                  control={
                    <Checkbox
                      checked={preChecks[i]}
                      onChange={(e) => {
                        const next = [...preChecks];
                        next[i] = e.target.checked;
                        setPreChecks(next);
                      }}
                      color="warning"
                    />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                  sx={{ display: 'flex', mb: 1 }}
                />
              ))}
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="action" fontSize="small" />
                <Chip label={restoreDialog.filename} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
              </Box>

              {userHas2FA && (
                <TextField
                  fullWidth
                  label="Code 2FA"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Code à 6 chiffres"
                  inputProps={{ style: { textAlign: 'center', fontSize: 22, letterSpacing: 6 } }}
                  sx={{ mb: 2 }}
                />
              )}

              <Alert severity="info">
                Le serveur redémarrera automatiquement après restauration. Reconnectez-vous dans 1–2 minutes.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {restorePhase === 1 ? (
            <>
              <Button onClick={() => setRestoreDialog({ open: false, filename: '' })}>Annuler</Button>
              <Button
                variant="contained"
                disabled={!allPreChecked}
                onClick={() => setRestorePhase(2)}
              >
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setRestorePhase(1)}>Retour</Button>
              <Button
                onClick={handleRestore}
                color="error"
                variant="contained"
                disabled={restoring}
                startIcon={restoring ? <CircularProgress size={18} /> : <RestoreIcon />}
              >
                Lancer la restauration
              </Button>
            </>
          )}
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
