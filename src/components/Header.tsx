import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Chip,
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
  AccountCircle as AccountIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Lock as LockIcon,
  InfoOutlined as PolicyInfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { PageType } from '../types';
import logoImage from '../assets/OC_logo.png';
import { useUser } from '../contexts/UserContext';
import { NotificationBell } from './NotificationBell';
import { usePWAInstall } from '../hooks/usePWAInstall';
import GetAppIcon from '@mui/icons-material/GetApp';
import WindowIcon from '@mui/icons-material/Window';
import AppleIcon from '@mui/icons-material/Apple';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { PolicyGuideDialog } from './PolicyGuideDialog';
import { usePolicyGuide } from '../hooks/usePolicyGuide';
import TourIcon from '@mui/icons-material/TourOutlined';
import { useOnboarding } from './onboarding/useOnboarding';

interface HeaderProps {
  onMenuClick: () => void;
  currentPage: PageType;
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

export const Header: React.FC<HeaderProps> = ({ onMenuClick, currentPage, onPageChange, onChangePassword }) => {
  const { t } = useTranslation();
  const { state: userState, logout, getRoleLabel } = useUser();
  const { open: policyGuideOpen, policy: policyGuide, openGuide, closeGuide } = usePolicyGuide(userState.isAuthenticated);
  const { restart: restartOnboarding } = useOnboarding();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const { canInstall, isInstalled, installViaPWA, downloadWindowsInstaller, downloadMacInstaller } = usePWAInstall();
  const [installMenuAnchor, setInstallMenuAnchor] = useState<null | HTMLElement>(null);
  const [installSnack, setInstallSnack] = useState(false);

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
    'company-settings':  'Paramètres Compagnie',
    'platform-admin':    'Administration Plateforme',
    'raci-matrix':       'Matrice RACI',
    'workflow-builder':  'Éditeur de Workflow',
    'approvals':         'Mes Approbations',
    'contract-templates': 'Modèles de contrats',
    'legal-step':         'Étape juridique',
    'codir-dashboard':    'Tableau de Bord CODIR',
    'security-settings':  'Paramètres de sécurité',
    'credit-reports': 'Rapports de Crédit',
    'report-viewer': 'Visualiseur de Rapport',
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
          data-tour="mobile-menu-trigger"
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

          {!isInstalled && (
            <>
              <Tooltip title="Installer OptimusCredit sur votre ordinateur">
                <Box
                  onClick={(e) => setInstallMenuAnchor(e.currentTarget as HTMLElement)}
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    gap: 0.6,
                    cursor: 'pointer',
                    color: HDR.brand,
                    border: `1.5px solid ${HDR.brand}50`,
                    borderRadius: '8px',
                    px: 1.2,
                    py: 0.6,
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: '"IBM Plex Sans", sans-serif',
                    transition: 'all 0.18s',
                    userSelect: 'none',
                    '&:hover': { bgcolor: `${HDR.brand}12`, borderColor: HDR.brand, transform: 'translateY(-1px)' },
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  <GetAppIcon sx={{ fontSize: 15 }} />
                  <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Installer</Box>
                </Box>
              </Tooltip>

              <Menu
                anchorEl={installMenuAnchor}
                open={Boolean(installMenuAnchor)}
                onClose={() => setInstallMenuAnchor(null)}
                PaperProps={{
                  sx: {
                    minWidth: 260,
                    mt: 1,
                    border: `1px solid ${HDR.menuBorder}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <Box sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${HDR.menuDivider}` }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: HDR.text }}>
                    Installer l'application
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: HDR.textSecond, mt: 0.3 }}>
                    Accès rapide depuis le bureau
                  </Typography>
                </Box>

                {canInstall && (
                  <MenuItem onClick={async () => { await installViaPWA(); setInstallMenuAnchor(null); }}>
                    <ListItemIcon><GetAppIcon fontSize="small" sx={{ color: HDR.brand }} /></ListItemIcon>
                    <ListItemText
                      primary="Installation rapide"
                      secondary="Via le navigateur (Chrome/Edge)"
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                      secondaryTypographyProps={{ fontSize: 11 }}
                    />
                  </MenuItem>
                )}

                <MenuItem onClick={() => { downloadWindowsInstaller(); setInstallMenuAnchor(null); setInstallSnack(true); }}>
                  <ListItemIcon><WindowIcon fontSize="small" sx={{ color: '#0078D4' }} /></ListItemIcon>
                  <ListItemText
                    primary="Windows"
                    secondary="Télécharger le script d'installation (.bat)"
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </MenuItem>

                <MenuItem onClick={() => { downloadMacInstaller(); setInstallMenuAnchor(null); setInstallSnack(true); }}>
                  <ListItemIcon><AppleIcon fontSize="small" sx={{ color: '#555' }} /></ListItemIcon>
                  <ListItemText
                    primary="macOS"
                    secondary="Télécharger le script d'installation (.command)"
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </MenuItem>
              </Menu>
            </>
          )}

          {userState.isAuthenticated && policyGuide && (
            <Tooltip title="Politique de crédit active" enterDelay={300}>
              <IconButton
                onClick={openGuide}
                size="small"
                sx={{
                  color: HDR.brand,
                  border: `1.5px solid ${HDR.brand}40`,
                  borderRadius: '8px',
                  p: '5px',
                  transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                  '&:hover': { bgcolor: `${HDR.brand}12`, borderColor: HDR.brand, transform: 'scale(1.08)' },
                  '&:active': { transform: 'scale(0.92)' },
                }}
              >
                <PolicyInfoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {userState.isAuthenticated && (
            <NotificationBell onPageChange={onPageChange} />
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
                  data-tour="header-profile"
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

                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    restartOnboarding();
                  }}
                >
                  <ListItemIcon><TourIcon fontSize="small" sx={{ color: HDR.textMuted }} /></ListItemIcon>
                  <ListItemText primary="Refaire le tour de bienvenue" />
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
      <Snackbar
        open={installSnack}
        autoHideDuration={10000}
        onClose={() => setInstallSnack(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setInstallSnack(false)} sx={{ width: '100%' }}>
          <strong>Script téléchargé !</strong> Ouvrez le fichier téléchargé et exécutez-le — un raccourci OptimusCredit apparaîtra sur votre Bureau.
        </Alert>
      </Snackbar>

      <PolicyGuideDialog
        open={policyGuideOpen}
        policy={policyGuide}
        onClose={closeGuide}
      />
    </AppBar>
  );
};
