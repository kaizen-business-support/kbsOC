import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Alert, CircularProgress, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CodirDashboardData } from '../types';
import { ApiService } from '../services/api';
import { BottleneckKpiBar } from '../components/codir/BottleneckKpiBar';
import { PendingDecisionsTable } from '../components/codir/PendingDecisionsTable';

const REFRESH_INTERVAL = 60;

export const CodirDashboardPage: React.FC = () => {
  const [data, setData]           = useState<CodirDashboardData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [stepFilter, setStepFilter] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await ApiService.getCodirDashboard();
      if (res.success && res.data) setData(res.data);
      else setError(res.error || 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { reload(true); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [reload]);

  const totalPending = data?.items.length ?? 0;
  const totalOverdue = data?.items.filter(i => i.isOverdue).length ?? 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tableau de Bord CODIR</Typography>
          <Typography variant="body2" color="text.secondary">
            Vue 360° des dossiers en attente — {totalPending} dossier{totalPending !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` — `}
            {totalOverdue > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{totalOverdue} en retard</span>}
          </Typography>
        </Box>
        <Chip
          icon={<RefreshIcon fontSize="small" />}
          label={`Actualisation dans ${countdown}s`}
          size="small"
          variant="outlined"
          onClick={() => reload()}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : data ? (
        <>
          <BottleneckKpiBar
            kpis={data.kpis}
            selectedStep={stepFilter}
            onSelectStep={setStepFilter}
          />
          <PendingDecisionsTable
            items={data.items}
            stepFilter={stepFilter}
            onRefresh={() => reload(true)}
          />
        </>
      ) : null}
    </Box>
  );
};
