import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, Button, CircularProgress,
  Alert, IconButton, Select, MenuItem, FormControl, InputLabel,
  Badge, Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  HowToVote as ApprovalIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { ApprovalActionDialog } from '../components/ApprovalActionDialog';

const ACCENT = '#5c35b5';
const REFRESH_INTERVAL = 30;

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function SlaChip({ item }: { item: ApprovalItem }) {
  if (item.isOverdue) return <Chip label="En retard" color="error" size="small" />;
  if (item.deadline) {
    const hoursLeft = (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < 24) return <Chip label="< 24h" color="warning" size="small" />;
  }
  return <Chip label="Dans les délais" color="success" size="small" variant="outlined" />;
}

export const ApprovalsPage: React.FC = () => {
  const [items, setItems]               = useState<ApprovalItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState(0);
  const [branchFilter, setBranchFilter] = useState('all');
  const [countdown, setCountdown]       = useState(REFRESH_INTERVAL);
  const [dialog, setDialog]             = useState<ApprovalItem | null>(null);
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

  const branches = Array.from(new Set(items.map(i => i.branch).filter(Boolean) as string[])).sort();

  const filtered = items.filter(item => {
    const matchBranch = branchFilter === 'all' || item.branch === branchFilter;
    const matchTab = tab === 0
      || (tab === 1 && item.type === 'financial')
      || (tab === 2 && item.type === 'process');
    return matchBranch && matchTab;
  });

  const countFinancial = items.filter(i => i.type === 'financial').length;
  const countProcess   = items.filter(i => i.type === 'process').length;

  const handleSuccess = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const showAmount = tab === 0 || tab === 1;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ApprovalIcon sx={{ fontSize: 32, color: ACCENT }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Mes Approbations</Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} élément{items.length !== 1 ? 's' : ''} en attente
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

      {/* Filtre agence */}
      {branches.length > 0 && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
          <InputLabel>Agence</InputLabel>
          <Select value={branchFilter} label="Agence" onChange={(e) => setBranchFilter(e.target.value)}>
            <MenuItem value="all">Toutes les agences</MenuItem>
            {branches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      {/* Onglets */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab label={
          <Badge badgeContent={items.length} color="primary" max={99}>
            <Box sx={{ pr: 1 }}>Tout</Box>
          </Badge>
        } />
        <Tab label={
          <Badge badgeContent={countFinancial} color="success" max={99}>
            <Box sx={{ pr: 1 }}>Financière</Box>
          </Badge>
        } />
        <Tab label={
          <Badge badgeContent={countProcess} color="warning" max={99}>
            <Box sx={{ pr: 1 }}>Process</Box>
          </Badge>
        } />
      </Tabs>

      {/* Contenu */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ApprovalIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Aucune approbation en attente</Typography>
        </Box>
      ) : (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }} elevation={0} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f8f8' }}>
                <TableCell><strong>N° dossier</strong></TableCell>
                <TableCell><strong>Client</strong></TableCell>
                <TableCell><strong>Étape</strong></TableCell>
                {showAmount && <TableCell align="right"><strong>Montant</strong></TableCell>}
                <TableCell><strong>Type crédit</strong></TableCell>
                <TableCell><strong>Agence</strong></TableCell>
                <TableCell align="center"><strong>Attente</strong></TableCell>
                <TableCell align="center"><strong>SLA</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    bgcolor: item.isOverdue ? 'rgba(220,38,38,0.03)' : 'white',
                    '&:hover': { bgcolor: 'rgba(92,53,181,0.04)' },
                  }}
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
                    <Typography variant="body2">{item.stepLabel}</Typography>
                  </TableCell>
                  {showAmount && (
                    <TableCell align="right">
                      {item.type === 'financial'
                        ? <Typography variant="body2" fontWeight={600}>{fmtAmount(item.amount, item.currency)}</Typography>
                        : <Typography variant="body2" color="text.disabled">—</Typography>
                      }
                    </TableCell>
                  )}
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
                  <TableCell align="center">
                    <SlaChip item={item} />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setDialog(item)}
                      sx={{
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                        textTransform: 'none', bgcolor: ACCENT, boxShadow: 'none',
                        '&:hover': { bgcolor: '#4a2a9e', boxShadow: 'none' },
                      }}
                    >
                      Traiter
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <ApprovalActionDialog
        item={dialog}
        open={!!dialog}
        onClose={() => setDialog(null)}
        onSuccess={handleSuccess}
      />
    </Box>
  );
};

export default ApprovalsPage;
