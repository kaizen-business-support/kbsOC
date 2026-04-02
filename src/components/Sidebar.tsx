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
  GavelOutlined as LimitsIcon,
  RequestQuoteOutlined as CalculateIcon,
  CreditCardOutlined as BusinessIcon,
  BackupOutlined as BackupIcon,
  CampaignOutlined as CampaignIcon,
  NotificationsNone as NotificationsActiveIcon,
  CallSplit as DispatchIcon,
  PolicyOutlined as PolicyIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';

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

// Brand palette (mirrors theme.ts brand tokens)
const brand = {
  deep:     '#3A56A8',
  sky:      '#28A8E2',
  gradient: 'linear-gradient(135deg, #3A56A8 0%, #2878C8 52%, #28A8E2 100%)',
};

const SB = {
  bg:           'rgba(255,255,255,0.84)',
  border:       'rgba(255,255,255,0.55)',
  shadow:       '1px 0 24px rgba(26,36,64,0.07)',
  sectionLabel: '#8A99B8',
  itemText:     '#3A4D72',
  itemHover:    'rgba(58,86,168,0.05)',
  activeText:   brand.deep,
  activeBg:     'linear-gradient(90deg, rgba(58,86,168,0.10) 0%, rgba(40,168,226,0.05) 100%)',
  activeBorder: brand.deep,
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
  const { isRole, hasPermission } = useUser();

  const [creditExpanded, setCreditExpanded]     = useState(true);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [configExpanded, setConfigExpanded]     = useState(true);

  const handleItemClick = (page: PageType) => {
    onPageChange(page);
  };

  const canViewAnalytics      = hasPermission('analytics') || isRole('management') || isRole('admin') || isRole('branch_manager') || isRole('credit_committee');
  const canCreateApplications = hasPermission('create_application') || isRole('account_manager') || isRole('admin');
  const canViewConfiguration  = hasPermission('user_management') || isRole('admin') || isRole('management');
  const canDispatching        = hasPermission('dispatch_applications') || isRole('analyst_supervisor') || isRole('admin');

  const outOfProcessItems = [
    { id: 'data-input'  as PageType, label: t('navigation.dataInput'), icon: DataInputIcon },
    { id: 'analysis'    as PageType, label: t('navigation.analysis'),  icon: AnalysisIcon,  requiresData: true },
    { id: 'reports'     as PageType, label: t('navigation.reports'),   icon: ReportsIcon,   requiresData: true },
  ];

  const creditProcessItems = [
    { id: 'clients'            as PageType, label: t('navigation.clients'),   icon: ClientsIcon },
    ...(canCreateApplications ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande', icon: ApplicationIcon }] : []),
    ...(canDispatching ? [{ id: 'dispatching' as PageType, label: 'Dispatching', icon: DispatchIcon }] : []),
    { id: 'workflow'           as PageType, label: t('navigation.workflow'),  icon: WorkflowIcon },
    ...(canViewAnalytics ? [{ id: 'analytics' as PageType, label: t('navigation.analytics'), icon: InsightsIcon }] : []),
  ];

  const configItems = canViewConfiguration ? [
    { id: 'user-management'   as PageType, label: t('navigation.userManagement'),   icon: UserManagementIcon },
    { id: 'credit-policy'     as PageType, label: 'Politique de Crédit',            icon: PolicyIcon },
    { id: 'credit-types'      as PageType, label: 'Types de Crédit',                icon: BusinessIcon },
    { id: 'approval-limits'   as PageType, label: "Limites d'Approbation",          icon: LimitsIcon },
    { id: 'bank-holidays-admin' as PageType, label: 'Jours Fériés',                 icon: HolidayIcon },
    { id: 'backup'            as PageType, label: 'Sauvegarde',                     icon: BackupIcon },
    { id: 'announcements'     as PageType, label: "Notes d'information",            icon: CampaignIcon },
    { id: 'notifications-config' as PageType, label: 'Notifications',              icon: NotificationsActiveIcon },
  ] : [];

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
    '& .MuiListItemText-primary': { fontWeight: 600, color: SB.activeText, fontFamily: '"Inter", sans-serif' },
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
    '& .MuiListItemIcon-root': { color: '#8A99B8', transition: 'color 0.15s ease' },
    '& .MuiListItemText-primary': { fontFamily: '"Inter", sans-serif' },
    '&:hover': {
      bgcolor: SB.itemHover,
      '& .MuiListItemIcon-root': { color: brand.deep },
    },
    '&:active': { transform: 'scale(0.98)', transition: 'transform 0.08s ease' },
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
                    <Icon sx={{ fontSize: 22, color: isActive ? SB.activeText : '#6b7280' }} />
                  </Badge>
                ) : (
                  <Icon sx={{ fontSize: 22, color: isActive ? SB.activeText : '#6b7280' }} />
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
            primaryTypographyProps={{ fontSize: '13px', noWrap: true, fontFamily: '"Inter", sans-serif' }}
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
      return <Divider sx={{ my: 0.75, mx: 1.5, borderColor: '#f1f5f9' }} />;
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
          userSelect: 'none', fontFamily: '"Inter", sans-serif',
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
    if (!open) return <Divider sx={{ my: 0.75, mx: 1.5, borderColor: '#E8EBED' }} />;
    return (
      <Box sx={{ px: 2, mt: 1.75, mb: 0.25 }}>
        <Typography sx={{
          textTransform: 'uppercase', letterSpacing: '0.7px',
          color: SB.sectionLabel, fontSize: '10.5px', fontWeight: 600,
          userSelect: 'none', fontFamily: '"Inter", sans-serif',
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

      {/* Logo */}
      <Box sx={{
        px: open ? 2.5 : 0,
        py: 1.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'flex-start' : 'center',
        gap: 1.25,
        borderBottom: `1px solid ${SB.border}`,
        flexShrink: 0,
      }}>
        <img src={optimusIcon} alt="Logo" style={{ width: 32, height: 32, flexShrink: 0 }} />
        {open && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography sx={{
              fontSize: '14px', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif',
              // brand gradient text for the app name
              background:          brand.gradient,
              WebkitBackgroundClip:'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip:      'text',
            }}>
              OptimusCredit
            </Typography>
            <Typography sx={{ fontSize: '10.5px', color: SB.sectionLabel, lineHeight: 1.2, whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif' }}>
              Gestion de Crédit
            </Typography>
          </Box>
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

        {/* Analyse hors-processus */}
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

        {/* Outils */}
        <StaticLabel label="Outils" />
        <List disablePadding sx={{ px: 0.5 }}>
          <NavItem id="credit-simulation" label="Simulateur de Crédit" icon={CalculateIcon} />
        </List>

        {/* Configuration (admin) */}
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
          <Typography sx={{ fontSize: '10.5px', color: SB.sectionLabel, whiteSpace: 'nowrap', fontFamily: '"Inter", sans-serif' }}>
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
