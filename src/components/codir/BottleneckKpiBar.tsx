import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import { StepKpi } from '../../types';

interface Props {
  kpis: StepKpi[];
  selectedStep: string | null;
  onSelectStep: (stepName: string | null) => void;
  // v1.0 — filtre transversal sur les avis défavorables en attente
  negativeOpinionCount?: number;
  opinionFilterActive?: boolean;
  onToggleOpinionFilter?: () => void;
}

export const BottleneckKpiBar: React.FC<Props> = ({
  kpis, selectedStep, onSelectStep,
  negativeOpinionCount = 0,
  opinionFilterActive = false,
  onToggleOpinionFilter,
}) => (
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

    {/* v1.0 — KPI transversal : dossiers avec avis défavorable majoritaire en attente */}
    {negativeOpinionCount > 0 && onToggleOpinionFilter && (
      <Card
        onClick={onToggleOpinionFilter}
        sx={{
          minWidth: 180, cursor: 'pointer', flex: '1 1 180px',
          borderLeft: `4px solid ${opinionFilterActive ? '#dc2626' : '#fca5a5'}`,
          boxShadow: opinionFilterActive ? 3 : 1,
          transition: 'box-shadow 0.15s',
          bgcolor: opinionFilterActive ? '#fef2f2' : 'transparent',
          '&:hover': { boxShadow: 3 },
        }}
      >
        <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ThumbDownAltIcon sx={{ fontSize: 14, color: '#dc2626' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
              Avis défavorables
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: '#dc2626' }}>{negativeOpinionCount}</Typography>
            <Typography variant="body2" color="text.secondary">en attente</Typography>
          </Box>
          <Chip
            label={opinionFilterActive ? 'Filtre actif · Cliquer pour annuler' : 'Cliquer pour filtrer'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20, mt: 1 }}
          />
        </CardContent>
      </Card>
    )}
  </Box>
);
