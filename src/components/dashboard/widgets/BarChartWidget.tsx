import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { WidgetDataResult } from '../../../types';

interface BarChartWidgetProps {
  data: WidgetDataResult;
  title: string;
  height?: number;
  color?: string;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#2e7d32', DISBURSED: '#1565c0', REJECTED: '#c62828',
  UNDER_REVIEW: '#e65100', SUBMITTED: '#7b1fa2', DRAFT: '#757575', CANCELLED: '#9e9e9e',
};

function formatYAxis(value: number): string {
  return value.toLocaleString('fr-FR');
}

export const BarChartWidget: React.FC<BarChartWidgetProps> = ({ data, title, height = 220, color = '#1565c0' }) => {
  const series = data.series ?? [];

  if (series.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Aucune donnée</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10 }} width={80} />
          <Tooltip
            formatter={(v: any) => [Number(v).toLocaleString('fr-FR'), title]}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 1000, outline: 'none' }}
            contentStyle={{ borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {series.map((entry, i) => (
              <Cell key={i} fill={STATUS_COLORS[entry.name] ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};
