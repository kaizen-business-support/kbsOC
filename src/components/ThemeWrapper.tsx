import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useApp } from '../contexts/AppContext';
import { lightTheme, darkTheme } from '../theme/theme';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children }) => {
  const { state } = useApp();
  
  const currentTheme = state.theme === 'dark' ? darkTheme : lightTheme;
  
  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};