import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import { ApplicationTimeline } from '../../types';
import { ApplicationTimelineCard } from './ApplicationTimelineCard';

interface Props {
  applications: ApplicationTimeline[];
  agenceType: 'client' | 'ca';
  agenceValue: string;
}

export const CodirTimelineTab: React.FC<Props> = ({ applications, agenceType, agenceValue }) => {
  const filtered = applications.filter(app => {
    if (agenceValue === 'all') return true;
    const branch = agenceType === 'client' ? app.clientBranch : app.creatorBranch;
    return branch === agenceValue;
  });

  const overdueCount = filtered.filter(a => a.isOverdue).length;

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {filtered.length} dossier{filtered.length !== 1 ? 's' : ''} en attente
        </Typography>
        {overdueCount > 0 && (
          <Chip label={`${overdueCount} en retard`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
        )}
      </Box>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <TimelineIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">Aucun dossier en attente pour ce filtre</Typography>
        </Box>
      ) : (
        filtered.map(app => (
          <ApplicationTimelineCard key={app.applicationId} application={app} />
        ))
      )}
    </Box>
  );
};
