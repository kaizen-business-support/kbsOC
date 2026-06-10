import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { WidgetDataResult } from '../../../types';

interface TrendChartWidgetProps {
  data: WidgetDataResult;
  title: string;
  height?: number;
  regressionType?: 'linear' | 'logarithmic';
  forecastMonths?: number;
  color?: string;
}

function linReg(xs: number[], ys: number[]) {
  const n = xs.length;
  const sumX  = xs.reduce((a, b) => a + b, 0);
  const sumY  = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };
  return {
    m: (n * sumXY - sumX * sumY) / denom,
    b: ((sumY - ((n * sumXY - sumX * sumY) / denom) * sumX) / n),
  };
}

function formatYAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function futurMonthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export const TrendChartWidget: React.FC<TrendChartWidgetProps> = ({
  data, title, height = 220, regressionType = 'linear', forecastMonths = 3, color = '#1565c0',
}) => {
  const series = data.series ?? [];

  if (series.length < 2) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Données insuffisantes (min. 2 points)</Typography>
      </Box>
    );
  }

  const n  = series.length;
  const ys = series.map(s => s.value);

  let predict: (i: number) => number;
  if (regressionType === 'logarithmic') {
    const xs = series.map((_, i) => Math.log(i + 1));
    const { m: a, b } = linReg(xs, ys);
    predict = (i: number) => Math.max(0, a * Math.log(i + 1) + b);
  } else {
    const xs = series.map((_, i) => i);
    const { m, b } = linReg(xs, ys);
    predict = (i: number) => Math.max(0, m * i + b);
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;

  // Build the merged data array
  const chartData: Array<{ name: string; actual?: number; trend?: number; forecast?: number }> = series.map((s, i) => ({
    name: s.name,
    actual: s.value,
    trend: round1(predict(i)),
  }));

  const fm = forecastMonths ?? 3;

  // Overlap: last actual point also anchors the forecast line
  if (fm > 0) {
    chartData[n - 1].forecast = chartData[n - 1].trend;
    for (let f = 1; f <= fm; f++) {
      chartData.push({
        name: futurMonthLabel(f),
        forecast: round1(predict(n - 1 + f)),
      });
    }
  }

  const label = regressionType === 'logarithmic' ? 'Logarithmique' : 'Linéaire';

  return (
    <Box sx={{ height }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Chip
          label={`Régression ${label}`}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#e3f2fd', color, fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
        />
        {fm > 0 && (
          <Chip
            label={`Prévision ${fm} mois`}
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
          />
        )}
      </Box>
      <Box sx={{ height: height - 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(v: any, key: string) => {
                const lbl = key === 'actual' ? 'Réel' : key === 'trend' ? 'Tendance' : 'Prévision';
                return [Number(v).toLocaleString('fr-FR'), lbl];
              }}
              isAnimationActive={false}
              wrapperStyle={{ zIndex: 1000, outline: 'none' }}
              contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0' }}
            />
            {/* Données réelles — ligne fine semi-transparente */}
            <Line
              dataKey="actual"
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={1.5}
              dot={{ r: 3, fill: color, fillOpacity: 0.4, stroke: 'none' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            {/* Droite/courbe de régression — ligne épaisse continue */}
            <Line
              dataKey="trend"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
            />
            {/* Prévision — ligne pointillée orange */}
            <Line
              dataKey="forecast"
              stroke="#e65100"
              strokeWidth={2}
              strokeDasharray="7 4"
              dot={{ r: 4, fill: '#e65100', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};
