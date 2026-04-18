import { createTheme } from '@mui/material/styles';

// ─────────────────────────────────────────────────────────────────────────────
// KAIZEN BRAND COLORS  (extracted from OC_logo.png)
//   brand.deep  #3A56A8  — left semicircle  (indigo)
//   brand.mid   #2878C8  — gradient center
//   brand.sky   #28A8E2  — right K-strokes  (cerulean)
//   gradient    135deg, #3A56A8 → #2878C8 → #28A8E2
// ─────────────────────────────────────────────────────────────────────────────
export const brand = {
  deep:     '#3A56A8',
  mid:      '#2878C8',
  sky:      '#28A8E2',
  gradient: 'linear-gradient(135deg, #3A56A8 0%, #2878C8 52%, #28A8E2 100%)',
  gradientHover: 'linear-gradient(135deg, #2C3F82 0%, #1F66B5 52%, #1E92CC 100%)',
  gradientSoft: 'linear-gradient(135deg, rgba(58,86,168,0.09) 0%, rgba(40,168,226,0.05) 100%)',
  shadow: '0 4px 20px rgba(40,120,200,0.28)',
  shadowHover: '0 8px 32px rgba(40,120,200,0.38)',
  glow: '0 0 0 3px rgba(40,168,226,0.20)',
};

// ── Light palette ─────────────────────────────────────────────────────────────
const colors = {
  primary: {
    main:         brand.deep,
    light:        brand.sky,
    dark:         '#2C3F82',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main:         brand.sky,
    light:        '#5DC0EC',
    dark:         '#1E7DB5',
    contrastText: '#FFFFFF',
  },
  success: { main: '#099250', light: '#32D583', dark: '#027A48' },
  warning: { main: '#F79009', light: '#FDB022', dark: '#B54708' },
  error:   { main: '#F04438', light: '#F97066', dark: '#B42318' },
  info:    { main: brand.sky,  light: '#5DC0EC', dark: '#1E7DB5' },
  background: {
    default: '#EDF1FC',       // overridden by CSS gradient
    paper:   'rgba(255,255,255,0.82)',
  },
  text: {
    primary:   '#1A2440',     // indigo-tinted near-black
    secondary: '#6B7A99',     // indigo-tinted gray
  },
  divider: 'rgba(58,86,168,0.10)',
};

// ── Dark palette ───────────────────────────────────────────────────────────────
const darkColors = {
  primary:    { main: brand.sky,  light: '#7AD3F0', dark: brand.mid, contrastText: '#FFFFFF' },
  secondary:  { main: brand.mid,  light: brand.sky, dark: brand.deep, contrastText: '#FFFFFF' },
  success:    { main: '#32D583', light: '#6EE7B7', dark: '#099250' },
  warning:    { main: '#FDB022', light: '#FDE68A', dark: '#F79009' },
  error:      { main: '#F97066', light: '#FECACA', dark: '#F04438' },
  info:       { main: '#5DC0EC', light: '#BAE6FD', dark: brand.sky },
  background: { default: '#0B0F1C', paper: '#131929' },
  text:       { primary: '#E8EEFF', secondary: '#7B90BE' },
  divider:    'rgba(40,168,226,0.15)',
};

// ── Typography ─────────────────────────────────────────────────────────────────
const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontSize: '2rem',    fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3,  letterSpacing: '-0.02em' },
  h3: { fontSize: '1.5rem',  fontWeight: 600, lineHeight: 1.3,  letterSpacing: '-0.01em' },
  h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4,  letterSpacing: '-0.01em' },
  h5: { fontSize: '1.1rem',  fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: '1rem',    fontWeight: 600, lineHeight: 1.5 },
  body1:    { fontSize: '14px', lineHeight: 1.57 },
  body2:    { fontSize: '13px', lineHeight: 1.53 },
  subtitle1:{ fontSize: '14px', fontWeight: 500 },
  subtitle2:{ fontSize: '13px', fontWeight: 500 },
  caption:  { fontSize: '12px', lineHeight: 1.5, letterSpacing: '0.1px' },
  overline: { fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' as const },
};

