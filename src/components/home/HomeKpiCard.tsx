import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { colors, shadows, radii, transitions, prefersReducedMotion } from './homeTokens';

export type KpiFormat = 'number' | 'currency' | 'percent' | 'duration';

function formatXOF(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mds`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(1)} M`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(1)} K`;
  return value.toLocaleString('fr-FR');
}

function formatDuration(minutes: number): string {
  const days  = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0)  return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case 'currency': return `${formatXOF(value)} XOF`;
    case 'percent':  return `${value}%`;
    case 'duration': return formatDuration(value);
    default:         return value.toLocaleString('fr-FR');
  }
}

interface Props {
  label: string;
  value: number | null;
  format: KpiFormat;
  loading?: boolean;
  trend?: { delta: number; direction: 'up' | 'down' } | null;
  delayMs?: number;
}

export function HomeKpiCard({ label, value, format, loading, trend, delayMs = 0 }: Props) {
  const reduced = prefersReducedMotion();
  const [displayed, setDisplayed] = useState<number>(reduced ? (value ?? 0) : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null) { setDisplayed(0); return; }
    if (reduced) { setDisplayed(value); return; }

    const start    = performance.now() + delayMs;
    const duration = 800;
    const from     = 0;
    const to       = value;
    const ease     = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / duration);
      setDisplayed(from + (to - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, delayMs, reduced]);

  return (
    <Box
      sx={{
        bgcolor: colors.bg.surface,
        border: `1px solid ${colors.border.default}`,
        borderRadius: `${radii.card}px`,
        p: 2.5,
        boxShadow: shadows.card,
        transition: `box-shadow ${transitions.fast}, transform ${transitions.fast}`,
        minHeight: 110,
      }}
    >
      <Typography
        sx={{
          fontSize: 11, fontWeight: 500,
          color: colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          minHeight: 16,
        }}
      >
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={120} height={36} sx={{ mt: 0.5 }} />
      ) : (
        <Typography
          sx={{
            mt: 0.5, fontSize: 26, fontWeight: 700,
            color: colors.text.primary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}
        >
          {value === null ? '—' : formatValue(Math.round(displayed), format)}
        </Typography>
      )}
      {trend && value !== null && (
        <Typography
          sx={{
            mt: 0.5, fontSize: 11.5, fontWeight: 600,
            color: trend.direction === 'up' ? '#0F766E' : '#9F1239',
          }}
        >
          {trend.direction === 'up' ? '▲' : '▼'} {(Math.abs(trend.delta) * 100).toFixed(1)}%
        </Typography>
      )}
    </Box>
  );
}
