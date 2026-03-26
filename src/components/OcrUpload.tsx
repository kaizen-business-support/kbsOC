import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, Grid, LinearProgress,
  Accordion, AccordionSummary, AccordionDetails,
  TextField, IconButton, Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Refresh as RetryIcon,
  ExpandMore as ExpandMoreIcon,
  AccountBalance as BilanIcon,
  Assessment as CrIcon,
  Timeline as TftIcon,
  Edit as EditIcon,
  Check as ConfirmIcon,
  Close as CancelIcon,
  DocumentScanner as ScanIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { ocrService } from '../services/ocrService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OcrUploadProps {
  onDataExtracted: (data: any, year?: number) => void;
  onDocumentUploaded?: (document: any) => void;
  targetYear?: number;
}

interface ScanLog {
  id: number;
  time: string;
  msg: string;
  type: 'info' | 'success' | 'warn' | 'page' | 'found' | 'extract' | 'done' | 'error';
}

interface DetectedStatement {
  type: string;
  page: number;
  confidence: number;
}

type Phase = 'idle' | 'scanning' | 'done' | 'review' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATEMENT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bilan: { label: 'Bilan', icon: <BilanIcon sx={{ fontSize: 14 }} />, color: '#1565c0' },
  compte_resultat: { label: 'Compte de Résultat', icon: <CrIcon sx={{ fontSize: 14 }} />, color: '#2e7d32' },
  tableau_flux: { label: 'Tableau des Flux', icon: <TftIcon sx={{ fontSize: 14 }} />, color: '#6a1b9a' },
};

const LOG_COLORS: Record<ScanLog['type'], string> = {
  info: '#94a3b8',
  success: '#4ade80',
  warn: '#facc15',
  page: '#64748b',
  found: '#22d3ee',
  extract: '#a78bfa',
  done: '#34d399',
  error: '#f87171',
};

const LOG_PREFIXES: Record<ScanLog['type'], string> = {
  info: '>',
  success: '✓',
  warn: '⚠',
  page: '·',
  found: '◉',
  extract: '◈',
  done: '★',
  error: '✗',
};

