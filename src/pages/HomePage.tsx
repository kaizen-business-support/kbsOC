import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import {
  Analytics as AnalysisIcon,
  GroupsOutlined,
  AccountTreeOutlined,
  InsightsOutlined,
  RequestQuoteOutlined,
  NoteAddOutlined,
  EditNoteOutlined,
  QueryStatsOutlined,
  SummarizeOutlined,
  ManageAccountsOutlined,
  CreditCardOutlined,
  GavelOutlined,
  EventNoteOutlined,
  BackupOutlined,
  CampaignOutlined,
  NotificationsNone,
  HelpOutlineOutlined,
  TuneOutlined,
  DashboardOutlined,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import optimusIcon from '../assets/Optimus_icon.png';

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.90); }
  to   { opacity: 1; transform: scale(1); }
`;

const floatY = keyframes`
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
`;

const pulseDot = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
  50%       { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
`;

const anim = (
  name: ReturnType<typeof keyframes>,
  dur = '0.55s',
  delay = '0s'
) => `${name} ${dur} cubic-bezier(0.22,1,0.36,1) ${delay} both`;

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAVY  = '#0d2137';
const BLUE  = '#1f4e79';
const BLUE2 = '#2e6da4';
const WHITE = '#ffffff';

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleDef {
  id: PageType;
  label: string;
  icon: React.ElementType;
  color: string;        // icon background
  iconColor: string;    // icon color
  requiresRole?: string[];
  requiresData?: boolean;
}

interface ModuleGroup {
  label: string;
  modules: ModuleDef[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Processus Crédit',
    modules: [
      { id: 'clients',            label: 'Clients',          icon: GroupsOutlined,      color: '#eff6ff', iconColor: '#2563eb' },
      { id: 'credit-application', label: 'Nouvelle Demande', icon: NoteAddOutlined,     color: '#eef2ff', iconColor: '#4f46e5', requiresRole: ['account_manager', 'admin'] },
      { id: 'workflow',           label: 'Workflow',         icon: AccountTreeOutlined, color: '#f5f3ff', iconColor: '#7c3aed' },
      { id: 'analytics',         label: 'Analytiques',      icon: InsightsOutlined,    color: '#ecfeff', iconColor: '#0891b2', requiresRole: ['management', 'admin', 'branch_manager', 'credit_committee'] },
    ],
  },
  {
    label: 'Analyse Hors-Processus',
    modules: [
      { id: 'data-input', label: 'Saisie de Données', icon: EditNoteOutlined,   color: '#f0fdf4', iconColor: '#16a34a' },
      { id: 'analysis',   label: 'Analyse',           icon: QueryStatsOutlined, color: '#fefce8', iconColor: '#ca8a04', requiresData: true },
      { id: 'reports',    label: 'Rapports',          icon: SummarizeOutlined,  color: '#fff7ed', iconColor: '#ea580c', requiresData: true },
    ],
  },
  {
    label: 'Outils',
    modules: [
      { id: 'credit-simulation', label: 'Simulateur de Crédit', icon: RequestQuoteOutlined, color: '#f0fdf4', iconColor: '#059669' },
    ],
  },
  {
    label: 'Configuration',
    modules: [
      { id: 'user-management',    label: 'Utilisateurs',         icon: ManageAccountsOutlined, color: '#fff1f2', iconColor: '#e11d48', requiresRole: ['admin', 'management'] },
      { id: 'credit-types',       label: 'Types de Crédit',      icon: CreditCardOutlined,     color: '#fdf4ff', iconColor: '#9333ea', requiresRole: ['admin', 'management'] },
      { id: 'approval-limits',    label: "Limites d'Approbation", icon: GavelOutlined,          color: '#fefce8', iconColor: '#b45309', requiresRole: ['admin', 'management'] },
      { id: 'bank-holidays-admin', label: 'Jours Fériés',        icon: EventNoteOutlined,      color: '#f0f9ff', iconColor: '#0284c7', requiresRole: ['admin', 'management'] },
      { id: 'backup',             label: 'Sauvegarde',           icon: BackupOutlined,         color: '#f8fafc', iconColor: '#475569', requiresRole: ['admin'] },
      { id: 'announcements',      label: "Notes d'information",  icon: CampaignOutlined,       color: '#fff0f6', iconColor: '#db2777', requiresRole: ['admin', 'management'] },
      { id: 'notifications-config', label: 'Notifications',     icon: NotificationsNone,      color: '#fff7ed', iconColor: '#f97316', requiresRole: ['admin', 'management'] },
    ],
  },
  {
    label: 'Support',
    modules: [
      { id: 'documentation', label: 'Documentation', icon: HelpOutlineOutlined, color: '#f8fafc', iconColor: '#64748b' },
      { id: 'settings',      label: 'Paramètres',    icon: TuneOutlined,        color: '#f8fafc', iconColor: '#64748b' },
    ],
  },
];

// ─── Module tile ──────────────────────────────────────────────────────────────

interface TileProps {
  mod: ModuleDef;
  onNavigate: (page: PageType) => void;
  disabled?: boolean;
  animDelay?: string;
}

