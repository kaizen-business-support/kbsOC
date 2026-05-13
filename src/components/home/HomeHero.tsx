import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { keyframes } from '@emotion/react';
import { colors, transitions, prefersReducedMotion } from './homeTokens';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

interface HomeHeroProps {
  userName: string;
  tenantName: string;
  branchName?: string | null;
  roleLabel?: string;
}

export function HomeHero({ userName, tenantName, branchName, roleLabel }: HomeHeroProps) {
  const reduced = prefersReducedMotion();
  const animation = reduced ? 'none' : `${fadeInUp} ${transitions.enter} both`;

  const metaParts = [formatToday(), tenantName, branchName].filter(Boolean);

  return (
    <Box
      sx={{
        animation,
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: 3,
        px: { xs: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        flexDirection: { xs: 'column', md: 'row' },
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 28, fontWeight: 700, color: colors.text.primary, lineHeight: 1.2 }}>
          Bonjour, {userName}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 14, color: colors.text.muted, fontWeight: 500, textTransform: 'capitalize' }}>
          {metaParts.join(' · ')}
        </Typography>
      </Box>
      {roleLabel && (
        <Chip
          label={roleLabel}
          size="small"
          sx={{
            bgcolor: colors.accent.muted,
            color: colors.accent.primary,
            fontWeight: 600,
            fontSize: 12,
            border: 'none',
            borderRadius: 999,
            px: 1,
          }}
        />
      )}
    </Box>
  );
}