const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ─── Main component ───────────────────────────────────────────────────────────
export const OcrUpload: React.FC<OcrUploadProps> = ({ onDataExtracted, onDocumentUploaded, targetYear }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [scanningPage, setScanningPage] = useState<{ current: number; total: number } | null>(null);
  const [statements, setStatements] = useState<DetectedStatement[]>([]);
  const [fieldsFound, setFieldsFound] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [confidence, setConfidence] = useState(0);
  const [reviewData, setReviewData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const logId = useRef(0);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const pushLog = useCallback((msg: string, type: ScanLog['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-120), { id: logId.current++, time: fmt(new Date()), msg, type }]);
  }, []);

  // ── Process file ─────────────────────────────────────────────────────────────
  const processFile = useCallback(async (f: File) => {
    setPhase('scanning');
    setLogs([]);
    setProgress(0);
    setStatements([]);
    setFieldsFound(0);
    setScanningPage(null);
    setError(null);
    logId.current = 0;

    pushLog(`Fichier : ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} Mo)`, 'info');

    try {
      await ocrService.initializeOcr();
      pushLog('Moteur Tesseract OCR initialisé', 'success');

      const financialData = await ocrService.extractFinancialData(f, {
        language: 'fra',
        onProgress: (step, detail, pct, extra) => {
          setProgress(pct ?? 0);

          if (step === 'page' && extra) {
            setScanningPage({ current: extra.page, total: extra.totalPages });
            if (extra.page % 3 === 0 || extra.page === 1) {
              pushLog(detail, 'page');
            }
          } else if (step === 'found' && extra) {
            setStatements(prev => {
              const without = prev.filter(s => s.type !== extra.type);
              return [...without, { type: extra.type, page: extra.page, confidence: extra.confidence }];
            });
            pushLog(detail, 'found');
          } else if (step === 'extract') {
            pushLog(detail, 'extract');
          } else if (step === 'field' && extra) {
            setFieldsFound(prev => prev + (extra.count ?? 0));
            pushLog(detail, 'success');
          } else if (step === 'done' && extra) {
            setFieldsFound(extra.fieldCount ?? 0);
            setConfidence(extra.confidence ?? 0);
            pushLog(detail, 'done');
          } else if (step === 'warn') {
            pushLog(detail, 'warn');
          } else if (step === 'error') {
            pushLog(detail, 'error');
          } else {
            pushLog(detail, 'info');
          }
        },
      });

      const optimusData = ocrService.convertToOptimusFormat(financialData);
      const conf = (financialData.confidence ?? 0) as number;
      setResult(optimusData);
      setConfidence(conf);
      setFieldsFound(Object.keys(optimusData).length);
      setPhase('done');

      if (onDocumentUploaded) {
        onDocumentUploaded({
          id: `doc-${Date.now()}`, name: f.name, type: f.type,
          size: f.size, category: 'financial',
          uploadDate: new Date(), status: 'pending', file: f,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      pushLog(`ERREUR : ${msg}`, 'error');
      setError(msg);
      setPhase('error');
    } finally {
      await ocrService.cleanup();
    }
  }, [onDocumentUploaded, pushLog]);

  // ── Drop zone ─────────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Seuls les PDF sont acceptés.'); return; }
    setFile(f);
    setError(null);
    await processFile(f);
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: false, maxSize: 15 * 1024 * 1024,
  });

  const handleUseData = () => {
    if (result) onDataExtracted(result, targetYear);
  };

  const handleReview = () => {
    setReviewData(result ?? {});
    setPhase('review');
  };

  const handleConfirmReview = () => {
    onDataExtracted(reviewData, targetYear);
  };

  const handleRetry = () => {
    if (file) processFile(file);
    else setPhase('idle');
  };

  const updateField = (k: string, v: string) => {
    setReviewData((p: any) => ({ ...p, [k]: v === '' ? 0 : parseFloat(v.replace(/\s/g, '')) || 0 }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // IDLE
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'idle' || (phase === 'error' && !file)) {
    return (
      <Box>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? '#1565c0' : 'rgba(0,0,0,0.15)',
            borderRadius: 3, p: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            cursor: 'pointer', transition: 'all 0.2s',
            bgcolor: isDragActive ? '#e3f2fd' : '#fafafa',
            '&:hover': { borderColor: '#1565c0', bgcolor: '#f0f7ff' },
          }}
        >
          <input {...getInputProps()} />
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%',
            bgcolor: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ScanIcon sx={{ fontSize: 32, color: '#1565c0' }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
              {isDragActive ? 'Déposer le fichier ici…' : 'Glisser-déposer un PDF ou cliquer pour sélectionner'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              États financiers SYSCOHADA / BCEAO — PDF jusqu'à 15 Mo
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<UploadIcon />} sx={{ borderRadius: 3, fontWeight: 600 }}>
            Choisir un fichier PDF
          </Button>
        </Box>
        {error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fecaca' }}>
            <Typography variant="body2" color="error">{error}</Typography>
          </Box>
        )}
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCANNING — cinematic terminal
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'scanning') {
    const STEPS = [
      { key: 'init', label: 'Init' },
      { key: 'scan', label: 'Lecture' },
      { key: 'detect', label: 'Détection' },
      { key: 'extract', label: 'Extraction' },
      { key: 'done', label: 'Terminé' },
    ];
    const currentStepIdx = progress < 12 ? 0 : progress < 52 ? 1 : progress < 60 ? 2 : progress < 95 ? 3 : 4;

    return (
      <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <Box sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          px: 3, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => (
              <Box key={c} sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />
            ))}
          </Box>
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8', ml: 1 }}>
            kbs-ocr — {file?.name}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: '#22d3ee',
              animation: 'pulse 1s ease-in-out infinite',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#22d3ee' }}>
              SCANNING
            </Typography>
          </Box>
        </Box>

        {/* Main body */}
        <Box sx={{ bgcolor: '#0d1117', display: 'flex', gap: 0, minHeight: 340 }}>
          {/* Left: document visual */}
          <Box sx={{
            width: 200, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', p: 3, gap: 2,
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            {/* Page representation with scan line */}
            <Box sx={{
              width: 120, height: 156, bgcolor: '#1e293b',
              borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Page lines decoration */}
              {[20, 35, 50, 65, 80, 95, 110, 125, 140].map(top => (
                <Box key={top} sx={{
                  position: 'absolute', left: 10, right: 10, top,
                  height: 2, borderRadius: 1,
                  bgcolor: 'rgba(148,163,184,0.15)',
                }} />
              ))}
              {/* Sweeping scan line */}
              <Box sx={{
                position: 'absolute', left: 0, right: 0, height: 3,
                background: 'linear-gradient(90deg, transparent, #22d3ee, #22d3ee, transparent)',
                boxShadow: '0 0 12px 3px rgba(34,211,238,0.5)',
                animation: 'scanline 1.8s linear infinite',
                '@keyframes scanline': {
                  '0%': { top: '-4px' },
                  '100%': { top: '160px' },
                },
              }} />
              {/* Highlighted rows as found */}
              {statements.map((s, i) => (
                <Box key={i} sx={{
                  position: 'absolute', left: 4, right: 4,
                  top: 20 + (s.page % 5) * 26, height: 14, borderRadius: 1,
                  bgcolor: s.type === 'bilan' ? 'rgba(21,101,192,0.3)'
                    : s.type === 'compte_resultat' ? 'rgba(46,125,50,0.3)'
                    : 'rgba(106,27,154,0.3)',
                  border: '1px solid',
                  borderColor: s.type === 'bilan' ? '#1565c0'
                    : s.type === 'compte_resultat' ? '#2e7d32' : '#6a1b9a',
                }} />
              ))}
            </Box>

            {/* Page counter */}
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569', textAlign: 'center' }}>
              {scanningPage
                ? `Page ${scanningPage.current} / ${scanningPage.total}`
                : 'Initialisation…'}
            </Typography>

            {/* Detected badges */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
              {Object.entries(STATEMENT_LABELS).map(([type, meta]) => {
                const found = statements.find(s => s.type === type);
                return (
                  <Box key={type} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1, py: 0.5, borderRadius: 1,
                    bgcolor: found ? `${meta.color}22` : 'rgba(255,255,255,0.03)',
                    border: '1px solid',
                    borderColor: found ? meta.color : 'rgba(255,255,255,0.06)',
                    transition: 'all 0.3s',
                  }}>
                    <Box sx={{ color: found ? meta.color : '#475569', display: 'flex' }}>{meta.icon}</Box>
                    <Typography sx={{
                      fontFamily: 'monospace', fontSize: '0.65rem',
                      color: found ? meta.color : '#475569',
                      fontWeight: found ? 700 : 400,
                    }}>
                      {meta.label}
                    </Typography>
                    {found && (
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: meta.color, ml: 'auto' }}>
                        {found.confidence.toFixed(0)}%
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Right: scrolling terminal log */}
          <Box
            ref={logRef}
            sx={{
              flex: 1, overflowY: 'auto', px: 2.5, py: 2,
              fontFamily: 'monospace', fontSize: '0.75rem',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: 2 },
            }}
          >
            {logs.map(log => (
              <Box key={log.id} sx={{
                display: 'flex', gap: 1.5, mb: 0.5,
                animation: 'fadeIn 0.2s ease',
                '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateX(-4px)' }, to: { opacity: 1, transform: 'none' } },
              }}>
                <Typography component="span" sx={{ color: '#334155', flexShrink: 0, fontSize: '0.7rem' }}>
                  {log.time}
                </Typography>
                <Typography component="span" sx={{ color: LOG_COLORS[log.type], flexShrink: 0 }}>
                  {LOG_PREFIXES[log.type]}
                </Typography>
                <Typography component="span" sx={{ color: LOG_COLORS[log.type] }}>
                  {log.msg}
                </Typography>
              </Box>
            ))}
            {/* Blinking cursor */}
            <Box sx={{
              display: 'inline-block', width: 8, height: 14, bgcolor: '#22d3ee',
              animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }} />
          </Box>
        </Box>

        {/* Progress bar + stats */}
        <Box sx={{
          bgcolor: '#0d1117', px: 3, pb: 2, pt: 1,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569' }}>
              {fieldsFound > 0 ? `${fieldsFound} champs extraits` : 'Analyse en cours…'}
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#22d3ee', fontWeight: 700 }}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4, borderRadius: 2,
              bgcolor: '#1e293b',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #1565c0, #22d3ee)',
                borderRadius: 2,
              },
            }}
          />
        </Box>

        {/* Step pills */}
        <Box sx={{
          bgcolor: '#111827', px: 3, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap',
        }}>
          {STEPS.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  px: 1.5, py: 0.5, borderRadius: 5,
                  bgcolor: active ? '#1565c020' : done ? '#22d3ee20' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? '#22d3ee' : done ? '#22d3ee80' : '#1e293b',
                  display: 'flex', alignItems: 'center', gap: 0.5,
                }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    bgcolor: active ? '#22d3ee' : done ? '#22d3ee' : '#334155',
                    animation: active ? 'pulse 1s ease-in-out infinite' : 'none',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                  <Typography sx={{
                    fontFamily: 'monospace', fontSize: '0.65rem',
                    color: active ? '#22d3ee' : done ? '#94a3b8' : '#334155',
                    fontWeight: active ? 700 : 400,
                  }}>
                    {s.label}
                  </Typography>
                </Box>
                {i < STEPS.length - 1 && (
                  <Box sx={{ width: 16, height: 1, bgcolor: done ? '#22d3ee40' : '#1e293b' }} />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <Box sx={{ p: 3, bgcolor: '#fff1f2', borderRadius: 3, border: '1px solid #fecdd3' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#9f1239', mb: 1 }}>
          Erreur lors de l'extraction OCR
        </Typography>
        <Typography variant="body2" sx={{ color: '#be123c', mb: 2, fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {error}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<RetryIcon />} onClick={handleRetry} sx={{ borderRadius: 3 }}>
            Réessayer
          </Button>
          <Button variant="text" size="small" onClick={() => { setPhase('idle'); setFile(null); }} sx={{ borderRadius: 3 }}>
            Choisir un autre fichier
          </Button>
        </Box>
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DONE — results
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const confColor = confidence >= 75 ? '#2e7d32' : confidence >= 50 ? '#e65100' : '#c62828';
    const confBg = confidence >= 75 ? '#e8f5e9' : confidence >= 50 ? '#fff3e0' : '#ffebee';
    return (
      <Box>
        {/* Result header card */}
        <Box sx={{
          p: 3, mb: 2, borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
        }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: '#22d3ee20', border: '2px solid #22d3ee',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckIcon sx={{ fontSize: 28, color: '#22d3ee' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, color: 'white', mb: 0.5 }}>
              Extraction terminée
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              {file?.name} — {fieldsFound} champs extraits
            </Typography>
          </Box>
          <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: confBg }}>
            <Typography sx={{ fontWeight: 700, color: confColor, fontSize: '1.1rem' }}>
              {confidence.toFixed(0)}%
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: confColor }}>Confiance</Typography>
          </Box>
        </Box>

        {/* Detected statements */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {statements.map(s => {
            const meta = STATEMENT_LABELS[s.type];
            if (!meta) return null;
            return (
              <Chip
                key={s.type}
                icon={meta.icon as any}
                label={`${meta.label} — p.${s.page} (${s.confidence.toFixed(0)}%)`}
                size="small"
                sx={{
                  bgcolor: `${meta.color}15`, color: meta.color,
                  border: `1px solid ${meta.color}40`, fontWeight: 600, fontSize: '0.75rem',
                }}
              />
            );
          })}
          {statements.length === 0 && (
            <Chip label="Aucun état détecté" color="warning" size="small" />
          )}
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleUseData}
            disabled={fieldsFound === 0}
            sx={{
              borderRadius: 3, fontWeight: 700, px: 3,
              background: 'linear-gradient(135deg, #1565c0, #1976d2)',
            }}
          >
            Utiliser ces données
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleReview}
            disabled={fieldsFound === 0}
            sx={{ borderRadius: 3 }}
          >
            Réviser avant validation
          </Button>
          <Button variant="text" startIcon={<RetryIcon />} onClick={handleRetry} sx={{ borderRadius: 3 }}>
            Réanalyser
          </Button>
        </Box>

        {/* Field preview */}
        {fieldsFound > 0 && (
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid rgba(0,0,0,0.06)' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
              Aperçu des champs extraits
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {Object.entries(result ?? {}).slice(0, 18).map(([k, v]) => (
                <Chip
                  key={k}
                  label={`${k.replace(/_/g, ' ')}: ${new Intl.NumberFormat('fr-FR').format(v as number)}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}
                />
              ))}
              {Object.keys(result ?? {}).length > 18 && (
                <Chip label={`+${Object.keys(result ?? {}).length - 18} autres`} size="small" />
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REVIEW — editable accordions
  // ─────────────────────────────────────────────────────────────────────────────
  const fv = (k: string) => reviewData[k] ?? 0;
  const sum = (keys: string[]) => keys.reduce((acc, k) => acc + (fv(k) || 0), 0);
  const fmt2 = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const BilanField = ({ label, field }: { label: string; field: string }) => (
    <Grid item xs={12} sm={6}>
      <TextField
        fullWidth size="small" label={label} type="number"
        value={fv(field)}
        onChange={e => updateField(field, e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
      />
    </Grid>
  );

  return (
    <Box>
      {/* Review header */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: 3, bgcolor: '#fffbeb',
        border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <EditIcon sx={{ color: '#d97706' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e' }}>
            Mode révision — vérifiez et corrigez les valeurs avant validation
          </Typography>
        </Box>
        <Button
          variant="contained" size="small" startIcon={<ConfirmIcon />}
          onClick={handleConfirmReview}
          sx={{ borderRadius: 3, bgcolor: '#2e7d32', fontWeight: 700 }}
        >
          Valider
        </Button>
        <Tooltip title="Annuler la révision">
          <IconButton size="small" onClick={() => setPhase('done')}><CancelIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {/* BILAN */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BilanIcon sx={{ color: '#1565c0' }} />
            <Typography sx={{ fontWeight: 700, color: '#1565c0' }}>
              BILAN ACTIF — Total : {fmt2(sum(['total_actif_immobilise', 'total_actif_circulant', 'tresorerie_actif']))}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <BilanField label="Immobilisations incorporelles" field="immobilisations_incorporelles" />
            <BilanField label="Immobilisations corporelles" field="immobilisations_corporelles" />
            <BilanField label="Immobilisations financières" field="immobilisations_financieres" />
            <BilanField label="Total Actif Immobilisé" field="total_actif_immobilise" />
            <BilanField label="Stocks et encours" field="stocks" />
            <BilanField label="Créances clients" field="creances_clients" />
            <BilanField label="Clients" field="clients" />
            <BilanField label="Autres créances" field="autres_creances" />
            <BilanField label="Total Actif Circulant" field="total_actif_circulant" />
            <BilanField label="Trésorerie Actif" field="tresorerie_actif" />
            <BilanField label="Banques / Caisses" field="banques_caisses" />
            <BilanField label="TOTAL ACTIF" field="total_actif" />
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BilanIcon sx={{ color: '#1565c0' }} />
            <Typography sx={{ fontWeight: 700, color: '#1565c0' }}>
              BILAN PASSIF — Total : {fmt2(sum(['capitaux_propres', 'emprunts_dettes_financieres', 'total_passif']))}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <BilanField label="Capital social" field="capital_social" />
            <BilanField label="Réserves indisponibles" field="reserves_indisponibles" />
            <BilanField label="Réserves libres" field="reserves_libres" />
            <BilanField label="Report à nouveau" field="report_nouveau" />
            <BilanField label="Résultat exercice" field="resultat_exercice" />
            <BilanField label="Total Capitaux Propres" field="capitaux_propres" />
            <BilanField label="Emprunts & dettes financières" field="emprunts_dettes_financieres" />
            <BilanField label="Fournisseurs" field="fournisseurs" />
            <BilanField label="Dettes fiscales" field="dettes_fiscales" />
            <BilanField label="Trésorerie Passif" field="tresorerie_passif" />
            <BilanField label="TOTAL PASSIF" field="total_passif" />
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CrIcon sx={{ color: '#2e7d32' }} />
            <Typography sx={{ fontWeight: 700, color: '#2e7d32' }}>Compte de Résultat</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <BilanField label="Chiffre d'affaires" field="chiffre_affaires" />
            <BilanField label="Marge brute marchandises" field="marge_brute_marchandises" />
            <BilanField label="Valeur ajoutée" field="valeur_ajoutee" />
            <BilanField label="Excédent brut d'exploitation" field="excedent_brut_exploitation" />
            <BilanField label="Résultat d'exploitation" field="resultat_exploitation" />
            <BilanField label="Résultat financier" field="resultat_financier" />
            <BilanField label="Résultat net" field="resultat_net" />
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TftIcon sx={{ color: '#6a1b9a' }} />
            <Typography sx={{ fontWeight: 700, color: '#6a1b9a' }}>Tableau des Flux de Trésorerie</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <BilanField label="Flux activités opérationnelles" field="flux_activites_operationnelles" />
            <BilanField label="Flux activités d'investissement" field="flux_activites_investissement" />
            <BilanField label="Flux activités de financement" field="flux_activites_financement" />
            <BilanField label="Variation trésorerie nette" field="variation_tresorerie_nette" />
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="text" onClick={() => setPhase('done')} sx={{ borderRadius: 3 }}>Annuler</Button>
        <Button
          variant="contained" startIcon={<ConfirmIcon />}
          onClick={handleConfirmReview}
          sx={{ borderRadius: 3, fontWeight: 700, background: 'linear-gradient(135deg, #2e7d32, #388e3c)' }}
        >
          Valider et utiliser ces données
        </Button>
      </Box>
    </Box>
  );
};

export default OcrUpload;
