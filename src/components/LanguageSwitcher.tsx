import React from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full';
  color?: 'primary' | 'secondary' | 'inherit';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'compact',
  color = 'inherit'
}) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (event: any) => {
    const newLanguage = event.target.value;
    i18n.changeLanguage(newLanguage);
  };

  const languages = [
    { code: 'fr', label: 'FR Français', flag: '🇫🇷' },
    { code: 'en', label: 'EN English', flag: '🇺🇸' },
  ];

  if (variant === 'compact') {
    return (
      <FormControl 
        size="small" 
        sx={{ 
          minWidth: 80,
          '& .MuiSelect-select': {
            color: color === 'inherit' ? 'inherit' : undefined,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: color === 'inherit' ? 'rgba(255,255,255,0.3)' : undefined,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: color === 'inherit' ? 'rgba(255,255,255,0.5)' : undefined,
          },
        }}
      >
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          variant="outlined"
          displayEmpty
          renderValue={(value) => {
            const lang = languages.find(l => l.code === value);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{lang?.flag}</span>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {lang?.code.toUpperCase()}
                </Typography>
              </Box>
            );
          }}
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{lang.flag}</span>
                <Typography variant="body2">
                  {lang.label}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <LanguageIcon color={color} />
      <FormControl fullWidth>
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          variant="outlined"
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{lang.flag}</span>
                <Typography variant="body2">
                  {lang.label}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};