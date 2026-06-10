import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Fab,
  Grid, IconButton, Snackbar, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  Bookmark as BookmarkIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import { Dashboard, DashboardWidget, Period } from '../types';
import { useUser } from '../contexts/UserContext';
import { WidgetContainer, DashboardPeriodSelector } from '../components/dashboard';
import { DashboardEditorGrid } from '../components/dashboard/DashboardEditorGrid';
import { WidgetDrawer } from '../components/dashboard/WidgetDrawer';
import { ExportMenu } from '../components/dashboard/ExportMenu';
import { SaveAsTemplateDialog } from '../components/dashboard/SaveAsTemplateDialog';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type SaveStatus = 'saved' | 'saving' | 'unsaved';

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  kpi_card: { w: 3, h: 2 }, bar_chart: { w: 6, h: 4 },
  line_chart: { w: 6, h: 4 }, gauge: { w: 3, h: 4 }, table: { w: 8, h: 5 },
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (status === 'saved') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [status]);
  if (!visible) return null;
  return (
    <Chip
      size="small"
      icon={status === 'saving' ? <CircularProgress size={12} color="inherit" /> : undefined}
      label={
        status === 'unsaved' ? '• Non sauvegardé' :
        status === 'saving'  ? 'Sauvegarde...' : '✓ Sauvegardé'
      }
      sx={{
        bgcolor: status === 'unsaved' ? '#fff3e0' : status === 'saving' ? '#e3f2fd' : '#e8f5e9',
        color:  status === 'unsaved' ? '#e65100' : status === 'saving' ? '#1565c0' : '#2e7d32',
        fontWeight: 600, fontSize: '0.72rem',
      }}
    />
  );
}

