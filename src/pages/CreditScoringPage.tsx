import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  LinearProgress,
  Chip,
  Avatar,
  Divider,
  Paper,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AnalysisIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  BarChart as BarChartIcon,
  AccountBalance as BankIcon,
  Business as BusinessIcon,
  FolderOpen as FolderOpenIcon,
  Send as SendIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { IndustryBenchmarking } from '../components/IndustryBenchmarking';
import { RichTextEditor } from '../components/RichTextEditor';
import { DocumentManager } from '../components/DocumentManager';
import { FinancialDataInputTabs } from '../components/FinancialDataInputTabs';
import { ApiService } from '../services/api';
import { Client, WorkflowTimestamps, WorkflowStep } from '../types';

// ─── Design tokens (alignés avec CreditApplicationPage) ──────────────────────
const BG_SC = '#f7f8fc';
const CARD_SHADOW_SC = '0 2px 24px rgba(0,0,0,0.07)';
const CARD_RADIUS_SC = 20;
const STEP_COLORS_SC = ['#1565c0', '#0277bd', '#00695c', '#4527a0'];

const SCORING_STEPS = [
  { label: 'Informations Client',   icon: BusinessIcon,   subtitle: 'Sélection et données client' },
  { label: 'Documents & Options',   icon: FolderOpenIcon, subtitle: 'Pièces justificatives & paramètres' },
  { label: 'Analyse Crédit',        icon: BarChartIcon,   subtitle: 'Scoring financier & évaluation' },
  { label: 'Révision & Soumission', icon: SendIcon,       subtitle: 'Récapitulatif & envoi' },
];

// ─── Indicateur d'étapes horizontal ───────────────────────────────────────────
const ScoringStepIndicator: React.FC<{
  activeStep: number; isStepComplete: (i: number) => boolean;
}> = ({ activeStep, isStepComplete }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 5, px: 1 }}>
    {SCORING_STEPS.map((step, i) => {
      const done = isStepComplete(i) && i < activeStep;
      const active = i === activeStep;
      const color = STEP_COLORS_SC[i];
      const Icon = step.icon;
      return (
        <React.Fragment key={i}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: done ? '#e8f5e9' : active ? color : '#f0f2f5',
              border: '2px solid',
              borderColor: done ? '#a5d6a7' : active ? color : 'transparent',
              boxShadow: active ? `0 4px 16px ${color}40` : 'none',
              transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {done
                ? <CheckCircleIcon sx={{ fontSize: 22, color: '#2e7d32' }} />
                : <Icon sx={{ fontSize: 20, color: active ? 'white' : '#94a3b8' }} />
              }
            </Box>
            <Typography variant="caption" sx={{
              mt: 0.75, fontWeight: active ? 700 : 500,
              color: active ? color : done ? '#2e7d32' : '#94a3b8',
              textAlign: 'center', lineHeight: 1.2,
              display: { xs: 'none', sm: 'block' },
              fontSize: '0.7rem', letterSpacing: 0.2,
            }}>
              {step.label}
            </Typography>
          </Box>
          {i < SCORING_STEPS.length - 1 && (
            <Box sx={{
              flex: 1, height: 2, mt: '23px', mx: 0.5,
              bgcolor: done ? '#a5d6a7' : '#e8ecf0',
              borderRadius: 1,
              transition: 'background-color 0.35s ease',
            }} />
          )}
        </React.Fragment>
      );
    })}
  </Box>
);

interface CreditScoringPageProps {
  onNavigate: (page: any) => void;
}

interface FinancialRatio {
  name: string;
  value: number;
  benchmark: number;
  weight: number;
  category: 'liquidity' | 'profitability' | 'leverage' | 'efficiency';
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

interface AnalystCriteria {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  comments: string;
}



export const CreditScoringPage: React.FC<CreditScoringPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Get applicationId from URL query params
  const searchParams = new URLSearchParams(location.search);
  const applicationId = searchParams.get('applicationId');

