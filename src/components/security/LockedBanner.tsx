/**
 * LockedBanner.tsx
 *
 * Banner sticky non-dismissible en haut du layout authentifié.
 * Affiché uniquement quand l'utilisateur est verrouillé hors fenêtre
 * temporelle. Inclut un countdown vers la prochaine ouverture, rafraîchi
 * toutes les 30s.
 */

import React, { useContext, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { SecurityLockContext } from '../../contexts/SecurityLockContext';

function formatCountdown(target: Date | null): string {
  if (!target) return 'Aucune réouverture connue dans les 14 prochains jours.';
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 'Réouverture en cours…';
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}min`);
  return `Réouverture dans ${parts.join(' ')}`;
}

function formatTargetDate(target: Date | null): string {
  if (!target) return '';
  return target.toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export function LockedBanner() {
  const { timeLocked, timeLockedMessage, nextOpenAt } = useContext(SecurityLockContext);
  const [, force] = useState(0);

  useEffect(() => {
    if (!timeLocked) return;
    const id = setInterval(() => force(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [timeLocked]);

  if (!timeLocked) return null;

  const targetStr = formatTargetDate(nextOpenAt);
  const countdown = formatCountdown(nextOpenAt);

  return (
    <Box
      role="alert"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1300,
        bgcolor: '#fef3c7',
        borderBottom: '1px solid #fcd34d',
        color: '#92400e',
        px: { xs: 2, md: 4 },
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 20 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }} noWrap>
          {timeLockedMessage ?? 'Accès restreint en dehors des heures autorisées.'}
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }} noWrap>
          {targetStr ? `${countdown} (${targetStr})` : countdown}
        </Typography>
      </Box>
    </Box>
  );
}
