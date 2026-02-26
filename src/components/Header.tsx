import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Chip,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Avatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Refresh as ResetIcon,
  AccountCircle as AccountIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { PageType } from '../types';
import logoImage from '../assets/OC_logo.png';
import { useUser } from '../contexts/UserContext';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
  currentPage: PageType;
  onReset?: () => void;
  onPageChange: (page: PageType) => void;
  onChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentPage, onReset, onPageChange, onChangePassword }) => {
  const { t } = useTranslation();
  const { state: userState, logout, getRoleLabel } = useUser();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const pageTitle: Record<PageType, string> = {
    home: t('navigation.home'),
    clients: t('navigation.clients'),
    'credit-scoring': 'Score Crédit',
    'credit-application': 'Demande de Crédit',
    workflow: 'Workflow d\'Approbation',
    analytics: 'Tableau de Bord',
    configuration: 'Configuration',
    'data-input': t('navigation.dataInput'),
    upload: 'Import Excel',
    'manual-input': 'Saisie Manuelle',
    analysis: t('navigation.analysis'),
    reports: t('navigation.reports'),
    settings: t('navigation.settings'),
    documentation: t('navigation.documentation'),
    'bank-holidays-admin': 'Jours Fériés',
    'user-management': t('navigation.userManagement'),
    'approval-limits': 'Limites d\'Approbation',
    'credit-simulation': 'Simulateur de Crédit',
    'credit-types': 'Types de Crédit',
    profile: 'Mon Profil',
    backup: 'Sauvegarde & Restauration',
    announcements: 'Notes d\'information',
    'notifications-config': 'Configuration Notifications',
  };

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  const handleAccountSettings = () => {
    // Navigate to settings page
    onPageChange('settings');
    handleUserMenuClose();
  };

  const handleProfile = () => {
    // Navigate to user profile page
    onPageChange('profile');
    handleUserMenuClose();
  };

  const handleChangePasswordClick = () => {
    if (onChangePassword) {
      onChangePassword();
    }
    handleUserMenuClose();
  };

  // Generate initials from user name
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };
  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'primary.main',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={onMenuClick}
          edge="start"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <img 
            src={logoImage}
            alt="Optimus Credit" 
            style={{ 
              height: '40px',
              marginRight: '12px'
            }}
            onError={(e) => {
              // Fallback if logo doesn't load
              e.currentTarget.style.display = 'none';
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography 
              variant="h6" 
              noWrap 
              component="div" 
              sx={{ 
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              OptimusCredit
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1,
              }}
            >
              {t('header.subtitle')}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label={pageTitle[currentPage]}
            color="secondary"
            variant="outlined"
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.3)',
              '& .MuiChip-label': {
                fontWeight: 500,
              },
            }}
          />
          {userState.isAuthenticated && (
            <NotificationBell onPageChange={onPageChange} />
          )}

          {onReset && (
            <Tooltip title="Réinitialiser la session et recommencer">
              <Button
                variant="outlined"
                size="small"
                onClick={onReset}
                startIcon={<ResetIcon />}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)',
                  ml: 2,
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                  display: { xs: 'none', md: 'flex' },
                }}
              >
                Reset
              </Button>
            </Tooltip>
          )}

          {/* User Profile Section */}
          {userState.isAuthenticated && userState.currentUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
              {/* User Info - Hidden on mobile */}
              <Box 
                sx={{ 
                  display: { xs: 'none', md: 'flex' }, 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  mr: 2
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'white',
                    fontWeight: 600,
                    lineHeight: 1.2
                  }}
                >
                  {userState.currentUser.name}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: 1.2
                  }}
                >
                  {getRoleLabel(userState.currentUser.role)}
                </Typography>
              </Box>

              {/* User Avatar with Menu */}
              <Tooltip title="Profil utilisateur">
                <IconButton
                  onClick={handleUserMenuClick}
                  sx={{ 
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                    }
                  }}
                >
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: '#4caf50',
                          border: '2px solid white',
                        }}
                      />
                    }
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: 'secondary.main',
                        width: 40,
                        height: 40,
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    >
                      {getUserInitials(userState.currentUser.name)}
                    </Avatar>
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* User Menu */}
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                PaperProps={{
                  sx: {
                    minWidth: 280,
                    mt: 1.5,
                    '& .MuiMenuItem-root': {
                      px: 2,
                      py: 1.5,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* User Info Header */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'primary.main',
                        width: 48,
                        height: 48,
                        mr: 2
                      }}
                    >
                      {getUserInitials(userState.currentUser.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {userState.currentUser.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {userState.currentUser.email}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    icon={<WorkIcon />}
                    label={getRoleLabel(userState.currentUser.role)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {userState.currentUser.department && (
                    <Chip
                      label={userState.currentUser.department}
                      size="small"
                      sx={{ ml: 1 }}
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Menu Items */}
                <MenuItem onClick={handleProfile}>
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Mon Profil" />
                </MenuItem>

                <MenuItem onClick={handleAccountSettings}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Paramètres du Compte" />
                </MenuItem>

                <MenuItem onClick={handleChangePasswordClick}>
                  <ListItemIcon>
                    <LockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Changer mon mot de passe" />
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Se Déconnecter" />
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};