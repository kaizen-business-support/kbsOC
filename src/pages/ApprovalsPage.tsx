import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, Button, CircularProgress,
  Alert, IconButton, Select, MenuItem, FormControl, InputLabel,
  Badge, Tooltip, Avatar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FolderSpecial as DossierIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Gavel as LegalIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HelpOutline as InfoIcon,
  SwapHoriz as TransferIcon,
  Assessment as AnalysisIcon,
  History as HistoryIcon,
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

interface TreatedItem {
  item: ApprovalItem;
  decision: string;
  comment: string;
  treatedAt: Date;
}

function decisionChip(decision: string) {
  if (decision === 'Approuver' || decision === 'Analyse validée') {
    return <Chip icon={<ApprovedIcon sx={{ fontSize: '14px !important' }} />} label={decision} color="success" size="small" sx={{ fontWeight: 700 }} />;
  }
  if (decision === 'Rejeter') {
    return <Chip icon={<RejectedIcon sx={{ fontSize: '14px !important' }} />} label="Rejeté" color="error" size="small" sx={{ fontWeight: 700 }} />;
  }
  if (decision === 'Demander des infos') {
    return <Chip icon={<InfoIcon sx={{ fontSize: '14px !important' }} />} label="Infos demandées" color="warning" size="small" sx={{ fontWeight: 700 }} />;
  }
  if (decision === 'Transférer') {
    return <Chip icon={<TransferIcon sx={{ fontSize: '14px !important' }} />} label="Transféré" color="info" size="small" sx={{ fontWeight: 700 }} />;
  }
  return <Chip label={decision} size="small" sx={{ fontWeight: 700 }} />;
}

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

  // IDs traités dans cette session — ref pour éviter les fermetures rassis dans reload
  const treatedIdsRef                    = useRef<Set<string>>(new Set());
  const [localTreated, setLocalTreated]  = useState<TreatedItem[]>([]);

  // reload n'a aucune dépendance variable : il lit treatedIdsRef.current
  // directement, donc il ne change jamais de référence → pas de boucle infinie
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await ApiService.getPendingApprovals();
      if (res.success) {
        const fresh: ApprovalItem[] = res.data || [];
        setItems(fresh.filter(i => !treatedIdsRef.current.has(i.id)));
      } else {
        setError(res.error || 'Erreur chargement');
      }
      lastReloadRef.current = Date.now();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);

  // Ouvrir automatiquement un dossier si la notification a stocké un applicationId
  useEffect(() => {
    const pendingAppId = localStorage.getItem('pending_workflow_app');
    if (!pendingAppId) return;
    localStorage.removeItem('pending_workflow_app');
    const tryOpen = (retries = 0) => {
      const found = items.find(i => i.applicationId === pendingAppId);
      if (found) {
        if (found.stepType === 'LEGAL') {
          navigate(`/legal-step/${found.applicationId}`);
        } else {
          setDrawer(found);
        }
      } else if (retries < 12) {
        setTimeout(() => tryOpen(retries + 1), 300);
      }
    };
    tryOpen();
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSuccess = (itemId: string, decision = '', comment = '') => {
    // Marquer immédiatement dans le ref — reload() lira toujours la valeur à jour
    treatedIdsRef.current.add(itemId);

    // Capturer les données complètes pour l'onglet "Traités" (meilleur effort)
    setItems(prev => {
      const treated = prev.find(i => i.id === itemId);
      if (treated) {
        setLocalTreated(lt => [{ item: treated, decision, comment, treatedAt: new Date() }, ...lt]);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const openDrawer = (item: ApprovalItem) => {
    if (item.stepType === 'LEGAL') {
      navigate(`/legal-step/${item.applicationId}`);
    } else {
      setDrawer(item);
    }
  };

  const isOnTreatedTab = tab === 5;

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
      {branches.length > 0 && !isOnTreatedTab && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
          <InputLabel>Agence</InputLabel>
          <Select value={branchFilter} label="Agence" onChange={e => setBranchFilter(e.target.value)}>
            <MenuItem value="all">Toutes les agences</MenuItem>
            {branches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      {/* ── Onglets ── */}
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
        <Tab label={
          <Badge badgeContent={localTreated.length} color="success" max={99}>
            <Box sx={{ pr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HistoryIcon sx={{ fontSize: 14 }} />
              Traités
            </Box>
          </Badge>
        } />
      </Tabs>

      {/* ── Tab Traités ── */}
      {isOnTreatedTab ? (
        localTreated.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">Aucun dossier traité dans cette session</Typography>
          </Box>
        ) : (
          <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f0fdf4' }}>
                  <TableCell><strong>N° dossier</strong></TableCell>
                  <TableCell><strong>Client</strong></TableCell>
                  <TableCell><strong>Étape traitée</strong></TableCell>
                  <TableCell align="right"><strong>Montant</strong></TableCell>
                  <TableCell><strong>Décision</strong></TableCell>
                  <TableCell><strong>Commentaire</strong></TableCell>
                  <TableCell align="center"><strong>Traité à</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {localTreated.map((t, idx) => (
                  <TableRow key={`${t.item.id}-${idx}`} sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#f0fdf4' } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {t.item.applicationNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t.item.branch ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{t.item.clientName}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.item.creditType ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Chip
                          label={STEP_TYPE_LABEL[t.item.stepType] ?? t.item.stepType}
                          color={STEP_TYPE_COLOR[t.item.stepType] ?? 'default'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 11, height: 20 }}
                        />
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                          {t.item.stepLabel}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {fmtAmount(t.item.amount, t.item.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>{decisionChip(t.decision)}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      {t.comment ? (
                        <Typography variant="caption" color="text.secondary" sx={{
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {t.comment}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" color="text.secondary">
                        {t.treatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )
      ) : (
        /* ── Tableau En attente ── */
        loading ? (
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
        )
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
