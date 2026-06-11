import React, { useCallback } from 'react';
import { ReactGridLayout, WidthProvider } from 'react-grid-layout/legacy';
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import { DashboardWidget, Period } from '../../types';
import { WidgetContainer } from './WidgetContainer';
import { WidgetActivity } from '../../hooks/useDashboardSocket';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const GridLayout = WidthProvider(ReactGridLayout);

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

interface DashboardEditorGridProps {
  widgets: DashboardWidget[];
  layout: LayoutItem[];
  globalPeriod: Period;
  onLayoutChange: (layout: LayoutItem[]) => void;
  onLayoutSave: (layout: LayoutItem[]) => void;
  onDeleteWidget: (widgetId: string) => void;
  onEditWidget: (widget: DashboardWidget) => void;
  viewOnly?: boolean;
  widgetActivities?: Record<string, WidgetActivity>;
  onWidgetDragStart?: (widgetId: string, widgetTitle: string) => void;
  onWidgetDragEnd?: (widgetId: string, widgetTitle: string) => void;
}

const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [16, 16];

function simplify(layout: LayoutItem[]): LayoutItem[] {
  return layout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }));
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const DashboardEditorGrid: React.FC<DashboardEditorGridProps> = ({
  widgets, layout, globalPeriod, onLayoutChange, onLayoutSave, onDeleteWidget, onEditWidget,
  viewOnly = false, widgetActivities = {}, onWidgetDragStart, onWidgetDragEnd,
}) => {
  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    if (viewOnly) return;
    const simplified = simplify(newLayout);
    const changed = simplified.some(item => {
      const old = layout.find(l => l.i === item.i);
      return !old || old.x !== item.x || old.y !== item.y || old.w !== item.w || old.h !== item.h;
    });
    if (changed) onLayoutChange(simplified);
  }, [layout, onLayoutChange, viewOnly]);

  const handleDragStart = useCallback((_: any, oldItem: LayoutItem) => {
    if (!viewOnly && onWidgetDragStart) {
      const w = widgets.find(ww => ww.id === oldItem.i);
      if (w) onWidgetDragStart(w.id, w.title);
    }
  }, [viewOnly, onWidgetDragStart, widgets]);

  const handleDragStop = useCallback((_layout: LayoutItem[], oldItem: LayoutItem) => {
    if (!viewOnly) {
      onLayoutSave(simplify(_layout));
      if (onWidgetDragEnd) {
        const w = widgets.find(ww => ww.id === oldItem.i);
        if (w) onWidgetDragEnd(w.id, w.title);
      }
    }
  }, [onLayoutSave, viewOnly, onWidgetDragEnd, widgets]);

  const handleResizeStop = useCallback((_layout: LayoutItem[]) => {
    if (!viewOnly) onLayoutSave(simplify(_layout));
  }, [onLayoutSave, viewOnly]);

  const visibleWidgets = widgets.filter(w => layout.some(l => l.i === w.id));

  return (
    <GridLayout
      layout={layout}
      cols={12}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      onLayoutChange={handleLayoutChange}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      draggableHandle={viewOnly ? undefined : '.drag-handle'}
      isDraggable={!viewOnly}
      isResizable={!viewOnly}
      compactType="vertical"
    >
      {visibleWidgets.map(widget => {
        const layoutItem = layout.find(l => l.i === widget.id);
        const h = layoutItem?.h ?? 4;
        const widgetHeight = h * ROW_HEIGHT + (h - 1) * MARGIN[1];
        const activity = widgetActivities[widget.id];
        return (
          <Box key={widget.id} sx={{ position: 'relative', height: '100%' }}>
            {/* Collaboration overlay — autre utilisateur est sur ce widget */}
            {activity && (
              <Box sx={{
                position: 'absolute', inset: 0, zIndex: 10, borderRadius: 3, pointerEvents: 'none',
                border: `2px solid ${activity.color}`,
                bgcolor: `${activity.color}18`,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', p: 0.5,
              }}>
                <Tooltip title={`${activity.userName} ${activity.action === 'drag_start' ? 'déplace' : 'modifie'} ce widget`} arrow>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: activity.color, borderRadius: 10, px: 0.8, py: 0.2 }}>
                    <Avatar sx={{ width: 18, height: 18, fontSize: '0.55rem', bgcolor: 'rgba(255,255,255,0.3)' }}>
                      {initials(activity.userName)}
                    </Avatar>
                    <Typography sx={{ color: '#fff', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>
                      {activity.userName.split(' ')[0]}
                    </Typography>
                  </Box>
                </Tooltip>
              </Box>
            )}
            {!viewOnly && (
              <>
                <Box
                  className="drag-handle"
                  sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                    cursor: 'grab', '&:active': { cursor: 'grabbing' },
                    borderRadius: 3,
                    border: '2px dashed rgba(21,101,192,0.3)',
                    bgcolor: 'rgba(21,101,192,0.03)',
                  }}
                />
                <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Modifier la configuration">
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); onEditWidget(widget); }}
                      sx={{ bgcolor: 'white', boxShadow: 1, width: 24, height: 24, '&:hover': { bgcolor: '#e3f2fd' } }}
                    >
                      <EditIcon sx={{ fontSize: 14, color: '#1565c0' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); onDeleteWidget(widget.id); }}
                      sx={{ bgcolor: 'white', boxShadow: 1, width: 24, height: 24, '&:hover': { bgcolor: '#ffebee' } }}
                    >
                      <CloseIcon sx={{ fontSize: 14, color: '#c62828' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </>
            )}
            <WidgetContainer widget={widget} globalPeriod={globalPeriod} height={widgetHeight} />
          </Box>
        );
      })}
    </GridLayout>
  );
};
