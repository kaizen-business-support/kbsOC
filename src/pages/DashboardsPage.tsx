import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Bookmark as TemplateIcon,
  Dashboard as DashboardIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { Dashboard, DashboardTemplate, DashboardWidget } from '../types';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useUser } from '../contexts/UserContext';

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #667eea 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #4481eb 0%, #04befe 100%)',
];
const WIDGET_LABELS: Record<string, string> = {
  kpi_card: 'KPI', bar_chart: 'Barres', line_chart: 'Courbe',
  gauge: 'Jauge', table: 'Tableau',
};

function pickGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function DashboardMiniPreview({ id, widgets }: { id: string; widgets: DashboardWidget[] }) {
  const gradient = pickGradient(id);
  const typeCounts = widgets.reduce((acc, w) => { acc[w.type] = (acc[w.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  const typeEntries = Object.entries(typeCounts).slice(0, 5);

  return (
    <Box sx={{ height: 140, background: gradient, position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      {/* Cercles décoratifs */}
      <Box sx={{ position: 'absolute', top: -28, right: -28, width: 110, height: 110, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ position: 'absolute', bottom: -40, left: -18, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)' }} />
      <Box sx={{ position: 'absolute', top: 20, right: 50, width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />

      {/* Grande icône en filigrane */}
      <DashboardIcon sx={{ position: 'absolute', bottom: -10, right: 6, fontSize: 100, color: 'rgba(255,255,255,0.1)' }} />

      {/* Compteur de widgets */}
      <Box sx={{ position: 'absolute', top: 14, left: 16 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.73rem', fontWeight: 800, letterSpacing: 0.3 }}>
          {widgets.length === 0 ? 'Aucun widget' : `${widgets.length} widget${widgets.length > 1 ? 's' : ''}`}
        </Typography>
      </Box>

      {/* Chips types de widgets */}
      {typeEntries.length > 0 && (
        <Box sx={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 0.6, flexWrap: 'wrap', maxWidth: 'calc(100% - 28px)' }}>
          {typeEntries.map(([type, count]) => (
            <Chip
              key={type}
              label={`${WIDGET_LABELS[type] ?? type}${count > 1 ? ` ×${count}` : ''}`}
              size="small"
              sx={{
                height: 22, fontSize: '0.63rem', fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.22)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.32)',
                backdropFilter: 'blur(6px)',
                '& .MuiChip-label': { px: 0.9 },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export const DashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { canAction } = useModuleAccess();
  const { state: userState } = useUser();
  const currentUserId = userState.currentUser?.id;

  const canCreate         = canAction('dashboard-builder', 'create');
  const canUseTemplate    = canAction('dashboard-builder', 'templates_use');
  const canCreateTemplate = canAction('dashboard-builder', 'templates_create');

  // Dashboards
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // New dashboard dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename dashboard dialog
  const [renamingDashboard, setRenamingDashboard] = useState<Dashboard | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete dashboard dialog
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [deletingDash, setDeletingDash] = useState(false);

  // Apply template dialog
  const [applyTarget, setApplyTarget] = useState<DashboardTemplate | null>(null);
  const [applyName, setApplyName] = useState('');
  const [applying, setApplying] = useState(false);

  // Delete template confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDashboards = async () => {
    setLoading(true);
    setError(null);
    const res = await ApiService.getDashboards();
    if (res.success && res.data) setDashboards(res.data);
    else setError(res.error || 'Erreur lors du chargement');
    setLoading(false);
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const res = await ApiService.getDashboardTemplates();
    if (res.success && res.data) setTemplates(res.data);
    else if (!res.success) setError(res.error || 'Erreur lors du chargement des templates');
    setLoadingTemplates(false);
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setLoadingTemplates(true);
      setError(null);

      const [dashRes, tmplRes] = await Promise.all([
        ApiService.getDashboards(),
        ApiService.getDashboardTemplates(),
      ]);

      if (!active) return;

      if (dashRes.success && dashRes.data) setDashboards(dashRes.data);
      else setError(dashRes.error || 'Erreur lors du chargement des dashboards');
      setLoading(false);

      if (tmplRes.success && tmplRes.data) setTemplates(tmplRes.data);
      else if (!tmplRes.success) setError(prev => prev || 'Erreur lors du chargement des templates');
      setLoadingTemplates(false);
    };

    run();
    return () => { active = false; };
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await ApiService.createDashboard({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
    });
    setCreating(false);
    if (res.success) {
      setNewDialogOpen(false);
      setNewName('');
      setNewDesc('');
      loadDashboards();
    } else {
      setError(res.error || 'Erreur lors de la création');
    }
  };

  const handleRename = async () => {
    if (!renamingDashboard || !renameValue.trim()) return;
    setRenaming(true);
    const res = await ApiService.updateDashboard(renamingDashboard.id, { name: renameValue.trim() });
    setRenaming(false);
    if (res.success && res.data) {
      setDashboards(prev => prev.map(d => d.id === renamingDashboard.id ? { ...d, name: renameValue.trim() } : d));
      setRenamingDashboard(null);
    } else {
      setError(res.error || 'Erreur lors du renommage');
    }
  };

  const handleDeleteDashboard = async () => {
    if (!deletingDashboard) return;
    setDeletingDash(true);
    const res = await ApiService.deleteDashboard(deletingDashboard.id);
    setDeletingDash(false);
    if (res.success) {
      setDashboards(prev => prev.filter(d => d.id !== deletingDashboard.id));
      setDeletingDashboard(null);
    } else {
      setError(res.error || 'Erreur lors de la suppression');
      setDeletingDashboard(null);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyTarget || !applyName.trim()) return;
    setApplying(true);
    const res = await ApiService.applyDashboardTemplate(applyTarget.id, applyName.trim());
    setApplying(false);
    if (res.success && res.data) {
      setApplyTarget(null);
      navigate(`/dashboard-builder/${res.data.id}`);
    } else {
      setError(res.error || "Erreur lors de l'application du template");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    const res = await ApiService.deleteDashboardTemplate(deleteConfirmId);
    setDeleting(false);
    if (res.success) {
      setDeleteConfirmId(null);
      loadTemplates();
    } else {
      setError(res.error || 'Erreur lors de la suppression du template');
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#1a1a2e">Mes Dashboards</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Créez et gérez vos tableaux de bord personnalisés
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewDialogOpen(true)}
            sx={{
              borderRadius: 3,
              background: 'linear-gradient(135deg, #1565c0, #0277bd)',
              boxShadow: '0 4px 16px rgba(21,101,192,0.35)',
            }}
          >
            Nouveau
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Mes dashboards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : dashboards.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <DashboardIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>Aucun dashboard</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Créez votre premier dashboard ou partez d'un template.
          </Typography>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDialogOpen(true)} sx={{ borderRadius: 3 }}>
              Créer un dashboard
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {dashboards.map(d => {
            const isOwner = d.ownerId === currentUserId;
            return (
              <Grid item xs={12} sm={6} md={4} key={d.id}>
                <Card sx={{ borderRadius: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.06)', height: '100%', position: 'relative' }}>
                  <CardActionArea
                    onClick={() => navigate(`/dashboard-builder/${d.id}`)}
                    sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <DashboardMiniPreview id={d.id} widgets={d.widgets} />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="#1a1a2e" gutterBottom noWrap>
                        {d.name}
                      </Typography>
                      {d.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          {d.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
                        {d.isShared && (
                          <Chip icon={<ShareIcon sx={{ fontSize: 12 }} />} label="Partagé" size="small" color="primary" variant="outlined" />
                        )}
                        {d.templateSourceId && (
                          <Chip label="Template" size="small" variant="outlined" />
                        )}
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: 12 }} />}
                          label={formatDate(d.updatedAt)}
                          size="small"
                          sx={{ ml: 'auto', color: 'text.secondary', bgcolor: '#f8fafc' }}
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>

                  {/* Actions renommer / supprimer (propriétaire uniquement) */}
                  {isOwner && (
                    <Box
                      sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Tooltip title="Renommer">
                        <IconButton
                          size="small"
                          onClick={e => { e.stopPropagation(); setRenameValue(d.name); setRenamingDashboard(d); }}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                            color: '#1565c0', width: 26, height: 26,
                            '&:hover': { bgcolor: '#e3f2fd' },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          onClick={e => { e.stopPropagation(); setDeletingDashboard(d); }}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                            color: '#e53e3e', width: 26, height: 26,
                            '&:hover': { bgcolor: '#fff5f5' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Section templates */}
      {canUseTemplate && !loadingTemplates && templates.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <TemplateIcon sx={{ color: '#1565c0', fontSize: 22 }} />
            <Typography variant="h6" fontWeight={700} color="#1a1a2e">
              Templates disponibles
            </Typography>
            <Chip label={`${templates.length}`} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700 }} />
          </Box>
          <Grid container spacing={2.5}>
            {templates.map(t => (
              <Grid item xs={12} sm={6} md={4} key={t.id}>
                <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.1)', height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <TemplateIcon sx={{ color: '#1565c0', fontSize: 18, mt: 0.3 }} />
                      <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
                        {t.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Chip
                          label={t.isGlobal ? 'Global' : 'Société'}
                          size="small"
                          color={t.isGlobal ? 'info' : 'success'}
                          sx={{ fontSize: '0.65rem' }}
                        />
                        {canCreateTemplate && !t.isGlobal && (
                          <Tooltip title="Supprimer ce template">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteConfirmId(t.id)}
                              sx={{ color: '#e53e3e', p: 0.5 }}
                            >
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    {t.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {t.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
                      {t.widgets.length} widget{t.widgets.length !== 1 ? 's' : ''}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={{ borderRadius: 2 }}
                      onClick={() => { setApplyTarget(t); setApplyName(t.name); }}
                    >
                      Utiliser
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Dialog : nouveau dashboard */}
      <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Nouveau dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nom *" value={newName}
            onChange={e => setNewName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <TextField
            fullWidth label="Description (optionnelle)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)} multiline rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || creating} sx={{ borderRadius: 2 }}>
            {creating ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : renommer un dashboard */}
      <Dialog open={Boolean(renamingDashboard)} onClose={() => setRenamingDashboard(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Renommer le dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nouveau nom *" value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenamingDashboard(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleRename} disabled={!renameValue.trim() || renaming} sx={{ borderRadius: 2 }}>
            {renaming ? <CircularProgress size={20} /> : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : confirmer suppression dashboard */}
      <Dialog open={Boolean(deletingDashboard)} onClose={() => setDeletingDashboard(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Supprimer ce dashboard ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Le dashboard <b>{deletingDashboard?.name}</b> et tous ses widgets seront définitivement supprimés. Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeletingDashboard(null)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDeleteDashboard} disabled={deletingDash} sx={{ borderRadius: 2 }}>
            {deletingDash ? <CircularProgress size={20} color="inherit" /> : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : appliquer un template */}
      <Dialog open={Boolean(applyTarget)} onClose={() => setApplyTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Créer un dashboard depuis "{applyTarget?.name}"</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Nom du nouveau dashboard *" value={applyName}
            onChange={e => setApplyName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleApplyTemplate()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApplyTarget(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleApplyTemplate} disabled={!applyName.trim() || applying} sx={{ borderRadius: 2 }}>
            {applying ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : confirmer suppression template */}
      <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Supprimer ce template ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Cette action est irréversible. Les dashboards créés depuis ce template ne seront pas affectés.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTemplate} disabled={deleting} sx={{ borderRadius: 2 }}>
            {deleting ? <CircularProgress size={20} color="inherit" /> : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
