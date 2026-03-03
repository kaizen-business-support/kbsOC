import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import { useApp } from '../contexts/AppContext';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import optimusIcon from '../assets/Optimus_icon.png';
import {
  Settings as SettingsIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Language as LanguageIcon,
  Palette as PaletteIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Event as EventIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Shield as ShieldIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { authPasswordApi } from '../services/api';
import api from '../services/api';
import { PageType } from '../types';

interface SettingsPageProps {
  onNavigate: (page: PageType) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { state, setTheme } = useApp();
  const { isRole } = useUser();
  const { i18n, t } = useTranslation();

  // Check if user has access to configuration
  const canViewConfiguration = isRole('admin') || isRole('management');
  const canEditConfiguration = isRole('admin');

  // ── 2FA Admin state ──────────────────────────────────────────────────────────
  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGEMENT: 'Directeur Général',
    BRANCH_MANAGER: "Directeur d'Agence",
    ACCOUNT_MANAGER: "Chargé d'Affaires",
    CREDIT_ANALYST: 'Analyste Crédit',
    CREDIT_COMMITTEE: 'Comité de Crédit',
  };
  const ALL_ROLES = Object.keys(ROLE_LABELS);

  const [roles2FA, setRoles2FA] = useState<Record<string, boolean>>({});
  const [users2FA, setUsers2FA] = useState<any[]>([]);
  const [loading2FA, setLoading2FA] = useState(false);
  const [error2FA, setError2FA] = useState('');
  const [saving2FA, setSaving2FA] = useState<string | null>(null);

  useEffect(() => {
    if (!canEditConfiguration) return;
    setLoading2FA(true);
    Promise.all([
      api.get('/roles'),
      api.get('/users'),
    ])
      .then(([rolesRes, usersRes]) => {
        const rolesMap: Record<string, boolean> = {};
        (rolesRes.data.roles || rolesRes.data || []).forEach((r: any) => {
          // API returns field "name" for the role enum value
          rolesMap[r.name || r.role] = r.twoFactorRequired ?? false;
        });
        setRoles2FA(rolesMap);
        setUsers2FA(usersRes.data.users || []);
      })
      .catch(() => setError2FA('Impossible de charger les paramètres 2FA.'))
      .finally(() => setLoading2FA(false));
  }, [canEditConfiguration]);

  const handleRoleToggle = async (role: string, required: boolean) => {
    setSaving2FA(`role-${role}`);
    try {
      await authPasswordApi.setRole2FARequired(role, required);
      setRoles2FA(prev => ({ ...prev, [role]: required }));
    } catch {
      setError2FA(`Erreur lors de la modification du rôle ${ROLE_LABELS[role]}.`);
    } finally {
      setSaving2FA(null);
    }
  };

  const handleUserToggle = async (userId: string, required: boolean) => {
    setSaving2FA(`user-${userId}`);
    try {
      await authPasswordApi.setUser2FARequired(userId, required);
      setUsers2FA(prev => prev.map(u => u.id === userId ? { ...u, twoFactorRequired: required } : u));
    } catch {
      setError2FA('Erreur lors de la modification du paramètre 2FA utilisateur.');
    } finally {
      setSaving2FA(null);
    }
  };

  // ── Audit Log state ───────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]         = useState<any[]>([]);
  const [auditLoading, setAuditLoading]   = useState(false);
  const [auditError, setAuditError]       = useState('');
  const [auditPage, setAuditPage]         = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotal, setAuditTotal]       = useState(0);
  const [auditUsers, setAuditUsers]       = useState<any[]>([]);
  const [auditActions, setAuditActions]   = useState<string[]>([]);
  const [auditFilters, setAuditFilters]   = useState({
    userId:     '',
    action:     '',
    entityType: '',
    dateFrom:   '',
    dateTo:     '',
  });

  const fetchAuditLogs = useCallback(async (page = auditPage, rowsPerPage = auditRowsPerPage, filters = auditFilters) => {
    if (!canEditConfiguration) return;
    setAuditLoading(true);
    setAuditError('');
    try {
      const params: any = { page: page + 1, limit: rowsPerPage };
      if (filters.userId)     params.userId     = filters.userId;
      if (filters.action)     params.action     = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.dateFrom)   params.dateFrom   = filters.dateFrom;
      if (filters.dateTo)     params.dateTo     = filters.dateTo;
      const res = await api.get('/audit-logs', { params });
      setAuditLogs(res.data.logs || []);
      setAuditTotal(res.data.pagination?.total || 0);
    } catch {
      setAuditError('Impossible de charger le journal d\'activité.');
    } finally {
      setAuditLoading(false);
    }
  }, [canEditConfiguration, auditPage, auditRowsPerPage, auditFilters]);

  // Load audit log support data (users list + distinct actions) once
  useEffect(() => {
    if (!canEditConfiguration) return;
    api.get('/users').then(r => setAuditUsers(r.data.users || [])).catch(() => {});
    api.get('/audit-logs/actions').then(r => setAuditActions(r.data.actions || [])).catch(() => {});
  }, [canEditConfiguration]);

  // Fetch logs whenever page / filters change
  useEffect(() => {
    fetchAuditLogs(auditPage, auditRowsPerPage, auditFilters);
  }, [auditPage, auditRowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuditSearch = () => {
    setAuditPage(0);
    fetchAuditLogs(0, auditRowsPerPage, auditFilters);
  };

  const handleAuditFilterChange = (field: string, value: string) => {
    setAuditFilters(prev => ({ ...prev, [field]: value }));
  };

  const ROLE_LABEL_MAP: Record<string, string> = {
    ADMIN:            'Administrateur',
    MANAGEMENT:       'Directeur Général',
    BRANCH_MANAGER:   "Dir. d'Agence",
    ACCOUNT_MANAGER:  "Chargé d'Affaires",
    CREDIT_ANALYST:   'Analyste Crédit',
    CREDIT_COMMITTEE: 'Comité de Crédit',
  };

  const formatAuditDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const ACTION_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
    CREATE: 'success',
    UPDATE: 'warning',
    DELETE: 'error',
  };

  const getActionColor = (action: string): 'error' | 'warning' | 'success' | 'default' => {
    const verb = action.split('_')[0];
    return ACTION_COLOR[verb] || 'default';
  };

  const handleThemeChange = (event: React.MouseEvent<HTMLElement>, newTheme: 'light' | 'dark') => {
    if (newTheme !== null && canEditConfiguration) {
      setTheme(newTheme);
    }
  };

  const handleLanguageChange = (event: React.MouseEvent<HTMLElement>, newLanguage: 'fr' | 'en') => {
    if (newLanguage !== null && canEditConfiguration) {
      i18n.changeLanguage(newLanguage);
      localStorage.setItem('optimus_language', newLanguage);
    }
  };

  const features = [
    {
      icon: <SpeedIcon />,
      title: t('settings.features.optimizedPerformance'),
      description: t('settings.features.optimizedPerformanceDesc'),
      status: 'active',
    },
    {
      icon: <SecurityIcon />,
      title: t('settings.features.advancedSecurity'),
      description: t('settings.features.advancedSecurityDesc'),
      status: 'active',
    },
    {
      icon: <TrendingUpIcon />,
      title: t('settings.features.multiYearAnalysis'),
      description: t('settings.features.multiYearAnalysisDesc'),
      status: 'active',
    },
    {
      icon: <StorageIcon />,
      title: t('settings.features.professionalExport'),
      description: t('settings.features.professionalExportDesc'),
      status: 'active',
    },
  ];

  const systemInfo = [
    { label: t('settings.systemInfo.version'), value: '2.0.0' },
    { label: t('settings.systemInfo.lastUpdate'), value: t('settings.systemInfo.lastUpdateDate') },
    { label: t('settings.systemInfo.licenseType'), value: t('settings.systemInfo.professional') },
    { label: t('settings.systemInfo.status'), value: t('settings.systemInfo.active') },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        {t('settings.title')}
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          {/* System Information */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <InfoIcon sx={{ mr: 1 }} />
                {t('settings.systemInfo.title')}
              </Typography>
              
              <Grid container spacing={2}>
                {systemInfo.map((item, index) => (
                  <Grid item xs={6} sm={3} key={index}>
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {item.label}
                      </Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                {t('settings.features.title')}
              </Typography>
              
              <List>
                {features.map((feature, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                        {feature.icon}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={feature.title}
                      secondary={feature.description}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                    <Chip
                      label={feature.status === 'active' ? t('settings.systemInfo.active') : 'Inactif'}
                      color={feature.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Configuration Options */}
          {canViewConfiguration && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <SettingsIcon sx={{ mr: 1 }} />
                  {t('settings.configuration.title')}
                  {!canEditConfiguration && (
                    <Chip
                      icon={<VisibilityIcon />}
                      label="Lecture seule"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 2 }}
                    />
                  )}
                  {canEditConfiguration && (
                    <Chip
                      icon={<LockIcon />}
                      label="Administration"
                      size="small"
                      color="primary"
                      sx={{ ml: 2 }}
                    />
                  )}
                </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <LanguageIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('settings.configuration.language.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {t('settings.configuration.language.description')}
                    </Typography>
                    <ToggleButtonGroup
                      value={i18n.language}
                      exclusive
                      onChange={handleLanguageChange}
                      size="small"
                      disabled={!canEditConfiguration}
                      sx={{ 
                        mt: 1,
                        '& .MuiToggleButton-root': {
                          color: 'text.primary',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                          '&.Mui-selected': {
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            '&:hover': {
                              backgroundColor: 'primary.dark',
                            },
                          },
                        },
                      }}
                    >
                      <ToggleButton value="fr">
                        {t('settings.configuration.language.french')}
                      </ToggleButton>
                      <ToggleButton value="en">
                        {t('settings.configuration.language.english')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <PaletteIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('settings.configuration.theme.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {t('settings.configuration.theme.description')}
                    </Typography>
                    <ToggleButtonGroup
                      value={state.theme}
                      exclusive
                      onChange={handleThemeChange}
                      size="small"
                      disabled={!canEditConfiguration}
                      sx={{ 
                        mt: 1,
                        '& .MuiToggleButton-root': {
                          color: 'text.primary',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                          '&.Mui-selected': {
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            '&:hover': {
                              backgroundColor: 'primary.dark',
                            },
                          },
                        },
                      }}
                    >
                      <ToggleButton value="light">
                        {t('settings.configuration.theme.light')}
                      </ToggleButton>
                      <ToggleButton value="dark">
                        {t('settings.configuration.theme.dark')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <EventIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Jours Fériés
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Configuration des jours fériés et délais de traitement
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => canEditConfiguration && onNavigate('bank-holidays-admin')}
                      size="small"
                      disabled={!canEditConfiguration}
                      sx={{
                        mt: 1,
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText',
                        },
                      }}
                    >
                      Configurer
                    </Button>
                  </Card>
                </Grid>


              </Grid>
            </CardContent>
          </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* About */}
          <Card sx={{ 
            mb: 3,
            background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
            color: '#1f4e79',
          }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'transparent',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <img 
                  src={optimusIcon}
                  alt="OptimusCredit Logo" 
                  style={{ 
                    width: '60px',
                    height: '60px'
                  }}
                />
              </Avatar>
              
              <Typography variant="h5" fontWeight={600} gutterBottom sx={{ color: '#1f4e79' }}>
                {t('settings.about.title')}
              </Typography>
              
              <Typography variant="body2" paragraph sx={{ color: '#1f4e79', opacity: 0.8 }}>
                {t('settings.about.description')}
              </Typography>

              <Chip
                label={t('settings.about.version')}
                sx={{ 
                  mb: 2,
                  bgcolor: 'rgba(31,78,121,0.1)',
                  color: '#1f4e79',
                  borderColor: '#1f4e79',
                  border: '1px solid'
                }}
              />

              <Typography variant="body2" sx={{ color: '#1f4e79', opacity: 0.8 }}>
                {t('settings.about.developedBy')} <strong>{t('settings.about.company')}</strong>
              </Typography>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('settings.support.title')}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('settings.support.description')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => window.open('mailto:contact@kaizen-corporation.com')}
                >
                  {t('settings.support.contactSupport')}
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => onNavigate('documentation')}
                >
                  {t('settings.support.userGuide')}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" align="center">
                {t('settings.support.copyright')}
                <br />
                {t('settings.support.allRightsReserved')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* 2FA Management (admin only) */}
        {canEditConfiguration && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <ShieldIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Gestion de l'authentification à deux facteurs (2FA)
                  </Typography>
                  <Chip label="Administration" size="small" color="primary" sx={{ ml: 2 }} />
                </Box>

                {error2FA && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError2FA('')}>
                    {error2FA}
                  </Alert>
                )}

                {loading2FA ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={4}>
                    {/* 2FA par rôle */}
                    <Grid item xs={12} md={5}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Par rôle
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Tous les utilisateurs du rôle seront obligés de configurer le 2FA.
                      </Typography>
                      <List dense disablePadding>
                        {ALL_ROLES.map(role => (
                          <ListItem
                            key={role}
                            sx={{ px: 0, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                          >
                            <ListItemText
                              primary={ROLE_LABELS[role]}
                              primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={roles2FA[role] ? 'Obligatoire' : 'Optionnel'}
                                size="small"
                                color={roles2FA[role] ? 'success' : 'default'}
                                sx={{ minWidth: 80 }}
                              />
                              {saving2FA === `role-${role}` ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  checked={roles2FA[role] ?? false}
                                  onChange={(e) => handleRoleToggle(role, e.target.checked)}
                                  size="small"
                                />
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </Grid>

                    {/* 2FA par utilisateur */}
                    <Grid item xs={12} md={7}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Par utilisateur
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Forcer le 2FA pour un utilisateur spécifique, indépendamment de son rôle.
                      </Typography>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Rôle</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>2FA activé</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>Obligatoire</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {users2FA.filter(u => u.isActive).map((user: any) => (
                              <TableRow key={user.id} hover>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={500}>{user.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={ROLE_LABELS[user.role] || user.role}
                                    size="small"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={user.twoFactorEnabled ? 'Oui' : 'Non'}
                                    size="small"
                                    color={user.twoFactorEnabled ? 'success' : 'default'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  {(() => {
                                    const byRole = roles2FA[user.role] ?? false;
                                    const isRequired = user.twoFactorRequired || byRole;
                                    return (
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                        {byRole && (
                                          <Chip label="Via rôle" size="small" color="info" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                                        )}
                                        {saving2FA === `user-${user.id}` ? (
                                          <CircularProgress size={20} />
                                        ) : (
                                          <Switch
                                            checked={isRequired}
                                            onChange={(e) => handleUserToggle(user.id, e.target.checked)}
                                            size="small"
                                            disabled={byRole}
                                          />
                                        )}
                                      </Box>
                                    );
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Journal d'activité (admin only) ── */}
        {canEditConfiguration && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                  <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                    Journal d'activité
                  </Typography>
                  <Chip label="Administration" size="small" color="primary" />
                  <Chip
                    label="Conservation 60 j"
                    size="small"
                    variant="outlined"
                    icon={<HistoryIcon sx={{ fontSize: 14 }} />}
                  />
                  <Tooltip title="Rafraîchir">
                    <IconButton size="small" onClick={() => fetchAuditLogs(auditPage, auditRowsPerPage, auditFilters)} disabled={auditLoading}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Filters */}
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    mb: 2,
                    p: 2,
                    bgcolor: '#f8fafc',
                    borderRadius: 2,
                    border: '1px solid #e8ecf0',
                  }}
                >
                  <FilterListIcon sx={{ color: '#9ca3af', alignSelf: 'center', mr: 0.5 }} />

                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Utilisateur</InputLabel>
                    <Select
                      label="Utilisateur"
                      value={auditFilters.userId}
                      onChange={(e) => handleAuditFilterChange('userId', e.target.value)}
                    >
                      <MenuItem value="">Tous</MenuItem>
                      {auditUsers.filter(u => u.isActive).map((u: any) => (
                        <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Action</InputLabel>
                    <Select
                      label="Action"
                      value={auditFilters.action}
                      onChange={(e) => handleAuditFilterChange('action', e.target.value)}
                    >
                      <MenuItem value="">Toutes</MenuItem>
                      {auditActions.map(a => (
                        <MenuItem key={a} value={a}>{a}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Type d'entité</InputLabel>
                    <Select
                      label="Type d'entité"
                      value={auditFilters.entityType}
                      onChange={(e) => handleAuditFilterChange('entityType', e.target.value)}
                    >
                      <MenuItem value="">Tous</MenuItem>
                      {['client','application','workflow','user','role','backup','announcement','notification_channel'].map(t => (
                        <MenuItem key={t} value={t}>{t}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    label="Date début"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={auditFilters.dateFrom}
                    onChange={(e) => handleAuditFilterChange('dateFrom', e.target.value)}
                    sx={{ minWidth: 140 }}
                  />

                  <TextField
                    size="small"
                    label="Date fin"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={auditFilters.dateTo}
                    onChange={(e) => handleAuditFilterChange('dateTo', e.target.value)}
                    sx={{ minWidth: 140 }}
                  />

                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAuditSearch}
                    disabled={auditLoading}
                    sx={{ alignSelf: 'center' }}
                  >
                    Filtrer
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const reset = { userId: '', action: '', entityType: '', dateFrom: '', dateTo: '' };
                      setAuditFilters(reset);
                      setAuditPage(0);
                      fetchAuditLogs(0, auditRowsPerPage, reset);
                    }}
                    disabled={auditLoading}
                    sx={{ alignSelf: 'center' }}
                  >
                    Réinitialiser
                  </Button>
                </Box>

                {/* Error */}
                {auditError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAuditError('')}>
                    {auditError}
                  </Alert>
                )}

                {/* Table */}
                {auditLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            {['Horodatage', 'Utilisateur', 'Rôle', 'Action', 'Entité', 'ID', 'Adresse IP'].map(h => (
                              <TableCell
                                key={h}
                                sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5, whiteSpace: 'nowrap' }}
                              >
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {auditLogs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#9ca3af' }}>
                                Aucune entrée trouvée
                              </TableCell>
                            </TableRow>
                          ) : auditLogs.map((log: any) => (
                            <TableRow
                              key={log.id}
                              sx={{
                                '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' },
                                borderBottom: '1px solid #f1f5f9',
                                '&:last-child': { borderBottom: 'none' },
                              }}
                            >
                              <TableCell sx={{ py: 1.25, fontSize: '12px', whiteSpace: 'nowrap', color: '#374151' }}>
                                {formatAuditDate(log.createdAt)}
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '13px' }}>
                                  {log.user?.name || '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {log.user?.email || ''}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                <Chip
                                  label={ROLE_LABEL_MAP[log.user?.role] || log.user?.role || '—'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '11px', height: 22 }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                <Chip
                                  label={log.action}
                                  size="small"
                                  color={getActionColor(log.action)}
                                  sx={{ fontSize: '11px', height: 22, fontFamily: 'monospace' }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 1.25, fontSize: '13px', color: '#374151' }}>
                                {log.entityType || '—'}
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                {log.entityId ? (
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '11px' }}>
                                    {log.entityId.length > 12 ? log.entityId.slice(0, 8) + '…' : log.entityId}
                                  </Typography>
                                ) : '—'}
                              </TableCell>
                              <TableCell sx={{ py: 1.25, fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>
                                {log.ipAddress || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <TablePagination
                      component="div"
                      count={auditTotal}
                      page={auditPage}
                      onPageChange={(_, p) => setAuditPage(p)}
                      rowsPerPage={auditRowsPerPage}
                      onRowsPerPageChange={(e) => { setAuditRowsPerPage(parseInt(e.target.value, 10)); setAuditPage(0); }}
                      rowsPerPageOptions={[10, 25, 50, 100]}
                      labelRowsPerPage="Lignes par page :"
                      labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};