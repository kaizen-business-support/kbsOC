import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import { StepKpi } from '../../types';

interface Props {
  kpis: StepKpi[];
  selectedStep: string | null;
  onSelectStep: (stepName: string | null) => void;
}

export const BottleneckKpiBar: React.FC<Props> = ({ kpis, selectedStep, onSelectStep }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
    {kpis.map(k => {
      const isSelected = selectedStep === k.stepName;
      const hasOverdue = k.overdueCount > 0;
      return (
        <Card
          key={k.stepName}
          onClick={() => onSelectStep(isSelected ? null : k.stepName)}
          sx={{
            minWidth: 180, cursor: 'pointer', flex: '1 1 180px',
            borderLeft: `4px solid ${hasOverdue ? '#ef4444' : isSelected ? '#5c35b5' : '#e2e8f0'}`,
            boxShadow: isSelected ? 3 : 1,
            transition: 'box-shadow 0.15s',
            '&:hover': { boxShadow: 3 },
          }}
        >
          <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
              {k.stepLabel}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
              <Typography variant="h4" fontWeight={700}>{k.count}</Typography>
              <Typography variant="body2" color="text.secondary">dossier{k.count !== 1 ? 's' : ''}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              {hasOverdue && (
                <Chip label={`${k.overdueCount} en retard`} size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
              )}
              <Chip label={`moy. ${k.avgWaitHours}h`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
            </Box>
          </CardContent>
        </Card>
      );
    })}
  </Box>
);