const ModuleTile: React.FC<TileProps> = ({ mod, onNavigate, disabled, animDelay = '0s' }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = mod.icon;

  return (
    <Tooltip
      title={disabled ? 'Chargez des données pour accéder à cette section' : ''}
      placement="top"
      disableHoverListener={!disabled}
    >
      <Box
        onClick={() => !disabled && onNavigate(mod.id)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.25,
          p: 2,
          borderRadius: '16px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          bgcolor: WHITE,
          border: '1px solid',
          borderColor: hovered ? `${mod.iconColor}40` : '#e8ecf0',
          boxShadow: hovered
            ? `0 8px 32px ${mod.iconColor}18`
            : '0 1px 3px rgba(0,0,0,0.05)',
          transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
          opacity: disabled ? 0.45 : 1,
          transition: 'all 0.22s cubic-bezier(0.22,1,0.36,1)',
          animation: anim(fadeInScale, '0.4s', animDelay),
          minHeight: 110,
          userSelect: 'none',
        }}
      >
        {/* Icon circle */}
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '14px',
            bgcolor: hovered ? mod.iconColor : mod.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.22s ease',
            flexShrink: 0,
          }}
        >
          <Icon
            sx={{
              fontSize: 26,
              color: hovered ? WHITE : mod.iconColor,
              transition: 'color 0.22s ease',
            }}
          />
        </Box>

        {/* Label */}
        <Typography
          sx={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: hovered ? mod.iconColor : '#374151',
            textAlign: 'center',
            lineHeight: 1.3,
            transition: 'color 0.22s ease',
          }}
        >
          {mod.label}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { state: userState, getRoleLabel, isRole } = useUser();
  const currentUser = userState.currentUser;

  const canViewAnalytics      = isRole('management') || isRole('admin') || isRole('branch_manager') || isRole('credit_committee');
  const canCreateApplications = isRole('account_manager') || isRole('admin');
  const canViewConfiguration  = isRole('admin') || isRole('management');

  const isModuleVisible = (mod: ModuleDef): boolean => {
    if (mod.requiresRole) {
      const userRole = currentUser?.role || '';
      if (!mod.requiresRole.includes(userRole)) return false;
    }
    return true;
  };

  const isModuleDisabled = (mod: ModuleDef): boolean => {
    return !!mod.requiresData;
  };

  // Filter visible groups and modules
  const visibleGroups = MODULE_GROUPS
    .map(group => ({
      ...group,
      modules: group.modules.filter(isModuleVisible),
    }))
    .filter(group => group.modules.length > 0);

  // Count total for stagger
  let tileIndex = 0;

  return (
    <Box sx={{ bgcolor: '#f0f4f8', minHeight: '100%' }}>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 55%, ${BLUE2} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        px: { xs: 3, md: 6 },
        pt: { xs: 4, md: 5 },
        pb: { xs: 5, md: 6 },
      }}>
        {/* Blobs */}
        <Box sx={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <Grid container spacing={3} alignItems="center">
          {/* Left */}
          <Grid item xs={12} md={8}>
            {/* Greeting */}
            {currentUser && (
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '40px', px: 2, py: 0.6, mb: 2.5,
                animation: anim(fadeInUp, '0.5s', '0s'),
              }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', animation: `${pulseDot} 2s ease infinite` }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  Bonjour, <strong>{currentUser.name}</strong>
                </Typography>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.18)', borderRadius: '20px', px: 1.5, py: 0.2 }}>
                  <Typography variant="caption" sx={{ color: WHITE, fontWeight: 600 }}>
                    {getRoleLabel(currentUser.role)}
                  </Typography>
                </Box>
              </Box>
            )}

            <Typography variant="h3" fontWeight={800} sx={{
              color: WHITE, lineHeight: 1.12, mb: 1.5,
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              animation: anim(fadeInUp, '0.55s', '0.08s'),
            }}>
              Tableau de bord
              <Box component="span" sx={{
                display: 'block', fontSize: { xs: '1.1rem', md: '1.3rem' },
                fontWeight: 500, mt: 0.5,
                background: 'linear-gradient(90deg, #93c5fd, #c4b5fd)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {t('home.subtitle')}
              </Box>
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', animation: anim(fadeInUp, '0.5s', '0.16s') }}>
              {['SYSCOHADA', 'Bilingue', 'Multi-rôles', 'Score Dual'].map(tag => (
                <Chip key={tag} label={tag} size="small" sx={{
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.72rem',
                }} />
              ))}
            </Box>
          </Grid>

          {/* Right: floating logo (desktop only) */}
          <Grid item md={4} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <Box sx={{
              width: 130, height: 130, borderRadius: '50%',
              background: 'rgba(255,255,255,0.09)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `${floatY} 4s ease-in-out infinite, ${fadeInScale} 0.6s 0.2s both`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            }}>
              <img src={optimusIcon} alt="OptimusCredit" style={{ width: 78, height: 78 }} />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          MODULE LAUNCHER — damier par groupe
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto' }}>
        {visibleGroups.map((group, gi) => {
          const groupStart = tileIndex;
          tileIndex += group.modules.length;
          return (
            <Box key={group.label} sx={{ mb: 4 }}>
              {/* Group header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 2, mb: 2,
                animation: anim(fadeInUp, '0.45s', `${gi * 0.06}s`),
              }}>
                <Typography sx={{
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '1.2px', color: '#94a3b8',
                }}>
                  {group.label}
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: '#e8ecf0' }} />
              </Box>

              {/* Tile grid */}
              <Grid container spacing={1.5}>
                {group.modules.map((mod, mi) => {
                  const idx = groupStart + mi;
                  return (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={mod.id}>
                      <ModuleTile
                        mod={mod}
                        onNavigate={onNavigate}
                        disabled={isModuleDisabled(mod)}
                        animDelay={`${idx * 0.04}s`}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', py: 3, borderTop: '1px solid #e2e8f0', mt: 2 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
            Conforme aux normes SYSCOHADA · Optimisé pour les banques sénégalaises
          </Typography>
          <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', mt: 0.5 }}>
            Version 2.0 — OptimusCredit
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
