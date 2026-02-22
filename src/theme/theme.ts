import { createTheme } from '@mui/material/styles';

// Banking color palette - professional and trustworthy
const colors = {
  primary: {
    main: '#1f4e79',      // Deep blue - trust and stability
    light: '#4a90e2',     // Light blue - actions
    dark: '#0d47a1',      // Darker blue
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#2c5aa0',      // Medium blue
    light: '#5c7bc8',     // Light secondary
    dark: '#1a365d',      // Dark secondary
    contrastText: '#ffffff',
  },
  success: {
    main: '#27ae60',      // Green - positive indicators
    light: '#4caf50',
    dark: '#1b5e20',
  },
  warning: {
    main: '#f39c12',      // Orange - warnings
    light: '#ff9800',
    dark: '#e65100',
  },
  error: {
    main: '#e74c3c',      // Red - errors/alerts
    light: '#f44336',
    dark: '#c62828',
  },
  info: {
    main: '#3498db',      // Blue - information
    light: '#2196f3',
    dark: '#0277bd',
  },
  background: {
    default: '#f5f6fa',   // Light gray background
    paper: '#ffffff',     // White cards/paper
  },
  text: {
    primary: '#2c3e50',   // Dark text
    secondary: '#7f8c8d', // Gray text
  },
};

// Banking-specific colors for financial data
export const bankingColors = {
  positive: '#27ae60',    // Green for positive trends
  negative: '#e74c3c',    // Red for negative trends
  neutral: '#7f8c8d',     // Gray for neutral/stable
  warning: '#f39c12',     // Orange for warnings
  
  // Risk assessment colors
  lowRisk: '#2ecc71',
  mediumRisk: '#f39c12',
  highRisk: '#e74c3c',
  
  // Performance indicators
  excellent: '#27ae60',
  good: '#2ecc71',
  average: '#f39c12',
  poor: '#e74c3c',
  critical: '#c0392b',
};

// Dark theme colors
const darkColors = {
  primary: {
    main: '#4a90e2',      // Lighter blue for dark theme
    light: '#6bb6ff',     // Light blue - actions
    dark: '#1f4e79',      // Darker blue
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#5c7bc8',      // Lighter medium blue
    light: '#8fa7db',     // Light secondary
    dark: '#2c5aa0',      // Dark secondary
    contrastText: '#ffffff',
  },
  success: {
    main: '#4caf50',      // Green - positive indicators
    light: '#81c784',
    dark: '#27ae60',
  },
  warning: {
    main: '#ff9800',      // Orange - warnings
    light: '#ffb74d',
    dark: '#f39c12',
  },
  error: {
    main: '#f44336',      // Red - errors/alerts
    light: '#e57373',
    dark: '#e74c3c',
  },
  info: {
    main: '#2196f3',      // Blue - information
    light: '#64b5f6',
    dark: '#3498db',
  },
  background: {
    default: '#121212',   // Dark background
    paper: '#1e1e1e',     // Dark cards/paper
  },
  text: {
    primary: '#ffffff',   // Light text
    secondary: '#b0b0b0', // Gray text
  },
};

export const lightTheme = createTheme({
  palette: colors,
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: colors.primary.main,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: colors.primary.main,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      color: colors.primary.main,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      color: colors.primary.main,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: colors.primary.main,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      color: colors.primary.main,
    },
    // Financial data typography
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    // Card styling
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    // Button styling
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    // Table styling for better financial data display
    MuiTable: {
      styleOverrides: {
        root: {
          '& .financial-header': {
            backgroundColor: '#f8f9fa',
            fontWeight: 600,
            textAlign: 'center',
            borderBottom: '2px solid #dee2e6',
          },
          '& .financial-cell': {
            fontFamily: '"Roboto Mono", monospace',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            padding: '12px 16px',
          },
          '& .financial-label': {
            fontWeight: 500,
            textAlign: 'left',
            padding: '12px 16px',
          },
        },
      },
    },
    // Paper styling
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
        },
      },
    },
    // Chip styling for tags and status
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        colorSuccess: {
          backgroundColor: bankingColors.positive,
          color: 'white',
        },
        colorError: {
          backgroundColor: bankingColors.negative,
          color: 'white',
        },
        colorWarning: {
          backgroundColor: bankingColors.warning,
          color: 'white',
        },
      },
    },
  },
});

// Custom theme extensions for financial components
export const darkTheme = createTheme({
  palette: darkColors,
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: darkColors.primary.main,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: darkColors.primary.main,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      color: darkColors.primary.main,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      color: darkColors.primary.main,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: darkColors.primary.main,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      color: darkColors.primary.main,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid #333',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          '& .financial-header': {
            backgroundColor: '#2a2a2a',
            fontWeight: 600,
            textAlign: 'center',
            borderBottom: '2px solid #444',
          },
          '& .financial-cell': {
            fontFamily: '"Roboto Mono", monospace',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            padding: '12px 16px',
          },
          '& .financial-label': {
            fontWeight: 500,
            textAlign: 'left',
            padding: '12px 16px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        },
        elevation2: {
          boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        colorSuccess: {
          backgroundColor: bankingColors.positive,
          color: 'white',
        },
        colorError: {
          backgroundColor: bankingColors.negative,
          color: 'white',
        },
        colorWarning: {
          backgroundColor: bankingColors.warning,
          color: 'white',
        },
      },
    },
  },
});

export const financialTheme = {
  ...lightTheme,
  financial: {
    colors: bankingColors,
    typography: {
      currency: {
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: 600,
        fontSize: '1.1rem',
        textAlign: 'right' as const,
      },
      percentage: {
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: 500,
        fontSize: '1rem',
        textAlign: 'right' as const,
      },
      ratio: {
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: 400,
        fontSize: '0.875rem',
        textAlign: 'right' as const,
      },
      tableHeader: {
        fontFamily: '"Roboto", sans-serif',
        fontWeight: 600,
        fontSize: '0.875rem',
        textAlign: 'center' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
      },
    },
    spacing: {
      cardPadding: '24px',
      sectionSpacing: '32px',
      tableSpacing: '16px',
    },
  },
};

// Keep backward compatibility
export const theme = lightTheme;

export default lightTheme;