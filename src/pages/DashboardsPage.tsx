import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  DashboardCustomize as TemplateIcon,
  Dashboard as DashboardIcon,
  Share as ShareIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { Dashboard, DashboardTemplate } from '../types';
import { useModuleAccess } from '../hooks/useModuleAccess';

export const DashboardsPage: React.FC = () => {
  const { canAction } = useModuleAccess();
  const canCreate = canAction('dashboard-builder', 'create');
  const canUseTemplate = canAction('dashboard-builder', 'templates_use');

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New dashboard dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await ApiService.getDashboards();
    if (res.success && res.data) {
      setDashboards(res.data);
    } else {
      setError(res.error || 'Erreur lors du chargement');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
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
      load();
    } else {
      setError(res.error || 'Erreur lors de la création');
    }
  };

  const openTemplateDialog = async () => {
    setTemplateDialogOpen(true);
    setLoadingTemplates(true);
    const res = await ApiService.getDashboardTemplates();
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setLoadingTemplates(false);
  };

  const handleApplyTemplate = async (templateId: string, templateName: string) => {
    setApplyingTemplate(templateId);
    const res = await ApiService.applyDashboardTemplate(templateId, templateName);
    setApplyingTemplate(null);
    if (res.success) {
      setTemplateDialogOpen(false);
      load();
    } else {
      setError(res.error || "Erreur lors de l'application du template");
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#1a1a2e">
            Mes Dashboards
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Créez et gérez vos tableaux de bord personnalisés
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {canUseTemplate && (
            <Button
              variant="outlined"
              startIcon={<TemplateIcon />}
              onClick={openTemplateDialog}
              sx={{ borderRadius: 3 }}
            >
              Depuis un template
            </Button>
          )}
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
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : dashboards.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <DashboardIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>
            Aucun dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Créez votre premier dashboard ou partez d'un template.
          </Typography>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewDialogOpen(true)}
              sx={{ borderRadius: 3 }}
            >
              Créer un dashboard
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {dashboards.map((d) => (
            <Grid item xs={12} sm={6} md={4} key={d.id}>
              <Card
                sx={{
                  borderRadius: 4,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  height: '100%',
                }}
              >
                <CardActionArea
                  sx={{
                    p: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  <Box
                    sx={{
                      height: 120,
                      bgcolor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center' }}>
                      <DashboardIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 0.5 }} />
                      <Typography variant="caption" color="text.disabled">
                        {d.widgets.length} widget{d.widgets.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      color="#1a1a2e"
                      gutterBottom
                      noWrap
                    >
                      {d.name}
                    </Typography>
                    {d.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1.5 }}
                      >
                        {d.description}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                        mt: 'auto',
                      }}
                    >
                      {d.isShared && (
                        <Chip
                          icon={<ShareIcon sx={{ fontSize: 12 }} />}
                          label="Partagé"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
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
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog : nouveau dashboard */}
      <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Nouveau dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nom *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <TextField
            fullWidth
            label="Description (optionnelle)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            sx={{ borderRadius: 2 }}
          >
            {creating ? <CircularProgress size={20} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog : choisir un template */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Choisir un template</DialogTitle>
        <DialogContent>
          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {templates.map((t) => (
                <Grid item xs={12} sm={6} key={t.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 2px 12px rgba(21,101,192,0.15)',
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleApplyTemplate(t.id, t.name)}
                      disabled={applyingTemplate === t.id}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <TemplateIcon sx={{ color: '#1565c0', fontSize: 20 }} />
                          <Typography variant="subtitle2" fontWeight={700}>
                            {t.name}
                          </Typography>
                          {t.isGlobal && (
                            <Chip
                              label="Global"
                              size="small"
                              color="info"
                              sx={{ ml: 'auto', fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                        {t.description && (
                          <Typography variant="caption" color="text.secondary">
                            {t.description}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: 'block', mt: 1 }}
                        >
                          {t.widgets.length} widget{t.widgets.length !== 1 ? 's' : ''}
                        </Typography>
                        {applyingTemplate === t.id && (
                          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                            <CircularProgress size={20} />
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTemplateDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
