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
  Slider, Card, CardContent, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress,
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
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  WaterDrop as WaterDropIcon,
  Balance as BalanceIcon,
  Autorenew as AutorenewIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
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
  const is = data.incomeStatement || {};
  const cf = data.cashFlow        || {};
  const b  = data.balance?.brut   || {};
  const a  = data.balance?.amort  || {};

  // NET = BRUT − AMORT (actif uniquement ; passif n'a pas de colonne amort)
  const n = (code: string) => (b[code] ?? 0) - (a[code] ?? 0);

  // Totaux ACTIF recalculés depuis les lignes saisies (NET), formules = ohadaStatements.ts
  const actifImmo = n('AB')+n('AC')+n('AD')+n('AE')+n('AF')+n('AG')+n('AH')+n('AI')+n('AJ')+n('AK')+n('AL')+n('AM')+n('AN');
  const actifCirc = n('AP')+n('AQ')+n('AR')+n('AS')+n('AT')+n('AU')+n('AV')+n('AW')+n('AX');
  const tresActif = n('BA')+n('BB')+n('BC');
  const totalActif = actifImmo + actifCirc + tresActif;

  // Totaux PASSIF recalculés depuis les lignes saisies (pas d'amort sur passif)
  const capPropres    = (b.CA??0)-(b.CB??0)+(b.CC??0)+(b.CD??0)+(b.CE??0)+(b.CF??0)+(b.CG??0)+(b.CH??0)+(b.CI??0);
  const dettesFin     = (b.DA??0)+(b.DB??0)+(b.DC??0)+(b.DD??0);
  const passifCirc    = (b.DH??0)+(b.DI??0)+(b.DJ??0)+(b.DK??0)+(b.DL??0)+(b.DM??0)+(b.DN??0);
  const tresPassif    = (b.DQ??0)+(b.DR??0);

  // Fallback sur les agrégats stockés si les lignes détaillées sont absentes (données Excel/legacy)
  const totalActifFinal   = totalActif   || (b.BZ ?? 0);
  const capPropresF       = capPropres   || (b.CP ?? 0);
  const dettesFinalF      = dettesFin    || (b.DF ?? 0);
  const passifCircF       = passifCirc   || (b.DP ?? 0);
  const tresPassifF       = tresPassif   || (b.DT ?? 0);

  return {
    chiffre_affaires:              is.XB  ?? 0,
    valeur_ajoutee:                is.XD  ?? 0,
    ebe:                           is.XE  ?? 0,
    resultat_exploitation:         is.XF  ?? 0,
    produits_financiers:           (is.SA ?? 0) + (is.SB ?? 0) + (is.SC ?? 0),
    charges_financieres:           (is.SD ?? 0) + (is.SE ?? 0),
    resultat_financier:            is.XG  ?? 0,
    resultat_net:                  is.XJ  ?? 0,
    flux_exploitation:             cf.ZC  ?? 0,
    flux_investissement:           cf.ZD  ?? 0,
    flux_financement:              cf.ZG  ?? 0,
    variation_tresorerie:          cf.ZH  ?? 0,
    tresorerie_nette:              cf.ZI  ?? 0,
    actif_immobilise:              actifImmo       || (b.AO ?? 0),
    immobilisations_incorporelles: n('AB')+n('AC')+n('AD')+n('AE')+n('AF'),
    immobilisations_corporelles:   n('AG')+n('AH')+n('AI')+n('AJ')+n('AK'),
    immobilisations_financieres:   n('AL')+n('AM')+n('AN'),
    actif_circulant:               actifCirc       || (b.AZ ?? 0),
    stocks:                        n('AQ')+n('AR')+n('AS')+n('AT'),
    creances_clients:              n('AW'),
    autres_creances:               n('AX'),
    tresorerie:                    tresActif       || (b.BT ?? 0),
    total_actif:                   totalActifFinal,
    capitaux_propres:              capPropresF,
    dettes_financieres:            dettesFinalF,
    ressources_stables:            capPropresF + dettesFinalF,
    passif_circulant:              passifCircF,
    tresorerie_passif:             tresPassifF,
  };
}

// Normalise les noms de champs alternatifs produits par l'import Excel/calcul externe
function normalizeFinancialData(d: any): any {
  if (!d || typeof d !== 'object') return d;
  const r = { ...d };
  if (!r.actif_immobilise)  r.actif_immobilise  = r.total_actif_immobilise  ?? 0;
  if (!r.actif_circulant)   r.actif_circulant   = r.total_actif_circulant   ?? 0;
  if (!r.tresorerie)        r.tresorerie        = r.tresorerie_actif        ?? r.banques_caisses ?? 0;
  if (!r.passif_circulant)  r.passif_circulant  = r.total_dettes            ?? 0;
  return r;
}

