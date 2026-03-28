import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Avatar,
  Chip, Alert, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  IconButton, Badge,
} from '@mui/material';
import {
  AutoFixHigh as AutoIcon,
  CheckCircle as CheckIcon,
  Person as PersonIcon,
  Assignment as AssignIcon,
  Refresh as RefreshIcon,
  WarningAmber as WarnIcon,
  Business as BizIcon,
  AccountBalance as BankIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { dispatchingApi } from '../services/api';

const BG = '#f7f8fc';
const ACCENT = '#5c35b5';

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function workloadColor(n: number) {
  if (n === 0) return '#2e7d32';
  if (n <= 2) return '#1565c0';
  if (n <= 4) return '#e65100';
  return '#c62828';
}

interface Analyst {
  id: string; name: string; email: string; department?: string; jobTitle?: string;
  activeCount: number; pendingCount: number; inReviewCount: number; workloadScore: number;
}

interface Application {
  id: string; applicationNumber: string; clientName: string; clientSector?: string;
  amount: number; currency: string; purpose: string; durationMonths?: number;
  status: string; createdAt: string; accountManager: string; creditType?: string;
}

interface AssignDialog {
  open: boolean;
  app: Application | null;
  suggestedAnalyst: Analyst | null;
  selectedAnalystId: string;
  comment: string;
  loading: boolean;
}

export const DispatchingPage: React.FC = () => {
  const [analysts, setAnalysts]     = useState<Analyst[]>([]);
  const [pending, setPending]       = useState<Application[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [autoLoading, setAutoLoading] = useState<Record<string, boolean>>({});

  const [dialog, setDialog] = useState<AssignDialog>({
    open: false, app: null, suggestedAnalyst: null,
    selectedAnalystId: '', comment: '', loading: false,
  });

  const reload = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const [wRes, pRes] = await Promise.all([
        dispatchingApi.getWorkload(),
        dispatchingApi.getPendingApplications(),
      ]);
      if (wRes.success) setAnalysts(wRes.data || []);
      if (pRes.success) setPending(pRes.data || []);
      if (!wRes.success || !pRes.success) setError(wRes.error || pRes.error || 'Erreur chargement');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openAssignDialog = async (app: Application) => {
    setAutoLoading(p => ({ ...p, [app.id]: true }));
    const suggestRes = await dispatchingApi.suggestAnalyst(app.id);
    setAutoLoading(p => ({ ...p, [app.id]: false }));
    const suggested = suggestRes.success ? suggestRes.data?.suggested : null;
    setDialog({
      open: true, app, suggestedAnalyst: suggested,
      selectedAnalystId: suggested?.id || '',
      comment: '', loading: false,
    });
  };

  const handleAssign = async () => {
    if (!dialog.app || !dialog.selectedAnalystId) return;
    setDialog(d => ({ ...d, loading: true }));
    const res = await dispatchingApi.assignAnalyst(dialog.app.id, dialog.selectedAnalystId, dialog.comment);
    if (res.success) {
      setSuccess(res.data?.message || 'Affectation validée');
      setDialog(d => ({ ...d, open: false, loading: false }));
      reload();
    } else {
      setDialog(d => ({ ...d, loading: false }));
      setError(res.error || 'Erreur affectation');
    }
  };

  const selectedAnalystInfo = analysts.find(a => a.id === dialog.selectedAnalystId);

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100vh', pb: 6 }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${ACCENT} 0%, #1565c0 100%)`,
        color: 'white', px: 4, py: 3.5, mb: 4,
        borderRadius: '0 0 24px 24px',
        boxShadow: '0 4px 24px rgba(92,53,181,0.18)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Dispatching des Demandes</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
              Affecter les dossiers en attente aux analystes crédit — optimisation par charge de travail
            </Typography>
          </Box>
          <Tooltip title="Actualiser">
            <IconButton onClick={reload} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* KPI bar */}
        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          {[
            { label: 'Dossiers en attente', value: pending.length, color: '#fff' },
            { label: 'Analystes actifs', value: analysts.length, color: '#fff' },
            { label: 'Dossier moyen / analyste', value: analysts.length ? (analysts.reduce((s, a) => s + a.activeCount, 0) / analysts.length).toFixed(1) : 0, color: '#fff' },
          ].map(k => (
            <Grid item xs={4} key={k.label}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 3, px: 2, py: 1.25, textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800}>{k.value}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{k.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ px: 3 }}>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

        {loadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <Grid container spacing={3}>

            {/* ── Charge de travail des analystes ── */}
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: '#374151' }}>
                Charge de travail — Analystes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {analysts.map((a, idx) => (
                  <Card key={a.id} variant="outlined" sx={{ borderRadius: 3, borderColor: 'rgba(0,0,0,0.08)', transition: 'box-shadow .2s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.10)' } }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Badge badgeContent={idx === 0 ? '✓' : undefined} color="success" anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: workloadColor(a.workloadScore), fontSize: '0.85rem', fontWeight: 700 }}>
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </Avatar>
                        </Badge>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>{a.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>{a.jobTitle || a.department}</Typography>
                        </Box>
                        <Chip
                          label={`${a.activeCount} dossier${a.activeCount !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{ bgcolor: workloadColor(a.workloadScore) + '18', color: workloadColor(a.workloadScore), fontWeight: 700, border: `1px solid ${workloadColor(a.workloadScore)}30` }}
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((a.activeCount / 6) * 100, 100)}
                        sx={{
                          height: 5, borderRadius: 3,
                          bgcolor: '#f1f5f9',
                          '& .MuiLinearProgress-bar': { bgcolor: workloadColor(a.workloadScore), borderRadius: 3 }
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">{a.pendingCount} en attente</Typography>
                        <Typography variant="caption" color="text.secondary">·</Typography>
                        <Typography variant="caption" color="text.secondary">{a.inReviewCount} en cours</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                {analysts.length === 0 && (
                  <Alert severity="info">Aucun analyste crédit actif trouvé</Alert>
                )}
              </Box>
            </Grid>

            {/* ── Dossiers en attente ── */}
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: '#374151' }}>
                Dossiers en attente de dispatching ({pending.length})
              </Typography>
              {pending.length === 0 ? (
                <Card variant="outlined" sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
                  <CheckIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                  <Typography variant="h6" fontWeight={700} color="#2e7d32">Aucun dossier en attente</Typography>
                  <Typography variant="body2" color="text.secondary">Tous les dossiers ont été affectés.</Typography>
                </Card>
              ) : (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fafafa' }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Dossier</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Client</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Montant</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Chargé</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pending.map(app => (
                        <TableRow key={app.id} sx={{ '&:hover td': { bgcolor: '#f8fafc' } }}>
                          <TableCell>
                            <Typography variant="caption" fontWeight={700} color={ACCENT}>{app.applicationNumber}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <BizIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                              <Box>
                                <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ maxWidth: 140 }}>{app.clientName}</Typography>
                                {app.clientSector && <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>{app.clientSector}</Typography>}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" fontWeight={700}>{fmtAmount(app.amount, app.currency)}</Typography>
                            {app.durationMonths && <Typography variant="caption" color="text.secondary" display="block">{app.durationMonths} mois</Typography>}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" noWrap>{app.accountManager}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={autoLoading[app.id] ? <CircularProgress size={12} color="inherit" /> : <AutoIcon sx={{ fontSize: 14 }} />}
                              onClick={() => openAssignDialog(app)}
                              disabled={!!autoLoading[app.id] || analysts.length === 0}
                              sx={{ fontSize: '0.72rem', px: 1.5, borderRadius: 2, bgcolor: ACCENT, '&:hover': { bgcolor: '#4527a0' }, textTransform: 'none', fontWeight: 700 }}
                            >
                              Affecter
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Grid>
          </Grid>
        )}
      </Box>

      {/* ── Dialog confirmation affectation ── */}
      <Dialog open={dialog.open} onClose={() => setDialog(d => ({ ...d, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
          <AssignIcon sx={{ color: ACCENT }} />
          Affecter le dossier
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setDialog(d => ({ ...d, open: false }))}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {dialog.app && (
            <Alert severity="info" icon={<BankIcon />} sx={{ mb: 2, borderRadius: 2 }}>
              <strong>{dialog.app.applicationNumber}</strong> — {dialog.app.clientName}<br />
              {fmtAmount(dialog.app.amount, dialog.app.currency)} · {dialog.app.purpose}
            </Alert>
          )}

          {dialog.suggestedAnalyst && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #90caf9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <AutoIcon sx={{ fontSize: 16, color: '#1565c0' }} />
                <Typography variant="caption" fontWeight={700} color="#1565c0">Suggestion automatique (charge minimale)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: workloadColor(dialog.suggestedAnalyst.workloadScore), fontSize: '0.75rem' }}>
                  {dialog.suggestedAnalyst.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{dialog.suggestedAnalyst.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{dialog.suggestedAnalyst.activeCount} dossier(s) actif(s)</Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Choisir l'analyste :</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {analysts.map(a => (
              <Box
                key={a.id}
                onClick={() => setDialog(d => ({ ...d, selectedAnalystId: a.id }))}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: 1.5, borderRadius: 2, cursor: 'pointer',
                  border: '2px solid',
                  borderColor: dialog.selectedAnalystId === a.id ? ACCENT : 'rgba(0,0,0,0.08)',
                  bgcolor: dialog.selectedAnalystId === a.id ? `${ACCENT}08` : 'transparent',
                  transition: 'all .15s',
                  '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}06` }
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: workloadColor(a.workloadScore), fontSize: '0.75rem', fontWeight: 700 }}>
                  {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.jobTitle || a.department}</Typography>
                </Box>
                <Chip
                  label={`${a.activeCount} actif${a.activeCount !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{ bgcolor: workloadColor(a.workloadScore) + '18', color: workloadColor(a.workloadScore), fontWeight: 700, fontSize: '0.7rem' }}
                />
                {dialog.selectedAnalystId === a.id && <CheckIcon sx={{ color: ACCENT, fontSize: 18 }} />}
              </Box>
            ))}
          </Box>

          <TextField
            fullWidth size="small"
            label="Commentaire (optionnel)"
            placeholder="Motif de l'affectation..."
            value={dialog.comment}
            onChange={e => setDialog(d => ({ ...d, comment: e.target.value }))}
            multiline rows={2}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDialog(d => ({ ...d, open: false }))} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!dialog.selectedAnalystId || dialog.loading}
            startIcon={dialog.loading ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
            sx={{ borderRadius: 2, bgcolor: ACCENT, '&:hover': { bgcolor: '#4527a0' }, textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {dialog.loading ? 'Validation...' : 'Valider l\'affectation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DispatchingPage;
