import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Alert, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import { Dashboard, Period } from '../types';
import { WidgetContainer, DashboardPeriodSelector } from '../components/dashboard';

export const DashboardViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalPeriod, setGlobalPeriod] = useState<Period>('this_month');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ApiService.getDashboard(id).then(res => {
      if (res.success && res.data) setDashboard(res.data);
      else setError(res.error ?? 'Dashboard introuvable');
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !dashboard) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error ?? 'Dashboard introuvable'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Tooltip title="Retour aux dashboards">
          <IconButton onClick={() => navigate('/dashboard-builder')} size="small">
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e">{dashboard.name}</Typography>
          {dashboard.description && (
            <Typography variant="body2" color="text.secondary">{dashboard.description}</Typography>
          )}
        </Box>
        <DashboardPeriodSelector value={globalPeriod} onChange={setGlobalPeriod} />
      </Box>

      {/* Widgets */}
      {dashboard.widgets.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography variant="h6" color="text.secondary">Ce dashboard n'a pas encore de widgets.</Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            L'éditeur drag & drop sera disponible dans la prochaine version.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {dashboard.widgets.map(widget => (
            <Grid
              item
              key={widget.id}
              xs={12}
              sm={widget.type === 'kpi_card' ? 6 : 12}
              md={widget.type === 'kpi_card' ? 3 : widget.type === 'table' ? 8 : 6}
            >
              <WidgetContainer
                widget={widget}
                globalPeriod={globalPeriod}
                height={widget.type === 'kpi_card' ? 140 : widget.type === 'table' ? 320 : 280}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};
