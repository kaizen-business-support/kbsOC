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
    dispatching: 'Dispatching des Demandes',
    'credit-policy': 'Politique de Crédit',
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
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <IconButton
          color="primary"
          aria-label="open drawer"
          onClick={onMenuClick}
          edge="start"
          sx={{
            mr: 2,
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            '&:hover':  { transform: 'scale(1.08)' },
            '&:active': { transform: 'scale(0.90)' },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <img
            src={logoImage}
            alt="Optimus Credit"
            style={{ height: '28px', marginRight: '8px', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <Typography
            noWrap
            component="div"
            sx={{
              fontWeight:    700,
              fontSize:      '15px',
              fontFamily:    '"Inter", sans-serif',
              letterSpacing: '-0.2px',
              display:       { xs: 'none', sm: 'block' },
              // brand gradient text
              background:          'linear-gradient(135deg, #3A56A8 0%, #2878C8 52%, #28A8E2 100%)',
              WebkitBackgroundClip:'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip:      'text',
            }}
          >
            OptimusCredit
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1, md: 2 } }}>
          {/* Séparateur + titre de page */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: '1px', height: '16px', background: 'rgba(58,86,168,0.20)', borderRadius: '1px' }} />
            <Typography
              noWrap
              sx={{
                color:        '#6B7A99',
                fontSize:     '13px',
                fontFamily:   '"Inter", sans-serif',
                maxWidth:     { sm: 140, md: 220 },
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pageTitle[currentPage]}
            </Typography>
          </Box>
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
                  color: 'primary.main',
                  borderColor: 'rgba(31,78,121,0.30)',
                  ml: 2,
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(31,78,121,0.05)',
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
                  mr: 1.5,
                }}
              >
                <Typography sx={{ color: '#1F272E', fontWeight: 600, fontSize: '13px', lineHeight: 1.2, fontFamily: '"Inter", sans-serif' }}>
                  {userState.currentUser.name}
                </Typography>
                <Typography sx={{ color: '#8D99A6', fontSize: '11.5px', lineHeight: 1.2, fontFamily: '"Inter", sans-serif' }}>
                  {getRoleLabel(userState.currentUser.role)}
                </Typography>
              </Box>

              {/* User Avatar with Menu */}
              <Tooltip title="Mon compte" enterDelay={400}>
                <IconButton
                  onClick={handleUserMenuClick}
                  sx={{
                    p:          0.5,
                    borderRadius:'10px',
                    transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                    '&:hover':  { transform: 'scale(1.06)', bgcolor: 'rgba(58,86,168,0.06)' },
                    '&:active': { transform: 'scale(0.94)' },
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
                        background:  'linear-gradient(135deg, #3A56A8 0%, #2878C8 52%, #28A8E2 100%)',
                        width:       34,
                        height:      34,
                        fontSize:    '12px',
                        fontWeight:  600,
                        fontFamily:  '"Inter", sans-serif',
                        boxShadow:   '0 2px 8px rgba(40,120,200,0.30)',
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
                TransitionProps={{ timeout: { enter: 180, exit: 120 } }}
                PaperProps={{
                  sx: {
                    minWidth: 272,
                    mt:       1,
                    '& .MuiMenuItem-root': { px: 1.5, py: 1 },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* User Info Header */}
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E8EBED' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ background: 'linear-gradient(135deg, #3A56A8 0%, #28A8E2 100%)', width: 40, height: 40, fontSize: '13px', fontWeight: 600, fontFamily: '"Inter", sans-serif', boxShadow: '0 2px 8px rgba(40,120,200,0.30)' }}>
                      {getUserInitials(userState.currentUser.name)}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#1F272E', fontFamily: '"Inter", sans-serif', lineHeight: 1.3 }}>
                        {userState.currentUser.name}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#8D99A6', fontFamily: '"Inter", sans-serif', lineHeight: 1.3 }}>
                        {userState.currentUser.email}
                      </Typography>
                      <Box sx={{ mt: 0.75, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<WorkIcon style={{ fontSize: 11 }} />}
                          label={getRoleLabel(userState.currentUser.role)}
                          size="small"
                          color="primary"
                        />
                        {userState.currentUser.department && (
                          <Chip label={userState.currentUser.department} size="small" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                  </Box>
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