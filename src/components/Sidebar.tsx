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
  Button,
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
  FolderCopyOutlined as WorkflowIcon,
  InsightsOutlined as InsightsIcon,
  ManageAccountsOutlined as UserManagementIcon,
  RequestQuoteOutlined as CalculateIcon,
  BackupOutlined as BackupIcon,
  CampaignOutlined as CampaignIcon,
  NotificationsNone as NotificationsActiveIcon,
  CallSplit as DispatchIcon,
  PolicyOutlined as PolicyIcon,
  ListAltOutlined as StepsIcon,
  HowToVote as ApprovalMenuIcon,
  ExpandLess,
  ExpandMore,
  Refresh as ResetIcon,
  DescriptionOutlined as ContractIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import { useModuleAccess } from '../hooks/useModuleAccess';

export const FULL_WIDTH  = 260;
export const MINI_WIDTH  = 64;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  hasAnalysisData: boolean;
  onReset?: () => void;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
// Alignés avec la home banking pro (cf. src/components/home/homeTokens.ts).
// Accent unique navy (#1F4E79), pas de gradient.

const brand = {
  deep:     '#1F4E79',
  sky:      '#2A5E92',
  gradient: '#1F4E79',  // legacy key conservé pour ne pas casser les imports — couleur unie
};

const SB = {
  bg:           '#FFFFFF',
  border:       '#E2E8F0',
  shadow:       '1px 0 20px rgba(15,23,42,0.04)',
  sectionLabel: '#94A3B8',
  itemText:     '#334155',
  itemHover:    'rgba(31,78,121,0.05)',
  activeText:   '#1F4E79',
  activeBg:     'rgba(31,78,121,0.08)',
  activeBorder: '#1F4E79',
};

