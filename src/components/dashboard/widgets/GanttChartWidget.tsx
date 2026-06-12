import React, { useMemo, useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Cell, ResponsiveContainer,
} from 'recharts';
import { WidgetDataResult } from '../../../types';

interface GanttChartWidgetProps {
  data: WidgetDataResult;
  title: string;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED:     '#2e7d32',
  DISBURSED:    '#1565c0',
  UNDER_REVIEW: '#e65100',
  SUBMITTED:    '#f57f17',
  REJECTED:     '#c62828',
  CANCELLED:    '#757575',
  DRAFT:        '#bdbdbd',
};

const STATUS_FR: Record<string, string> = {
  APPROVED: 'Approuvé', REJECTED: 'Rejeté', UNDER_REVIEW: 'En analyse',
  SUBMITTED: 'Soumis', DISBURSED: 'Décaissé', CANCELLED: 'Annulé', DRAFT: 'Brouillon',
};

const DAY_MS = 86_400_000;

type UnitMode = 'K' | 'M' | 'Mds';

const UNITS: { value: UnitMode; label: string; divisor: number; decimals: number }[] = [
  { value: 'K',   label: 'Milliers (K)',   divisor: 1_000,         decimals: 0 },
  { value: 'M',   label: 'Millions (M)',   divisor: 1_000_000,     decimals: 1 },
  { value: 'Mds', label: 'Milliards (Mds)', divisor: 1_000_000_000, decimals: 2 },
];

function fmtAmount(v: number, unit: UnitMode): string {
  if (!v) return '—';
  const u = UNITS.find(u => u.value === unit)!;
  const n = v / u.divisor;
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: u.decimals, maximumFractionDigits: u.decimals }).format(n)} ${unit}`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const fullFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function makeTooltip(_unit: UnitMode) {
  return function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const r = payload[1]?.payload ?? payload[0]?.payload;
    if (!r) return null;
    const days = Math.max(1, Math.round((r.end - r.start) / DAY_MS));
    return (
      <Box sx={{ bgcolor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 1.5, boxShadow: 3, maxWidth: 240 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{r.label} — {r.client}</Typography>
        {r.creditType && <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.5 }}>{r.creditType}</Typography>}
        <Typography sx={{ fontSize: 11 }}>Statut : <b>{STATUS_FR[r.status] ?? r.status}</b></Typography>
        {r.branch  && <Typography sx={{ fontSize: 11 }}>Agence : {r.branch}</Typography>}
        {r.manager && <Typography sx={{ fontSize: 11 }}>Chargé : {r.manager}</Typography>}
        {r.amount > 0 && (
          <Typography sx={{ fontSize: 11, mt: 0.5 }}>
            Montant : <b>{fullFmt.format(r.amount)} FCFA</b>
          </Typography>
        )}
        <Typography sx={{ fontSize: 11, mt: 0.5 }}>{fmtDate(r.start)} → {fmtDate(r.end)}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.status] ?? '#555' }}>
          {days} jour{days > 1 ? 's' : ''}
        </Typography>
      </Box>
    );
  };
}

export const GanttChartWidget: React.FC<GanttChartWidgetProps> = ({ data, height = 260 }) => {
  const [unit, setUnit] = useState<UnitMode>('M');
  const rows = data.rows ?? [];

  const { chartData, minTs, range } = useMemo(() => {
    if (!rows.length) return { chartData: [], minTs: 0, range: 1 };
    const minTs = Math.min(...(rows as any[]).map(r => r.start));
    const maxTs = Math.max(...(rows as any[]).map(r => r.end));
    const range = Math.max(maxTs - minTs, DAY_MS);
    const u = UNITS.find(u => u.value === unit)!;
    return {
      chartData: (rows as any[]).map(r => {
        const amtLabel = r.amount > 0
          ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: u.decimals, minimumFractionDigits: u.decimals }).format(r.amount / u.divisor) + ' ' + unit
          : '—';
        return {
          ...r,
          _offset:       r.start - minTs,
          _dur:          Math.max(r.end - r.start, Math.round(range * 0.008)),
          _displayLabel: amtLabel,
        };
      }),
      minTs,
      range,
    };
  }, [rows, unit]);

  if (!rows.length) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Aucune donnée</Typography>
      </Box>
    );
  }

  const ROW_H = 22;
  const innerH = chartData.length * ROW_H + 44;
  const Tooltip = makeTooltip(unit);

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Sélecteur d'unité */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 9, color: 'text.secondary', mr: 0.5 }}>Montants :</Typography>
        {UNITS.map(u => (
          <Chip
            key={u.value}
            label={u.value}
            size="small"
            onClick={() => setUnit(u.value)}
            title={u.label}
            sx={{
              fontSize: '0.62rem', height: 18, cursor: 'pointer',
              bgcolor: unit === u.value ? '#1565c0' : 'transparent',
              color:   unit === u.value ? '#fff' : '#555',
              border: '1px solid', borderColor: unit === u.value ? '#1565c0' : '#ccc',
              '&:hover': { bgcolor: unit === u.value ? '#1565c0' : '#f0f0f0' },
            }}
          />
        ))}
      </Box>

      {/* Diagramme */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <ResponsiveContainer width="100%" height={Math.max(innerH, height - 52)}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 12, bottom: 20, left: 4 }}
            barSize={ROW_H - 5}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, range]}
              tickCount={5}
              tickFormatter={v => fmtDate(minTs + v)}
              tick={{ fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="_displayLabel"
              width={96}
              tick={{ fontSize: 8 }}
              axisLine={false}
              tickLine={false}
            />
            <ReTooltip content={<Tooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="_offset" stackId="g" fill="transparent" isAnimationActive={false} legendType="none" />
            <Bar dataKey="_dur"    stackId="g" radius={[2, 2, 2, 2]} isAnimationActive={false}>
              {chartData.map((e: any, i: number) => (
                <Cell key={i} fill={STATUS_COLORS[e.status] ?? '#90a4ae'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Légende statuts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', px: 1, py: 0.5, justifyContent: 'center', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: c, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{STATUS_FR[s]}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
