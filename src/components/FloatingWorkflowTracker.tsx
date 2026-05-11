import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Fab, Drawer, Typography, IconButton, LinearProgress,
  Tooltip, CircularProgress, Divider, Stack,
  Collapse, Paper,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

interface TimelineStep {
  order: number;
  label: string;
  stepType: string;
  assignedRole: string | null;
  status: 'completed' | 'active' | 'pending';
  assigneeName: string | null;
  completedAt: string | null;
}

interface PipelineDossier {
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  creditType: string | null;
  status: string;
  creatorBranch: string | null;
  currentStepLabel: string;
  progress: number;
  completedSteps: number;
  totalSteps: number;
  timeline: TimelineStep[];
}

function fmtAmount(v: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(v) + ' ' + currency;
}

// ── Step node ─────────────────────────────────────────────────────────────────
const StepNode: React.FC<{ step: TimelineStep; idx: number; isLast: boolean }> = ({ step, idx, isLast }) => {
  const color = step.status === 'completed' ? '#4caf50' : step.status === 'active' ? '#1976d2' : '#e0e0e0';
  const textColor = step.status === 'pending' ? '#bdbdbd' : step.status === 'active' ? '#1976d2' : '#757575';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
        <Tooltip title={`${step.label}${step.assigneeName ? ` — ${step.assigneeName}` : ''}`} placement="top" arrow>
          <Box sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            bgcolor: step.status === 'pending' ? 'transparent' : color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: step.status === 'pending' ? '#bdbdbd' : 'white',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            cursor: 'default',
            border: step.status === 'pending' ? '2px solid #e0e0e0' : 'none',
            ...(step.status === 'active' ? {
              animation: 'stepPulse 1.8s ease-in-out infinite',
              '@keyframes stepPulse': {
                '0%, 100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.45)' },
                '55%': { boxShadow: '0 0 0 7px rgba(25, 118, 210, 0)' },
              },
            } : {}),
          }}>
            {step.status === 'completed' ? '✓' : idx + 1}
          </Box>
        </Tooltip>
        <Typography sx={{
          fontSize: '0.55rem',
          textAlign: 'center',
          mt: 0.4,
          color: textColor,
          fontWeight: step.status === 'active' ? 700 : 400,
          maxWidth: 50,
          lineHeight: 1.15,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {step.label}
        </Typography>
      </Box>
      {/* Connector */}
      {!isLast && (
        <Box sx={{
          width: 18,
          height: 2,
          mt: 1.5,
          flexShrink: 0,
          bgcolor: step.status === 'completed' ? '#4caf50' : '#e0e0e0',
          borderRadius: 1,
          transition: 'background-color 0.3s',
        }} />
      )}
    </Box>
  );
};