// ─── Component ──────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  currentPage,
  onPageChange,
  hasAnalysisData,
  onReset,
}) => {
  const { t } = useTranslation();
  const { isRole, hasPermission, state: userState } = useUser();
  const { activeCompany } = useCompany();
  const { canAccess, canAction } = useModuleAccess();

  const [dashboardExpanded, setDashboardExpanded] = useState(true);
  const [creditExpanded, setCreditExpanded]     = useState(true);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [configExpanded, setConfigExpanded]     = useState(true);
  const [policyExpanded, setPolicyExpanded]     = useState(true);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  React.useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await ApiService.getPendingApprovalsCount();
        if (res.success) setPendingApprovalsCount(res.data?.count ?? 0);
      } catch { /* silencieux */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleItemClick = (page: PageType) => {
    onPageChange(page);
  };

  // ── Permission gates ──────────────────────────────────────────────────────────
  const perms = userState.currentUser?.permissions ?? [];
  const isAdmin              = isRole('admin') || perms.includes('*');
  const canViewApplications  = (hasPermission('view_applications') || hasPermission('view_own') || isAdmin) && canAccess('credit-application');
  const canViewClients       = (canViewApplications || hasPermission('create_client') || hasPermission('manage_clients')) && canAccess('clients');
  const canCreateApplication = hasPermission('create_application') && canAccess('credit-application');
  const canDispatching       = hasPermission('dispatch_applications') && canAccess('dispatching');
  const canViewAnalytics     = hasPermission('analytics') && canAccess('analytics');
  const canFinancialAnalysis = hasPermission('financial_analysis') || hasPermission('analyze_credit');
  const canViewReports       = (hasPermission('reports') || isAdmin) && canAccess('analytics');
  const canViewConfiguration = hasPermission('user_management') || isAdmin;
  // manage_platform est vérifié LITTÉRALEMENT (pas via wildcard) pour distinguer SUPER_ADMIN de ADMIN
  const canViewPlatformAdmin   = perms.includes('manage_platform');
  const canViewCompanySettings = false; // couvert par platform-admin
  const canViewCreditPolicy    = (hasPermission('policy_configuration') || isAdmin) && canAccess('credit-policy');
  const canViewCodir           = (hasPermission('codir_dashboard') || isAdmin) && canAccess('codir-dashboard');
  const canViewSimulator       = canCreateApplication || canFinancialAnalysis || isAdmin;
  const isManagement              = isRole('management');
  // canAction vérifie la visibilité + l'action dans le profil de module — couvre tous les rôles
  // (DIRECTION_JURIDIQUE, BACK_OFFICE, etc.) sans dépendre du mapping de rôle frontend.
  const canManageContractTemplates = hasPermission('manage_contract_templates') || isAdmin || isManagement || canAction('contract-templates', 'upload');
  const canManageSecurity          = hasPermission('manage_security') || isAdmin;

  // ── Sections ─────────────────────────────────────────────────────────────────

  // Processus crédit — conditionné par les permissions
  const creditProcessItems = [
    ...(canViewClients       ? [{ id: 'clients'           as PageType, label: t('navigation.clients'),       icon: ClientsIcon     }] : []),
    ...(canCreateApplication ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande',            icon: ApplicationIcon }] : []),
    ...(canDispatching       ? [{ id: 'dispatching'         as PageType, label: 'Dispatching',                icon: DispatchIcon    }] : []),
    ...(canViewApplications  ? [{ id: 'approvals'           as PageType, label: 'Approbations',               icon: ApprovalMenuIcon, badgeCount: pendingApprovalsCount }] : []),
    ...(canViewApplications  ? [{ id: 'workflow'            as PageType, label: t('navigation.workflow'),     icon: WorkflowIcon    }] : []),
  ];

  // Pilotage & Rapports
  const dashboardItems = [
    { id: 'home' as PageType, label: t('navigation.home'), icon: DashboardIcon },
    ...(canViewCodir    ? [{ id: 'codir-dashboard' as PageType, label: 'Tableau de Bord CODIR', icon: InsightsIcon }] : []),
    ...(canViewAnalytics ? [{ id: 'analytics'       as PageType, label: t('navigation.analytics'), icon: InsightsIcon }] : []),
    ...(canViewReports  ? [{ id: 'credit-reports'   as PageType, label: 'Rapports de Crédit',     icon: ReportsIcon  }] : []),
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
    ...(canManageSecurity      ? [{ id: 'security-settings' as PageType, label: 'Sécurité',            icon: ShieldIcon   }] : []),
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
    py:          0.9,
    color:       SB.activeText,
    background:  SB.activeBg,
    borderLeft:  `2px solid ${SB.activeBorder}`,
    pl:          '14px',
    transition:  'all 0.18s cubic-bezier(0.22,1,0.36,1)',
    '& .MuiListItemIcon-root': { color: SB.activeText },
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
    badgeCount?: number;
    disabled?: boolean;
  }> = ({ id, label, icon: Icon, badge, badgeCount, disabled }) => {
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
                {badgeCount && badgeCount > 0 ? (
                  <Badge badgeContent={badgeCount} color="error" max={99}>
                    <Icon sx={{ fontSize: 22, color: isActive ? SB.activeText : '#94A3B8' }} />
                  </Badge>
                ) : badge ? (
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
            {badgeCount && badgeCount > 0 ? (
              <Badge badgeContent={badgeCount} color="error" max={99}>
                <Icon sx={{ fontSize: 19 }} />
              </Badge>
            ) : badge ? (
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
        {/* Tableaux de bord & Rapports */}
        {dashboardItems.length > 0 && (
          <>
            <SectionHeader
              label="Pilotage & Rapports"
              expanded={dashboardExpanded}
              onToggle={() => setDashboardExpanded(p => !p)}
            />
            <Collapse in={open ? dashboardExpanded : true} timeout="auto" unmountOnExit={false}>
              <List disablePadding sx={{ px: 0.5 }}>
                {dashboardItems.map(item => (
                  <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* Processus Crédit — masqué si aucun item accessible */}
        {creditProcessItems.length > 0 && (
          <>
            <SectionHeader
              label={t('navigation.creditProcess')}
              expanded={creditExpanded}
              onToggle={() => setCreditExpanded(p => !p)}
            />
            <Collapse in={open ? creditExpanded : true} timeout="auto" unmountOnExit={false}>
              <List disablePadding sx={{ px: 0.5 }}>
                {creditProcessItems.map(item => (
                  <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} badgeCount={(item as any).badgeCount} />
                ))}
              </List>
            </Collapse>
          </>
        )}

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
                {/* Bouton Reset session */}
                {onReset && (
                  open ? (
                    <ListItem disablePadding sx={{ mt: 0.5, mb: 0.25 }}>
                      <Button
                        onClick={onReset}
                        startIcon={<ResetIcon sx={{ fontSize: '16px !important' }} />}
                        size="small"
                        fullWidth
                        sx={{
                          mx: 1,
                          justifyContent: 'flex-start',
                          color: '#94A3B8',
                          fontSize: '13px',
                          fontFamily: '"IBM Plex Sans", sans-serif',
                          fontWeight: 400,
                          textTransform: 'none',
                          borderRadius: '7px',
                          py: 0.7,
                          pl: '14px',
                          border: '1px dashed #E2E8F0',
                          '&:hover': {
                            bgcolor: 'rgba(239,68,68,0.06)',
                            color: '#EF4444',
                            borderColor: '#FCA5A5',
                            '& .MuiButton-startIcon': { color: '#EF4444' },
                          },
                        }}
                      >
                        Réinitialiser la session
                      </Button>
                    </ListItem>
                  ) : (
                    <Tooltip title="Réinitialiser la session" placement="right" arrow>
                      <ListItem disablePadding sx={{ mb: 0.25 }}>
                        <ListItemButton
                          onClick={onReset}
                          sx={{
                            justifyContent: 'center',
                            px: 0, py: 0.8, mx: 0.75,
                            borderRadius: '8px', minHeight: 36,
                            '&:hover': { bgcolor: 'rgba(239,68,68,0.06)', '& .MuiListItemIcon-root': { color: '#EF4444' } },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                            <ResetIcon sx={{ fontSize: 20, color: '#94A3B8' }} />
                          </ListItemIcon>
                        </ListItemButton>
                      </ListItem>
                    </Tooltip>
                  )
                )}
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

        {/* Juridique — gestion des modèles de contrats */}
        {canManageContractTemplates && (
          <>
            <StaticLabel label="Juridique" />
            <List disablePadding sx={{ px: 0.5 }}>
              <NavItem id="contract-templates" label="Modèles de contrats" icon={ContractIcon} />
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
                        <SubNavItem id="credit-types"     label="Types de crédit"       icon={CalculateIcon} />
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
            top:         { xs: '56px', sm: '64px' },
            height:      { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};
