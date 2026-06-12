import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { AutoAwesome as AiIcon } from '@mui/icons-material';
import { WidgetDataResult } from '../../../types';
import { ApiService } from '../../../services/api';

// Session-level cache: cacheKey → analysis text
const aiCache = new Map<string, string>();

interface WidgetInsightProps {
  widgetId: string;
  type: string;
  title: string;
  data: WidgetDataResult;
  config: Record<string, any>;
  period: string;
}

export const WidgetInsight: React.FC<WidgetInsightProps> = ({ widgetId, type, title, data, config, period }) => {
  // Derive a stable cache key from widget id + data snapshot
  const cacheKey = `${widgetId}:${JSON.stringify(data).slice(0, 400)}`;

  const [analysis, setAnalysis] = useState<string | null>(() => aiCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!aiCache.has(cacheKey));
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Already cached or already fetching this exact key → skip
    if (aiCache.has(cacheKey) || fetchedRef.current === cacheKey) return;

    fetchedRef.current = cacheKey;
    setLoading(true);
    setAnalysis(null);

    ApiService.getWidgetAnalysis({ widgetType: type, title, data, config, period })
      .then(res => {
        if (res.success && res.data?.analysis) {
          aiCache.set(cacheKey, res.data.analysis);
          setAnalysis(res.data.analysis);
        }
      })
      .catch(() => { /* silent fail */ })
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
