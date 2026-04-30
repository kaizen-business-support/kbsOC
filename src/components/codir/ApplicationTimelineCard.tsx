import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Grow } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ApplicationTimeline, TimelineStep } from '../../types';

// Animation pulse pour l'étape en cours — exported so CodirTimelineTab injects it once
export const pulseKeyframes = `
  @keyframes codir-pulse {
    0%   { transform: scale(1); opacity: 1; }
    50%  { transform: scale(1.18); opacity: 0.75; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

function fmtDuration(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return '< 1h';
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.floor(h / 24);
  const rem  = Math.round(h % 24);
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h`;
}

function fmtAmount(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
}

function StepIcon({ status, isSlaBroken }: { status: TimelineStep['status']; isSlaBroken: boolean }) {
  if (status === 'COMPLETED') return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 22 }} />;
  if (status === 'IN_PROGRESS') return (
    <RadioButtonCheckedIcon
      sx={{
        color: '#5c35b5',
        fontSize: 22,
        animation: 'codir-pulse 1.5s ease-in-out infinite',
        ...(isSlaBroken && { color: '#ef4444' }),
      }}
    />
  );
  return <RadioButtonUncheckedIcon sx={{ color: '#cbd5e1', fontSize: 22 }} />;
}

function Connector({ status }: { status: TimelineStep['status'] }) {
  const isCompleted = status === 'COMPLETED';
  return (
    <Box
      sx={{
        flex: 1,
        height: 2,
        background: isCompleted
          ? '#22c55e'
          : 'repeating-linear-gradient(90deg, #cbd5e1 0 4px, transparent 4px 8px)',
        mt: '10px',
      }}
    />
  );
}

interface Props {
  application: ApplicationTimeline;
}

export const ApplicationTimelineCard: React.FC<Props> = ({ application }) => {
  const { steps, applicationNumber, clientName, clientBranch, amount, currency,
          creatorName, creatorBranch, isOverdue, daysWaiting, isEscalated } = application;

  return (
    <Card
        variant="outlined"
        sx={{
          mb: 2,
          borderLeft: `4px solid ${isOverdue ? '#ef4444' : isEscalated ? '#f97316' : '#e2e8f0'}`,
        }}
      >
        <CardContent sx={{ pb: '12px !important' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" fontWeight={700}>{applicationNumber}</Typography>
                <Typography variant="body2" color="text.secondary">•</Typography>
                <Typography variant="body2" fontWeight={600}>{clientName}</Typography>
                <Typography variant="body2" color="text.secondary">•</Typography>
                <Typography variant="body2">{fmtAmount(amount, currency)}</Typography>
                {isOverdue && <Chip label={`En retard — ${daysWaiting}j`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />}
                {isEscalated && !isOverdue && <Chip label="Escaladé" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Agence client : {clientBranch ?? '—'}
                {' • '}
                CA : {creatorName}{creatorBranch ? ` (${creatorBranch})` : ''}
              </Typography>
            </Box>
          </Box>

          {/* Stepper */}
          <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: steps.length * 140 }}>
              {steps.map((step, idx) => (
                <React.Fragment key={step.stepName}>
                  {/* timeout = durée de l'animation ; transitionDelay = délai avant départ (effet séquentiel) */}
                  <Grow in timeout={300} style={{ transitionDelay: `${idx * 80}ms` }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120, px: 0.5 }}>
                      {/* Icône + connecteur horizontal */}
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {idx > 0 && <Connector status={steps[idx - 1].status} />}
                        <StepIcon status={step.status} isSlaBroken={step.isSlaBroken} />
                        {idx < steps.length - 1 && <Connector status={step.status} />}
                      </Box>

                      {/* Infos étape */}
                      <Box sx={{ textAlign: 'center', mt: 0.75, px: 0.25 }}>
                        <Typography variant="caption" fontWeight={600} display="block" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                          {step.stepLabel}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mt: 0.25 }}>
                          {step.agentName ?? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
                        </Typography>
                        {step.durationHours !== null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, mt: 0.25 }}>
                            {step.isSlaBroken && <WarningAmberIcon sx={{ fontSize: 11, color: '#ef4444' }} />}
                            <Typography
                              variant="caption"
                              sx={{ fontSize: '0.68rem', color: step.isSlaBroken ? '#ef4444' : 'text.secondary', fontWeight: step.isSlaBroken ? 700 : 400 }}
                            >
                              {fmtDuration(step.durationHours)}
                            </Typography>
                          </Box>
                        )}
                        {step.startedAt && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.63rem', color: '#94a3b8', mt: 0.25 }}>
                            {fmtDate(step.startedAt)}
                            {step.completedAt
                              ? ` → ${fmtDate(step.completedAt)}`
                              : step.status === 'IN_PROGRESS' ? ' → en cours' : ''}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grow>
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>
  );
};
