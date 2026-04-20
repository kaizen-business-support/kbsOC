import { createTheme } from '@mui/material/styles';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — Dark OLED Financial Dashboard
//   Primary teal   #0F766E  (teal-700)
//   Secondary teal #14B8A6  (teal-400)
//   CTA sky        #0EA5E9  (sky-500)
//   Amber          #F59E0B
//   Background     #0F172A  (slate-900 OLED)
//   Surface        #1E293B  (slate-800)
//   Elevated       #243044
//   Typography     IBM Plex Sans
// ─────────────────────────────────────────────────────────────────────────────

export const brand = {
  primary:     '#0F766E',
  secondary:   '#14B8A6',
  cta:         '#0EA5E9',
  amber:       '#F59E0B',
  gradient:    'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
  gradientHover: 'linear-gradient(135deg, #0D5E57 0%, #0F9E8E 100%)',
  gradientSoft: 'linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(20,184,166,0.06) 100%)',
  shadow:       '0 4px 20px rgba(15,118,110,0.30)',
  shadowHover:  '0 8px 32px rgba(15,118,110,0.40)',
  glow:         '0 0 0 3px rgba(20,184,166,0.25)',
  // Legacy aliases — used in Sidebar / Header hardcoded strings
  deep:         '#0F766E',
  mid:          '#0D9488',
  sky:          '#14B8A6',
};

