import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { ApiService } from '../../services/api';
import { DashboardWidget, Period, WidgetDataResult } from '../../types';
import { KpiCardWidget } from './widgets/KpiCardWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { GaugeWidget } from './widgets/GaugeWidget';
import { TableWidget } from './widgets/TableWidget';

interface WidgetContainerProps {
  widget: DashboardWidget;
  globalPeriod: Period;
  height?: number;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({ widget, globalPeriod, height = 260 }) => {
  const [data, setData] = useState<WidgetDataResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cfg = widget.config as any;
  const effectivePeriod: Period = cfg?.periodOverride ?? globalPeriod;
  const configKey = JSON.stringify(widget.config);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiService.getWidgetData({
      source: cfg?.source ?? 'applications',
      metric: cfg?.metric ?? 'count',
      groupBy: cfg?.groupBy,
      period: effectivePeriod,
      filter: cfg?.filter,
      limit: cfg?.limit,
    }).then(res => {
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      else setError(res.error ?? 'Erreur lors du chargement');
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, widget.type, effectivePeriod, configKey]);

  const CARD_HEIGHT = height;
  const CONTENT_HEIGHT = CARD_HEIGHT - 64; // header (~40px) + padding

  const renderWidget = () => {
    if (!data) return null;
    switch (widget.type) {
      case 'kpi_card':
        return <KpiCardWidget data={data} title={widget.title} colorScheme={cfg?.colorScheme} />;
      case 'bar_chart':
        return <BarChartWidget data={data} title={widget.title} height={CONTENT_HEIGHT} color={cfg?.color} />;
      case 'line_chart':
        return <LineChartWidget data={data} title={widget.title} height={CONTENT_HEIGHT} color={cfg?.color} />;
      case 'gauge':
        return <GaugeWidget data={data} title={widget.title} threshold={cfg?.threshold} maxValue={cfg?.maxValue} height={CONTENT_HEIGHT} />;
      case 'table':
        return <TableWidget data={data} title={widget.title} pageSize={5} />;
      default:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: CONTENT_HEIGHT }}>
            <Typography variant="caption" color="text.disabled">Widget type "{widget.type}" non supporté</Typography>
          </Box>
        );
    }
  };

  return (
    <Card
      sx={{
        height: CARD_HEIGHT,
        borderRadius: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Typography variant="subtitle2" fontWeight={700} color="#1a1a2e" noWrap>
          {widget.type !== 'kpi_card' ? widget.title : ''}
        </Typography>
      </Box>
      <CardContent sx={{ flexGrow: 1, p: '8px 12px !important', overflow: 'hidden' }}>
        {loading && (
          <Box sx={{ height: CONTENT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {!loading && error && (
          <Alert severity="error" sx={{ fontSize: '0.75rem', py: 0.5 }}>{error}</Alert>
        )}
        {!loading && !error && renderWidget()}
      </CardContent>
    </Card>
  );
};
