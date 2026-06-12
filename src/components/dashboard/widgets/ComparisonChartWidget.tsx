import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { DonutLarge, BarChart as BarIcon, ShowChart } from '@mui/icons-material';
import { WidgetDataResult } from '../../../types';

interface ComparisonChartWidgetProps {
  data: WidgetDataResult;
  title: string;
  height?: number;
}

const PALETTE = [
  '#1565c0','#2e7d32','#e65100','#c62828','#7b1fa2',
  '#0277bd','#558b2f','#f57f17','#ad1457','#00695c',
];

const STATUS_FR: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
  PENDING: 'En attente',
};
const tr = (v: string) => STATUS_FR[v] ?? v;
const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

type ViewMode = 'donut' | 'bar' | 'line';

const RADIAN = Math.PI / 180;
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export const ComparisonChartWidget: React.FC<ComparisonChartWidgetProps> = ({ data, title, height = 260 }) => {
  const [view, setView] = useState<ViewMode>('donut');
  const series = (data.series ?? []).map(s => ({ ...s, name: tr(s.name) }));

  if (series.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Aucune donnée</Typography>
      </Box>
    );
  }

  const total = series.reduce((s, d) => s + d.value, 0);
  const chartH = height - 36;

  return (
    <Box sx={{ height }}>
      {/* Mode switcher */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mb: 0.5 }}>
        <Tooltip title="Donut"><IconButton size="small" onClick={() => setView('donut')} sx={{ bgcolor: view === 'donut' ? '#e3f2fd' : 'transparent', borderRadius: 1 }}><DonutLarge sx={{ fontSize: 16, color: '#1565c0' }} /></IconButton></Tooltip>
        <Tooltip title="Barres"><IconButton size="small" onClick={() => setView('bar')} sx={{ bgcolor: view === 'bar' ? '#e3f2fd' : 'transparent', borderRadius: 1 }}><BarIcon sx={{ fontSize: 16, color: '#1565c0' }} /></IconButton></Tooltip>
        <Tooltip title="Courbe"><IconButton size="small" onClick={() => setView('line')} sx={{ bgcolor: view === 'line' ? '#e3f2fd' : 'transparent', borderRadius: 1 }}><ShowChart sx={{ fontSize: 16, color: '#1565c0' }} /></IconButton></Tooltip>
      </Box>

      <ResponsiveContainer width="100%" height={chartH}>
        {view === 'donut' ? (
          <PieChart>
            <Pie
              data={series} cx="50%" cy="45%"
              innerRadius="38%" outerRadius="65%"
              dataKey="value" labelLine={false} label={renderLabel}
            >
              {series.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <ReTooltip
              formatter={(v: any, name: string) => [
                `${numFmt.format(Number(v))} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`,
                name,
              ]}
              contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          </PieChart>
        ) : view === 'bar' ? (
          <BarChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => numFmt.format(v)} tick={{ fontSize: 10 }} width={80} />
            <ReTooltip
              formatter={(v: any) => [numFmt.format(Number(v)), title]}
              contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {series.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => numFmt.format(v)} tick={{ fontSize: 10 }} width={80} />
            <ReTooltip
              formatter={(v: any) => [numFmt.format(Number(v)), title]}
              contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
            />
            <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={{ r: 4, fill: PALETTE[0] }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
};
