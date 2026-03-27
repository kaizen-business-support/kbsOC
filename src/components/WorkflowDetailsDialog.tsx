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
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon,
  Star as StarIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  FolderOpen as FolderIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon
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
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const getApiBase = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const apiPort = process.env.REACT_APP_API_PORT || '5007';
    return `${protocol}//${hostname}:${apiPort}/api`;
  };

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
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
  }, [previewBlobUrl]);

  useEffect(() => {
    if (activeTab === 5 && workflow?.applicationId) {
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
  const preliminaryAnalysis = analysisResults?.preliminaryAnalysis || {};

  // Get scores
  const overallScore = preliminaryAnalysis?.overallScore || application?.overallScore || 0;
  const financialScore = preliminaryAnalysis?.financialScore || application?.financialScore || 0;
  const analystScore = preliminaryAnalysis?.analystScore || application?.analystScore || 0;

  // Get financial data for all years (sorted from oldest to newest)
  const years = Object.keys(financialData).map(Number).sort((a, b) => a - b);
  const latestYear = years[years.length - 1];

  // Resolve year data: handle both nested {multiyear_data.N.data} and flat {field: value} formats
  const resolveYearData = (entry: any): any | null => {
    if (!entry) return null;
    // New format (after fix): { multiyear_data: { N: { data: {...} } } }
    if (entry?.multiyear_data?.N?.data) return entry.multiyear_data.N.data;
    // Old flat format: { chiffre_affaires: ..., total_actif: ... }
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
    const totalActif = actifImmobilise + actifCirculant + tresorerieActif;

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

    const totalActif = computeBalanceTotals(yearData).totalActif;
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
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#1f4e79' }}>
              {workflow.clientName}
            </Typography>
            <Chip
              label={statusDisplay.label}
              color={statusDisplay.color}
              size="small"
            />
          </Box>
          <IconButton size="small" onClick={onClose}
            sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' } }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {workflow.applicationNumber}
        </Typography>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Workflow" icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label="Détails de la Demande" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Données Financières" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Ratios" icon={<BarChartIcon />} iconPosition="start" />
          <Tab label="Scoring" icon={<StarIcon />} iconPosition="start" />
          <Tab label="Documents" icon={<FolderIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <DialogContent>
        {/* Tab 0: Workflow Timeline */}
        <TabPanel value={activeTab} index={0}>
          {workflow.steps && workflow.steps.length > 0 ? (
            <WorkflowTimeline workflow={workflow} />
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom>
                Workflow en cours d'initialisation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Les données du workflow sont en cours de chargement ou ne sont pas encore disponibles.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Tab 1: Application Details */}
        <TabPanel value={activeTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Informations sur la Demande de Crédit
          </Typography>

          <Grid container spacing={3}>
            {/* Client Information */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Informations Client
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={5}>
                      <Typography variant="body2" color="text.secondary">Nom du Client:</Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="body2" fontWeight={600}>{workflow.clientName}</Typography>
                    </Grid>

                    <Grid item xs={5}>
                      <Typography variant="body2" color="text.secondary">Chargé de Compte:</Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="body2">{application?.accountManager || application?.creator?.name || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Credit Request Details */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Détails de la Demande
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={5}>
                      <Typography variant="body2" color="text.secondary">Montant Demandé:</Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="body2" fontWeight={600} color="primary">
                        {formatCurrency(application?.amount || 0)}
                      </Typography>
                    </Grid>

                    <Grid item xs={5}>
                      <Typography variant="body2" color="text.secondary">Durée:</Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="body2">
                        {(application?.durationMonths || application?.duration)
                          ? `${application?.durationMonths || application?.duration} mois`
                          : 'Non spécifié'}
                      </Typography>
                    </Grid>

                    <Grid item xs={5}>
                      <Typography variant="body2" color="text.secondary">Type de Crédit:</Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="body2">{application?.creditType?.name || 'Non spécifié'}</Typography>
                    </Grid>

                    {application?.proposedRate && (
                      <>
                        <Grid item xs={5}>
                          <Typography variant="body2" color="text.secondary">Taux Proposé:</Typography>
                        </Grid>
                        <Grid item xs={7}>
                          <Typography variant="body2" fontWeight={600}>{application?.proposedRate}%</Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Purpose */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Objet de la Demande
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2">{application?.purpose || 'Non spécifié'}</Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Collateral & Repayment */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Garanties et Remboursement
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Type de Garantie:</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">{application?.collateralType || 'Non spécifié'}</Typography>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Valeur de la Garantie:</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" fontWeight={600}>
                        {application?.collateralValue ? formatCurrency(application.collateralValue) : 'Non spécifié'}
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="text.secondary">Échéancier:</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">{application?.repaymentSchedule || 'Non spécifié'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Comments from Account Manager and Workflow */}
            {workflow?.steps && workflow.steps.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Commentaires
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {workflow.steps
                      .filter(step => step.comments && step.comments.trim() !== '')
                      .map((step, index) => {
                        const stepName = step.stepName === 'application_created' ? 'Application créée' :
                                       step.stepName === 'credit_analysis' ? 'Analyse crédit' :
                                       step.stepName === 'branch_manager_review' ? 'Révision directeur' :
                                       step.stepName === 'credit_committee_review' ? 'Comité de crédit' :
                                       step.stepName === 'final_decision' ? 'Décision finale' :
                                       step.stepName;

                        return (
                          <Box key={index} sx={{ mb: index < workflow.steps.filter(s => s.comments && s.comments.trim() !== '').length - 1 ? 2 : 0 }}>
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

            {/* Application Dates */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Dates Importantes
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Date de Création:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        {application?.createdAt ? new Date(application.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </Typography>
                    </Grid>

                    {application?.submittedAt && (
                      <>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Date de Soumission:</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2">
                            {new Date(application.submittedAt).toLocaleDateString('fr-FR')}
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Status */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Statut de la Demande
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={application?.status?.toUpperCase() || 'INCONNU'}
                      color={statusDisplay.color}
                      size="medium"
                      sx={{ fontWeight: 600 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Numéro: {workflow.applicationNumber}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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
                            <TableContainer>
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
                            <TableContainer>
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

                    <TableContainer>
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

                    <TableContainer>
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
                    <TableContainer>
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
                    <TableContainer>
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
                    <TableContainer>
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
                    <TableContainer>
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
                      <TableContainer>
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

            {/* Financial Summary — displayed just before preliminary analysis */}
            {allYearsData.length > 0 && (() => {
              const latest = allYearsData[allYearsData.length - 1];
              const prev   = allYearsData.length >= 2 ? allYearsData[allYearsData.length - 2] : null;

              const ca      = getNumericValue(latest.data, 'chiffre_affaires');
              const rn      = getNumericValue(latest.data, 'resultat_net');
              const ta      = getNumericValue(latest.data, 'total_actif') || computeBalanceTotals(latest.data).totalActif;
              const cp      = getNumericValue(latest.data, 'capitaux_propres');
              const df      = getNumericValue(latest.data, 'dettes_financieres');
              const stocks  = getNumericValue(latest.data, 'stocks');
              const creances = getNumericValue(latest.data, 'creances_clients');
              const detteFourn = getNumericValue(latest.data, 'dettes_fournisseurs');
              const tresoActif = getNumericValue(latest.data, 'tresorerie_actif') || getNumericValue(latest.data, 'tresorerie');

              const marge   = ca > 0 ? ((rn / ca) * 100) : 0;
              const roa     = ta > 0 ? ((rn / ta) * 100) : 0;
              const dte     = cp > 0 ? (df / cp) : 0;
              const lcr     = detteFourn > 0 ? ((stocks + creances + tresoActif) / detteFourn) : 0;

              const prevCa  = prev ? getNumericValue(prev.data, 'chiffre_affaires') : 0;
              const caGrowth = (prevCa > 0 && ca > 0) ? ((ca - prevCa) / prevCa * 100) : null;
              const prevRn  = prev ? getNumericValue(prev.data, 'resultat_net') : 0;

              const kpi = (value: number, good: number, warn: number, rev = false): 'success' | 'warning' | 'error' => {
                const ok = rev ? value <= good : value >= good;
                const mid = rev ? value <= warn : value >= warn;
                return ok ? 'success' : mid ? 'warning' : 'error';
              };

              const dot = (color: 'success' | 'warning' | 'error') => ({
                success: '#22c55e', warning: '#f59e0b', error: '#ef4444'
              }[color]);

              return (
                <Grid item xs={12}>
                  <Card sx={{
                    border: '2px solid #e0e7ff',
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
                  }}>
                    <CardContent sx={{ pb: '16px !important' }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 4, height: 24, bgcolor: '#3b82f6', borderRadius: 1 }} />
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.95rem' }}>
                            Synthèse Financière — Données de Référence
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip label={`Exercice ${latest.year}`} size="small"
                            sx={{ fontWeight: 600, bgcolor: '#1d4ed8', color: 'white', fontSize: '0.7rem' }} />
                          {allYearsData.length > 1 && (
                            <Chip label={`${allYearsData.length} exercices analysés`} size="small" variant="outlined"
                              sx={{ fontWeight: 500, borderColor: '#93c5fd', color: '#1d4ed8', fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      </Box>

                      {/* KPI Row */}
                      <Grid container spacing={1.5} sx={{ mb: 2 }}>
                        {[
                          {
                            label: 'Chiffre d\'Affaires', value: formatCurrency(ca),
                            sub: caGrowth !== null ? `${caGrowth >= 0 ? '+' : ''}${caGrowth.toFixed(1)}% vs N-1` : `Exercice ${latest.year}`,
                            subColor: caGrowth !== null ? (caGrowth >= 0 ? '#16a34a' : '#dc2626') : '#6b7280',
                            color: '#1d4ed8', bg: '#eff6ff',
                          },
                          {
                            label: 'Résultat Net', value: formatCurrency(rn),
                            sub: `Marge ${marge.toFixed(1)}%`,
                            subColor: marge >= 5 ? '#16a34a' : marge >= 2 ? '#d97706' : '#dc2626',
                            color: rn >= 0 ? '#15803d' : '#dc2626', bg: rn >= 0 ? '#f0fdf4' : '#fef2f2',
                          },
                          {
                            label: 'Total Actif', value: formatCurrency(ta),
                            sub: `Fonds propres ${formatCurrency(cp)}`,
                            subColor: '#6b7280',
                            color: '#7c3aed', bg: '#faf5ff',
                          },
                          {
                            label: 'Dettes Financières', value: formatCurrency(df),
                            sub: `Ratio D/CP : ${dte.toFixed(2)}x`,
                            subColor: dte <= 1.5 ? '#16a34a' : dte <= 3 ? '#d97706' : '#dc2626',
                            color: dte <= 1.5 ? '#15803d' : dte <= 3 ? '#b45309' : '#dc2626',
                            bg: dte <= 1.5 ? '#f0fdf4' : dte <= 3 ? '#fffbeb' : '#fef2f2',
                          },
                        ].map((k, i) => (
                          <Grid item xs={6} md={3} key={i}>
                            <Box sx={{
                              p: 1.5, borderRadius: 2, bgcolor: k.bg,
                              border: '1px solid', borderColor: k.bg === '#eff6ff' ? '#bfdbfe' :
                                k.bg === '#f0fdf4' ? '#bbf7d0' : k.bg === '#faf5ff' ? '#ddd6fe' :
                                k.bg === '#fef2f2' ? '#fecaca' : '#fde68a',
                              height: '100%',
                            }}>
                              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 500, display: 'block', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {k.label}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: k.color, fontSize: '0.82rem', lineHeight: 1.2, mb: 0.5 }}>
                                {k.value}
                              </Typography>
                              <Typography variant="caption" sx={{ color: k.subColor, fontWeight: 500, fontSize: '0.68rem' }}>
                                {k.sub}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>

                      {/* Ratios rapides */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: allYearsData.length > 1 ? 2 : 0 }}>
                        {[
                          { label: 'Liquidité générale', val: lcr.toFixed(2) + 'x', color: kpi(lcr, 1.5, 1.0) },
                          { label: 'Marge nette', val: marge.toFixed(1) + '%', color: kpi(marge, 5, 2) },
                          { label: 'ROA', val: roa.toFixed(1) + '%', color: kpi(roa, 5, 2) },
                          { label: 'Levier D/CP', val: dte.toFixed(2) + 'x', color: kpi(dte, 1.5, 3, true) },
                          ...(latest.ratios?.revenueGrowth !== undefined ? [{
                            label: 'Croissance CA',
                            val: (latest.ratios.revenueGrowth >= 0 ? '+' : '') + Number(latest.ratios.revenueGrowth).toFixed(1) + '%',
                            color: kpi(Number(latest.ratios.revenueGrowth), 5, 0) as 'success' | 'warning' | 'error',
                          }] : []),
                        ].map((r, i) => (
                          <Box key={i} sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75,
                            px: 1.5, py: 0.5, borderRadius: 5,
                            bgcolor: 'white', border: '1px solid #e2e8f0',
                          }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot(r.color), flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ color: '#374151', fontSize: '0.72rem' }}>
                              {r.label}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: dot(r.color), fontSize: '0.72rem' }}>
                              {r.val}
                            </Typography>
                          </Box>
                        ))}
                      </Box>

                      {/* Évolution multi-années */}
                      {allYearsData.length > 1 && (
                        <Box sx={{ borderTop: '1px solid #e0e7ff', pt: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#1e3a5f', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.65rem' }}>
                            Évolution pluriannuelle
                          </Typography>
                          <TableContainer>
                            <Table size="small" sx={{ '& td, & th': { py: 0.5, px: 1, fontSize: '0.75rem', borderColor: '#e0e7ff' } }}>
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#e0e7ff' }}>
                                  <TableCell sx={{ fontWeight: 600, color: '#1e3a5f' }}>Indicateur</TableCell>
                                  {allYearsData.map(({ year }) => (
                                    <TableCell key={year} align="right" sx={{ fontWeight: 600, color: '#1e3a5f' }}>{year}</TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[
                                  { label: 'Chiffre d\'Affaires', field: 'chiffre_affaires', fmt: 'currency' },
                                  { label: 'Résultat Net', field: 'resultat_net', fmt: 'currency' },
                                  { label: 'Total Actif', field: 'total_actif', fmt: 'currency' },
                                  { label: 'Capitaux Propres', field: 'capitaux_propres', fmt: 'currency' },
                                ].map((row, i) => (
                                  <TableRow key={i} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f8faff' } }}>
                                    <TableCell sx={{ color: '#374151', fontWeight: 500 }}>{row.label}</TableCell>
                                    {allYearsData.map(({ year, data: yd }, yi) => {
                                      const v = row.field === 'total_actif'
                                        ? (getNumericValue(yd, 'total_actif') || computeBalanceTotals(yd).totalActif)
                                        : getNumericValue(yd, row.field);
                                      const prevV = yi > 0
                                        ? (row.field === 'total_actif'
                                          ? (getNumericValue(allYearsData[yi - 1].data, 'total_actif') || computeBalanceTotals(allYearsData[yi - 1].data).totalActif)
                                          : getNumericValue(allYearsData[yi - 1].data, row.field))
                                        : null;
                                      const growth = (prevV && prevV > 0) ? ((v - prevV) / prevV * 100) : null;
                                      return (
                                        <TableCell key={year} align="right">
                                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                                              {formatCurrency(v)}
                                            </Typography>
                                            {growth !== null && (
                                              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: growth >= 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                                                {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
                                              </Typography>
                                            )}
                                          </Box>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })()}

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
          <Typography variant="h6" gutterBottom>
            Documents justificatifs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cliquez sur l'icône œil pour prévisualiser un document (lecture seule — le téléchargement est désactivé).
          </Typography>

          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : documents.length === 0 ? (
            <Alert severity="info">Aucun document justificatif n'a été joint à cette demande.</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Nom du fichier</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Catégorie</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Taille</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Ajouté par</TableCell>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Date</TableCell>
                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>Aperçu</TableCell>
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
            return (
              <iframe
                src={previewBlobUrl}
                title={previewDoc?.filename}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            );
          })()}
          {!previewLoading && !previewBlobUrl && previewDoc && (
            <Alert severity="error" sx={{ m: 2 }}>Impossible de charger l'aperçu du document.</Alert>
          )}
        </DialogContent>
      </Dialog>

      <DialogActions sx={{ px: 3, py: 2, flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Success/Error Messages */}
        {submitSuccess && (
          <Alert severity="success" sx={{ mb: 2, width: '100%' }}>
            {submitSuccess}
          </Alert>
        )}
        {submitError && (
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {submitError}
          </Alert>
        )}

        {/* Approval Section - Only show if user can approve */}
        {canApprove() && !submitSuccess && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                Cette demande nécessite votre approbation
              </Typography>
              <Typography variant="body2">
                Veuillez examiner les détails de la demande et fournir votre décision.
              </Typography>
            </Alert>

            <TextField
              label="Commentaires (optionnel)"
              multiline
              rows={3}
              fullWidth
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ajoutez vos commentaires sur cette demande..."
              disabled={submitting}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={submitting ? <CircularProgress size={20} /> : <RejectIcon />}
                onClick={() => setOtpDialog({ open: true, pendingDecision: 'REJECTED' })}
                disabled={submitting}
                size="large"
              >
                Rejeter
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={submitting ? <CircularProgress size={20} /> : <ApproveIcon />}
                onClick={() => setOtpDialog({ open: true, pendingDecision: 'APPROVED' })}
                disabled={submitting}
                size="large"
              >
                Approuver
              </Button>
            </Box>
          </Box>
        )}

        {/* Close button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose} disabled={submitting}>
            Fermer
          </Button>
        </Box>
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
