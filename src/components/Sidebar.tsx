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

const SB = {
  bg:           '#ffffff',
  border:       '#e8ecf0',
  shadow:       '2px 0 8px rgba(0,0,0,0.06)',
  sectionLabel: '#9ca3af',
  itemText:     '#374151',
  itemHover:    'rgba(0,0,0,0.04)',
  activeText:   '#1f4e79',
  activeBg:     'rgba(31,78,121,0.09)',
  activeBorder: '#1f4e79',
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
  const { isRole } = useUser();

  const [creditExpanded, setCreditExpanded]     = useState(true);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [configExpanded, setConfigExpanded]     = useState(true);

  const handleItemClick = (page: PageType) => {
    onPageChange(page);
  };

  const canViewAnalytics       = isRole('management') || isRole('admin') || isRole('branch_manager') || isRole('credit_committee');
  const canCreateApplications  = isRole('account_manager') || isRole('admin');
  const canViewConfiguration   = isRole('admin') || isRole('management');

  const outOfProcessItems = [
    { id: 'data-input'  as PageType, label: t('navigation.dataInput'), icon: DataInputIcon },
    { id: 'analysis'    as PageType, label: t('navigation.analysis'),  icon: AnalysisIcon,  requiresData: true },
    { id: 'reports'     as PageType, label: t('navigation.reports'),   icon: ReportsIcon,   requiresData: true },
  ];

  const creditProcessItems = [
    { id: 'clients'            as PageType, label: t('navigation.clients'),   icon: ClientsIcon },
    ...(canCreateApplications ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande', icon: ApplicationIcon }] : []),
    { id: 'workflow'           as PageType, label: t('navigation.workflow'),  icon: WorkflowIcon },
    ...(canViewAnalytics ? [{ id: 'analytics' as PageType, label: t('navigation.analytics'), icon: InsightsIcon }] : []),
  ];

  const configItems = canViewConfiguration ? [
    { id: 'user-management'   as PageType, label: t('navigation.userManagement'),   icon: UserManagementIcon },
    { id: 'credit-types'      as PageType, label: 'Types de Crédit',                icon: BusinessIcon },
    { id: 'approval-limits'   as PageType, label: "Limites d'Approbation",          icon: LimitsIcon },
    { id: 'bank-holidays-admin' as PageType, label: 'Jours Fériés',                 icon: HolidayIcon },
    { id: 'backup'            as PageType, label: 'Sauvegarde',                     icon: BackupIcon },
    { id: 'announcements'     as PageType, label: "Notes d'information",            icon: CampaignIcon },
    { id: 'notifications-config' as PageType, label: 'Notifications',              icon: NotificationsActiveIcon },
  ] : [];

  // ── Shared item styles ──────────────────────────────────────────────────────

  const activeItemSx = {
    borderRadius: '6px',
    mx: 1,
    py: 0.75,
    color: SB.activeText,
    bgcolor: SB.activeBg,
    borderLeft: `3px solid ${SB.activeBorder}`,
    pl: '13px',
    '& .MuiListItemIcon-root': { color: SB.activeText },
    '& .MuiListItemText-primary': { fontWeight: 600, color: SB.activeText },
    '&:hover': { bgcolor: SB.activeBg },
  };

  const inactiveItemSx = {
    borderRadius: '6px',
    mx: 1,
    py: 0.75,
    borderLeft: '3px solid transparent',
    pl: '13px',
    color: SB.itemText,
    '& .MuiListItemIcon-root': { color: '#6b7280' },
    '&:hover': {
      bgcolor: SB.itemHover,
      '& .MuiListItemIcon-root': { color: SB.activeText },
    },
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
            primaryTypographyProps={{ fontSize: '13.5px', noWrap: true }}
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
        sx={{ py: 0.5, px: 2, mt: 1.5, mb: 0.25, '&:hover': { bgcolor: 'transparent' } }}
      >
        <Typography sx={{
          textTransform: 'uppercase', letterSpacing: '0.8px',
          color: SB.sectionLabel, fontSize: '10px', fontWeight: 700, flex: 1, userSelect: 'none',
        }}>
          {label}
        </Typography>
        {expanded
          ? <ExpandLess sx={{ fontSize: 14, color: SB.sectionLabel }} />
          : <ExpandMore sx={{ fontSize: 14, color: SB.sectionLabel }} />
        }
      </ListItemButton>
    );
  };

  const StaticLabel: React.FC<{ label: string }> = ({ label }) => {
    if (!open) return <Divider sx={{ my: 0.75, mx: 1.5, borderColor: '#f1f5f9' }} />;
    return (
      <Box sx={{ px: 2, mt: 1.5, mb: 0.25 }}>
        <Typography sx={{
          textTransform: 'uppercase', letterSpacing: '0.8px',
          color: SB.sectionLabel, fontSize: '10px', fontWeight: 700, userSelect: 'none',
        }}>
          {label}
        </Typography>
      </Box>
    );
  };

  // ── Drawer content ──────────────────────────────────────────────────────────

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: SB.bg }}>
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
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1f4e79', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              OptimusCredit
            </Typography>
            <Typography sx={{ fontSize: '10px', color: SB.sectionLabel, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
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
          <Typography sx={{ fontSize: '10px', color: SB.sectionLabel, whiteSpace: 'nowrap' }}>
            v2.0.0 · © 2025 Kaizen
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
            width: FULL_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: SB.shadow,
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
            width: open ? FULL_WIDTH : MINI_WIDTH,
            overflowX: 'hidden',
            boxSizing: 'border-box',
            borderRight: `1px solid ${SB.border}`,
            boxShadow: SB.shadow,
            transition: 'width 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};
