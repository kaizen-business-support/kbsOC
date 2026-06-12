import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { AutoAwesome as AiIcon } from '@mui/icons-material';
import { WidgetDataResult } from '../../../types';
import { ApiService } from '../../../services/api';

const LS_PREFIX = 'wa_';
const LS_TTL_MS = 60 * 60 * 1000; // 1 heure

function lsGet(key: string): string | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL_MS) { localStorage.removeItem(LS_PREFIX + key); return null; }
    return text as string;
  } catch { return null; }
}

function lsSet(key: string, text: string): void {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ text, ts: Date.now() })); } catch { /* quota */ }
}

interface WidgetInsightProps {
  widgetId: string;
  type: string;
  title: string;
  data: WidgetDataResult;
  config: Record<string, any>;
  period: string;
}

export const WidgetInsight: React.FC<WidgetInsightProps> = ({ widgetId, type, title, data, config, period }) => {
  const cacheKey = `${widgetId}_${type}_${period}`;

  const [analysis, setAnalysis] = useState<string | null>(() => lsGet(cacheKey));
  const [loading, setLoading]   = useState(() => !lsGet(cacheKey));
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    const cached = lsGet(cacheKey);
    if (cached) { setAnalysis(cached); setLoading(false); return; }
    if (fetchedRef.current === cacheKey) return;

    fetchedRef.current = cacheKey;
    setLoading(true);

    ApiService.getWidgetAnalysis({ widgetType: type, title, data, config, period })
      .then(res => {
        if (res.success && res.data?.analysis) {
          lsSet(cacheKey, res.data.analysis);
          setAnalysis(res.data.analysis);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (!loading && !analysis) return null;

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 0.75,
      px: 1.5,
      py: 0.75,
      bgcolor: 'rgba(99,102,241,0.04)',
      borderTop: '1px solid rgba(99,102,241,0.12)',
      flexShrink: 0,
      height: 60,
      overflow: 'hidden',
    }}>
      {loading ? (
        <>
          <CircularProgress size={10} sx={{ mt: 0.3, color: '#6366f1', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.67rem', color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.5 }}>
            Analyse en cours…
          </Typography>
        </>
      ) : (
        <>
          <AiIcon sx={{ fontSize: 11, color: '#6366f1', mt: '2px', flexShrink: 0 }} />
          <Typography sx={{
            fontSize: '0.67rem',
            lineHeight: 1.55,
            color: '#374151',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {analysis}
          </Typography>
        </>
      )}
    </Box>
  );
};
