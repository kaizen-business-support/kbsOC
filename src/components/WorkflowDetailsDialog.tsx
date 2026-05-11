import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Avatar,
  LinearProgress,
  Alert,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as ApproveIcon,
  CheckCircleOutline as StepDoneIcon,
  Schedule as ScheduleIcon,
  Cancel as RejectIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Image as ImageIcon,
  TableChart as TableChartIcon,
  Person as PersonIcon,
  CreditScore as CreditScoreIcon,
  WaterDrop as WaterDropIcon,
  Balance as BalanceIcon,
  Autorenew as AutorenewIcon,
} from '@mui/icons-material';
import { WorkflowTimestamps } from '../types';
import { WorkflowTimeline } from './WorkflowTimeline';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';
import { OtpVerificationDialog } from './OtpVerificationDialog';

interface WorkflowDetailsDialogProps {
  open: boolean;
  workflow: WorkflowTimestamps | null;
  application: any;
  onClose: () => void;
  onApprovalSubmitted?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`workflow-tabpanel-${index}`}
      aria-labelledby={`workflow-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const WorkflowDetailsDialog: React.FC<WorkflowDetailsDialogProps> = ({
  open,
  workflow,
  application,
  onClose,
  onApprovalSubmitted
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const { state: userState } = useUser();

  // OTP dialog state
  const [otpDialog, setOtpDialog] = useState<{
    open: boolean;
    pendingDecision: 'APPROVED' | 'REJECTED' | null;
  }>({ open: false, pendingDecision: null });

  // Documents tab state
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);
  const [docsUploadError, setDocsUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const getApiBase = () => `${window.location.origin}/api`;

  const fetchDocuments = useCallback(async (applicationId: string) => {
    setDocsLoading(true);
    try {
      const token = localStorage.getItem('optimus_access_token');
      const resp = await fetch(`${getApiBase()}/documents/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(data.documents || []);
      } else {
        console.error('[Documents] fetch failed:', resp.status, await resp.text().catch(() => ''));
      }
    } catch (err) {
      console.error('[Documents] fetch error:', err);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const openPreview = useCallback(async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewBlobUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const token = localStorage.getItem('optimus_access_token');
      const resp = await fetch(`${getApiBase()}/documents/preview/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      } else {
        const errData = await resp.json().catch(() => ({}));
        setPreviewError(
          `Erreur ${resp.status} — ${errData.error || errData.message || 'Fichier introuvable sur le serveur'}`
        );
      }
    } catch (e: any) {
      setPreviewError('Erreur réseau — impossible de contacter le serveur');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const downloadDoc = useCallback(async (doc: any) => {
    try {
      const token = localStorage.getItem('optimus_access_token');
      const resp = await fetch(`${getApiBase()}/documents/download/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Download failed:', e);
    }
  }, []);

  const uploadDocuments = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !workflow?.applicationId) return;
    setDocsUploading(true);
    setDocsUploadError(null);
    const token = localStorage.getItem('optimus_access_token');
    let hadError = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('documents', file, file.name);
      fd.append('category', 'OTHER');
      try {
        const resp = await fetch(`${getApiBase()}/documents/${workflow.applicationId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          hadError = true;
          setDocsUploadError(`Erreur ${resp.status} — ${err.error || err.message || 'Échec du téléversement'}`);
        }
      } catch (e: any) {
        hadError = true;
        setDocsUploadError('Erreur réseau lors du téléversement');
      }
    }
    setDocsUploading(false);
    if (!hadError) {
      fetchDocuments(workflow.applicationId);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [workflow?.applicationId, fetchDocuments]);

  const closePreview = useCallback(() => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
    setPreviewError(null);
  }, [previewBlobUrl]);

  // Reset state when dialog opens for a different workflow
  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setDocuments([]);
      setComments('');
      setSubmitError(null);
      setSubmitSuccess(null);
      setSelectedYears([]);
    }
  }, [open, workflow?.applicationId]);

  useEffect(() => {
    if (activeTab === 2 && workflow?.applicationId) {
      fetchDocuments(workflow.applicationId);
    }
  }, [activeTab, workflow?.applicationId, fetchDocuments]);

  if (!workflow) return null;

  // Check if current user can approve this workflow
  const canApprove = () => {
    if (!userState.currentUser || !workflow) {
      console.log('[canApprove] No user or workflow');
      return false;
    }

    const currentStep = workflow.steps?.find(step => !step.completedAt);
    console.log('[canApprove] Current step:', currentStep);
    console.log('[canApprove] All steps:', workflow.steps);
    console.log('[canApprove] Steps detail:', workflow.steps?.map(s => ({
      stepId: s.stepId,
      stepName: s.stepName,
      completedAt: s.completedAt,
      startedAt: s.startedAt
    })));

    if (!currentStep) {
      console.log('[canApprove] No current step found');
      return false;
    }

    // Check if the workflow is still in progress
    if (workflow.finalDecision) {
      console.log('[canApprove] Workflow has final decision:', workflow.finalDecision);
      return false;
    }

    const userRole = userState.currentUser.role?.toLowerCase();
    const currentStepId = currentStep.stepId;

    console.log('[canApprove] User role:', userRole);
    console.log('[canApprove] Current step ID:', currentStepId);
    console.log('[canApprove] Current step name:', currentStep.stepName);

    // Match user role to step ID (using string matching to handle dynamic approval steps)
    const stepIdStr = String(currentStepId);
    if (userRole === 'branch_manager' && stepIdStr === 'branch_manager_review') {
      console.log('[canApprove] Branch manager can approve!');
      return true;
    }
    if (userRole === 'credit_committee' && stepIdStr === 'credit_committee_review') {
      console.log('[canApprove] Credit committee can approve!');
      return true;
    }
    if (userRole === 'management' && stepIdStr === 'management_review') {
      console.log('[canApprove] Management can approve!');
      return true;
    }

    // Admin can approve any step
    if (userRole === 'admin') {
      console.log('[canApprove] Admin can approve!');
      return true;
    }

    console.log('[canApprove] No match found, cannot approve');
    return false;
  };

  const isActionAllowed = (action: string): boolean => {
    const currentStep = workflow?.steps?.find(step => !step.completedAt);
    if (!currentStep?.allowedActions || currentStep.allowedActions.length === 0) return true;
    return currentStep.allowedActions.includes(action);
  };

  const handleApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!userState.currentUser || !workflow) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const data = await ApiService.approveWorkflow(workflow.applicationId, {
        userId: userState.currentUser.id,
        decision,
        comments: comments.trim() || undefined,
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit decision');
      }

      setSubmitSuccess(data.message || 'Décision soumise avec succès');
      setComments('');

      if (onApprovalSubmitted) {
        onApprovalSubmitted();
      }

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Error submitting approval:', error);
      setSubmitError(error.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getStatusDisplay = (workflow: WorkflowTimestamps) => {
    if (workflow.finalDecision === 'approved') {
      return { label: 'Approuvé', color: 'success' as const };
    }
    if (workflow.finalDecision === 'rejected') {
      return { label: 'Refusé', color: 'error' as const };
    }
    return { label: 'En cours', color: 'info' as const };
  };

  const statusDisplay = getStatusDisplay(workflow);

  // Extract financial data and analysis results
  const analysisResults = application?.analysisResults || {};
  const financialData = analysisResults?.financialData || {};
  const preliminaryAnalysis = (typeof analysisResults?.preliminaryAnalysis === 'object' && analysisResults.preliminaryAnalysis !== null ? analysisResults.preliminaryAnalysis : {}) as any;

  // Get scores
  const overallScore = preliminaryAnalysis?.overallScore || application?.overallScore || 0;
  const financialScore = preliminaryAnalysis?.financialScore || application?.financialScore || 0;
  const analystScore = preliminaryAnalysis?.analystScore || application?.analystScore || 0;

  // Get financial data for all years (sorted from oldest to newest)
  const years = Object.keys(financialData).map(Number).sort((a, b) => a - b);
  const latestYear = years[years.length - 1];

  // Convertit le format OHADA (OhadaFinancialTable) en champs plats attendus par ce dialog
  const flattenOhadaData = (data: any): any => {
    const is = data.incomeStatement || {};
    const cf = data.cashFlow || {};
    const brut = data.balance?.brut || {};
    return {
      // Compte de résultat
      chiffre_affaires:       is.XB  ?? 0,
      valeur_ajoutee:         is.XD  ?? 0,
      ebe:                    is.XE  ?? 0,
      resultat_exploitation:  is.XF  ?? 0,
      produits_financiers:    (is.SA ?? 0) + (is.SB ?? 0) + (is.SC ?? 0),
      charges_financieres:    (is.SD ?? 0) + (is.SE ?? 0),
      resultat_financier:     is.XG  ?? 0,
      resultat_net:           is.XJ  ?? 0,
      // Flux de trésorerie
      flux_exploitation:      cf.ZC  ?? 0,
      flux_investissement:    cf.ZD  ?? 0,
      flux_financement:       cf.ZG  ?? 0,
      variation_tresorerie:   cf.ZH  ?? 0,
      tresorerie_nette:       cf.ZI  ?? 0,
      // Bilan actif
      actif_immobilise:       brut.AO ?? 0,
      immobilisations_incorporelles: brut.AF ?? 0,
      immobilisations_corporelles:   brut.AJ ?? 0,
      immobilisations_financieres:   brut.AN ?? 0,
      actif_circulant:        brut.AZ ?? 0,
      stocks:                 (brut.AQ ?? 0) + (brut.AR ?? 0) + (brut.AS ?? 0) + (brut.AT ?? 0),
      creances_clients:       brut.AW ?? 0,
      autres_creances:        brut.AX ?? 0,
      tresorerie:             brut.BT ?? 0,
      total_actif:            brut.BZ ?? 0,
      // Bilan passif
      capitaux_propres:       brut.CP ?? 0,
      dettes_financieres:     brut.DF ?? 0,
      ressources_stables:     brut.DG ?? 0,
      passif_circulant:       brut.DP ?? 0,
      tresorerie_passif:      brut.DT ?? 0,
    };
  };

  // Resolve year data: gère les 3 formats possibles
  const resolveYearData = (entry: any): any | null => {
    if (!entry) return null;
    // Format intermédiaire : { multiyear_data: { N: { data: {...} } } }
    if (entry?.multiyear_data?.N?.data) {
      const inner = entry.multiyear_data.N.data;
      // Si l'inner contient le format OHADA, le convertir
      if (inner?.incomeStatement || inner?.balance) return flattenOhadaData(inner);
      return inner;
    }
    // Format OHADA direct : { incomeStatement, cashFlow, balance }
    if (entry?.incomeStatement || entry?.balance) return flattenOhadaData(entry);
    // Format plat legacy : { chiffre_affaires: ..., total_actif: ... }
    const hasFinancialFields = entry && typeof entry === 'object' &&
      Object.keys(entry).some(k => ['chiffre_affaires', 'total_actif', 'capitaux_propres',
        'resultat_net', 'actif_immobilise', 'stocks'].includes(k));
    if (hasFinancialFields) return entry;
    return null;
  };

  // Get all years data
  const allYearsData = years.map(year => ({
    year,
    data: resolveYearData(financialData[year]),
    ratios: financialData[year]?.ratios || null
  })).filter(yearData => yearData.data !== null);

  const latestYearData = latestYear ? resolveYearData(financialData[latestYear]) : null;

  const filteredYearsData = allYearsData.filter(({ year }) =>
    selectedYears.length === 0 ? true : selectedYears.includes(year)
  );

  const toggleYear = (year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.length > 1 ? prev.filter(y => y !== year) : prev;
      }
      return [...prev, year].sort((a, b) => a - b);
    });
  };

  const getProgressColor = (score: number): 'success' | 'warning' | 'error' | 'info' => {
    if (score >= 80) return 'success';
    if (score >= 65) return 'info';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getRiskLevel = (score: number): { label: string; color: 'success' | 'warning' | 'error' | 'info' } => {
    if (score >= 80) return { label: 'Risque Faible', color: 'success' };
    if (score >= 65) return { label: 'Risque Modéré', color: 'info' };
    if (score >= 50) return { label: 'Risque Élevé', color: 'warning' };
    return { label: 'Risque Critique', color: 'error' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getNumericValue = (data: any, field: string): number => {
    const value = data?.[field];
    if (value === undefined || value === null || value === '') return 0;
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Shared balance totals computation (used by Grandes Masses, Bilan Détaillé and ratios)
  const computeBalanceTotals = (yearData: any) => {
    const actifImmobilise = getNumericValue(yearData, 'actif_immobilise') ||
      (getNumericValue(yearData, 'immobilisations_incorporelles') +
       getNumericValue(yearData, 'immobilisations_corporelles') +
       getNumericValue(yearData, 'immobilisations_financieres'));
    const actifCirculant = getNumericValue(yearData, 'actif_circulant') ||
      (getNumericValue(yearData, 'stocks') +
       getNumericValue(yearData, 'creances_clients') +
       getNumericValue(yearData, 'autres_creances'));
    const tresorerieActif = getNumericValue(yearData, 'tresorerie');
    const totalActif = getNumericValue(yearData, 'total_actif') ||
      (actifImmobilise + actifCirculant + tresorerieActif);

    const capitauxPropres = getNumericValue(yearData, 'capitaux_propres') ||
      (getNumericValue(yearData, 'capital_social') +
       getNumericValue(yearData, 'reserves') +
       getNumericValue(yearData, 'resultat_exercice'));
    const dettesFinancieres = getNumericValue(yearData, 'dettes_financieres') ||
      (getNumericValue(yearData, 'emprunts_bancaires_lt') +
       getNumericValue(yearData, 'autres_dettes_financieres'));
    const passifCirculant = getNumericValue(yearData, 'passif_circulant') ||
      (getNumericValue(yearData, 'dettes_fournisseurs') +
       getNumericValue(yearData, 'dettes_fiscales_sociales') +
       getNumericValue(yearData, 'autres_dettes_courantes'));
    const tresoreriePassif = getNumericValue(yearData, 'tresorerie_passif') ||
      getNumericValue(yearData, 'emprunts_bancaires_ct');
    const totalPassif = capitauxPropres + dettesFinancieres + passifCirculant + tresoreriePassif;

    return { totalActif, totalPassif };
  };

  // Calculate key ratios
  const calculateRatios = (yearData: any) => {
    if (!yearData) return null;

    const totalActif = getNumericValue(yearData, 'total_actif') || computeBalanceTotals(yearData).totalActif;
    const actifCirculant = getNumericValue(yearData, 'actif_circulant') || getNumericValue(yearData, 'total_actif_circulant');
    const capitauxPropres = getNumericValue(yearData, 'capitaux_propres') || getNumericValue(yearData, 'fonds_propres');
    const passifCirculant = getNumericValue(yearData, 'passif_circulant') ||
                           getNumericValue(yearData, 'dettes_fournisseurs') +
                           getNumericValue(yearData, 'dettes_sociales_fiscales');
    const chiffreAffaires = getNumericValue(yearData, 'chiffre_affaires') || getNumericValue(yearData, 'ca');
    const resultatNet = getNumericValue(yearData, 'resultat_net') || getNumericValue(yearData, 'benefice_net');
    const dettesLongTerme = getNumericValue(yearData, 'dettes_financieres') || getNumericValue(yearData, 'emprunts');

    return {
      // Liquidity
      currentRatio: passifCirculant > 0 ? (actifCirculant / passifCirculant).toFixed(2) : 'N/A',

      // Profitability
      netMargin: chiffreAffaires > 0 ? ((resultatNet / chiffreAffaires) * 100).toFixed(2) : 'N/A',
      roa: totalActif > 0 ? ((resultatNet / totalActif) * 100).toFixed(2) : 'N/A',

      // Leverage
      debtToEquity: capitauxPropres > 0 ? ((dettesLongTerme + passifCirculant) / capitauxPropres).toFixed(2) : 'N/A',
      equityRatio: totalActif > 0 ? ((capitauxPropres / totalActif) * 100).toFixed(2) : 'N/A',

      // Efficiency
      assetTurnover: totalActif > 0 ? (chiffreAffaires / totalActif).toFixed(2) : 'N/A'
    };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          maxHeight: '92vh',
          borderRadius: { xs: 0, sm: '16px' },
          overflow: 'hidden',
        }
      }}
    >
      {/* ── Header Apple-style ──────────────────────────────────────────── */}
      <DialogTitle sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(0,0,0,0.07)', bgcolor: '#fafafa' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
                {workflow.clientName}
              </Typography>
              <Chip
                label={statusDisplay.label}
                color={statusDisplay.color}
                size="small"
                sx={{ height: 20, fontSize: '11px', fontWeight: 600 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
              <Typography variant="caption" sx={{ color: '#8e8e93', fontWeight: 500 }}>
                {workflow.applicationNumber}
              </Typography>
              <Typography variant="caption" sx={{ color: '#c7c7cc' }}>·</Typography>
              <Typography variant="caption" sx={{ color: '#8e8e93', fontWeight: 500 }}>
                {new Intl.NumberFormat('fr-FR').format(workflow.requestedAmount)} {workflow.currency || 'XOF'}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              bgcolor: 'rgba(0,0,0,0.06)',
              width: 28, height: 28, flexShrink: 0,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.12)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.07)', px: 2, bgcolor: '#fafafa' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40, fontSize: '12px', fontWeight: 500,
              px: 2, minWidth: 0, gap: 0.5, color: '#8e8e93',
              textTransform: 'none', letterSpacing: 0,
            },
            '& .Mui-selected': { color: '#1c1c1e', fontWeight: 650 },
            '& .MuiTabs-indicator': { height: 2, borderRadius: '2px 2px 0 0' },
          }}
        >
          <Tab label="Vue d'ensemble" icon={<PersonIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Financier"      icon={<AccountBalanceIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Documents"      icon={<FolderIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      <DialogContent>
        {/* Tab 0: Vue d'ensemble */}
        <TabPanel value={activeTab} index={0}>
          {/* ─── Section Demande ─────────────────────────────────────────── */}
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1 }}>
            Demande
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Informations Client</Typography>
                  </Box>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { label: 'Nom du client', value: workflow.clientName },
                    { label: 'Chargé de compte', value: application?.accountManager || application?.creator?.name || '—' },
                    { label: 'Secteur', value: application?.sector || application?.client?.sector || '—' },
                    { label: 'Agence', value: application?.branch || workflow.steps?.[0]?.branch || '—' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', maxWidth: '55%' }}>{value}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CreditScoreIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Détails de la Demande</Typography>
                  </Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ mb: 1 }}>
                    {new Intl.NumberFormat('fr-FR').format(workflow.requestedAmount)} {workflow.currency || 'XOF'}
                  </Typography>
                  {[
                    { label: 'Type de crédit', value: application?.creditType?.name || application?.creditTypeName || '—' },
                    { label: 'Durée', value: application?.duration ? `${application.duration} mois` : '—' },
                    { label: 'Objet', value: application?.purpose || '—' },
                    { label: 'Soumis le', value: workflow.totalStartedAt ? new Date(workflow.totalStartedAt).toLocaleDateString('fr-FR') : '—' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', maxWidth: '55%' }}>{value}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ─── Section Parcours du dossier ─────────────────────────────── */}
          <Divider sx={{ mb: 2 }}>
            <Chip
              label={`Parcours du dossier · ${workflow.steps?.length || 0} étape${(workflow.steps?.length || 0) > 1 ? 's' : ''}`}
              size="small"
              sx={{ fontWeight: 600, fontSize: '11px' }}
            />
          </Divider>

          {workflow.steps && workflow.steps.length > 0 ? (
            <Box sx={{ pl: 1 }}>
              {workflow.steps.map((step, idx) => {
                const isCompleted = !!step.completedAt;
                const isActive = !step.completedAt && !!step.startedAt;
                const isLast = idx === (workflow.steps?.length ?? 0) - 1;

                const formatStepDate = (ts: string) =>
                  new Date(ts).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  });

                const formatStepDuration = (ms?: number) => {
                  if (!ms) return null;
                  const totalH = Math.floor(ms / 3600000);
                  const d = Math.floor(totalH / 24);
                  const h = totalH % 24;
                  return d > 0 ? `${d}j ${h}h` : `${totalH}h`;
                };

                const decisionColor: 'success' | 'error' | 'warning' | 'default' =
                  step.decision === 'approved' ? 'success' :
                  step.decision === 'rejected' ? 'error' :
                  step.decision === 'on_hold' ? 'warning' : 'default';

                const decisionLabel =
                  step.decision === 'approved' ? 'Approuvé' :
                  step.decision === 'rejected' ? 'Refusé' :
                  step.decision === 'on_hold' ? 'En attente' :
                  isActive ? 'En cours' : null;

                const nextStep = isActive && !isLast ? workflow.steps?.[idx + 1] : null;

                return (
                  <Box
                    key={step.stepId}
                    sx={{ display: 'flex', gap: 1.5, opacity: (!isCompleted && !isActive) ? 0.4 : 1 }}
                  >
                    {/* Rail */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: '1px',
                        bgcolor: isCompleted ? 'success.main' : isActive ? 'primary.main' : 'grey.300',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isCompleted && <StepDoneIcon sx={{ fontSize: 14, color: 'white' }} />}
                        {isActive && <ScheduleIcon sx={{ fontSize: 14, color: 'white' }} />}
                      </Box>
                      {!isLast && (
                        <Box sx={{ width: 2, flex: 1, minHeight: 28, bgcolor: 'grey.200', mt: '2px' }} />
                      )}
                    </Box>

                    {/* Contenu */}
                    <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
                        <Typography variant="body2" fontWeight={700}>{step.stepName}</Typography>
                        {decisionLabel && (
                          <Chip
                            label={decisionLabel}
                            color={decisionColor}
                            size="small"
                            sx={{ height: 18, fontSize: '10px', fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      {step.userName && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                          <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: '#e3f2fd', color: 'primary.main' }}>
                            {step.userName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {step.userName}{step.userRole ? ` · ${step.userRole}` : ''}
                          </Typography>
                        </Box>
                      )}

                      {step.startedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {formatStepDate(step.startedAt)}
                          {step.duration ? ` · ⏱ ${formatStepDuration(step.duration)}` : ''}
                        </Typography>
                      )}

                      {step.comments && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                          "{step.comments}"
                        </Typography>
                      )}

                      {nextStep && (
                        <Box sx={{
                          mt: 0.75, px: 1.25, py: 0.5, bgcolor: '#e3f2fd',
                          borderRadius: 1, display: 'inline-block',
                        }}>
                          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            → Prochaine étape : {nextStep.stepName}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aucune étape disponible pour ce dossier.
            </Typography>
          )}
        </TabPanel>

        {/* Tab 2: Financial Data Summary */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Évolution des Données Financières
          </Typography>

          {allYearsData.length > 0 ? (
            <Grid container spacing={3}>
              {/* Grandes Masses du Bilan */}
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'info.50', border: '2px solid', borderColor: 'info.main' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.main' }}>
                      🏛️ Grandes Masses du Bilan (SYSCOHADA)
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={3}>
                      {/* ACTIF - Grandes Masses */}
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom color="primary">
                              ACTIF
                            </Typography>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell><strong>Poste</strong></TableCell>
                                    {allYearsData.map(({ year }) => (
                                      <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Actif Immobilisé</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      // Calculate from components if actif_immobilise is not populated
                                      const actifImmobilise = getNumericValue(yearData, 'actif_immobilise') ||
                                        (getNumericValue(yearData, 'immobilisations_incorporelles') +
                                         getNumericValue(yearData, 'immobilisations_corporelles') +
                                         getNumericValue(yearData, 'immobilisations_financieres'));
                                      return (
                                        <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(actifImmobilise)}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Actif Circulant</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      // Calculate from components: stocks + receivables (excluding cash)
                                      const actifCirculantHAO = getNumericValue(yearData, 'stocks') +
                                        getNumericValue(yearData, 'creances_clients') +
                                        getNumericValue(yearData, 'autres_creances');
                                      return (
                                        <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(actifCirculantHAO)}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Trésorerie Actif</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => (
                                      <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                        {formatCurrency(getNumericValue(yearData, 'tresorerie'))}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'primary.main', borderTop: '2px solid', borderColor: 'grey.600' }}>
                                    <TableCell>
                                      <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>TOTAL ACTIF</Typography>
                                    </TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      const totalActif = getNumericValue(yearData, 'total_actif') || computeBalanceTotals(yearData).totalActif;
                                      return (
                                        <TableCell key={year} align="right">
                                          <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
                                            {formatCurrency(totalActif)}
                                          </Typography>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </CardContent>
                        </Card>
                      </Grid>

                      {/* PASSIF - Grandes Masses */}
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom color="secondary">
                              PASSIF
                            </Typography>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell><strong>Poste</strong></TableCell>
                                    {allYearsData.map(({ year }) => (
                                      <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Ressources Stables</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      // Ressources Stables = Capitaux Propres + Dettes Financières (LT)
                                      const capitauxPropres = getNumericValue(yearData, 'capitaux_propres') ||
                                        (getNumericValue(yearData, 'capital_social') +
                                         getNumericValue(yearData, 'reserves') +
                                         getNumericValue(yearData, 'resultat_exercice'));
                                      const dettesFinancieres = getNumericValue(yearData, 'dettes_financieres') ||
                                        (getNumericValue(yearData, 'emprunts_bancaires_lt') +
                                         getNumericValue(yearData, 'autres_dettes_financieres'));
                                      return (
                                        <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(capitauxPropres + dettesFinancieres)}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Passif Circulant</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      // Passif Circulant HAO = Current liabilities excluding short-term bank loans
                                      const passifCirculantHAO = getNumericValue(yearData, 'dettes_fournisseurs') +
                                        getNumericValue(yearData, 'dettes_fiscales_sociales') +
                                        getNumericValue(yearData, 'autres_dettes_courantes');
                                      return (
                                        <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                          {formatCurrency(passifCirculantHAO)}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell><strong>Trésorerie Passif</strong></TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => (
                                      <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                        {formatCurrency(getNumericValue(yearData, 'emprunts_bancaires_ct'))}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: 'secondary.main', borderTop: '2px solid', borderColor: 'grey.600' }}>
                                    <TableCell>
                                      <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>TOTAL PASSIF</Typography>
                                    </TableCell>
                                    {allYearsData.map(({ year, data: yearData }) => {
                                      const totalPassif = getNumericValue(yearData, 'total_passif') || computeBalanceTotals(yearData).totalPassif;
                                      return (
                                        <TableCell key={year} align="right">
                                          <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
                                            {formatCurrency(totalPassif)}
                                          </Typography>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Grandes Masses:</strong> Vue synthétique du bilan selon le référentiel SYSCOHADA,
                        permettant une analyse rapide de la structure financière (emplois stables vs. ressources stables,
                        fonds de roulement, besoin en fonds de roulement).
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>

              {/* Balance Sheet */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      📊 Bilan Détaillé
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Poste</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {/* ACTIF SECTION */}
                          <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>ACTIF</Typography>
                            </TableCell>
                          </TableRow>

                          {/* Actif Immobilisé (Non-current Assets) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Actif Immobilisé</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              // Calculate from components if actif_immobilise is not populated
                              const actifImmobilise = getNumericValue(yearData, 'actif_immobilise') ||
                                (getNumericValue(yearData, 'immobilisations_incorporelles') +
                                 getNumericValue(yearData, 'immobilisations_corporelles') +
                                 getNumericValue(yearData, 'immobilisations_financieres'));
                              return (
                                <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(actifImmobilise)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Immobilisations incorporelles</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'immobilisations_incorporelles'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Immobilisations corporelles</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'immobilisations_corporelles'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Immobilisations financières</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'immobilisations_financieres'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Actif Circulant HAO (Current Assets excluding cash) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Actif Circulant HAO</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              // Actif Circulant HAO = Stocks + Créances (excluding trésorerie)
                              const actifCirculantHAO = getNumericValue(yearData, 'stocks') +
                                getNumericValue(yearData, 'creances_clients') +
                                getNumericValue(yearData, 'autres_creances');
                              return (
                                <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(actifCirculantHAO)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Stocks</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'stocks'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Créances clients</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'creances_clients'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Autres créances</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'autres_creances'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Trésorerie-Actif (Separate section in SYSCOHADA) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Trésorerie-Actif</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(getNumericValue(yearData, 'tresorerie'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Banques, chèques postaux, caisse</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'tresorerie'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Total Actif */}
                          <TableRow sx={{ bgcolor: 'grey.200', borderTop: '2px solid', borderColor: 'grey.400' }}>
                            <TableCell><strong>TOTAL ACTIF</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                {formatCurrency(getNumericValue(yearData, 'total_actif') || computeBalanceTotals(yearData).totalActif)}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Spacer */}
                          <TableRow sx={{ height: 20 }}>
                            <TableCell colSpan={allYearsData.length + 1} sx={{ borderBottom: 'none' }} />
                          </TableRow>

                          {/* PASSIF SECTION */}
                          <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>PASSIF</Typography>
                            </TableCell>
                          </TableRow>

                          {/* Capitaux Propres (Equity) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Capitaux Propres</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              // Calculate from components if capitaux_propres is not populated
                              const capitauxPropres = getNumericValue(yearData, 'capitaux_propres') ||
                                (getNumericValue(yearData, 'capital_social') +
                                 getNumericValue(yearData, 'reserves') +
                                 getNumericValue(yearData, 'resultat_exercice'));
                              return (
                                <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(capitauxPropres)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Capital social</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'capital_social'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Réserves</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'reserves'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Résultat de l'exercice</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'resultat_exercice'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Dettes Non Courantes (Non-current Liabilities) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Dettes Non Courantes</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              // Calculate from components if dettes_financieres is not populated
                              const dettesFinancieres = getNumericValue(yearData, 'dettes_financieres') ||
                                (getNumericValue(yearData, 'emprunts_bancaires_lt') +
                                 getNumericValue(yearData, 'autres_dettes_financieres'));
                              return (
                                <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(dettesFinancieres)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Emprunts bancaires LT</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'emprunts_bancaires_lt'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Autres dettes financières</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'autres_dettes_financieres'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Passif Circulant HAO (Current Liabilities excluding bank overdrafts) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Passif Circulant HAO</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              // Passif Circulant HAO = Dettes courantes excluding short-term bank loans
                              const passifCirculantHAO = getNumericValue(yearData, 'dettes_fournisseurs') +
                                getNumericValue(yearData, 'dettes_fiscales_sociales') +
                                getNumericValue(yearData, 'autres_dettes_courantes');
                              return (
                                <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(passifCirculantHAO)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Dettes fournisseurs</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'dettes_fournisseurs'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Dettes fiscales et sociales</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'dettes_fiscales_sociales'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Autres dettes courantes</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'autres_dettes_courantes'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Trésorerie-Passif (Separate section in SYSCOHADA) */}
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Trésorerie-Passif</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(getNumericValue(yearData, 'emprunts_bancaires_ct'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Emprunts bancaires CT, découverts</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'emprunts_bancaires_ct'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Total Passif */}
                          <TableRow sx={{ bgcolor: 'grey.200', borderTop: '2px solid', borderColor: 'grey.400' }}>
                            <TableCell><strong>TOTAL PASSIF</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                {formatCurrency(getNumericValue(yearData, 'total_passif') || computeBalanceTotals(yearData).totalPassif)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Income Statement */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      💰 Compte de Résultat
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Poste</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {/* Revenue Section */}
                          <TableRow sx={{ bgcolor: 'success.main' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>PRODUITS D'EXPLOITATION</Typography>
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Chiffre d'Affaires</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(getNumericValue(yearData, 'chiffre_affaires'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Ventes de marchandises</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'ventes_marchandises'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Production vendue</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'production_vendue'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Prestations de services</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'prestations_services'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Autres produits</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'autres_produits'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Spacer */}
                          <TableRow sx={{ height: 10 }}>
                            <TableCell colSpan={allYearsData.length + 1} sx={{ borderBottom: 'none' }} />
                          </TableRow>

                          {/* Operating Expenses */}
                          <TableRow sx={{ bgcolor: 'error.main' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>CHARGES D'EXPLOITATION</Typography>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Achats consommés</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'achats_consommes'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Services extérieurs</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'services_exterieurs'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Impôts et taxes</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'impots_taxes'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Charges de personnel</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'charges_personnel'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Dotations aux amortissements</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'dotations_amortissements'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Autres charges</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'autres_charges'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Operating Result */}
                          <TableRow sx={{ bgcolor: 'grey.200', borderTop: '2px solid', borderColor: 'grey.400' }}>
                            <TableCell><strong>RÉSULTAT D'EXPLOITATION</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                {formatCurrency(getNumericValue(yearData, 'resultat_exploitation'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Spacer */}
                          <TableRow sx={{ height: 10 }}>
                            <TableCell colSpan={allYearsData.length + 1} sx={{ borderBottom: 'none' }} />
                          </TableRow>

                          {/* Financial Items */}
                          <TableRow sx={{ bgcolor: 'warning.main' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>RÉSULTAT FINANCIER</Typography>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Produits financiers</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'produits_financiers'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Charges financières</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'charges_financieres'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell><strong>Résultat Financier</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(
                                  getNumericValue(yearData, 'resultat_financier') ||
                                  (getNumericValue(yearData, 'produits_financiers') - getNumericValue(yearData, 'charges_financieres'))
                                )}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Spacer */}
                          <TableRow sx={{ height: 10 }}>
                            <TableCell colSpan={allYearsData.length + 1} sx={{ borderBottom: 'none' }} />
                          </TableRow>

                          {/* Pre-tax Result */}
                          <TableRow sx={{ bgcolor: 'grey.200' }}>
                            <TableCell><strong>RÉSULTAT AVANT IMPÔT</strong></TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(
                                  getNumericValue(yearData, 'resultat_avant_impot') ||
                                  (getNumericValue(yearData, 'resultat_exploitation') +
                                   (getNumericValue(yearData, 'produits_financiers') - getNumericValue(yearData, 'charges_financieres')))
                                )}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Tax */}
                          <TableRow>
                            <TableCell>Impôt sur les bénéfices</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'impot_benefices'))}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Net Result */}
                          <TableRow sx={{ bgcolor: 'primary.main', borderTop: '3px solid', borderColor: 'grey.600' }}>
                            <TableCell>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>RÉSULTAT NET</Typography>
                            </TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                <Typography variant="body2" sx={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                                  {formatCurrency(getNumericValue(yearData, 'resultat_net'))}
                                </Typography>
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Spacer */}
                          <TableRow sx={{ height: 10 }}>
                            <TableCell colSpan={allYearsData.length + 1} sx={{ borderBottom: 'none' }} />
                          </TableRow>

                          {/* Additional Metrics */}
                          <TableRow sx={{ bgcolor: 'info.light' }}>
                            <TableCell colSpan={allYearsData.length + 1}>
                              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>INDICATEURS COMPLÉMENTAIRES</Typography>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>EBITDA</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(
                                  getNumericValue(yearData, 'ebitda') ||
                                  (getNumericValue(yearData, 'resultat_exploitation') + getNumericValue(yearData, 'dotations_amortissements'))
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Valeur ajoutée</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'valeur_ajoutee'))}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell>Excédent brut d'exploitation (EBE)</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => (
                              <TableCell key={year} align="right">
                                {formatCurrency(getNumericValue(yearData, 'excedent_brut_exploitation'))}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aucune donnée financière disponible
            </Typography>
          )}
        </TabPanel>

        {/* Tab 3: Ratios Summary */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Évolution des Ratios Financiers
          </Typography>

          {allYearsData.length > 0 ? (
            <Grid container spacing={3}>
              {/* Liquidity Ratios */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}>💧</Avatar>
                      Ratios de Liquidité
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Ratio</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                            <TableCell align="right"><strong>Norme</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Liquidité Générale</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.currentRatio || 'N/A'}</TableCell>
                              );
                            })}
                            <TableCell align="right">≥ 1.5</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Profitability Ratios */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>📈</Avatar>
                      Ratios de Rentabilité
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Ratio</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                            <TableCell align="right"><strong>Norme</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Marge Nette</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.netMargin || 'N/A'}%</TableCell>
                              );
                            })}
                            <TableCell align="right">≥ 5%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>ROA</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.roa || 'N/A'}%</TableCell>
                              );
                            })}
                            <TableCell align="right">≥ 8%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Leverage Ratios */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>⚖️</Avatar>
                      Ratios d'Endettement
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Ratio</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                            <TableCell align="right"><strong>Norme</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Dette / Capitaux Propres</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.debtToEquity || 'N/A'}</TableCell>
                              );
                            })}
                            <TableCell align="right">≤ 1.0</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Autonomie Financière</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.equityRatio || 'N/A'}%</TableCell>
                              );
                            })}
                            <TableCell align="right">≥ 30%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Efficiency Ratios */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>⚡</Avatar>
                      Ratios d'Efficacité
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Ratio</strong></TableCell>
                            {allYearsData.map(({ year }) => (
                              <TableCell key={year} align="right"><strong>{year}</strong></TableCell>
                            ))}
                            <TableCell align="right"><strong>Norme</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Rotation des Actifs</TableCell>
                            {allYearsData.map(({ year, data: yearData }) => {
                              const ratios = calculateRatios(yearData);
                              return (
                                <TableCell key={year} align="right">{ratios?.assetTurnover || 'N/A'}</TableCell>
                              );
                            })}
                            <TableCell align="right">≥ 1.0</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Impossible de calculer les ratios - données financières manquantes
            </Typography>
          )}
        </TabPanel>

        {/* Tab 4: Scoring Summary */}
        <TabPanel value={activeTab} index={4}>
          <Typography variant="h6" gutterBottom>
            Résumé du Scoring de Crédit
          </Typography>

          <Grid container spacing={3}>
            {/* Overall Score */}
            <Grid item xs={12}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <CardContent>
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Avatar sx={{ width: 100, height: 100, mx: 'auto', mb: 2, bgcolor: 'white', color: 'primary.main' }}>
                      <Typography variant="h3" sx={{ fontWeight: 700 }}>
                        {overallScore}
                      </Typography>
                    </Avatar>
                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                      Score Global
                    </Typography>
                    <Chip
                      label={getRiskLevel(overallScore).label}
                      color={getRiskLevel(overallScore).color}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Financial Score */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
                      <BarChartIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {financialScore}
                    </Typography>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Score Financier
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={financialScore}
                      color={getProgressColor(financialScore)}
                      sx={{ mt: 2, height: 10, borderRadius: 5 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Basé sur les ratios SYSCOHADA et l'analyse des tendances financières
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Analyst Score */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'secondary.main' }}>
                      <StarIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main' }}>
                      {analystScore}
                    </Typography>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Score Analyste
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={analystScore}
                      color={getProgressColor(analystScore)}
                      sx={{ mt: 2, height: 10, borderRadius: 5 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Évaluation qualitative de l'analyste crédit
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Financial Score Breakdown */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    Détail du Score Financier
                  </Typography>

                  <Grid container spacing={2}>
                    {/* Liquidity */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card variant="outlined" sx={{ bgcolor: 'info.50', borderColor: 'info.main' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32, mr: 1 }}>💧</Avatar>
                            <Typography variant="subtitle2" fontWeight={600}>Liquidité</Typography>
                          </Box>
                          <Typography variant="h4" color="info.main" sx={{ fontWeight: 700, mb: 1 }}>
                            85<Typography component="span" variant="h6" color="text.secondary">/100</Typography>
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={85}
                            color="info"
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Pondération: 25%
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" display="block">
                            • Liquidité générale: Excellent
                          </Typography>
                          <Typography variant="caption" display="block">
                            • Liquidité réduite: Excellent
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Profitability */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card variant="outlined" sx={{ bgcolor: 'success.50', borderColor: 'success.main' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32, mr: 1 }}>📈</Avatar>
                            <Typography variant="subtitle2" fontWeight={600}>Rentabilité</Typography>
                          </Box>
                          <Typography variant="h4" color="success.main" sx={{ fontWeight: 700, mb: 1 }}>
                            70<Typography component="span" variant="h6" color="text.secondary">/100</Typography>
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={70}
                            color="success"
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Pondération: 30%
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" display="block">
                            • Marge nette: Bon
                          </Typography>
                          <Typography variant="caption" display="block">
                            • ROA: Bon
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Leverage */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card variant="outlined" sx={{ bgcolor: 'warning.50', borderColor: 'warning.main' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32, mr: 1 }}>⚖️</Avatar>
                            <Typography variant="subtitle2" fontWeight={600}>Endettement</Typography>
                          </Box>
                          <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700, mb: 1 }}>
                            90<Typography component="span" variant="h6" color="text.secondary">/100</Typography>
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={90}
                            color="warning"
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Pondération: 25%
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" display="block">
                            • Dette/Capitaux propres: Excellent
                          </Typography>
                          <Typography variant="caption" display="block">
                            • Autonomie financière: Excellent
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Efficiency */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card variant="outlined" sx={{ bgcolor: 'primary.50', borderColor: 'primary.main' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mr: 1 }}>⚡</Avatar>
                            <Typography variant="subtitle2" fontWeight={600}>Efficacité</Typography>
                          </Box>
                          <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700, mb: 1 }}>
                            85<Typography component="span" variant="h6" color="text.secondary">/100</Typography>
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={85}
                            color="primary"
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Pondération: 20%
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" display="block">
                            • Rotation des actifs: Bon
                          </Typography>
                          <Typography variant="caption" display="block">
                            • Utilisation des ressources: Bon
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Score Calculation Summary */}
                  <Card variant="outlined" sx={{ mt: 3, bgcolor: 'grey.50' }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Calcul du Score Financier
                      </Typography>
                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Catégorie</strong></TableCell>
                              <TableCell align="center"><strong>Score</strong></TableCell>
                              <TableCell align="center"><strong>Pondération</strong></TableCell>
                              <TableCell align="right"><strong>Contribution</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>Liquidité</TableCell>
                              <TableCell align="center">85/100</TableCell>
                              <TableCell align="center">25%</TableCell>
                              <TableCell align="right">{(85 * 0.25).toFixed(1)} pts</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Rentabilité</TableCell>
                              <TableCell align="center">70/100</TableCell>
                              <TableCell align="center">30%</TableCell>
                              <TableCell align="right">{(70 * 0.30).toFixed(1)} pts</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Endettement</TableCell>
                              <TableCell align="center">90/100</TableCell>
                              <TableCell align="center">25%</TableCell>
                              <TableCell align="right">{(90 * 0.25).toFixed(1)} pts</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Efficacité</TableCell>
                              <TableCell align="center">85/100</TableCell>
                              <TableCell align="center">20%</TableCell>
                              <TableCell align="right">{(85 * 0.20).toFixed(1)} pts</TableCell>
                            </TableRow>
                            <TableRow sx={{ bgcolor: 'primary.main' }}>
                              <TableCell colSpan={3}>
                                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                                  SCORE FINANCIER TOTAL
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                                  {financialScore}/100
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Note:</strong> Le score inclut un ajustement basé sur l'analyse des tendances financières multi-années.
                          Les ratios sont évalués selon les normes SYSCOHADA et les benchmarks du secteur UEMOA.
                        </Typography>
                      </Alert>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </Grid>

            {/* Analysis & Recommendations */}
            {(preliminaryAnalysis?.overallAnalysis || preliminaryAnalysis?.recommendations) && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Analyse et Recommandations
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {preliminaryAnalysis.overallAnalysis && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Analyse Globale
                        </Typography>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: 'grey.50',
                            '& p': { margin: '0 0 0.5em 0' },
                            '& p:last-child': { marginBottom: 0 },
                            '& ul, & ol': { marginTop: 0, marginBottom: '0.5em' },
                            '& li': { marginBottom: '0.25em' }
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: '0.875rem',
                              lineHeight: 1.43,
                              color: 'text.primary'
                            }}
                            dangerouslySetInnerHTML={{ __html: preliminaryAnalysis.overallAnalysis || '' }}
                          />
                        </Paper>
                      </Box>
                    )}

                    {preliminaryAnalysis.recommendations && (
                      <Box>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Recommandations
                        </Typography>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: 'grey.50',
                            '& p': { margin: '0 0 0.5em 0' },
                            '& p:last-child': { marginBottom: 0 },
                            '& ul, & ol': { marginTop: 0, marginBottom: '0.5em' },
                            '& li': { marginBottom: '0.25em' }
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: '0.875rem',
                              lineHeight: 1.43,
                              color: 'text.primary'
                            }}
                            dangerouslySetInnerHTML={{ __html: preliminaryAnalysis.recommendations || '' }}
                          />
                        </Paper>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Comments from Workflow Steps */}
            {workflow?.steps && workflow.steps.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Commentaires
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {workflow.steps
                      .filter(step => step.comments && step.comments.trim() !== '')
                      .map((step, index) => {
                        const stepName = step.stepName === 'application_created' ? 'Application créée' :
                                       step.stepName === 'credit_analysis' ? 'Analyse crédit' :
                                       step.stepName;

                        return (
                          <Box key={index} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Chip
                                label={stepName}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              {step.completedAt && (
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(step.completedAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                              )}
                            </Box>
                            <Paper
                              sx={{
                                p: 2,
                                bgcolor: 'grey.50',
                                border: '1px solid',
                                borderColor: 'grey.200',
                                '& p': { margin: '0 0 0.5em 0' },
                                '& p:last-child': { marginBottom: 0 },
                                '& ul, & ol': { marginTop: 0, marginBottom: '0.5em' },
                                '& li': { marginBottom: '0.25em' }
                              }}
                            >
                              <Box
                                sx={{
                                  fontSize: '0.875rem',
                                  lineHeight: 1.43,
                                  color: 'text.primary'
                                }}
                                dangerouslySetInnerHTML={{ __html: step.comments || '' }}
                              />
                            </Paper>
                          </Box>
                        );
                      })}

                    {workflow.steps.filter(step => step.comments && step.comments.trim() !== '').length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Aucun commentaire disponible
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Tab 5: Documents */}
        <TabPanel value={activeTab} index={5}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => uploadDocuments(e.target.files)}
          />

          {/* Header row: title + upload button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Documents justificatifs</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={docsUploading ? <CircularProgress size={14} /> : <DownloadIcon sx={{ transform: 'rotate(180deg)' }} />}
              disabled={docsUploading}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderRadius: 6, textTransform: 'none', fontSize: '13px', px: 2 }}
            >
              {docsUploading ? 'Envoi…' : 'Ajouter des fichiers'}
            </Button>
          </Box>

          {docsUploadError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDocsUploadError(null)}>
              {docsUploadError}
            </Alert>
          )}

          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : documents.length === 0 ? (
            <Alert severity="info">
              Aucun document joint à cette demande. Cliquez sur « Ajouter des fichiers » pour en téléverser.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Nom du fichier</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Catégorie</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Taille</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Ajouté par</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Date</TableCell>
                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => {
                    const ext = doc.filename?.split('.').pop()?.toLowerCase() || '';
                    const canPreview = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
                    const sizeKb = doc.fileSize ? (doc.fileSize / 1024).toFixed(0) : '?';
                    return (
                      <TableRow key={doc.id} sx={{ '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' }, borderBottom: '1px solid #f1f5f9' }}>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FileIcon sx={{ fontSize: 16, color: '#9ca3af' }} />
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '13px' }}>{doc.filename}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip label={doc.category || 'OTHER'} size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                        </TableCell>
                        <TableCell sx={{ py: 1.5, color: '#6b7280', fontSize: '13px' }}>{sizeKb} Ko</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13px' }}>{doc.uploader?.name || '—'}</TableCell>
                        <TableCell sx={{ py: 1.5, color: '#6b7280', fontSize: '13px' }}>
                          {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            {canPreview ? (
                              <Tooltip title="Prévisualiser">
                                <IconButton size="small" color="primary" onClick={() => openPreview(doc)}>
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Aperçu non disponible pour ce type de fichier">
                                <span>
                                  <IconButton size="small" disabled>
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            <Tooltip title="Télécharger">
                              <IconButton size="small" onClick={() => downloadDoc(doc)}>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </DialogContent>

      {/* Document Preview Modal */}
      <Dialog
        open={Boolean(previewDoc)}
        onClose={closePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>{previewDoc?.filename}</Typography>
          </Box>
          <IconButton size="small" onClick={closePreview}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {previewLoading && <CircularProgress />}

          {!previewLoading && previewBlobUrl && (() => {
            const ext = previewDoc?.filename?.split('.').pop()?.toLowerCase() || '';
            if (['png', 'jpg', 'jpeg'].includes(ext)) {
              return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', bgcolor: '#111', p: 2 }}>
                  <img src={previewBlobUrl} alt={previewDoc?.filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </Box>
              );
            }
            if (ext === 'pdf') {
              // Chrome blocks blob: URLs in <iframe> for PDFs — use <embed> instead
              return (
                <embed
                  src={previewBlobUrl}
                  type="application/pdf"
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                />
              );
            }
            // Office docs (docx, xlsx, etc.) can't be previewed in-browser
            return (
              <Box sx={{ textAlign: 'center', p: 4, maxWidth: 400 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  L'aperçu n'est pas disponible pour les fichiers <strong>.{ext}</strong>.<br />
                  Téléchargez le document pour l'ouvrir avec l'application appropriée.
                </Typography>
                <Button variant="outlined" size="small" onClick={() => downloadDoc(previewDoc)}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontSize: '13px' }}>
                  Télécharger le fichier
                </Button>
              </Box>
            );
          })()}

          {!previewLoading && (previewError || (!previewBlobUrl && previewDoc)) && (
            <Box sx={{ textAlign: 'center', p: 4, maxWidth: 400 }}>
              <Typography variant="body2" color="error" sx={{ mb: 1, fontWeight: 600 }}>
                Aperçu indisponible
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                {previewError || 'Impossible de charger ce document.'}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => previewDoc && downloadDoc(previewDoc)}
                sx={{ borderRadius: '10px', textTransform: 'none', fontSize: '13px' }}
              >
                Télécharger le fichier
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Barre d'action Apple-style ─────────────────────────────────── */}
      <DialogActions
        sx={{
          px: 2.5, py: 1.5,
          borderTop: '1px solid rgba(0,0,0,0.07)',
          bgcolor: '#fafafa',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          minHeight: 56,
        }}
      >
        {/* Feedback compact */}
        {submitSuccess && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: '12px' }}>
              {submitSuccess}
            </Typography>
          </Box>
        )}
        {submitError && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, fontSize: '12px' }}>
              {submitError}
            </Typography>
          </Box>
        )}

        {/* Zone d'approbation compacte */}
        {canApprove() && !submitSuccess && (
          <>
            <TextField
              placeholder="Commentaire (optionnel)"
              size="small"
              multiline
              minRows={1}
              maxRows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={submitting}
              sx={{
                flex: 1, minWidth: { xs: '100%', sm: 200 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px', fontSize: '13px',
                  bgcolor: 'white',
                },
              }}
            />
            {isActionAllowed('reject') && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={submitting ? <CircularProgress size={13} /> : <RejectIcon sx={{ fontSize: 14 }} />}
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'REJECTED' })}
              disabled={submitting}
              sx={{
                borderRadius: '10px', px: 2, fontSize: '13px', fontWeight: 600,
                textTransform: 'none', whiteSpace: 'nowrap',
              }}
            >
              Rejeter
            </Button>
            )}
            {isActionAllowed('approve') && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={submitting ? <CircularProgress size={13} /> : <ApproveIcon sx={{ fontSize: 14 }} />}
              onClick={() => setOtpDialog({ open: true, pendingDecision: 'APPROVED' })}
              disabled={submitting}
              sx={{
                borderRadius: '10px', px: 2, fontSize: '13px', fontWeight: 600,
                textTransform: 'none', whiteSpace: 'nowrap',
                boxShadow: 'none', '&:hover': { boxShadow: 'none' },
              }}
            >
              Approuver
            </Button>
            )}
          </>
        )}

        {/* Fermer toujours visible à droite */}
        {!canApprove() && !submitSuccess && !submitError && <Box sx={{ flex: 1 }} />}
        <Button
          onClick={onClose}
          disabled={submitting}
          size="small"
          sx={{
            borderRadius: '10px', px: 2, fontSize: '13px',
            textTransform: 'none', color: '#636366',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
          }}
        >
          Fermer
        </Button>
      </DialogActions>

      {/* OTP Verification */}
      <OtpVerificationDialog
        open={otpDialog.open}
        actionLabel={otpDialog.pendingDecision === 'APPROVED' ? 'Approuver la demande' : 'Rejeter la demande'}
        purpose={otpDialog.pendingDecision === 'APPROVED' ? 'approve_credit' : 'reject_credit'}
        onClose={() => setOtpDialog({ open: false, pendingDecision: null })}
        onVerified={async () => {
          if (otpDialog.pendingDecision) {
            await handleApproval(otpDialog.pendingDecision);
          }
        }}
      />
    </Dialog>
  );
};
