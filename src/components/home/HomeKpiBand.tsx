import React from 'react';
import { Box, Grid, Alert } from '@mui/material';
import { HomeKpiCard, KpiFormat } from './HomeKpiCard';
import { useHomeKpis } from '../../hooks/useHomeKpis';

export function HomeKpiBand() {
  const { kpis, loading, error } = useHomeKpis();

  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 3, borderRadius: 2 }}>
        Indicateurs indisponibles pour le moment.
      </Alert>
    );
  }

  const items =
    kpis ?? Array.from({ length: 4 }).map((_, i) => ({
      key: `placeholder-${i}`,
      label: ' ',
      value: null as number | null,
      format: 'number' as KpiFormat,
      trend: null as { delta: number; direction: 'up' | 'down' } | null,
    }));

  return (
    <Box sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        {items.map((k, i) => (
          <Grid item xs={12} sm={6} md={3} key={k.key}>
            <HomeKpiCard
              label={k.label || ' '}
              value={k.value}
              format={k.format as KpiFormat}
              loading={loading}
              trend={k.trend ?? null}
              delayMs={i * 80}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
