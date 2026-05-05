import React from 'react';
import { Chip, Tooltip, Box, Typography } from '@mui/material';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';

interface DelegationBadgeProps {
  isOnLeave:     boolean;
  delegateName?: string;
  size?:         'small' | 'medium';
}

/**
 * Badge affiché à côté du nom d'un utilisateur en congé.
 * Affiche "EN CONGÉ" et optionnellement le nom du délégué actif.
 */
const DelegationBadge: React.FC<DelegationBadgeProps> = ({
  isOnLeave,
  delegateName,
  size = 'small',
}) => {
  if (!isOnLeave) return null;

  const tooltip = delegateName
    ? `Délégué à : ${delegateName}`
    : 'Cet utilisateur est en congé';

  return (
    <Tooltip title={tooltip} arrow>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
        <Chip
          icon={<BeachAccessIcon sx={{ fontSize: '0.75rem !important' }} />}
          label="EN CONGÉ"
          size={size}
          color="warning"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.62rem', height: 20, cursor: 'default' }}
        />
        {delegateName && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            → {delegateName}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default DelegationBadge;
