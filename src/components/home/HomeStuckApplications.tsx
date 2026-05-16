/**
 * HomeStuckApplications.tsx
 *
 * Liste des dossiers "enlisés" (daysSinceLastAction > 5 OU isOverdue),
 * affichée aux Chargés d'Affaires, Assistants, Responsables Engagements
 * et Responsables Risques.
 *
 * Un seul appel au mount. Bouton refresh manuel discret.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Chip, Skeleton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ApiService } from '../../services/api';
import type { StuckApplication, PageType } from '../../types';
import { colors, radii, shadows } from './homeTokens';

interface HomeStuckApplicationsProps {
  onNavigate: (page: PageType) => void;
}

function formatXOF(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} k`;
  return String(n);
}

export function HomeStuckApplications({ onNavigate }: HomeStuckApplicationsProps) {
  const [items, setItems] = useState<StuckApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await ApiService.getStuckApplications();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        <Box>
          <Typography variant="overline" sx={{ color: colors.text.muted, letterSpacing: 0.6, fontSize: 10 }}>
            Dossiers à risque d'enlisement
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.primary, fontWeight: 600, mt: 0.25 }}>
            {loading ? 'Chargement…' : items.length === 0 ? 'Aucun dossier bloqué' : `${items.length} dossier${items.length > 1 ? 's' : ''} en attente prolongée`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={load} disabled={loading} aria-label="Actualiser">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {loading ? (
        <>
          <Skeleton variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 0.75 }} />
          <Skeleton variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 0.75 }} />
          <Skeleton variant="rectangular" height={36} sx={{ borderRadius: 1 }} />
        </>
      ) : items.length === 0 ? null : (
        <Box>
          {items.map((it) => (
            <Box
              key={it.applicationId}
              onClick={() => onNavigate('workflow')}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                px: 1,
                borderRadius: 1,
                cursor: 'pointer',
                borderBottom: `1px solid ${colors.bg.subtle}`,
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: colors.bg.subtle },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text.primary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.clientName}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.text.muted, fontSize: 11 }}>
                  {it.applicationNumber} · {it.currentStepLabel}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: colors.text.secondary, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>
                {formatXOF(it.amount)} {it.currency}
              </Typography>
              <Chip
                label={`${it.daysSinceLastAction}j`}
                size="small"
                color={it.isOverdue ? 'error' : 'warning'}
                sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
              />
              <Box sx={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                {it.hasNegativeOpinion && (
                  <Tooltip title="Avis défavorable au dossier">
                    <WarningAmberIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                  </Tooltip>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