// ── Dossier card ──────────────────────────────────────────────────────────────
const DossierCard: React.FC<{
  dossier: PipelineDossier;
  expanded: boolean;
  onToggle: () => void;
}> = ({ dossier, expanded, onToggle }) => {
  return (
    <Paper elevation={0} sx={{
      border: '1px solid',
      borderColor: expanded ? 'primary.light' : 'divider',
      borderRadius: 2,
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      '&:hover': { borderColor: 'primary.light', boxShadow: '0 2px 10px rgba(58,86,168,0.08)' },
    }}>
      {/* Summary row — always visible */}
      <Box
        onClick={onToggle}
        sx={{ px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.8 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {dossier.clientName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {dossier.applicationNumber}
              {dossier.creditType ? ` · ${dossier.creditType}` : ''}
              {dossier.creatorBranch ? ` · ${dossier.creatorBranch}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.72rem' }}>
              {fmtAmount(dossier.amount, dossier.currency)}
            </Typography>
            {expanded
              ? <ExpandLessIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              : <ExpandMoreIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            }
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={dossier.progress}
              sx={{
                height: 5,
                borderRadius: 3,
                bgcolor: 'grey.100',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: dossier.progress >= 100
                    ? 'linear-gradient(90deg, #4caf50, #66bb6a)'
                    : 'linear-gradient(90deg, #3A56A8 0%, #2878C8 100%)',
                },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ fontSize: '0.63rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {dossier.completedSteps}/{dossier.totalSteps}
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ fontSize: '0.67rem', color: 'text.secondary', display: 'block', mt: 0.5 }}>
          En cours : <strong style={{ color: '#1976d2' }}>{dossier.currentStepLabel}</strong>
        </Typography>
      </Box>

      {/* Expanded: full animated timeline */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 1.5, py: 1.5, overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
            {dossier.timeline.map((step, idx) => (
              <StepNode
                key={step.order}
                step={step}
                idx={idx}
                isLast={idx === dossier.timeline.length - 1}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.2, flexWrap: 'wrap' }}>
            {[
              { color: '#4caf50', label: 'Complété' },
              { color: '#1976d2', label: 'En cours' },
              { color: '#e0e0e0', label: 'En attente' },
            ].map(({ color, label }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%', bgcolor: color,
                  border: color === '#e0e0e0' ? '1px solid #bdbdbd' : 'none',
                }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const FloatingWorkflowTracker: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dossiers, setDossiers] = useState<PipelineDossier[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchPipeline = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await ApiService.getActivePipeline();
      if (resp.success && Array.isArray(resp.data)) {
        setDossiers(resp.data as PipelineDossier[]);
      }
    } catch {
      // silently ignore — don't break the app
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + 60-second auto-refresh
  useEffect(() => {
    fetchPipeline();
    intervalRef.current = setInterval(() => fetchPipeline(true), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchPipeline]);

  const handleOpen = () => {
    setOpen(true);
    fetchPipeline();
  };

  const activeCount = dossiers.length;

  return (
    <>
      {/* Floating action button */}
      <Box sx={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1199 }}>
        <Tooltip title="Suivi des dossiers en cours" placement="left" arrow>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <Fab
              color="primary"
              size="medium"
              onClick={handleOpen}
              sx={{
                background: 'linear-gradient(135deg, #3A56A8 0%, #2878C8 100%)',
                boxShadow: '0 4px 18px rgba(58, 86, 168, 0.38)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2c449a 0%, #1d6ab8 100%)',
                  boxShadow: '0 6px 24px rgba(58, 86, 168, 0.55)',
                },
                ...(activeCount > 0 ? {
                  animation: 'fabGlow 3s ease-in-out infinite',
                  '@keyframes fabGlow': {
                    '0%, 100%': { boxShadow: '0 4px 18px rgba(58, 86, 168, 0.38)' },
                    '50%': { boxShadow: '0 6px 28px rgba(58, 86, 168, 0.7)' },
                  },
                } : {}),
              }}
            >
              <TimelineIcon sx={{ fontSize: 22 }} />
            </Fab>

            {/* Goutte d'eau façon Apple */}
            {activeCount > 0 && (
              <Box sx={{
                position: 'absolute',
                top: -6,
                right: -8,
                zIndex: 2,
                minWidth: activeCount > 9 ? 26 : 22,
                height: 22,
                px: activeCount > 9 ? '6px' : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Forme goutte : cercle parfait pour 1 chiffre, pilule pour 2+
                borderRadius: activeCount > 9 ? '11px' : '50%',
                // Dégradé rouge vif Apple
                background: 'linear-gradient(160deg, #ff3b30 0%, #c0392b 100%)',
                boxShadow: '0 2px 8px rgba(192,57,43,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
                border: '2px solid white',
                // Animation légère d'entrée
                animation: 'dropBounce 0.45s cubic-bezier(0.34,1.56,0.64,1)',
                '@keyframes dropBounce': {
                  '0%':   { transform: 'scale(0)', opacity: 0 },
                  '100%': { transform: 'scale(1)', opacity: 1 },
                },
              }}>
                {/* Reflet brillant (style Apple) */}
                <Box sx={{
                  position: 'absolute',
                  top: 2,
                  left: activeCount > 9 ? 4 : 3,
                  right: activeCount > 9 ? 4 : 3,
                  height: '40%',
                  borderRadius: '6px 6px 50% 50%',
                  background: 'rgba(255,255,255,0.35)',
                  pointerEvents: 'none',
                }} />
                <Typography sx={{
                  fontSize: activeCount > 99 ? '0.52rem' : activeCount > 9 ? '0.62rem' : '0.68rem',
                  fontWeight: 800,
                  color: 'white',
                  lineHeight: 1,
                  letterSpacing: '-0.3px',
                  position: 'relative',
                  zIndex: 1,
                  userSelect: 'none',
                }}>
                  {activeCount > 99 ? '99+' : activeCount}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Side drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 430 },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f5f7fb',
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{
          px: 2.5,
          py: 1.8,
          background: 'linear-gradient(135deg, #3A56A8 0%, #2878C8 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TimelineIcon sx={{ fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: '0.95rem' }}>
                Pipeline de crédit
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.82, fontSize: '0.72rem' }}>
                {activeCount} dossier{activeCount !== 1 ? 's' : ''} en cours de traitement
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Actualiser">
              <span>
                <IconButton
                  onClick={() => fetchPipeline()}
                  disabled={loading}
                  size="small"
                  sx={{
                    color: 'white',
                    opacity: loading ? 0.5 : 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  <RefreshIcon
                    fontSize="small"
                    sx={loading ? {
                      animation: 'spinRefresh 0.8s linear infinite',
                      '@keyframes spinRefresh': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    } : {}}
                  />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              onClick={() => setOpen(false)}
              size="small"
              sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Drawer body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
          {loading && dossiers.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                Chargement du pipeline…
              </Typography>
            </Box>
          ) : dossiers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <TimelineIcon sx={{ fontSize: 52, opacity: 0.2, mb: 1.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Aucun dossier en cours
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Tous les dossiers ont été traités ou vous n'avez aucun rôle actif.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.2}>
              {dossiers.map((d) => (
                <DossierCard
                  key={d.applicationId}
                  dossier={d}
                  expanded={expandedId === d.applicationId}
                  onToggle={() =>
                    setExpandedId(expandedId === d.applicationId ? null : d.applicationId)
                  }
                />
              ))}
            </Stack>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{
          px: 2,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'white',
          flexShrink: 0,
        }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
            Mis à jour automatiquement toutes les 60 s · Cliquez sur un dossier pour voir la timeline
          </Typography>
        </Box>
      </Drawer>
    </>
  );
};
