/**
 * HomeOpinionStrip.tsx
 *
 * Bandeau "Sentiment du circuit" affiché aux décideurs (COMITE_CREDIT,
 * DIRECTION_GENERALE, DIR_AG, ADMIN, SUPER_ADMIN).
 *
 * - Barre stacked verte/rouge : répartition favorable / défavorable cumulée
 * - Spark AreaChart sur 7 derniers jours
 *
 * Un seul appel au mount. Bouton refresh manuel discret.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Skeleton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ApiService } from '../../services/api';
import type { OpinionPulse } from '../../types';
import { colors, radii, shadows } from './homeTokens';

const FAVORABLE_COLOR = '#16a34a';
const DEFAVORABLE_COLOR = '#dc2626';

export function HomeOpinionStrip() {
  const [data, setData] = useState<OpinionPulse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await ApiService.getOpinionPulse();
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = (data?.favorable ?? 0) + (data?.defavorable ?? 0);
  const favPct = total > 0 ? Math.round(((data?.favorable ?? 0) / total) * 100) : 0;
  const sparkData = (data?.last7Days ?? []).map(d => ({
    date: d.date.slice(5),
    favorable: d.favorable,
    defavorable: d.defavorable,
  }));

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        bgcolor: colors.bg.surface,
        borderRadius: `${radii.card}px`,
        boxShadow: shadows.card,
        border: `1px solid ${colors.border.default}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="overline" sx={{ color: colors.text.muted, letterSpacing: 0.6, fontSize: 10 }}>
            Sentiment du circuit (7 derniers jours)
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.primary, fontWeight: 600, mt: 0.25 }}>
            {loading
              ? 'Chargement…'
              : total === 0
                ? 'Aucun avis rendu sur la période'
                : `${data!.favorable} favorable${data!.favorable > 1 ? 's' : ''} · ${data!.defavorable} défavorable${data!.defavorable > 1 ? 's' : ''} · ${favPct}% positifs`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={load} disabled={loading} aria-label="Actualiser">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
      ) : total === 0 ? null : (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Barre stacked verte/rouge */}
          <Box sx={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', bgcolor: colors.bg.subtle }}>
            <Box sx={{ width: `${favPct}%`, bgcolor: FAVORABLE_COLOR }} />
            <Box sx={{ width: `${100 - favPct}%`, bgcolor: DEFAVORABLE_COLOR }} />
          </Box>
          {/* Spark area chart 7j */}
          <Box sx={{ width: 220, height: 56 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FAVORABLE_COLOR} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={FAVORABLE_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDef" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={DEFAVORABLE_COLOR} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={DEFAVORABLE_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 11, border: `1px solid ${colors.border.default}` }}
                  formatter={(v: number, name: string) => [v, name === 'favorable' ? 'Favorable' : 'Défavorable']}
                  labelFormatter={(l) => `Jour ${l}`}
                />
                <Area type="monotone" dataKey="favorable"   stroke={FAVORABLE_COLOR}   strokeWidth={1.5} fill="url(#gradFav)" />
                <Area type="monotone" dataKey="defavorable" stroke={DEFAVORABLE_COLOR} strokeWidth={1.5} fill="url(#gradDef)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}
    </Box>
  );
}
