/**
 * DossierActionDrawer — panneau latéral de traitement d'un dossier.
 *
 * Remplace l'ancien ApprovalActionDialog par une interface complète :
 *   - ANALYSIS  → formulaire de scoring + validation
 *   - APPROVAL / COMMITTEE → résumé du dossier + décision OTP
 *   - DISPATCH  → lien vers la page de dispatching
 *   - LEGAL     → lien vers la page juridique
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, Chip, Button,
  TextField, Alert, CircularProgress, Stack, Paper, Tooltip,
  Tab, Tabs, Dialog, DialogTitle, DialogContent, DialogActions,
  FormGroup, FormControlLabel, Checkbox,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  HelpOutline as InfoIcon,
  SwapHoriz as TransferIcon,
  Gavel as LegalIcon,
  Send as DispatchIcon,
  CheckCircle as DoneStepIcon,
  HourglassBottom as InReviewStepIcon,
  RadioButtonUnchecked as PendingStepIcon,
  ErrorOutline as RejectedStepIcon,
  OpenInNew as OpenIcon,
  AssignmentLate as RequestInfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ApprovalItem } from '../types';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { OtpVerificationDialog } from './OtpVerificationDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(v);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'En attente',
  IN_REVIEW: 'En cours',
  COMPLETED: 'Terminée',
  APPROVED:  'Approuvée',
  REJECTED:  'Rejetée',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  PENDING:   'default',
  IN_REVIEW: 'info',
  COMPLETED: 'success',
  APPROVED:  'success',
  REJECTED:  'error',
};

function StepIcon({ status }: { status: string }) {
  const props = { sx: { fontSize: 18 } };
  if (status === 'COMPLETED' || status === 'APPROVED')
    return <DoneStepIcon    {...props} color="success" />;
  if (status === 'IN_REVIEW')
    return <InReviewStepIcon {...props} color="info"   />;
  if (status === 'REJECTED')
    return <RejectedStepIcon {...props} color="error"  />;
  return     <PendingStepIcon {...props} color="disabled" />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  item: ApprovalItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (itemId: string, decision?: string, comment?: string) => void;
}

type OtpAction = 'approve' | 'reject' | 'save_analysis';

const ACTION_CFG = {
  approve:      { label: 'Approuver',         color: 'success' as const, decision: 'APPROVED'     as const },
  reject:       { label: 'Rejeter',            color: 'error'   as const, decision: 'REJECTED'     as const },
  request_info: { label: 'Demander des infos', color: 'warning' as const, decision: 'REQUEST_INFO' as const },
  transfer:     { label: 'Transférer',         color: 'info'    as const, decision: 'TRANSFER'     as const },
};
type ActionKey = keyof typeof ACTION_CFG;
const ALL_ACTIONS: ActionKey[] = ['approve', 'reject', 'request_info', 'transfer'];

// ─── Component ────────────────────────────────────────────────────────────────

export const DossierActionDrawer: React.FC<Props> = ({
  item, open, onClose, onSuccess,
}) => {
  const { state: userState } = useUser();
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [app, setApp]       = useState<any>(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [appError, setAppError]     = useState('');
  const [tab, setTab]               = useState(0);

  // ── Analysis form ───────────────────────────────────────────────────────────
  const [analystScore,    setAnalystScore]    = useState<string>('');
  const [financialScore,  setFinancialScore]  = useState<string>('');
  const [overallAnalysis, setOverallAnalysis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const overallScore = analystScore && financialScore
    ? Math.round((Number(analystScore) + Number(financialScore)) / 2)
    : null;

  // ── Decision state ──────────────────────────────────────────────────────────
  const [comment,     setComment]    = useState('');
  const [submitting,  setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionOk,    setActionOk]   = useState('');
  const [otp, setOtp]               = useState<{ open: boolean; action: OtpAction | null }>({
    open: false, action: null,
  });

  // ── Demande d'infos modal ───────────────────────────────────────────────────
  const INFO_ITEMS = [
    "Pièce d'identité du dirigeant",
    "Statuts de la société / RCCM",
    "Bilan comptable (3 derniers exercices)",
    "Relevés bancaires (6 derniers mois)",
    "Plan d'affaires / Business plan",
    "Justificatif d'activité",
    "Documents de garantie / Sûretés",
    "Attestation fiscale (NINEA / quitus)",
    "Liasse fiscale",
    "Devis / Factures pro-forma",
  ];
  const [showInfoDialog,   setShowInfoDialog]   = useState(false);
  const [infoChecked,      setInfoChecked]      = useState<string[]>([]);
  const [infoFreeText,     setInfoFreeText]     = useState('');

  // ── Load full application ────────────────────────────────────────────────────
  const loadApp = useCallback(async () => {
    if (!item?.applicationId) return;
    setLoadingApp(true);
    setAppError('');
    const res = await ApiService.getApplicationById(item.applicationId);
    if (res.success) {
      setApp(res.data);
      // Pré-remplir les scores existants si l'étape est ANALYSIS
      const pa = res.data?.analysisResults?.preliminaryAnalysis;
      if (pa) {
        if (pa.analystScore   != null) setAnalystScore(String(pa.analystScore));
        if (pa.financialScore != null) setFinancialScore(String(pa.financialScore));
        if (pa.overallAnalysis)        setOverallAnalysis(pa.overallAnalysis);
        if (pa.recommendations)        setRecommendations(pa.recommendations);
      }
    } else {
      setAppError(res.error || 'Erreur chargement dossier');
    }
    setLoadingApp(false);
  }, [item?.applicationId]);

  useEffect(() => {
    if (open) {
      setTab(0);
      setComment('');
      setActionError('');
      setActionOk('');
      setAnalystScore('');
      setFinancialScore('');
      setOverallAnalysis('');
      setRecommendations('');
      loadApp();
    }
  }, [open, loadApp]);

  if (!item) return null;

  const userPermissions: string[] = Array.isArray(userState.currentUser?.permissions)
    ? (userState.currentUser!.permissions as string[])
    : [];
  const canAccessDispatchPage = userPermissions.includes('dispatch_applications')
    || userState.currentUser?.role === 'ADMIN'
    || userState.currentUser?.role === 'SUPER_ADMIN';

  const isAnalysis = item.stepType === 'ANALYSIS';
  const isLegal    = item.stepType === 'LEGAL';
  // DISPATCH uniquement si l'utilisateur peut accéder à la page dispatching
  // Sinon, l'étape DISPATCH est traitée comme une étape classique (approve/transfer)
  const isDispatch = item.stepType === 'DISPATCH' && canAccessDispatchPage;

  const visibleActions: ActionKey[] = item.allowedActions.length === 0
    ? ALL_ACTIONS
    : ALL_ACTIONS.filter(a => item.allowedActions.includes(a));

  // ── Submit decision (non-ANALYSIS) ──────────────────────────────────────────
  const submitDecision = async (action: ActionKey, overrideComment?: string) => {
    if (!userState.currentUser) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await ApiService.approveWorkflow(item.applicationId, {
        userId:   userState.currentUser.id,
        decision: ACTION_CFG[action].decision,
        comments: overrideComment ?? (comment.trim() || undefined),
        stepId:   item.id,
        stepName: item.stepName,
      });
      if (!res.success) throw new Error(res.error || 'Erreur');
      setActionOk(`${ACTION_CFG[action].label} — décision enregistrée`);
      setTimeout(() => { onSuccess(item.id, ACTION_CFG[action].label, overrideComment ?? comment.trim()); onClose(); }, 1500);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit analysis (ANALYSIS step) ─────────────────────────────────────────
  const submitAnalysis = async () => {
    if (!userState.currentUser) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await ApiService.updateApplication(item.applicationId, {
        analystScore:    Number(analystScore),
        financialScore:  Number(financialScore),
        overallScore:    overallScore ?? 0,
        overallAnalysis: overallAnalysis.trim(),
        recommendations: recommendations.trim(),
        status:          'UNDER_REVIEW',
        analysisResults: {
          preliminaryAnalysis: {
            analystScore:    Number(analystScore),
            financialScore:  Number(financialScore),
            overallScore:    overallScore ?? 0,
            overallAnalysis: overallAnalysis.trim(),
            recommendations: recommendations.trim(),
          }
        }
      });
      if (!res.success) throw new Error(res.error || 'Erreur sauvegarde');
      // Compléter l'étape workflow pour qu'elle quitte la liste pending
      const stepRes = await ApiService.approveWorkflow(item.applicationId, {
        userId:   userState.currentUser!.id,
        decision: 'APPROVED',
        comments: `Analyse validée — score global : ${overallScore ?? 0}`,
        stepId:   item.id,
        stepName: item.stepName,
      });
      if (!stepRes.success) throw new Error(stepRes.error || 'Erreur finalisation étape');
      setActionOk('Analyse validée — étape complétée');
      setTimeout(() => { onSuccess(item.id, 'Analyse validée', overallAnalysis.trim()); onClose(); }, 1500);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmer la demande d'infos ────────────────────────────────────────────
  const handleConfirmRequestInfo = async () => {
    const parts: string[] = [];
    if (infoChecked.length > 0) parts.push('Documents manquants : ' + infoChecked.join(', '));
    if (infoFreeText.trim()) parts.push(infoFreeText.trim());
    const builtComment = parts.join('\n') || 'Informations complémentaires demandées';
    setShowInfoDialog(false);
    setComment(builtComment);
    await submitDecision('request_info', builtComment);
    // onSuccess est appelé dans submitDecision avec label "Demander des infos"
  };

  // ── OTP handler ─────────────────────────────────────────────────────────────
  const handleOtpVerified = async () => {
    const action = otp.action;
    setOtp({ open: false, action: null });
    if (action === 'save_analysis') {
      await submitAnalysis();
    } else if (action) {
      await submitDecision(action as ActionKey);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const InfoCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} mt={0.25}>{value ?? '—'}</Typography>
    </Box>
  );

  const steps: any[] = [...(app?.workflowSteps ?? [])].sort((a, b) => {
    const orderA = a.policyStep?.order ?? 0;
    const orderB = b.policyStep?.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const creditType   = app?.creditType?.name ?? item.creditType ?? '—';
  const creator      = app?.creator?.name ?? '—';

  // ─── Rendu principal ─────────────────────────────────────────────────────────
  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 860 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* ── En-tête ── */}
        <Box sx={{
          display: 'flex', alignItems: 'flex-start', gap: 2, px: 3, pt: 2.5, pb: 2,
          borderBottom: '1px solid #e5e7eb',
          bgcolor: '#fafafa',
          flexShrink: 0,
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                {item.applicationNumber}
              </Typography>
              <Chip
                label={item.stepLabel}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: 11 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {item.clientName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ mt: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Tabs ── */}
        <Box sx={{ borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="Dossier" sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            {isAnalysis && (
              <Tab label="Analyse" sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            )}
            <Tab label="Historique" sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
          </Tabs>
        </Box>

        {/* ── Corps scrollable ── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {loadingApp ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : appError ? (
            <Alert severity="error">{appError}</Alert>
          ) : (
            <>
              {/* ── Tab 0 : Dossier ── */}
              {tab === 0 && (
                <Stack spacing={3}>
                  {/* Infos clés */}
                  <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
                      <InfoCell label="Montant" value={
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {fmt(item.amount, item.currency)}
                        </Typography>
                      } />
                      <InfoCell label="Type de crédit"    value={creditType} />
                      <InfoCell label="Durée"             value={app?.durationMonths ? `${app.durationMonths} mois` : null} />
                      <InfoCell label="Taux proposé"      value={app?.proposedRate ? `${app.proposedRate}%` : null} />
                      <InfoCell label="Agence"            value={item.branch} />
                      <InfoCell label="Chargé d'affaires" value={creator} />
                      <InfoCell label="Soumis le"         value={fmtDate(app?.submittedAt)} />
                      {app?.collateralType && (
                        <InfoCell label="Garantie" value={`${app.collateralType}${app.collateralValue ? ` — ${fmt(app.collateralValue, item.currency)}` : ''}`} />
                      )}
                    </Box>
                  </Paper>

                  {/* Objet */}
                  {item.purpose && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Objet du financement
                      </Typography>
                      <Typography variant="body2" mt={0.5} sx={{ lineHeight: 1.6 }}>
                        {item.purpose}
                      </Typography>
                    </Box>
                  )}

                  {/* Scores existants (étapes non-ANALYSIS) */}
                  {!isAnalysis && app?.analysisResults?.preliminaryAnalysis && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, bgcolor: '#f8faff' }}>
                      <Typography variant="body2" fontWeight={700} mb={1.5} color="primary.main">
                        Résultats d'analyse
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 1.5 }}>
                        {[
                          { label: 'Score analyste',   val: app.analysisResults.preliminaryAnalysis.analystScore },
                          { label: 'Score financier',  val: app.analysisResults.preliminaryAnalysis.financialScore },
                          { label: 'Score global',     val: app.analysisResults.preliminaryAnalysis.overallScore },
                        ].map(({ label, val }) => (
                          <Box key={label} sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography variant="h5" fontWeight={800} color={
                              val >= 70 ? 'success.main' : val >= 50 ? 'warning.main' : 'error.main'
                            }>{val ?? '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">/100</Typography>
                          </Box>
                        ))}
                      </Box>
                      {app.analysisResults.preliminaryAnalysis.overallAnalysis && (
                        <Box mb={1}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>Analyse</Typography>
                          <Typography variant="body2" mt={0.25}>{app.analysisResults.preliminaryAnalysis.overallAnalysis}</Typography>
                        </Box>
                      )}
                      {app.analysisResults.preliminaryAnalysis.recommendations && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>Recommandations</Typography>
                          <Typography variant="body2" mt={0.25}>{app.analysisResults.preliminaryAnalysis.recommendations}</Typography>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Stack>
              )}

              {/* ── Tab "Analyse" (ANALYSIS step uniquement) ── */}
              {isAnalysis && tab === 1 && (
                <Stack spacing={2.5}>
                  <Typography variant="body2" color="text.secondary">
                    Renseignez vos scores d'analyse. La décision sera validée par OTP.
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="Score analyste (0-100)"
                      type="number"
                      size="small"
                      value={analystScore}
                      onChange={e => setAnalystScore(e.target.value)}
                      inputProps={{ min: 0, max: 100 }}
                      fullWidth
                    />
                    <TextField
                      label="Score financier (0-100)"
                      type="number"
                      size="small"
                      value={financialScore}
                      onChange={e => setFinancialScore(e.target.value)}
                      inputProps={{ min: 0, max: 100 }}
                      fullWidth
                    />
                  </Box>

                  {overallScore !== null && (
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: '#f8faff' }}>
                      <Typography variant="caption" color="text.secondary">Score global (calculé)</Typography>
                      <Typography variant="h4" fontWeight={800} color={
                        overallScore >= 70 ? 'success.main' : overallScore >= 50 ? 'warning.main' : 'error.main'
                      }>
                        {overallScore}<Typography component="span" variant="body2" color="text.secondary"> / 100</Typography>
                      </Typography>
                    </Paper>
                  )}

                  <TextField
                    label="Analyse globale"
                    multiline minRows={3} maxRows={6}
                    size="small" fullWidth
                    value={overallAnalysis}
                    onChange={e => setOverallAnalysis(e.target.value)}
                    placeholder="Synthèse de l'analyse du dossier..."
                  />

                  <TextField
                    label="Recommandations"
                    multiline minRows={2} maxRows={4}
                    size="small" fullWidth
                    value={recommendations}
                    onChange={e => setRecommendations(e.target.value)}
                    placeholder="Conditions, garanties, montant recommandé..."
                  />
                </Stack>
              )}

              {/* ── Tab Historique ── */}
              {tab === (isAnalysis ? 2 : 1) && (
                <Box>
                  {steps.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">Aucune étape enregistrée.</Typography>
                  ) : steps.map((s: any, i: number) => {
                    const isDone = s.status === 'COMPLETED' || s.status === 'APPROVED';
                    return (
                      <Box key={s.id ?? i} sx={{ display: 'flex', gap: 2 }}>
                        {/* Colonne icône + connecteur */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
                          <StepIcon status={s.status} />
                          {i < steps.length - 1 && (
                            <Box sx={{
                              width: '2px',
                              flex: '1 0 24px',
                              my: 0.5,
                              bgcolor: isDone ? 'success.main' : '#e5e7eb',
                            }} />
                          )}
                        </Box>
                        {/* Contenu de l'étape */}
                        <Box sx={{ pb: 2, flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" fontWeight={600}>
                              {s.policyStep?.stepLabel ?? s.stepName}
                            </Typography>
                            <Chip
                              label={STATUS_LABEL[s.status] ?? s.status}
                              color={STATUS_COLOR[s.status] ?? 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                          {s.assignee && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                              {s.assignee.name}
                            </Typography>
                          )}
                          {(s.completedAt || s.startedAt) && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {fmtDate(s.completedAt ?? s.startedAt)}
                            </Typography>
                          )}
                          {s.comments && (
                            <Typography variant="caption" color="text.secondary" fontStyle="italic" sx={{ display: 'block' }}>
                              "{s.comments}"
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Box>

        {/* ── Pied : commentaire + boutons d'action ── */}
        <Box sx={{
          borderTop: '1px solid #e5e7eb', p: 2.5, flexShrink: 0,
          bgcolor: '#fafafa',
        }}>
          {actionError && <Alert severity="error"   sx={{ mb: 1.5, py: 0.5 }}>{actionError}</Alert>}
          {actionOk   && <Alert severity="success"  sx={{ mb: 1.5, py: 0.5 }}>{actionOk}</Alert>}

          {/* LEGAL : lien vers la page juridique */}
          {isLegal && (
            <Button
              variant="contained"
              startIcon={<LegalIcon />}
              fullWidth
              onClick={() => { onClose(); navigate(`/legal-step/${item.applicationId}`); }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#7e22ce',
                    '&:hover': { bgcolor: '#6b21a8' } }}
            >
              Ouvrir l'étape juridique
            </Button>
          )}

          {/* DISPATCH : lien vers dispatching */}
          {isDispatch && (
            <Button
              variant="contained"
              startIcon={<DispatchIcon />}
              fullWidth
              onClick={() => { onClose(); navigate('/dispatching'); }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Aller au dispatching
            </Button>
          )}

          {/* ANALYSIS : valider l'analyse */}
          {isAnalysis && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={onClose}
                disabled={submitting}
                sx={{ textTransform: 'none', color: '#636366', flexShrink: 0 }}
              >
                Fermer
              </Button>
              <Box sx={{ flex: 1 }} />
              <Tooltip title={!analystScore || !financialScore ? 'Renseignez les deux scores' : ''}>
                <span>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <ApproveIcon />}
                    disabled={submitting || !analystScore || !financialScore}
                    onClick={() => setOtp({ open: true, action: 'save_analysis' })}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
                  >
                    Valider l'analyse
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}

          {/* Autres étapes : décisions classiques */}
          {!isLegal && !isDispatch && !isAnalysis && (
            <>
              <TextField
                label="Commentaire (optionnel)"
                multiline minRows={2} maxRows={3}
                fullWidth size="small"
                value={comment}
                onChange={e => setComment(e.target.value)}
                disabled={submitting}
                sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} disabled={submitting}
                  sx={{ textTransform: 'none', color: '#636366' }}>Fermer</Button>
                <Box sx={{ flex: 1 }} />
                {visibleActions.map(action => {
                  const cfg = ACTION_CFG[action];
                  const needsOtp = action === 'approve' || action === 'reject';
                  const isRequestInfo = action === 'request_info';
                  return (
                    <Button
                      key={action}
                      variant={action === 'approve' ? 'contained' : 'outlined'}
                      color={cfg.color}
                      size="small"
                      startIcon={submitting && !isRequestInfo ? <CircularProgress size={13} /> : undefined}
                      onClick={() => {
                        if (isRequestInfo) {
                          setInfoChecked([]);
                          setInfoFreeText('');
                          setShowInfoDialog(true);
                        } else if (needsOtp) {
                          setOtp({ open: true, action: action as OtpAction });
                        } else {
                          submitDecision(action);
                        }
                      }}
                      disabled={submitting}
                      sx={{
                        borderRadius: '10px', px: 2, fontSize: 13,
                        fontWeight: 600, textTransform: 'none', boxShadow: 'none',
                        '&:hover': { boxShadow: 'none' },
                      }}
                    >
                      {cfg.label}
                    </Button>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* ── Modal Demande d'informations ── */}
      <Dialog
        open={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <RequestInfoIcon color="warning" />
          <Box>
            <Typography fontWeight={700}>Demande d'informations complémentaires</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.clientName} — {item.applicationNumber}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Sélectionnez les documents ou informations manquants. Le demandeur sera notifié.
          </Typography>
          <FormGroup>
            {INFO_ITEMS.map(label => (
              <FormControlLabel
                key={label}
                control={
                  <Checkbox
                    size="small"
                    checked={infoChecked.includes(label)}
                    onChange={() => setInfoChecked(prev =>
                      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
                    )}
                  />
                }
                label={<Typography variant="body2">{label}</Typography>}
                sx={{ mb: 0.25 }}
              />
            ))}
          </FormGroup>
          <TextField
            label="Précisions supplémentaires (optionnel)"
            multiline
            minRows={3}
            maxRows={5}
            fullWidth
            size="small"
            value={infoFreeText}
            onChange={e => setInfoFreeText(e.target.value)}
            placeholder="Décrivez les informations spécifiques attendues..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowInfoDialog(false)}
            disabled={submitting}
            sx={{ textTransform: 'none', color: '#636366' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={submitting || (infoChecked.length === 0 && !infoFreeText.trim())}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <RequestInfoIcon />}
            onClick={handleConfirmRequestInfo}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, boxShadow: 'none' }}
          >
            Envoyer la demande
          </Button>
        </DialogActions>
      </Dialog>

      {/* OTP */}
      <OtpVerificationDialog
        open={otp.open}
        actionLabel={
          otp.action === 'save_analysis' ? "Valider l'analyse" :
          otp.action === 'approve'       ? 'Approuver la demande' :
                                           'Rejeter la demande'
        }
        purpose={
          otp.action === 'save_analysis' ? 'validate_analysis' :
          otp.action === 'approve'       ? 'approve_credit'    :
                                           'reject_credit'
        }
        onClose={() => setOtp({ open: false, action: null })}
        onVerified={handleOtpVerified}
      />
    </>
  );
};

export default DossierActionDrawer;
