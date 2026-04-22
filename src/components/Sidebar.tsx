import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Typography,
  Badge,
  Collapse,
  Tooltip,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import optimusIcon from '../assets/Optimus_icon.png';
import kaizenLogo from '../assets/OC_logo.png';
import {
  DashboardOutlined as DashboardIcon,
  EditNoteOutlined as DataInputIcon,
  QueryStatsOutlined as AnalysisIcon,
  SummarizeOutlined as ReportsIcon,
  TuneOutlined as SettingsIcon,
  HelpOutline as DocumentationIcon,
  EventNoteOutlined as HolidayIcon,
  GroupsOutlined as ClientsIcon,
  NoteAddOutlined as ApplicationIcon,
  AccountTreeOutlined as WorkflowIcon,
  InsightsOutlined as InsightsIcon,
  ManageAccountsOutlined as UserManagementIcon,
  RequestQuoteOutlined as CalculateIcon,
  BackupOutlined as BackupIcon,
  CampaignOutlined as CampaignIcon,
  NotificationsNone as NotificationsActiveIcon,
  CallSplit as DispatchIcon,
  PolicyOutlined as PolicyIcon,
  ListAltOutlined as StepsIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';

export const FULL_WIDTH  = 260;
export const MINI_WIDTH  = 64;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  hasAnalysisData: boolean;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

// Brand palette — Clean Light Financial Dashboard
const brand = {
  deep:     '#0F766E',
  sky:      '#14B8A6',
  gradient: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
};

const SB = {
  bg:           '#FFFFFF',
  border:       '#E2E8F0',
  shadow:       '1px 0 20px rgba(15,23,42,0.06)',
  sectionLabel: '#94A3B8',
  itemText:     '#334155',
  itemHover:    'rgba(15,118,110,0.06)',
  activeText:   '#0F766E',
  activeBg:     'linear-gradient(90deg, rgba(15,118,110,0.10) 0%, rgba(20,184,166,0.05) 100%)',
  activeBorder: '#0F766E',
};

// ─── Component ──────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  currentPage,
  onPageChange,
  hasAnalysisData,
}) => {
  const { t } = useTranslation();
  const { isRole, hasPermission, state: userState } = useUser();
  const { activeCompany } = useCompany();

  const [creditExpanded, setCreditExpanded]     = useState(true);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [configExpanded, setConfigExpanded]     = useState(true);
  const [policyExpanded, setPolicyExpanded]     = useState(true);

  const handleItemClick = (page: PageType) => {
    onPageChange(page);
  };

  // ── Permission gates ──────────────────────────────────────────────────────────
  const perms = userState.currentUser?.permissions ?? [];
  const isAdmin              = isRole('admin') || perms.includes('*');
  const canCreateApplication = hasPermission('create_application');
  const canDispatching       = hasPermission('dispatch_applications');
  const canViewAnalytics     = hasPermission('analytics');
  const canFinancialAnalysis = hasPermission('financial_analysis') || hasPermission('analyze_credit');
  const canViewReports       = hasPermission('reports') || isAdmin;
  const canViewConfiguration = hasPermission('user_management') || isAdmin;
  // manage_platform est vérifié LITTÉRALEMENT (pas via wildcard) pour distinguer SUPER_ADMIN de ADMIN
  const canViewPlatformAdmin   = perms.includes('manage_platform');
  const canViewCompanySettings = false; // couvert par platform-admin
  const canViewCreditPolicy    = hasPermission('policy_configuration') || isAdmin;
  const canViewSimulator       = canCreateApplication || canFinancialAnalysis || isAdmin;

  // ── Sections ─────────────────────────────────────────────────────────────────

  // Processus crédit — visible par tous les utilisateurs actifs
  const creditProcessItems = [
    { id: 'clients'           as PageType, label: t('navigation.clients'),  icon: ClientsIcon },
    ...(canCreateApplication ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande',       icon: ApplicationIcon }] : []),
    ...(canDispatching       ? [{ id: 'dispatching'         as PageType, label: 'Dispatching',            icon: DispatchIcon    }] : []),
    { id: 'workflow'          as PageType, label: t('navigation.workflow'), icon: WorkflowIcon },
    ...(canViewAnalytics     ? [{ id: 'analytics'           as PageType, label: t('navigation.analytics'), icon: InsightsIcon    }] : []),
  ];

  // Analyse hors-processus — uniquement pour les profils d'analyse financière
  const outOfProcessItems = canFinancialAnalysis ? [
    { id: 'data-input' as PageType, label: t('navigation.dataInput'), icon: DataInputIcon },
    { id: 'analysis'   as PageType, label: t('navigation.analysis'),  icon: AnalysisIcon, requiresData: true },
    ...(canViewReports ? [{ id: 'reports' as PageType, label: t('navigation.reports'), icon: ReportsIcon, requiresData: true }] : []),
  ] : [];

  // Configuration — admin seulement
  const configItems = canViewConfiguration ? [
    { id: 'user-management'      as PageType, label: t('navigation.userManagement'), icon: UserManagementIcon },
    { id: 'bank-holidays-admin'  as PageType, label: 'Jours Fériés',                icon: HolidayIcon },
    { id: 'backup'               as PageType, label: 'Sauvegarde',                  icon: BackupIcon },
    { id: 'announcements'        as PageType, label: "Notes d'information",         icon: CampaignIcon },
    { id: 'notifications-config' as PageType, label: 'Notifications',               icon: NotificationsActiveIcon },
    ...(canViewCompanySettings ? [{ id: 'company-settings' as PageType, label: 'Paramètres Compagnie', icon: SettingsIcon }] : []),
    ...(canViewPlatformAdmin   ? [{ id: 'platform-admin'   as PageType, label: 'Admin Plateforme',     icon: PolicyIcon   }] : []),
  ] : [];

  // Logo tenant — URL complète vers le backend
  const tenantLogoUrl = activeCompany?.logoUrl
    ? `${window.location.origin}${activeCompany.logoUrl}`
    : null;
  const tenantName = activeCompany?.name ?? 'OptimusCredit';


  // ── Shared item styles ──────────────────────────────────────────────────────

  const activeItemSx = {
    borderRadius: '7px',
    mx:          1,
    py:          0.7,
    color:       SB.activeText,
    background:  SB.activeBg,
    borderLeft:  `2px solid ${SB.activeBorder}`,
    pl:          '14px',
    boxShadow:   'inset 0 1px 0 rgba(255,255,255,0.70)',
    transition:  'all 0.15s cubic-bezier(0.22,1,0.36,1)',
    '& .MuiListItemIcon-root': {
      background:          brand.gradient,
      WebkitBackgroundClip:'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip:      'text',
    },
    '& .MuiListItemText-primary': { fontWeight: 600, color: SB.activeText, fontFamily: '"IBM Plex Sans", sans-serif' },
    '&:hover':  { background: SB.activeBg },
    '&:active': { transform: 'scale(0.98)', transition: 'transform 0.08s ease' },
  };

  const inactiveItemSx = {
    borderRadius: '7px',
    mx:          1,
    py:          0.7,
    borderLeft:  '2px solid transparent',
    pl:          '14px',
    color:       SB.itemText,
    transition:  'all 0.15s cubic-bezier(0.22,1,0.36,1)',
    '& .MuiListItemIcon-root': { color: '#94A3B8', transition: 'color 0.15s ease' },
    '& .MuiListItemText-primary': { fontFamily: '"IBM Plex Sans", sans-serif' },
    '&:hover': {
      bgcolor: SB.itemHover,
      '& .MuiListItemIcon-root': { color: brand.deep },
    },
    '&:active': { transform: 'scale(0.98)', transition: 'transform 0.08s ease' },
  };

  // ── SubNavItem (sous-menu indenté) ──────────────────────────────────────────

  const SubNavItem: React.FC<{
    id: PageType;
    label: string;
    icon: React.ElementType;
  }> = ({ id, label, icon: Icon }) => {
    const isActive = currentPage === id;

    if (!open) {
      return (
        <Tooltip title={label} placement="right" arrow>
          <ListItem disablePadding sx={{ mb: 0.25 }}>
            <ListItemButton
              onClick={() => handleItemClick(id)}
              sx={{
                justifyContent: 'center',
                px: 0, py: 0.8,
                mx: 0.75,
                borderRadius: '8px',
                minHeight: 36,
                bgcolor: isActive ? SB.activeBg : 'transparent',
                '&:hover': { bgcolor: isActive ? SB.activeBg : SB.itemHover },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                <Icon sx={{ fontSize: 18, color: isActive ? SB.activeText : '#94A3B8' }} />
              </ListItemIcon>
            </ListItemButton>
          </ListItem>
        </Tooltip>
      );
    }

    return (
      <ListItem disablePadding sx={{ mb: 0.15 }}>
        <ListItemButton
          onClick={() => handleItemClick(id)}
          sx={isActive ? {
            ...activeItemSx,
            pl: '28px',
            py: 0.55,
            fontSize: '12px',
          } : {
            ...inactiveItemSx,
            pl: '28px',
            py: 0.55,
            '& .MuiListItemText-primary': { fontSize: '12px', fontFamily: '"IBM Plex Sans", sans-serif' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 26 }}>
            <Icon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: '12px', noWrap: true, fontFamily: '"IBM Plex Sans", sans-serif' }}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  // ── NavItem ─────────────────────────────────────────────────────────────────

  const NavItem: React.FC<{
    id: PageType;
    label: string;
    icon: React.ElementType;
    badge?: boolean;
    disabled?: boolean;
  }> = ({ id, label, icon: Icon, badge, disabled }) => {
    const isActive = currentPage === id;

    // ── Mini (icon-only) mode ──────────────────────────────────────────────
    if (!open) {
      return (
        <Tooltip title={label} placement="right" arrow>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => !disabled && handleItemClick(id)}
              disabled={disabled}
              sx={{
                justifyContent: 'center',
                px: 0,
                py: 1,
                mx: 0.75,
                borderRadius: '10px',
                minHeight: 44,
                bgcolor: isActive ? SB.activeBg : 'transparent',
                '&:hover': { bgcolor: isActive ? SB.activeBg : SB.itemHover },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                {badge ? (
                  <Badge color="success" variant="dot">
                    <Icon sx={{ fontSize: 22, color: isActive ? SB.activeText : '#94A3B8' }} />
                  </Badge>
                ) : (
                  <Icon sx={{ fontSize: 22, color: isActive ? SB.activeText : '#94A3B8' }} />
                )}
              </ListItemIcon>
            </ListItemButton>
          </ListItem>
        </Tooltip>
      );
    }

    // ── Full mode ───────────────────────────────────────────────────────────
    return (
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          onClick={() => !disabled && handleItemClick(id)}
          disabled={disabled}
          sx={isActive ? activeItemSx : inactiveItemSx}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            {badge ? (
              <Badge color="success" variant="dot">
                <Icon sx={{ fontSize: 19 }} />
              </Badge>
            ) : (
              <Icon sx={{ fontSize: 19 }} />
            )}
          </ListItemIcon>
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: '13px', noWrap: true, fontFamily: '"IBM Plex Sans", sans-serif' }}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  // ── Section header ──────────────────────────────────────────────────────────

  const SectionHeader: React.FC<{
    label: string;
    expanded: boolean;
    onToggle: () => void;
  }> = ({ label, expanded, onToggle }) => {
    if (!open) {
      // Mini: just a thin divider between groups
      return <Divider sx={{ my: 0.75, mx: 1.5, borderColor: '#F1F5F9' }} />;
    }
    return (
      <ListItemButton
        onClick={onToggle}
        disableRipple
        sx={{ py: 0.4, px: 2, mt: 1.75, mb: 0.25, '&:hover': { bgcolor: 'transparent' } }}
      >
        <Typography sx={{
          textTransform: 'uppercase', letterSpacing: '0.7px',
          color: SB.sectionLabel, fontSize: '10.5px', fontWeight: 600, flex: 1,
          userSelect: 'none', fontFamily: '"IBM Plex Sans", sans-serif',
        }}>
          {label}
        </Typography>
        {expanded
          ? <ExpandLess sx={{ fontSize: 13, color: SB.sectionLabel }} />
          : <ExpandMore sx={{ fontSize: 13, color: SB.sectionLabel }} />
        }
      </ListItemButton>
    );
  };

  const StaticLabel: React.FC<{ label: string }> = ({ label }) => {
    if (!open) return <Divider sx={{ my: 0.75, mx: 1.5, borderColor: '#F1F5F9' }} />;
    return (
      <Box sx={{ px: 2, mt: 1.75, mb: 0.25 }}>
        <Typography sx={{
          textTransform: 'uppercase', letterSpacing: '0.7px',
          color: SB.sectionLabel, fontSize: '10.5px', fontWeight: 600,
          userSelect: 'none', fontFamily: '"IBM Plex Sans", sans-serif',
        }}>
          {label}
        </Typography>
      </Box>
    );
  };

  // ── Drawer content ──────────────────────────────────────────────────────────

  const drawer = (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      bgcolor: SB.bg,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    }}>
      <Toolbar />

      {/* Logo tenant */}
      <Box sx={{
        px: open ? 2 : 0,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'flex-start' : 'center',
        gap: 1.25,
        borderBottom: `1px solid ${SB.border}`,
        flexShrink: 0,
        minHeight: 60,
      }}>
        {tenantLogoUrl ? (
          /* Logo uploadé du tenant */
          <img
            src={tenantLogoUrl}
            alt={tenantName}
            style={{
              height: 36,
              maxWidth: open ? 160 : 36,
              objectFit: 'contain',
              flexShrink: 0,
              borderRadius: 4,
              transition: 'max-width 0.25s ease',
            }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          /* Fallback OptimusCredit */
          <>
            <img src={optimusIcon} alt="Logo" style={{ width: 32, height: 32, flexShrink: 0 }} />
            {open && (
              <Box sx={{ overflow: 'hidden' }}>
                <Typography sx={{
                  fontSize: '14px', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', fontFamily: '"IBM Plex Sans", sans-serif',
                  background: brand.gradient, WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  OptimusCredit
                </Typography>
                <Typography sx={{ fontSize: '10.5px', color: SB.sectionLabel, lineHeight: 1.2, whiteSpace: 'nowrap', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                  Gestion de Crédit
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Scrollable nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {/* Dashboard */}
        <List disablePadding sx={{ px: 0.5 }}>
          <NavItem id="home" label={t('navigation.home')} icon={DashboardIcon} />
        </List>

        {/* Processus Crédit */}
        <SectionHeader
          label={t('navigation.creditProcess')}
          expanded={creditExpanded}
          onToggle={() => setCreditExpanded(p => !p)}
        />
        <Collapse in={open ? creditExpanded : true} timeout="auto" unmountOnExit={false}>
          <List disablePadding sx={{ px: 0.5 }}>
            {creditProcessItems.map(item => (
              <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
            ))}
          </List>
        </Collapse>

        {/* Analyse hors-processus — uniquement pour les profils financiers */}
        {outOfProcessItems.length > 0 && (
          <>
            <SectionHeader
              label={t('navigation.outOfProcessAnalysis')}
              expanded={analysisExpanded}
              onToggle={() => setAnalysisExpanded(p => !p)}
            />
            <Collapse in={open ? analysisExpanded : true} timeout="auto" unmountOnExit={false}>
              <List disablePadding sx={{ px: 0.5 }}>
                {outOfProcessItems.map(item => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    disabled={item.requiresData && !hasAnalysisData}
                    badge={item.requiresData && hasAnalysisData}
                  />
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* Outils — uniquement pour les profils concernés */}
        {canViewSimulator && (
          <>
            <StaticLabel label="Outils" />
            <List disablePadding sx={{ px: 0.5 }}>
              <NavItem id="credit-simulation" label="Simulateur de Crédit" icon={CalculateIcon} />
            </List>
          </>
        )}

        {/* Configuration — admin seulement */}
        {configItems.length > 0 && (
          <>
            <SectionHeader
              label="Configuration"
              expanded={configExpanded}
              onToggle={() => setConfigExpanded(p => !p)}
            />
            <Collapse in={open ? configExpanded : true} timeout="auto" unmountOnExit={false}>
              <List disablePadding sx={{ px: 0.5 }}>
                {configItems.map(item => (
                  <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
                ))}
                {canViewCreditPolicy && (
                  <>
                    {/* Parent — Politique de Crédit */}
                    {open ? (
                      <ListItem disablePadding sx={{ mb: 0.25 }}>
                        <ListItemButton
                          onClick={() => setPolicyExpanded(p => !p)}
                          sx={{
                            borderRadius: '10px', px: 1.5, py: 0.75,
                            color: '#64748B',
                            '&:hover': { bgcolor: '#F1F5F9' },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <PolicyIcon sx={{ fontSize: 18, color: '#64748B' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary="Politique de Crédit"
                            primaryTypographyProps={{ fontSize: '13px', fontWeight: 500, noWrap: true }}
                          />
                          {policyExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                        </ListItemButton>
                      </ListItem>
                    ) : (
                      <Tooltip title="Politique de Crédit" placement="right" arrow>
                        <ListItem disablePadding sx={{ mb: 0.25 }}>
                          <ListItemButton
                            onClick={() => setPolicyExpanded(p => !p)}
                            sx={{ justifyContent: 'center', px: 0, py: 0.8, mx: 0.75, borderRadius: '8px', minHeight: 36, '&:hover': { bgcolor: '#F1F5F9' } }}
                          >
                            <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                              <PolicyIcon sx={{ fontSize: 18, color: '#64748B' }} />
                            </ListItemIcon>
                          </ListItemButton>
                        </ListItem>
                      </Tooltip>
                    )}
                    <Collapse in={open ? policyExpanded : false} timeout="auto">
                      <List disablePadding sx={{ pl: 1 }}>
                        <SubNavItem id="credit-policy"    label="Circuit de traitement" icon={StepsIcon} />
                        <SubNavItem id="raci-matrix"      label="Matrice RACI"          icon={WorkflowIcon} />
                        <SubNavItem id="workflow-builder" label="Éditeur de Workflow"   icon={PolicyIcon} />
                      </List>
                    </Collapse>
                  </>
                )}
              </List>
            </Collapse>
          </>
        )}

        {/* Support */}
        <StaticLabel label="Support" />
        <List disablePadding sx={{ px: 0.5 }}>
          <NavItem id="documentation" label={t('navigation.documentation')} icon={DocumentationIcon} />
          <NavItem id="settings"      label={t('navigation.settings')}       icon={SettingsIcon}       />
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{
        px: open ? 2.5 : 0,
        py: 1.5,
        borderTop: `1px solid ${SB.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'flex-start' : 'center',
        gap: 1.5,
        flexShrink: 0,
      }}>
        <img src={kaizenLogo} alt="Kaizen" style={{ height: 18, opacity: 0.65, flexShrink: 0 }} />
        {open && (
          <Typography sx={{ fontSize: '10.5px', color: SB.sectionLabel, whiteSpace: 'nowrap', fontFamily: '"IBM Plex Sans", sans-serif' }}>
            v3.0.0 · © 2025 Kaizen
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* ── Mobile: temporary drawer ────────────────────────────────── */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true, disableScrollLock: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width:      FULL_WIDTH,
            boxSizing:  'border-box',
            border:     'none',
            boxShadow:  SB.shadow,
            background: 'transparent',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* ── Desktop: permanent rail — full or icon-only ─────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiDrawer-paper': {
            width:       open ? FULL_WIDTH : MINI_WIDTH,
            overflowX:   'hidden',
            boxSizing:   'border-box',
            borderRight: `1px solid ${SB.border}`,
            boxShadow:   SB.shadow,
            background:  'transparent',
            transition:  'width 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};
