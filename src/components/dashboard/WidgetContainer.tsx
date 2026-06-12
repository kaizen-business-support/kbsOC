import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Typography, CircularProgress, Alert } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { ApiService } from '../../services/api';
import { DashboardWidget, Period, WidgetDataResult } from '../../types';
import { KpiCardWidget } from './widgets/KpiCardWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { GaugeWidget } from './widgets/GaugeWidget';
import { TableWidget } from './widgets/TableWidget';
import { TrendChartWidget } from './widgets/TrendChartWidget';
import { PivotTableWidget } from './widgets/PivotTableWidget';
import { ComparisonChartWidget } from './widgets/ComparisonChartWidget';
import { GanttChartWidget } from './widgets/GanttChartWidget';
import { PerformanceMatrixWidget } from './widgets/PerformanceMatrixWidget';
import { WidgetInsight } from './widgets/WidgetInsight';

const PERIOD_LABELS: Record<string, string> = {
  this_month: 'Ce mois', this_quarter: 'Ce trimestre', this_year: 'Cette année',
  last_6_months: '6 mois', last_12_months: '12 mois',
};

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
  const groupBy = cfg?.groupBy ?? (
    (widget.type === 'bar_chart' || widget.type === 'line_chart' || widget.type === 'trend_chart') ? 'month' :
    widget.type === 'comparison_chart' ? 'status' : undefined
  );
  const metric = widget.type === 'gantt_chart' ? 'gantt'
               : widget.type === 'performance_matrix' ? 'performance_matrix'
               : (cfg?.metric ?? 'count');
  const configKey = JSON.stringify(widget.config);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetch = widget.type === 'pivot_table'
      ? ApiService.getWidgetPivot({
          rowDimension: cfg?.rowDimension ?? 'branch',
          colDimension: cfg?.colDimension ?? 'status',
          metric: cfg?.metric ?? 'count',
          period: effectivePeriod,
        })
      : ApiService.getWidgetData({
          source: widget.type === 'performance_matrix' ? 'performance' : (cfg?.source ?? 'applications'),
          metric,
          groupBy,
          period: effectivePeriod,
          filter: widget.type === 'performance_matrix'
            ? { targetDays: String(cfg?.targetDays ?? 5) }
            : cfg?.filter,
          limit: cfg?.limit,
        });

    fetch.then(res => {
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      else setError(res.error ?? 'Erreur lors du chargement');
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, widget.type, effectivePeriod, configKey]);

  const CARD_HEIGHT = height;
  // Reserve 34px at the bottom for the insight panel (hidden padding when no insight)
  const INSIGHT_H = 34;
  const CONTENT_HEIGHT = CARD_HEIGHT - 64;
  const WIDGET_HEIGHT = CONTENT_HEIGHT - INSIGHT_H;

  const renderWidget = () => {
    if (!data) return null;
    switch (widget.type) {
      case 'kpi_card':
        return <KpiCardWidget data={data} title={widget.title} colorScheme={cfg?.colorScheme} />;
      case 'bar_chart':
        return <BarChartWidget data={data} title={widget.title} height={WIDGET_HEIGHT} color={cfg?.color} />;
      case 'line_chart':
        return <LineChartWidget data={data} title={widget.title} height={WIDGET_HEIGHT} color={cfg?.color} />;
      case 'gauge':
        return <GaugeWidget data={data} title={widget.title} threshold={cfg?.threshold} maxValue={cfg?.maxValue} height={WIDGET_HEIGHT} />;
      case 'table':
        return <TableWidget data={data} title={widget.title} pageSize={5} />;
      case 'trend_chart':
        return <TrendChartWidget data={data} title={widget.title} height={WIDGET_HEIGHT} regressionType={cfg?.regressionType} forecastMonths={cfg?.forecastMonths ?? 3} color={cfg?.color} />;
      case 'pivot_table':
        return <PivotTableWidget data={data} height={WIDGET_HEIGHT} metric={cfg?.metric ?? 'count'} />;
      case 'comparison_chart':
        return <ComparisonChartWidget data={data} title={widget.title} height={WIDGET_HEIGHT} />;
      case 'gantt_chart':
        return <GanttChartWidget data={data} title={widget.title} height={WIDGET_HEIGHT} />;
      case 'performance_matrix':
        return <PerformanceMatrixWidget
          data={data}
          height={WIDGET_HEIGHT}
          period={effectivePeriod}
          targetDays={cfg?.targetDays ?? 5}
          initialGroupBy={(cfg?.groupBy as 'manager' | 'branch') ?? 'manager'}
        />;
      default:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: WIDGET_HEIGHT }}>
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
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="#1a1a2e" noWrap sx={{ flexGrow: 1 }}>
          {widget.type !== 'kpi_card' ? widget.title : ''}
        </Typography>
        {cfg?.periodOverride && (
          <Chip
            icon={<ScheduleIcon sx={{ fontSize: '0.7rem !important' }} />}
            label={PERIOD_LABELS[cfg.periodOverride] ?? cfg.periodOverride}
            size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e3f2fd', color: '#1565c0', '& .MuiChip-label': { px: 0.7 } }}
          />
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1, p: '8px 12px 0 !important', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: `0 0 ${WIDGET_HEIGHT}px`, overflow: 'hidden' }}>
          {loading && (
            <Box sx={{ height: WIDGET_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {!loading && error && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', py: 0.5 }}>{error}</Alert>
          )}
          {!loading && !error && renderWidget()}
        </Box>
        {!loading && !error && data && (
          <WidgetInsight
            widgetId={widget.id}
            type={widget.type}
            title={widget.title}
            data={data}
            config={cfg ?? {}}
            period={effectivePeriod}
          />
        )}
      </CardContent>
    </Card>
  );
};
