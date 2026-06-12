import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  TrendingFlat as FlatIcon,
} from '@mui/icons-material';
import { WidgetDataResult } from '../../../types';

interface KpiCardWidgetProps {
  data: WidgetDataResult;
  title: string;
  colorScheme?: 'blue' | 'green' | 'orange' | 'red';
}

const COLOR_MAP = {
  blue:   { bg: '#e3f2fd', color: '#1565c0' },
  green:  { bg: '#e8f5e9', color: '#2e7d32' },
  orange: { bg: '#fff3e0', color: '#e65100' },
  red:    { bg: '#ffebee', color: '#c62828' },
};

function formatValue(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/D';
  return value.toLocaleString('fr-FR');
}

export const KpiCardWidget: React.FC<KpiCardWidgetProps> = ({ data, title, colorScheme = 'blue' }) => {
  const { bg, color } = COLOR_MAP[colorScheme];
  const trend = data.trend;
  const isUp = trend !== undefined && trend > 0;
  const isDown = trend !== undefined && trend < 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', px: 2, py: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="h4" fontWeight={800} color={color} sx={{ mb: 1 }}>
        {formatValue(data.value)}
      </Typography>
      {trend !== undefined && (
        <Chip
          icon={isUp ? <UpIcon sx={{ fontSize: 14 }} /> : isDown ? <DownIcon sx={{ fontSize: 14 }} /> : <FlatIcon sx={{ fontSize: 14 }} />}
          label={`${isUp ? '+' : ''}${trend.toFixed(1)}%`}
          size="small"
          sx={{
            bgcolor: isUp ? '#e8f5e9' : isDown ? '#ffebee' : '#f5f5f5',
            color: isUp ? '#2e7d32' : isDown ? '#c62828' : '#757575',
            fontWeight: 700,
            width: 'fit-content',
            fontSize: '0.7rem',
          }}
        />
      )}
      {data.label && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>{data.label}</Typography>
      )}
    </Box>
  );
};