// ── Banking color tokens ───────────────────────────────────────────────────────
export const bankingColors = {
  positive:   '#099250',
  negative:   '#D92D20',
  neutral:    '#6B7A99',
  warning:    '#F79009',
  lowRisk:    '#32D583',
  mediumRisk: '#F79009',
  highRisk:   '#F04438',
  excellent:  '#099250',
  good:       '#32D583',
  average:    '#F79009',
  poor:       '#F04438',
  critical:   '#7A271A',
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHT THEME
// ─────────────────────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  palette: colors,
  typography,
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 2px rgba(26,36,64,0.06)',
    '0 1px 4px rgba(26,36,64,0.08)',
    '0 2px 8px rgba(26,36,64,0.08)',
    '0 4px 16px rgba(26,36,64,0.08)',
    '0 8px 24px rgba(26,36,64,0.10)',
    '0 12px 32px rgba(26,36,64,0.10)',
    '0 16px 40px rgba(26,36,64,0.12)',
    '0 20px 48px rgba(26,36,64,0.12)',
    '0 24px 56px rgba(26,36,64,0.14)',
    '0 28px 64px rgba(26,36,64,0.14)',
    '0 32px 72px rgba(26,36,64,0.14)',
    '0 36px 80px rgba(26,36,64,0.16)',
    '0 40px 88px rgba(26,36,64,0.16)',
    '0 44px 96px rgba(26,36,64,0.16)',
    '0 48px 104px rgba(26,36,64,0.18)',
    '0 52px 112px rgba(26,36,64,0.18)',
    '0 56px 120px rgba(26,36,64,0.18)',
    '0 60px 128px rgba(26,36,64,0.20)',
    '0 64px 136px rgba(26,36,64,0.20)',
    '0 68px 144px rgba(26,36,64,0.20)',
    '0 72px 152px rgba(26,36,64,0.22)',
    '0 76px 160px rgba(26,36,64,0.22)',
    '0 80px 168px rgba(26,36,64,0.22)',
    '0 84px 176px rgba(26,36,64,0.24)',
  ] as any,

  components: {

    // ── Body ─────────────────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // gradient set in index.css
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },

    // ── AppBar — glass with brand gradient accent line ────────────────────────
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:          'rgba(255,255,255,0.80)',
          backdropFilter:      'blur(20px) saturate(200%)',
          WebkitBackdropFilter:'blur(20px) saturate(200%)',
          // brand gradient accent as bottom border
          borderBottom:        '1px solid rgba(255,255,255,0.50)',
          boxShadow:           '0 1px 0 rgba(58,86,168,0.08), 0 2px 16px rgba(26,36,64,0.06)',
          color:               '#1A2440',
          '&::after': {
            content:    '""',
            position:   'absolute',
            bottom:     0,
            left:       0,
            right:      0,
            height:     '2px',
            background: 'linear-gradient(90deg, #3A56A8 0%, #2878C8 50%, #28A8E2 100%)',
            opacity:    0.7,
          },
        },
      },
    },

    // ── Card — brand-tinted glass ─────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          background:           'rgba(255,255,255,0.76)',
          backdropFilter:       'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border:               '1px solid rgba(255,255,255,0.62)',
          borderRadius:         '12px',
          boxShadow:            '0 2px 16px rgba(26,36,64,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
          transition:           'box-shadow 0.22s ease, transform 0.22s ease',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(40,120,200,0.12), inset 0 1px 0 rgba(255,255,255,0.90)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:     'none',
          backdropFilter:      'blur(12px) saturate(160%)',
          WebkitBackdropFilter:'blur(12px) saturate(160%)',
        },
        elevation0: { boxShadow: 'none',  backdropFilter: 'none', WebkitBackdropFilter: 'none', background: '#FFFFFF' },
        elevation1: { boxShadow: '0 1px 4px rgba(26,36,64,0.08)',  background: 'rgba(255,255,255,0.80)' },
        elevation2: { boxShadow: '0 2px 8px rgba(26,36,64,0.08)',  background: 'rgba(255,255,255,0.82)' },
        elevation3: { boxShadow: '0 4px 16px rgba(26,36,64,0.09)', background: 'rgba(255,255,255,0.86)' },
        elevation4: { boxShadow: '0 8px 24px rgba(26,36,64,0.10)', background: 'rgba(255,255,255,0.90)' },
      },
    },

    // ── Dialog — glass panel + scale-in Apple animation ──────────────────────
    MuiDialog: {
      defaultProps: {
        TransitionProps: { timeout: { enter: 220, exit: 140 } },
      },
      styleOverrides: {
        paper: {
          background:          'rgba(255,255,255,0.92)',
          backdropFilter:      'blur(28px) saturate(200%)',
          WebkitBackdropFilter:'blur(28px) saturate(200%)',
          border:              '1px solid rgba(255,255,255,0.72)',
          borderRadius:        '16px',
          boxShadow:           '0 24px 64px rgba(26,36,64,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
        },
      } as any,
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize:     '15px',
          fontWeight:   600,
          color:        '#1A2440',
          padding:      '16px 20px 14px',
          borderBottom: '1px solid rgba(58,86,168,0.08)',
          fontFamily:   '"Inter", sans-serif',
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
        root: { padding: '12px 20px', borderTop: '1px solid rgba(58,86,168,0.08)', gap: '8px' },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius:        '12px',
          border:              '1px solid rgba(255,255,255,0.62)',
          boxShadow:           '0 2px 16px rgba(26,36,64,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
          background:          'rgba(255,255,255,0.80)',
          backdropFilter:      'blur(12px) saturate(160%)',
          WebkitBackdropFilter:'blur(12px) saturate(160%)',
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
            letterSpacing:   '0.5px',
            color:           '#6B7A99',
            backgroundColor: 'rgba(58,86,168,0.04)',
            borderBottom:    '1px solid rgba(58,86,168,0.10)',
            padding:         '10px 16px',
            fontFamily:      '"Inter", sans-serif',
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td, &:last-child th': { borderBottom: 'none' },
          '&:hover': { backgroundColor: 'rgba(40,120,200,0.03)' },
          transition: 'background-color 0.12s ease',
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize:     '13.5px',
          color:        '#2A3A5C',
          padding:      '12px 16px',
          borderBottom: '1px solid rgba(58,86,168,0.06)',
          fontFamily:   '"Inter", sans-serif',
          '&.financial-header': {
            backgroundColor: 'rgba(58,86,168,0.04)',
            fontWeight:      600,
            textAlign:       'center',
            borderBottom:    '2px solid rgba(58,86,168,0.12)',
          },
          '&.financial-cell': {
            fontFamily:         '"JetBrains Mono", "Fira Code", monospace',
            textAlign:          'right',
            fontVariantNumeric: 'tabular-nums',
          },
          '&.financial-label': { fontWeight: 500, textAlign: 'left' },
        },
      },
    },

    // ── ButtonBase — cursor + focus ring ──────────────────────────────────────
    MuiButtonBase: {
      styleOverrides: {
        root: {
          cursor: 'pointer',
          '&.Mui-focusVisible': {
            outline:       `2px solid ${brand.sky}`,
            outlineOffset: '2px',
            borderRadius:  '6px',
          },
        },
      },
    },

    // ── Button — brand gradient + Apple press state ───────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          borderRadius:  '8px',
          padding:       '7px 16px',
          fontSize:      '13.5px',
          letterSpacing: '0',
          fontFamily:    '"Inter", sans-serif',
          transition:    'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          lineHeight:    1.5,
          cursor:        'pointer',
          // Apple-style: slight scale-down on press
          '&:active': {
            transform: 'scale(0.96) !important',
            transition: 'transform 0.08s ease',
          },
        },
        containedPrimary: {
          background:          brand.gradient,
          boxShadow:           `0 2px 12px rgba(40,120,200,0.28), inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter:      'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          '&:hover': {
            background: brand.gradientHover,
            boxShadow:  `0 4px 20px rgba(40,120,200,0.40), inset 0 1px 0 rgba(255,255,255,0.20)`,
            transform:  'translateY(-1px)',
          },
        },
        containedSecondary: {
          background:  `linear-gradient(135deg, ${brand.mid} 0%, ${brand.sky} 100%)`,
          boxShadow:   `0 2px 12px rgba(40,168,226,0.28)`,
          '&:hover': {
            background: `linear-gradient(135deg, #1F66B5 0%, #1E92CC 100%)`,
            boxShadow:  `0 4px 20px rgba(40,168,226,0.40)`,
            transform:  'translateY(-1px)',
          },
        },
        contained: {
          boxShadow: '0 1px 3px rgba(26,36,64,0.12), inset 0 1px 0 rgba(255,255,255,0.14)',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(26,36,64,0.18)',
            filter:    'brightness(1.04)',
          },
        },
        outlined: {
          borderColor: '#D0D5DD',
          color:       '#344054',
          background:  '#FFFFFF',
          '&:hover': {
            background:   '#F9FAFB',
            borderColor:  '#98A2B3',
            boxShadow:    '0 1px 4px rgba(16,24,40,0.08)',
          },
        },
        text: {
          color:     '#344054',
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)', color: '#101828' },
        },
        sizeSmall: { padding: '5px 11px', fontSize: '12.5px', borderRadius: '7px' },
        sizeLarge: { padding: '10px 22px', fontSize: '15px' },
      },
    },

    // ── IconButton — press state ───────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          cursor:       'pointer',
          transition:   'background-color 0.15s ease, transform 0.12s ease',
          '&:hover':    { backgroundColor: 'rgba(58,86,168,0.07)' },
          '&:active':   { transform: 'scale(0.90)' },
          '&.Mui-focusVisible': {
            outline:       `2px solid ${brand.sky}`,
            outlineOffset: '2px',
          },
        },
      },
    },

    // ── Input — glass field ────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius:        '8px',
          backgroundColor:     'rgba(255,255,255,0.72)',
          backdropFilter:      'blur(8px) saturate(150%)',
          WebkitBackdropFilter:'blur(8px) saturate(150%)',
          fontSize:            '13.5px',
          fontFamily:          '"Inter", sans-serif',
          transition:          'background-color 0.18s, box-shadow 0.18s',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.86)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(58,86,168,0.35)' },
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(255,255,255,0.94)',
            boxShadow:       brand.glow,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: brand.sky,
              borderWidth: '1.5px',
            },
          },
        },
        notchedOutline: {
          borderColor: 'rgba(58,86,168,0.16)',
          transition:  'border-color 0.18s',
        },
        input: {
          padding: '9px 14px',
          '&::placeholder': { color: '#8A99B8', opacity: 1 },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root:   { fontSize: '13.5px', fontWeight: 500, color: '#3A4D72', fontFamily: '"Inter", sans-serif' },
        shrink: { fontSize: '12px',   fontWeight: 600, letterSpacing: '0.2px', color: brand.deep },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '12px', marginTop: '4px', lineHeight: 1.4, fontFamily: '"Inter", sans-serif' },
      },
    },

    // ── Chip — brand palette ───────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight:   500,
          fontSize:     '12px',
          borderRadius: '6px',
          fontFamily:   '"Inter", sans-serif',
          height:       '24px',
        },
        sizeSmall:    { height: '22px', fontSize: '11.5px' },
        colorPrimary:   { background: brand.deep,    color: '#FFFFFF', border: 'none' },
        colorSecondary: { background: brand.mid,     color: '#FFFFFF', border: 'none' },
        colorSuccess:   { backgroundColor: '#027A48', color: '#FFFFFF', border: 'none' },
        colorError:     { backgroundColor: '#B42318', color: '#FFFFFF', border: 'none' },
        colorWarning:   { backgroundColor: '#B54708', color: '#FFFFFF', border: 'none' },
        colorInfo:      { background: brand.sky,     color: '#FFFFFF', border: 'none' },
      },
    },

    // ── Tab ────────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    500,
          fontSize:      '13.5px',
          fontFamily:    '"Inter", sans-serif',
          minHeight:     '40px',
          padding:       '8px 16px',
          color:         '#6B7A99',
          '&.Mui-selected': { color: brand.deep, fontWeight: 600 },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height:     '2px',
          borderRadius: '2px 2px 0 0',
          background: brand.gradient,
        },
      },
    },

    // ── Tooltip — glass dark ───────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background:          'rgba(20,30,60,0.90)',
          backdropFilter:      'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          border:              '1px solid rgba(255,255,255,0.10)',
          borderRadius:        '7px',
          fontSize:            '12px',
          fontFamily:          '"Inter", sans-serif',
          padding:             '6px 10px',
          fontWeight:          400,
          boxShadow:           '0 4px 16px rgba(0,0,0,0.20)',
        },
        arrow: { color: 'rgba(20,30,60,0.90)' },
      },
    },

    // ── Menu — glass dropdown ──────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background:          'rgba(255,255,255,0.90)',
          backdropFilter:      'blur(20px) saturate(200%)',
          WebkitBackdropFilter:'blur(20px) saturate(200%)',
          border:              '1px solid rgba(255,255,255,0.68)',
          borderRadius:        '12px',
          boxShadow:           '0 12px 40px rgba(26,36,64,0.14), inset 0 1px 0 rgba(255,255,255,0.95)',
          padding:             '4px',
        },
        list: { padding: '4px' },
      },
    },

    // ── MenuItem ───────────────────────────────────────────────────────────────
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize:      '13.5px',
          fontFamily:    '"Inter", sans-serif',
          minHeight:     '36px',
          paddingTop:    '7px',
          paddingBottom: '7px',
          borderRadius:  '7px',
          color:         '#2A3A5C',
          '&:hover': { backgroundColor: 'rgba(58,86,168,0.06)' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(58,86,168,0.08)',
            color:           brand.deep,
            fontWeight:      500,
            '&:hover':       { backgroundColor: 'rgba(58,86,168,0.12)' },
          },
        },
      },
    },

    // ── Alert ──────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontSize:     '13.5px',
          fontFamily:   '"Inter", sans-serif',
          border:       '1px solid',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
        standardSuccess: { backgroundColor: 'rgba(236,253,243,0.90)', borderColor: '#ABEFC6', color: '#027A48' },
        standardError:   { backgroundColor: 'rgba(254,243,242,0.90)', borderColor: '#FECDCA', color: '#B42318' },
        standardWarning: { backgroundColor: 'rgba(255,250,235,0.90)', borderColor: '#FEDF89', color: '#B54708' },
        standardInfo:    { backgroundColor: 'rgba(237,241,252,0.90)', borderColor: 'rgba(58,86,168,0.22)', color: brand.deep },
      },
    },

    // ── LinearProgress — brand gradient ───────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          backgroundColor: 'rgba(58,86,168,0.12)',
        },
        bar: {
          borderRadius: '4px',
          background:   brand.gradient,
        },
      },
    },

    // ── Switch ─────────────────────────────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        root:   { padding: '6px' },
        thumb:  { width: '16px', height: '16px', boxShadow: '0 1px 3px rgba(26,36,64,0.12)' },
        track:  { borderRadius: '10px', opacity: 1, backgroundColor: '#C8D0E0' },
        colorPrimary: {
          '&.Mui-checked + .MuiSwitch-track': {
            background: brand.gradient,
            opacity:    1,
          },
        },
      },
    },

    // ── Divider ────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(58,86,168,0.10)' },
      },
    },

    // ── Skeleton ───────────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(58,86,168,0.08)', borderRadius: '6px' },
      },
    },

    // ── Avatar ─────────────────────────────────────────────────────────────────
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontFamily:  '"Inter", sans-serif',
          fontWeight:  600,
          background:  brand.gradient,
          color:       '#FFFFFF',
        },
        colorDefault: { background: brand.gradient },
      },
    },

    // ── Badge ──────────────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: '10px', fontWeight: 600,
          minWidth: '18px', height: '18px', borderRadius: '9px',
        },
      },
    },

    // ── Accordion ──────────────────────────────────────────────────────────────
    MuiAccordion: {
      styleOverrides: {
        root: {
          background:   'rgba(255,255,255,0.76)',
          backdropFilter: 'blur(12px)',
          border:       '1px solid rgba(255,255,255,0.62)',
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
          fontFamily: '"Inter", sans-serif',
          color:      '#1A2440',
          minHeight:  '44px !important',
          '&.Mui-expanded': { minHeight: '44px' },
        },
        content: { '&.Mui-expanded': { margin: '12px 0' } },
      },
    },

    // ── ListItemButton — Apple press state ───────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          cursor:       'pointer',
          transition:   'background-color 0.15s ease, transform 0.12s ease',
          '&:active':   { transform: 'scale(0.98)' },
          '&.Mui-focusVisible': {
            outline:       `2px solid ${brand.sky}`,
            outlineOffset: '-2px',
          },
        },
      },
    },

  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DARK THEME
