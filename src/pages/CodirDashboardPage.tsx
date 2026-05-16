import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Chip,
  Tabs, Tab,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CodirDashboardData, CodirTimelineData } from '../types';
import { ApiService } from '../services/api';
import { BottleneckKpiBar } from '../components/codir/BottleneckKpiBar';
import { PendingDecisionsTable } from '../components/codir/PendingDecisionsTable';
import { AgenceFilter } from '../components/codir/AgenceFilter';
import { CodirTimelineTab } from '../components/codir/CodirTimelineTab';

const REFRESH_INTERVAL = 60;

export const CodirDashboardPage: React.FC = () => {
  const [dashData, setDashData]       = useState<CodirDashboardData | null>(null);
  const [timelineData, setTimelineData] = useState<CodirTimelineData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState(0);
  const [stepFilter, setStepFilter]   = useState<string | null>(null);
  const [opinionFilterActive, setOpinionFilterActive] = useState(false);
  const [agenceType, setAgenceType]   = useState<'client' | 'ca'>('client');
  const [agenceValue, setAgenceValue] = useState('all');
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashRes, timelineRes] = await Promise.all([
        ApiService.getCodirDashboard(),
        ApiService.getCodirTimeline(),
      ]);
      if (dashRes.success && dashRes.data)         setDashData(dashRes.data);
      if (timelineRes.success && timelineRes.data) setTimelineData(timelineRes.data);
      if (!dashRes.success || !timelineRes.success)
        setError(dashRes.error || timelineRes.error || 'Erreur de chargement');
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

  const handleAgenceChange = (type: 'client' | 'ca', value: string) => {
    setAgenceType(type);
    setAgenceValue(value);
  };

  // Filtrage de l'onglet Tableau : agence + (v1.0) avis défavorable majoritaire
  const filteredItems = dashData?.items.filter(item => {
    if (agenceValue !== 'all') {
      const branch = agenceType === 'client' ? item.clientBranch : item.creatorBranch;
      if (branch !== agenceValue) return false;
    }
    if (opinionFilterActive) {
      const op = item.opinionSummary;
      if (!op || op.total === 0) return false;
      if (op.defavorable <= op.favorable) return false;
    }
    return true;
  }) ?? [];

  const totalPending = filteredItems.length;
  const totalOverdue = filteredItems.filter(i => i.isOverdue).length;

  // v1.0 — KPI transversal calculé sur filteredItems (donc respecte le filtre agence courant)
  const negativeOpinionCount = (dashData?.items ?? []).filter(it => {
    if (agenceValue !== 'all') {
      const branch = agenceType === 'client' ? it.clientBranch : it.creatorBranch;
      if (branch !== agenceValue) return false;
    }
    const op = it.opinionSummary;
    return !!op && op.total > 0 && op.defavorable > op.favorable;
  }).length;

  // Agences disponibles (union des deux sources)
  const agences = timelineData?.agences ?? { client: [], ca: [] };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tableau de Bord CODIR</Typography>
          <Typography variant="body2" color="text.secondary">
            Vue 360° des dossiers en attente — {totalPending} dossier{totalPending !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` — `}
            {totalOverdue > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{totalOverdue} en retard</span>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <AgenceFilter
            agences={agences}
            type={agenceType}
            value={agenceValue}
            onChange={handleAgenceChange}
          />
          <Chip
            icon={<RefreshIcon fontSize="small" />}
            label={`Actualisation dans ${countdown}s`}
            size="small"
            variant="outlined"
            onClick={() => reload()}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Onglets */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab label="Tableau de décision" />
            <Tab label="Timeline" />
          </Tabs>

          {/* Onglet 0 — Tableau */}
          {activeTab === 0 && dashData && (
            <>
              <BottleneckKpiBar
                kpis={dashData.kpis}
                selectedStep={stepFilter}
                onSelectStep={setStepFilter}
                negativeOpinionCount={negativeOpinionCount}
                opinionFilterActive={opinionFilterActive}
                onToggleOpinionFilter={() => setOpinionFilterActive(v => !v)}
              />
              <PendingDecisionsTable
                items={filteredItems}
                stepFilter={stepFilter}
                onRefresh={() => reload(true)}
              />
            </>
          )}

          {/* Onglet 1 — Timeline */}
          {activeTab === 1 && timelineData && (
            <CodirTimelineTab
              applications={timelineData.applications}
              agenceType={agenceType}
              agenceValue={agenceValue}
            />
          )}
        </>
      )}
    </Box>
  );
};
