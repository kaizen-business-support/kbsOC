import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, Button, CircularProgress,
  Alert, IconButton, Select, MenuItem, FormControl, InputLabel,
  Badge, Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FolderSpecial as DossierIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Gavel as LegalIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { DossierActionDrawer } from '../components/DossierActionDrawer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30;

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(v);
}

function SlaChip({ item }: { item: ApprovalItem }) {
  if (item.isOverdue) return <Chip label="En retard" color="error" size="small" />;
  if (item.deadline) {
    const hoursLeft = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < 24) return <Chip label="< 24h" color="warning" size="small" />;
  }
  return <Chip label="Dans les délais" color="success" size="small" variant="outlined" />;
}

const STEP_TYPE_LABEL: Record<string, string> = {
  CREATION:  'Création',
  DISPATCH:  'Dispatching',
  ANALYSIS:  'Analyse',
  APPROVAL:  'Approbation',
  COMMITTEE: 'Comité',
  LEGAL:     'Juridique',
};

const STEP_TYPE_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary'> = {
  CREATION:  'default',
  DISPATCH:  'info',
  ANALYSIS:  'primary',
  APPROVAL:  'warning',
  COMMITTEE: 'warning',
  LEGAL:     'secondary',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems]               = useState<ApprovalItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState(0);
  const [branchFilter, setBranchFilter] = useState('all');
  const [countdown, setCountdown]       = useState(REFRESH_INTERVAL);
  const [drawer, setDrawer]             = useState<ApprovalItem | null>(null);
  const lastReloadRef                   = useRef(Date.now());

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await ApiService.getPendingApprovals();
      if (res.success) setItems(res.data || []);
      else setError(res.error || 'Erreur chargement');
      lastReloadRef.current = Date.now();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Rafraîchissement automatique
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastReloadRef.current) / 1000);
      const remaining = REFRESH_INTERVAL - elapsed;
      if (remaining <= 0) {
        reload(true);
        setCountdown(REFRESH_INTERVAL);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [reload]);

  const branches = Array.from(
    new Set(items.map(i => i.branch).filter(Boolean) as string[])
  ).sort();

  // Compteurs par type d'étape
  const countByType = (type: string) => items.filter(i => i.stepType === type).length;

  const filtered = items.filter(item => {
    const matchBranch = branchFilter === 'all' || item.branch === branchFilter;
    const matchTab =
      tab === 0 ||
      (tab === 1 && item.stepType === 'ANALYSIS') ||
      (tab === 2 && ['APPROVAL', 'COMMITTEE'].includes(item.stepType)) ||
      (tab === 3 && item.stepType === 'LEGAL') ||
      (tab === 4 && item.stepType === 'DISPATCH');
    return matchBranch && matchTab;
  });

  const handleSuccess = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const openDrawer = (item: ApprovalItem) => {
    if (item.stepType === 'LEGAL') {
      navigate(`/legal-step/${item.applicationId}`);
    } else {
      setDrawer(item);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* ── En-tête ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <DossierIcon sx={{ fontSize: 32, color: '#5c35b5' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Mes Dossiers</Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} dossier{items.length !== 1 ? 's' : ''} en attente de traitement
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{countdown}s</Typography>
          <Tooltip title="Rafraîchir">
            <IconButton size="small" onClick={() => reload()} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Filtre agence ── */}
      {branches.length > 0 && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
          <InputLabel>Agence</InputLabel>
          <Select value={branchFilter} label="Agence" onChange={e => setBranchFilter(e.target.value)}>
            <MenuItem value="all">Toutes les agences</MenuItem>
            {branches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      {/* ── Onglets par type d'étape ── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label={<Badge badgeContent={items.length} color="primary" max={99}><Box sx={{ pr: 1 }}>Tout</Box></Badge>} />
        <Tab label={<Badge badgeContent={countByType('ANALYSIS')} color="info" max={99}><Box sx={{ pr: 1 }}>Analyse</Box></Badge>} />
        <Tab label={<Badge badgeContent={countByType('APPROVAL') + countByType('COMMITTEE')} color="warning" max={99}><Box sx={{ pr: 1 }}>Approbation</Box></Badge>} />
        <Tab label={<Badge badgeContent={countByType('LEGAL')} color="secondary" max={99}><Box sx={{ pr: 1 }}>Juridique</Box></Badge>} />
        <Tab label={<Badge badgeContent={countByType('DISPATCH')} color="default" max={99}><Box sx={{ pr: 1 }}>Dispatching</Box></Badge>} />
      </Tabs>

      {/* ── Tableau ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <DossierIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Aucun dossier en attente</Typography>
        </Box>
      ) : (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }} elevation={0} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f8f8' }}>
                <TableCell><strong>N° dossier</strong></TableCell>
                <TableCell><strong>Client</strong></TableCell>
                <TableCell><strong>Étape</strong></TableCell>
                <TableCell align="right"><strong>Montant</strong></TableCell>
                <TableCell><strong>Type crédit</strong></TableCell>
                <TableCell><strong>Agence</strong></TableCell>
                <TableCell align="center"><strong>Attente</strong></TableCell>
                <TableCell align="center"><strong>SLA</strong></TableCell>
                <TableCell align="center"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(item => (
                <TableRow
                  key={item.id}
                  sx={{
                    bgcolor: item.isOverdue ? 'rgba(220,38,38,0.03)' : 'white',
                    '&:hover': { bgcolor: 'rgba(92,53,181,0.04)', cursor: 'pointer' },
                  }}
                  onClick={() => openDrawer(item)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {item.applicationNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.clientName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Chip
                        label={STEP_TYPE_LABEL[item.stepType] ?? item.stepType}
                        color={STEP_TYPE_COLOR[item.stepType] ?? 'default'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 20 }}
                      />
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                        {item.stepLabel}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {fmtAmount(item.amount, item.currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.creditType ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.branch ?? '—'}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      {item.isOverdue && <WarningIcon sx={{ fontSize: 14, color: '#dc2626' }} />}
                      <Typography variant="body2" color={item.daysWaiting > 5 ? 'error.main' : 'text.primary'}>
                        {item.daysWaiting}j
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center" onClick={e => e.stopPropagation()}>
                    <SlaChip item={item} />
                  </TableCell>
                  <TableCell align="center" onClick={e => e.stopPropagation()}>
                    {item.stepType === 'LEGAL' ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<LegalIcon sx={{ fontSize: 14 }} />}
                        onClick={() => navigate(`/legal-step/${item.applicationId}`)}
                        sx={{
                          borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          textTransform: 'none', bgcolor: '#7e22ce', boxShadow: 'none',
                          '&:hover': { bgcolor: '#6b21a8', boxShadow: 'none' },
                        }}
                      >
                        Traiter
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => openDrawer(item)}
                        sx={{
                          borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          textTransform: 'none', bgcolor: '#5c35b5', boxShadow: 'none',
                          '&:hover': { bgcolor: '#4a2a9e', boxShadow: 'none' },
                        }}
                      >
                        Traiter
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Drawer de traitement ── */}
      <DossierActionDrawer
        item={drawer}
        open={!!drawer}
        onClose={() => setDrawer(null)}
        onSuccess={handleSuccess}
      />
    </Box>
  );
};

export default ApprovalsPage;