function calcEvol(curr: number, prev: number): { pct: string; positive: boolean } | null {
  if (!prev || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return { pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct >= 0 };
}

function resolveFinancialData(entry: any): any | null {
  if (!entry) return null;
  if (entry?.multiyear_data?.N?.data) {
    const inner = entry.multiyear_data.N.data;
    // Double-wrapping : inner = { multiyear_data: { N: { data: flatData } }, score, ... }
    if (inner?.multiyear_data?.N?.data) {
      const flat = inner.multiyear_data.N.data;
      if (flat?.incomeStatement || flat?.balance) return flattenOhadaData(flat);
      return normalizeFinancialData(flat);
    }
    if (inner?.incomeStatement || inner?.balance) return flattenOhadaData(inner);
    return normalizeFinancialData(inner);
  }
  if (entry?.incomeStatement || entry?.balance) return flattenOhadaData(entry);
  const hasFinancialFields = entry && typeof entry === 'object' &&
    Object.keys(entry).some(k => ['chiffre_affaires', 'total_actif', 'capitaux_propres',
      'resultat_net', 'actif_immobilise', 'stocks', 'total_actif_immobilise', 'total_dettes'].includes(k));
  if (hasFinancialFields) return normalizeFinancialData(entry);
  return null;
}

function buildFinancialYearsData(analysisResults: any): Array<{ year: number; data: any }> {
  const financialData = analysisResults?.financialData || {};
  const yearKeys = Object.keys(financialData).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

  if (yearKeys.length > 0) {
    const result: Array<{ year: number; data: any }> = [];

    for (const baseYear of yearKeys) {
      const entry = financialData[baseYear];
      const myd = entry?.multiyear_data;
      if (myd && typeof myd === 'object') {
        // Détermine si les années internes sont canoniques (un seul outer key avec N/N-1/N-2)
        // ou si l'outer key fait foi (plusieurs clés séparées, une par année)
        const useOuterYear = yearKeys.length > 1;
        let extracted = false;
        for (const [, val] of Object.entries(myd as Record<string, any>)) {
          if (val?.year) {
            // Single-wrap: { year, data: flatData }
            const fd = resolveFinancialData(val?.data ?? val);
            if (fd) {
              result.push({ year: useOuterYear ? baseYear : val.year, data: fd });
              extracted = true;
              if (useOuterYear) break; // un seul résultat par clé d'année
            }
          } else if (val?.data?.multiyear_data) {
            // Double-wrap: { data: { multiyear_data: { N: { year, data }, 'N-1': ... } } }
            for (const [, inner] of Object.entries(val.data.multiyear_data as Record<string, any>)) {
              const yr = useOuterYear ? baseYear : ((inner as any)?.year ?? null);
              if (!yr) continue;
              const fd = resolveFinancialData((inner as any)?.data ?? inner);
              if (fd) {
                result.push({ year: yr, data: fd });
                extracted = true;
                if (useOuterYear) break; // un seul résultat par clé d'année
              }
            }
            if (useOuterYear && extracted) break;
          }
        }
        if (extracted) continue;
      }
      // Simple case: entry is direct financial data
      const fd = resolveFinancialData(entry);
      if (fd) result.push({ year: baseYear, data: fd });
    }

    if (result.length > 0) return result.sort((a, b) => a.year - b.year);
  }

  // Fallback: root-level multiyear_data
  const myd = analysisResults?.multiyear_data;
  if (myd && typeof myd === 'object') {
    return (Object.entries(myd) as Array<[string, any]>)
      .map(([key, val]) => {
        const year = val?.year ?? (key === 'N' ? new Date().getFullYear() : null);
        if (!year) return null;
        const fd = resolveFinancialData(val?.data ?? val);
        return fd ? { year, data: fd } : null;
      })
      .filter(Boolean) as Array<{ year: number; data: any }>;
  }
  return [];
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
  readOnly?: boolean;
  zIndex?: number;
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
  item, open, onClose, onSuccess, readOnly = false, zIndex,
}) => {
  const { state: userState } = useUser();
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [app, setApp]       = useState<any>(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [appError, setAppError]     = useState('');
  const [tab, setTab]               = useState(0);
  const [selectedFinYears, setSelectedFinYears] = useState<number[]>([]);

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
  const [myOpinion,      setMyOpinion]      = useState<'favorable' | 'defavorable' | null>(null);
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
      setMyOpinion(  existingComment?.opinion         ?? null);
    } else {
      setAppError(res.error || 'Erreur chargement dossier');
    }
    setLoadingApp(false);
  }, [item?.applicationId]);

  useEffect(() => {
    if (open) {
      setTab(0);
      setSelectedFinYears([]);
      setComment('');
      setActionError('');
      setActionOk('');
      setAnalystScore('');
      setFinancialScore('');
      setOverallAnalysis('');
      setRecommendations('');
      setMySynthesis('');
      setMyReco('');
      setMyOpinion(null);
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

  // ── Financial tab helpers ────────────────────────────────────────────────────
  const getNumericValue = (data: any, field: string): number => {
    const v = data?.[field];
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.-]/g, '')) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const computeBalanceTotals = (yearData: any) => {
    const actifImmobilise = getNumericValue(yearData, 'actif_immobilise') ||
      (getNumericValue(yearData, 'immobilisations_incorporelles') +
       getNumericValue(yearData, 'immobilisations_corporelles') +
       getNumericValue(yearData, 'immobilisations_financieres'));
    const actifCirculant = getNumericValue(yearData, 'actif_circulant') ||
      (getNumericValue(yearData, 'stocks') + getNumericValue(yearData, 'creances_clients') + getNumericValue(yearData, 'autres_creances'));
    const tresorerieActif = getNumericValue(yearData, 'tresorerie');
    const totalActif = getNumericValue(yearData, 'total_actif') || (actifImmobilise + actifCirculant + tresorerieActif);
    const capitauxPropres = getNumericValue(yearData, 'capitaux_propres') ||
      (getNumericValue(yearData, 'capital_social') + getNumericValue(yearData, 'reserves') + getNumericValue(yearData, 'resultat_exercice'));
    const dettesFinancieres = getNumericValue(yearData, 'dettes_financieres') ||
      (getNumericValue(yearData, 'emprunts_bancaires_lt') + getNumericValue(yearData, 'autres_dettes_financieres'));
    const passifCirculant = getNumericValue(yearData, 'passif_circulant') ||
      (getNumericValue(yearData, 'dettes_fournisseurs') + getNumericValue(yearData, 'dettes_fiscales_sociales') +
       getNumericValue(yearData, 'dettes_sociales_fiscales') + getNumericValue(yearData, 'clients_avances_recues') +
       getNumericValue(yearData, 'autres_dettes_courantes') + getNumericValue(yearData, 'autres_dettes'));
    const tresoreriePassif = getNumericValue(yearData, 'tresorerie_passif') || getNumericValue(yearData, 'emprunts_bancaires_ct');
    const computed = capitauxPropres + dettesFinancieres + passifCirculant + tresoreriePassif;
    const totalPassif = getNumericValue(yearData, 'total_passif') || computed;
    return { totalActif, totalPassif };
  };

  const calculateRatios = (yearData: any) => {
    if (!yearData) return null;
    const totalActif = getNumericValue(yearData, 'total_actif') || computeBalanceTotals(yearData).totalActif;
    const actifCirculant = getNumericValue(yearData, 'actif_circulant');
    const capitauxPropres = getNumericValue(yearData, 'capitaux_propres');
    const passifCirculant = getNumericValue(yearData, 'passif_circulant');
    const chiffreAffaires = getNumericValue(yearData, 'chiffre_affaires');
    const resultatNet = getNumericValue(yearData, 'resultat_net');
    const dettesLongTerme = getNumericValue(yearData, 'dettes_financieres');
    return {
      currentRatio: passifCirculant > 0 ? (actifCirculant / passifCirculant).toFixed(2) : 'N/A',
      netMargin: chiffreAffaires > 0 ? ((resultatNet / chiffreAffaires) * 100).toFixed(2) : 'N/A',
      roa: totalActif > 0 ? ((resultatNet / totalActif) * 100).toFixed(2) : 'N/A',
      debtToEquity: capitauxPropres > 0 ? ((dettesLongTerme + passifCirculant) / capitauxPropres).toFixed(2) : 'N/A',
      assetTurnover: totalActif > 0 ? (chiffreAffaires / totalActif).toFixed(2) : 'N/A',
    };
  };

  const getProgressColor = (score: number): 'success' | 'info' | 'warning' | 'error' =>
    score >= 80 ? 'success' : score >= 65 ? 'info' : score >= 50 ? 'warning' : 'error';

  const getRiskLevel = (score: number): { label: string; color: 'success' | 'warning' | 'error' | 'info' } =>
    score >= 80 ? { label: 'Risque Faible', color: 'success' } :
    score >= 65 ? { label: 'Risque Modéré', color: 'info' } :
    score >= 50 ? { label: 'Risque Élevé', color: 'warning' } :
    { label: 'Risque Critique', color: 'error' };

  const formatCurrencyFin = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(value);

  const finAllYearsData = buildFinancialYearsData(app?.analysisResults);
  const finYears = finAllYearsData.map(yd => yd.year);
  const finLatestYearData = finAllYearsData.length > 0 ? finAllYearsData[finAllYearsData.length - 1].data : null;
  const filteredFinYearsData = finAllYearsData.filter(({ year }) =>
    selectedFinYears.length === 0 ? true : selectedFinYears.includes(year)
  );
  const toggleFinYear = (year: number) => {
    setSelectedFinYears(prev => {
      if (prev.includes(year)) return prev.length > 1 ? prev.filter(y => y !== year) : prev;
      return [...prev, year].sort((a, b) => a - b);
    });
  };
  const finOverallScore = app?.analysisResults?.preliminaryAnalysis?.overallScore ?? app?.overallScore ?? 0;
  const finFinancialScore = app?.analysisResults?.preliminaryAnalysis?.financialScore ?? app?.financialScore ?? 0;
  const finAnalystScore = app?.analysisResults?.preliminaryAnalysis?.analystScore ?? app?.analystScore ?? 0;

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
      opinion: myOpinion,
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
            {c.opinion === 'favorable' && (
              <Chip label="Avis favorable" size="small"
                sx={{ height: 16, fontSize: 10, fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d' }} />
            )}
            {c.opinion === 'defavorable' && (
              <Chip label="Avis défavorable" size="small"
                sx={{ height: 16, fontSize: 10, fontWeight: 700, bgcolor: '#fee2e2', color: '#b91c1c' }} />
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
      {/* Synthèse cumulative des avis */}
      {(() => {
        const withOpinion = allAnalysisComments.filter((c: any) => c.opinion);
        if (withOpinion.length === 0) return null;
        const favorable   = withOpinion.filter((c: any) => c.opinion === 'favorable').length;
        const defavorable = withOpinion.filter((c: any) => c.opinion === 'defavorable').length;
        const total       = withOpinion.length;
        const pct         = Math.round((favorable / total) * 100);
        return (
          <Box sx={{
            p: 1.25, borderRadius: 2,
            bgcolor: pct >= 50 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${pct >= 50 ? '#bbf7d0' : '#fecaca'}`,
          }}>
            <Typography variant="caption" fontWeight={700} fontSize={10} textTransform="uppercase"
              letterSpacing={0.5} color="text.secondary" display="block" mb={0.75}>
              Synthèse des avis ({total} intervenant{total > 1 ? 's' : ''})
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ThumbUpIcon sx={{ fontSize: 14, color: '#16a34a' }} />
                <Typography fontWeight={700} fontSize={13} color="#16a34a">{favorable}</Typography>
                <Typography fontSize={11} color="text.secondary">favorable{favorable > 1 ? 's' : ''}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ThumbDownIcon sx={{ fontSize: 14, color: '#dc2626' }} />
                <Typography fontWeight={700} fontSize={13} color="#dc2626">{defavorable}</Typography>
                <Typography fontSize={11} color="text.secondary">défavorable{defavorable > 1 ? 's' : ''}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={pct}
                  sx={{
                    height: 6, borderRadius: 3, bgcolor: '#fecaca',
                    '& .MuiLinearProgress-bar': { bgcolor: '#16a34a', borderRadius: 3 },
                  }} />
              </Box>
              <Typography fontWeight={700} fontSize={12} color={pct >= 50 ? '#15803d' : '#b91c1c'}>
                {pct}%
              </Typography>
            </Box>
          </Box>
        );
      })()}

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

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, display: 'block', mb: 0.75 }}>
              Avis sur le dossier
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant={myOpinion === 'favorable' ? 'contained' : 'outlined'}
                onClick={() => setMyOpinion(v => v === 'favorable' ? null : 'favorable')}
                sx={{
                  textTransform: 'none', fontSize: 12, borderRadius: 2,
                  borderColor: '#16a34a',
                  color: myOpinion === 'favorable' ? 'white' : '#16a34a',
                  bgcolor: myOpinion === 'favorable' ? '#16a34a' : 'transparent',
                  '&:hover': { bgcolor: myOpinion === 'favorable' ? '#15803d' : '#f0fdf4' },
                }}
                startIcon={<ThumbUpIcon sx={{ fontSize: 14 }} />}
              >
                Favorable
              </Button>
              <Button
                size="small"
                variant={myOpinion === 'defavorable' ? 'contained' : 'outlined'}
                onClick={() => setMyOpinion(v => v === 'defavorable' ? null : 'defavorable')}
                sx={{
                  textTransform: 'none', fontSize: 12, borderRadius: 2,
                  borderColor: '#dc2626',
                  color: myOpinion === 'defavorable' ? 'white' : '#dc2626',
                  bgcolor: myOpinion === 'defavorable' ? '#dc2626' : 'transparent',
                  '&:hover': { bgcolor: myOpinion === 'defavorable' ? '#b91c1c' : '#fef2f2' },
                }}
                startIcon={<ThumbDownIcon sx={{ fontSize: 14 }} />}
              >
                Défavorable
              </Button>
            </Box>
          </Box>
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
        sx={zIndex ? { zIndex } : undefined}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 940 },
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
            <Tab label="Dossier"    sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            <Tab label="Crédit"     sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            <Tab label="Financier"  sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
            {isAnalysis && (
              <Tab label="Analyse"  sx={{ fontSize: 13, fontWeight: 600, textTransform: 'none' }} />
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

              {/* ── Tab 2 : Financier ── */}
              {tab === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Aperçu du fichier source Excel */}
                  {(() => {
                    const finDoc = (app as any)?.documents?.find((d: any) => d.category === 'FINANCIAL');
                    if (!finDoc) return null;
                    return (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<OpenIcon />}
                          onClick={() => previewDocumentWithAuth(
                            `${window.location.origin}/api/documents/preview/${finDoc.id}`,
                          )}
                          sx={{
                            color: '#16a34a',
                            borderColor: '#16a34a',
                            fontSize: '0.72rem',
                            textTransform: 'none',
                            borderRadius: 1.5,
                            '&:hover': { borderColor: '#15803d', bgcolor: 'rgba(22,163,74,0.08)' },
                          }}
                        >
                          Voir le fichier source (Excel)
                        </Button>
                      </Box>
                    );
                  })()}

                  {/* Sélecteur d'années */}
                  {finYears.length > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75, flexWrap: 'wrap' }}>
                      {finYears.map(year => (
                        <Chip
                          key={year}
                          label={year}
                          size="small"
                          variant={selectedFinYears.length === 0 || selectedFinYears.includes(year) ? 'filled' : 'outlined'}
                          onClick={() => toggleFinYear(year)}
                          color={selectedFinYears.length === 0 || selectedFinYears.includes(year) ? 'primary' : 'default'}
                          sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}
                        />
                      ))}
                    </Box>
                  )}

                  {finAllYearsData.length > 0 ? (
                    <>
                      {/* ─── Grandes Masses du Bilan ─── */}
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <AccountBalanceIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                            <Typography variant="subtitle2" fontWeight={700}>Grandes Masses du Bilan (SYSCOHADA)</Typography>
                          </Box>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'rgba(25,118,210,0.06)' }}>
                                  <TableCell sx={{ fontWeight: 700, py: 0.75 }}>Poste</TableCell>
                                  <TableCell sx={{ fontWeight: 700, py: 0.75, width: 80 }}>Cat.</TableCell>
                                  {filteredFinYearsData.map(({ year }, i) => (
                                    <React.Fragment key={year}>
                                      {i > 0 && (
                                        <TableCell align="center" sx={{ width: 60, fontSize: '0.68rem', color: 'text.secondary', fontWeight: 700, py: 0.75 }}>
                                          Évo.
                                        </TableCell>
                                      )}
                                      <TableCell align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
                                    </React.Fragment>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[
                                  { label: 'Actif Immobilisé', field: 'actif_immobilise', cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                                  { label: 'Actif Circulant',  field: 'actif_circulant',  cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                                  { label: 'Trésorerie Actif', field: 'tresorerie',       cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                                ].map(({ label, field, cat, catColor, catText }) => (
                                  <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                                    <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                                    <TableCell sx={{ py: 0.5 }}>
                                      <Chip label={cat} size="small" sx={{ height: 16, fontSize: '9px', fontWeight: 700, bgcolor: catColor, color: catText }} />
                                    </TableCell>
                                    {filteredFinYearsData.map(({ year, data }, i) => {
                                      const curr = getNumericValue(data, field);
                                      const prev = i > 0 ? getNumericValue(filteredFinYearsData[i - 1].data, field) : 0;
                                      const evo  = i > 0 ? calcEvol(curr, prev) : null;
                                      return (
                                        <React.Fragment key={year}>
                                          {i > 0 && (
                                            <TableCell align="center" sx={{ width: 60, py: 0.5, fontSize: '0.72rem', fontWeight: 600, color: evo ? (evo.positive ? '#16a34a' : '#dc2626') : 'text.secondary' }}>
                                              {evo ? evo.pct : '—'}
                                            </TableCell>
                                          )}
                                          <TableCell align="right" sx={{ py: 0.5 }}>{formatCurrencyFin(curr)}</TableCell>
                                        </React.Fragment>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                                <TableRow sx={{ bgcolor: 'rgba(25,118,210,0.08)' }}>
                                  <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL ACTIF</TableCell>
                                  <TableCell />
                                  {filteredFinYearsData.map(({ year, data }, i) => {
                                    const curr = computeBalanceTotals(data).totalActif;
                                    const prev = i > 0 ? computeBalanceTotals(filteredFinYearsData[i - 1].data).totalActif : 0;
                                    const evo  = i > 0 ? calcEvol(curr, prev) : null;
                                    return (
                                      <React.Fragment key={year}>
                                        {i > 0 && (
                                          <TableCell align="center" sx={{ width: 60, py: 0.75, fontSize: '0.72rem', fontWeight: 600, color: evo ? (evo.positive ? '#16a34a' : '#dc2626') : 'text.secondary' }}>
                                            {evo ? evo.pct : '—'}
                                          </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 700, py: 0.75 }}>{formatCurrencyFin(curr)}</TableCell>
                                      </React.Fragment>
                                    );
                                  })}
                                </TableRow>
                                {[
                                  { label: 'Capitaux Propres',   field: 'capitaux_propres',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                                  { label: 'Dettes Financières', field: 'dettes_financieres', cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                                  { label: 'Passif Circulant',   field: 'passif_circulant',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                                  { label: 'Trésorerie Passif',  field: 'tresorerie_passif', cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                                ].map(({ label, field, cat, catColor, catText }) => (
                                  <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                                    <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                                    <TableCell sx={{ py: 0.5 }}>
                                      <Chip label={cat} size="small" sx={{ height: 16, fontSize: '9px', fontWeight: 700, bgcolor: catColor, color: catText }} />
                                    </TableCell>
                                    {filteredFinYearsData.map(({ year, data }, i) => {
                                      const curr = getNumericValue(data, field);
                                      const prev = i > 0 ? getNumericValue(filteredFinYearsData[i - 1].data, field) : 0;
                                      const evo  = i > 0 ? calcEvol(curr, prev) : null;
                                      return (
                                        <React.Fragment key={year}>
                                          {i > 0 && (
                                            <TableCell align="center" sx={{ width: 60, py: 0.5, fontSize: '0.72rem', fontWeight: 600, color: evo ? (evo.positive ? '#16a34a' : '#dc2626') : 'text.secondary' }}>
                                              {evo ? evo.pct : '—'}
                                            </TableCell>
                                          )}
                                          <TableCell align="right" sx={{ py: 0.5 }}>{formatCurrencyFin(curr)}</TableCell>
                                        </React.Fragment>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                                <TableRow sx={{ bgcolor: 'rgba(76,175,80,0.08)' }}>
                                  <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL PASSIF</TableCell>
                                  <TableCell />
                                  {filteredFinYearsData.map(({ year, data }, i) => {
                                    const curr = computeBalanceTotals(data).totalPassif;
                                    const prev = i > 0 ? computeBalanceTotals(filteredFinYearsData[i - 1].data).totalPassif : 0;
                                    const evo  = i > 0 ? calcEvol(curr, prev) : null;
                                    return (
                                      <React.Fragment key={year}>
                                        {i > 0 && (
                                          <TableCell align="center" sx={{ width: 60, py: 0.75, fontSize: '0.72rem', fontWeight: 600, color: evo ? (evo.positive ? '#16a34a' : '#dc2626') : 'text.secondary' }}>
                                            {evo ? evo.pct : '—'}
                                          </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 700, py: 0.75 }}>{formatCurrencyFin(curr)}</TableCell>
                                      </React.Fragment>
                                    );
                                  })}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>

                      {/* ─── Compte de Résultat ─── */}
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <TrendingUpIcon sx={{ color: 'success.main', fontSize: 18 }} />
                            <Typography variant="subtitle2" fontWeight={700}>Compte de Résultat</Typography>
                          </Box>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                  <TableCell sx={{ fontWeight: 700, py: 0.75 }}>Indicateur</TableCell>
                                  {filteredFinYearsData.map(({ year }, i) => (
                                    <React.Fragment key={year}>
                                      {i > 0 && (
                                        <TableCell align="center" sx={{ width: 60, fontSize: '0.68rem', color: 'text.secondary', fontWeight: 700, py: 0.75 }}>
                                          Évo.
                                        </TableCell>
                                      )}
                                      <TableCell align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
                                    </React.Fragment>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[
                                  { label: "Chiffre d'Affaires",   field: 'chiffre_affaires' },
                                  { label: 'Valeur Ajoutée',        field: 'valeur_ajoutee' },
                                  { label: 'EBE',                   field: 'ebe' },
                                  { label: 'Résultat Exploitation', field: 'resultat_exploitation' },
                                  { label: 'Résultat Net',          field: 'resultat_net' },
                                ].map(({ label, field }) => (
                                  <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                                    <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                                    {filteredFinYearsData.map(({ year, data }, i) => {
                                      const val = getNumericValue(data, field);
                                      const prevData = i > 0 ? filteredFinYearsData[i - 1].data : null;
                                      const prevVal = prevData ? getNumericValue(prevData, field) : null;
                                      const trend = prevVal !== null && prevVal !== 0
                                        ? val > prevVal ? 'up' : val < prevVal ? 'down' : null
                                        : null;
                                      const evo = i > 0 ? calcEvol(val, prevVal ?? 0) : null;
                                      return (
                                        <React.Fragment key={year}>
                                          {i > 0 && (
                                            <TableCell align="center" sx={{ width: 60, py: 0.5, fontSize: '0.72rem', fontWeight: 600, color: evo ? (evo.positive ? '#16a34a' : '#dc2626') : 'text.secondary' }}>
                                              {evo ? evo.pct : '—'}
                                            </TableCell>
                                          )}
                                          <TableCell align="right" sx={{ py: 0.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4 }}>
                                              <span>{formatCurrencyFin(val)}</span>
                                              {trend === 'up'   && <TrendingUpIcon   sx={{ fontSize: 13, color: 'success.main' }} />}
                                              {trend === 'down' && <TrendingDownIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                                            </Box>
                                          </TableCell>
                                        </React.Fragment>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>

                      {/* ─── Ratios clés ─── */}
                      <Box>
                        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1, display: 'block', mb: 1 }}>
                          Ratios Clés (dernière année)
                        </Typography>
                        <Grid container spacing={1.5}>
                          {(() => {
                            const r = calculateRatios(finLatestYearData);
                            return [
                              { label: 'Liquidité Générale', value: r?.currentRatio ?? 'N/A', unit: 'x', norm: '≥ 1.5', ok: parseFloat(r?.currentRatio || '0') >= 1.5, icon: <WaterDropIcon sx={{ fontSize: 16 }} />, color: '#1976d2' },
                              { label: 'Marge Nette',        value: r?.netMargin    ?? 'N/A', unit: '%', norm: '≥ 10 %', ok: parseFloat(r?.netMargin    || '0') >= 10,  icon: <TrendingUpIcon  sx={{ fontSize: 16 }} />, color: '#388e3c' },
                              { label: 'Dette / Capitaux',   value: r?.debtToEquity ?? 'N/A', unit: 'x', norm: '≤ 1.0', ok: parseFloat(r?.debtToEquity || '99') <= 1,  icon: <BalanceIcon     sx={{ fontSize: 16 }} />, color: '#f57c00' },
                              { label: 'Rotation Actif',     value: r?.assetTurnover ?? 'N/A', unit: 'x', norm: '≥ 1.0', ok: parseFloat(r?.assetTurnover || '0') >= 1, icon: <AutorenewIcon   sx={{ fontSize: 16 }} />, color: '#7b1fa2' },
                            ].map(card => (
                              <Grid item xs={6} key={card.label}>
                                <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: '3px solid', borderLeftColor: card.value === 'N/A' ? 'grey.400' : card.ok ? 'success.main' : 'error.main' }}>
                                  <CardContent sx={{ p: 1.5, pb: '12px !important' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: card.color, mb: 0.5 }}>
                                      {card.icon}
                                      <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2 }}>{card.label}</Typography>
                                    </Box>
                                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                                      {card.value === 'N/A' ? '—' : `${card.value}${card.unit}`}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary">{card.norm}</Typography>
                                      {card.value !== 'N/A' && (
                                        <Chip label={card.ok ? 'OK' : 'Attention'} size="small" color={card.ok ? 'success' : 'warning'} sx={{ height: 16, fontSize: '9px', fontWeight: 700 }} />
                                      )}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            ));
                          })()}
                        </Grid>
                      </Box>

                      {/* ─── Score global ─── */}
                      {finOverallScore > 0 && (
                        <Card variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent sx={{ pb: '16px !important' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                                <Typography variant="h2" fontWeight={800} sx={{ lineHeight: 1, color: getProgressColor(finOverallScore) === 'success' ? '#2e7d32' : getProgressColor(finOverallScore) === 'warning' ? '#e65100' : '#c62828' }}>
                                  {finOverallScore}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">/100</Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="subtitle2" fontWeight={700}>Score Global</Typography>
                                  <Chip label={getRiskLevel(finOverallScore).label} color={getRiskLevel(finOverallScore).color} size="small" sx={{ fontWeight: 600 }} />
                                </Box>
                                <LinearProgress variant="determinate" value={finOverallScore} color={getProgressColor(finOverallScore)} sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200', mb: 0.75 }} />
                                <Typography variant="caption" color="text.secondary">
                                  Financier : {finFinancialScore} · Analyste : {finAnalystScore}
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      Aucune donnée financière disponible pour ce dossier.
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── Tab "Analyse" (ANALYSIS step uniquement) ── */}
              {isAnalysis && tab === 3 && (
                <Stack spacing={2.5}>
                  <Typography variant="body2" color="text.secondary">
                    Glissez les curseurs pour définir vos scores. La décision sera validée par OTP.
                  </Typography>

                  {/* ── Sliders de scoring ───────────────────────────────── */}
                  {[
                    { label: 'Score Analyste', value: analystScore, set: setAnalystScore },
                    { label: 'Score Financier', value: financialScore, set: setFinancialScore },
                  ].map(({ label, value, set }) => {
                    const num = Number(value) || 0;
                    const sliderColor = num >= 70 ? '#16a34a' : num >= 50 ? '#d97706' : num > 0 ? '#dc2626' : '#94a3b8';
                    const bgColor = num >= 70 ? 'rgba(22,163,74,0.06)' : num >= 50 ? 'rgba(217,119,6,0.06)' : num > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(0,0,0,0.03)';
                    const labelColor = num >= 70 ? '#15803d' : num >= 50 ? '#b45309' : num > 0 ? '#b91c1c' : '#64748b';
                    return (
                      <Box key={label} sx={{ bgcolor: bgColor, borderRadius: 2, px: 2, pt: 1.5, pb: 1, border: '1px solid', borderColor: num > 0 ? sliderColor + '40' : 'rgba(0,0,0,0.08)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '10px' }}>
                            {label}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                            <Typography variant="h5" fontWeight={800} sx={{ color: labelColor, lineHeight: 1 }}>
                              {num}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">/100</Typography>
                          </Box>
                        </Box>
                        <Slider
                          value={num}
                          onChange={(_, val) => set(String(val))}
                          min={0}
                          max={100}
                          step={1}
                          marks={[
                            { value: 50, label: '' },
                            { value: 70, label: '' },
                          ]}
                          sx={{
                            color: sliderColor,
                            height: 6,
                            py: 0.75,
                            '& .MuiSlider-thumb': {
                              width: 18, height: 18,
                              bgcolor: 'white',
                              border: `2px solid ${sliderColor}`,
                              boxShadow: `0 0 0 4px ${sliderColor}22`,
                              '&:hover': { boxShadow: `0 0 0 6px ${sliderColor}33` },
                            },
                            '& .MuiSlider-rail': { bgcolor: 'rgba(0,0,0,0.12)' },
                            '& .MuiSlider-mark': { bgcolor: 'rgba(0,0,0,0.2)', width: 2, height: 2 },
                            '& .MuiSlider-markLabel': { display: 'none' },
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>0 — Insuffisant</Typography>
                          <Typography variant="caption" sx={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>50</Typography>
                          <Typography variant="caption" sx={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>70+</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>100 — Excellent</Typography>
                        </Box>
                      </Box>
                    );
                  })}

                  {/* ── Score global calculé ────────────────────────────── */}
                  {overallScore !== null && analystScore && financialScore && (
                    <Box sx={{
                      p: 2, borderRadius: 2, textAlign: 'center',
                      bgcolor: overallScore >= 70 ? 'rgba(22,163,74,0.08)' : overallScore >= 50 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)',
                      border: '1px solid',
                      borderColor: overallScore >= 70 ? 'rgba(22,163,74,0.25)' : overallScore >= 50 ? 'rgba(217,119,6,0.25)' : 'rgba(220,38,38,0.25)',
                    }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '10px', display: 'block', mb: 0.5 }}>
                        Score global (moyenne)
                      </Typography>
                      <Typography variant="h3" fontWeight={800} sx={{
                        lineHeight: 1,
                        color: overallScore >= 70 ? '#15803d' : overallScore >= 50 ? '#b45309' : '#b91c1c',
                      }}>
                        {overallScore}
                        <Typography component="span" variant="body2" color="text.secondary"> / 100</Typography>
                      </Typography>
                      <Chip
                        label={overallScore >= 70 ? 'Risque Faible' : overallScore >= 50 ? 'Risque Modéré' : 'Risque Élevé'}
                        size="small"
                        sx={{
                          mt: 1, fontWeight: 700, fontSize: '10px',
                          bgcolor: overallScore >= 70 ? 'rgba(22,163,74,0.15)' : overallScore >= 50 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
                          color: overallScore >= 70 ? '#15803d' : overallScore >= 50 ? '#b45309' : '#b91c1c',
                        }}
                      />
                    </Box>
                  )}

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
              {tab === (isAnalysis ? 4 : 3) && (
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
          {/* Mode lecture seule */}
          {readOnly && (
            <Button fullWidth onClick={onClose} sx={{ textTransform: 'none', color: '#636366' }}>
              Fermer
            </Button>
          )}

          {!readOnly && item.isBlocked && (
            <Alert severity="info" sx={{ mb: 1.5, py: 0.5, fontSize: 13 }}>
              {item.blockingReason ?? 'Une étape précédente doit être complétée avant que vous puissiez agir sur ce dossier.'}
            </Alert>
          )}
          {!readOnly && actionError && <Alert severity="error"  sx={{ mb: 1.5, py: 0.5 }}>{actionError}</Alert>}
          {!readOnly && actionOk    && <Alert severity="success" sx={{ mb: 1.5, py: 0.5 }}>{actionOk}</Alert>}

          {/* Bouton annulation — toujours visible si autorisé */}
          {!readOnly && canCancel && (
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
          {!readOnly && isLegal && (
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
          {!readOnly && isDispatch && (
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
          {!readOnly && isAnalysis && (() => {
            const commentUnsaved =
              !!(mySynthesis.trim() || myReco.trim()) &&
              (myComment?.synthesis !== mySynthesis.trim() || myComment?.recommendations !== myReco.trim());
            const canValidate = !!analystScore && !!financialScore && !item.isBlocked && !submitting && !commentUnsaved;
            const tooltipMsg =
              (!analystScore || !financialScore) ? 'Renseignez les deux scores'
                : commentUnsaved                  ? 'Enregistrez votre commentaire avant de valider'
                : '';
            return (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={onClose}
                  disabled={submitting}
                  sx={{ textTransform: 'none', color: '#636366', flexShrink: 0 }}
                >
                  Fermer
                </Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={tooltipMsg}>
                  <span>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <ApproveIcon />}
                      disabled={!canValidate}
                      onClick={() => setOtp({ open: true, action: 'save_analysis' })}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
                    >
                      Valider l'analyse
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            );
          })()}

          {/* Autres étapes : décisions classiques */}
          {!readOnly && !isLegal && !isDispatch && !isAnalysis && (
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
                      disabled={submitting || !!item.isBlocked}
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
