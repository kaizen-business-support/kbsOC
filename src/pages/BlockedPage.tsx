/**
 * BlockedPage.tsx
 *
 * Page publique /blocked affichée quand l'utilisateur tente d'accéder
 * à l'application depuis une IP bloquée. AUCUN appel API n'est effectué
 * depuis cette page (éviterait une boucle si l'IP reste bloquée).
 *
 * L'IP est lue depuis sessionStorage (posée par l'axios interceptor au
 * moment du 403).
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

export function BlockedPage() {
  const [blockedIp, setBlockedIp] = useState<string>('');

  useEffect(() => {
    try {
      const ip = sessionStorage.getItem('blockedIp');
      if (ip) setBlockedIp(ip);
    } catch { /* sessionStorage indisponible : on affiche un placeholder */ }
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F8FAFC',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 560,
          width: '100%',
          textAlign: 'center',
          p: { xs: 4, md: 6 },
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
        }}
      >
        <ShieldOutlinedIcon sx={{ fontSize: 64, color: '#9F1239', mb: 2 }} />
        <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#0F172A', mb: 1 }}>
          Accès refusé
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#475569', mb: 3, lineHeight: 1.6 }}>
          Votre adresse IP est bloquée pour des raisons de sécurité.
          L'application n'est pas accessible depuis cette adresse.
        </Typography>

        <Box
          sx={{
            display: 'inline-block',
            bgcolor: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: 1.5,
            px: 2,
            py: 1,
            mb: 3,
          }}
        >
          <Typography sx={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Adresse IP
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
            {blockedIp || '—'}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
          Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur
          en communiquant l'adresse IP ci-dessus.
        </Typography>

        <Typography sx={{ mt: 4, fontSize: 11, color: '#94A3B8' }}>
          OptimusCredit · Sécurité
        </Typography>
      </Paper>
    </Box>
  );
}
