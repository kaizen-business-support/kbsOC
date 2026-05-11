import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Drawer, Typography, IconButton, LinearProgress,
  Tooltip, CircularProgress, Divider, Stack, Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingDotIcon,
  Bolt as ActiveIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Design tokens ────────────────────────────────────────────────────────────

const DARK  = '#0D1B2A';
const DARK2 = '#122130';
const TEAL  = '#14B8A6';
const TEAL2 = '#0D9488';
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';

function fmtAmount(v: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(v) + ' ' + currency;
}

// ─── Step node ────────────────────────────────────────────────────────────────

const StepNode: React.FC<{ step: TimelineStep; idx: number; isLast: boolean }> = ({ step, idx, isLast }) => {
  const isCompleted = step.status === 'completed';
  const isActive    = step.status === 'active';

  const dotColor  = isCompleted ? '#10B981' : isActive ? TEAL : '#CBD5E1';
  const lineColor = isCompleted ? '#10B981' : '#E2E8F0';
  const labelColor = isActive ? DARK : isCompleted ? '#374151' : '#94A3B8';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}>
        <Tooltip
          title={`${step.label}${step.assigneeName ? ` — ${step.assigneeName}` : ''}`}
          placement="top"
          arrow
        >
          <Box sx={{
            width: 28, height: 28,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            ...(isCompleted ? {
              bgcolor: '#ECFDF5',
              border: '2px solid #10B981',
            } : isActive ? {
              bgcolor: `${TEAL}18`,
              border: `2px solid ${TEAL}`,
              animation: 'activePulse 2s ease-in-out infinite',
              '@keyframes activePulse': {
                '0%, 100%': { boxShadow: `0 0 0 0 ${TEAL}50` },
                '50%': { boxShadow: `0 0 0 6px ${TEAL}00` },
              },
            } : {
              bgcolor: '#F8FAFC',
              border: '2px solid #E2E8F0',
            }),
          }}>
            {isCompleted
              ? <CheckIcon sx={{ fontSize: 14, color: '#10B981' }} />
              : isActive
                ? <ActiveIcon sx={{ fontSize: 13, color: TEAL }} />
                : <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8' }}>{idx + 1}</Typography>
            }
          </Box>
        </Tooltip>

        <Typography sx={{
          fontSize: '0.57rem', textAlign: 'center', mt: 0.5,
          color: labelColor, fontWeight: isActive ? 700 : 500,
          maxWidth: 52, lineHeight: 1.2,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {step.label}
        </Typography>
      </Box>

      {/* Connector line */}
      {!isLast && (
        <Box sx={{
          width: 20, height: 2, mt: 1.7, flexShrink: 0,
          bgcolor: lineColor, borderRadius: 1,
          transition: 'background-color 0.3s',
        }} />
      )}
    </Box>
  );
};

// ─── Dossier card ─────────────────────────────────────────────────────────────

