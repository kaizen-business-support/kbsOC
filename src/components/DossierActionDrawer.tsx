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
  Accordion, AccordionSummary, AccordionDetails,
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
  ExpandMore as ExpandMoreIcon,
  Description as DocIcon,
  ChatBubbleOutline as CommentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ApprovalItem, USER_ROLE_LABELS } from '../types';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { OtpVerificationDialog } from './OtpVerificationDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchDocBlob(url: string): Promise<Blob> {
  const token = localStorage.getItem('optimus_access_token');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Impossible d\'accéder au fichier');
  return res.blob();
}

async function previewDocumentWithAuth(url: string) {
  const blob = await fetchDocBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function downloadDocumentWithAuth(url: string, filename: string) {
  const blob = await fetchDocBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}

function flattenOhadaData(data: any): any {
  const is   = data.incomeStatement || {};
  const cf   = data.cashFlow        || {};
  const brut = data.balance?.brut   || {};
  return {
    chiffre_affaires:    is.XB ?? 0,
    valeur_ajoutee:      is.XD ?? 0,
    ebe:                 is.XE ?? 0,
    resultat_exploitation: is.XF ?? 0,
    produits_financiers: (is.SA ?? 0) + (is.SB ?? 0) + (is.SC ?? 0),
    charges_financieres: (is.SD ?? 0) + (is.SE ?? 0),
    resultat_financier:  is.XG ?? 0,
    resultat_net:        is.XJ ?? 0,
    flux_exploitation:   cf.ZC ?? 0,
    variation_tresorerie: cf.ZH ?? 0,
    actif_immobilise:    brut.AO ?? 0,
    actif_circulant:     brut.AZ ?? 0,
    stocks:              (brut.AQ ?? 0) + (brut.AR ?? 0) + (brut.AS ?? 0) + (brut.AT ?? 0),
    creances_clients:    brut.AW ?? 0,
    tresorerie:          brut.BT ?? 0,
    total_actif:         brut.BZ ?? 0,
    capitaux_propres:    brut.CP ?? 0,
    dettes_financieres:  brut.DF ?? 0,
    passif_circulant:    brut.DP ?? 0,
    tresorerie_passif:   brut.DT ?? 0,
  };
}

function resolveFinancialData(entry: any): any | null {
  if (!entry) return null;
  if (entry?.multiyear_data?.N?.data) {
    const inner = entry.multiyear_data.N.data;
    if (inner?.incomeStatement || inner?.balance) return flattenOhadaData(inner);
    return inner;
  }
  if (entry?.incomeStatement || entry?.balance) return flattenOhadaData(entry);
  const hasLegacyFields = ['chiffre_affaires', 'total_actif', 'resultat_net'].some(k => k in entry);
  if (hasLegacyFields) return entry;
  return null;
}

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

  // ── Commentaire d'analyse (synthèse + recommandations) ──────────────────────
  const [mySynthesis,    setMySynthesis]    = useState('');
  const [myReco,         setMyReco]         = useState('');
  const [savingComment,  setSavingComment]  = useState(false);
  const [commentSaveMsg, setCommentSaveMsg] = useState('');

  // ── Annulation dossier ──────────────────────────────────────────────────────
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelOtp,    setCancelOtp]    = useState(false);
  const [cancelReason, setCancelReason] = useState('');

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
      // Pré-remplir la synthèse/recommandations de l'utilisateur courant
      const existingComment = (res.data?.analysisResults?.comments ?? [])
        .find((c: any) => c.userId === userState.currentUser?.id);
      setMySynthesis(existingComment?.synthesis       ?? '');
      setMyReco(     existingComment?.recommendations ?? '');
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
      setMySynthesis('');
      setMyReco('');
      setCommentSaveMsg('');
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
  const isDispatch = item.stepType === 'DISPATCH' && canAccessDispatchPage;

  // ── Droit d'annulation : créateur du dossier ou ADMIN/SUPER_ADMIN ─────────
  const TERMINAL = ['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'];
  const currentUserRole = userState.currentUser?.role ?? '';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole);
  const isCreator = app?.createdBy === userState.currentUser?.id;
  const canCancel = (isAdmin || (currentUserRole === 'CHARGE_AFFAIRES' && isCreator))
    && !TERMINAL.includes(app?.status ?? '');

  const handleCancelConfirmed = async () => {
    const res = await ApiService.cancelApplication(item.applicationId);
    if (!res.success) throw new Error(res.error || 'Erreur lors de l\'annulation');
    onSuccess(item.id, 'Dossier annulé');
    onClose();
  };

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

  // ── Commentaires d'analyse (logique partagée entre onglets) ─────────────────
  const myUserId         = userState.currentUser?.id;
  const allAnalysisComments: any[] = app?.analysisResults?.comments ?? [];
  const othersComments   = allAnalysisComments.filter((c: any) => c.userId !== myUserId);
  const myComment        = allAnalysisComments.find((c: any)  => c.userId === myUserId) ?? null;

  const fmtTs = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' à ' +
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const handleSaveComment = async () => {
    if (!mySynthesis.trim() && !myReco.trim()) return;
    setSavingComment(true);
    setCommentSaveMsg('');
    const res = await ApiService.saveAnalysisComment(item.applicationId, {
      synthesis: mySynthesis.trim(),
      recommendations: myReco.trim(),
    });
    if (res.success) {
      setApp((prev: any) => ({
        ...prev,
        analysisResults: { ...(prev?.analysisResults ?? {}), comments: res.data },
      }));
      setCommentSaveMsg('Enregistré');
      setTimeout(() => setCommentSaveMsg(''), 3000);
    } else {
      setCommentSaveMsg('Erreur : ' + res.error);
    }
    setSavingComment(false);
  };

  // Carte lecture seule pour un intervenant
  const CommentCard = ({ c, isMine = false }: { c: any; isMine?: boolean }) => (
    <Box sx={{
      p: 1.5, borderRadius: 2,
      bgcolor: isMine ? '#eff6ff' : '#f8f9fa',
      border: `1px solid ${isMine ? '#bfdbfe' : '#e9ecef'}`,
    }}>
      {/* En-tête : identité */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} fontSize={12}
              color={isMine ? 'primary.main' : 'text.primary'}>
              {c.userName}{isMine ? ' (moi)' : ''}
            </Typography>
            {c.isModified && (
              <Chip label="Modifié" size="small" variant="outlined" color="warning"
                sx={{ height: 16, fontSize: 10 }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            {c.userRole && (
              <Typography variant="caption" fontSize={10} fontWeight={600}
                color={isMine ? 'primary.light' : 'text.secondary'}>
                {(USER_ROLE_LABELS as any)[c.userRole] ?? c.userRole}
              </Typography>
            )}
            {c.userRole && c.userBranch && (
              <Typography variant="caption" fontSize={10} color="text.disabled">·</Typography>
            )}
            {c.userBranch && (
              <Typography variant="caption" fontSize={10}
                color={isMine ? 'primary.light' : 'text.secondary'}>{c.userBranch}</Typography>
            )}
          </Box>
        </Box>
        <Typography variant="caption" color="text.disabled" fontSize={10} sx={{ flexShrink: 0, ml: 1 }}>
          {c.isModified ? `Modifié le ${fmtTs(c.updatedAt)}` : `Le ${fmtTs(c.createdAt)}`}
        </Typography>
      </Box>

      {/* Synthèse */}
      {c.synthesis && (
        <Box mb={c.recommendations ? 1 : 0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4 }}>
            Synthèse de l'analyse
          </Typography>
          <Typography variant="body2" fontSize={12} sx={{ lineHeight: 1.6, mt: 0.25, color: '#374151' }}>
            {c.synthesis}
          </Typography>
        </Box>
      )}

      {/* Recommandations */}
      {c.recommendations && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4 }}>
            Recommandations
          </Typography>
          <Typography variant="body2" fontSize={12} sx={{ lineHeight: 1.6, mt: 0.25, color: '#374151' }}>
            {c.recommendations}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const CommentsPanelContent = (
    <Stack spacing={1.5}>
      {/* Autres intervenants — lecture seule */}
      {othersComments.map((c: any) => <CommentCard key={c.userId} c={c} />)}

      {/* Mon commentaire existant — lecture */}
      {myComment && <CommentCard c={myComment} isMine />}

      {/* Formulaire de saisie / modification */}
      <Box sx={{
        p: 1.5, borderRadius: 2,
        border: '1px dashed #93c5fd',
        bgcolor: '#f8fbff',
      }}>
        <Typography variant="caption" color="primary.main" fontWeight={700}
          sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, display: 'block', mb: 1.25 }}>
          {myComment ? 'Modifier mon analyse' : 'Rédiger mon analyse'}
        </Typography>

        <Stack spacing={1.5}>
          <TextField
            label="Synthèse de l'analyse"
            multiline minRows={3} maxRows={7}
            fullWidth size="small"
            value={mySynthesis}
            onChange={e => setMySynthesis(e.target.value)}
            placeholder="Résumé de votre analyse du dossier, points forts et points faibles..."
            disabled={savingComment}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          <TextField
            label="Recommandations"
            multiline minRows={2} maxRows={5}
            fullWidth size="small"
            value={myReco}
            onChange={e => setMyReco(e.target.value)}
            placeholder="Conditions, montant recommandé, garanties exigées, réserves..."
            disabled={savingComment}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </Stack>

        {commentSaveMsg && (
          <Alert severity={commentSaveMsg.startsWith('Erreur') ? 'error' : 'success'}
            sx={{ mt: 1.25, py: 0.25 }}>
            {commentSaveMsg}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
          <Button
            variant="contained"
            size="small"
            disabled={savingComment || (!mySynthesis.trim() && !myReco.trim())}
            startIcon={savingComment ? <CircularProgress size={13} color="inherit" /> : undefined}
            onClick={handleSaveComment}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', boxShadow: 'none', fontSize: 12 }}
          >
            {myComment ? 'Modifier' : 'Enregistrer'}
          </Button>
        </Box>
      </Box>

      {othersComments.length === 0 && !myComment && (
        <Typography variant="body2" color="text.secondary" fontSize={12}>
          Aucune analyse rédigée pour l'instant.
        </Typography>
      )}
    </Stack>
  );

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
            <Tab label="Dossier"   sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            <Tab label="Crédit"    sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
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

              {/* ── Tab 1 : Crédit complet (accordéons) ── */}
              {tab === 1 && (
                <Stack spacing={0.75}>
                  {/* ── Demande ── */}
                  <Accordion defaultExpanded disableGutters elevation={0} sx={{
                    border: '1px solid #e5e7eb', borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                      <Typography fontWeight={700} fontSize={13}>Demande de crédit</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 2 }}>
                        <InfoCell label="Client"             value={item.clientName} />
                        <InfoCell label="Montant demandé"    value={<Typography variant="body2" fontWeight={700} color="primary.main">{fmt(item.amount, item.currency)}</Typography>} />
                        <InfoCell label="Type de crédit"     value={creditType} />
                        <InfoCell label="Durée"              value={app?.durationMonths ? `${app.durationMonths} mois` : null} />
                        <InfoCell label="Taux proposé"       value={app?.proposedRate ? `${app.proposedRate}%` : null} />
                        <InfoCell label="Agence"             value={item.branch} />
                        <InfoCell label="Chargé d'affaires"  value={creator} />
                        <InfoCell label="Soumis le"          value={fmtDate(app?.submittedAt)} />
                        {app?.collateralType && (
                          <InfoCell label="Garantie" value={`${app.collateralType}${app.collateralValue ? ` — ${fmt(app.collateralValue, item.currency)}` : ''}`} />
                        )}
                      </Box>
                      {item.purpose && (
                        <Box mt={2}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: 11 }}>
                            Objet du financement
                          </Typography>
                          <Typography variant="body2" mt={0.5} sx={{ lineHeight: 1.6 }}>{item.purpose}</Typography>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* ── Pièces / Documents ── */}
                  <Accordion disableGutters elevation={0} sx={{
                    border: '1px solid #e5e7eb', borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75, alignItems: 'center', gap: 1 } }}>
                      <Typography fontWeight={700} fontSize={13}>Pièces justificatives</Typography>
                      {app?.documents?.length > 0 && (
                        <Chip
                          label={app.documents.length}
                          size="small"
                          color="primary"
                          sx={{ height: 18, fontSize: 11, ml: 0.5, fontWeight: 700 }}
                        />
                      )}
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0.5, pb: 2, px: 2 }}>
                      {!app?.documents?.length ? (
                        <Box sx={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          py: 3, color: 'text.disabled', gap: 1,
                        }}>
                          <DocIcon sx={{ fontSize: 36, opacity: 0.25 }} />
                          <Typography variant="body2" color="text.secondary">
                            Aucun document joint à ce dossier
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1}>
                          {app.documents.map((doc: any) => {
                            const mime   = doc.mimeType ?? '';
                            const isPdf  = mime.includes('pdf');
                            const isImg  = mime.startsWith('image/');
                            const isWord = mime.includes('word') || mime.includes('doc');
                            const isXls  = mime.includes('excel') || mime.includes('sheet') || mime.includes('xls');

                            const fileColor = isPdf  ? '#dc2626'
                                            : isImg  ? '#059669'
                                            : isWord ? '#2563eb'
                                            : isXls  ? '#16a34a'
                                            :          '#7c3aed';
                            const fileLabel = isPdf  ? 'PDF'
                                            : isImg  ? 'Image'
                                            : isWord ? 'Word'
                                            : isXls  ? 'Excel'
                                            : doc.mimeType?.split('/')[1]?.toUpperCase() ?? 'Fichier';

                            const CAT_LABELS: Record<string, string> = {
                              FINANCIAL: 'Financier', LEGAL: 'Juridique',
                              IDENTITY: 'Identité', COLLATERAL: 'Garantie',
                              CONTRACT: 'Contrat', OTHER: 'Autre',
                            };
                            const STATUS_CFG: Record<string, { label: string; color: string }> = {
                              VERIFIED:   { label: 'Vérifié',     color: '#16a34a' },
                              PENDING:    { label: 'En attente',  color: '#d97706' },
                              PROCESSING: { label: 'En cours',    color: '#2563eb' },
                              ERROR:      { label: 'Erreur',      color: '#dc2626' },
                            };
                            const statusCfg = STATUS_CFG[doc.status] ?? { label: doc.status, color: '#9ca3af' };

                            const fmtSize = (bytes: number | null) => {
                              if (!bytes) return null;
                              if (bytes < 1024) return `${bytes} o`;
                              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
                              return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
                            };

                            const apiBase = `${window.location.origin}/api`;

                            return (
                              <Box key={doc.id} sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                p: 1.25, borderRadius: 2,
                                border: '1px solid #e5e7eb',
                                bgcolor: 'white',
                                transition: 'box-shadow 0.15s',
                                '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
                              }}>
                                {/* Icône type */}
                                <Box sx={{
                                  width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                                  bgcolor: fileColor + '15',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: fileColor, letterSpacing: '-0.3px' }}>
                                    {fileLabel}
                                  </Typography>
                                </Box>

                                {/* Infos */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
                                    {doc.filename}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.3, flexWrap: 'wrap' }}>
                                    {doc.category && (
                                      <Typography variant="caption" sx={{
                                        fontSize: '0.62rem', fontWeight: 600, px: 0.75, py: 0.1,
                                        borderRadius: 1, bgcolor: '#f3f4f6', color: '#6b7280',
                                      }}>
                                        {CAT_LABELS[doc.category] ?? doc.category}
                                      </Typography>
                                    )}
                                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: statusCfg.color, flexShrink: 0 }} />
                                    <Typography variant="caption" sx={{ fontSize: '0.62rem', color: statusCfg.color, fontWeight: 600 }}>
                                      {statusCfg.label}
                                    </Typography>
                                    {fmtSize(doc.fileSize) && (
                                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                                        · {fmtSize(doc.fileSize)}
                                      </Typography>
                                    )}
                                  </Box>
                                  {doc.uploadedBy && (
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', display: 'block', mt: 0.2 }}>
                                      Déposé par {doc.uploadedBy}
                                      {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}` : ''}
                                    </Typography>
                                  )}
                                </Box>

                                {/* Actions */}
                                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                                  <Tooltip title="Aperçu">
                                    <IconButton
                                      size="small"
                                      onClick={() => previewDocumentWithAuth(
                                        `${apiBase}/documents/preview/${doc.id}`,
                                      )}
                                      sx={{ color: '#6b7280', '&:hover': { color: '#1d4ed8', bgcolor: '#eff6ff' } }}
                                    >
                                      <OpenIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Télécharger">
                                    <IconButton
                                      size="small"
                                      onClick={() => downloadDocumentWithAuth(
                                        `${apiBase}/documents/download/${doc.id}`,
                                        doc.filename,
                                      )}
                                      sx={{ color: '#6b7280', '&:hover': { color: '#059669', bgcolor: '#f0fdf4' } }}
                                    >
                                      <DocIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* ── Données financières ── */}
                  <Accordion disableGutters elevation={0} sx={{
                    border: '1px solid #e5e7eb', borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                      <Typography fontWeight={700} fontSize={13}>Données financières</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                      {(() => {
                        const analysisResults = app?.analysisResults || {};
                        const financialData   = analysisResults?.financialData || {};
                        const years = Object.keys(financialData).map(Number).sort((a, b) => a - b);
                        const latestYear = years[years.length - 1];
                        const fd = latestYear != null ? resolveFinancialData(financialData[latestYear]) : null;
                        if (!fd) return (
                          <Typography variant="body2" color="text.secondary">Aucune donnée financière disponible.</Typography>
                        );
                        return (
                          <Stack spacing={2}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: 10, mb: 1, display: 'block' }}>
                                Compte de résultat (FCFA)
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 1.5 }}>
                                {[
                                  { label: "Chiffre d'affaires",    k: 'chiffre_affaires' },
                                  { label: 'Valeur ajoutée',         k: 'valeur_ajoutee' },
                                  { label: 'EBE',                    k: 'ebe' },
                                  { label: "Rés. d'exploitation",    k: 'resultat_exploitation' },
                                  { label: 'Résultat financier',     k: 'resultat_financier' },
                                  { label: 'Résultat net',           k: 'resultat_net' },
                                ].map(({ label, k }) => (
                                  <Box key={k}>
                                    <Typography variant="caption" color="text.secondary" fontSize={10}>{label}</Typography>
                                    <Typography variant="body2" fontWeight={600} fontSize={12}>
                                      {fd[k] != null ? fmt(fd[k]) : '—'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                            <Divider />
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: 10, mb: 1, display: 'block' }}>
                                Bilan (FCFA)
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 1.5 }}>
                                {[
                                  { label: 'Total actif',        k: 'total_actif' },
                                  { label: 'Actif immobilisé',   k: 'actif_immobilise' },
                                  { label: 'Actif circulant',    k: 'actif_circulant' },
                                  { label: 'Stocks',             k: 'stocks' },
                                  { label: 'Créances clients',   k: 'creances_clients' },
                                  { label: 'Trésorerie actif',   k: 'tresorerie' },
                                  { label: 'Capitaux propres',   k: 'capitaux_propres' },
                                  { label: 'Dettes financières', k: 'dettes_financieres' },
                                  { label: 'Passif circulant',   k: 'passif_circulant' },
                                ].map(({ label, k }) => (
                                  <Box key={k}>
                                    <Typography variant="caption" color="text.secondary" fontSize={10}>{label}</Typography>
                                    <Typography variant="body2" fontWeight={600} fontSize={12}>
                                      {fd[k] != null ? fmt(fd[k]) : '—'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                            {(fd.flux_exploitation !== 0 || fd.variation_tresorerie !== 0) && (
                              <>
                                <Divider />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: 10, mb: 1, display: 'block' }}>
                                    Flux de trésorerie (FCFA)
                                  </Typography>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 1.5 }}>
                                    {[
                                      { label: "Flux d'exploitation",   k: 'flux_exploitation' },
                                      { label: 'Variation trésorerie',  k: 'variation_tresorerie' },
                                    ].map(({ label, k }) => (
                                      <Box key={k}>
                                        <Typography variant="caption" color="text.secondary" fontSize={10}>{label}</Typography>
                                        <Typography variant="body2" fontWeight={600} fontSize={12}>
                                          {fd[k] != null ? fmt(fd[k]) : '—'}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              </>
                            )}
                          </Stack>
                        );
                      })()}
                    </AccordionDetails>
                  </Accordion>

                  {/* ── Analyse préliminaire ── */}
                  {app?.analysisResults?.preliminaryAnalysis && (
                    <Accordion disableGutters elevation={0} sx={{
                      border: '1px solid #e5e7eb', borderRadius: '8px !important',
                      '&:before': { display: 'none' },
                    }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                        <Typography fontWeight={700} fontSize={13}>Analyse préliminaire</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 1.5 }}>
                          {[
                            { label: 'Score analyste',  val: app.analysisResults.preliminaryAnalysis.analystScore },
                            { label: 'Score financier', val: app.analysisResults.preliminaryAnalysis.financialScore },
                            { label: 'Score global',    val: app.analysisResults.preliminaryAnalysis.overallScore },
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
                          <Box mb={1.5}>
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
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* ── Commentaires d'analyse ── */}
                  <Accordion defaultExpanded disableGutters elevation={0} sx={{
                    border: '1px solid #e5e7eb', borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75, alignItems: 'center' } }}>
                      <Typography fontWeight={700} fontSize={13}>Commentaires d'analyse</Typography>
                      {allAnalysisComments.length > 0 && (
                        <Chip label={allAnalysisComments.length} size="small" color="primary" variant="outlined"
                          sx={{ height: 18, fontSize: 11, ml: 1 }} />
                      )}
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                      {CommentsPanelContent}
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              )}

              {/* ── Tab "Analyse" (ANALYSIS step uniquement) ── */}
              {isAnalysis && tab === 2 && (
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

                  {/* Commentaires partagés entre analystes */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Typography variant="body2" fontWeight={700}>Commentaires d'analyse</Typography>
                      {allAnalysisComments.length > 0 && (
                        <Chip label={allAnalysisComments.length} size="small" color="primary" variant="outlined"
                          sx={{ height: 18, fontSize: 11 }} />
                      )}
                    </Box>
                    {CommentsPanelContent}
                  </Box>
                </Stack>
              )}

              {/* ── Tab Historique ── */}
              {tab === (isAnalysis ? 3 : 2) && (
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

          {/* Bouton annulation — toujours visible si autorisé */}
          {canCancel && (
            <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px dashed #f3c6c6' }}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                fullWidth
                startIcon={<RejectIcon />}
                onClick={() => { setCancelReason(''); setCancelDialog(true); }}
                sx={{
                  borderRadius: 2, textTransform: 'none', fontWeight: 600,
                  borderColor: '#f87171', color: '#dc2626',
                  '&:hover': { bgcolor: '#fef2f2', borderColor: '#dc2626' },
                }}
              >
                Annuler ce dossier
              </Button>
            </Box>
          )}

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

      {/* OTP — actions workflow */}
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

      {/* ── Modal avertissement annulation ── */}
      <Dialog
        open={cancelDialog}
        onClose={() => setCancelDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '50%',
            bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <RejectIcon sx={{ color: '#dc2626', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize="1rem">Annuler le dossier</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.clientName} — {item.applicationNumber}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 2 }}
            icon={false}
          >
            <Typography variant="body2" fontWeight={700} mb={0.5}>
              ⚠️ Cette action est irréversible
            </Typography>
            <Typography variant="body2">
              L'annulation clôture définitivement le dossier et interrompt toutes
              les étapes en cours. Le dossier ne pourra plus être traité ni relancé.
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Précisez le motif d'annulation <span style={{ color: '#9ca3af' }}>(optionnel)</span> :
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Ex: Demande retirée par le client, doublon, erreur de saisie…"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, gap: 1 }}>
          <Button
            onClick={() => setCancelDialog(false)}
            sx={{ textTransform: 'none', color: '#636366', flex: 1 }}
          >
            Retour
          </Button>
          <Button
            variant="contained"
            color="error"
            sx={{ textTransform: 'none', fontWeight: 700, flex: 1, borderRadius: 2, boxShadow: 'none' }}
            onClick={() => { setCancelDialog(false); setCancelOtp(true); }}
          >
            Confirmer via OTP
          </Button>
        </DialogActions>
      </Dialog>

      {/* OTP — annulation dossier */}
      <OtpVerificationDialog
        open={cancelOtp}
        actionLabel="l'annulation du dossier"
        purpose="cancel_application"
        onClose={() => setCancelOtp(false)}
        onVerified={handleCancelConfirmed}
      />
    </>
  );
};

export default DossierActionDrawer;
