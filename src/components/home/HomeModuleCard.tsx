import React from 'react';
import { Box, Typography, ButtonBase } from '@mui/material';
import { colors, shadows, radii, transitions } from './homeTokens';
import { AccessibleModule } from '../../hooks/useAccessibleModules';

interface Props {
  module: AccessibleModule;
  onClick: () => void;
  delayMs?: number;
}

export function HomeModuleCard({ module, onClick, delayMs = 0 }: Props) {
  const Icon = module.icon;
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: `${radii.card}px`,
        p: 2.5,
        display: 'block',
        boxShadow: shadows.card,
        transition: `transform ${transitions.fast}, box-shadow ${transitions.fast}, border-color ${transitions.fast}`,
        opacity: 0,
        animation: `kbsFadeUp 320ms ${delayMs}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        '@keyframes kbsFadeUp': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: shadows.cardHover,
          borderColor: colors.accent.primary,
          '& .home-card-icon': {
            bgcolor: colors.accent.primary,
            color: '#FFFFFF',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
          animation: 'none',
          '&:hover': { transform: 'none' },
        },
      }}
    >
      <Box
        className="home-card-icon"
        sx={{
          width: 40, height: 40, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: colors.accent.muted,
          color: colors.accent.primary,
          transition: `background ${transitions.fast}, color ${transitions.fast}`,
          mb: 1.5,
        }}
      >
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: colors.text.primary }}>
        {module.label}
      </Typography>
      <Typography sx={{ mt: 0.4, fontSize: 13, color: colors.text.secondary, lineHeight: 1.4 }}>
        {module.description}
      </Typography>
    </ButtonBase>
  );
}
