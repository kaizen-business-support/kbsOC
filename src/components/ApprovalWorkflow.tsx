import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepIcon,
  Chip,
  Avatar,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Person as PersonIcon,
  Gavel as ApprovalIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as ReviewIcon,
  Send as SubmitIcon,
  Settings as ConfigIcon,
  AccountBalance as BankIcon,
  Business as ClientIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from './RichTextEditor';
import { OtpVerificationDialog } from './OtpVerificationDialog';

interface WorkflowStep {
  id: string;
  name: string;
  role: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
  assignee?: string;
  deadline?: Date;
  comments?: string;
  threshold?: number;
  required: boolean;
}

interface ApprovalWorkflowProps {
  creditAmount?: number;
  clientName?: string;
  applicationId?: string;
  onWorkflowAction?: (action: string, stepId: string) => void;
}

const defaultWorkflowSteps: WorkflowStep[] = [
  {
    id: 'account_manager_submission',
    name: 'Soumission du Dossier',
    role: 'Chargé d\'Affaires',
    status: 'completed',
    assignee: 'Amadou Diop',
    required: true,
    comments: 'Dossier complet soumis avec tous les documents requis'
  },
  {
    id: 'credit_analyst_review',
    name: 'Analyse Technique',
    role: 'Analyste Crédit',
    status: 'in_review',
    assignee: 'Fatou Ndiaye',
    required: true,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    comments: 'En cours d\'analyse des états financiers et ratios'
  },
  {
    id: 'branch_manager_approval',
    name: 'Approbation Direction d\'Agence',
    role: 'Directeur d\'Agence',
    status: 'pending',
    assignee: 'Moussa Sarr',
    required: true,
    threshold: 5000000, // 5M XOF
    comments: 'En attente de l\'analyse technique'
  },
  {
    id: 'credit_committee',
    name: 'Comité de Crédit',
    role: 'Comité de Crédit',
    status: 'pending',
    assignee: 'Secrétaire Comité',
    required: false,
    threshold: 5000000, // Required for amounts > 5M XOF
    comments: 'Requis pour les montants > 5M XOF'
  }
];

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  creditAmount = 3500000,
  clientName = 'SARL TECH SOLUTIONS',
  applicationId = 'CR-2024-001',
  onWorkflowAction
}) => {
  const { t } = useTranslation();
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(defaultWorkflowSteps);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [branchThreshold, setBranchThreshold] = useState(5000000);
  const [activeStep, setActiveStep] = useState(1);
  const [workflowComments, setWorkflowComments] = useState<string>('');
  const [otpDialog, setOtpDialog] = useState<{
    open: boolean;
    pendingAction: string;
    pendingStepId: string;
  }>({ open: false, pendingAction: '', pendingStepId: '' });

  // Determine which steps are required based on amount
  const getRequiredSteps = () => {
    return workflowSteps.map(step => ({
      ...step,
      required: step.threshold ? creditAmount > step.threshold : step.required
    }));
  };

  const requiredSteps = getRequiredSteps();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <ApprovedIcon color="success" />;
      case 'approved': return <ApprovedIcon color="success" />;
      case 'in_review': return <ReviewIcon color="info" />;
      case 'rejected': return <RejectedIcon color="error" />;
      case 'pending': return <PendingIcon color="warning" />;
      default: return <PendingIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'approved': return 'success';
      case 'in_review': return 'info';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDaysRemaining = (deadline?: Date) => {
    if (!deadline) return null;
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const executeStepAction = (action: string, stepId: string) => {
    if (onWorkflowAction) {
      onWorkflowAction(action, stepId);
    }
    setWorkflowSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : step.status }
        : step
    ));
  };

  const handleStepAction = (action: string, stepId: string) => {
    setOtpDialog({ open: true, pendingAction: action, pendingStepId: stepId });
  };

  const getCurrentStepInfo = () => {
    const currentStep = requiredSteps.find(step => step.status === 'in_review' || step.status === 'pending');
    if (!currentStep) return null;

    const daysRemaining = calculateDaysRemaining(currentStep.deadline);
    
    return {
      ...currentStep,
      daysRemaining,
      isOverdue: daysRemaining ? daysRemaining < 0 : false
    };
  };

  const currentStepInfo = getCurrentStepInfo();

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <ApprovalIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  Workflow d'Approbation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {clientName} • {applicationId} • {formatCurrency(creditAmount)}
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Button
                variant="outlined"
                startIcon={<ConfigIcon />}
                onClick={() => setConfigDialogOpen(true)}
                sx={{ mb: 1 }}
              >
                Configuration
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Current Status Alert */}
      {currentStepInfo && (
        <Alert 
          severity={currentStepInfo.isOverdue ? 'error' : currentStepInfo.status === 'in_review' ? 'info' : 'warning'}
          sx={{ mb: 4 }}
          action={
            currentStepInfo.status === 'in_review' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  color="success"
                  variant="outlined"
                  onClick={() => handleStepAction('approve', currentStepInfo.id)}
                >
                  Approuver
                </Button>
                <Button 
                  size="small" 
                  color="error"
                  variant="outlined"
                  onClick={() => handleStepAction('reject', currentStepInfo.id)}
                >
                  Rejeter
                </Button>
              </Box>
            )
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Étape Actuelle: {currentStepInfo.name}
          </Typography>
          <Typography variant="body2">
            Assigné à: {currentStepInfo.assignee} • 
            {currentStepInfo.daysRemaining !== null && (
              <span style={{ color: currentStepInfo.isOverdue ? 'red' : 'inherit' }}>
                {currentStepInfo.isOverdue 
                  ? ` En retard de ${Math.abs(currentStepInfo.daysRemaining)} jour(s)`
                  : ` ${currentStepInfo.daysRemaining} jour(s) restant(s)`
                }
              </span>
            )}
          </Typography>
        </Alert>
      )}

      {/* Workflow Timeline */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Progression du Dossier
              </Typography>
              
              <Timeline>
                {requiredSteps.map((step, index) => (
                  <TimelineItem key={step.id}>
                    <TimelineOppositeContent sx={{ flex: 0.3, color: 'text.secondary' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {step.role}
                      </Typography>
                      {step.deadline && (
                        <Typography variant="caption">
                          {step.deadline.toLocaleDateString('fr-FR')}
                        </Typography>
                      )}
                    </TimelineOppositeContent>
                    
                    <TimelineSeparator>
                      <TimelineDot color={getStatusColor(step.status) as any}>
                        {getStatusIcon(step.status)}
                      </TimelineDot>
                      {index < requiredSteps.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    
                    <TimelineContent sx={{ py: '12px', px: 2 }}>
                      <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                        {step.name}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1 }}>
                        <Chip
                          label={step.status === 'completed' ? 'Terminé' : 
                                step.status === 'approved' ? 'Approuvé' :
                                step.status === 'in_review' ? 'En cours' :
                                step.status === 'rejected' ? 'Rejeté' : 'En attente'}
                          color={getStatusColor(step.status) as any}
                          size="small"
                        />
                        
                        {step.assignee && (
                          <Chip
                            label={step.assignee}
                            icon={<PersonIcon />}
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </Box>
                      
                      {step.comments && (
                        <Typography variant="body2" color="text.secondary">
                          {step.comments}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </CardContent>
          </Card>
        </Grid>

        {/* Workflow Summary */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Résumé du Workflow
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Montant du Crédit
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {formatCurrency(creditAmount)}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Seuil d'Approbation
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {creditAmount <= branchThreshold 
                    ? `Direction d'Agence (≤ ${formatCurrency(branchThreshold)})`
                    : `Comité de Crédit (> ${formatCurrency(branchThreshold)})`
                  }
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Étapes Requises
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {requiredSteps.filter(s => s.required).length} sur {requiredSteps.length}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Temps Estimé
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {creditAmount <= branchThreshold ? '3-5 jours' : '7-10 jours'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
          
          {/* Comments Section */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Commentaires du Workflow
              </Typography>
              <RichTextEditor
                value={workflowComments}
                onChange={(value) => setWorkflowComments(value)}
                placeholder="Ajoutez des commentaires sur le processus d'approbation, conditions spéciales, ou observations importantes..."
                height={120}
                label="Observations et commentaires du processus"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configuration du Workflow</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Seuil Direction d'Agence (XOF)"
                type="number"
                value={branchThreshold}
                onChange={(e) => setBranchThreshold(Number(e.target.value))}
                helperText="Montant maximum approuvable par la direction d'agence"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Délai Standard (jours)</InputLabel>
                <Select defaultValue={5} label="Délai Standard (jours)">
                  <MenuItem value={3}>3 jours</MenuItem>
                  <MenuItem value={5}>5 jours</MenuItem>
                  <MenuItem value={7}>7 jours</MenuItem>
                  <MenuItem value={10}>10 jours</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Règles Actuelles:</strong><br/>
                  • Montants ≤ {formatCurrency(branchThreshold)}: Approbation Direction d'Agence<br/>
                  • Montants &gt; {formatCurrency(branchThreshold)}: Approbation Comité de Crédit<br/>
                  • Escalade automatique en cas de dépassement de délai
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => setConfigDialogOpen(false)}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="outlined" startIcon={<ClientIcon />} onClick={() => {}}>
          Voir Client
        </Button>
        <Button variant="outlined" startIcon={<SubmitIcon />} onClick={() => {}}>
          Envoyer Notification
        </Button>
        <Button variant="contained" startIcon={<BankIcon />} onClick={() => {}}>
          Générer Rapport
        </Button>
      </Box>

      {/* OTP Verification pour les actions rapides */}
      <OtpVerificationDialog
        open={otpDialog.open}
        actionLabel={otpDialog.pendingAction === 'approve' ? 'Approuver l\'étape' : 'Rejeter l\'étape'}
        purpose={otpDialog.pendingAction === 'approve' ? 'approve_credit' : 'reject_credit'}
        onClose={() => setOtpDialog({ open: false, pendingAction: '', pendingStepId: '' })}
        onVerified={async () => {
          executeStepAction(otpDialog.pendingAction, otpDialog.pendingStepId);
        }}
      />
    </Box>
  );
};