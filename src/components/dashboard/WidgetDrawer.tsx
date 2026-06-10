import React, { useState } from 'react';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { ApiService } from '../../services/api';
import { DashboardWidget } from '../../types';
import { WidgetConfigForm, WidgetFormValues } from './WidgetConfigForm';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

interface WidgetDrawerProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  editingWidget: DashboardWidget | null;
  onWidgetAdded: (widget: DashboardWidget, newLayout: any[]) => void;
  onWidgetUpdated: (widget: DashboardWidget) => void;
  currentLayout: LayoutItem[];
}

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  kpi_card:   { w: 3, h: 2 },
  bar_chart:  { w: 6, h: 4 },
  line_chart: { w: 6, h: 4 },
  gauge:      { w: 3, h: 4 },
  table:      { w: 8, h: 5 },
};

function buildConfig(values: WidgetFormValues): Record<string, any> {
  const config: Record<string, any> = { source: values.source, metric: values.metric };
  if (values.groupBy)        config.groupBy = values.groupBy;
  if (values.filterStatus)   config.filter = { status: values.filterStatus };
  if (values.periodOverride) config.periodOverride = values.periodOverride;
  if (values.colorScheme)    config.colorScheme = values.colorScheme;
  if (values.color)          config.color = values.color;
  if (values.thresholdWarning !== undefined || values.thresholdCritical !== undefined) {
    config.threshold = { warning: values.thresholdWarning ?? 70, critical: values.thresholdCritical ?? 50 };
  }
  if (values.limit)          config.limit = values.limit;
  return config;
}

export const WidgetDrawer: React.FC<WidgetDrawerProps> = ({
  open, onClose, dashboardId, editingWidget, onWidgetAdded, onWidgetUpdated, currentLayout,
}) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: WidgetFormValues) => {
    setLoading(true);
    const config = buildConfig(values);

    if (editingWidget) {
      const res = await ApiService.updateWidget(dashboardId, editingWidget.id, { title: values.title, config });
      if (res.success && res.data) onWidgetUpdated(res.data);
    } else {
      const size = DEFAULT_SIZES[values.type] ?? { w: 4, h: 3 };
      const maxY = currentLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const res = await ApiService.addWidget(dashboardId, {
        type: values.type,
        title: values.title,
        config,
        position: { x: 0, y: maxY, ...size },
      });
      if (res.success && res.data) onWidgetAdded(res.data.widget, res.data.layout);
    }
    setLoading(false);
  };

  const initialValues: Partial<WidgetFormValues> | undefined = editingWidget
    ? {
        title:             editingWidget.title,
        type:              editingWidget.type as WidgetFormValues['type'],
        source:            editingWidget.config.source ?? 'applications',
        metric:            editingWidget.config.metric ?? 'count',
        groupBy:           editingWidget.config.groupBy,
        filterStatus:      editingWidget.config.filter?.status,
        periodOverride:    editingWidget.config.periodOverride,
        colorScheme:       editingWidget.config.colorScheme,
        color:             editingWidget.config.color,
        thresholdWarning:  editingWidget.config.threshold?.warning,
        thresholdCritical: editingWidget.config.threshold?.critical,
        limit:             editingWidget.config.limit,
      }
    : undefined;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 360, p: 3 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          {editingWidget ? 'Modifier le widget' : 'Ajouter un widget'}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <WidgetConfigForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </Drawer>
  );
};
