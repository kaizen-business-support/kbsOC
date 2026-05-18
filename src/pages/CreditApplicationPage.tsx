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
  Autocomplete,
  LinearProgress,
  Backdrop,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Business as BusinessIcon,
  AccountBalance as BankIcon,
  BarChart as FinancialIcon,
  FolderOpen as DocumentIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Send as SubmitIcon,
  Info as InfoIcon,
  CalendarToday as CalIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { DocumentManager } from '../components/DocumentManager';
import { FinancialDataInputTabs } from '../components/FinancialDataInputTabs';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';
import { useFormDraft, loadFormDraft, clearFormDraft, hasSavedDraft } from '../hooks/useFormDraft';
import { OtpVerificationDialog } from '../components/OtpVerificationDialog';
import { useSecurityLock } from '../hooks/useSecurityLock';

const DRAFT_KEY = 'credit_application';

// Bornes de validation (alignées avec le backend POST /api/applications)
const AMOUNT_CAP = 100_000_000_000; // 100 milliards XOF
const PURPOSE_MIN_LEN = 20;
const PURPOSE_MAX_LEN = 1000;

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#f7f8fc';
const CARD_SHADOW = '0 2px 24px rgba(0,0,0,0.07)';
const CARD_RADIUS = 20;
const STEP_COLORS = ['#1565c0', '#0277bd', '#00695c', '#4527a0', '#2e7d32'];

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Client',        icon: BusinessIcon,  subtitle: 'Sélection du client' },
  { label: 'Crédit',        icon: BankIcon,       subtitle: 'Détails du financement' },
  { label: 'États financiers', icon: FinancialIcon, subtitle: 'Données comptables SYSCOHADA' },
  { label: 'Documents',     icon: DocumentIcon,   subtitle: 'Pièces justificatives' },
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
  const { state: userState, getRoleLabel } = useUser();
  const { activeCompany } = useCompany();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { disabled: lockDisabled, reason: lockReason } = useSecurityLock();
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadErrorDialog, setUploadErrorDialog] = useState<{ open: boolean; failed: number; applicationId: string | null }>({
    open: false, failed: 0, applicationId: null,
  });
  const [creationPermission, setCreationPermission] = useState<{
    canCreate: boolean | null;
    requiredRole: string | null;
    requiredRoleLabel: string | null;
  }>({ canCreate: null, requiredRole: null, requiredRoleLabel: null });

  // Data
  const [clients, setClients] = useState<any[]>([]);

  const [creditTypes, setCreditTypes] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');


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

  const [preliminaryAnalysis] = useState<string>(() => {
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
  const [financialData, setFinancialData] = useState<Record<number, any>>(() => {
    const d = loadFormDraft<any>(DRAFT_KEY);
    return d?.financialData ?? {};
  });
  const [financialDocuments, setFinancialDocuments] = useState<any[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);

  // ── Brouillon ────────────────────────────────────────────────────────────────
  const [draftHadDocuments, setDraftHadDocuments] = useState(false);

  useEffect(() => {
    if (!draftRestored && hasSavedDraft(DRAFT_KEY)) {
      const d = loadFormDraft<any>(DRAFT_KEY);
      if (d) {
        if (d.activeStep !== undefined) setActiveStep(d.activeStep);
        if (d.selectedClientId) setSelectedClientId(d.selectedClientId);
        // L'utilisateur avait atteint l'étape documents ou au-delà → on l'avertit
        // que les pièces uploadées localement ne sont pas restaurables.
        if (d.activeStep !== undefined && d.activeStep >= 3) {
          setDraftHadDocuments(true);
        }
        setShowDraftBanner(true);
      }
      setDraftRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFormDraft(DRAFT_KEY, {
    activeStep, selectedClientId,
    clientInfo, creditRequest, preliminaryAnalysis,
    financialData, referenceYear, numberOfYears,
  });

  // ── Vérification permission création ─────────────────────────────────────────
  // Reset l'état du wizard au changement de société active (cloisonnement multi-tenant)
  // pour éviter qu'un client / type de crédit / draft d'une société A subsiste sur B.
  const previousCompanyIdRef = React.useRef<string | undefined>(activeCompany?.id);
  useEffect(() => {
    const prev = previousCompanyIdRef.current;
    const curr = activeCompany?.id;
    if (prev !== undefined && curr !== undefined && prev !== curr) {
      // Le user a basculé de société — on purge brouillon + sélections
      clearFormDraft(DRAFT_KEY);
      setActiveStep(0);
      setSelectedClient(null);
      setSelectedClientId('');
      setCreditRequest(r => ({ ...r, creditTypeId: '', amount: 0, purpose: '' }));
      setFinancialData({});
      setFinancialDocuments([]);
      setPendingDocuments([]);
      setShowDraftBanner(false);
    }
    previousCompanyIdRef.current = curr;

    setCreationPermission({ canCreate: null, requiredRole: null, requiredRoleLabel: null });
    ApiService.getCreationPermission().then(r => {
      if (r.success && r.data) {
        setCreationPermission({
          canCreate: r.data.canCreate,
          requiredRole: r.data.requiredRole,
          requiredRoleLabel: r.data.requiredRoleLabel,
        });
      } else {
        // Erreur API : on bloque par défaut — le backend est le vrai garde-fou.
        setCreationPermission({ canCreate: false, requiredRole: null, requiredRoleLabel: null });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id]);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    ApiService.getClients().then(r => {
      if (r.success) {
        const loaded = r.data || [];
        setClients(loaded);
        // Invalider le clientId du brouillon s'il n'existe plus dans cette company
        setSelectedClientId(prev => {
          if (prev && !loaded.find((c: any) => c.id === prev)) return '';
          return prev;
        });
      }
    });
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

  // ── Validation de l'étape Crédit ─────────────────────────────────────────────
  const selectedCreditTypeForValidation = creditTypes.find(ct => ct.id === creditRequest.creditTypeId);
  const validateStep1 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const ct = selectedCreditTypeForValidation;

    if (!creditRequest.creditTypeId) {
      errs.creditTypeId = 'Sélectionnez un type de financement.';
    }

    if (!creditRequest.amount || creditRequest.amount <= 0) {
      errs.amount = 'Le montant doit être strictement positif.';
    } else if (!Number.isInteger(creditRequest.amount)) {
      errs.amount = 'Le montant doit être un entier (sans décimales).';
    } else if (creditRequest.amount > AMOUNT_CAP) {
      errs.amount = `Le montant ne peut pas dépasser ${AMOUNT_CAP.toLocaleString('fr-FR')} XOF.`;
    }

    const purposeLen = creditRequest.purpose?.trim().length || 0;
    if (purposeLen === 0) {
      errs.purpose = "L'objet du crédit est obligatoire.";
    } else if (purposeLen < PURPOSE_MIN_LEN) {
      errs.purpose = `Décrivez l'objet en au moins ${PURPOSE_MIN_LEN} caractères (${purposeLen}/${PURPOSE_MIN_LEN}).`;
    } else if (purposeLen > PURPOSE_MAX_LEN) {
      errs.purpose = `L'objet est trop long (${purposeLen}/${PURPOSE_MAX_LEN} max).`;
    }

    if (!Number.isInteger(creditRequest.duration) || creditRequest.duration < 1) {
      errs.duration = 'La durée doit être un entier ≥ 1 mois.';
    } else if (ct?.minDuration != null && creditRequest.duration < ct.minDuration) {
      errs.duration = `Durée inférieure au minimum (${ct.minDuration} mois).`;
    } else if (ct?.maxDuration != null && creditRequest.duration > ct.maxDuration) {
      errs.duration = `Durée supérieure au maximum (${ct.maxDuration} mois).`;
    }

    if (creditRequest.proposedRate < 0) {
      errs.proposedRate = 'Le taux ne peut pas être négatif.';
    } else if (ct?.minRate != null && creditRequest.proposedRate > 0 && creditRequest.proposedRate < Number(ct.minRate)) {
      errs.proposedRate = `Taux inférieur au minimum (${ct.minRate} %).`;
    } else if (ct?.maxRate != null && creditRequest.proposedRate > Number(ct.maxRate)) {
      errs.proposedRate = `Taux supérieur au maximum (${ct.maxRate} %).`;
    } else if (creditRequest.proposedRate && Math.round(creditRequest.proposedRate * 100) !== creditRequest.proposedRate * 100) {
      errs.proposedRate = 'Maximum 2 décimales.';
    }

    if (ct?.requiresCollateral) {
      if (!creditRequest.collateralType?.trim()) {
        errs.collateralType = 'Le type de garantie est obligatoire pour ce type de crédit.';
      }
      if (!creditRequest.collateralValue || creditRequest.collateralValue <= 0) {
        errs.collateralValue = 'La valeur de la garantie est obligatoire et doit être > 0.';
      }
    }

    return errs;
  };

  const step1Errors = validateStep1();

  // Indicateurs clés requis pour considérer un exercice comptable comme "saisi".
  const REQUIRED_FINANCIAL_KEYS = [
    'chiffre_affaires', 'resultat_net', 'total_actif', 'capitaux_propres', 'dettes_financieres',
  ];

  const isYearComplete = (year: number): boolean => {
    const entry = financialData[year];
    if (!entry) return false;
    const d = entry?.multiyear_data?.N?.data ?? entry;
    return REQUIRED_FINANCIAL_KEYS.every(k => {
      const v = d?.[k];
      return v != null && v !== '' && Number(v) !== 0;
    });
  };

  const completedYearsCount = (): number => {
    const referenceYearsArr = Array.from({ length: numberOfYears }, (_, i) => referenceYear - i);
    return referenceYearsArr.filter(isYearComplete).length;
  };

  const isStepComplete = (step: number): boolean => {
    if (step === 0) return !!selectedClientId;
    if (step === 1) return Object.keys(step1Errors).length === 0;
    // Étape 2 : exiger au moins 2 exercices complets (N + N-1) avec les 5 indicateurs clés.
    if (step === 2) return completedYearsCount() >= 2;
    // Étape 3 : avertissement non-bloquant — voir le panneau « Pièces recommandées ».
    if (step === 3) return true;
    return true;
  };

  // Étape 4 : la soumission est autorisée uniquement si toutes les étapes 0-3 sont valides.
  const canSubmitApplication =
    isStepComplete(0) && isStepComplete(1) && isStepComplete(2) && isStepComplete(3);

  const canGoNext = isStepComplete(activeStep);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amount);

  const handleSubmitApplication = async () => {
    setSubmitError(null);
    if (!selectedClientId) { setSubmitError('Aucun client sélectionné. Veuillez sélectionner un client.'); return; }
    if (!userState.currentUser?.id) { setSubmitError('Session expirée. Veuillez vous reconnecter.'); return; }
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

        analysisResults: {
          preliminaryAnalysis,
          financialData: Object.fromEntries(
            Object.entries(financialData).map(([year, data]) => [
              year,
              { multiyear_data: { N: { data } }, ratios: null },
            ])
          ),
        },
      });

      if (!result.success) {
        setSubmitError(result.error || 'Erreur lors de la création de la demande');
        return;
      }

      const realAppId = result.data?.id || (result.data as any)?.application?.id;
      let uploadErrors = 0;
      if (realAppId && pendingDocuments.length > 0) {
        const token = localStorage.getItem('optimus_access_token');
        const uploadUrl = `${window.location.origin}/api/documents/${realAppId}/upload`;
        for (const doc of pendingDocuments) {
          if (!doc.file) continue;
          const fd = new FormData();
          fd.append('documents', doc.file, doc.name);
          fd.append('category', (doc.category || 'other').toUpperCase());
          try {
            const up = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
            if (!up.ok) {
              uploadErrors++;
              const err = await up.json().catch(() => ({}));
              console.error('Upload failed:', up.status, err);
            }
          } catch (e) {
            uploadErrors++;
            console.error('Upload network error:', e);
          }
        }
      }

      // Si des documents ont échoué, demander confirmation à l'utilisateur avant de naviguer.
      if (uploadErrors > 0) {
        setUploadErrorDialog({ open: true, failed: uploadErrors, applicationId: realAppId });
      } else {
        clearFormDraft(DRAFT_KEY);
        onNavigate('workflow');
      }
    } catch (e: any) {
      setSubmitError(e?.message || 'Erreur inattendue lors de la création de la demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCreditType = creditTypes.find(ct => ct.id === creditRequest.creditTypeId);
  const financialYears = Array.from({ length: numberOfYears }, (_, i) => referenceYear - i);
  const filledYears = financialYears.filter(y => !!financialData[y]).length;

  // ── Loader plein écran tant que la permission de création n'est pas connue ───
  if (creationPermission.canCreate === null) {
    return (
      <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">Vérification de vos droits…</Typography>
        <Box sx={{ width: 240 }}>
          <LinearProgress />
        </Box>
      </Box>
    );
  }

  // ── Blocage si le rôle ne correspond pas à l'étape de création ───────────────
  if (creationPermission.canCreate === false) {
    const hasRoleInfo = !!creationPermission.requiredRole;
    const roleLabel = creationPermission.requiredRoleLabel || creationPermission.requiredRole || '';
    const userRoleLabel = userState.currentUser?.role ? getRoleLabel(userState.currentUser.role) : '';
    return (
      <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Box sx={{ maxWidth: 540, width: '100%' }}>
          <Alert
            severity={hasRoleInfo ? 'warning' : 'error'}
            icon={<InfoIcon fontSize="large" />}
            sx={{ borderRadius: 3, py: 3, px: 3, boxShadow: CARD_SHADOW, '& .MuiAlert-message': { width: '100%' } }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              {hasRoleInfo ? 'Accès restreint par la politique de crédit' : 'Vérification des droits impossible'}
            </Typography>
            {hasRoleInfo ? (
              <>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  La politique de crédit active réserve la création de demandes au rôle <strong>{roleLabel}</strong>.
                </Typography>
                {userRoleLabel && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Votre rôle (<strong>{userRoleLabel}</strong>) ne vous donne pas accès à cette étape.
                    Contactez votre administrateur.
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2">
                Impossible de contacter le serveur pour vérifier vos droits. Vérifiez votre connexion et réessayez.
              </Typography>
            )}
          </Alert>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
            {!hasRoleInfo && (
              <Button variant="contained" onClick={() => window.location.reload()} sx={{ borderRadius: 2 }}>
                Réessayer
              </Button>
            )}
            <Button variant="outlined" onClick={() => onNavigate('workflows')} sx={{ borderRadius: 2 }}>
              Retour au suivi des dossiers
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

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
            {draftHadDocuments && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}>
                ⚠️ Les documents joints n'ont pas pu être restaurés, veuillez les re-téléverser à l'étape « Documents ».
              </Typography>
            )}
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
                      onClick={() => setCreditRequest(r => ({
                        ...r,
                        creditTypeId: ct.id,
                        // Pré-remplir le taux par défaut si l'utilisateur n'a pas encore saisi de taux.
                        proposedRate: r.proposedRate && r.proposedRate > 0
                          ? r.proposedRate
                          : Number(ct.defaultRate) || 0,
                        // Pré-remplir la durée min si la valeur actuelle est la valeur par défaut (12).
                        duration: r.duration && r.duration !== 12
                          ? r.duration
                          : (ct.minDuration ?? 12),
                      }))}
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
              {!creditRequest.creditTypeId && (
                <Typography variant="caption" color="error" sx={{ mt: 1.5, display: 'block', fontWeight: 600 }}>
                  Sélectionnez un type de financement pour continuer — il détermine le circuit d'approbation applicable.
                </Typography>
              )}
            </SectionCard>

            {selectedCreditType?.requiresCollateral && (
              <Alert
                severity="warning"
                icon={<InfoIcon />}
                sx={{ mb: 3, borderRadius: 3 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Garantie obligatoire
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ce type de crédit ({selectedCreditType.name}) exige une garantie. Renseignez le type et la valeur de la garantie ci-dessous.
                </Typography>
              </Alert>
            )}

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
                    inputProps={{ min: 1, max: AMOUNT_CAP, step: 1 }}
                    error={!!step1Errors.amount}
                    helperText={step1Errors.amount || (creditRequest.amount > 0 ? formatCurrency(creditRequest.amount) : ' ')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Durée (mois) *" type="number"
                    value={creditRequest.duration}
                    onChange={e => setCreditRequest(r => ({ ...r, duration: Number(e.target.value) }))}
                    inputProps={{ min: 1, step: 1 }}
                    error={!!step1Errors.duration}
                    helperText={step1Errors.duration || (() => {
                      const min = selectedCreditType?.minDuration;
                      const max = selectedCreditType?.maxDuration;
                      const range = (min != null && max != null) ? `Plage autorisée : ${min}–${max} mois` : '';
                      const yrs = creditRequest.duration ? `${Math.round(creditRequest.duration / 12 * 10) / 10} an(s)` : '';
                      return [range, yrs].filter(Boolean).join(' · ') || ' ';
                    })()}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Objet du crédit *" multiline rows={3}
                    value={creditRequest.purpose}
                    onChange={e => setCreditRequest(r => ({ ...r, purpose: e.target.value.slice(0, PURPOSE_MAX_LEN) }))}
                    inputProps={{ maxLength: PURPOSE_MAX_LEN }}
                    error={!!step1Errors.purpose}
                    helperText={
                      step1Errors.purpose
                        || `Décrivez précisément l'utilisation prévue des fonds — ${creditRequest.purpose.length}/${PURPOSE_MAX_LEN} caractères`
                    }
                    placeholder="Ex : Financement du fonds de roulement pour l'extension des activités…"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Taux proposé (%)" type="number"
                    value={creditRequest.proposedRate || ''}
                    onChange={e => setCreditRequest(r => ({ ...r, proposedRate: Number(e.target.value) }))}
                    inputProps={{ step: '0.01', min: 0 }}
                    error={!!step1Errors.proposedRate}
                    helperText={step1Errors.proposedRate || (() => {
                      const min = selectedCreditType?.minRate;
                      const max = selectedCreditType?.maxRate;
                      if (min != null && max != null) return `Plage autorisée : ${min}–${max} %`;
                      if (selectedCreditType?.defaultRate != null) return `Taux par défaut : ${selectedCreditType.defaultRate} %`;
                      return ' ';
                    })()}
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
                    fullWidth
                    label={selectedCreditType?.requiresCollateral ? 'Type de garantie *' : 'Type de garantie'}
                    value={creditRequest.collateralType}
                    onChange={e => setCreditRequest(r => ({ ...r, collateralType: e.target.value }))}
                    placeholder="Ex : Hypothèque, Nantissement, Caution…"
                    error={!!step1Errors.collateralType}
                    helperText={step1Errors.collateralType || ' '}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={selectedCreditType?.requiresCollateral ? 'Valeur de la garantie *' : 'Valeur de la garantie'}
                    type="number"
                    value={creditRequest.collateralValue || ''}
                    onChange={e => setCreditRequest(r => ({ ...r, collateralValue: Number(e.target.value) }))}
                    InputProps={{ endAdornment: <Typography variant="body2" color="text.secondary">XOF</Typography> }}
                    inputProps={{ min: 0 }}
                    error={!!step1Errors.collateralValue}
                    helperText={step1Errors.collateralValue || ' '}
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

            {/* Avertissement bloquant : min 2 exercices complets requis */}
            {completedYearsCount() < 2 && (
              <Alert severity="info" sx={{ mb: 3, borderRadius: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Saisissez au moins 2 exercices complets (N et N-1) pour continuer.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Indicateurs requis par exercice : chiffre d'affaires, résultat net, total actif, capitaux propres, dettes financières.
                  Actuellement {completedYearsCount()} exercice(s) complet(s).
                </Typography>
              </Alert>
            )}

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
        {activeStep === 3 && (() => {
          const allDocs = [...financialDocuments, ...pendingDocuments];
          const hasFinancial = allDocs.some(d => (d.category || '').toLowerCase() === 'financial' || (d.category || '').toLowerCase() === 'financial_statements');
          const hasLegal = allDocs.some(d => (d.category || '').toLowerCase() === 'legal');
          const missing: string[] = [];
          if (!hasFinancial) missing.push('États financiers (FINANCIAL_STATEMENTS)');
          if (!hasLegal) missing.push('Documents juridiques (LEGAL) — RCCM, statuts');
          return (
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

              {/* Panneau « Pièces recommandées » — avertissement non-bloquant */}
              {missing.length > 0 && (
                <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Pièces recommandées manquantes
                  </Typography>
                  <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                    Vous pouvez continuer sans elles, mais elles seront probablement réclamées plus tard par les analystes :
                  </Typography>
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {missing.map(m => (
                      <li key={m}><Typography variant="caption">{m}</Typography></li>
                    ))}
                  </Box>
                </Alert>
              )}

              <DocumentManager
                clientId={selectedClientId || 'new'}
                initialDocuments={financialDocuments}
                onDocumentsChange={setPendingDocuments}
              />
            </SectionCard>
          );
        })()}

        {/* ── STEP 4 : Récapitulatif & soumission ──────────────────────────────── */}
        {activeStep === 4 && (
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
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: filledYears > 0 ? 3 : 0 }}>
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

              {/* Détail des indicateurs et ratios (en complément des pills ci-dessus) */}
              {filledYears > 0 && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Box
                    component="table"
                    sx={{
                      width: '100%', borderCollapse: 'collapse',
                      '& th, & td': { px: 2, py: 1.25, textAlign: 'right', fontSize: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.06)' },
                      '& th': { fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem', bgcolor: '#f8fafc' },
                      '& td:first-of-type, & th:first-of-type': { textAlign: 'left' },
                      '& tr:last-child td': { borderBottom: 'none' },
                      '& tr:hover td': { bgcolor: '#f8fafc' },
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Indicateur</th>
                        {financialYears.filter(y => !!financialData[y]).sort((a, b) => b - a).map(y => (
                          <th key={y}>{y === referenceYear ? `${y} (N)` : `${y} (N-${referenceYear - y})`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'chiffre_affaires',   label: "Chiffre d'affaires" },
                        { key: 'resultat_net',        label: 'Résultat net' },
                        { key: 'total_actif',         label: 'Total actif' },
                        { key: 'capitaux_propres',    label: 'Capitaux propres' },
                        { key: 'dettes_financieres',  label: 'Dettes financières' },
                      ].map(({ key, label }) => (
                        <tr key={key}>
                          <td><Typography variant="body2" fontWeight={600}>{label}</Typography></td>
                          {financialYears.filter(y => !!financialData[y]).sort((a, b) => b - a).map(y => {
                            const entry = financialData[y];
                            const d = entry?.multiyear_data?.N?.data ?? entry;
                            const val = d?.[key];
                            return (
                              <td key={y}>
                                <Typography variant="body2" color={key === 'resultat_net' && val < 0 ? 'error.main' : 'text.primary'}>
                                  {val != null ? formatCurrency(val) : '—'}
                                </Typography>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={financialYears.filter(y => !!financialData[y]).length + 1}>
                          <Box sx={{ height: 8 }} />
                        </td>
                      </tr>
                      {[
                        { key: 'netMargin',     label: 'Marge nette' },
                        { key: 'currentRatio',  label: 'Ratio de liquidité' },
                        { key: 'roa',           label: 'ROA' },
                        { key: 'debtToEquity',  label: 'Dette / FP' },
                      ].map(({ key, label }) => (
                        <tr key={key}>
                          <td><Typography variant="body2" fontWeight={600} color="text.secondary">{label}</Typography></td>
                          {financialYears.filter(y => !!financialData[y]).sort((a, b) => b - a).map(y => {
                            const entry = financialData[y];
                            const d = entry?.multiyear_data?.N?.data ?? entry;
                            const ca = Number(d?.chiffre_affaires) || 0;
                            const rn = Number(d?.resultat_net) || 0;
                            const ta = Number(d?.total_actif) || 0;
                            const cp = Number(d?.capitaux_propres) || 0;
                            const df = Number(d?.dettes_financieres) || 0;
                            const actifCirculant = Number(d?.actif_circulant) || 0;
                            const passifCourant = Number(d?.passif_courant) || Number(d?.dettes_court_terme) || 0;
                            const computedRatios: Record<string, number | null> = {
                              netMargin: ca > 0 ? rn / ca : null,
                              currentRatio: passifCourant > 0 ? actifCirculant / passifCourant : null,
                              roa: ta > 0 ? rn / ta : null,
                              debtToEquity: cp > 0 ? df / cp : null,
                            };
                            const val = entry?.ratios?.[key] ?? computedRatios[key];
                            return (
                              <td key={y}>
                                <Typography variant="body2" color="text.secondary">
                                  {val != null ? (key === 'netMargin' || key === 'roa' ? `${(val * 100).toFixed(1)}%` : Number(val).toFixed(2)) : '—'}
                                </Typography>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              )}
            </SectionCard>

            <Box sx={{
              mt: 1, p: 3, borderRadius: 3,
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
              onClick={() => { clearFormDraft(DRAFT_KEY); onNavigate('clients'); }}
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
                disabled={isSubmitting || lockDisabled || !canSubmitApplication}
                title={
                  lockDisabled
                    ? lockReason ?? ''
                    : !canSubmitApplication
                      ? 'Complétez toutes les étapes (client, crédit, états financiers) avant de soumettre.'
                      : undefined
                }
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

      {/* Snackbar erreurs submit */}
      <Snackbar
        open={!!submitError}
        autoHideDuration={8000}
        onClose={() => setSubmitError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ minWidth: 320 }}>
          {submitError}
        </Alert>
      </Snackbar>

      {/* Dialog erreurs upload de documents */}
      <Dialog
        open={uploadErrorDialog.open}
        onClose={() => setUploadErrorDialog(d => ({ ...d, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Documents non téléversés</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {uploadErrorDialog.failed} document(s) n'ont pas pu être téléversés vers le serveur. Le dossier de crédit a bien été créé.
          </Alert>
          <Typography variant="body2">
            Souhaitez-vous tout de même finaliser le dossier ? Les pièces manquantes pourront être ajoutées plus tard depuis la fiche du dossier.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setUploadErrorDialog(d => ({ ...d, open: false }))}
            variant="outlined"
          >
            Retenter l'upload
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              clearFormDraft(DRAFT_KEY);
              setUploadErrorDialog({ open: false, failed: 0, applicationId: null });
              onNavigate('workflow');
            }}
          >
            Finaliser quand même
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backdrop pendant la soumission */}
      <Backdrop open={isSubmitting} sx={{ zIndex: 1300, color: 'white', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography variant="body2">Soumission du dossier en cours…</Typography>
      </Backdrop>
    </Box>
  );
};
