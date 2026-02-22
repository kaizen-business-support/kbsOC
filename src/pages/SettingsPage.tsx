import React from 'react';
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

} from '@mui/icons-material';
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
      </Grid>
    </Box>
  );
};