// ─────────────────────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  palette: { ...darkColors, mode: 'dark' },
  typography,
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(160deg, #0B0F1C 0%, #0D1525 50%, #0B1320 100%)',
          backgroundAttachment: 'fixed',
          WebkitFontSmoothing: 'antialiased',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:          'rgba(13,18,36,0.85)',
          backdropFilter:      'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          borderBottom:        '1px solid rgba(40,168,226,0.10)',
          boxShadow:           'none',
          color:               '#E8EEFF',
          '&::after': {
            content:  '""',
            position: 'absolute',
            bottom:   0, left: 0, right: 0,
            height:   '2px',
            background: brand.gradient,
            opacity:  0.6,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background:   'rgba(19,25,41,0.85)',
          backdropFilter: 'blur(16px)',
          border:       '1px solid rgba(40,168,226,0.10)',
          borderRadius: '12px',
          boxShadow:    'none',
          '&:hover':    { boxShadow: '0 4px 24px rgba(40,120,200,0.20)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: 'rgba(19,25,41,0.90)' },
        elevation0: { boxShadow: 'none', background: '#131929' },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.30)', background: 'rgba(19,25,41,0.88)' },
        elevation2: { boxShadow: '0 2px 8px rgba(0,0,0,0.35)', background: 'rgba(22,29,48,0.90)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: '8px', fontFamily: '"Inter", sans-serif' },
        containedPrimary: {
          background: brand.gradient,
          boxShadow: `0 2px 12px rgba(40,120,200,0.30)`,
          '&:hover': { background: brand.gradientHover, boxShadow: brand.shadowHover },
        },
        outlined: { borderColor: 'rgba(255,255,255,0.18)', color: '#C8D4E8', background: 'rgba(255,255,255,0.06)', '&:hover': { background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.30)' } },
        text:     { color: '#C8D4E8', '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' } },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: '12px', border: '1px solid rgba(40,168,226,0.10)',
          boxShadow: 'none', background: 'rgba(19,25,41,0.80)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
            color: '#7B90BE', backgroundColor: 'rgba(40,168,226,0.05)',
            borderBottom: '1px solid rgba(40,168,226,0.12)', padding: '10px 16px',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 'none' },
          '&:hover': { backgroundColor: 'rgba(40,120,200,0.06)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '13.5px', color: '#B8C8E8',
          padding: '12px 16px', borderBottom: '1px solid rgba(40,168,226,0.06)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: brand.gradient, height: '2px', borderRadius: '2px 2px 0 0' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 500, fontSize: '13.5px',
          fontFamily: '"Inter", sans-serif', color: '#7B90BE',
          '&.Mui-selected': { color: brand.sky },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '12px', borderRadius: '6px', fontFamily: '"Inter", sans-serif' },
        colorPrimary:  { background: 'rgba(58,86,168,0.18)', color: '#8AAAF0', border: '1px solid rgba(58,86,168,0.30)' },
        colorSecondary:{ background: 'rgba(40,168,226,0.15)', color: '#7AD3F0', border: '1px solid rgba(40,168,226,0.25)' },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: 'rgba(40,168,226,0.12)' } },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontFamily: '"Inter", sans-serif', fontWeight: 600, background: brand.gradient },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: 'rgba(19,25,41,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(40,168,226,0.12)',
          borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.40)', padding: '4px',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: '4px', backgroundColor: 'rgba(40,120,200,0.15)' },
        bar:  { borderRadius: '4px', background: brand.gradient },
      },
    },
  },
});

// ── Financial theme extension ───────────────────────────────────────────────
export const financialTheme = {
  ...lightTheme,
  financial: {
    colors: bankingColors,
    typography: {
      currency:   { fontFamily: '"JetBrains Mono","Fira Code",monospace', fontWeight: 600, fontSize: '1.05rem', textAlign: 'right' as const },
      percentage: { fontFamily: '"JetBrains Mono","Fira Code",monospace', fontWeight: 500, fontSize: '1rem',    textAlign: 'right' as const },
      ratio:      { fontFamily: '"JetBrains Mono","Fira Code",monospace', fontWeight: 400, fontSize: '0.875rem',textAlign: 'right' as const },
    },
    spacing: { cardPadding: '20px', sectionSpacing: '24px', tableSpacing: '16px' },
  },
};

export const theme = lightTheme;
export default lightTheme;
