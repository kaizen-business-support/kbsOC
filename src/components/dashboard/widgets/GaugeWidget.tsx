import React from 'react';
import { Box, Typography } from '@mui/material';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { WidgetDataResult } from '../../../types';

interface GaugeWidgetProps {
  data: WidgetDataResult;
  title: string;
  threshold?: { warning: number; critical: number };
  maxValue?: number;
  height?: number;
}

function getColor(value: number, threshold: { warning: number; critical: number }, maxValue: number): string {
  const pct = (value / maxValue) * 100;
  if (pct < (threshold.critical / maxValue) * 100) return '#c62828';
  if (pct < (threshold.warning / maxValue) * 100) return '#e65100';
  return '#2e7d32';
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({
  data, title, threshold = { warning: 70, critical: 50 }, maxValue = 100, height = 200,
}) => {
  if (data.value === undefined) {
    return (
      <Box sx={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">{data.label ?? 'N/D'}</Typography>
      </Box>
    );
  }

  const color = getColor(data.value, threshold, maxValue);
  const fillPct = Math.min(100, Math.max(0, (data.value / maxValue) * 100));
  const chartData = [{ value: fillPct, fill: color }];

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height - 40}>
        <RadialBarChart
          cx="50%" cy="70%"
          innerRadius="60%" outerRadius="90%"
          startAngle={180} endAngle={0}
          data={chartData}
        >
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f0f0f0' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Box sx={{ position: 'absolute', bottom: 24, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} color={color}>
          {data.value.toFixed(1)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
      </Box>
    </Box>
  );
};
