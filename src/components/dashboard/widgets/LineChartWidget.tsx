import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from 'recharts';
import { WidgetDataResult } from '../../../types';

interface LineChartWidgetProps {
  data: WidgetDataResult;
  title: string;
  height?: number;
  color?: string;
}

function formatYAxis(value: number): string {
  return value.toLocaleString('fr-FR');
}

const STATUS_FR: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
  PENDING: 'En attente',
};
const tr = (v: string) => STATUS_FR[v] ?? v;

export const LineChartWidget: React.FC<LineChartWidgetProps> = ({ data, title, height = 220, color = '#1565c0' }) => {
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
        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={tr} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10 }} width={80} />
          <Tooltip
            labelFormatter={tr}
            formatter={(v: any) => [Number(v).toLocaleString('fr-FR'), title]}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 1000, outline: 'none' }}
            contentStyle={{ borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={<Dot r={4} fill={color} stroke="#fff" strokeWidth={2} />}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