// ── Dark palette — OLED slate ─────────────────────────────────────────────────
const darkColors = {
  primary: {
    main:         '#0F766E',
    light:        '#14B8A6',
    dark:         '#0D5E57',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main:         '#0EA5E9',
    light:        '#38BDF8',
    dark:         '#0284C7',
    contrastText: '#FFFFFF',
  },
  success: { main: '#10B981', light: '#34D399', dark: '#059669' },
  warning: { main: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
  error:   { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
  info:    { main: '#0EA5E9', light: '#38BDF8', dark: '#0284C7' },
  background: {
    default: '#0F172A',
    paper:   '#1E293B',
  },
  text: {
    primary:   '#F8FAFC',
    secondary: '#94A3B8',
  },
  divider: 'rgba(51,65,85,0.80)',
};

// ── Light palette — clean professional ────────────────────────────────────────
const lightColors = {
  primary: {
    main:         '#0F766E',
    light:        '#14B8A6',
    dark:         '#0D5E57',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main:         '#0EA5E9',
    light:        '#38BDF8',
    dark:         '#0284C7',
    contrastText: '#FFFFFF',
  },
  success: { main: '#059669', light: '#34D399', dark: '#047857' },
  warning: { main: '#D97706', light: '#FCD34D', dark: '#B45309' },
  error:   { main: '#DC2626', light: '#F87171', dark: '#B91C1C' },
  info:    { main: '#0284C7', light: '#38BDF8', dark: '#0369A1' },
  background: {
    default: '#F0FDFC',
    paper:   'rgba(255,255,255,0.90)',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#475569',
  },
  divider: 'rgba(15,118,110,0.12)',
};

// ── Typography — IBM Plex Sans ────────────────────────────────────────────────
const typography = {
  fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontSize: '2rem',    fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3,  letterSpacing: '-0.02em' },
  h3: { fontSize: '1.5rem',  fontWeight: 600, lineHeight: 1.3,  letterSpacing: '-0.01em' },
  h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4,  letterSpacing: '-0.01em' },
  h5: { fontSize: '1.1rem',  fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: '1rem',    fontWeight: 600, lineHeight: 1.5 },
  body1:    { fontSize: '14px', lineHeight: 1.6 },
  body2:    { fontSize: '13px', lineHeight: 1.55 },
  subtitle1:{ fontSize: '14px', fontWeight: 500 },
  subtitle2:{ fontSize: '13px', fontWeight: 500 },
  caption:  { fontSize: '12px', lineHeight: 1.5, letterSpacing: '0.1px' },
  overline: { fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' as const },
};

// ── Banking color tokens ───────────────────────────────────────────────────────
export const bankingColors = {
  positive:   '#10B981',
  negative:   '#EF4444',
  neutral:    '#64748B',
  warning:    '#F59E0B',
  lowRisk:    '#10B981',
  mediumRisk: '#F59E0B',
  highRisk:   '#EF4444',
  excellent:  '#059669',
  good:       '#10B981',
  average:    '#F59E0B',
  poor:       '#EF4444',
  critical:   '#991B1B',
};

// ─────────────────────────────────────────────────────────────────────────────
// DARK THEME — Default (OLED Financial Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  palette: { ...darkColors, mode: 'dark' },
  typography,
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.40)',
    '0 2px 6px rgba(0,0,0,0.40)',
    '0 4px 12px rgba(0,0,0,0.40)',
    '0 8px 24px rgba(0,0,0,0.40)',
    '0 12px 32px rgba(0,0,0,0.45)',
    '0 16px 40px rgba(0,0,0,0.45)',
    '0 20px 48px rgba(0,0,0,0.50)',
    '0 24px 56px rgba(0,0,0,0.50)',
    '0 28px 64px rgba(0,0,0,0.55)',
    '0 32px 72px rgba(0,0,0,0.55)',
    '0 36px 80px rgba(0,0,0,0.55)',
    '0 40px 88px rgba(0,0,0,0.60)',
    '0 44px 96px rgba(0,0,0,0.60)',
    '0 48px 104px rgba(0,0,0,0.60)',
    '0 52px 112px rgba(0,0,0,0.60)',
    '0 56px 120px rgba(0,0,0,0.60)',
    '0 60px 128px rgba(0,0,0,0.60)',
    '0 64px 136px rgba(0,0,0,0.60)',
    '0 68px 144px rgba(0,0,0,0.60)',
    '0 72px 152px rgba(0,0,0,0.60)',
    '0 76px 160px rgba(0,0,0,0.60)',
    '0 80px 168px rgba(0,0,0,0.60)',
    '0 84px 176px rgba(0,0,0,0.60)',
    '0 88px 184px rgba(0,0,0,0.60)',
  ] as any,

  components: {

    // ── Body ──────────────────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: '#0F172A',
          backgroundAttachment: 'fixed',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },

    // ── AppBar — dark glass with teal accent line ─────────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:          'rgba(15,23,42,0.92)',
          backdropFilter:      'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          borderBottom:        '1px solid rgba(51,65,85,0.60)',
          boxShadow:           '0 1px 0 rgba(15,118,110,0.15), 0 2px 20px rgba(0,0,0,0.30)',
          color:               '#F8FAFC',
          '&::after': {
            content:    '""',
            position:   'absolute',
            bottom:     0,
            left:       0,
            right:      0,
            height:     '2px',
            background: 'linear-gradient(90deg, #0F766E 0%, #14B8A6 60%, #0EA5E9 100%)',
            opacity:    0.8,
          },
        },
      },
    },

    // ── Card — slate-800 glass ────────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          background:          'rgba(30,41,59,0.85)',
          backdropFilter:      'blur(16px) saturate(160%)',
          WebkitBackdropFilter:'blur(16px) saturate(160%)',
          border:              '1px solid rgba(51,65,85,0.70)',
          borderRadius:        '12px',
          boxShadow:           '0 4px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
          transition:          'box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease',
          '&:hover': {
            boxShadow:   '0 8px 32px rgba(15,118,110,0.20), 0 4px 24px rgba(0,0,0,0.40)',
            borderColor: 'rgba(15,118,110,0.35)',
            transform:   'translateY(-1px)',
          },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:     'none',
          backgroundColor:     'rgba(30,41,59,0.90)',
          backdropFilter:      'blur(12px) saturate(140%)',
          WebkitBackdropFilter:'blur(12px) saturate(140%)',
        },
        elevation0: { boxShadow: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', background: '#1E293B' },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.40)', background: 'rgba(30,41,59,0.88)' },
        elevation2: { boxShadow: '0 2px 8px rgba(0,0,0,0.45)', background: 'rgba(36,48,68,0.90)' },
        elevation3: { boxShadow: '0 4px 16px rgba(0,0,0,0.50)', background: 'rgba(36,48,68,0.94)' },
        elevation4: { boxShadow: '0 8px 24px rgba(0,0,0,0.50)', background: 'rgba(36,48,68,0.96)' },
      },
    },

    // ── Dialog ────────────────────────────────────────────────────────────────
    MuiDialog: {
      defaultProps: {
        TransitionProps: { timeout: { enter: 220, exit: 140 } },
      },
      styleOverrides: {
        paper: {
          background:          'rgba(30,41,59,0.96)',
          backdropFilter:      'blur(28px) saturate(180%)',
          WebkitBackdropFilter:'blur(28px) saturate(180%)',
          border:              '1px solid rgba(51,65,85,0.70)',
          borderRadius:        '16px',
          boxShadow:           '0 24px 64px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.05)',
        },
      } as any,
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize:     '15px',
          fontWeight:   600,
          color:        '#F8FAFC',
          padding:      '16px 20px 14px',
          borderBottom: '1px solid rgba(51,65,85,0.60)',
          fontFamily:   '"IBM Plex Sans", sans-serif',
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '20px', '&:first-of-type': { paddingTop: '20px' } },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 20px', borderTop: '1px solid rgba(51,65,85,0.60)', gap: '8px' },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius:        '12px',
          border:              '1px solid rgba(51,65,85,0.70)',
          boxShadow:           '0 4px 24px rgba(0,0,0,0.30)',
          background:          'rgba(30,41,59,0.85)',
          backdropFilter:      'blur(12px)',
          WebkitBackdropFilter:'blur(12px)',
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontSize:        '11.5px',
            fontWeight:      600,
            textTransform:   'uppercase',
            letterSpacing:   '0.6px',
            color:           '#64748B',
            backgroundColor: 'rgba(15,118,110,0.06)',
            borderBottom:    '1px solid rgba(51,65,85,0.80)',
            padding:         '10px 16px',
            fontFamily:      '"IBM Plex Sans", sans-serif',
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td, &:last-child th': { borderBottom: 'none' },
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.05)' },
          transition: 'background-color 0.12s ease',
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize:     '13.5px',
          color:        '#CBD5E1',
          padding:      '12px 16px',
          borderBottom: '1px solid rgba(51,65,85,0.50)',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          '&.financial-cell': {
            fontFamily:         '"IBM Plex Mono", "JetBrains Mono", "Fira Code", monospace',
            textAlign:          'right',
            fontVariantNumeric: 'tabular-nums',
          },
          '&.financial-label': { fontWeight: 500, textAlign: 'left' },
        },
      },
    },

    // ── ButtonBase ────────────────────────────────────────────────────────────
    MuiButtonBase: {
      styleOverrides: {
        root: {
          cursor: 'pointer',
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '2px',
            borderRadius:  '6px',
          },
        },
      },
    },

    // ── Button — teal gradient ────────────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          borderRadius:  '8px',
          padding:       '7px 16px',
          fontSize:      '13.5px',
          letterSpacing: '0',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          transition:    'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          lineHeight:    1.5,
          cursor:        'pointer',
          '&:active': {
            transform: 'scale(0.96) !important',
            transition: 'transform 0.08s ease',
          },
        },
        containedPrimary: {
          background:          brand.gradient,
          boxShadow:           '0 2px 12px rgba(15,118,110,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
          '&:hover': {
            background: brand.gradientHover,
            boxShadow:  '0 4px 20px rgba(15,118,110,0.50)',
            transform:  'translateY(-1px)',
          },
        },
        containedSecondary: {
          background:  'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
          boxShadow:   '0 2px 12px rgba(14,165,233,0.30)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
            boxShadow:  '0 4px 20px rgba(14,165,233,0.45)',
            transform:  'translateY(-1px)',
          },
        },
        contained: {
          '&:hover': { filter: 'brightness(1.08)' },
        },
        outlined: {
          borderColor: 'rgba(51,65,85,0.80)',
          color:       '#CBD5E1',
          background:  'rgba(30,41,59,0.60)',
          '&:hover': {
            background:  'rgba(15,118,110,0.10)',
            borderColor: '#14B8A6',
            color:       '#14B8A6',
          },
        },
        text: {
          color:     '#94A3B8',
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.08)', color: '#14B8A6' },
        },
        sizeSmall: { padding: '5px 11px', fontSize: '12.5px', borderRadius: '7px' },
        sizeLarge: { padding: '10px 22px', fontSize: '15px' },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          cursor:       'pointer',
          transition:   'background-color 0.15s ease, transform 0.12s ease, color 0.15s ease',
          '&:hover':    { backgroundColor: 'rgba(15,118,110,0.12)', color: '#14B8A6' },
          '&:active':   { transform: 'scale(0.90)' },
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '2px',
          },
        },
      },
    },

    // ── Input ─────────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius:        '8px',
          backgroundColor:     'rgba(15,23,42,0.60)',
          backdropFilter:      'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          fontSize:            '13.5px',
          fontFamily:          '"IBM Plex Sans", sans-serif',
          color:               '#F8FAFC',
          transition:          'background-color 0.18s, box-shadow 0.18s',
          '&:hover': {
            backgroundColor: 'rgba(15,23,42,0.80)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(15,118,110,0.50)' },
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(15,23,42,0.90)',
            boxShadow:       brand.glow,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#14B8A6',
              borderWidth: '1.5px',
            },
          },
        },
        notchedOutline: {
          borderColor: 'rgba(51,65,85,0.80)',
          transition:  'border-color 0.18s',
        },
        input: {
          padding: '9px 14px',
          '&::placeholder': { color: '#475569', opacity: 1 },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root:   { fontSize: '13.5px', fontWeight: 500, color: '#64748B', fontFamily: '"IBM Plex Sans", sans-serif' },
        shrink: { fontSize: '12px',   fontWeight: 600, letterSpacing: '0.2px', color: '#14B8A6' },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '12px', marginTop: '4px', lineHeight: 1.4, fontFamily: '"IBM Plex Sans", sans-serif', color: '#64748B' },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#64748B' },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight:   500,
          fontSize:     '12px',
          borderRadius: '6px',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          height:       '24px',
        },
        sizeSmall:      { height: '22px', fontSize: '11.5px' },
        colorPrimary:   { background: 'rgba(15,118,110,0.20)', color: '#14B8A6', border: '1px solid rgba(15,118,110,0.35)' },
        colorSecondary: { background: 'rgba(14,165,233,0.18)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.30)' },
        colorSuccess:   { background: 'rgba(16,185,129,0.18)', color: '#34D399', border: '1px solid rgba(16,185,129,0.30)' },
        colorError:     { background: 'rgba(239,68,68,0.18)',  color: '#F87171', border: '1px solid rgba(239,68,68,0.30)' },
        colorWarning:   { background: 'rgba(245,158,11,0.18)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.30)' },
        colorInfo:      { background: 'rgba(14,165,233,0.18)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.30)' },
      },
    },

    // ── Tab ───────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          fontSize:      '13.5px',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          minHeight:     '40px',
          padding:       '8px 16px',
          color:         '#64748B',
          '&.Mui-selected': { color: '#14B8A6', fontWeight: 600 },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height:       '2px',
          borderRadius: '2px 2px 0 0',
          background:   'linear-gradient(90deg, #0F766E 0%, #14B8A6 100%)',
        },
        root: {
          borderBottom: '1px solid rgba(51,65,85,0.60)',
        },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background:          'rgba(15,23,42,0.95)',
          backdropFilter:      'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          border:              '1px solid rgba(51,65,85,0.70)',
          borderRadius:        '7px',
          fontSize:            '12px',
          fontFamily:          '"IBM Plex Sans", sans-serif',
          padding:             '6px 10px',
          fontWeight:          400,
          color:               '#E2E8F0',
          boxShadow:           '0 4px 16px rgba(0,0,0,0.40)',
        },
        arrow: { color: 'rgba(15,23,42,0.95)' },
      },
    },

    // ── Menu ──────────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background:          'rgba(30,41,59,0.96)',
          backdropFilter:      'blur(20px) saturate(160%)',
          WebkitBackdropFilter:'blur(20px) saturate(160%)',
          border:              '1px solid rgba(51,65,85,0.70)',
          borderRadius:        '12px',
          boxShadow:           '0 12px 40px rgba(0,0,0,0.50)',
          padding:             '4px',
        },
        list: { padding: '4px' },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize:      '13.5px',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          minHeight:     '36px',
          paddingTop:    '7px',
          paddingBottom: '7px',
          borderRadius:  '7px',
          color:         '#CBD5E1',
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.10)', color: '#14B8A6' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(15,118,110,0.15)',
            color:           '#14B8A6',
            fontWeight:      500,
            '&:hover':       { backgroundColor: 'rgba(15,118,110,0.20)' },
          },
        },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontSize:     '13.5px',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          border:       '1px solid',
        },
        standardSuccess: { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.30)', color: '#34D399' },
        standardError:   { backgroundColor: 'rgba(239,68,68,0.10)',  borderColor: 'rgba(239,68,68,0.30)',  color: '#F87171' },
        standardWarning: { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.30)', color: '#FCD34D' },
        standardInfo:    { backgroundColor: 'rgba(14,165,233,0.10)', borderColor: 'rgba(14,165,233,0.30)', color: '#38BDF8' },
      },
    },

    // ── LinearProgress — teal gradient ───────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius:    '4px',
          backgroundColor: 'rgba(15,118,110,0.15)',
        },
        bar: {
          borderRadius: '4px',
          background:   brand.gradient,
        },
      },
    },

    // ── Switch ────────────────────────────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        root:  { padding: '6px' },
        thumb: { width: '16px', height: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.40)' },
        track: { borderRadius: '10px', opacity: 1, backgroundColor: '#334155' },
        colorPrimary: {
          '&.Mui-checked + .MuiSwitch-track': {
            background: brand.gradient,
            opacity:    1,
          },
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(51,65,85,0.70)' },
      },
    },

    // ── Skeleton ──────────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(30,41,59,0.80)', borderRadius: '6px' },
      },
    },

    // ── Avatar ────────────────────────────────────────────────────────────────
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontFamily:  '"IBM Plex Sans", sans-serif',
          fontWeight:  600,
          background:  brand.gradient,
          color:       '#FFFFFF',
        },
        colorDefault: { background: brand.gradient },
      },
    },

    // ── Badge ─────────────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: '10px', fontWeight: 600,
          minWidth: '18px', height: '18px', borderRadius: '9px',
        },
      },
    },

    // ── Accordion ─────────────────────────────────────────────────────────────
    MuiAccordion: {
      styleOverrides: {
        root: {
          background:     'rgba(30,41,59,0.85)',
          backdropFilter: 'blur(12px)',
          border:         '1px solid rgba(51,65,85,0.70)',
          borderRadius:   '10px !important',
          boxShadow:      'none',
          '&:before':     { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },

    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          fontSize:   '13.5px',
          fontWeight: 500,
          fontFamily: '"IBM Plex Sans", sans-serif',
          color:      '#CBD5E1',
          minHeight:  '44px !important',
          '&.Mui-expanded': { minHeight: '44px' },
        },
        content: { '&.Mui-expanded': { margin: '12px 0' } },
      },
    },

    // ── ListItemButton ────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          cursor:       'pointer',
          transition:   'background-color 0.15s ease, transform 0.12s ease',
          '&:active':   { transform: 'scale(0.98)' },
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '-2px',
          },
        },
      },
    },

    // ── Popover ───────────────────────────────────────────────────────────────
    MuiPopover: {
      styleOverrides: {
        paper: {
          background:          'rgba(30,41,59,0.96)',
          backdropFilter:      'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          border:              '1px solid rgba(51,65,85,0.70)',
          borderRadius:        '12px',
          boxShadow:           '0 12px 40px rgba(0,0,0,0.50)',
        },
      },
    },

    // ── Stepper ───────────────────────────────────────────────────────────────
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: '#334155',
          '&.Mui-active':    { color: '#0F766E' },
          '&.Mui-completed': { color: '#14B8A6' },
        },
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LIGHT THEME — Clean teal professional (default)
// ─────────────────────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  palette: lightColors,
  typography,
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 2px rgba(15,23,42,0.05)',
    '0 1px 4px rgba(15,23,42,0.07)',
    '0 2px 8px rgba(15,23,42,0.07)',
    '0 4px 16px rgba(15,23,42,0.08)',
    '0 8px 24px rgba(15,23,42,0.09)',
    '0 12px 32px rgba(15,23,42,0.09)',
    '0 16px 40px rgba(15,23,42,0.10)',
    '0 20px 48px rgba(15,23,42,0.10)',
    '0 24px 56px rgba(15,23,42,0.11)',
    '0 28px 64px rgba(15,23,42,0.11)',
    '0 32px 72px rgba(15,23,42,0.11)',
    '0 36px 80px rgba(15,23,42,0.12)',
    '0 40px 88px rgba(15,23,42,0.12)',
    '0 44px 96px rgba(15,23,42,0.12)',
    '0 48px 104px rgba(15,23,42,0.13)',
    '0 52px 112px rgba(15,23,42,0.13)',
    '0 56px 120px rgba(15,23,42,0.13)',
    '0 60px 128px rgba(15,23,42,0.14)',
    '0 64px 136px rgba(15,23,42,0.14)',
    '0 68px 144px rgba(15,23,42,0.14)',
    '0 72px 152px rgba(15,23,42,0.15)',
    '0 76px 160px rgba(15,23,42,0.15)',
    '0 80px 168px rgba(15,23,42,0.15)',
    '0 84px 176px rgba(15,23,42,0.16)',
  ] as any,

  components: {

    // ── Body ──────────────────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: '#F8FAFC',
          backgroundAttachment: 'fixed',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },

    // ── AppBar — white glass + teal accent line ───────────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:          'rgba(255,255,255,0.88)',
          backdropFilter:      'blur(20px) saturate(200%)',
          WebkitBackdropFilter:'blur(20px) saturate(200%)',
          borderBottom:        '1px solid rgba(226,232,240,0.80)',
          boxShadow:           '0 1px 0 rgba(15,118,110,0.06), 0 2px 16px rgba(15,23,42,0.05)',
          color:               '#0F172A',
          '&::after': {
            content:    '""',
            position:   'absolute',
            bottom:     0,
            left:       0,
            right:      0,
            height:     '2px',
            background: 'linear-gradient(90deg, #0F766E 0%, #14B8A6 60%, #0EA5E9 100%)',
            opacity:    0.75,
          },
        },
      },
    },

    // ── Card ──────────────────────────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          background:           '#FFFFFF',
          border:               '1px solid #E2E8F0',
          borderRadius:         '12px',
          boxShadow:            '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
          transition:           'box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease',
          '&:hover': {
            boxShadow:   '0 4px 20px rgba(15,118,110,0.12), 0 1px 4px rgba(15,23,42,0.06)',
            borderColor: 'rgba(15,118,110,0.20)',
            transform:   'translateY(-1px)',
          },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation0: { boxShadow: 'none', background: '#FFFFFF' },
        elevation1: { boxShadow: '0 1px 4px rgba(15,23,42,0.07)',  background: '#FFFFFF' },
        elevation2: { boxShadow: '0 2px 8px rgba(15,23,42,0.08)',  background: '#FFFFFF' },
        elevation3: { boxShadow: '0 4px 16px rgba(15,23,42,0.09)', background: '#FFFFFF' },
        elevation4: { boxShadow: '0 8px 24px rgba(15,23,42,0.10)', background: '#FFFFFF' },
      },
    },

    // ── Dialog ────────────────────────────────────────────────────────────────
    MuiDialog: {
      defaultProps: {
        TransitionProps: { timeout: { enter: 220, exit: 140 } },
      },
      styleOverrides: {
        paper: {
          background:   '#FFFFFF',
          border:       '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow:    '0 20px 60px rgba(15,23,42,0.15)',
        },
      } as any,
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize:     '15px',
          fontWeight:   600,
          color:        '#0F172A',
          padding:      '16px 20px 14px',
          borderBottom: '1px solid #F1F5F9',
          fontFamily:   '"IBM Plex Sans", sans-serif',
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '20px', '&:first-of-type': { paddingTop: '20px' } },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 20px', borderTop: '1px solid #F1F5F9', gap: '8px' },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border:       '1px solid #E2E8F0',
          boxShadow:    '0 1px 4px rgba(15,23,42,0.06)',
          background:   '#FFFFFF',
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontSize:        '11.5px',
            fontWeight:      600,
            textTransform:   'uppercase',
            letterSpacing:   '0.6px',
            color:           '#64748B',
            backgroundColor: '#F8FAFC',
            borderBottom:    '1px solid #E2E8F0',
            padding:         '10px 16px',
            fontFamily:      '"IBM Plex Sans", sans-serif',
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td, &:last-child th': { borderBottom: 'none' },
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.03)' },
          transition: 'background-color 0.12s ease',
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize:     '13.5px',
          color:        '#1E293B',
          padding:      '12px 16px',
          borderBottom: '1px solid #F1F5F9',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          '&.financial-cell': {
            fontFamily:         '"IBM Plex Mono", "JetBrains Mono", monospace',
            textAlign:          'right',
            fontVariantNumeric: 'tabular-nums',
          },
          '&.financial-label': { fontWeight: 500 },
        },
      },
    },

    // ── ButtonBase ────────────────────────────────────────────────────────────
    MuiButtonBase: {
      styleOverrides: {
        root: {
          cursor: 'pointer',
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '2px',
            borderRadius:  '6px',
          },
        },
      },
    },

    // ── Button ────────────────────────────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          borderRadius:  '8px',
          padding:       '7px 16px',
          fontSize:      '13.5px',
          letterSpacing: '0',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          transition:    'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          lineHeight:    1.5,
          cursor:        'pointer',
          '&:active': { transform: 'scale(0.96) !important', transition: 'transform 0.08s ease' },
        },
        containedPrimary: {
          background: brand.gradient,
          boxShadow:  '0 2px 12px rgba(15,118,110,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
          '&:hover': {
            background: brand.gradientHover,
            boxShadow:  '0 4px 20px rgba(15,118,110,0.38)',
            transform:  'translateY(-1px)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
          boxShadow:  '0 2px 12px rgba(14,165,233,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
            transform:  'translateY(-1px)',
          },
        },
        contained: {
          '&:hover': { filter: 'brightness(1.04)' },
        },
        outlined: {
          borderColor: '#CBD5E1',
          color:       '#334155',
          background:  '#FFFFFF',
          '&:hover': {
            borderColor: '#0F766E',
            color:       '#0F766E',
            background:  'rgba(15,118,110,0.04)',
            boxShadow:   '0 1px 4px rgba(15,118,110,0.12)',
          },
        },
        text: {
          color:     '#475569',
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.06)', color: '#0F766E' },
        },
        sizeSmall: { padding: '5px 11px', fontSize: '12.5px', borderRadius: '7px' },
        sizeLarge: { padding: '10px 22px', fontSize: '15px' },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          cursor:       'pointer',
          transition:   'all 0.15s ease',
          '&:hover':    { backgroundColor: 'rgba(15,118,110,0.07)', color: '#0F766E' },
          '&:active':   { transform: 'scale(0.90)' },
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '2px',
          },
        },
      },
    },

    // ── Input ─────────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius:    '8px',
          backgroundColor: '#FFFFFF',
          fontSize:        '13.5px',
          fontFamily:      '"IBM Plex Sans", sans-serif',
          transition:      'box-shadow 0.18s',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(20,184,166,0.18)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#0F766E',
              borderWidth: '1.5px',
            },
          },
        },
        notchedOutline: {
          borderColor: '#CBD5E1',
          transition:  'border-color 0.18s',
        },
        input: {
          padding: '9px 14px',
          color: '#0F172A',
          '&::placeholder': { color: '#94A3B8', opacity: 1 },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root:   { fontSize: '13.5px', fontWeight: 500, color: '#475569', fontFamily: '"IBM Plex Sans", sans-serif' },
        shrink: { fontSize: '12px',   fontWeight: 600, letterSpacing: '0.2px', color: '#0F766E' },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '12px', marginTop: '4px', lineHeight: 1.4, fontFamily: '"IBM Plex Sans", sans-serif' },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight:   500,
          fontSize:     '12px',
          borderRadius: '6px',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          height:       '24px',
        },
        sizeSmall:      { height: '22px', fontSize: '11.5px' },
        colorPrimary:   { background: '#0F766E', color: '#FFFFFF', border: 'none' },
        colorSecondary: { background: '#0EA5E9', color: '#FFFFFF', border: 'none' },
        colorSuccess:   { backgroundColor: '#059669', color: '#FFFFFF', border: 'none' },
        colorError:     { backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none' },
        colorWarning:   { backgroundColor: '#D97706', color: '#FFFFFF', border: 'none' },
        colorInfo:      { backgroundColor: '#0284C7', color: '#FFFFFF', border: 'none' },
      },
    },

    // ── Tab ───────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          fontSize:      '13.5px',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          minHeight:     '40px',
          padding:       '8px 16px',
          color:         '#64748B',
          '&.Mui-selected': { color: '#0F766E', fontWeight: 600 },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height:       '2px',
          borderRadius: '2px 2px 0 0',
          background:   brand.gradient,
        },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background:   'rgba(15,23,42,0.90)',
          borderRadius: '7px',
          fontSize:     '12px',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          padding:      '6px 10px',
          fontWeight:   400,
          boxShadow:    '0 4px 16px rgba(15,23,42,0.20)',
        },
        arrow: { color: 'rgba(15,23,42,0.90)' },
      },
    },

    // ── Menu ──────────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background:   '#FFFFFF',
          border:       '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow:    '0 12px 40px rgba(15,23,42,0.14)',
          padding:      '4px',
        },
        list: { padding: '4px' },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize:      '13.5px',
          fontFamily:    '"IBM Plex Sans", sans-serif',
          minHeight:     '36px',
          paddingTop:    '7px',
          paddingBottom: '7px',
          borderRadius:  '7px',
          color:         '#1E293B',
          '&:hover': { backgroundColor: 'rgba(15,118,110,0.06)', color: '#0F766E' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(15,118,110,0.08)',
            color:           '#0F766E',
            fontWeight:      500,
            '&:hover':       { backgroundColor: 'rgba(15,118,110,0.12)' },
          },
        },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontSize:     '13.5px',
          fontFamily:   '"IBM Plex Sans", sans-serif',
          border:       '1px solid',
        },
        standardSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' },
        standardError:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
        standardWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
        standardInfo:    { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8' },
      },
    },

    // ── LinearProgress ────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: '4px', backgroundColor: 'rgba(15,118,110,0.10)' },
        bar:  { borderRadius: '4px', background: brand.gradient },
      },
    },

    // ── Switch ────────────────────────────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        root:  { padding: '6px' },
        thumb: { width: '16px', height: '16px', boxShadow: '0 1px 3px rgba(15,23,42,0.20)' },
        track: { borderRadius: '10px', opacity: 1, backgroundColor: '#CBD5E1' },
        colorPrimary: {
          '&.Mui-checked + .MuiSwitch-track': { background: brand.gradient, opacity: 1 },
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#F1F5F9' },
      },
    },

    // ── Skeleton ──────────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: '#F1F5F9', borderRadius: '6px' },
      },
    },

    // ── Avatar ────────────────────────────────────────────────────────────────
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontFamily:  '"IBM Plex Sans", sans-serif',
          fontWeight:  600,
          background:  brand.gradient,
          color:       '#FFFFFF',
        },
        colorDefault: { background: brand.gradient },
      },
    },

    // ── Badge ─────────────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: '10px', fontWeight: 600,
          minWidth: '18px', height: '18px', borderRadius: '9px',
        },
      },
    },

    // ── Accordion ─────────────────────────────────────────────────────────────
    MuiAccordion: {
      styleOverrides: {
        root: {
          background:   '#FFFFFF',
          border:       '1px solid #E2E8F0',
          borderRadius: '10px !important',
          boxShadow:    'none',
          '&:before':   { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },

    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          fontSize:   '13.5px',
          fontWeight: 500,
          fontFamily: '"IBM Plex Sans", sans-serif',
          color:      '#1E293B',
          minHeight:  '44px !important',
          '&.Mui-expanded': { minHeight: '44px' },
        },
        content: { '&.Mui-expanded': { margin: '12px 0' } },
      },
    },

    // ── ListItemButton ────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          cursor:       'pointer',
          transition:   'background-color 0.15s ease, transform 0.12s ease',
          '&:active':   { transform: 'scale(0.98)' },
          '&.Mui-focusVisible': {
            outline:       '2px solid #14B8A6',
            outlineOffset: '-2px',
          },
        },
      },
    },

    // ── Popover ───────────────────────────────────────────────────────────────
    MuiPopover: {
      styleOverrides: {
        paper: {
          background:   '#FFFFFF',
          border:       '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow:    '0 12px 40px rgba(15,23,42,0.14)',
        },
      },
    },

    // ── Stepper ───────────────────────────────────────────────────────────────
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: '#CBD5E1',
          '&.Mui-active':    { color: '#0F766E' },
          '&.Mui-completed': { color: '#14B8A6' },
        },
      },
    },
  },
});

// ── Financial theme extension ──────────────────────────────────────────────────
export const financialTheme = {
  ...darkTheme,
  financial: {
    colors: bankingColors,
    typography: {
      currency:   { fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontWeight: 600, fontSize: '1.05rem', textAlign: 'right' as const },
      percentage: { fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontWeight: 500, fontSize: '1rem',    textAlign: 'right' as const },
      ratio:      { fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontWeight: 400, fontSize: '0.875rem',textAlign: 'right' as const },
    },
    spacing: { cardPadding: '20px', sectionSpacing: '24px', tableSpacing: '16px' },
  },
};

export const theme = lightTheme;
export default lightTheme;
