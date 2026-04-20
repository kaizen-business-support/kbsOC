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

// Design tokens — Clean Light Financial Dashboard
const HDR = {
  text:        '#0F172A',
  textMuted:   '#64748B',
  textSecond:  '#94A3B8',
  brand:       '#0F766E',
  separator:   '#E2E8F0',
  avatarGrad:  'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
  menuBg:      '#FFFFFF',
  menuBorder:  '#E2E8F0',
  menuDivider: '#F1F5F9',
  onlineGreen: '#10B981',
};

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
    'credit-types': 'Politique de Crédit',
    profile: 'Mon Profil',
    backup: 'Sauvegarde & Restauration',
    announcements: 'Notes d\'information',
    'notifications-config': 'Configuration Notifications',
    dispatching: 'Dispatching des Demandes',
    'credit-policy':    'Politique de Crédit',
    'company-settings': 'Paramètres Compagnie',
    'platform-admin':   'Administration Plateforme',
    'raci-matrix':      'Matrice RACI',
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
    onPageChange('settings');
    handleUserMenuClose();
  };

  const handleProfile = () => {
    onPageChange('profile');
    handleUserMenuClose();
  };

  const handleChangePasswordClick = () => {
    if (onChangePassword) onChangePassword();
    handleUserMenuClose();
  };

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
          aria-label="open drawer"
          onClick={onMenuClick}
          edge="start"
          sx={{
            mr:         2,
            color:      HDR.textMuted,
            transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            '&:hover':  { color: HDR.brand, transform: 'scale(1.08)' },
            '&:active': { transform: 'scale(0.90)' },
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Logo + App name */}
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
              fontFamily:    '"IBM Plex Sans", sans-serif',
              letterSpacing: '-0.2px',
              display:       { xs: 'none', sm: 'block' },
              background:    'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            OptimusCredit
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1, md: 2 } }}>
          {/* Page title */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: '1px', height: '16px', background: HDR.separator, borderRadius: '1px' }} />
            <Typography
              noWrap
              sx={{
                color:        HDR.textMuted,
                fontSize:     '13px',
                fontFamily:   '"IBM Plex Sans", sans-serif',
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
                  ml: 2,
                  display: { xs: 'none', md: 'flex' },
                }}
              >
                Reset
              </Button>
            </Tooltip>
          )}

          {/* User profile */}
          {userState.isAuthenticated && userState.currentUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              {/* Name + role — desktop only */}
              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  mr: 1.5,
                }}
              >
                <Typography sx={{
                  color: HDR.text, fontWeight: 600, fontSize: '13px', lineHeight: 1.2,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                }}>
                  {userState.currentUser.name}
                </Typography>
                <Typography sx={{
                  color: HDR.textSecond, fontSize: '11.5px', lineHeight: 1.2,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                }}>
                  {getRoleLabel(userState.currentUser.role)}
                </Typography>
              </Box>

              {/* Avatar */}
              <Tooltip title="Mon compte" enterDelay={400}>
                <IconButton
                  onClick={handleUserMenuClick}
                  sx={{
                    p:          0.5,
                    borderRadius:'10px',
                    transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                    '&:hover':  { transform: 'scale(1.06)', bgcolor: 'rgba(15,118,110,0.12)' },
                    '&:active': { transform: 'scale(0.94)' },
                  }}
                >
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      <Box sx={{
                        width: 12, height: 12, borderRadius: '50%',
                        bgcolor: HDR.onlineGreen,
                        border: '2px solid #FFFFFF',
                      }} />
                    }
                  >
                    <Avatar
                      sx={{
                        background: HDR.avatarGrad,
                        width:      34,
                        height:     34,
                        fontSize:   '12px',
                        fontWeight: 600,
                        fontFamily: '"IBM Plex Sans", sans-serif',
                        boxShadow:  '0 2px 8px rgba(15,118,110,0.35)',
                      }}
                    >
                      {getUserInitials(userState.currentUser.name)}
                    </Avatar>
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* User menu */}
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                TransitionProps={{ timeout: { enter: 180, exit: 120 } }}
                PaperProps={{
                  sx: {
                    minWidth: 272,
                    mt:       1,
                    background:  HDR.menuBg,
                    border:      `1px solid ${HDR.menuBorder}`,
                    backdropFilter: 'blur(20px)',
                    '& .MuiMenuItem-root': { px: 1.5, py: 1 },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* User info header */}
                <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${HDR.menuDivider}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{
                      background: HDR.avatarGrad,
                      width: 40, height: 40, fontSize: '13px', fontWeight: 600,
                      fontFamily: '"IBM Plex Sans", sans-serif',
                      boxShadow: '0 2px 8px rgba(15,118,110,0.35)',
                    }}>
                      {getUserInitials(userState.currentUser.name)}
                    </Avatar>
                    <Box>
                      <Typography sx={{
                        fontWeight: 600, fontSize: '14px', color: HDR.text,
                        fontFamily: '"IBM Plex Sans", sans-serif', lineHeight: 1.3,
                      }}>
                        {userState.currentUser.name}
                      </Typography>
                      <Typography sx={{
                        fontSize: '12px', color: HDR.textSecond,
                        fontFamily: '"IBM Plex Sans", sans-serif', lineHeight: 1.3,
                      }}>
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
                          <Chip
                            label={userState.currentUser.department}
                            size="small"
                            sx={{
                              background: '#F8FAFC',
                              color: '#475569',
                              border: '1px solid #E2E8F0',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>

                <MenuItem onClick={handleProfile}>
                  <ListItemIcon><PersonIcon fontSize="small" sx={{ color: HDR.brand }} /></ListItemIcon>
                  <ListItemText primary="Mon Profil" />
                </MenuItem>

                <MenuItem onClick={handleAccountSettings}>
                  <ListItemIcon><SettingsIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Paramètres du Compte" />
                </MenuItem>

                <MenuItem onClick={handleChangePasswordClick}>
                  <ListItemIcon><LockIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Changer mon mot de passe" />
                </MenuItem>

                <Divider sx={{ borderColor: HDR.menuDivider }} />

                <MenuItem onClick={handleLogout} sx={{ color: '#F87171 !important', '&:hover': { bgcolor: 'rgba(239,68,68,0.08) !important' } }}>
                  <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#F87171' }} /></ListItemIcon>
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
