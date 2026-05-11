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

        {/* Tab 1: Financier */}
        <TabPanel value={activeTab} index={1}>
          {/* Sélecteur d'années */}
          {years.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
              {years.map(year => (
                <Chip
                  key={year}
                  label={year}
                  size="small"
                  variant={selectedYears.length === 0 || selectedYears.includes(year) ? 'filled' : 'outlined'}
                  onClick={() => toggleYear(year)}
                  color={selectedYears.length === 0 || selectedYears.includes(year) ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}
                />
              ))}
            </Box>
          )}

          {allYearsData.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

              {/* ─── Bloc 1 : Grandes Masses du Bilan ───────────────────── */}
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
                          {filteredYearsData.map(({ year }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
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
                            {filteredYearsData.map(({ year, data }) => (
                              <TableCell key={year} align="right" sx={{ py: 0.5 }}>{formatCurrency(getNumericValue(data, field))}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'rgba(25,118,210,0.08)' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL ACTIF</TableCell>
                          <TableCell />
                          {filteredYearsData.map(({ year, data }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>
                              {formatCurrency(computeBalanceTotals(data).totalActif)}
                            </TableCell>
                          ))}
                        </TableRow>
                        {[
                          { label: 'Capitaux Propres',   field: 'capitaux_propres',   cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Dettes Financières', field: 'dettes_financieres',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Passif Circulant',   field: 'passif_circulant',   cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Trésorerie Passif',  field: 'tresorerie_passif',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                        ].map(({ label, field, cat, catColor, catText }) => (
                          <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                            <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <Chip label={cat} size="small" sx={{ height: 16, fontSize: '9px', fontWeight: 700, bgcolor: catColor, color: catText }} />
                            </TableCell>
                            {filteredYearsData.map(({ year, data }) => (
                              <TableCell key={year} align="right" sx={{ py: 0.5 }}>{formatCurrency(getNumericValue(data, field))}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'rgba(76,175,80,0.08)' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL PASSIF</TableCell>
                          <TableCell />
                          {filteredYearsData.map(({ year, data }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>
                              {formatCurrency(computeBalanceTotals(data).totalPassif)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* ─── Bloc 2 : Compte de Résultat ──────────────────────── */}
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
                          {filteredYearsData.map(({ year }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
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
                            {filteredYearsData.map(({ year, data }, i) => {
                              const val = getNumericValue(data, field);
                              const prevData = i > 0 ? filteredYearsData[i - 1].data : null;
                              const prevVal = prevData ? getNumericValue(prevData, field) : null;
                              const trend = prevVal !== null && prevVal !== 0
                                ? val > prevVal ? 'up' : val < prevVal ? 'down' : null
                                : null;
                              return (
                                <TableCell key={year} align="right" sx={{ py: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4 }}>
                                    <span>{formatCurrency(val)}</span>
                                    {trend === 'up' && <TrendingUpIcon sx={{ fontSize: 13, color: 'success.main' }} />}
                                    {trend === 'down' && <TrendingDownIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                                  </Box>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* ─── Bloc 3 : Ratios clés ─────────────────────────────── */}
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1, display: 'block', mb: 1 }}>
                  Ratios Clés (dernière année)
                </Typography>
                <Grid container spacing={1.5}>
                  {(() => {
                    const r = calculateRatios(latestYearData);
                    const cards = [
                      {
                        label: 'Liquidité Générale', value: r?.currentRatio ?? 'N/A', unit: 'x',
                        norm: '≥ 1.5', ok: parseFloat(r?.currentRatio || '0') >= 1.5,
                        icon: <WaterDropIcon sx={{ fontSize: 16 }} />, color: '#1976d2',
                      },
                      {
                        label: 'Marge Nette', value: r?.netMargin ?? 'N/A', unit: '%',
                        norm: '≥ 10 %', ok: parseFloat(r?.netMargin || '0') >= 10,
                        icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, color: '#388e3c',
                      },
                      {
                        label: 'Dette / Capitaux', value: r?.debtToEquity ?? 'N/A', unit: 'x',
                        norm: '≤ 1.0', ok: parseFloat(r?.debtToEquity || '99') <= 1,
                        icon: <BalanceIcon sx={{ fontSize: 16 }} />, color: '#f57c00',
                      },
                      {
                        label: 'Rotation Actif', value: r?.assetTurnover ?? 'N/A', unit: 'x',
                        norm: '≥ 1.0', ok: parseFloat(r?.assetTurnover || '0') >= 1,
                        icon: <AutorenewIcon sx={{ fontSize: 16 }} />, color: '#7b1fa2',
                      },
                    ];
                    return cards.map(card => (
                      <Grid item xs={6} md={3} key={card.label}>
                        <Card variant="outlined" sx={{
                          borderRadius: 2,
                          borderLeft: '3px solid',
                          borderLeftColor: card.value === 'N/A' ? 'grey.400' : card.ok ? 'success.main' : 'error.main',
                        }}>
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
                                <Chip
                                  label={card.ok ? 'OK' : 'Attention'}
                                  size="small"
                                  color={card.ok ? 'success' : 'warning'}
                                  sx={{ height: 16, fontSize: '9px', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ));
                  })()}
                </Grid>
              </Box>

              {/* ─── Bloc 4 : Scoring ─────────────────────────────────── */}
              {overallScore > 0 && (
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                        <Typography
                          variant="h2"
                          fontWeight={800}
                          sx={{
                            lineHeight: 1,
                            color: getProgressColor(overallScore) === 'success' ? '#2e7d32' :
                                   getProgressColor(overallScore) === 'warning' ? '#e65100' : '#c62828',
                          }}
                        >
                          {overallScore}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">/100</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>Score Global</Typography>
                          <Chip
                            label={getRiskLevel(overallScore).label}
                            color={getRiskLevel(overallScore).color}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={overallScore}
                          color={getProgressColor(overallScore)}
                          sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200', mb: 0.75 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Financier : {financialScore} · Analyste : {analystScore}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}

            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Aucune donnée financière disponible pour ce dossier.
            </Typography>
          )}
        </TabPanel>


        {/* Tab 2: Documents */}
        <TabPanel value={activeTab} index={2}>
          {/* Zone d'upload */}
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 2,
              bgcolor: 'grey.50',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              mb: 2,
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25,118,210,0.04)' },
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => uploadDocuments(e.target.files)}
            />
            {docsUploading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Téléversement en cours…</Typography>
              </Box>
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 32, color: 'grey.400', mb: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Glissez vos fichiers ici ou{' '}
                  <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>cliquez pour parcourir</Box>
                </Typography>
              </>
            )}
          </Box>

          {docsUploadError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setDocsUploadError(null)}>
              {docsUploadError}
            </Alert>
          )}

          {/* Liste des documents */}
          {docsLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <FolderIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Aucun document attaché à ce dossier.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {documents.map((doc: any) => {
                const ext = (doc.filename as string)?.split('.').pop()?.toLowerCase();
                const isPdf   = ext === 'pdf';
                const isImg   = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
                const isSheet = ['xlsx', 'xls', 'csv'].includes(ext || '');
                const IconComp = isPdf ? PictureAsPdfIcon : isImg ? ImageIcon : isSheet ? TableChartIcon : FileIcon;
                const iconColor = isPdf ? '#f44336' : isImg ? '#9c27b0' : isSheet ? '#4caf50' : '#1976d2';
                return (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 1.5, py: 1, borderRadius: 1.5,
                      border: '1px solid', borderColor: 'grey.100',
                      transition: 'all 0.1s',
                      '&:hover': { bgcolor: 'grey.50', borderColor: 'grey.200' },
                    }}
                  >
                    <IconComp sx={{ fontSize: 26, color: iconColor, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{doc.filename}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.size ? `${Math.round(doc.size / 1024)} Ko · ` : ''}
                        {doc.uploadedByName || doc.uploadedBy || ''}
                        {doc.createdAt
                          ? ` · ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}`
                          : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title="Aperçu">
                        <IconButton size="small" onClick={() => openPreview(doc)} sx={{ color: 'grey.600' }}>
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Télécharger">
                        <IconButton size="small" onClick={() => downloadDoc(doc)} sx={{ color: 'grey.600' }}>
                          <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
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