  // Redirect if arriving from ClientManagementPage "Analyse" tab via localStorage bridge
  useEffect(() => {
    const pendingId = localStorage.getItem('pending_scoring_app');
    if (pendingId && !applicationId) {
      localStorage.removeItem('pending_scoring_app');
      navigate(`/credit-scoring?applicationId=${pendingId}`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeStep, setActiveStep] = useState(applicationId ? 2 : 0); // Start at step 2 (Analyse Crédit) if applicationId present
  const [currentTab, setCurrentTab] = useState(0);
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);
  const [financialScore, setFinancialScore] = useState<number>(0);
  const [analystScore, setAnalystScore] = useState<number>(0);
  const [overallScore, setOverallScore] = useState<number>(0);
  const [financialWeight, setFinancialWeight] = useState<number>(() => {
    try { const v = localStorage.getItem('oc_w_financial'); return v ? Number(v) : 60; } catch { return 60; }
  });
  const [analystWeight, setAnalystWeight] = useState<number>(() => {
    try { const v = localStorage.getItem('oc_w_analyst'); return v ? Number(v) : 40; } catch { return 40; }
  });
  const [categoryWeights, setCategoryWeights] = useState<{ liquidity: number; profitability: number; leverage: number; efficiency: number }>(() => {
    try {
      const saved = localStorage.getItem('oc_scoring_category_weights');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { liquidity: 25, profitability: 30, leverage: 25, efficiency: 20 };
  });
  const [scoreBreakdown, setScoreBreakdown] = useState<{
    liquidity: number; profitability: number; leverage: number; efficiency: number;
    currentRatio: number; quickRatio: number; netMargin: number; roa: number;
    debtToEquity: number; equityRatio: number; assetTurnover: number;
    trendScore: number; trendAdjustment: number; baseScore: number;
  } | null>(null);
  const [overallAnalysis, setOverallAnalysis] = useState<string>('');
  const [recommendationsText, setRecommendationsText] = useState<string>('');
  const [isAnalystMode, setIsAnalystMode] = useState<boolean>(!!applicationId); // Track if we're in analyst mode
  const [loadingApplication, setLoadingApplication] = useState<boolean>(false);

  // Form data
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientType, setClientType] = useState('');
  const [sector, setSector] = useState('');
  const [amount, setAmount] = useState('');
  const [creditType, setCreditType] = useState('');
  const [duration, setDuration] = useState('');
  const [purpose, setPurpose] = useState('');
  const [analysisOptions, setAnalysisOptions] = useState({
    period: '3ans',
  });

  // Financial data state
  const [referenceYear] = useState<number>(new Date().getFullYear());
  const [numberOfYears] = useState<number>(3);
  const [financialData, setFinancialData] = useState<Record<number, any>>({});

  const handleDataInput = (year: number, data: any) => {
    setFinancialData(prev => ({ ...prev, [year]: data }));
  };

  // Persist scoring weights to localStorage
  useEffect(() => {
    localStorage.setItem('oc_scoring_category_weights', JSON.stringify(categoryWeights));
  }, [categoryWeights]);

  useEffect(() => {
    localStorage.setItem('oc_w_financial', String(financialWeight));
    localStorage.setItem('oc_w_analyst',   String(analystWeight));
  }, [financialWeight, analystWeight]);

  // Load application data when applicationId is present (analyst mode)
  useEffect(() => {
    const loadApplicationData = async () => {
      if (!applicationId) return;

      setLoadingApplication(true);
      try {
        // Fetch application details from API
        const response = await ApiService.getApplicationById(applicationId);
        if (response.success && response.data) {
          const app = response.data;

          // Pre-populate client information
          if (app.client) {
            setSelectedClient(app.client);
            setSelectedClientId(app.client.id);
            setSector(app.client.sector || '');
          }

          // Pre-populate credit request information
          setAmount(app.amount?.toString() || '');
          setDuration(app.duration?.toString() || '');
          setPurpose(app.purpose || '');
          setCreditType(app.creditType || '');

          // Load financial data from analysisResults
          if (app.analysisResults?.financialData) {
            console.log('Loading financial data from application:', app.analysisResults.financialData);
            setFinancialData(app.analysisResults.financialData);
          }

          // Load preliminary analysis if available
          if (app.analysisResults?.preliminaryAnalysis) {
            console.log('Loading preliminary analysis from application');
            setOverallAnalysis(app.analysisResults.preliminaryAnalysis);
          }
        }
      } catch (error) {
        console.error('Failed to load application:', error);
      } finally {
        setLoadingApplication(false);
      }
    };

    loadApplicationData();
  }, [applicationId]);

  // Timestamp tracking state
  const [workflowTimestamps, setWorkflowTimestamps] = useState<WorkflowTimestamps | null>(null);
  const [currentStepStartTime, setCurrentStepStartTime] = useState<string | null>(null);

  const steps = [
    'Informations Client',
    'Documents & Options',
    'Analyse Crédit',
    'Révision & Soumission'
  ];

  // Utility functions for timestamp management
  const generateApplicationId = () => {
    return `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateApplicationNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${month}${day}-${random}`;
  };

  const initializeWorkflowTracking = () => {
    if (!selectedClient) return;

    const now = new Date().toISOString();
    const applicationId = generateApplicationId();
    const applicationNumber = generateApplicationNumber();

    const initialWorkflow: WorkflowTimestamps = {
      applicationId,
      clientId: selectedClient.id,
      clientName: selectedClient.companyName,
      applicationNumber,
      requestedAmount: 0, // Will be updated when amount is set
      currency: 'XOF',
      totalStartedAt: now,
      currentStepId: 'application_created',
      steps: [{
        stepId: 'application_created',
        stepName: 'Application Créée',
        startedAt: now,
        userId: 'current-user', // In real app, get from auth context
        userName: 'Utilisateur Courant',
        userRole: 'account_manager',
        branch: 'Siège Social' // In real app, get from user context
      }],
      createdBy: 'current-user',
      createdByName: 'Utilisateur Courant',
      branch: 'Siège Social',
      status: 'in_progress'
    };

    setWorkflowTimestamps(initialWorkflow);
    setCurrentStepStartTime(now);
    
    // Save to localStorage for persistence
    localStorage.setItem(`workflow-${applicationId}`, JSON.stringify(initialWorkflow));
  };

  const completeCurrentStep = (stepIndex: number) => {
    if (!workflowTimestamps || !currentStepStartTime) return;

    const now = new Date().toISOString();
    const startTime = new Date(currentStepStartTime).getTime();
    const endTime = new Date(now).getTime();
    const duration = endTime - startTime;

    const updatedWorkflow = { ...workflowTimestamps };
    
    // Complete current step
    const currentStepData = updatedWorkflow.steps.find(step => step.stepId === `step-${stepIndex}`);
    if (currentStepData) {
      currentStepData.completedAt = now;
      currentStepData.duration = duration;
    }

    setWorkflowTimestamps(updatedWorkflow);
    localStorage.setItem(`workflow-${updatedWorkflow.applicationId}`, JSON.stringify(updatedWorkflow));
  };

  const startNextStep = (stepIndex: number) => {
    if (!workflowTimestamps) return;

    const now = new Date().toISOString();
    const updatedWorkflow = { ...workflowTimestamps };
    
    // Add next step
    updatedWorkflow.steps.push({
      stepId: 'credit_analysis',
      stepName: steps[stepIndex],
      startedAt: now,
      userId: 'current-user',
      userName: 'Utilisateur Courant',
      branch: 'Siège Social'
    });

    updatedWorkflow.currentStepId = 'credit_analysis'; // Move to next step

    setWorkflowTimestamps(updatedWorkflow);
    setCurrentStepStartTime(now);
    localStorage.setItem(`workflow-${updatedWorkflow.applicationId}`, JSON.stringify(updatedWorkflow));
  };

  const completeWorkflow = async () => {
    console.log('🔍 completeWorkflow called');
    console.log('  isAnalystMode:', isAnalystMode);
    console.log('  applicationId:', applicationId);
    console.log('  analystScore:', analystScore);
    console.log('  financialScore:', financialScore);
    console.log('  overallScore:', overallScore);

    // If in analyst mode (reviewing existing application)
    if (isAnalystMode && applicationId) {
      try {
        console.log('💾 Analyst mode: Updating existing application', applicationId);

        const updateData = {
          analystScore,
          financialScore,
          overallScore,
          overallAnalysis,
          recommendations: recommendationsText,
          status: 'under_review', // Update status to indicate analysis is complete
          analysisResults: {
            preliminaryAnalysis: {
              overallScore,
              financialScore,
              analystScore,
              overallAnalysis,
              recommendations: recommendationsText
            },
            financialData // Include the financial data
          }
        };

        console.log('📤 Sending update data:', updateData);
        const response = await ApiService.updateApplication(applicationId, updateData);

        console.log('📥 Response received:', response);

        if (response.success) {
          console.log('✅ Application updated successfully:', response.data);

          // Upload any pending documents to the server
          const docsToUpload = pendingDocuments.filter(d => d.file);
          if (docsToUpload.length > 0) {
            const token = localStorage.getItem('optimus_access_token');
            const uploadBase = `${window.location.origin}/api/documents/${applicationId}/upload`;
            let uploadErrors = 0;
            for (const doc of docsToUpload) {
              const fd = new FormData();
              fd.append('documents', doc.file, doc.name);
              fd.append('category', (doc.category || 'other').toUpperCase());
              try {
                const up = await fetch(uploadBase, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: fd,
                });
                if (!up.ok) uploadErrors++;
              } catch (e) {
                uploadErrors++;
                console.error('Document upload error:', e);
              }
            }
            if (uploadErrors > 0) {
              alert(`Analyse sauvegardée. Attention : ${uploadErrors} document(s) n'ont pas pu être téléversés.`);
            } else {
              alert('Analyse et documents sauvegardés avec succès !');
            }
          } else {
            alert('Analyse sauvegardée avec succès!');
          }
        } else {
          console.error('❌ Failed to update application:', response.error);
          alert('Erreur lors de la sauvegarde de l\'analyse: ' + response.error);
        }
      } catch (error) {
        console.error('❌ Error updating application:', error);
        alert('Erreur lors de la sauvegarde de l\'analyse: ' + (error as Error).message);
      }
      return;
    }

    console.log('🏢 Account manager mode: Creating new application');

    // Account manager mode: creating new application
    if (!workflowTimestamps || !currentStepStartTime) return;

    const now = new Date().toISOString();
    const totalStartTime = new Date(workflowTimestamps.totalStartedAt).getTime();
    const totalEndTime = new Date(now).getTime();
    const totalDuration = totalEndTime - totalStartTime;

    // Complete current step first
    completeCurrentStep(activeStep);

    const updatedWorkflow = {
      ...workflowTimestamps,
      totalCompletedAt: now,
      totalDuration,
      status: 'completed' as const
    };

    setWorkflowTimestamps(updatedWorkflow);
    localStorage.setItem(`workflow-${updatedWorkflow.applicationId}`, JSON.stringify(updatedWorkflow));

    // Also save to completed workflows list for dashboard analytics
    const completedWorkflows = JSON.parse(localStorage.getItem('completed-workflows') || '[]');
    completedWorkflows.push(updatedWorkflow);
    localStorage.setItem('completed-workflows', JSON.stringify(completedWorkflows));

    // Submit application to API
    try {
      if (!selectedClient) {
        console.error('No client selected');
        return;
      }

      const applicationData = {
        clientInfo: {
          companyName: selectedClient.companyName,
          rccm: selectedClient.rccm,
          ninea: selectedClient.ninea,
          cofi: selectedClient.cofi,
          legalForm: selectedClient.legalForm,
          sector: selectedClient.sector,
          establishedYear: selectedClient.establishedYear,
          headquarters: selectedClient.headquarters,
          contactPerson: selectedClient.contactPerson,
          phone: selectedClient.phone,
          email: selectedClient.email
        },
        creditRequest: {
          amount: parseFloat(amount),
          currency: 'XOF',
          duration: parseInt(duration),
          purpose: purpose,
          repaymentSchedule: creditType
        },
        preliminaryAnalysis: {
          overallScore,
          financialScore,
          analystScore,
          overallAnalysis,
          recommendations: recommendationsText
        },
        financialData,
        status: 'pending',
        submittedBy: 'current-user' // In real app, get from auth context
      };

      console.log('Submitting application with data:', applicationData);
      const response = await ApiService.createApplication(applicationData);

      if (response.success) {
        console.log('Application submitted successfully:', response.data);
        alert('Demande de crédit soumise avec succès!');
      } else {
        console.error('Failed to submit application:', response.error);
        alert('Erreur lors de la soumission de la demande: ' + response.error);
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Erreur lors de la soumission de la demande');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleNext = async () => {
    // Complete current step before moving to next
    completeCurrentStep(activeStep);

    // Auto-sauvegarde intermédiaire quand l'analyste valide l'étape "Analyse Crédit" (step 2)
    if (activeStep === 2 && isAnalystMode && applicationId) {
      try {
        await ApiService.updateApplication(applicationId, {
          analystScore,
          financialScore,
          overallScore,
          overallAnalysis,
          recommendations: recommendationsText,
          analysisResults: {
            preliminaryAnalysis: { overallScore, financialScore, analystScore, overallAnalysis, recommendations: recommendationsText },
            financialData,
          },
        });
      } catch (err) {
        console.warn('Auto-save intermediaire échoué:', err);
      }
    }

    const nextStep = activeStep + 1;
    setActiveStep(nextStep);

    // Start timing next step if not the last step
    if (nextStep < steps.length) {
      startNextStep(nextStep);
    }
  };

  const handleBack = () => {
    // Note: Going back doesn't affect timestamps - we keep the original progression
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Utility functions for scoring and risk assessment
  const getRiskLevel = (score: number): { label: string; color: 'success' | 'warning' | 'error' | 'info' } => {
    if (score >= 80) return { label: 'Risque Faible', color: 'success' };
    if (score >= 65) return { label: 'Risque Modéré', color: 'info' };
    if (score >= 50) return { label: 'Risque Élevé', color: 'warning' };
    return { label: 'Risque Critique', color: 'error' };
  };

  const getProgressColor = (score: number): 'success' | 'warning' | 'error' | 'info' => {
    if (score >= 80) return 'success';
    if (score >= 65) return 'info';
    if (score >= 50) return 'warning';
    return 'error';
  };

  // Load clients on component mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        console.log('Loading clients from API...');
        const response = await ApiService.getClients();
        if (response.success && response.data) {
          setClients(response.data);
          console.log('Clients loaded successfully:', response.data.length);
        } else {
          console.error('Failed to load clients:', response.error);
          setClients([]);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
        setClients([]);
      }
    };

    loadClients();
  }, []);

  // Add logging to track clients state changes
  useEffect(() => {
    console.log('👥 Clients state updated:', clients.length, 'clients loaded');
    console.log('📋 Client details:', clients);
  }, [clients]);

  const handleClientSelection = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      // Auto-populate related fields
      setSector(client.sector || '');
      setClientType(client.legalForm === 'SARL' || client.legalForm === 'SA' || client.legalForm === 'SAS' ? 'entreprise' : 'particulier');
      
      // Initialize workflow tracking when client is selected
      setTimeout(() => {
        initializeWorkflowTracking();
      }, 100); // Small delay to ensure selectedClient state is updated
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return Boolean(selectedClientId && amount && creditType && duration);
      case 1:
        return true; // Documents are optional at this stage
      case 2:
        return analystScore > 0; // Only require analyst score to be set manually
      default:
        return true;
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                fullWidth
                options={clients.filter(client => client.isActive)}
                getOptionLabel={(client) => `[${client.rccm || 'N/A'}] - ${client.companyName}`}
                value={selectedClient}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleClientSelection(newValue.id);
                  } else {
                    setSelectedClientId('');
                    setSelectedClient(null);
                    setSector('');
                    setClientType('');
                  }
                }}
                filterOptions={(options, { inputValue }) => {
                  const filterValue = inputValue.toLowerCase();
                  return options.filter(client => 
                    client.companyName.toLowerCase().includes(filterValue) ||
                    (client.rccm && client.rccm.toLowerCase().includes(filterValue))
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sélectionner un Client"
                    placeholder="Rechercher par nom ou RCCM..."
                    required
                    helperText="Tapez pour rechercher par nom d'entreprise ou numéro RCCM"
                  />
                )}
                renderOption={(props, client) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        [{client.rccm || 'N/A'}] - {client.companyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {client.sector} • {client.headquarters} • {client.contactPerson}
                      </Typography>
                    </Box>
                  </Box>
                )}
                noOptionsText="Aucun client trouvé"
              />
              {clients.length === 0 && (
                <Alert 
                  severity="info" 
                  sx={{ mt: 1 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => onNavigate('clients')}
                    >
                      Aller à Clients
                    </Button>
                  }
                >
                  Aucun client disponible. Veuillez créer un client d'abord.
                </Alert>
              )}
            </Grid>
            
            {/* Selected Client Information */}
            {selectedClient && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ bgcolor: 'background.paper', mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Informations Client Sélectionné
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">RCCM</Typography>
                        <Typography variant="body1">{selectedClient.rccm || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">NINEA</Typography>
                        <Typography variant="body1">{selectedClient.ninea || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Personne de Contact</Typography>
                        <Typography variant="body1">{selectedClient.contactPerson || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Siège Social</Typography>
                        <Typography variant="body1">{selectedClient.headquarters || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Type de Client</Typography>
                        <Typography variant="body1">{clientType || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Secteur d'Activité</Typography>
                        <Typography variant="body1">{selectedClient.sector || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Forme Juridique</Typography>
                        <Typography variant="body1">{selectedClient.legalForm || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Téléphone</Typography>
                        <Typography variant="body1">{selectedClient.phone || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Email</Typography>
                        <Typography variant="body1">{selectedClient.email || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">Année de Création</Typography>
                        <Typography variant="body1">{selectedClient.establishedYear || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Montant Demandé (FCFA)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 50000000"
                variant="outlined"
                type="number"
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Type de Crédit</InputLabel>
                <Select value={creditType} onChange={(e) => setCreditType(e.target.value)}>
                  <MenuItem value="exploitation">Crédit d'Exploitation</MenuItem>
                  <MenuItem value="investissement">Crédit d'Investissement</MenuItem>
                  <MenuItem value="immobilier">Crédit Immobilier</MenuItem>
                  <MenuItem value="vehicule">Crédit Véhicule</MenuItem>
                  <MenuItem value="autre">Autre</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Durée (mois)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 24"
                variant="outlined"
                type="number"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Objet du Crédit"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Décrivez l'objet et la finalité du crédit demandé"
                variant="outlined"
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              États Financiers SYSCOHADA
            </Typography>
            <FinancialDataInputTabs
              referenceYear={referenceYear}
              numberOfYears={numberOfYears}
              selectedSector={sector || 'general'}
              currency="XOF"
              onDataInput={handleDataInput}
              financialData={financialData}
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Card sx={{ mb: 4 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={currentTab} onChange={handleTabChange}>
                  <Tab label="Analyse de Crédit" />
                  <Tab label="Score Financier" />
                  <Tab label="Benchmarking" />
                  <Tab label="Documents" />
                </Tabs>
              </Box>
            </Card>

            {currentTab === 0 && (
              <Box>
                {/* Overall Score Summary */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={4}>
                    <Card sx={{ textAlign: 'center', p: 3 }}>
                      <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: getProgressColor(overallScore) === 'success' ? 'success.main' : getProgressColor(overallScore) === 'info' ? 'info.main' : getProgressColor(overallScore) === 'warning' ? 'warning.main' : 'error.main' }}>
                        <Typography variant="h4" color="white" sx={{ fontWeight: 700 }}>
                          {overallScore}
                        </Typography>
                      </Avatar>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        {t('analysis.dualScoring.overallScore')}
                      </Typography>
                      <Chip 
                        label={getRiskLevel(overallScore).label}
                        color={getRiskLevel(overallScore).color}
                        sx={{ fontWeight: 600 }}
                      />
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card sx={{ textAlign: 'center', p: 3 }}>
                      <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
                        <BarChartIcon sx={{ fontSize: 32 }} />
                      </Avatar>
                      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {financialScore}
                      </Typography>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        {t('analysis.dualScoring.financialScore')}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={financialScore} 
                        color={getProgressColor(financialScore)}
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      />
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card sx={{ textAlign: 'center', p: 3 }}>
                      <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'secondary.main' }}>
                        <StarIcon sx={{ fontSize: 32 }} />
                      </Avatar>
                      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main' }}>
                        {analystScore}
                      </Typography>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        {t('analysis.dualScoring.analystScore')}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={analystScore} 
                        color={getProgressColor(analystScore)}
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      />
                    </Card>
                  </Grid>
                </Grid>

                {/* Score Weight Configuration */}
                <Card sx={{ mb: 4 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Pondération Score Global
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => { setFinancialWeight(60); setAnalystWeight(40); }}
                        sx={{ fontSize: '11px', py: 0.25 }}
                      >
                        Défaut (60/40)
                      </Button>
                    </Box>
                    
                    <Grid container spacing={4} alignItems="center">
                      <Grid item xs={12} md={5}>
                        <Typography variant="body2" gutterBottom>
                          Pondération Score Financier: {financialWeight}%
                        </Typography>
                        <Slider
                          value={financialWeight}
                          onChange={(_, value) => {
                            const newFinWeight = value as number;
                            setFinancialWeight(newFinWeight);
                            setAnalystWeight(100 - newFinWeight);
                          }}
                          min={20}
                          max={80}
                          step={5}
                          marks
                          valueLabelDisplay="auto"
                          color="primary"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={2} sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Équilibre
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={5}>
                        <Typography variant="body2" gutterBottom>
                          Pondération Score Analyste: {analystWeight}%
                        </Typography>
                        <Slider
                          value={analystWeight}
                          onChange={(_, value) => {
                            const newAnlWeight = value as number;
                            setAnalystWeight(newAnlWeight);
                            setFinancialWeight(100 - newAnlWeight);
                          }}
                          min={20}
                          max={80}
                          step={5}
                          marks
                          valueLabelDisplay="auto"
                          color="secondary"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Detailed Analysis */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {/* Financial Ratios Analysis */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                          Analyse Financière Détaillée
                        </Typography>
                        
                        <Alert severity="info">
                          Les ratios financiers seront calculés automatiquement à partir des données financières saisies.
                        </Alert>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Analyst Assessment */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                          Évaluation Qualitative de l'Analyste
                        </Typography>

                        <Box sx={{ mt: 3, mb: 2 }}>
                          <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                            Score de l'Analyste: {analystScore}/100
                          </Typography>
                          <Slider
                            value={analystScore}
                            onChange={(_, value) => setAnalystScore(value as number)}
                            min={0}
                            max={100}
                            step={1}
                            marks={[
                              { value: 0, label: '0' },
                              { value: 25, label: '25' },
                              { value: 50, label: '50' },
                              { value: 75, label: '75' },
                              { value: 100, label: '100' }
                            ]}
                            valueLabelDisplay="auto"
                            color="secondary"
                            sx={{ mt: 2 }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Risque Critique
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Risque Faible
                            </Typography>
                          </Box>
                        </Box>

                        <Alert severity="info" sx={{ mt: 2 }}>
                          Ajustez le score en fonction de votre évaluation qualitative globale du dossier.
                        </Alert>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Qualitative Analysis */}
                <Card sx={{ mb: 4 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Analyse Qualitative et Recommandations
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <RichTextEditor
                          value={overallAnalysis}
                          onChange={(value) => setOverallAnalysis(value)}
                          placeholder="Saisissez votre analyse globale du dossier de crédit..."
                          height={200}
                          label="Analyse Globale du Dossier"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <RichTextEditor
                          value={recommendationsText}
                          onChange={(value) => setRecommendationsText(value)}
                          placeholder="Listez vos recommandations détaillées..."
                          height={200}
                          label="Recommandations et Conditions"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Score Financier Tab */}
            {currentTab === 1 && (
              <Box>
                {/* Financial Score Summary Card */}
                <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #3A56A8 0%, #2878C8 52%, #28A8E2 100%)' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={3} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Avatar sx={{ width: 96, height: 96, mx: 'auto', mb: 1.5, bgcolor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)' }}>
                            <Typography variant="h2" sx={{ fontWeight: 700, color: 'white' }}>
                              {financialScore}
                            </Typography>
                          </Avatar>
                          <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                            Score Financier
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                            /100 — SYSCOHADA / BCEAO
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={9}>
                        <Grid container spacing={2}>
                          {[
                            { label: 'Liquidité',   value: scoreBreakdown?.liquidity     ?? 0, weight: categoryWeights.liquidity },
                            { label: 'Rentabilité', value: scoreBreakdown?.profitability  ?? 0, weight: categoryWeights.profitability },
                            { label: 'Endettement', value: scoreBreakdown?.leverage       ?? 0, weight: categoryWeights.leverage },
                            { label: 'Efficacité',  value: scoreBreakdown?.efficiency     ?? 0, weight: categoryWeights.efficiency },
                          ].map(({ label, value, weight }) => (
                            <Grid item xs={6} sm={3} key={label}>
                              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', display: 'block' }}>{label}</Typography>
                                <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>{value}</Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={value}
                                  sx={{ mt: 0.75, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                                />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>Pond. {weight}%</Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Category Weight Configuration */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Pondération des Catégories Financières
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {(() => {
                          const total = categoryWeights.liquidity + categoryWeights.profitability + categoryWeights.leverage + categoryWeights.efficiency;
                          return (
                            <Chip
                              label={`Total : ${total}%`}
                              color={total === 100 ? 'success' : 'warning'}
                              size="small"
                            />
                          );
                        })()}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setCategoryWeights({ liquidity: 25, profitability: 30, leverage: 25, efficiency: 20 })}
                          sx={{ fontSize: '11px', py: 0.25 }}
                        >
                          Défaut
                        </Button>
                      </Box>
                    </Box>
                    <Grid container spacing={3}>
                      {([
                        { key: 'liquidity'     as const, label: 'Liquidité',   color: '#0288d1' },
                        { key: 'profitability' as const, label: 'Rentabilité', color: '#2e7d32' },
                        { key: 'leverage'      as const, label: 'Endettement', color: '#ed6c02' },
                        { key: 'efficiency'    as const, label: 'Efficacité',  color: '#3A56A8' },
                      ]).map(({ key, label, color }) => (
                        <Grid item xs={12} sm={6} key={key}>
                          <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                            {label} — <strong style={{ color }}>{categoryWeights[key]}%</strong>
                          </Typography>
                          <Slider
                            value={categoryWeights[key]}
                            onChange={(_, v) => setCategoryWeights(prev => ({ ...prev, [key]: v as number }))}
                            min={5}
                            max={60}
                            step={5}
                            marks
                            valueLabelDisplay="auto"
                            valueLabelFormat={v => `${v}%`}
                            sx={{ color }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {(categoryWeights.liquidity + categoryWeights.profitability + categoryWeights.leverage + categoryWeights.efficiency) !== 100 && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        Total {categoryWeights.liquidity + categoryWeights.profitability + categoryWeights.leverage + categoryWeights.efficiency}% — les poids sont automatiquement normalisés dans le calcul pour toujours sommer à 100%.
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Contribution Table */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Tableau des Contributions — Score Financier Total
                    </Typography>
                    {(() => {
                      const totalW = (categoryWeights.liquidity + categoryWeights.profitability + categoryWeights.leverage + categoryWeights.efficiency) || 100;
                      const rows = [
                        { cat: 'Liquidité',   score: scoreBreakdown?.liquidity     ?? 0, w: categoryWeights.liquidity },
                        { cat: 'Rentabilité', score: scoreBreakdown?.profitability  ?? 0, w: categoryWeights.profitability },
                        { cat: 'Endettement', score: scoreBreakdown?.leverage       ?? 0, w: categoryWeights.leverage },
                        { cat: 'Efficacité',  score: scoreBreakdown?.efficiency     ?? 0, w: categoryWeights.efficiency },
                      ];
                      let cumul = 0;
                      return (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell><strong>Catégorie</strong></TableCell>
                                <TableCell align="right"><strong>Score Brut /100</strong></TableCell>
                                <TableCell align="right"><strong>Pondération effective</strong></TableCell>
                                <TableCell align="right"><strong>Contribution</strong></TableCell>
                                <TableCell align="right"><strong>Cumul</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map(({ cat, score, w }) => {
                                const effWeight = w / totalW;
                                const contrib   = score * effWeight;
                                cumul += contrib;
                                return (
                                  <TableRow key={cat} hover>
                                    <TableCell>{cat}</TableCell>
                                    <TableCell align="right"><strong>{score}</strong></TableCell>
                                    <TableCell align="right">{(effWeight * 100).toFixed(1)}%</TableCell>
                                    <TableCell align="right">{contrib.toFixed(2)}</TableCell>
                                    <TableCell align="right"><strong>{cumul.toFixed(2)}</strong></TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow sx={{ bgcolor: 'rgba(58,86,168,0.06)' }}>
                                <TableCell colSpan={3}><strong>Score de Base (avant tendances)</strong></TableCell>
                                <TableCell align="right" colSpan={2}>
                                  <Chip label={`${(scoreBreakdown?.baseScore ?? 0).toFixed(1)} / 100`} color="primary" size="small" />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={3}>Ajustement Tendances ({scoreBreakdown?.trendScore ?? 0} / 20)</TableCell>
                                <TableCell align="right" colSpan={2}>
                                  <Chip label={`+ ${(scoreBreakdown?.trendAdjustment ?? 0).toFixed(1)} pts`} color="info" size="small" />
                                </TableCell>
                              </TableRow>
                              <TableRow sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                                <TableCell colSpan={3}><Typography fontWeight={700}>Score Financier Final</Typography></TableCell>
                                <TableCell align="right" colSpan={2}>
                                  <Chip label={`${financialScore} / 100`} color="success" />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Detailed Ratios Tables */}
                <Grid container spacing={3}>
                  {/* Liquidity Ratios */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32, fontSize: '16px' }}>💧</Avatar>
                          Liquidité — {scoreBreakdown?.liquidity ?? 0}/100
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Ratio</strong></TableCell>
                                <TableCell align="right"><strong>Valeur</strong></TableCell>
                                <TableCell align="right"><strong>Norme</strong></TableCell>
                                <TableCell align="center"><strong>Statut</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Liquidité Générale</TableCell>
                                <TableCell align="right">{scoreBreakdown ? scoreBreakdown.currentRatio.toFixed(2) : '—'}</TableCell>
                                <TableCell align="right">≥ 1.5</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.currentRatio >= 1.5 ? 'Bon' : scoreBreakdown.currentRatio >= 1.0 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.currentRatio >= 1.5 ? 'success' : scoreBreakdown.currentRatio >= 1.0 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Liquidité Réduite</TableCell>
                                <TableCell align="right">{scoreBreakdown ? scoreBreakdown.quickRatio.toFixed(2) : '—'}</TableCell>
                                <TableCell align="right">≥ 1.0</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.quickRatio >= 1.0 ? 'Bon' : scoreBreakdown.quickRatio >= 0.7 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.quickRatio >= 1.0 ? 'success' : scoreBreakdown.quickRatio >= 0.7 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Profitability Ratios */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32, fontSize: '16px' }}>📈</Avatar>
                          Rentabilité — {scoreBreakdown?.profitability ?? 0}/100
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Ratio</strong></TableCell>
                                <TableCell align="right"><strong>Valeur</strong></TableCell>
                                <TableCell align="right"><strong>Norme</strong></TableCell>
                                <TableCell align="center"><strong>Statut</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Marge Nette</TableCell>
                                <TableCell align="right">{scoreBreakdown ? `${scoreBreakdown.netMargin.toFixed(2)}%` : '—'}</TableCell>
                                <TableCell align="right">≥ 5%</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.netMargin >= 10 ? 'Excellent' : scoreBreakdown.netMargin >= 5 ? 'Bon' : scoreBreakdown.netMargin >= 2 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.netMargin >= 5 ? 'success' : scoreBreakdown.netMargin >= 2 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>ROA</TableCell>
                                <TableCell align="right">{scoreBreakdown ? `${scoreBreakdown.roa.toFixed(2)}%` : '—'}</TableCell>
                                <TableCell align="right">≥ 8%</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.roa >= 8 ? 'Bon' : scoreBreakdown.roa >= 5 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.roa >= 8 ? 'success' : scoreBreakdown.roa >= 5 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Leverage Ratios */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32, fontSize: '16px' }}>⚖️</Avatar>
                          Endettement — {scoreBreakdown?.leverage ?? 0}/100
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Ratio</strong></TableCell>
                                <TableCell align="right"><strong>Valeur</strong></TableCell>
                                <TableCell align="right"><strong>Norme</strong></TableCell>
                                <TableCell align="center"><strong>Statut</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Dette / Cap. Propres</TableCell>
                                <TableCell align="right">{scoreBreakdown ? scoreBreakdown.debtToEquity.toFixed(2) : '—'}</TableCell>
                                <TableCell align="right">≤ 1.0</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.debtToEquity <= 0.5 ? 'Excellent' : scoreBreakdown.debtToEquity <= 1.0 ? 'Bon' : scoreBreakdown.debtToEquity <= 2.0 ? 'Acceptable' : 'Élevé'} color={scoreBreakdown.debtToEquity <= 1.0 ? 'success' : scoreBreakdown.debtToEquity <= 2.0 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Autonomie Financière</TableCell>
                                <TableCell align="right">{scoreBreakdown ? `${scoreBreakdown.equityRatio.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell align="right">≥ 30%</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.equityRatio >= 40 ? 'Excellent' : scoreBreakdown.equityRatio >= 30 ? 'Bon' : scoreBreakdown.equityRatio >= 20 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.equityRatio >= 30 ? 'success' : scoreBreakdown.equityRatio >= 20 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Efficiency Ratios */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '16px' }}>⚡</Avatar>
                          Efficacité — {scoreBreakdown?.efficiency ?? 0}/100
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Ratio</strong></TableCell>
                                <TableCell align="right"><strong>Valeur</strong></TableCell>
                                <TableCell align="right"><strong>Norme</strong></TableCell>
                                <TableCell align="center"><strong>Statut</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Rotation des Actifs</TableCell>
                                <TableCell align="right">{scoreBreakdown ? scoreBreakdown.assetTurnover.toFixed(2) : '—'}</TableCell>
                                <TableCell align="right">≥ 1.0</TableCell>
                                <TableCell align="center">
                                  {scoreBreakdown && <Chip label={scoreBreakdown.assetTurnover >= 1.5 ? 'Excellent' : scoreBreakdown.assetTurnover >= 1.0 ? 'Bon' : scoreBreakdown.assetTurnover >= 0.5 ? 'Acceptable' : 'Faible'} color={scoreBreakdown.assetTurnover >= 1.0 ? 'success' : scoreBreakdown.assetTurnover >= 0.5 ? 'warning' : 'error'} size="small" />}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Trend Analysis */}
                <Card sx={{ mt: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Ajustement Tendances Multi-Années
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Le score de tendance ajoute jusqu'à +25 pts selon l'évolution pluriannuelle des indicateurs clés.
                    </Alert>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Score Tendance</Typography>
                          <Typography variant="h5" color="info.main" sx={{ fontWeight: 600 }}>{scoreBreakdown?.trendScore ?? 0}/20</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Bonus Appliqué</Typography>
                          <Typography variant="h5" color="success.main" sx={{ fontWeight: 600 }}>+{(scoreBreakdown?.trendAdjustment ?? 0).toFixed(1)}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Score de Base</Typography>
                          <Typography variant="h5" color="primary.main" sx={{ fontWeight: 600 }}>{(scoreBreakdown?.baseScore ?? 0).toFixed(1)}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">Score Final</Typography>
                          <Typography variant="h5" color="success.main" sx={{ fontWeight: 600 }}>{financialScore}/100</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Benchmarking Tab */}
            {currentTab === 2 && (
              <IndustryBenchmarking
                clientIndustry={selectedClient?.sector || "Agriculture et Agrobusiness"}
                clientData={{}}
              />
            )}

            {/* Documents Tab */}
            {currentTab === 3 && (
              <DocumentManager
                clientId={selectedClientId || 'new'}
                applicationId={applicationId || undefined}
                onDocumentsChange={setPendingDocuments}
                onDocumentProcessed={(document) => {
                  console.log('Document processed:', document);
                }}
              />
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Résumé de la Demande
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Informations Client
                    </Typography>
                    <Typography variant="body2"><strong>Nom:</strong> {selectedClient?.companyName}</Typography>
                    <Typography variant="body2"><strong>Type:</strong> {clientType}</Typography>
                    <Typography variant="body2"><strong>Secteur:</strong> {selectedClient?.sector}</Typography>
                    <Typography variant="body2"><strong>Montant:</strong> {amount} FCFA</Typography>
                    <Typography variant="body2"><strong>Type de Crédit:</strong> {creditType}</Typography>
                    <Typography variant="body2"><strong>Durée:</strong> {duration} mois</Typography>
                    {purpose && <Typography variant="body2"><strong>Objet:</strong> {purpose}</Typography>}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Résultats de l'Analyse
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: getProgressColor(overallScore) === 'success' ? 'success.main' : getProgressColor(overallScore) === 'info' ? 'info.main' : getProgressColor(overallScore) === 'warning' ? 'warning.main' : 'error.main' }}>
                        <Typography variant="h5" color="white" sx={{ fontWeight: 700 }}>
                          {overallScore}
                        </Typography>
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Score Global
                        </Typography>
                        <Chip 
                          label={getRiskLevel(overallScore).label}
                          color={getRiskLevel(overallScore).color}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2"><strong>Score Financier:</strong> {financialScore}/100</Typography>
                    <Typography variant="body2"><strong>Score Analyste:</strong> {analystScore}/100</Typography>
                    <Typography variant="body2"><strong>Référentiels:</strong> SYSCOHADA, BCEAO</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Attention:</strong> Une fois soumise, cette demande entrera dans le workflow d'approbation et ne pourra plus être modifiée sans autorisation spéciale.
              </Typography>
            </Alert>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  // Helper function to safely get numeric value from financial data
  const getNumericValue = (data: any, field: string): number => {
    const value = data?.[field];
    if (value === undefined || value === null || value === '') return 0;
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Helper function to extract financial data from year object
  const extractYearData = (yearObj: any) => {
    const data = yearObj?.multiyear_data?.N?.data;
    if (!data) return null;

    return {
      revenue: getNumericValue(data, 'chiffre_affaires') || getNumericValue(data, 'ca'),
      profit: getNumericValue(data, 'resultat_net') || getNumericValue(data, 'benefice_net'),
      totalAssets: getNumericValue(data, 'total_actif') || getNumericValue(data, 'actif_total'),
      equity: getNumericValue(data, 'capitaux_propres') || getNumericValue(data, 'fonds_propres'),
      currentAssets: getNumericValue(data, 'total_actif_circulant') || getNumericValue(data, 'actif_circulant'),
      currentLiabilities: 0, // Will be calculated
      data: data // Keep full data for detailed calculations
    };
  };

  // Calculate trend score based on multi-year performance
  const calculateTrendScore = (allYearsData: any[]): number => {
    if (allYearsData.length < 2) return 10; // Default neutral score if not enough data

    console.log('📈 Calculating trend score from', allYearsData.length, 'years of data');

    let trendScore = 0;
    const [latest, previous, older] = allYearsData;

    // 1. REVENUE TREND (5 points max)
    if (previous && latest) {
      const revGrowth = ((latest.revenue - previous.revenue) / previous.revenue) * 100;
      console.log('  Revenue growth (latest vs previous):', revGrowth.toFixed(2) + '%');

      if (older) {
        const prevRevGrowth = ((previous.revenue - older.revenue) / older.revenue) * 100;
        console.log('  Revenue growth (previous vs older):', prevRevGrowth.toFixed(2) + '%');

        if (revGrowth > 0 && prevRevGrowth > 0) {
          trendScore += 5; // Sustained growth
        } else if (revGrowth > 0 || prevRevGrowth > 0) {
          trendScore += 3; // Some growth
        } else {
          trendScore += 1; // Decline
        }
      } else {
        trendScore += (revGrowth > 0 ? 4 : 2);
      }
    }

    // 2. PROFIT TREND (6 points max)
    if (previous && latest) {
      const profitGrowth = ((latest.profit - previous.profit) / Math.abs(previous.profit)) * 100;
      console.log('  Profit growth (latest vs previous):', profitGrowth.toFixed(2) + '%');

      if (older) {
        const prevProfitGrowth = ((previous.profit - older.profit) / Math.abs(older.profit)) * 100;
        console.log('  Profit growth (previous vs older):', prevProfitGrowth.toFixed(2) + '%');

        if (profitGrowth > 10 && prevProfitGrowth > 0) {
          trendScore += 6; // Strong sustained growth
        } else if (profitGrowth > 0 && prevProfitGrowth > 0) {
          trendScore += 5; // Moderate sustained growth
        } else if (profitGrowth > 0 || prevProfitGrowth > 0) {
          trendScore += 3; // Mixed
        } else if (profitGrowth < 0 && prevProfitGrowth < 0) {
          trendScore += 0; // Sustained decline
        } else {
          trendScore += 2; // Recent decline
        }
      } else {
        if (profitGrowth > 10) trendScore += 5;
        else if (profitGrowth > 0) trendScore += 4;
        else if (profitGrowth > -10) trendScore += 2;
        else trendScore += 0;
      }
    }

    // 3. MARGIN TREND (4 points max)
    if (previous && latest) {
      const margin = (latest.profit / latest.revenue) * 100;
      const prevMargin = (previous.profit / previous.revenue) * 100;
      console.log('  Net margin:', margin.toFixed(2) + '% (previous:', prevMargin.toFixed(2) + '%)');

      if (older) {
        const olderMargin = (older.profit / older.revenue) * 100;

        if (margin > prevMargin && prevMargin > olderMargin) {
          trendScore += 4; // Improving efficiency
        } else if (margin > olderMargin) {
          trendScore += 3; // Net improvement
        } else if (margin >= olderMargin * 0.95) {
          trendScore += 2; // Stable
        } else {
          trendScore += 1; // Declining
        }
      } else {
        if (margin > prevMargin) trendScore += 3;
        else if (margin >= prevMargin * 0.95) trendScore += 2;
        else trendScore += 1;
      }
    }

    // 4. EQUITY GROWTH (3 points max)
    if (previous && latest) {
      const equityGrowth = ((latest.equity - previous.equity) / previous.equity) * 100;
      console.log('  Equity growth:', equityGrowth.toFixed(2) + '%');

      if (older) {
        const prevEquityGrowth = ((previous.equity - older.equity) / older.equity) * 100;

        if (equityGrowth > 5 && prevEquityGrowth > 0) {
          trendScore += 3; // Strong capital growth
        } else if (equityGrowth > 0 && prevEquityGrowth > 0) {
          trendScore += 2; // Steady growth
        } else {
          trendScore += 1; // Stagnant
        }
      } else {
        if (equityGrowth > 5) trendScore += 2;
        else if (equityGrowth > 0) trendScore += 1;
      }
    }

    // 5. ROA TREND (2 points max)
    if (previous && latest) {
      const roa = (latest.profit / latest.totalAssets) * 100;
      const prevRoa = (previous.profit / previous.totalAssets) * 100;
      console.log('  ROA:', roa.toFixed(2) + '% (previous:', prevRoa.toFixed(2) + '%)');

      if (roa > prevRoa) {
        trendScore += 2; // Improving efficiency
      } else if (roa >= prevRoa * 0.95) {
        trendScore += 1; // Stable
      }
    }

    console.log('  📊 TREND SCORE:', trendScore, '/ 20');
    return trendScore;
  };

  // Calculate financial score based on ratios with trend adjustment
  const calculateFinancialScore = (): number => {
    console.log('🔢 Calculating financial score...');
    console.log('📊 Financial Data:', financialData);
    console.log('📊 Financial Data keys:', Object.keys(financialData));

    const zeroBreakdown = {
      liquidity: 0, profitability: 0, leverage: 0, efficiency: 0,
      currentRatio: 0, quickRatio: 0, netMargin: 0, roa: 0,
      debtToEquity: 0, equityRatio: 0, assetTurnover: 0,
      trendScore: 0, trendAdjustment: 0, baseScore: 0,
    };

    if (!financialData || Object.keys(financialData).length === 0) {
      console.log('❌ No financial data available');
      setScoreBreakdown(zeroBreakdown);
      return 0;
    }

    // Get all available years sorted (newest first)
    const years = Object.keys(financialData).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];
    const yearData = financialData[latestYear];

    if (!yearData) {
      console.log('❌ No data for latest year');
      setScoreBreakdown(zeroBreakdown);
      return 0;
    }

    // Extract the actual financial data from the nested structure
    const data = yearData.multiyear_data?.N?.data;

    if (!data) {
      console.log('❌ No financial data found in multiyear_data.N.data');
      setScoreBreakdown(zeroBreakdown);
      return 0;
    }

    // Extract data for all available years for trend analysis
    const allYearsData = years.map(year => extractYearData(financialData[year])).filter(d => d !== null);
    console.log('📅 Extracted', allYearsData.length, 'years of complete financial data');

    // Extract balance sheet items (SYSCOHADA format)
    const totalActif = getNumericValue(data, 'total_actif') || getNumericValue(data, 'actif_total');
    const actifCirculant = getNumericValue(data, 'actif_circulant') || getNumericValue(data, 'actif_courant') || getNumericValue(data, 'total_actif_circulant');
    const disponibilites = getNumericValue(data, 'tresorerie_actif') || getNumericValue(data, 'disponibilites');
    const stocks = getNumericValue(data, 'stocks');
    const creances = getNumericValue(data, 'creances') || getNumericValue(data, 'clients');

    const capitauxPropres = getNumericValue(data, 'capitaux_propres') || getNumericValue(data, 'fonds_propres');
    const totalPassif = getNumericValue(data, 'total_passif') || totalActif;
    const dettesLongTerme = getNumericValue(data, 'dettes_financieres') || getNumericValue(data, 'emprunts');

    // Calculate current liabilities from individual components if passif_circulant not available
    let passifCirculant = getNumericValue(data, 'passif_circulant') || getNumericValue(data, 'passif_courant');

    if (passifCirculant === 0) {
      // Calculate from individual short-term liability items
      passifCirculant =
        getNumericValue(data, 'dettes_fournisseurs') +
        getNumericValue(data, 'dettes_sociales_fiscales') +
        getNumericValue(data, 'clients_avances_recues') +
        getNumericValue(data, 'provisions_court_terme') +
        getNumericValue(data, 'dettes_circulantes_hao');

      console.log('📊 Calculated passifCirculant from components:', passifCirculant);
    }

    const dettesCourtTerme = getNumericValue(data, 'dettes_court_terme') || passifCirculant;

    console.log('💰 Key financial values extracted:');
    console.log('  totalActif:', totalActif);
    console.log('  actifCirculant:', actifCirculant);
    console.log('  capitauxPropres:', capitauxPropres);
    console.log('  dettesCourtTerme:', dettesCourtTerme);
    console.log('  dettesLongTerme:', dettesLongTerme);

    // Extract income statement items
    const chiffreAffaires = getNumericValue(data, 'chiffre_affaires') || getNumericValue(data, 'ca');
    const resultatNet = getNumericValue(data, 'resultat_net') || getNumericValue(data, 'benefice_net');
    const resultatExploitation = getNumericValue(data, 'resultat_exploitation') || getNumericValue(data, 'ebitda');
    const chargesFinancieres = getNumericValue(data, 'charges_financieres') || getNumericValue(data, 'interets');

    // Calculate ratios and score each category
    let liquidityScore = 0;
    let profitabilityScore = 0;
    let leverageScore = 0;
    let efficiencyScore = 0;
    let categoryCount = 0;

    // 1. LIQUIDITY RATIOS (Weight: 25%)
    if (actifCirculant > 0 && dettesCourtTerme > 0) {
      // Current Ratio (Ratio de liquidité générale) - Benchmark: >= 1.5
      const currentRatio = actifCirculant / dettesCourtTerme;
      if (currentRatio >= 2.0) liquidityScore += 25;
      else if (currentRatio >= 1.5) liquidityScore += 20;
      else if (currentRatio >= 1.0) liquidityScore += 15;
      else if (currentRatio >= 0.8) liquidityScore += 10;
      else liquidityScore += 5;

      // Quick Ratio (Ratio de liquidité réduite) - Benchmark: >= 1.0
      const quickRatio = (actifCirculant - stocks) / dettesCourtTerme;
      if (quickRatio >= 1.5) liquidityScore += 25;
      else if (quickRatio >= 1.0) liquidityScore += 20;
      else if (quickRatio >= 0.7) liquidityScore += 15;
      else if (quickRatio >= 0.5) liquidityScore += 10;
      else liquidityScore += 5;

      liquidityScore = liquidityScore / 2; // Average of 2 ratios
      categoryCount++;
    }

    // 2. PROFITABILITY RATIOS (Weight: 30%)
    if (chiffreAffaires > 0) {
      // Net Profit Margin - Benchmark: >= 10%
      const netMargin = (resultatNet / chiffreAffaires) * 100;
      if (netMargin >= 15) profitabilityScore += 30;
      else if (netMargin >= 10) profitabilityScore += 25;
      else if (netMargin >= 5) profitabilityScore += 20;
      else if (netMargin >= 2) profitabilityScore += 15;
      else if (netMargin >= 0) profitabilityScore += 10;
      else profitabilityScore += 0;
      categoryCount++;
    }

    if (totalActif > 0 && resultatNet !== 0) {
      // Return on Assets (ROA) - Benchmark: >= 8%
      const roa = (resultatNet / totalActif) * 100;
      if (roa >= 12) profitabilityScore += 30;
      else if (roa >= 8) profitabilityScore += 25;
      else if (roa >= 5) profitabilityScore += 20;
      else if (roa >= 2) profitabilityScore += 15;
      else if (roa >= 0) profitabilityScore += 10;
      else profitabilityScore += 0;

      profitabilityScore = profitabilityScore / 2; // Average of 2 ratios
    }

    // 3. LEVERAGE RATIOS (Weight: 25%)
    if (totalActif > 0 && capitauxPropres > 0) {
      // Debt to Equity Ratio - Benchmark: <= 2.0
      const totalDebt = dettesLongTerme + dettesCourtTerme;
      const debtToEquity = totalDebt / capitauxPropres;
      if (debtToEquity <= 0.5) leverageScore += 25;
      else if (debtToEquity <= 1.0) leverageScore += 20;
      else if (debtToEquity <= 2.0) leverageScore += 15;
      else if (debtToEquity <= 3.0) leverageScore += 10;
      else leverageScore += 5;

      // Equity Ratio (Autonomie financière) - Benchmark: >= 30%
      const equityRatio = (capitauxPropres / totalActif) * 100;
      if (equityRatio >= 50) leverageScore += 25;
      else if (equityRatio >= 40) leverageScore += 20;
      else if (equityRatio >= 30) leverageScore += 15;
      else if (equityRatio >= 20) leverageScore += 10;
      else leverageScore += 5;

      leverageScore = leverageScore / 2; // Average of 2 ratios
      categoryCount++;
    }

    // 4. EFFICIENCY RATIOS (Weight: 20%)
    if (chiffreAffaires > 0 && totalActif > 0) {
      // Asset Turnover - Benchmark: >= 1.0
      const assetTurnover = chiffreAffaires / totalActif;
      if (assetTurnover >= 2.0) efficiencyScore += 20;
      else if (assetTurnover >= 1.5) efficiencyScore += 18;
      else if (assetTurnover >= 1.0) efficiencyScore += 15;
      else if (assetTurnover >= 0.5) efficiencyScore += 12;
      else efficiencyScore += 8;
      categoryCount++;
    }

    // Normalize computed scores to 0-100 scale
    // liquidityScore max = 25, profitabilityScore max = 30, leverageScore max = 25, efficiencyScore max = 20
    const normLiquidity     = Math.min(liquidityScore * 4, 100);
    const normProfitability = Math.min(profitabilityScore * (10 / 3), 100);
    const normLeverage      = Math.min(leverageScore * 4, 100);
    const normEfficiency    = Math.min(efficiencyScore * 5, 100);

    // Apply dynamic category weights (normalize to always sum to 100%)
    const totalCatWeight = (categoryWeights.liquidity + categoryWeights.profitability +
                            categoryWeights.leverage + categoryWeights.efficiency) || 100;
    const wL   = categoryWeights.liquidity    / totalCatWeight;
    const wP   = categoryWeights.profitability / totalCatWeight;
    const wLev = categoryWeights.leverage     / totalCatWeight;
    const wE   = categoryWeights.efficiency   / totalCatWeight;

    const weightedScore = normLiquidity * wL + normProfitability * wP + normLeverage * wLev + normEfficiency * wE;

    // Calculate trend adjustment (0-20 trend score → 0-25 bonus points)
    const trendScoreVal   = calculateTrendScore(allYearsData);
    const trendAdjustment = (trendScoreVal / 20) * 25;
    const finalScore      = weightedScore + trendAdjustment;

    // Compute ratio values for UI display
    const displayCurrentRatio  = actifCirculant > 0 && dettesCourtTerme > 0 ? actifCirculant / dettesCourtTerme : 0;
    const displayQuickRatio    = actifCirculant > 0 && dettesCourtTerme > 0 ? (actifCirculant - stocks) / dettesCourtTerme : 0;
    const displayNetMargin     = chiffreAffaires > 0 ? (resultatNet / chiffreAffaires) * 100 : 0;
    const displayRoa           = totalActif > 0 ? (resultatNet / totalActif) * 100 : 0;
    const displayDebtToEquity  = capitauxPropres > 0 ? (dettesLongTerme + dettesCourtTerme) / capitauxPropres : 0;
    const displayEquityRatio   = totalActif > 0 ? (capitauxPropres / totalActif) * 100 : 0;
    const displayAssetTurnover = totalActif > 0 ? chiffreAffaires / totalActif : 0;

    setScoreBreakdown({
      liquidity:     Math.round(normLiquidity),
      profitability: Math.round(normProfitability),
      leverage:      Math.round(normLeverage),
      efficiency:    Math.round(normEfficiency),
      currentRatio:  displayCurrentRatio,
      quickRatio:    displayQuickRatio,
      netMargin:     displayNetMargin,
      roa:           displayRoa,
      debtToEquity:  displayDebtToEquity,
      equityRatio:   displayEquityRatio,
      assetTurnover: displayAssetTurnover,
      trendScore:    trendScoreVal,
      trendAdjustment,
      baseScore:     weightedScore,
    });

    console.log('📈 Score Breakdown:', { normLiquidity, normProfitability, normLeverage, normEfficiency, weightedScore, trendAdjustment, finalScore });
    return Math.min(Math.round(finalScore), 100);
  };

  // Calculate analyst score based on criteria
  const calculateAnalystScore = (): number => {
    // Return the manually set analyst score
    return analystScore;
  };

  // Calculate overall score
  const calculateOverallScore = (finScore: number, anlScore: number): number => {
    return Math.round((finScore * financialWeight + anlScore * analystWeight) / 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircleIcon color="success" />;
      case 'good': return <CheckCircleIcon color="info" />;
      case 'fair': return <WarningIcon color="warning" />;
      case 'poor': return <CancelIcon color="error" />;
      default: return <WarningIcon />;
    }
  };

  useEffect(() => {
    const finScore = calculateFinancialScore();
    const anlScore = calculateAnalystScore();

    setFinancialScore(finScore);
    setOverallScore(calculateOverallScore(finScore, anlScore));
  }, [financialWeight, analystWeight, analystScore, financialData, categoryWeights]); // eslint-disable-line react-hooks/exhaustive-deps

  const isStepComplete = (i: number) => i < activeStep && validateStep(i);

  return (
    <Box sx={{ bgcolor: BG_SC, minHeight: '100vh', pb: 9 }}>

      {/* ── En-tête gradient animé ─────────────────────────────────────────── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${STEP_COLORS_SC[activeStep]} 0%, ${STEP_COLORS_SC[activeStep]}cc 100%)`,
        px: { xs: 2, md: 4 }, pt: 4, pb: 6,
        transition: 'background 0.5s ease',
      }}>
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', letterSpacing: 2 }}>
            Nouvelle Demande de Crédit
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: -0.5, mb: 0.5 }}>
            {SCORING_STEPS[activeStep].label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2.5 }}>
            {SCORING_STEPS[activeStep].subtitle}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((activeStep + 1) / SCORING_STEPS.length) * 100}
            sx={{
              height: 6, borderRadius: 3, mb: 3,
              bgcolor: 'rgba(255,255,255,0.25)',
              '& .MuiLinearProgress-bar': { bgcolor: 'white', borderRadius: 3 },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              Étape {activeStep + 1} / {SCORING_STEPS.length}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {Math.round(((activeStep + 1) / SCORING_STEPS.length) * 100)}% complété
            </Typography>
          </Box>
          <Box sx={{ mt: 3 }}>
            <ScoringStepIndicator activeStep={activeStep} isStepComplete={isStepComplete} />
          </Box>
        </Box>
      </Box>

      {/* ── Contenu de l'étape ────────────────────────────────────────────── */}
      <Box sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, md: 4 }, mt: -3, position: 'relative', zIndex: 1 }}>
        <Card sx={{
          borderRadius: `${CARD_RADIUS_SC}px`,
          boxShadow: CARD_SHADOW_SC,
          border: '1px solid rgba(0,0,0,0.05)',
          mb: 3, overflow: 'visible',
        }}>
          <CardContent sx={{ p: 3 }}>
            {getStepContent(activeStep)}
          </CardContent>
        </Card>
      </Box>

      {/* ── Barre de navigation fixe en bas ──────────────────────────────── */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
        bgcolor: 'white',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
        px: { xs: 2, md: 4 }, py: 2,
      }}>
        <Box sx={{ maxWidth: 960, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          {/* Dots de progression */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {SCORING_STEPS.map((_, i) => (
              <Box key={i} sx={{
                width: i === activeStep ? 20 : 8, height: 8, borderRadius: 4,
                bgcolor: i === activeStep ? STEP_COLORS_SC[activeStep] : i < activeStep ? '#a5d6a7' : '#e2e8f0',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </Box>

          {/* Boutons */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => onNavigate('clients')}
              sx={{ borderRadius: 3, borderColor: 'rgba(0,0,0,0.15)', color: 'text.secondary' }}
            >
              Annuler
            </Button>
            {activeStep > 0 && (
              <Button
                variant="outlined"
                startIcon={<BackIcon />}
                onClick={handleBack}
                sx={{ borderRadius: 3 }}
              >
                Précédent
              </Button>
            )}
            <Button
              variant="contained"
              endIcon={activeStep < SCORING_STEPS.length - 1 ? <NextIcon /> : <SendIcon />}
              onClick={activeStep === SCORING_STEPS.length - 1 ? async () => {
                await completeWorkflow();
                onNavigate('workflow');
              } : handleNext}
              disabled={activeStep < 3 && !validateStep(activeStep)}
              sx={{
                borderRadius: 3, px: 4, fontWeight: 700,
                background: `linear-gradient(135deg, ${STEP_COLORS_SC[activeStep]}, ${STEP_COLORS_SC[activeStep]}cc)`,
                boxShadow: `0 4px 16px ${STEP_COLORS_SC[activeStep]}40`,
                '&:hover': { boxShadow: `0 6px 20px ${STEP_COLORS_SC[activeStep]}60` },
                '&:disabled': { background: '#e2e8f0', boxShadow: 'none' },
              }}
            >
              {activeStep === SCORING_STEPS.length - 1 ? 'Soumettre la Demande' : 'Suivant'}
            </Button>
          </Box>
        </Box>
      </Box>

    </Box>
  );
};