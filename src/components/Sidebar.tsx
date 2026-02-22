import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  Box,
  Typography,
  Badge,
  Collapse,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import optimusIcon from '../assets/Optimus_icon.png';
import kaizenLogo from '../assets/OC_logo.png';
import {
  Home as HomeIcon,
  Edit as DataInputIcon,
  Analytics as AnalysisIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Description as DocumentationIcon,
  Event as HolidayIcon,
  People as ClientsIcon,
  Assignment as ApplicationIcon,
  AccountTreeSharp as WorkflowIcon,
  BarChart as ScoringIcon,
  AdminPanelSettings as UserManagementIcon,
  AccountBalance as LimitsIcon,
  Calculate as CalculateIcon,
  Business as BusinessIcon,
  Backup as BackupIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  hasAnalysisData: boolean;
}

const drawerWidth = 240;


export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  currentPage,
  onPageChange,
  hasAnalysisData,
}) => {
  const { t } = useTranslation();
  const { state: userState, isRole, hasPermission } = useUser();
  const [creditProcessExpanded, setCreditProcessExpanded] = useState(true);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [configurationExpanded, setConfigurationExpanded] = useState(true);

  const handleItemClick = (page: PageType) => {
    onPageChange(page);
  };

  const outOfProcessAnalysisItems = [
    { 
      id: 'data-input' as PageType, 
      label: t('navigation.dataInput'), 
      icon: DataInputIcon,
      description: t('navigation.dataInput')
    },
    { 
      id: 'analysis' as PageType, 
      label: t('navigation.analysis'), 
      icon: AnalysisIcon,
      description: t('navigation.analysis'),
      requiresData: true
    },
    { 
      id: 'reports' as PageType, 
      label: t('navigation.reports'), 
      icon: ReportsIcon,
      description: t('navigation.reports'),
      requiresData: true
    },
  ];

  // Role-based navigation items
  const canViewAnalytics = isRole('management') || isRole('admin') || isRole('branch_manager') || isRole('credit_committee');
  const canCreateApplications = isRole('account_manager') || isRole('admin');
  const canViewConfiguration = isRole('admin') || isRole('management');

  const creditProcessItems = [
    {
      id: 'clients' as PageType,
      label: t('navigation.clients'),
      icon: ClientsIcon,
      description: t('navigation.clients')
    },
    ...(canCreateApplications ? [{
      id: 'credit-application' as PageType,
      label: 'Nouvelle Demande',
      icon: ApplicationIcon,
      description: 'Créer une nouvelle demande de crédit'
    }] : []),
    {
      id: 'workflow' as PageType,
      label: t('navigation.workflow'),
      icon: WorkflowIcon,
      description: t('navigation.workflowDesc')
    },
    ...(canViewAnalytics ? [{
      id: 'analytics' as PageType,
      label: t('navigation.analytics'),
      icon: AnalysisIcon,
      description: t('navigation.analyticsDesc')
    }] : []),
  ];

  const configurationItems = canViewConfiguration ? [
    {
      id: 'user-management' as PageType,
      label: t('navigation.userManagement'),
      icon: UserManagementIcon,
      description: t('navigation.userManagementDesc')
    },
    {
      id: 'credit-types' as PageType,
      label: 'Types de Crédit',
      icon: BusinessIcon,
      description: 'Configuration des types de crédit'
    },
    {
      id: 'approval-limits' as PageType,
      label: 'Limites d\'Approbation',
      icon: LimitsIcon,
      description: 'Configuration des limites d\'approbation'
    },
    {
      id: 'bank-holidays-admin' as PageType,
      label: 'Jours Fériés',
      icon: HolidayIcon,
      description: 'Gestion des jours fériés'
    },
    {
      id: 'backup' as PageType,
      label: 'Sauvegarde & Restauration',
      icon: BackupIcon,
      description: 'Gestion des sauvegardes de la base de données'
    },
  ] : [];

  const creditSimulatorItem = {
    id: 'credit-simulation' as PageType,
    label: 'Simulateur de Crédit',
    icon: CalculateIcon,
    description: 'Calculer mensualités et capacité d\'emprunt'
  };

  const secondaryItems = [
    {
      id: 'documentation' as PageType,
      label: t('navigation.documentation'),
      icon: DocumentationIcon,
      description: t('navigation.documentation')
    },
    {
      id: 'settings' as PageType,
      label: t('navigation.settings'),
      icon: SettingsIcon,
      description: t('navigation.settings')
    },
  ];

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Toolbar />
      
      {/* Logo Section */}
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
        <img 
          src={optimusIcon}
          alt="OptimusCredit Logo" 
          style={{ 
            width: '40px',
            height: '40px',
            marginBottom: '8px'
          }}
        />
        <Typography variant="h6" fontWeight={600}>
          OptimusCredit
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {t('navigation.financialAnalysis')}
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Content - Scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Home Navigation */}
        <List sx={{ px: 1, py: 1 }}>
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            onClick={() => handleItemClick('home')}
            sx={{
              borderRadius: 2,
              mx: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              },
              '&:hover': {
                bgcolor: currentPage === 'home' ? 'primary.dark' : 'action.hover',
              },
            }}
            selected={currentPage === 'home'}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText 
              primary={t('navigation.home')}
              primaryTypographyProps={{
                fontWeight: currentPage === 'home' ? 600 : 400,
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Divider />

      {/* Credit Process Section */}
      <ListItem disablePadding>
        <ListItemButton 
          onClick={() => setCreditProcessExpanded(!creditProcessExpanded)}
          sx={{ mx: 1, borderRadius: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <WorkflowIcon />
          </ListItemIcon>
          <ListItemText 
            primary={
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {t('navigation.creditProcess')}
              </Typography>
            }
          />
          {creditProcessExpanded ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      
      <Collapse in={creditProcessExpanded} timeout="auto" unmountOnExit>
        <List sx={{ px: 1, py: 0, pl: 2 }}>
          {creditProcessItems.map((item) => {
          const isActive = currentPage === item.id;
          
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => handleItemClick(item.id)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
                selected={isActive}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <item.icon />
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.7rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
          })}
        </List>
      </Collapse>

      <Divider />

      {/* Out-of-Process Analysis Section */}
      <ListItem disablePadding>
        <ListItemButton 
          onClick={() => setAnalysisExpanded(!analysisExpanded)}
          sx={{ mx: 1, borderRadius: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <AnalysisIcon />
          </ListItemIcon>
          <ListItemText 
            primary={
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {t('navigation.outOfProcessAnalysis')}
              </Typography>
            }
          />
          {analysisExpanded ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      
      <Collapse in={analysisExpanded} timeout="auto" unmountOnExit>
        <List sx={{ px: 1, py: 0, pl: 2 }}>
          {outOfProcessAnalysisItems.map((item) => {
          const isDisabled = item.requiresData && !hasAnalysisData;
          const isActive = currentPage === item.id;
          
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => !isDisabled && handleItemClick(item.id)}
                disabled={isDisabled}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
                selected={isActive}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.requiresData && hasAnalysisData ? (
                    <Badge color="success" variant="dot">
                      <item.icon />
                    </Badge>
                  ) : (
                    <item.icon />
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.9rem',
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                    sx: { opacity: isActive ? 0.8 : 0.6 },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
          })}
        </List>
      </Collapse>

      <Divider />

      {/* Configuration Section */}
      {configurationItems.length > 0 && (
        <>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => setConfigurationExpanded(!configurationExpanded)}
              sx={{ mx: 1, borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Configuration
                  </Typography>
                }
              />
              {configurationExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={configurationExpanded} timeout="auto" unmountOnExit>
            <List sx={{ px: 1, py: 0, pl: 2 }}>
              {configurationItems.map((item) => {
              const isActive = currentPage === item.id;
              
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() => handleItemClick(item.id)}
                    sx={{
                      borderRadius: 2,
                      mx: 1,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '& .MuiListItemIcon-root': {
                          color: 'white',
                        },
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                      '&:hover': {
                        bgcolor: isActive ? 'primary.dark' : 'action.hover',
                      },
                    }}
                    selected={isActive}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <item.icon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label}
                      secondary={item.description}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 600 : 400,
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.7rem',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
              })}
            </List>
          </Collapse>

          <Divider />
        </>
      )}

      {/* Credit Simulator - Standalone */}
      <List sx={{ px: 1, py: 1 }}>
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            onClick={() => handleItemClick(creditSimulatorItem.id)}
            sx={{
              borderRadius: 2,
              mx: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              },
              '&:hover': {
                bgcolor: currentPage === creditSimulatorItem.id ? 'primary.dark' : 'action.hover',
              },
            }}
            selected={currentPage === creditSimulatorItem.id}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <creditSimulatorItem.icon />
            </ListItemIcon>
            <ListItemText
              primary={creditSimulatorItem.label}
              secondary={creditSimulatorItem.description}
              primaryTypographyProps={{
                fontWeight: currentPage === creditSimulatorItem.id ? 600 : 400,
                fontSize: '0.9rem',
              }}
              secondaryTypographyProps={{
                fontSize: '0.75rem',
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Divider />

      {/* Secondary Navigation */}
      <List sx={{ px: 1, py: 1 }}>
        {secondaryItems.map((item) => {
          const isActive = currentPage === item.id;
          
          return (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                onClick={() => handleItemClick(item.id)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
                selected={isActive}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <item.icon />
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.9rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary">
          Version 2.0.0
        </Typography>
        <br />
        <img 
          src={kaizenLogo}
          alt="Kaizen Business Support Logo" 
          style={{ 
            height: '24px',
            margin: '8px 0'
          }}
        />
        <br />
        <Typography variant="caption" color="text.secondary">
          © 2025 Kaizen Business Support
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        {drawer}
      </Drawer>
      
      {/* Desktop Drawer */}
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};