const DossierCard: React.FC<{
  dossier: PipelineDossier;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}> = ({ dossier, expanded, onToggle, index }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 60);
    return () => clearTimeout(t);
  }, [index]);

  const progressColor = dossier.progress >= 100
    ? 'linear-gradient(90deg, #10B981, #34D399)'
    : `linear-gradient(90deg, ${TEAL}, ${TEAL2})`;

  return (
    <Box sx={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(10px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>
      <Box sx={{
        borderRadius: '14px',
        overflow: 'hidden',
        bgcolor: WHITE,
        border: expanded ? `1.5px solid ${TEAL}50` : '1.5px solid #F1F5F9',
        boxShadow: expanded
          ? `0 4px 20px ${TEAL}14`
          : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.22s ease',
        '&:hover': {
          borderColor: `${TEAL}40`,
          boxShadow: `0 4px 16px ${TEAL}10`,
          transform: 'translateY(-1px)',
        },
      }}>
        {/* Card header */}
        <Box
          onClick={onToggle}
          sx={{ px: 2.5, py: 2, cursor: 'pointer', userSelect: 'none' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.2 }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: 1.5 }}>
              <Typography sx={{
                fontWeight: 700, fontSize: '13px', color: DARK, lineHeight: 1.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {dossier.clientName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'monospace', fontWeight: 600 }}>
                  {dossier.applicationNumber}
                </Typography>
                {dossier.creditType && (
                  <>
                    <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#CBD5E1' }} />
                    <Typography sx={{ fontSize: '10.5px', color: '#94A3B8' }}>
                      {dossier.creditType}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '12px', color: TEAL2, letterSpacing: '-0.2px' }}>
                {fmtAmount(dossier.amount, dossier.currency)}
              </Typography>
              <Box sx={{
                width: 22, height: 22, borderRadius: '6px',
                bgcolor: expanded ? `${TEAL}12` : '#F8FAFC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {expanded
                  ? <ExpandLessIcon sx={{ fontSize: 14, color: TEAL }} />
                  : <ExpandMoreIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
                }
              </Box>
            </Box>
          </Box>

          {/* Progress bar */}
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={dossier.progress}
              sx={{
                height: 6, borderRadius: 4,
                bgcolor: '#F1F5F9',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: progressColor,
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography sx={{ fontSize: '10px', color: '#94A3B8' }}>
                Étape en cours : <Box component="span" sx={{ fontWeight: 700, color: TEAL2 }}>{dossier.currentStepLabel}</Box>
              </Typography>
              <Typography sx={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>
                {dossier.completedSteps}/{dossier.totalSteps}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Expanded timeline */}
        <Collapse in={expanded}>
          <Divider sx={{ borderColor: '#F1F5F9' }} />
          <Box sx={{ px: 2, py: 2, bgcolor: '#FAFBFD', overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', pb: 0.5 }}>
              {dossier.timeline.map((step, idx) => (
                <StepNode
                  key={step.order}
                  step={step}
                  idx={idx}
                  isLast={idx === dossier.timeline.length - 1}
                />
              ))}
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
              {[
                { color: '#10B981', bg: '#ECFDF5', label: 'Complété' },
                { color: TEAL,     bg: `${TEAL}18`, label: 'En cours' },
                { color: '#CBD5E1', bg: '#F8FAFC',  label: 'En attente' },
              ].map(({ color, bg, label }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: bg, border: `1.5px solid ${color}` }} />
                  <Typography sx={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

// ─── FAB button ───────────────────────────────────────────────────────────────

const FABButton: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer pulse ring — visible only when dossiers exist */}
      {count > 0 && (
        <Box sx={{
          position: 'absolute',
          width: 64, height: 64,
          borderRadius: '50%',
          border: `2px solid ${TEAL}`,
          animation: 'radarPulse 2.4s ease-out infinite',
          pointerEvents: 'none',
          '@keyframes radarPulse': {
            '0%':   { transform: 'scale(1)',    opacity: 0.7 },
            '100%': { transform: 'scale(1.65)', opacity: 0 },
          },
        }} />
      )}

      {/* FAB */}
      <Tooltip title="Suivi pipeline de crédit" placement="left" arrow>
        <Box
          onClick={onClick}
          sx={{
            width: 56, height: 56,
            borderRadius: '18px',
            background: `linear-gradient(145deg, ${DARK} 0%, ${DARK2} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: count > 0
              ? `0 8px 28px rgba(13,27,42,0.45), 0 0 0 1px rgba(20,184,166,0.25)`
              : `0 8px 24px rgba(13,27,42,0.35), 0 0 0 1px rgba(255,255,255,0.06)`,
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            '&:hover': {
              transform: 'translateY(-3px) scale(1.04)',
              boxShadow: `0 14px 36px rgba(13,27,42,0.5), 0 0 0 1px ${TEAL}50`,
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
            // Glass highlight
            '&::before': {
              content: '""',
              position: 'absolute', top: 2, left: 2, right: 2,
              height: '45%',
              borderRadius: '16px 16px 40% 40%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)',
              pointerEvents: 'none',
            },
          }}
        >
          <FolderIcon sx={{ fontSize: 24, color: TEAL, filter: `drop-shadow(0 0 6px ${TEAL}80)` }} />
        </Box>
      </Tooltip>

      {/* Badge count */}
      {count > 0 && (
        <Box sx={{
          position: 'absolute',
          top: -10, right: -10,
          zIndex: 2,
          minWidth: count > 9 ? 28 : 24,
          height: 24,
          px: count > 9 ? '6px' : 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: count > 9 ? '12px' : '50%',
          background: `linear-gradient(135deg, ${AMBER} 0%, #D97706 100%)`,
          boxShadow: `0 3px 10px rgba(245,158,11,0.55), 0 0 0 2.5px ${WHITE}`,
          animation: 'badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          '@keyframes badgePop': {
            '0%':   { transform: 'scale(0) rotate(-15deg)', opacity: 0 },
            '100%': { transform: 'scale(1) rotate(0deg)',   opacity: 1 },
          },
        }}>
          {/* Sheen */}
          <Box sx={{
            position: 'absolute', top: 2, left: 3, right: 3,
            height: '42%', borderRadius: '8px 8px 50% 50%',
            background: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
          }} />
          <Typography sx={{
            fontSize: count > 99 ? '9px' : count > 9 ? '10.5px' : '12px',
            fontWeight: 900,
            color: WHITE,
            lineHeight: 1,
            letterSpacing: '-0.5px',
            position: 'relative', zIndex: 1,
            userSelect: 'none',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>
            {count > 99 ? '99+' : count}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const FloatingWorkflowTracker: React.FC = () => {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
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
      // ignore silently
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    intervalRef.current = setInterval(() => fetchPipeline(true), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchPipeline]);

  const handleOpen = () => { setOpen(true); fetchPipeline(); };

  const activeCount = dossiers.length;

  return (
    <>
      {/* FAB */}
      <Box sx={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1199 }}>
        <FABButton count={activeCount} onClick={handleOpen} />
      </Box>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 420 },
            display: 'flex', flexDirection: 'column',
            bgcolor: '#F8FAFC',
            borderLeft: 'none',
          },
        }}
        sx={{ '& .MuiBackdrop-root': { backdropFilter: 'blur(3px)', bgcolor: 'rgba(13,27,42,0.45)' } }}
      >
        {/* ── Drawer header ── */}
        <Box sx={{
          px: 3, pt: 3, pb: 2.5,
          background: `linear-gradient(135deg, ${DARK} 0%, ${DARK2} 100%)`,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          // Subtle mesh
          '&::before': {
            content: '""', position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 90% 10%, ${TEAL}18 0%, transparent 55%)`,
            pointerEvents: 'none',
          },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                bgcolor: `${TEAL}20`, border: `1px solid ${TEAL}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FolderIcon sx={{ fontSize: 20, color: TEAL }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '16px', color: WHITE, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
                  Pipeline de crédit
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%',
                    bgcolor: TEAL, boxShadow: `0 0 6px ${TEAL}`,
                    animation: 'liveDot 2s ease-in-out infinite',
                    '@keyframes liveDot': {
                      '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 },
                    },
                  }} />
                  <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {activeCount} dossier{activeCount !== 1 ? 's' : ''} en traitement
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Actualiser">
                <span>
                  <IconButton
                    onClick={() => fetchPipeline()}
                    disabled={loading}
                    size="small"
                    sx={{
                      color: 'rgba(255,255,255,0.6)', borderRadius: '8px',
                      opacity: loading ? 0.4 : 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: WHITE },
                    }}
                  >
                    <RefreshIcon fontSize="small" sx={loading ? {
                      animation: 'spin 0.8s linear infinite',
                      '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                    } : {}} />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                onClick={() => setOpen(false)}
                size="small"
                sx={{
                  color: 'rgba(255,255,255,0.6)', borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: WHITE },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Global progress strip */}
          {activeCount > 0 && (
            <Box sx={{ mt: 2.5, px: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.7 }}>
                <Typography sx={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Avancement global
                </Typography>
                <Typography sx={{ fontSize: '10.5px', color: TEAL, fontWeight: 700 }}>
                  {Math.round(dossiers.reduce((s, d) => s + d.progress, 0) / activeCount)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.round(dossiers.reduce((s, d) => s + d.progress, 0) / activeCount)}
                sx={{
                  height: 5, borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${TEAL}, #34D399)`,
                  },
                }}
              />
            </Box>
          )}
        </Box>

        {/* ── Drawer body ── */}
        <Box sx={{
          flex: 1, overflowY: 'auto', px: 2, py: 2,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#CBD5E1', borderRadius: 2 },
        }}>
          {loading && dossiers.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
              <CircularProgress size={32} sx={{ color: TEAL }} thickness={3} />
              <Typography sx={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                Chargement du pipeline…
              </Typography>
            </Box>
          ) : dossiers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '20px',
                bgcolor: '#F1F5F9', mx: 'auto', mb: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FolderIcon sx={{ fontSize: 30, color: '#CBD5E1' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#475569', mb: 0.5 }}>
                Aucun dossier en cours
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#94A3B8', maxWidth: 260, mx: 'auto', lineHeight: 1.6 }}>
                Tous les dossiers ont été traités ou aucun rôle actif ne vous est attribué.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {dossiers.map((d, i) => (
                <DossierCard
                  key={d.applicationId}
                  dossier={d}
                  index={i}
                  expanded={expandedId === d.applicationId}
                  onToggle={() => setExpandedId(expandedId === d.applicationId ? null : d.applicationId)}
                />
              ))}
            </Stack>
          )}
        </Box>

        {/* ── Footer ── */}
        <Box sx={{
          px: 3, py: 1.5,
          borderTop: '1px solid #F1F5F9',
          bgcolor: WHITE,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: TEAL }} />
            <Typography sx={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 500 }}>
              Actualisation auto · 60 s
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '10.5px', color: '#CBD5E1' }}>
            Cliquez sur un dossier pour la timeline
          </Typography>
        </Box>
      </Drawer>
    </>
  );
};