export const DashboardViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useUser();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalPeriod, setGlobalPeriod] = useState<Period>('last_6_months');

  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [pendingLayout, setPendingLayout] = useState<LayoutItem[]>([]);
  const [layoutSnapshot, setLayoutSnapshot] = useState<LayoutItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const [deletedWidget, setDeletedWidget] = useState<DashboardWidget | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateSavedSnack, setTemplateSavedSnack] = useState(false);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ApiService.getDashboard(id).then(res => {
      if (res.success && res.data) {
        setDashboard(res.data);
        setWidgets(res.data.widgets);

        // Rebuild layout: ensure every widget has a layout item (handles template import bug)
        const stored = (res.data.layout ?? []) as LayoutItem[];
        const storedIds = new Set(stored.map(l => l.i));
        let nextY = stored.reduce((m, l) => Math.max(m, l.y + l.h), 0);
        const extra: LayoutItem[] = [];
        for (const w of res.data.widgets) {
          if (!storedIds.has(w.id)) {
            const size = DEFAULT_SIZES[w.type] ?? { w: 4, h: 3 };
            extra.push({ i: w.id, x: 0, y: nextY, ...size });
            nextY += size.h;
          }
        }
        setPendingLayout([...stored, ...extra]);
      } else {
        setError(res.error ?? 'Dashboard introuvable');
      }
      setLoading(false);
    });
  }, [id]);

  const canEdit = dashboard
    ? dashboard.ownerId === state.currentUser?.id ||
      dashboard.shares.some(s =>
        (s.shareType === 'USER' && s.targetId === state.currentUser?.id && s.permission === 'EDIT') ||
        (s.shareType === 'ROLE' && s.targetId === state.currentUser?.role && s.permission === 'EDIT')
      )
    : false;

  const canSaveTemplate = state.currentUser?.role === 'ADMIN' ||
    state.currentUser?.role === 'SUPER_ADMIN';

  const enterEditMode = () => {
    setLayoutSnapshot([...pendingLayout]);
    setIsEditMode(true);
    setSaveStatus('saved');
  };

  const cancelEditMode = () => {
    setPendingLayout(layoutSnapshot);
    setIsEditMode(false);
    setSaveStatus('saved');
  };

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setPendingLayout(newLayout);
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await ApiService.updateDashboard(id!, { layout: newLayout });
      setSaveStatus('saved');
    }, 800);
  };

  const handleDeleteWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setPendingLayout(prev => prev.filter(l => l.i !== widgetId));
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletedWidget(widget);
    setSnackbarOpen(true);
    deleteTimerRef.current = setTimeout(async () => {
      await ApiService.deleteWidget(id!, widgetId);
      setDeletedWidget(null);
      deleteTimerRef.current = null;
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (!deletedWidget || !deleteTimerRef.current) return;
    clearTimeout(deleteTimerRef.current);
    setWidgets(prev => [...prev, deletedWidget]);
    const { w, h } = DEFAULT_SIZES[deletedWidget.type] ?? { w: 4, h: 3 };
    const maxY = pendingLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setPendingLayout(prev => [...prev, { i: deletedWidget.id, x: 0, y: maxY, w, h }]);
    setDeletedWidget(null);
    setSnackbarOpen(false);
  };

  const handleWidgetAdded = (widget: DashboardWidget, newLayout: any[]) => {
    setWidgets(prev => [...prev, widget]);
    setPendingLayout(newLayout as LayoutItem[]);
    setDrawerOpen(false);
  };

  const handleWidgetUpdated = (widget: DashboardWidget) => {
    setWidgets(prev => prev.map(w => w.id === widget.id ? widget : w));
    setDrawerOpen(false);
    setEditingWidget(null);
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
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
        {isEditMode && <SaveIndicator status={saveStatus} />}
        <DashboardPeriodSelector value={globalPeriod} onChange={setGlobalPeriod} />
        <ExportMenu
          dashboard={dashboard}
          widgets={widgets}
          globalPeriod={globalPeriod}
          gridRef={gridRef}
        />
        {canSaveTemplate && !isEditMode && (
          <Tooltip title="Sauvegarder comme template">
            <Button
              variant="outlined"
              size="small"
              startIcon={<BookmarkIcon />}
              onClick={() => setSaveTemplateOpen(true)}
              sx={{ borderRadius: 2 }}
            >
              Template
            </Button>
          </Tooltip>
        )}
        {canEdit && !isEditMode && (
          <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={enterEditMode} sx={{ borderRadius: 2 }}>
            Modifier
          </Button>
        )}
        {isEditMode && (
          <Button variant="text" size="small" startIcon={<CloseIcon />} onClick={cancelEditMode} color="error" sx={{ borderRadius: 2 }}>
            Annuler
          </Button>
        )}
      </Box>

      <Box ref={gridRef}>
        {widgets.length === 0 && !isEditMode ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h6" color="text.secondary">Ce dashboard n'a pas encore de widgets.</Typography>
            {canEdit && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={enterEditMode} sx={{ mt: 2, borderRadius: 2 }}>
                Ajouter des widgets
              </Button>
            )}
          </Box>
        ) : isEditMode ? (
          <DashboardEditorGrid
            widgets={widgets}
            layout={pendingLayout}
            globalPeriod={globalPeriod}
            onLayoutChange={handleLayoutChange}
            onDeleteWidget={handleDeleteWidget}
            onEditWidget={w => { setEditingWidget(w); setDrawerOpen(true); }}
          />
        ) : (
          <Grid container spacing={2.5}>
            {widgets.map(widget => (
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

      {isEditMode && (
        <Fab
          color="primary"
          onClick={() => { setEditingWidget(null); setDrawerOpen(true); }}
          sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1200 }}
        >
          <AddIcon />
        </Fab>
      )}

      <WidgetDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingWidget(null); }}
        dashboardId={id!}
        editingWidget={editingWidget}
        onWidgetAdded={handleWidgetAdded}
        onWidgetUpdated={handleWidgetUpdated}
        currentLayout={pendingLayout}
      />

      {dashboard && (
        <SaveAsTemplateDialog
          open={saveTemplateOpen}
          onClose={() => setSaveTemplateOpen(false)}
          dashboard={dashboard}
          widgets={widgets}
          layout={pendingLayout}
          onSaved={() => setTemplateSavedSnack(true)}
        />
      )}

      <Snackbar
        open={templateSavedSnack}
        autoHideDuration={3000}
        onClose={() => setTemplateSavedSnack(false)}
        message="Template sauvegardé avec succès"
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message="Widget supprimé"
        action={
          <Button color="warning" size="small" onClick={handleUndoDelete}>
            Annuler
          </Button>
        }
      />
    </Box>
  );
};
