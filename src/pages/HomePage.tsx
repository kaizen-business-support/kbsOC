import React, { useState } from 'react';
import { Box, Typography, Grid, Chip, Tooltip } from '@mui/material';
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
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import optimusIcon from '../assets/Optimus_icon.png';

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
`;

const floatY = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33%       { transform: translateY(-8px) rotate(0.5deg); }
  66%       { transform: translateY(-4px) rotate(-0.5deg); }
`;

const pulseDot = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.60); }
  50%       { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
`;

const shimmer = keyframes`
  0%   { transform: translateX(-100%) skewX(-12deg); }
  100% { transform: translateX(200%) skewX(-12deg); }
`;

const anim = (
  name: ReturnType<typeof keyframes>,
  dur = '0.50s',
  delay = '0s'
) => `${name} ${dur} cubic-bezier(0.22,1,0.36,1) ${delay} both`;

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleDef {
  id: PageType;
  label: string;
  icon: React.ElementType;
  gradient: string;
  glow: string;
  requiresRole?: string[];
  requiresData?: boolean;
}

interface ModuleGroup {
  label: string;
  accent: string;        // group accent color for the separator
  modules: ModuleDef[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Processus Crédit',
    accent: '#3A56A8',
    modules: [
      {
        id: 'clients', label: 'Clients', icon: GroupsOutlined,
        gradient: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
        glow: 'rgba(29,78,216,0.32)',
      },
      {
        id: 'credit-application', label: 'Nouvelle Demande', icon: NoteAddOutlined,
        gradient: 'linear-gradient(145deg, #4338CA 0%, #818CF8 100%)',
        glow: 'rgba(67,56,202,0.32)',
        requiresRole: ['account_manager', 'admin'],
      },
      {
        id: 'workflow', label: 'Workflow', icon: AccountTreeOutlined,
        gradient: 'linear-gradient(145deg, #6D28D9 0%, #C084FC 100%)',
        glow: 'rgba(109,40,217,0.30)',
      },
      {
        id: 'analytics', label: 'Analytiques', icon: InsightsOutlined,
        gradient: 'linear-gradient(145deg, #0369A1 0%, #22D3EE 100%)',
        glow: 'rgba(3,105,161,0.30)',
        requiresRole: ['management', 'admin', 'branch_manager', 'credit_committee'],
      },
    ],
  },
  {
    label: 'Analyse Hors-Processus',
    accent: '#059669',
    modules: [
      {
        id: 'data-input', label: 'Saisie de Données', icon: EditNoteOutlined,
        gradient: 'linear-gradient(145deg, #047857 0%, #34D399 100%)',
        glow: 'rgba(4,120,87,0.30)',
      },
      {
        id: 'analysis', label: 'Analyse', icon: QueryStatsOutlined,
        gradient: 'linear-gradient(145deg, #B45309 0%, #FCD34D 100%)',
        glow: 'rgba(180,83,9,0.28)',
        requiresData: true,
      },
      {
        id: 'reports', label: 'Rapports', icon: SummarizeOutlined,
        gradient: 'linear-gradient(145deg, #C2410C 0%, #FB923C 100%)',
        glow: 'rgba(194,65,12,0.28)',
        requiresData: true,
      },
    ],
  },
  {
    label: 'Outils',
    accent: '#059669',
    modules: [
      {
        id: 'credit-simulation', label: 'Simulateur de Crédit', icon: RequestQuoteOutlined,
        gradient: 'linear-gradient(145deg, #065F46 0%, #6EE7B7 100%)',
        glow: 'rgba(6,95,70,0.30)',
      },
    ],
  },
  {
    label: 'Configuration',
    accent: '#DB2777',
    modules: [
      {
        id: 'user-management', label: 'Utilisateurs', icon: ManageAccountsOutlined,
        gradient: 'linear-gradient(145deg, #BE185D 0%, #F472B6 100%)',
        glow: 'rgba(190,24,93,0.30)',
        requiresRole: ['admin', 'management'],
      },
      {
        id: 'credit-types', label: 'Types de Crédit', icon: CreditCardOutlined,
        gradient: 'linear-gradient(145deg, #7E22CE 0%, #E879F9 100%)',
        glow: 'rgba(126,34,206,0.30)',
        requiresRole: ['admin', 'management'],
      },
      {
        id: 'approval-limits', label: "Limites d'Approbation", icon: GavelOutlined,
        gradient: 'linear-gradient(145deg, #92400E 0%, #FDE68A 100%)',
        glow: 'rgba(146,64,14,0.28)',
        requiresRole: ['admin', 'management'],
      },
      {
        id: 'bank-holidays-admin', label: 'Jours Fériés', icon: EventNoteOutlined,
        gradient: 'linear-gradient(145deg, #075985 0%, #38BDF8 100%)',
        glow: 'rgba(7,89,133,0.30)',
        requiresRole: ['admin', 'management'],
      },
      {
        id: 'backup', label: 'Sauvegarde', icon: BackupOutlined,
        gradient: 'linear-gradient(145deg, #334155 0%, #94A3B8 100%)',
        glow: 'rgba(51,65,85,0.25)',
        requiresRole: ['admin'],
      },
      {
        id: 'announcements', label: "Notes d'information", icon: CampaignOutlined,
        gradient: 'linear-gradient(145deg, #9D174D 0%, #FDA4AF 100%)',
        glow: 'rgba(157,23,77,0.28)',
        requiresRole: ['admin', 'management'],
      },
      {
        id: 'notifications-config', label: 'Notifications', icon: NotificationsNone,
        gradient: 'linear-gradient(145deg, #C2410C 0%, #FED7AA 100%)',
        glow: 'rgba(194,65,12,0.26)',
        requiresRole: ['admin', 'management'],
      },
    ],
  },
  {
    label: 'Support',
    accent: '#3A56A8',
    modules: [
      {
        id: 'documentation', label: 'Documentation', icon: HelpOutlineOutlined,
        gradient: 'linear-gradient(145deg, #3A56A8 0%, #28A8E2 100%)',
        glow: 'rgba(58,86,168,0.28)',
      },
      {
        id: 'settings', label: 'Paramètres', icon: TuneOutlined,
        gradient: 'linear-gradient(145deg, #1E3A5F 0%, #3A56A8 100%)',
        glow: 'rgba(30,58,95,0.25)',
      },
    ],
  },
];

// ─── Liquid Glass Icon Badge ───────────────────────────────────────────────────

const GlassIconBadge: React.FC<{
  icon: React.ElementType;
  gradient: string;
  glow: string;
  hovered: boolean;
  size?: number;
}> = ({ icon: Icon, gradient, glow, hovered, size = 56 }) => (
  <Box
    sx={{
      width:          size,
      height:         size,
      borderRadius:   `${Math.round(size * 0.25)}px`,   // squircle ratio
      background:     gradient,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      position:       'relative',
      overflow:       'hidden',
      flexShrink:     0,
      boxShadow: hovered
        ? `0 10px 32px ${glow}, 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.38)`
        : `0 4px 14px ${glow}99, 0 1px 4px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.30)`,
      transition:    'box-shadow 0.22s ease',
      // ── Specular highlight — glass top reflection
      '&::before': {
        content:      '""',
        position:     'absolute',
        top:          0,
        left:         0,
        right:        0,
        height:       '46%',
        background:   'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)',
        borderRadius: `${Math.round(size * 0.25)}px ${Math.round(size * 0.25)}px 60% 60%`,
        pointerEvents:'none',
        zIndex:        1,
      },
      // ── Rim shadow — glass depth at bottom
      '&::after': {
        content:      '""',
        position:     'absolute',
        bottom:       0,
        left:         0,
        right:        0,
        height:       '28%',
        background:   'linear-gradient(0deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 100%)',
        borderRadius: `0 0 ${Math.round(size * 0.25)}px ${Math.round(size * 0.25)}px`,
        pointerEvents:'none',
        zIndex:        1,
      },
    }}
  >
    <Icon
      sx={{
        fontSize:  Math.round(size * 0.46),
        color:     'rgba(255,255,255,0.96)',
        position:  'relative',
        zIndex:    2,
        filter:    'drop-shadow(0 1px 3px rgba(0,0,0,0.30))',
        transition:'transform 0.22s cubic-bezier(0.22,1,0.36,1)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
      }}
    />
    {/* Shimmer sweep on hover */}
    {hovered && (
      <Box sx={{
        position:   'absolute',
        top:        0, left: '-30%',
        width:      '30%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
        animation:  `${shimmer} 0.7s ease forwards`,
        zIndex:     3,
        pointerEvents: 'none',
      }} />
    )}
  </Box>
);

// ─── Module Tile ───────────────────────────────────────────────────────────────

interface TileProps {
  mod: ModuleDef;
  onNavigate: (page: PageType) => void;
  disabled?: boolean;
  animDelay?: string;
}

const ModuleTile: React.FC<TileProps> = ({ mod, onNavigate, disabled, animDelay = '0s' }) => {
  const [hovered, setHovered] = useState(false);

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
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            1.5,
          p:              { xs: 1.75, sm: 2.25 },
          borderRadius:   '18px',
          cursor:         disabled ? 'not-allowed' : 'pointer',
          // Glass card surface
          background:     hovered
            ? 'rgba(255,255,255,0.88)'
            : 'rgba(255,255,255,0.68)',
          backdropFilter:      'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          border:         '1px solid rgba(255,255,255,0.65)',
          boxShadow: hovered
            ? `0 16px 48px ${mod.glow}, 0 4px 16px rgba(26,36,64,0.08), inset 0 1px 0 rgba(255,255,255,0.92)`
            : '0 2px 12px rgba(26,36,64,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
          transform:      hovered ? 'translateY(-5px) scale(1.02)' : 'translateY(0) scale(1)',
          opacity:        disabled ? 0.38 : 1,
          transition:     'all 0.24s cubic-bezier(0.22,1,0.36,1)',
          animation:      anim(fadeInScale, '0.44s', animDelay),
          minHeight:      { xs: 110, sm: 120 },
          userSelect:     'none',
          willChange:     'transform',
        }}
      >
        <GlassIconBadge
          icon={mod.icon}
          gradient={mod.gradient}
          glow={mod.glow}
          hovered={hovered}
        />
        <Typography
          sx={{
            fontSize:   '12.5px',
            fontWeight: hovered ? 700 : 600,
            color:      hovered ? '#1A2440' : '#3A4D72',
            textAlign:  'center',
            lineHeight: 1.3,
            fontFamily: '"Inter", sans-serif',
            transition: 'color 0.18s, font-weight 0.18s',
            letterSpacing: '-0.1px',
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

  const isModuleVisible = (mod: ModuleDef): boolean => {
    if (mod.requiresRole) {
      const role = currentUser?.role || '';
      if (!mod.requiresRole.includes(role)) return false;
    }
    return true;
  };

  const isModuleDisabled = (mod: ModuleDef): boolean => !!mod.requiresData;

  const visibleGroups = MODULE_GROUPS
    .map(g => ({ ...g, modules: g.modules.filter(isModuleVisible) }))
    .filter(g => g.modules.length > 0);

  let tileIndex = 0;

  return (
    <Box sx={{ minHeight: '100%', bgcolor: 'transparent' }}>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        background: 'linear-gradient(145deg, #080F26 0%, #0F1E44 35%, #132558 60%, #0E2050 100%)',
        position:   'relative',
        overflow:   'hidden',
        px:         { xs: 3, md: 6 },
        pt:         { xs: 4, md: 5 },
        pb:         { xs: 6, md: 7 },
      }}>
        {/* ── Aurora orbs ── */}
        <Box sx={{
          position: 'absolute', top: -120, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(40,168,226,0.22) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', top: 40, left: 60,
          width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(58,86,168,0.24) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -80, right: 220,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.14) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -40, left: '40%',
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(40,168,226,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <Grid container spacing={3} alignItems="center">
          {/* Left content */}
          <Grid item xs={12} md={8}>
            {/* Greeting pill */}
            {currentUser && (
              <Box sx={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        1,
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border:     '1px solid rgba(255,255,255,0.16)',
                borderRadius:'40px',
                px: 1.75, py: 0.65,
                mb: 2.5,
                animation:  anim(fadeInUp, '0.5s', '0s'),
                boxShadow:  'inset 0 1px 0 rgba(255,255,255,0.14)',
              }}>
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: '#34D399',
                  animation: `${pulseDot} 2.2s ease infinite`,
                }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, fontSize: '13px', fontFamily: '"Inter", sans-serif' }}>
                  Bonjour, <strong style={{ color: '#ffffff' }}>{currentUser.name}</strong>
                </Typography>
                <Box sx={{
                  background: 'linear-gradient(135deg, rgba(58,86,168,0.50), rgba(40,168,226,0.50))',
                  border: '1px solid rgba(40,168,226,0.30)',
                  borderRadius: '20px', px: 1.25, py: 0.2,
                }}>
                  <Typography sx={{ color: '#93C5FD', fontWeight: 700, fontSize: '11px', fontFamily: '"Inter", sans-serif' }}>
                    {getRoleLabel(currentUser.role)}
                  </Typography>
                </Box>
              </Box>
            )}

            <Typography sx={{
              color:      '#FFFFFF',
              fontWeight: 800,
              lineHeight: 1.1,
              mb:         1.5,
              fontFamily: '"Inter", sans-serif',
              letterSpacing: '-0.03em',
              fontSize:   { xs: '2rem', md: '2.6rem' },
              animation:  anim(fadeInUp, '0.55s', '0.07s'),
            }}>
              Tableau de bord
            </Typography>

            <Typography sx={{
              mb:         2.5,
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              fontSize:   { xs: '0.95rem', md: '1.05rem' },
              lineHeight: 1.6,
              animation:  anim(fadeInUp, '0.55s', '0.13s'),
              // sky-blue to light gradient text for subtitle
              background: 'linear-gradient(90deg, rgba(147,197,253,0.90) 0%, rgba(196,181,253,0.90) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {t('home.subtitle')}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', animation: anim(fadeInUp, '0.5s', '0.18s') }}>
              {['SYSCOHADA', 'Bilingue', 'Multi-rôles', 'Score Dual'].map(tag => (
                <Chip key={tag} label={tag} size="small" sx={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  border:    '1px solid rgba(255,255,255,0.18)',
                  color:     'rgba(255,255,255,0.88)',
                  fontWeight:600,
                  fontSize:  '11.5px',
                  fontFamily:'"Inter", sans-serif',
                  borderRadius: '6px',
                  height:    '26px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                }} />
              ))}
            </Box>
          </Grid>

          {/* Right: liquid glass icon badge (desktop) */}
          <Grid item md={4} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <Box sx={{
              width:          120,
              height:         120,
              borderRadius:   '28px',             // squircle
              background:     'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(24px) saturate(200%)',
              WebkitBackdropFilter: 'blur(24px) saturate(200%)',
              border:         '1px solid rgba(255,255,255,0.22)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              position:       'relative',
              overflow:       'hidden',
              animation:      `${floatY} 4.5s ease-in-out infinite, ${fadeInScale} 0.6s 0.22s both`,
              boxShadow:      '0 24px 64px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.28)',
              // specular highlight
              '&::before': {
                content:      '""',
                position:     'absolute',
                top:          0, left: 0, right: 0,
                height:       '44%',
                background:   'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 100%)',
                borderRadius: '28px 28px 60% 60%',
                pointerEvents:'none',
              },
              // rim
              '&::after': {
                content:  '""',
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height:   '28%',
                background: 'linear-gradient(0deg, rgba(0,0,0,0.20) 0%, transparent 100%)',
                borderRadius: '0 0 28px 28px',
                pointerEvents: 'none',
              },
            }}>
              <img
                src={optimusIcon}
                alt="OptimusCredit"
                style={{ width: 72, height: 72, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.30))' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* ══ MODULE LAUNCHER ═══════════════════════════════════════════════════ */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto' }}>
        {visibleGroups.map((group, gi) => {
          const groupStart = tileIndex;
          tileIndex += group.modules.length;
          return (
            <Box key={group.label} sx={{ mb: 4.5 }}>
              {/* Group header */}
              <Box sx={{
                display:    'flex',
                alignItems: 'center',
                gap:        2,
                mb:         2,
                animation:  anim(fadeInUp, '0.45s', `${gi * 0.06}s`),
              }}>
                {/* Accent dot */}
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: group.accent,
                  boxShadow: `0 0 8px ${group.accent}80`,
                }} />
                <Typography sx={{
                  fontSize:      '10.5px',
                  fontWeight:    700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color:         '#8A99B8',
                  fontFamily:    '"Inter", sans-serif',
                  userSelect:    'none',
                }}>
                  {group.label}
                </Typography>
                {/* Gradient line fading right */}
                <Box sx={{
                  flex: 1, height: '1px',
                  background: `linear-gradient(90deg, ${group.accent}30 0%, transparent 100%)`,
                }} />
              </Box>

              {/* Tile grid */}
              <Grid container spacing={1.75}>
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
        <Box sx={{
          textAlign: 'center', py: 3, mt: 2,
          borderTop: '1px solid rgba(58,86,168,0.10)',
        }}>
          <Typography sx={{ color: '#8A99B8', fontSize: '12px', fontFamily: '"Inter", sans-serif', display: 'block' }}>
            Conforme aux normes SYSCOHADA · Optimisé pour les banques sénégalaises
          </Typography>
          <Typography sx={{ color: '#B8C8E8', fontSize: '11.5px', fontFamily: '"Inter", sans-serif', display: 'block', mt: 0.5 }}>
            Version 3.0 · © 2025 Kaizen Business Support
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
