import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useAccessibleModules } from '../../hooks/useAccessibleModules';
import { HomeModuleCard } from './HomeModuleCard';
import { colors } from './homeTokens';
import { PageType } from '../../types';

interface Props {
  onNavigate: (page: PageType) => void;
}

export function HomeModuleGrid({ onNavigate }: Props) {
  const groups = useAccessibleModules();

  return (
    <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {groups.map((group, gIdx) => (
        <Box key={group.label}>
          <Typography
            sx={{
              fontSize: 14, fontWeight: 600,
              color: colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              mb: 0.5,
            }}
          >
            {group.label}
          </Typography>
          <Box sx={{ height: 2, width: 32, bgcolor: colors.accent.primary, borderRadius: 1, mb: 2 }} />
          <Grid container spacing={2}>
            {group.modules.map((module, mIdx) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={module.id}>
                <HomeModuleCard
                  module={module}
                  onClick={() => onNavigate(module.id)}
                  delayMs={gIdx * 120 + mIdx * 60 + 480}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
