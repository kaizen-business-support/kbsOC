import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Alert,
  Chip,
  Paper,
  Autocomplete,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Business as BusinessIcon,
  AccountBalance as BankIcon,
  BarChart as FinancialIcon,
  FolderOpen as DocumentIcon,
  RateReview as AnalysisIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Send as SubmitIcon,
  Delete as ClearIcon,
  Info as InfoIcon,
  CalendarToday as CalIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { RichTextEditor } from '../components/RichTextEditor';
import { DocumentManager } from '../components/DocumentManager';
import { FinancialDataInputTabs } from '../components/FinancialDataInputTabs';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { useFormDraft, loadFormDraft, clearFormDraft, hasSavedDraft } from '../hooks/useFormDraft';
import { OtpVerificationDialog } from '../components/OtpVerificationDialog';

const DRAFT_KEY = 'credit_application';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#f7f8fc';
const CARD_SHADOW = '0 2px 24px rgba(0,0,0,0.07)';
const CARD_RADIUS = 20;
const STEP_COLORS = ['#1565c0', '#0277bd', '#00695c', '#4527a0', '#c62828', '#2e7d32'];

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Client',        icon: BusinessIcon,  subtitle: 'Sélection du client' },
  { label: 'Crédit',        icon: BankIcon,       subtitle: 'Détails du financement' },
  { label: 'États financiers', icon: FinancialIcon, subtitle: 'Données comptables SYSCOHADA' },
  { label: 'Documents',     icon: DocumentIcon,   subtitle: 'Pièces justificatives' },
  { label: 'Analyse',       icon: AnalysisIcon,   subtitle: 'Évaluation préliminaire' },
  { label: 'Soumission',    icon: SubmitIcon,     subtitle: 'Récapitulatif & envoi' },
];

interface CreditApplicationPageProps {
  onNavigate: (page: any) => void;
}

interface ClientInfo {
  companyName: string; rccm: string; ninea: string; cofi: string;
  legalForm: string; sector: string; establishedYear: string;
  headquarters: string; contactPerson: string; phone: string; email: string;
}

interface CreditRequest {
  amount: number; currency: string; purpose: string; duration: number;
  proposedRate: number; collateralType: string; collateralValue: number;
  repaymentSchedule: string; creditTypeId: string;
}

