import React from 'react';
import { Avatar, AvatarGroup, Box, Chip, Tooltip } from '@mui/material';
import { FiberManualRecord as DotIcon } from '@mui/icons-material';
import { CollabUser } from '../../../hooks/useDashboardSocket';

interface PresenceAvatarsProps {
  users: CollabUser[];
  currentUserId: string;
  connected: boolean;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, currentUserId, connected }) => {
  const others = users.filter(u => u.userId !== currentUserId);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={<DotIcon sx={{ fontSize: '0.6rem !important', color: connected ? '#43a047' : '#bbb' }} />}
        label={connected ? `${users.length} connecté${users.length > 1 ? 's' : ''}` : 'Hors ligne'}
        size="small"
        sx={{ height: 22, fontSize: '0.68rem', bgcolor: connected ? '#f1f8e9' : '#f5f5f5', color: '#555', border: '1px solid', borderColor: connected ? '#c5e1a5' : '#e0e0e0' }}
      />
      {others.length > 0 && (
        <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.65rem', border: '2px solid #fff' } }}>
          {others.map(u => (
            <Tooltip key={u.socketId} title={`${u.userName} est en train d'éditer`} arrow>
              <Avatar sx={{ bgcolor: u.color, width: 26, height: 26, fontSize: '0.65rem' }}>
                {initials(u.userName)}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}
    </Box>
  );
};
