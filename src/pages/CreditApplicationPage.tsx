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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Avatar,
  Alert,
  Divider,
  Chip,
  Paper,
  Autocomplete,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  AccountBalance as BankIcon,
  Description as DocumentIcon,
  Assessment as AnalysisIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../components/RichTextEditor';
import { DocumentManager } from '../components/DocumentManager';
import { FinancialDataInputTabs } from '../components/FinancialDataInputTabs';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';

interface CreditApplicationPageProps {
  onNavigate: (page: any) => void;
}

interface ClientInfo {
  companyName: string;
  rccm: string;
  ninea: string;
  cofi: string;
  legalForm: string;
  sector: string;
  establishedYear: string;
  headquarters: string;
  contactPerson: string;
  phone: string;
  email: string;
}

interface CreditRequest {
  amount: number;
  currency: string;
  purpose: string;
  duration: number;
  proposedRate: number;
  collateralType: string;
  collateralValue: number;
  repaymentSchedule: string;
}

const steps = [
  'Informations Client',
  'Demande de Crédit',
  'États Financiers',
  'Documents Justificatifs',
  'Analyse Préliminaire',
  'Soumission'
];

export const CreditApplicationPage: React.FC<CreditApplicationPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { state: userState } = useUser();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client selection state
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');

  // Analyst assignment state
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [selectedAnalystId, setSelectedAnalystId] = useState<string>('');

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    companyName: '',
    rccm: '',
    ninea: '',
    cofi: '',
    legalForm: '',
    sector: '',
    establishedYear: '',
    headquarters: '',
    contactPerson: '',
    phone: '',
    email: ''
  });
  
  const [creditRequest, setCreditRequest] = useState<CreditRequest>({
    amount: 0,
    currency: 'XOF',
    purpose: '',
    duration: 12,
    proposedRate: 0,
    collateralType: '',
    collateralValue: 0,
    repaymentSchedule: 'monthly'
  });

  const [preliminaryAnalysis, setPreliminaryAnalysis] = useState<string>('');

  // Financial data state
  const [referenceYear] = useState<number>(new Date().getFullYear());
  const [numberOfYears] = useState<number>(3);
  const [financialData, setFinancialData] = useState<Record<number, any>>({});
  const [financialDocuments, setFinancialDocuments] = useState<any[]>([]);

  const handleDataInput = (year: number, data: any) => {
    setFinancialData(prev => ({ ...prev, [year]: data }));
  };

  const handleFinancialDocumentUploaded = (document: any) => {
    setFinancialDocuments(prev => [...prev, {
      ...document,
      category: 'financial',
      uploadSource: 'financial_statements'
    }]);
  };

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await ApiService.getClients();
        if (response.success && response.data) {
          setClients(response.data);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };
    loadClients();
  }, []);

  // Load credit analysts on mount
  useEffect(() => {
    const loadAnalysts = async () => {
      try {
        console.log('Loading credit analysts from API...');
        const response = await ApiService.getCreditAnalysts();
        if (response.success && response.data) {
          setAnalysts(response.data);
          console.log('Credit analysts loaded successfully:', response.data.length);
        } else {
          console.error('Failed to load analysts:', response.error);
          setAnalysts([]);
        }
      } catch (error) {
        console.error('Error loading analysts:', error);
        setAnalysts([]);
      }
    };
    loadAnalysts();
  }, []);

  // Handle client selection
  const handleClientSelection = (client: any | null) => {
    if (client) {
      setSelectedClient(client);
      setSelectedClientId(client.id);
      // Auto-populate clientInfo from selected client
      setClientInfo({
        companyName: client.companyName || '',
        rccm: client.rccm || '',
        ninea: client.ninea || '',
        cofi: client.cofi || '',
        legalForm: client.legalForm || '',
        sector: client.sector || '',
        establishedYear: client.establishedYear?.toString() || '',
        headquarters: client.headquarters || '',
        contactPerson: client.contactPerson || '',
        phone: client.phone || '',
        email: client.email || ''
      });
    } else {
      setSelectedClient(null);
      setSelectedClientId('');
      setClientInfo({
        companyName: '',
        rccm: '',
        ninea: '',
        cofi: '',
        legalForm: '',
        sector: '',
        establishedYear: '',
        headquarters: '',
        contactPerson: '',
        phone: '',
        email: ''
      });
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const handleSubmitApplication = async () => {
    console.log('=== SUBMIT BUTTON CLICKED ===');

    // Validation
    if (!selectedClientId) {
      alert('Veuillez sélectionner un client avant de soumettre la demande.');
      return;
    }

    if (!userState.currentUser?.id) {
      alert('Erreur: Utilisateur non authentifié. Veuillez vous reconnecter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const applicationData = {
        clientId: selectedClientId,
        amount: creditRequest.amount,
        currency: creditRequest.currency,
        purpose: creditRequest.purpose,
        durationMonths: creditRequest.duration,
        proposedRate: creditRequest.proposedRate,
        collateralType: creditRequest.collateralType,
        collateralValue: creditRequest.collateralValue,
        repaymentSchedule: creditRequest.repaymentSchedule,
        createdBy: userState.currentUser.id,
        assignedAnalystId: selectedAnalystId || undefined,
        analysisResults: {
          preliminaryAnalysis,
          financialData
        }
      };

      console.log('Application data to submit:', applicationData);
      console.log('Selected Client ID:', selectedClientId);
      console.log('Current User:', userState.currentUser);

      const result = await ApiService.createApplication(applicationData);
      console.log('Submit result:', result);

      if (result.success) {
        console.log('Application submitted successfully:', result.data);
        // Navigate to workflow management
        onNavigate('workflow');
      } else {
        console.error('Failed to submit application:', result.error);
        alert(`Erreur: ${result.error || 'Une erreur est survenue'}`);
      }
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const errorMessage = error?.message || error?.toString() || 'Une erreur inconnue est survenue';
      alert(`Erreur lors de la soumission: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!selectedClientId; // Client must be selected
      case 1:
        return !!(creditRequest.amount > 0 && creditRequest.purpose);
      case 2:
        return true; // Financial data is optional for step completion
      case 3:
        return true; // Documents are optional for step completion
      case 4:
        return true; // Preliminary analysis is optional for step completion
      case 5:
        return true; // Final submission step - all previous steps are complete
      default:
        return false;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
          <BusinessIcon sx={{ fontSize: 32 }} />
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Nouvelle Demande de Crédit
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Processus guidé de soumission d'une demande de crédit professionnel
          </Typography>
        </Box>
      </Box>

      {/* Progress Stepper */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  optional={
                    index === 2 ? (
                      <Typography variant="caption">Optionnel</Typography>
                    ) : null
                  }
                  StepIconComponent={({ completed, active }) => (
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: completed ? 'success.main' : active ? 'primary.main' : 'grey.300',
                        fontSize: '0.875rem'
                      }}
                    >
                      {completed ? <CompleteIcon sx={{ fontSize: 20 }} /> : index + 1}
                    </Avatar>
                  )}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {label}
                    </Typography>
                    {isStepComplete(index) && (
                      <Chip label="Complété" color="success" size="small" />
                    )}
                  </Box>
                </StepLabel>
                <StepContent>
                  {/* Step 1: Client Information */}
                  {index === 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Sélection du Client
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Autocomplete
                            fullWidth
                            options={clients.filter(client => client.isActive)}
                            getOptionLabel={(client) => `[${client.rccm || 'N/A'}] - ${client.companyName}`}
                            value={selectedClient}
                            onChange={(event, newValue) => {
                              handleClientSelection(newValue);
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Sélectionner un Client"
                                placeholder="Rechercher par nom ou RCCM"
                                required
                              />
                            )}
                            noOptionsText="Aucun client trouvé"
                          />
                          {clients.length === 0 && (
                            <Alert
                              severity="info"
                              sx={{ mt: 2 }}
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

                        {selectedClient && (
                          <Grid item xs={12}>
                            <Card variant="outlined" sx={{ bgcolor: 'background.paper', mb: 2 }}>
                              <CardContent>
                                <Typography variant="h6" gutterBottom>
                                  Informations Client Sélectionné
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Raison Sociale</Typography>
                                    <Typography variant="body1">{selectedClient.companyName || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">RCCM</Typography>
                                    <Typography variant="body1">{selectedClient.rccm || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">NINEA</Typography>
                                    <Typography variant="body1">{selectedClient.ninea || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">COFI</Typography>
                                    <Typography variant="body1">{selectedClient.cofi || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Forme Juridique</Typography>
                                    <Typography variant="body1">{selectedClient.legalForm || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Secteur d'Activité</Typography>
                                    <Typography variant="body1">{selectedClient.sector || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Année de Création</Typography>
                                    <Typography variant="body1">{selectedClient.establishedYear || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Siège Social</Typography>
                                    <Typography variant="body1">{selectedClient.headquarters || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Personne de Contact</Typography>
                                    <Typography variant="body1">{selectedClient.contactPerson || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Téléphone</Typography>
                                    <Typography variant="body1">{selectedClient.phone || 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">Email</Typography>
                                    <Typography variant="body1">{selectedClient.email || 'N/A'}</Typography>
                                  </Grid>
                                </Grid>
                              </CardContent>
                            </Card>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  )}

                  {/* Step 2: Credit Request */}
                  {index === 1 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Détails de la Demande de Crédit
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Montant Demandé *"
                            type="number"
                            value={creditRequest.amount}
                            onChange={(e) => setCreditRequest({...creditRequest, amount: Number(e.target.value)})}
                            required
                            InputProps={{
                              endAdornment: <Typography variant="body2">XOF</Typography>
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Durée (mois)"
                            type="number"
                            value={creditRequest.duration}
                            onChange={(e) => setCreditRequest({...creditRequest, duration: Number(e.target.value)})}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Objet du Crédit *"
                            multiline
                            rows={3}
                            value={creditRequest.purpose}
                            onChange={(e) => setCreditRequest({...creditRequest, purpose: e.target.value})}
                            required
                            helperText="Décrivez précisément l'utilisation prévue des fonds"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Taux Proposé (%)"
                            type="number"
                            value={creditRequest.proposedRate}
                            onChange={(e) => setCreditRequest({...creditRequest, proposedRate: Number(e.target.value)})}
                            inputProps={{ step: "0.1" }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Modalité de Remboursement</InputLabel>
                            <Select
                              value={creditRequest.repaymentSchedule}
                              label="Modalité de Remboursement"
                              onChange={(e) => setCreditRequest({...creditRequest, repaymentSchedule: e.target.value})}
                            >
                              <MenuItem value="monthly">Mensuelle</MenuItem>
                              <MenuItem value="quarterly">Trimestrielle</MenuItem>
                              <MenuItem value="semiannual">Semestrielle</MenuItem>
                              <MenuItem value="annual">Annuelle</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Type de Garantie"
                            value={creditRequest.collateralType}
                            onChange={(e) => setCreditRequest({...creditRequest, collateralType: e.target.value})}
                            placeholder="Ex: Hypothèque, Nantissement, Caution..."
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Valeur de la Garantie"
                            type="number"
                            value={creditRequest.collateralValue}
                            onChange={(e) => setCreditRequest({...creditRequest, collateralValue: Number(e.target.value)})}
                            InputProps={{
                              endAdornment: <Typography variant="body2">XOF</Typography>
                            }}
                          />
                        </Grid>
                      </Grid>
                      
                      {creditRequest.amount > 0 && (
                        <Alert severity="info" sx={{ mt: 3 }}>
                          <Typography variant="body2">
                            <strong>Résumé:</strong> Demande de crédit de {formatCurrency(creditRequest.amount)} 
                            sur {creditRequest.duration} mois pour {creditRequest.purpose || 'objet non spécifié'}
                          </Typography>
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* Step 3: Financial Data */}
                  {index === 2 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        États Financiers SYSCOHADA
                      </Typography>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          Les documents téléchargés ici seront automatiquement ajoutés à la section "Documents Financiers"
                          dans les Documents Justificatifs (étape suivante).
                        </Typography>
                      </Alert>
                      <FinancialDataInputTabs
                        referenceYear={referenceYear}
                        numberOfYears={numberOfYears}
                        selectedSector={clientInfo.sector || 'general'}
                        currency="XOF"
                        onDataInput={handleDataInput}
                        financialData={financialData}
                        onDocumentUploaded={handleFinancialDocumentUploaded}
                      />
                    </Box>
                  )}

                  {/* Step 4: Documents */}
                  {index === 3 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Documents Justificatifs
                      </Typography>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        <Typography variant="body2">
                          Téléchargez les documents requis pour le traitement de votre demande.
                          Les documents financiers seront analysés automatiquement par OCR.
                          {financialDocuments.length > 0 && (
                            <><br /><strong>Note:</strong> {financialDocuments.length} document(s) financier(s) déjà ajouté(s) depuis l'étape "États Financiers".</>
                          )}
                        </Typography>
                      </Alert>
                      <DocumentManager
                        clientId={`app-${Date.now()}`}
                        applicationId={`CR-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`}
                        initialDocuments={financialDocuments}
                        onDocumentProcessed={(document) => {
                          console.log('Document processed for application:', document);
                        }}
                      />
                    </Box>
                  )}

                  {/* Step 5: Preliminary Analysis */}
                  {index === 4 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Analyse Préliminaire du Chargé d'Affaires
                      </Typography>
                      <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography variant="body2">
                          Cette analyse préliminaire sera transmise avec le dossier au service crédit. 
                          Elle doit contenir votre évaluation initiale du risque et vos recommandations.
                        </Typography>
                      </Alert>
                      <RichTextEditor
                        value={preliminaryAnalysis}
                        onChange={(value) => setPreliminaryAnalysis(value)}
                        placeholder="Rédigez votre analyse préliminaire du dossier client, incluant l'évaluation du risque, la pertinence du projet, la capacité de remboursement estimée, et vos recommandations pour la suite du processus..."
                        height={300}
                        label="Analyse et Recommandations du Chargé d'Affaires"
                      />
                    </Box>
                  )}

                  {/* Step 6: Review and Submit */}
                  {index === 5 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Récapitulatif et Soumission
                      </Typography>

                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon color="primary" />
                              Informations Client
                            </Typography>
                            <Typography variant="body2"><strong>Entreprise:</strong> {clientInfo.companyName}</Typography>
                            <Typography variant="body2"><strong>RCCM:</strong> {clientInfo.rccm}</Typography>
                            <Typography variant="body2"><strong>Secteur:</strong> {clientInfo.sector}</Typography>
                            <Typography variant="body2"><strong>Contact:</strong> {clientInfo.contactPerson}</Typography>
                          </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BankIcon color="primary" />
                              Demande de Crédit
                            </Typography>
                            <Typography variant="body2"><strong>Montant:</strong> {formatCurrency(creditRequest.amount)}</Typography>
                            <Typography variant="body2"><strong>Durée:</strong> {creditRequest.duration} mois</Typography>
                            <Typography variant="body2"><strong>Objet:</strong> {creditRequest.purpose}</Typography>
                            <Typography variant="body2"><strong>Garantie:</strong> {creditRequest.collateralType}</Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mt: 3 }}>
                        Attribution de l'Analyste Crédit
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth required>
                            <InputLabel>Analyste Crédit Assigné</InputLabel>
                            <Select
                              value={selectedAnalystId}
                              onChange={(e) => setSelectedAnalystId(e.target.value)}
                              label="Analyste Crédit Assigné"
                            >
                              <MenuItem value="">
                                <em>Sélectionner un analyste</em>
                              </MenuItem>
                              {analysts.map((analyst) => (
                                <MenuItem key={analyst.id} value={analyst.id}>
                                  {analyst.name} - {analyst.department || 'Risques'}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Alert severity="info">
                            <Typography variant="body2">
                              L'analyste assigné recevra le dossier pour analyse approfondie et notation de crédit.
                            </Typography>
                          </Alert>
                        </Grid>
                      </Grid>

                      <Alert severity="success" sx={{ mt: 3 }}>
                        <Typography variant="body2">
                          Le dossier est prêt à être soumis au service crédit pour analyse approfondie.
                          Une fois soumis, le workflow d'approbation sera automatiquement initié.
                        </Typography>
                      </Alert>
                    </Box>
                  )}

                  <Box sx={{ mb: 1 }}>
                    <div>
                      <Button
                        variant="contained"
                        onClick={index === steps.length - 1 ? handleSubmitApplication : handleNext}
                        sx={{ mt: 1, mr: 1 }}
                        disabled={!isStepComplete(index) || isSubmitting}
                      >
                        {isSubmitting ? 'Envoi en cours...' : (index === steps.length - 1 ? 'Soumettre la Demande' : 'Suivant')}
                      </Button>
                      <Button
                        disabled={index === 0}
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Précédent
                      </Button>
                    </div>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => onNavigate('clients')}
        >
          Retour aux Clients
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
        >
          Réinitialiser
        </Button>
      </Box>
    </Box>
  );
};