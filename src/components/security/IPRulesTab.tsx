import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { colors } from '../home/homeTokens';

export function IPRulesTab() {
  return (
    <Box sx={{ mt: 3 }}>
      <Alert
        severity="info"
        icon={<ConstructionOutlinedIcon />}
        sx={{ borderRadius: 2, bgcolor: colors.bg.surface, border: `1px solid ${colors.border.default}` }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Règles IP — bientôt disponible</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.text.secondary }}>
          Filtrage par adresse IP (whitelist / blacklist, IPv4 / IPv6 / CIDR) avec enforcement
          temps-réel via middleware. Disponible dans la prochaine mise à jour.
        </Typography>
      </Alert>
    </Box>
  );
}