// ─── Custom horizontal step indicator ─────────────────────────────────────────
const StepIndicator: React.FC<{
  steps: typeof STEPS; activeStep: number; isStepComplete: (i: number) => boolean;
}> = ({ steps, activeStep, isStepComplete }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 5, px: 1 }}>
    {steps.map((step, i) => {
      const done = isStepComplete(i) && i < activeStep;
      const active = i === activeStep;
      const color = STEP_COLORS[i];
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
            <Typography
              variant="caption"
              sx={{
                mt: 0.75, fontWeight: active ? 700 : 500,
                color: active ? color : done ? '#2e7d32' : '#94a3b8',
                textAlign: 'center', lineHeight: 1.2,
                display: { xs: 'none', sm: 'block' },
                fontSize: '0.7rem', letterSpacing: 0.2,
              }}
            >
              {step.label}
            </Typography>
          </Box>
          {i < steps.length - 1 && (
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

// ─── Section card wrapper ──────────────────────────────────────────────────────
const SectionCard: React.FC<{
  children: React.ReactNode; title?: string; icon?: React.ReactNode; accent?: string;
}> = ({ children, title, icon, accent = '#1565c0' }) => (
  <Card sx={{
    borderRadius: `${CARD_RADIUS}px`, boxShadow: CARD_SHADOW,
    border: '1px solid rgba(0,0,0,0.05)', mb: 3, overflow: 'visible',
  }}>
    {title && (
      <Box sx={{
        px: 3, pt: 2.5, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        {icon && (
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: `${accent}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </Box>
        )}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', letterSpacing: -0.2 }}>
          {title}
        </Typography>
      </Box>
    )}
    <CardContent sx={{ px: 3, pt: title ? 2 : 3, pb: '24px !important' }}>
      {children}
    </CardContent>
  </Card>
);

// ─── Field label helper ────────────────────────────────────────────────────────
const FieldBox: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <Box>
    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a2e', mt: 0.25 }}>
      {value || '—'}
    </Typography>
  </Box>
);

export const CreditApplicationPage: React.FC<CreditApplicationPageProps> = ({ onNavigate }) => {
  const { state: userState } = useUser();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  // Data
  const [clients, setClients] = useState<any[]>([]);
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [creditTypes, setCreditTypes] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedAnalystId, setSelectedAnalystId] = useState('');

  const [clientInfo, setClientInfo] = useState<ClientInfo>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.clientInfo ?? {
      companyName: '', rccm: '', ninea: '', cofi: '',
      legalForm: '', sector: '', establishedYear: '',
      headquarters: '', contactPerson: '', phone: '', email: '',
    };
  });

  const [creditRequest, setCreditRequest] = useState<CreditRequest>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.creditRequest ?? {
      amount: 0, currency: 'XOF', purpose: '', duration: 12,
      proposedRate: 0, collateralType: '', collateralValue: 0,
      repaymentSchedule: 'monthly', creditTypeId: '',
    };
  });

  const [preliminaryAnalysis, setPreliminaryAnalysis] = useState<string>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.preliminaryAnalysis ?? '';
  });

  // Financial
  const [referenceYear, setReferenceYear] = useState<number>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.referenceYear ?? new Date().getFullYear();
  });
  const [numberOfYears, setNumberOfYears] = useState<number>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.numberOfYears ?? 3;
  });
  const [financialData, setFinancialData] = useState<Record<number, any>>({});
  const [financialDocuments, setFinancialDocuments] = useState<any[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);

  // ── Brouillon ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!draftRestored && hasSavedDraft(DRAFT_KEY)) {
      const d = loadFormDraft<any>(DRAFT_KEY);
      if (d) {
        if (d.activeStep !== undefined) setActiveStep(d.activeStep);
        if (d.selectedClientId) setSelectedClientId(d.selectedClientId);
        if (d.selectedAnalystId) setSelectedAnalystId(d.selectedAnalystId);
        setShowDraftBanner(true);
      }
      setDraftRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFormDraft(DRAFT_KEY, {
    activeStep, selectedClientId, selectedAnalystId,
    clientInfo, creditRequest, preliminaryAnalysis,
    financialData, referenceYear, numberOfYears,
  });

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    ApiService.getClients().then(r => r.success && setClients(r.data || []));
    ApiService.getCreditAnalysts().then(r => r.success && setAnalysts(r.data || []));
    ApiService.getCreditTypes().then(r => r.success && setCreditTypes(r.data || []));
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleClientSelection = (client: any | null) => {
    if (client) {
      setSelectedClient(client);
      setSelectedClientId(client.id);
      setClientInfo({
        companyName: client.companyName || '', rccm: client.rccm || '',
        ninea: client.ninea || '', cofi: client.cofi || '',
        legalForm: client.legalForm || '', sector: client.sector || '',
        establishedYear: client.establishedYear?.toString() || '',
        headquarters: client.headquarters || '', contactPerson: client.contactPerson || '',
        phone: client.phone || '', email: client.email || '',
      });
    } else {
      setSelectedClient(null); setSelectedClientId('');
      setClientInfo({ companyName: '', rccm: '', ninea: '', cofi: '', legalForm: '', sector: '', establishedYear: '', headquarters: '', contactPerson: '', phone: '', email: '' });
    }
  };

  const handleDataInput = (year: number, data: any) =>
    setFinancialData(prev => ({ ...prev, [year]: data }));

  const handleFinancialDocumentUploaded = (document: any) =>
    setFinancialDocuments(prev => [...prev, { ...document, category: 'financial', uploadSource: 'financial_statements' }]);

  const isStepComplete = (step: number): boolean => {
    if (step === 0) return !!selectedClientId;
    if (step === 1) return !!(creditRequest.amount > 0 && creditRequest.purpose);
    return true;
  };

  const canGoNext = isStepComplete(activeStep);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amount);

  const handleSubmitApplication = async () => {
    if (!selectedClientId || !userState.currentUser?.id) return;
    setIsSubmitting(true);
    try {
      const result = await ApiService.createApplication({
        clientId: selectedClientId,
        amount: creditRequest.amount,
        currency: creditRequest.currency,
        purpose: creditRequest.purpose,
        durationMonths: creditRequest.duration,
        proposedRate: creditRequest.proposedRate,
        collateralType: creditRequest.collateralType,
        collateralValue: creditRequest.collateralValue,
        repaymentSchedule: creditRequest.repaymentSchedule,
        creditTypeId: creditRequest.creditTypeId || undefined,
        createdBy: userState.currentUser.id,
        assignedAnalystId: selectedAnalystId || undefined,
        analysisResults: {
          preliminaryAnalysis,
          // Wrap each year's flat data into the structure WorkflowDetailsDialog expects:
          // financialData[year].multiyear_data.N.data
          financialData: Object.fromEntries(
            Object.entries(financialData).map(([year, data]) => [
              year,
              { multiyear_data: { N: { data } }, ratios: null },
            ])
          ),
        },
      });

      if (result.success) {
        clearFormDraft(DRAFT_KEY);
        const realAppId = result.data?.id || (result.data as any)?.application?.id;
        if (realAppId && pendingDocuments.length > 0) {
          const token = localStorage.getItem('optimus_access_token');
          const apiPort = process.env.REACT_APP_API_PORT || '5007';
          const uploadUrl = `${window.location.protocol}//${window.location.hostname}:${apiPort}/api/documents/${realAppId}/upload`;
          for (const doc of pendingDocuments) {
            if (!doc.file) continue;
            const fd = new FormData();
            fd.append('documents', doc.file, doc.name);
            fd.append('category', (doc.category || 'other').toUpperCase());
            await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }).catch(console.error);
          }
        }
        onNavigate('workflow');
      } else {
        alert(`Erreur : ${result.error || 'Une erreur est survenue'}`);
      }
    } catch (e: any) {
      alert(`Erreur : ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCreditType = creditTypes.find(ct => ct.id === creditRequest.creditTypeId);
  const financialYears = Array.from({ length: numberOfYears }, (_, i) => referenceYear - i);
  const filledYears = financialYears.filter(y => !!financialData[y]).length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ bgcolor: BG, minHeight: '100vh', pb: 9 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${STEP_COLORS[activeStep]} 0%, ${STEP_COLORS[activeStep]}cc 100%)`,
        px: { xs: 2, md: 4 }, pt: 4, pb: 6,
        transition: 'background 0.5s ease',
      }}>
        {/* Draft banner */}
        {showDraftBanner && (
          <Alert
            severity="info"
            sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', '& .MuiAlert-icon': { color: 'white' } }}
            onClose={() => setShowDraftBanner(false)}
            action={
              <Button size="small" sx={{ color: 'white', fontWeight: 700 }}
                onClick={() => { clearFormDraft(DRAFT_KEY); setShowDraftBanner(false); window.location.reload(); }}>
                Ignorer
              </Button>
            }
          >
            Vos saisies précédentes ont été restaurées automatiquement.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 2, fontSize: '0.7rem' }}>
              NOUVELLE DEMANDE
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: -0.5 }}>
              Demande de Crédit
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
              {STEPS[activeStep].subtitle}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
              Étape {activeStep + 1} sur {STEPS.length}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'white' }}>
              {Math.round(((activeStep) / STEPS.length) * 100)}%
            </Typography>
          </Box>
        </Box>

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={(activeStep / STEPS.length) * 100}
          sx={{
            height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.25)',
            '& .MuiLinearProgress-bar': { bgcolor: 'white', borderRadius: 3 },
          }}
        />
      </Box>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, md: 4 }, mt: -3, maxWidth: 960, mx: 'auto' }}>

        {/* Step indicator */}
        <Card sx={{ borderRadius: `${CARD_RADIUS}px`, boxShadow: CARD_SHADOW, mb: 4, p: 3, border: '1px solid rgba(0,0,0,0.05)' }}>
          <StepIndicator steps={STEPS} activeStep={activeStep} isStepComplete={isStepComplete} />
        </Card>

        {/* ── STEP 0 : Client ─────────────────────────────────────────────────── */}
        {activeStep === 0 && (
          <Box>
            <SectionCard
              title="Sélectionner le client"
              icon={<BusinessIcon sx={{ fontSize: 18, color: STEP_COLORS[0] }} />}
              accent={STEP_COLORS[0]}
            >
              <Autocomplete
                fullWidth
                options={clients.filter(c => c.isActive)}
                getOptionLabel={c => `${c.companyName} — ${c.rccm || 'N/A'}`}
                value={selectedClient}
                onChange={(_, v) => handleClientSelection(v)}
                renderInput={params => (
                  <TextField {...params} label="Rechercher un client" placeholder="Nom ou RCCM…" />
                )}
                renderOption={(props, c) => (
                  <Box component="li" {...props} sx={{ py: 1.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{c.companyName}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.rccm} · {c.sector}</Typography>
                    </Box>
                  </Box>
                )}
                noOptionsText={
                  <Box sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Aucun client trouvé</Typography>
                    <Button size="small" onClick={() => onNavigate('clients')} variant="outlined">Créer un client</Button>
                  </Box>
                }
              />
            </SectionCard>

            {/* Client card */}
            {selectedClient && (
              <SectionCard
                title="Fiche client"
                icon={<CheckCircleIcon sx={{ fontSize: 18, color: '#2e7d32' }} />}
                accent="#2e7d32"
              >
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 2, mb: 3,
                  p: 2, borderRadius: 3, bgcolor: '#f0faf4', border: '1px solid #a5d6a7',
                }}>
                  <Avatar sx={{ bgcolor: '#2e7d32', width: 48, height: 48, fontWeight: 800, fontSize: '1.1rem' }}>
                    {selectedClient.companyName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={800} color="#1a1a2e">{selectedClient.companyName}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedClient.sector} · {selectedClient.legalForm}</Typography>
                  </Box>
                  <Chip label="Client actif" color="success" size="small" sx={{ ml: 'auto', fontWeight: 700 }} />
                </Box>

                <Grid container spacing={3}>
                  {[
                    { label: 'RCCM', value: selectedClient.rccm },
                    { label: 'NINEA', value: selectedClient.ninea },
                    { label: 'COFI', value: selectedClient.cofi },
                    { label: 'Siège social', value: selectedClient.headquarters },
                    { label: 'Fondée en', value: selectedClient.establishedYear },
                    { label: 'Contact', value: selectedClient.contactPerson },
                    { label: 'Téléphone', value: selectedClient.phone },
                    { label: 'Email', value: selectedClient.email },
                  ].map(f => (
                    <Grid item xs={6} sm={3} key={f.label}>
                      <FieldBox label={f.label} value={f.value} />
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>
            )}
          </Box>
        )}

        {/* ── STEP 1 : Crédit ─────────────────────────────────────────────────── */}
        {activeStep === 1 && (
          <Box>
            <SectionCard
              title="Type de financement"
              icon={<BankIcon sx={{ fontSize: 18, color: STEP_COLORS[1] }} />}
              accent={STEP_COLORS[1]}
            >
              <Grid container spacing={2}>
                {creditTypes.map(ct => (
                  <Grid item xs={12} sm={6} key={ct.id}>
                    <Box
                      onClick={() => setCreditRequest(r => ({ ...r, creditTypeId: ct.id }))}
                      sx={{
                        p: 2.5, borderRadius: 3, cursor: 'pointer',
                        border: '2px solid',
                        borderColor: creditRequest.creditTypeId === ct.id ? STEP_COLORS[1] : 'rgba(0,0,0,0.08)',
                        bgcolor: creditRequest.creditTypeId === ct.id ? `${STEP_COLORS[1]}08` : 'white',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: STEP_COLORS[1], transform: 'translateY(-2px)', boxShadow: `0 4px 16px ${STEP_COLORS[1]}20` },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700} color="#1a1a2e">{ct.name}</Typography>
                        {creditRequest.creditTypeId === ct.id && <CheckCircleIcon sx={{ fontSize: 18, color: STEP_COLORS[1] }} />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">{ct.description}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                        <Chip label={`${ct.defaultRate}%`} size="small" variant="outlined" />
                        {ct.minDuration && <Chip label={`${ct.minDuration}–${ct.maxDuration} mois`} size="small" variant="outlined" />}
                        {ct.requiresCollateral && <Chip label="Garantie requise" size="small" color="warning" variant="outlined" />}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </SectionCard>

            <SectionCard
              title="Paramètres du crédit"
              icon={<TimelineIcon sx={{ fontSize: 18, color: STEP_COLORS[1] }} />}
              accent={STEP_COLORS[1]}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Montant demandé *" type="number"
                    value={creditRequest.amount || ''}
                    onChange={e => setCreditRequest(r => ({ ...r, amount: Number(e.target.value) }))}
                    InputProps={{ endAdornment: <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>XOF</Typography> }}
                    helperText={creditRequest.amount > 0 ? formatCurrency(creditRequest.amount) : ' '}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Durée (mois)" type="number"
                    value={creditRequest.duration}
                    onChange={e => setCreditRequest(r => ({ ...r, duration: Number(e.target.value) }))}
                    helperText={creditRequest.duration ? `${Math.round(creditRequest.duration / 12 * 10) / 10} an(s)` : ' '}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Objet du crédit *" multiline rows={3}
                    value={creditRequest.purpose}
                    onChange={e => setCreditRequest(r => ({ ...r, purpose: e.target.value }))}
                    helperText="Décrivez précisément l'utilisation prévue des fonds"
                    placeholder="Ex : Financement du fonds de roulement pour l'extension des activités…"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Taux proposé (%)" type="number"
                    value={creditRequest.proposedRate || ''}
                    onChange={e => setCreditRequest(r => ({ ...r, proposedRate: Number(e.target.value) }))}
                    inputProps={{ step: '0.1' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Modalité de remboursement</InputLabel>
                    <Select value={creditRequest.repaymentSchedule} label="Modalité de remboursement"
                      onChange={e => setCreditRequest(r => ({ ...r, repaymentSchedule: e.target.value }))}>
                      <MenuItem value="monthly">Mensuelle</MenuItem>
                      <MenuItem value="quarterly">Trimestrielle</MenuItem>
                      <MenuItem value="semiannual">Semestrielle</MenuItem>
                      <MenuItem value="annual">Annuelle</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Type de garantie"
                    value={creditRequest.collateralType}
                    onChange={e => setCreditRequest(r => ({ ...r, collateralType: e.target.value }))}
                    placeholder="Ex : Hypothèque, Nantissement, Caution…"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Valeur de la garantie" type="number"
                    value={creditRequest.collateralValue || ''}
                    onChange={e => setCreditRequest(r => ({ ...r, collateralValue: Number(e.target.value) }))}
                    InputProps={{ endAdornment: <Typography variant="body2" color="text.secondary">XOF</Typography> }}
                  />
                </Grid>
              </Grid>

              {/* Summary pill */}
              {creditRequest.amount > 0 && creditRequest.purpose && (
                <Box sx={{ mt: 3, p: 2.5, borderRadius: 3, bgcolor: `${STEP_COLORS[1]}08`, border: `1px solid ${STEP_COLORS[1]}30` }}>
                  <Typography variant="caption" sx={{ color: STEP_COLORS[1], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Récapitulatif
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: '#1a1a2e' }}>
                    <strong>{formatCurrency(creditRequest.amount)}</strong> sur <strong>{creditRequest.duration} mois</strong> — {creditRequest.purpose}
                  </Typography>
                </Box>
              )}
            </SectionCard>
          </Box>
        )}

        {/* ── STEP 2 : États financiers ────────────────────────────────────────── */}
        {activeStep === 2 && (
          <Box>
            {/* Year & period config */}
            <SectionCard
              title="Paramètres de l'analyse"
              icon={<CalIcon sx={{ fontSize: 18, color: STEP_COLORS[2] }} />}
              accent={STEP_COLORS[2]}
            >
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <FormControl fullWidth>
                    <InputLabel>Année N (exercice de référence)</InputLabel>
                    <Select
                      value={referenceYear}
                      label="Année N (exercice de référence)"
                      onChange={e => { setReferenceYear(e.target.value as number); setFinancialData({}); }}
                    >
                      {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <MenuItem key={y} value={y}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography fontWeight={700}>{y}</Typography>
                            {y === new Date().getFullYear() && <Chip label="Actuelle" size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Exercices antérieurs</InputLabel>
                    <Select
                      value={numberOfYears - 1}
                      label="Exercices antérieurs"
                      onChange={e => { setNumberOfYears((e.target.value as number) + 1); setFinancialData({}); }}
                    >
                      <MenuItem value={1}>N-1 (2 exercices)</MenuItem>
                      <MenuItem value={2}>N-1 et N-2 (3 exercices)</MenuItem>
                      <MenuItem value={3}>N-1, N-2 et N-3 (4 exercices)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
                      Exercices couverts
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      {financialYears.map((y, i) => (
                        <Chip
                          key={y}
                          label={i === 0 ? `${y} (N)` : `${y} (N-${i})`}
                          size="small"
                          color={financialData[y] ? 'success' : 'default'}
                          variant={financialData[y] ? 'filled' : 'outlined'}
                          icon={financialData[y] ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : undefined}
                          sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {/* Completion progress */}
              {financialYears.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Progression des saisies
                    </Typography>
                    <Typography variant="caption" color={filledYears === financialYears.length ? 'success.main' : 'text.secondary'} fontWeight={700}>
                      {filledYears}/{financialYears.length} exercices
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(filledYears / financialYears.length) * 100}
                    sx={{
                      height: 6, borderRadius: 3,
                      bgcolor: '#e8ecf0',
                      '& .MuiLinearProgress-bar': { bgcolor: filledYears === financialYears.length ? '#2e7d32' : STEP_COLORS[2], borderRadius: 3 },
                    }}
                  />
                </Box>
              )}
            </SectionCard>

            {/* Financial input */}
            <SectionCard
              title={`États financiers SYSCOHADA — ${referenceYear} à ${referenceYear - (numberOfYears - 1)}`}
              icon={<FinancialIcon sx={{ fontSize: 18, color: STEP_COLORS[2] }} />}
              accent={STEP_COLORS[2]}
            >
              <FinancialDataInputTabs
                referenceYear={referenceYear}
                numberOfYears={numberOfYears}
                selectedSector={clientInfo.sector || 'general'}
                currency="XOF"
                onDataInput={handleDataInput}
                financialData={financialData}
                onDocumentUploaded={handleFinancialDocumentUploaded}
              />
            </SectionCard>
          </Box>
        )}

        {/* ── STEP 3 : Documents ───────────────────────────────────────────────── */}
        {activeStep === 3 && (
          <SectionCard
            title="Documents justificatifs"
            icon={<DocumentIcon sx={{ fontSize: 18, color: STEP_COLORS[3] }} />}
            accent={STEP_COLORS[3]}
          >
            {financialDocuments.length > 0 && (
              <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>
                {financialDocuments.length} document(s) financier(s) importé(s) depuis l'étape précédente.
              </Alert>
            )}
            <DocumentManager
              clientId={selectedClientId || 'new'}
              initialDocuments={financialDocuments}
              onDocumentsChange={setPendingDocuments}
              onDocumentProcessed={() => {}}
            />
          </SectionCard>
        )}

        {/* ── STEP 4 : Analyse préliminaire ────────────────────────────────────── */}
        {activeStep === 4 && (
          <SectionCard
            title="Analyse préliminaire du chargé d'affaires"
            icon={<AnalysisIcon sx={{ fontSize: 18, color: STEP_COLORS[4] }} />}
            accent={STEP_COLORS[4]}
          >
            <Alert severity="info" sx={{ mb: 3, borderRadius: 3, bgcolor: `${STEP_COLORS[4]}0d`, border: `1px solid ${STEP_COLORS[4]}30`, '& .MuiAlert-icon': { color: STEP_COLORS[4] } }}>
              Cette analyse sera transmise avec le dossier au service crédit. Elle doit contenir votre évaluation
              initiale du risque, la pertinence du projet et vos recommandations.
            </Alert>
            <RichTextEditor
              value={preliminaryAnalysis}
              onChange={setPreliminaryAnalysis}
              placeholder="Rédigez votre analyse : évaluation du risque, capacité de remboursement estimée, recommandations…"
              height={320}
              label="Analyse et recommandations"
            />
          </SectionCard>
        )}

        {/* ── STEP 5 : Récapitulatif & soumission ──────────────────────────────── */}
        {activeStep === 5 && (
          <Box>
            {/* Client */}
            <SectionCard
              title="Client"
              icon={<BusinessIcon sx={{ fontSize: 18, color: STEP_COLORS[0] }} />}
              accent={STEP_COLORS[0]}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: STEP_COLORS[0], width: 44, height: 44, fontWeight: 800 }}>
                  {clientInfo.companyName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>{clientInfo.companyName}</Typography>
                  <Typography variant="body2" color="text.secondary">{clientInfo.sector} · {clientInfo.legalForm}</Typography>
                </Box>
              </Box>
              <Grid container spacing={2}>
                {[
                  { label: 'RCCM', value: clientInfo.rccm },
                  { label: 'NINEA', value: clientInfo.ninea },
                  { label: 'Contact', value: clientInfo.contactPerson },
                  { label: 'Siège', value: clientInfo.headquarters },
                ].map(f => <Grid item xs={6} sm={3} key={f.label}><FieldBox label={f.label} value={f.value} /></Grid>)}
              </Grid>
            </SectionCard>

            {/* Crédit */}
            <SectionCard
              title="Financement"
              icon={<BankIcon sx={{ fontSize: 18, color: STEP_COLORS[1] }} />}
              accent={STEP_COLORS[1]}
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ p: 3, borderRadius: 3, background: `linear-gradient(135deg, ${STEP_COLORS[1]}15, ${STEP_COLORS[1]}08)`, border: `1px solid ${STEP_COLORS[1]}25` }}>
                    <Typography variant="h4" fontWeight={800} color={STEP_COLORS[1]}>{formatCurrency(creditRequest.amount)}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{creditRequest.purpose}</Typography>
                  </Box>
                </Grid>
                {[
                  { label: 'Durée', value: `${creditRequest.duration} mois` },
                  { label: 'Taux proposé', value: creditRequest.proposedRate ? `${creditRequest.proposedRate}%` : '—' },
                  { label: 'Remboursement', value: { monthly: 'Mensuel', quarterly: 'Trimestriel', semiannual: 'Semestriel', annual: 'Annuel' }[creditRequest.repaymentSchedule] || '—' },
                  { label: 'Garantie', value: creditRequest.collateralType || '—' },
                  { label: 'Type de crédit', value: selectedCreditType?.name || '—' },
                  { label: 'Valeur garantie', value: creditRequest.collateralValue ? formatCurrency(creditRequest.collateralValue) : '—' },
                ].map(f => <Grid item xs={6} sm={4} key={f.label}><FieldBox label={f.label} value={f.value as string} /></Grid>)}
              </Grid>
            </SectionCard>

            {/* États financiers */}
            <SectionCard
              title="États financiers"
              icon={<FinancialIcon sx={{ fontSize: 18, color: STEP_COLORS[2] }} />}
              accent={STEP_COLORS[2]}
            >
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {financialYears.map((y, i) => (
                  <Box key={y} sx={{
                    px: 3, py: 2, borderRadius: 3,
                    bgcolor: financialData[y] ? '#e8f5e9' : '#f8f9fa',
                    border: `1px solid ${financialData[y] ? '#a5d6a7' : '#e2e8f0'}`,
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}>
                    {financialData[y]
                      ? <CheckCircleIcon sx={{ fontSize: 20, color: '#2e7d32' }} />
                      : <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #cbd5e1' }} />
                    }
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>{y}</Typography>
                      <Typography variant="caption" color="text.secondary">{i === 0 ? 'N' : `N-${i}`}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </SectionCard>

            {/* Analyst */}
            <SectionCard
              title="Attribution de l'analyste crédit"
              icon={<CheckCircleIcon sx={{ fontSize: 18, color: '#2e7d32' }} />}
              accent="#2e7d32"
            >
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Analyste crédit assigné</InputLabel>
                    <Select value={selectedAnalystId} label="Analyste crédit assigné"
                      onChange={e => setSelectedAnalystId(e.target.value)}>
                      <MenuItem value=""><em>Sélectionner un analyste</em></MenuItem>
                      {analysts.map(a => (
                        <MenuItem key={a.id} value={a.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: STEP_COLORS[2] }}>{a.name?.[0]}</Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{a.department || 'Risques'}</Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    L'analyste recevra le dossier pour notation approfondie.
                  </Alert>
                </Grid>
              </Grid>

              <Box sx={{
                mt: 3, p: 3, borderRadius: 3,
                background: 'linear-gradient(135deg, #e8f5e9, #f0faf4)',
                border: '1px solid #a5d6a7',
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} color="#1b5e20">Dossier prêt à soumettre</Typography>
                  <Typography variant="body2" color="#388e3c">
                    Le workflow d'approbation sera automatiquement initié à la soumission.
                  </Typography>
                </Box>
              </Box>
            </SectionCard>
          </Box>
        )}
      </Box>

      {/* ── Sticky bottom navigation ──────────────────────────────────────────── */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
        bgcolor: 'white',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
        px: { xs: 2, md: 4 }, py: 2,
      }}>
        <Box sx={{ maxWidth: 960, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => onNavigate('clients')}
              sx={{ borderRadius: 3, borderColor: 'rgba(0,0,0,0.15)', color: 'text.secondary' }}
            >
              Annuler
            </Button>
            {activeStep > 0 && (
              <Button
                startIcon={<BackIcon />}
                onClick={() => setActiveStep(s => s - 1)}
                sx={{ borderRadius: 3 }}
              >
                Précédent
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Step dots */}
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {STEPS.map((_, i) => (
                <Box key={i} sx={{
                  width: i === activeStep ? 20 : 8, height: 8,
                  borderRadius: 4,
                  bgcolor: i === activeStep ? STEP_COLORS[activeStep] : isStepComplete(i) ? '#a5d6a7' : '#e2e8f0',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </Box>

            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={() => setActiveStep(s => s + 1)}
                disabled={!canGoNext}
                sx={{
                  borderRadius: 3, px: 4, fontWeight: 700,
                  background: `linear-gradient(135deg, ${STEP_COLORS[activeStep]}, ${STEP_COLORS[activeStep]}cc)`,
                  boxShadow: `0 4px 16px ${STEP_COLORS[activeStep]}40`,
                  '&:hover': { boxShadow: `0 6px 20px ${STEP_COLORS[activeStep]}60` },
                  '&:disabled': { background: '#e2e8f0', boxShadow: 'none' },
                }}
              >
                Suivant
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<SubmitIcon />}
                onClick={() => setOtpOpen(true)}
                disabled={isSubmitting}
                sx={{
                  borderRadius: 3, px: 4, fontWeight: 700,
                  background: 'linear-gradient(135deg, #2e7d32, #388e3c)',
                  boxShadow: '0 4px 16px rgba(46,125,50,0.4)',
                  '&:hover': { boxShadow: '0 6px 20px rgba(46,125,50,0.6)' },
                }}
              >
                {isSubmitting ? 'Envoi en cours…' : 'Soumettre le dossier'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* OTP */}
      <OtpVerificationDialog
        open={otpOpen}
        actionLabel="Soumettre la demande de crédit"
        purpose="submit_application"
        onClose={() => setOtpOpen(false)}
        onVerified={handleSubmitApplication}
      />
    </Box>
  );
};
