import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, Button, CircularProgress,
  Alert, IconButton, TextField, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, LinearProgress, Avatar, Tooltip,
  TablePagination, Divider,
} from '@mui/material';
import {
  FolderSpecial as MyDocsIcon,
  HourglassTop as InProgressIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Business as BizIcon,
  OpenInNew as OpenIcon,
  TrendingUp as TrendingIcon,
  AccountBalance as BankIcon,
  Warning as WarningIcon,
  BeachAccess as DelegationIcon,
  FilterList as FilterIcon,
  MonetizationOn as MoneyIcon,
  CheckCircleOutline as DoneIcon,
  CancelOutlined as RejectOutIcon,
  PendingActions as PendingIcon,
  Payments as DisbursedIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { WorkflowTimestamps } from '../types';
import { WorkflowDetailsDialog } from '../components/WorkflowDetailsDialog';
import { ApiService } from '../services/api';
import { PowerDelegation } from '../types/delegation';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACCENT = '#5c35b5';

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(v);
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(ms?: number) {
  if (!ms) return '—';
  const days = Math.ceil(ms / 86_400_000);
  return `${days} j`;
}

const STATUS_CFG: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error'; bg: string }> = {
  draft:        { label: 'Brouillon',   color: 'default',  bg: '#f3f4f6' },
  submitted:    { label: 'Soumise',     color: 'info',     bg: '#eff6ff' },
  under_review: { label: 'En analyse',  color: 'warning',  bg: '#fffbeb' },
  approved:     { label: 'Approuvée',   color: 'success',  bg: '#f0fdf4' },
  rejected:     { label: 'Rejetée',     color: 'error',    bg: '#fef2f2' },
  disbursed:    { label: 'Débloquée',   color: 'success',  bg: '#ecfdf5' },
  DRAFT:        { label: 'Brouillon',   color: 'default',  bg: '#f3f4f6' },
  SUBMITTED:    { label: 'Soumise',     color: 'info',     bg: '#eff6ff' },
  UNDER_REVIEW: { label: 'En analyse',  color: 'warning',  bg: '#fffbeb' },
  APPROVED:     { label: 'Approuvée',   color: 'success',  bg: '#f0fdf4' },
  REJECTED:     { label: 'Rejetée',     color: 'error',    bg: '#fef2f2' },
  DISBURSED:    { label: 'Débloquée',   color: 'success',  bg: '#ecfdf5' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: 'default' as const, bg: '#f3f4f6' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      sx={{ fontWeight: 600, fontSize: 11, borderRadius: '6px' }}
    />
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  active?: boolean;
  onClick?: () => void;
}

function KpiCard({ label, value, icon, color, bg, active, onClick }: KpiCardProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1, minWidth: 130, px: 2.5, py: 2, borderRadius: 3,
        bgcolor: active ? color : bg,
        border: `1.5px solid ${active ? color : 'transparent'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .18s',
        '&:hover': onClick ? { boxShadow: `0 4px 16px ${color}33`, transform: 'translateY(-1px)' } : {},
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}
    >
      <Box sx={{
        width: 40, height: 40, borderRadius: 2,
        bgcolor: active ? 'rgba(255,255,255,0.25)' : `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {React.cloneElement(icon as any, { sx: { fontSize: 20, color: active ? '#fff' : color } })}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ color: active ? '#fff' : color, lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: active ? 'rgba(255,255,255,0.85)' : '#6b7280', fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface WorkflowPageProps {
  onNavigate: (page: any) => void;
}

const ROWS_PER_PAGE = 10;

export const WorkflowPage: React.FC<WorkflowPageProps> = ({ onNavigate }) => {
  const { state: userState } = useUser();
  const currentUser = userState.currentUser;

  const [activeTab, setActiveTab]           = useState(0);
  const [applications, setApplications]     = useState<any[]>([]);
  const [workflows, setWorkflows]           = useState<WorkflowTimestamps[]>([]);
  const [loading, setLoading]               = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTimestamps | null>(null);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [search, setSearch]                 = useState('');
  const [filterStatus, setFilterStatus]     = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');
  const [page, setPage]                     = useState(0);
  const [delegation, setDelegation]         = useState<PowerDelegation | null>(null);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appRes, wfRes] = await Promise.all([
        ApiService.getApplications({
          status: filterStatus !== 'all' ? filterStatus : undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
        }),
        ApiService.getWorkflows({}),
      ]);
      if (appRes.success) setApplications(appRes.data || []);
      if (wfRes.success) setWorkflows(wfRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!currentUser?.id) return;
    ApiService.getMyDelegations().then((res: any) => {
      if (!res.success) return;
      const now = new Date();
      const active = (res.data || []).find((d: PowerDelegation) =>
        d.delegateId === currentUser.id && d.isActive &&
        new Date(d.startDate) <= now && new Date(d.endDate) >= now
      );
      setDelegation(active || null);
    }).catch(() => {});
  }, [currentUser?.id]);

  // ── Données filtrées ────────────────────────────────────────────────────────
  const filtered = applications.filter(app => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      (app.clientName || '').toLowerCase().includes(s) ||
      (app.applicationNumber || '').toLowerCase().includes(s) ||
      (app.accountManager || '').toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || app.status === filterStatus || app.status === filterStatus.toUpperCase();
    const appDate = app.createdAt ? new Date(app.createdAt) : null;
    const matchFrom = !filterDateFrom || !appDate || appDate >= new Date(filterDateFrom);
    const matchTo   = !filterDateTo   || !appDate || appDate <= new Date(filterDateTo);
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const myDossiers = applications.filter(a =>
    a.createdBy === currentUser?.id || a.accountManagerId === currentUser?.id
  );
  const inProgress = applications.filter(a =>
    ['under_review', 'submitted', 'UNDER_REVIEW', 'SUBMITTED'].includes(a.status)
  );
  const approved = applications.filter(a => ['approved', 'disbursed', 'APPROVED', 'DISBURSED'].includes(a.status));
  const rejected = applications.filter(a => ['rejected', 'REJECTED'].includes(a.status));

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total',      value: applications.length, icon: <BankIcon />,      color: ACCENT,     bg: '#f5f3ff' },
    { label: 'En cours',   value: inProgress.length,   icon: <PendingIcon />,   color: '#d97706',  bg: '#fffbeb' },
    { label: 'Approuvés',  value: approved.length,     icon: <DoneIcon />,      color: '#16a34a',  bg: '#f0fdf4' },
    { label: 'Rejetés',    value: rejected.length,     icon: <RejectOutIcon />, color: '#dc2626',  bg: '#fef2f2' },
  ];

  // ── Ouvrir détails ──────────────────────────────────────────────────────────
  const openDetails = (app: any) => {
    // Chercher d'abord dans les workflows chargés (données enrichies)
    const wf = workflows.find(w => w.applicationId === app.id);
    if (wf) {
      setSelectedWorkflow(wf);
      setDialogOpen(true);
      return;
    }
    // Fallback : certains dossiers sont filtrés par rôle dans /workflows mais
    // visibles dans /applications — construire WorkflowTimestamps depuis app
    const statusMap: Record<string, WorkflowTimestamps['status']> = {
      approved: 'approved', APPROVED: 'approved',
      disbursed: 'approved', DISBURSED: 'approved',
      rejected: 'rejected', REJECTED: 'rejected',
    };
    const fallback: WorkflowTimestamps = {
      applicationId:   app.id,
      clientId:        app.clientId || '',
      clientName:      app.clientName || '',
      applicationNumber: app.applicationNumber || app.id?.slice(0, 8).toUpperCase(),
      requestedAmount: app.amount || 0,
      currency:        app.currency || 'XOF',
      totalStartedAt:  app.createdAt,
      totalCompletedAt: statusMap[app.status] ? app.updatedAt : undefined,
      currentStepId:   (app.workflowSteps || []).find((s: any) => !s.completedAt)?.stepName || 'final_decision',
      finalDecision:   app.status === 'approved' || app.status === 'APPROVED' ? 'approved'
                     : app.status === 'rejected' || app.status === 'REJECTED' ? 'rejected'
                     : undefined,
      steps: (app.workflowSteps || []).map((s: any) => ({
        stepId:    s.stepName,
        stepName:  s.stepName,
        startedAt: s.createdAt,
        completedAt: s.completedAt,
        duration:  s.completedAt
          ? new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime()
          : undefined,
        userId:    s.assigneeId,
        userName:  s.assignee?.name,
        userRole:  s.assignee?.role || s.role,
        branch:    '',
        decision:  s.status === 'APPROVED' ? 'approved'
                 : s.status === 'REJECTED' ? 'rejected'
                 : s.status === 'PENDING'  ? 'pending'
                 : 'on_hold',
        comments:  s.comments,
        allowedActions: s.policyStep?.allowedActions ?? [],
      })),
      createdBy:     app.createdBy || '',
      createdByName: app.accountManager || '',
      branch:        '',
      status:        statusMap[app.status] ?? 'in_progress',
    };
    setSelectedWorkflow(fallback);
    setDialogOpen(true);
  };

  // ── Table réutilisable ──────────────────────────────────────────────────────
  const AppTable = ({ rows, showProgress = false }: { rows: any[]; showProgress?: boolean }) => {
    const paginated = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    return (
      <>
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8ecf0' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['N° Dossier', 'Client', 'Objet', 'Montant', 'Statut',
                    ...(showProgress ? ['Avancement'] : []),
                    'Chargé d\'affaires', 'Date', 'Action',
                  ].map(col => (
                    <TableCell key={col} sx={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.5px', color: '#6b7280',
                      borderBottom: '1px solid #e8ecf0', py: 1.5, whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showProgress ? 9 : 8} align="center" sx={{ py: 6, color: '#9ca3af' }}>
                      Aucun dossier trouvé
                    </TableCell>
                  </TableRow>
                ) : paginated.map((app: any) => {
                  const wf = workflows.find(w => w.applicationId === app.id);
                  const progress = wf && wf.steps?.length
                    ? Math.round(wf.steps.filter((s: any) => s.completedAt).length / wf.steps.length * 100)
                    : 0;
                  const currentStepName = (app.workflowSteps || []).find((s: any) => !s.completedAt)?.stepName;

                  return (
                    <TableRow
                      key={app.id}
                      hover
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: `${ACCENT}06` } }}
                      onClick={() => openDetails(app)}
                    >
                      <TableCell>
                        <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT, fontFamily: 'monospace' }}>
                          {app.applicationNumber || app.id?.slice(0, 8).toUpperCase()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 26, height: 26, bgcolor: `${ACCENT}18`, color: ACCENT, fontSize: '0.65rem', fontWeight: 700 }}>
                            {(app.clientName || '?').slice(0, 2).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 160 }}>
                            {app.clientName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 130, display: 'block' }}>
                          {app.purpose || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#1f4e79', whiteSpace: 'nowrap' }}>
                          {fmtAmount(Number(app.amount), app.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={app.status} />
                      </TableCell>
                      {showProgress && (
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                              sx={{
                                flex: 1, height: 6, borderRadius: 3,
                                bgcolor: '#e5e7eb',
                                '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 3 },
                              }}
                            />
                            <Typography variant="caption" fontWeight={600} sx={{ color: ACCENT, minWidth: 28 }}>
                              {progress}%
                            </Typography>
                          </Box>
                          {currentStepName && (
                            <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block', fontSize: 10, mt: 0.25 }}>
                              {currentStepName}
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {app.accountManager || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {fmtDate(app.createdAt || app.submittedDate)}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Tooltip title="Voir les détails">
                          <IconButton
                            size="small"
                            onClick={() => openDetails(app)}
                            sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}
                          >
                            <OpenIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
        {rows.length > ROWS_PER_PAGE && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={rows.length}
            rowsPerPage={ROWS_PER_PAGE}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={() => setPage(0)}
            labelRowsPerPage="Lignes :"
            sx={{ borderTop: '1px solid #e8ecf0' }}
          />
        )}
      </>
    );
  };

  // ── Barre de filtres ────────────────────────────────────────────────────────
  const FilterBar = () => (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5, alignItems: 'center' }}>
      <TextField
        size="small"
        placeholder="Rechercher un dossier, client…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
        sx={{ flex: '1 1 220px', minWidth: 180 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#9ca3af' }} /></InputAdornment>,
          sx: { borderRadius: 2, fontSize: 13 },
        }}
      />
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel sx={{ fontSize: 13 }}>Statut</InputLabel>
        <Select value={filterStatus} label="Statut" onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
          sx={{ borderRadius: 2, fontSize: 13 }}>
          <MenuItem value="all">Tous les statuts</MenuItem>
          <MenuItem value="submitted">Soumise</MenuItem>
          <MenuItem value="under_review">En analyse</MenuItem>
          <MenuItem value="approved">Approuvée</MenuItem>
          <MenuItem value="rejected">Rejetée</MenuItem>
          <MenuItem value="disbursed">Débloquée</MenuItem>
        </Select>
      </FormControl>
      <TextField size="small" type="date" label="Du" value={filterDateFrom}
        onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 140, '& .MuiInputBase-root': { borderRadius: 2, fontSize: 13 } }}
      />
      <TextField size="small" type="date" label="Au" value={filterDateTo}
        onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 140, '& .MuiInputBase-root': { borderRadius: 2, fontSize: 13 } }}
      />
      {(search || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
        <Button size="small" variant="text" onClick={() => { setSearch(''); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo(''); setPage(0); }}
          sx={{ textTransform: 'none', color: '#6b7280', fontSize: 12 }}>
          Effacer
        </Button>
      )}
    </Box>
  );

  // ── Historique (tab 4) ──────────────────────────────────────────────────────
  const HistoryTab = () => {
    const paginated = workflows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    return (
      <>
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8ecf0' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['N° Dossier', 'Client', 'Montant', 'Décision', 'Durée', 'Créé le', 'Finalisé le', 'Action'].map(col => (
                    <TableCell key={col} sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5, whiteSpace: 'nowrap' }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#9ca3af' }}>Aucun historique disponible</TableCell>
                  </TableRow>
                ) : paginated.map(wf => (
                  <TableRow key={wf.applicationId} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedWorkflow(wf); setDialogOpen(true); }}>
                    <TableCell>
                      <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT, fontFamily: 'monospace' }}>
                        {wf.applicationNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{wf.clientName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#1f4e79', whiteSpace: 'nowrap' }}>
                        {fmtAmount(wf.requestedAmount, wf.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={wf.finalDecision === 'approved' ? 'Approuvé' : wf.finalDecision === 'rejected' ? 'Rejeté' : 'En cours'}
                        color={wf.finalDecision === 'approved' ? 'success' : wf.finalDecision === 'rejected' ? 'error' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600, fontSize: 11, borderRadius: '6px' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{fmtDuration(wf.totalDuration)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{fmtDate(wf.totalStartedAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{fmtDate(wf.totalCompletedAt)}</Typography>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip title="Voir les détails">
                        <IconButton size="small" onClick={() => { setSelectedWorkflow(wf); setDialogOpen(true); }}
                          sx={{ color: ACCENT, '&:hover': { bgcolor: `${ACCENT}12` } }}>
                          <OpenIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
        {workflows.length > ROWS_PER_PAGE && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={workflows.length}
            rowsPerPage={ROWS_PER_PAGE}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={() => setPage(0)}
            labelRowsPerPage="Lignes :"
          />
        )}
      </>
    );
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ bgcolor: '#f7f8fc', minHeight: '100vh', pb: 6 }}>

      {/* ── En-tête ── */}
      <Box sx={{
        bgcolor: '#fff', borderBottom: '1px solid #e8ecf0', px: { xs: 2, md: 4 }, py: 2.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#111827', letterSpacing: '-0.3px' }}>
            Suivi des dossiers
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Vue complète de l'avancement des demandes de crédit
          </Typography>
        </Box>
        <Tooltip title="Rafraîchir">
          <IconButton onClick={loadData} disabled={loading} sx={{ bgcolor: '#f5f3ff', color: ACCENT, '&:hover': { bgcolor: '#ede9fe' } }}>
            {loading ? <CircularProgress size={18} sx={{ color: ACCENT }} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>

        {/* ── Bandeau délégation ── */}
        {delegation && (
          <Alert severity="info" icon={<DelegationIcon />} sx={{ mb: 2.5, borderRadius: 2.5 }}>
            Vous agissez au nom de <strong>{delegation.delegator.name}</strong> — délégation active jusqu'au{' '}
            <strong>{new Date(delegation.endDate).toLocaleDateString('fr-FR')}</strong>
          </Alert>
        )}

        {/* ── KPI Cards ── */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          {kpis.map(k => (
            <KpiCard key={k.label} {...k} />
          ))}
        </Box>

        {/* ── Onglets ── */}
        <Box sx={{
          bgcolor: '#fff', borderRadius: 3, border: '1px solid #e8ecf0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
        }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => { setActiveTab(v); setPage(0); }}
            sx={{
              borderBottom: '1px solid #e8ecf0', px: 2,
              '& .MuiTab-root': {
                textTransform: 'none', fontWeight: 600, fontSize: 13,
                minHeight: 48, color: '#6b7280', gap: 0.75,
              },
              '& .Mui-selected': { color: ACCENT },
              '& .MuiTabs-indicator': { bgcolor: ACCENT, height: 3, borderRadius: 2 },
            }}
          >
            <Tab icon={<MyDocsIcon sx={{ fontSize: 16 }} />} iconPosition="start"
              label={<span>Mes dossiers {myDossiers.length > 0 && <Chip label={myDossiers.length} size="small" sx={{ height: 18, fontSize: 10, ml: 0.5, bgcolor: `${ACCENT}18`, color: ACCENT }} />}</span>}
            />
            <Tab icon={<InProgressIcon sx={{ fontSize: 16 }} />} iconPosition="start"
              label={<span>En cours {inProgress.length > 0 && <Chip label={inProgress.length} size="small" color="warning" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}</span>}
            />
            <Tab icon={<ApprovedIcon sx={{ fontSize: 16 }} />} iconPosition="start"
              label={<span>Approuvés {approved.length > 0 && <Chip label={approved.length} size="small" color="success" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}</span>}
            />
            <Tab icon={<RejectedIcon sx={{ fontSize: 16 }} />} iconPosition="start"
              label={<span>Rejetés {rejected.length > 0 && <Chip label={rejected.length} size="small" color="error" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}</span>}
            />
            <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Historique" />
          </Tabs>

          <Box sx={{ p: 3 }}>

            {/* ── Tab 0 : Mes dossiers ── */}
            {activeTab === 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Mes dossiers créés</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Dossiers que vous avez soumis ou dont vous êtes responsable
                    </Typography>
                  </Box>
                </Box>
                <FilterBar />
                <AppTable rows={myDossiers.filter(a => {
                  const s = search.toLowerCase();
                  return !s ||
                    (a.clientName || '').toLowerCase().includes(s) ||
                    (a.applicationNumber || '').toLowerCase().includes(s);
                })} showProgress />
              </>
            )}

            {/* ── Tab 1 : En cours ── */}
            {activeTab === 1 && (
              <>
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Dossiers en cours d'instruction</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Demandes soumises ou en cours d'analyse dans le circuit de crédit
                  </Typography>
                </Box>
                <FilterBar />
                <AppTable rows={inProgress.filter(a => {
                  const s = search.toLowerCase();
                  return !s ||
                    (a.clientName || '').toLowerCase().includes(s) ||
                    (a.applicationNumber || '').toLowerCase().includes(s) ||
                    (a.accountManager || '').toLowerCase().includes(s);
                })} showProgress />
              </>
            )}

            {/* ── Tab 2 : Approuvés ── */}
            {activeTab === 2 && (
              <>
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Dossiers approuvés</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Demandes validées par le circuit d'approbation — approuvées ou en cours de déblocage
                  </Typography>
                </Box>
                <FilterBar />
                <AppTable rows={approved.filter(a => {
                  const s = search.toLowerCase();
                  return !s ||
                    (a.clientName || '').toLowerCase().includes(s) ||
                    (a.applicationNumber || '').toLowerCase().includes(s);
                })} />
              </>
            )}

            {/* ── Tab 3 : Rejetés ── */}
            {activeTab === 3 && (
              <>
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Dossiers rejetés</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Demandes ayant reçu une décision de rejet à l'une des étapes du circuit
                  </Typography>
                </Box>
                <FilterBar />
                <AppTable rows={rejected.filter(a => {
                  const s = search.toLowerCase();
                  return !s ||
                    (a.clientName || '').toLowerCase().includes(s) ||
                    (a.applicationNumber || '').toLowerCase().includes(s);
                })} />
              </>
            )}

            {/* ── Tab 4 : Historique ── */}
            {activeTab === 4 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Historique complet</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tous les workflows avec leur durée et décision finale
                    </Typography>
                  </Box>
                </Box>
                <HistoryTab />
              </>
            )}

          </Box>
        </Box>
      </Box>

      {/* ── Dialogue détails ── */}
      <WorkflowDetailsDialog
        open={dialogOpen}
        workflow={selectedWorkflow}
        application={applications.find(a => a.id === selectedWorkflow?.applicationId)}
        onClose={() => { setDialogOpen(false); setSelectedWorkflow(null); }}
        onApprovalSubmitted={loadData}
      />
    </Box>
  );
};

export type { WorkflowPageProps };
export default WorkflowPage;
