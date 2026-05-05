import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Avatar,
  Chip, Alert, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  IconButton, Badge, Tabs, Tab, Select, MenuItem, FormControl,
  InputLabel, Divider,
} from '@mui/material';
import {
  AutoFixHigh as AutoIcon,
  CheckCircle as CheckIcon,
  Assignment as AssignIcon,
  Refresh as RefreshIcon,
  Business as BizIcon,
  AccountBalance as BankIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  SwapHoriz as ReassignIcon,
  AccessTime as TimeIcon,
  Warning as WarningIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { dispatchingApi } from '../services/api';

const ACCENT = '#5c35b5';
const REFRESH_INTERVAL = 30;

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function workloadColor(n: number) {
  if (n === 0) return '#16a34a';
  if (n <= 2) return '#1565c0';
  if (n <= 4) return '#d97706';
  return '#dc2626';
}

function urgencyColor(days: number) {
  if (days >= 5) return '#dc2626';
  if (days >= 3) return '#d97706';
  return '#16a34a';
}

function urgencyLabel(days: number) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return '1 jour';
  return `${days} jours`;
}

const ROLE_LABELS: Record<string, string> = {
  ANALYSTE_RISQUES: 'Analyste Risques',
  RESPONSABLE_RISQUES: 'Resp. Risques',
  RESPONSABLE_ENGAGEMENTS: 'Resp. Engagements',
  COMITE_CREDIT: 'Comité Crédit',
  DIRECTION_GENERALE: 'Direction Générale',
  BACK_OFFICE: 'Back Office',
  DIRECTION_JURIDIQUE: 'Direction Juridique',
  CHARGE_AFFAIRES: 'Chargé d\'Affaires',
  ADMIN: 'Admin',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

interface Agent {
  id: string; name: string; email: string; role: string;
  department?: string; jobTitle?: string;
  activeCount: number; pendingCount: number; inReviewCount: number;
  overdueCount: number; workloadScore: number;
  activeDossiers?: any[];
}

interface Application {
  id: string; applicationNumber: string; clientName: string; clientSector?: string;
  branch?: string; amount: number; currency: string; purpose: string;
  durationMonths?: number; status: string; createdAt: string; submittedAt?: string;
  daysPending: number; accountManager: string; creditType?: string;
  currentStepId?: string | null;
  currentStepRole?: string | null;
  currentStepName?: string | null;
  currentStepLabel?: string | null;
}

interface HistoryItem {
  stepId: string; applicationId: string; applicationNumber: string;
  clientName: string; amount: number; currency: string;
  status: string; appStatus: string;
  stepRole?: string; stepName?: string;
  assignedTo: { id: string; name: string; role?: string; department?: string; jobTitle?: string } | null;
  accountManager: string; branch?: string;
  assignedAt: string; deadline?: string; comments?: string;
}

interface AssignDialog {
  open: boolean;
  app: Application | HistoryItem | null;
  neededRole: string | null;
  suggestedAgent: Agent | null;
  selectedAgentId: string;
  comment: string;
  loading: boolean;
  isReassign: boolean;
}

export const DispatchingPage: React.FC = () => {
  const [agents, setAgents]           = useState<Agent[]>([]);
  const [pending, setPending]         = useState<Application[]>([]);
  const [history, setHistory]         = useState<HistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [autoLoading, setAutoLoading] = useState<Record<string, boolean>>({});
  const [tab, setTab]                 = useState(0);
  const [branchFilter, setBranchFilter] = useState('all');
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL);
  const lastReloadRef                 = useRef(Date.now());

  const [dialog, setDialog] = useState<AssignDialog>({
    open: false, app: null, neededRole: null, suggestedAgent: null,
    selectedAgentId: '', comment: '', loading: false, isReassign: false,
  });
  const [dialogError, setDialogError] = useState('');

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    setError('');
    try {
      const [wRes, pRes, hRes] = await Promise.all([
        dispatchingApi.getWorkload(),
        dispatchingApi.getPendingApplications(),
        dispatchingApi.getHistory(),
      ]);
      if (wRes.success) setAgents(wRes.data || []);
      if (pRes.success) setPending(pRes.data || []);
      if (hRes.success) setHistory(hRes.data || []);
      if (!wRes.success) setError(wRes.error || 'Erreur chargement');
      lastReloadRef.current = Date.now();
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const interval = setInterval(() => reload(true), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [reload]);

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL);
    const timer = setInterval(() => {
      setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [agents, pending]);

  const openAssignDialog = async (app: Application, isReassign = false) => {
    setAutoLoading(p => ({ ...p, [app.id]: true }));
    const suggestRes = await dispatchingApi.suggestAnalyst(app.id);
    setAutoLoading(p => ({ ...p, [app.id]: false }));
    const suggested = suggestRes.success ? suggestRes.data?.suggested : null;
    const neededRole = suggestRes.data?.neededRole ?? app.currentStepRole ?? null;
    setDialog({
      open: true, app, neededRole, suggestedAgent: suggested,
      selectedAgentId: suggested?.id || '',
      comment: '', loading: false, isReassign,
    });
  };

  const openReassignDialog = async (item: HistoryItem) => {
    setAutoLoading(p => ({ ...p, [item.applicationId]: true }));
    const suggestRes = await dispatchingApi.suggestAnalyst(item.applicationId);
    setAutoLoading(p => ({ ...p, [item.applicationId]: false }));
    const suggested = suggestRes.success ? suggestRes.data?.suggested : null;
    const neededRole = suggestRes.data?.neededRole ?? item.stepRole ?? null;
    setDialog({
      open: true,
      app: { ...item, id: item.applicationId } as any,
      neededRole,
      suggestedAgent: suggested,
      selectedAgentId: item.assignedTo?.id || suggested?.id || '',
      comment: '', loading: false, isReassign: true,
    });
  };

  const handleAssign = async () => {
    if (!dialog.app || !dialog.selectedAgentId) return;
    setDialog(d => ({ ...d, loading: true }));
    setDialogError('');
    const appId = (dialog.app as any).id || (dialog.app as any).applicationId;
    const res = await dispatchingApi.assignAnalyst(
      appId, dialog.selectedAgentId, dialog.comment, dialog.isReassign
    );
    if (res.success) {
      setSuccess(res.data?.message || (dialog.isReassign ? 'Ré-affectation validée' : 'Affectation validée'));
      if (!dialog.isReassign) {
        setPending(prev => prev.filter(p => p.id !== appId));
      }
      setDialog(d => ({ ...d, open: false, loading: false }));
      setDialogError('');
      reload(true);
    } else {
      setDialog(d => ({ ...d, loading: false }));
      setDialogError(res.error || 'Erreur affectation');
    }
  };

  const branches = ['all', ...Array.from(new Set(pending.map(p => p.branch).filter(Boolean) as string[]))];
  const filteredPending = branchFilter === 'all'
    ? pending
    : pending.filter(p => p.branch === branchFilter);

  // Agents filtrés par le rôle nécessaire dans la dialog
  const dialogAgents = dialog.neededRole
    ? agents.filter(a => a.role === dialog.neededRole)
    : agents;

  const totalActive = agents.reduce((s, a) => s + a.activeCount, 0);
  const avgLoad = agents.length ? (totalActive / agents.length) : 0;
  const overdueTotal = agents.reduce((s, a) => s + a.overdueCount, 0);
  const todayHistory = history.filter(h => {
    const d = new Date(h.assignedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return (
    <Box sx={{ bgcolor: '#f7f8fc', minHeight: '100vh', pb: 6 }}>

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${ACCENT} 0%, #1565c0 100%)`,
        color: 'white', px: { xs: 2, md: 4 }, pt: 3, pb: 2.5,
        borderRadius: '0 0 20px 20px',
        boxShadow: '0 4px 24px rgba(92,53,181,0.18)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Affectation de Dossiers</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.3 }}>
              Affectation intelligente par charge de travail — Responsable Analyste
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11 }}>
              ↻ {countdown}s
            </Typography>
            <Tooltip title="Actualiser maintenant">
              <IconButton onClick={() => reload()} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                {loadingData ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* KPI bar */}
        <Grid container spacing={1.5}>
          {[
            { label: 'À affecter', value: pending.length, icon: <AssignIcon sx={{ fontSize: 18 }} />, color: pending.length > 0 ? '#ffd740' : '#69f0ae' },
            { label: 'Responsables actifs', value: agents.length, icon: <PersonIcon sx={{ fontSize: 18 }} />, color: '#fff' },
            { label: 'Dossiers actifs', value: totalActive, icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, color: '#fff' },
            { label: 'Moy. / responsable', value: avgLoad.toFixed(1), icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, color: avgLoad > 4 ? '#ffd740' : '#fff' },
            { label: 'Affectés auj.', value: todayHistory.length, icon: <CheckIcon sx={{ fontSize: 18 }} />, color: '#69f0ae' },
            { label: 'En retard', value: overdueTotal, icon: <WarningIcon sx={{ fontSize: 18 }} />, color: overdueTotal > 0 ? '#ff5252' : '#69f0ae' },
          ].map(k => (
            <Grid item xs={4} sm={2} key={k.label}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, px: 1.5, py: 1, textAlign: 'center' }}>
                <Box sx={{ color: k.color, mb: 0.25 }}>{k.icon}</Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: k.color, lineHeight: 1 }}>{k.value}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 10 }}>{k.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, mt: 3 }}>
        {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert>}

        {loadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
        ) : (
          <Grid container spacing={2}>

            {/* ── Colonne gauche : charge des responsables ── */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16 }} />
                Responsables ({agents.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {agents.map((a, idx) => (
                  <Card key={a.id} variant="outlined" sx={{
                    borderRadius: 2,
                    borderLeft: `3px solid ${workloadColor(a.workloadScore)}`,
                    transition: 'box-shadow .2s',
                    '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }
                  }}>
                    <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Badge
                          badgeContent={idx === 0 ? '★' : undefined}
                          sx={{ '& .MuiBadge-badge': { bgcolor: '#ffd740', color: '#000', fontSize: 9, minWidth: 14, height: 14 } }}
                        >
                          <Avatar sx={{ width: 28, height: 28, bgcolor: workloadColor(a.workloadScore), color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </Avatar>
                        </Badge>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" fontWeight={700} noWrap display="block">{a.name}</Typography>
                          <Typography sx={{ fontSize: 10 }} color="text.secondary" noWrap>{a.jobTitle || roleLabel(a.role) || a.department}</Typography>
                        </Box>
                        <Chip
                          label={`${a.activeCount}`}
                          size="small"
                          sx={{ bgcolor: workloadColor(a.workloadScore), color: '#fff', fontWeight: 700, minWidth: 26, height: 20, fontSize: 11 }}
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((a.activeCount / 6) * 100, 100)}
                        sx={{
                          height: 3, borderRadius: 2, bgcolor: '#f1f5f9',
                          '& .MuiLinearProgress-bar': { bgcolor: workloadColor(a.workloadScore), borderRadius: 2 }
                        }}
                      />
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">{a.pendingCount} att.</Typography>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">·</Typography>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">{a.inReviewCount} cours</Typography>
                        {a.overdueCount > 0 && (
                          <Typography sx={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>· {a.overdueCount} retard</Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                {agents.length === 0 && (
                  <Alert severity="info" sx={{ borderRadius: 2, fontSize: '0.78rem' }}>Aucun responsable actif trouvé</Alert>
                )}
              </Box>
            </Grid>

            {/* ── Colonne droite : dossiers + historique ── */}
            <Grid item xs={12} md={9}>
              <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 2 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
                  '& .MuiTab-root': { fontWeight: 700, fontSize: '0.8rem', textTransform: 'none', minHeight: 40 },
                  '& .MuiTabs-indicator': { bgcolor: ACCENT }
                }}>
                  <Tab label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <AssignIcon sx={{ fontSize: 15 }} />
                      À affecter
                      {filteredPending.length > 0 && (
                        <Chip label={filteredPending.length} size="small"
                          sx={{ bgcolor: ACCENT, color: '#fff', fontWeight: 800, height: 18, fontSize: 10, ml: 0.5 }} />
                      )}
                    </Box>
                  } />
                  <Tab label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <HistoryIcon sx={{ fontSize: 15 }} />
                      Historique
                      {history.length > 0 && (
                        <Chip label={history.length} size="small"
                          sx={{ bgcolor: '#64748b', color: '#fff', fontWeight: 800, height: 18, fontSize: 10, ml: 0.5 }} />
                      )}
                    </Box>
                  } />
                </Tabs>
              </Box>

              {/* ── Tab 0 : À affecter ── */}
              {tab === 0 && (
                <>
                  {branches.length > 2 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <FilterIcon sx={{ fontSize: 16, color: '#64748b' }} />
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Filtrer par agence</InputLabel>
                        <Select value={branchFilter} label="Filtrer par agence" onChange={e => setBranchFilter(e.target.value)}>
                          <MenuItem value="all">Toutes les agences</MenuItem>
                          {branches.filter(b => b !== 'all').map(b => (
                            <MenuItem key={b} value={b}>{b}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  {filteredPending.length === 0 ? (
                    <Card variant="outlined" sx={{ borderRadius: 2.5, textAlign: 'center', py: 7 }}>
                      <CheckIcon sx={{ fontSize: 44, color: '#16a34a', mb: 1 }} />
                      <Typography variant="h6" fontWeight={700} color="#16a34a">Tous les dossiers sont affectés</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Aucun dossier en attente d'affectation.</Typography>
                    </Card>
                  ) : (
                    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                      <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 580 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Dossier</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b' }}>Client</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Montant</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Étape requise</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Ancienneté</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }} align="right">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredPending.map(app => (
                            <TableRow key={app.id} sx={{ '&:hover td': { bgcolor: '#f8fafc' } }}>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT }}>{app.applicationNumber}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
                                  {app.creditType || app.accountManager}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                  <BizIcon sx={{ fontSize: 13, color: '#94a3b8', mt: 0.2, flexShrink: 0 }} />
                                  <Box>
                                    <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ maxWidth: 160 }}>{app.clientName}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160, fontSize: 10 }}>
                                      {app.clientSector || app.branch || ''}
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="caption" fontWeight={700}>{fmtAmount(app.amount, app.currency)}</Typography>
                                {app.durationMonths && (
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>{app.durationMonths} mois</Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {app.currentStepRole ? (
                                  <Chip
                                    label={app.currentStepLabel || roleLabel(app.currentStepRole)}
                                    size="small"
                                    sx={{ bgcolor: ACCENT + '14', color: ACCENT, fontWeight: 700, fontSize: 10, height: 20 }}
                                  />
                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Chip
                                  label={urgencyLabel(app.daysPending)}
                                  size="small"
                                  icon={app.daysPending >= 3 ? <WarningIcon sx={{ fontSize: '12px !important' }} /> : <TimeIcon sx={{ fontSize: '12px !important' }} />}
                                  sx={{
                                    bgcolor: urgencyColor(app.daysPending) + '18',
                                    color: urgencyColor(app.daysPending),
                                    fontWeight: 700, fontSize: 10, height: 20,
                                    border: `1px solid ${urgencyColor(app.daysPending)}30`
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={autoLoading[app.id] ? <CircularProgress size={11} color="inherit" /> : <AutoIcon sx={{ fontSize: 13 }} />}
                                  onClick={() => openAssignDialog(app)}
                                  disabled={!!autoLoading[app.id] || agents.length === 0}
                                  sx={{
                                    fontSize: '0.72rem', px: 2, borderRadius: 1.5, minWidth: 90,
                                    bgcolor: ACCENT, '&:hover': { bgcolor: '#4527a0' },
                                    textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap'
                                  }}
                                >
                                  Affecter
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </Box>
                    </Paper>
                  )}
                </>
              )}

              {/* ── Tab 1 : Historique ── */}
              {tab === 1 && (
                <>
                  {history.length === 0 ? (
                    <Card variant="outlined" sx={{ borderRadius: 2.5, textAlign: 'center', py: 7 }}>
                      <HistoryIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                      <Typography variant="h6" fontWeight={700} color="text.secondary">Aucun historique</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Les affectations apparaîtront ici.</Typography>
                    </Card>
                  ) : (
                    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                      <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 520 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Dossier</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b' }}>Client</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Montant</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b' }}>Responsable affecté</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>Statut / Date</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {history.map(item => (
                            <TableRow key={item.stepId} sx={{ '&:hover td': { bgcolor: '#f8fafc' } }}>
                              <TableCell>
                                <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT }}>{item.applicationNumber}</Typography>
                                {item.stepRole && (
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>{roleLabel(item.stepRole)}</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ maxWidth: 120 }}>{item.clientName}</Typography>
                                {item.branch && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{item.branch}</Typography>}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" fontWeight={700}>{fmtAmount(item.amount, item.currency)}</Typography>
                              </TableCell>
                              <TableCell>
                                {item.assignedTo ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Avatar sx={{ width: 24, height: 24, bgcolor: '#e2e8f0', color: '#475569', fontSize: '0.65rem', fontWeight: 700 }}>
                                      {item.assignedTo.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </Avatar>
                                    <Box>
                                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 100 }}>{item.assignedTo.name}</Typography>
                                      {item.assignedTo.role && (
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>{roleLabel(item.assignedTo.role)}</Typography>
                                      )}
                                    </Box>
                                  </Box>
                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Chip
                                  label={item.appStatus === 'APPROVED' ? 'Approuvé' : item.appStatus === 'REJECTED' ? 'Refusé' : item.appStatus === 'UNDER_REVIEW' ? 'En cours' : item.appStatus}
                                  size="small"
                                  color={item.appStatus === 'APPROVED' ? 'success' : item.appStatus === 'REJECTED' ? 'error' : 'default'}
                                  sx={{ fontSize: 10, height: 20, fontWeight: 700 }}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10, mt: 0.25 }}>
                                  {new Date(item.assignedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Ré-affecter">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={!!autoLoading[item.applicationId] || agents.length === 0}
                                      onClick={() => openReassignDialog(item)}
                                      sx={{ color: ACCENT, '&:hover': { bgcolor: ACCENT + '12' } }}
                                    >
                                      {autoLoading[item.applicationId]
                                        ? <CircularProgress size={14} />
                                        : <ReassignIcon sx={{ fontSize: 16 }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </Box>
                    </Paper>
                  )}
                </>
              )}
            </Grid>
          </Grid>
        )}
      </Box>

      {/* ── Dialog d'affectation / ré-affectation ─────────────── */}
      <Dialog open={dialog.open} onClose={() => { setDialog(d => ({ ...d, open: false })); setDialogError(''); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, pb: 1 }}>
          {dialog.isReassign ? <ReassignIcon sx={{ color: '#d97706' }} /> : <AssignIcon sx={{ color: ACCENT }} />}
          {dialog.isReassign ? 'Ré-affecter le dossier' : 'Affecter le dossier'}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setDialog(d => ({ ...d, open: false }))}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {/* Info dossier */}
          {dialog.app && (
            <Box sx={{ mb: 2, p: 1.75, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <BankIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography variant="body2" fontWeight={800} sx={{ color: ACCENT }}>
                  {(dialog.app as any).applicationNumber}
                </Typography>
                {'daysPending' in dialog.app && dialog.app.daysPending >= 3 && (
                  <Chip label={`${dialog.app.daysPending}j d'attente`} size="small"
                    sx={{ bgcolor: urgencyColor(dialog.app.daysPending) + '18', color: urgencyColor(dialog.app.daysPending), fontWeight: 700, fontSize: 10, height: 18 }} />
                )}
              </Box>
              <Typography variant="body2" fontWeight={600}>{(dialog.app as any).clientName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {fmtAmount((dialog.app as any).amount, (dialog.app as any).currency)}
                {(dialog.app as any).purpose ? ` · ${(dialog.app as any).purpose}` : ''}
                {(dialog.app as any).durationMonths ? ` · ${(dialog.app as any).durationMonths} mois` : ''}
              </Typography>
              {dialog.neededRole && (
                <Box sx={{ mt: 0.75 }}>
                  <Chip
                    label={`Étape : ${roleLabel(dialog.neededRole)}`}
                    size="small"
                    sx={{ bgcolor: ACCENT + '14', color: ACCENT, fontWeight: 700, fontSize: 10, height: 20 }}
                  />
                </Box>
              )}
              {dialog.isReassign && (dialog.app as any).assignedTo && (
                <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Actuellement affecté à :</Typography>
                  <Typography variant="caption" fontWeight={700}>{(dialog.app as any).assignedTo?.name}</Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Suggestion auto */}
          {dialog.suggestedAgent && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <AutoIcon sx={{ fontSize: 14, color: '#1565c0' }} />
                <Typography variant="caption" fontWeight={700} color="#1565c0">Suggestion automatique — charge minimale</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 26, height: 26, bgcolor: workloadColor(dialog.suggestedAgent.workloadScore), color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>
                  {dialog.suggestedAgent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{dialog.suggestedAgent.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{dialog.suggestedAgent.activeCount} dossier(s) actif(s)</Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Choisir le responsable
            {dialog.neededRole ? ` — ${roleLabel(dialog.neededRole)}` : ''} :
          </Typography>

          {dialogError && (
            <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.78rem', borderRadius: 2 }} onClose={() => setDialogError('')}>
              {dialogError}
            </Alert>
          )}

          {dialogAgents.length === 0 && dialog.neededRole && (
            <Alert severity="warning" sx={{ mb: 1.5, fontSize: '0.78rem', borderRadius: 2 }}>
              Aucun responsable actif avec le rôle «{roleLabel(dialog.neededRole)}» trouvé.
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2, maxHeight: 280, overflowY: 'auto' }}>
            {dialogAgents.map(a => (
              <Box
                key={a.id}
                onClick={() => setDialog(d => ({ ...d, selectedAgentId: a.id }))}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  p: 1.25, borderRadius: 2, cursor: 'pointer',
                  border: '2px solid',
                  borderColor: dialog.selectedAgentId === a.id ? ACCENT : '#e2e8f0',
                  bgcolor: dialog.selectedAgentId === a.id ? ACCENT + '08' : 'transparent',
                  transition: 'all .15s',
                  '&:hover': { borderColor: ACCENT, bgcolor: ACCENT + '05' }
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: workloadColor(a.workloadScore), color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
                  {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{a.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{a.jobTitle || a.department || roleLabel(a.role)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
                  <Chip label={`${a.activeCount} actif${a.activeCount !== 1 ? 's' : ''}`} size="small"
                    sx={{ bgcolor: workloadColor(a.workloadScore), color: '#fff', fontWeight: 700, fontSize: 10, height: 18 }} />
                  {a.overdueCount > 0 && (
                    <Typography variant="caption" sx={{ color: '#dc2626', fontSize: 10 }}>{a.overdueCount} en retard</Typography>
                  )}
                </Box>
                {dialog.selectedAgentId === a.id && <CheckIcon sx={{ color: ACCENT, fontSize: 18, flexShrink: 0 }} />}
              </Box>
            ))}
          </Box>

          <TextField
            fullWidth size="small"
            label="Commentaire (optionnel)"
            placeholder={dialog.isReassign ? 'Motif de la ré-affectation...' : "Motif de l'affectation..."}
            value={dialog.comment}
            onChange={e => setDialog(d => ({ ...d, comment: e.target.value }))}
            multiline rows={2}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialog(d => ({ ...d, open: false }))} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!dialog.selectedAgentId || dialog.loading}
            startIcon={dialog.loading ? <CircularProgress size={14} color="inherit" /> : (dialog.isReassign ? <ReassignIcon /> : <CheckIcon />)}
            sx={{
              borderRadius: 2,
              bgcolor: dialog.isReassign ? '#d97706' : ACCENT,
              '&:hover': { bgcolor: dialog.isReassign ? '#b45309' : '#4527a0' },
              textTransform: 'none', fontWeight: 700, px: 3
            }}
          >
            {dialog.loading ? 'En cours...' : (dialog.isReassign ? 'Valider la ré-affectation' : "Valider l'affectation")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DispatchingPage;
