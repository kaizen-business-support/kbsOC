import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Avatar,
  Divider,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  AccountBalance as LimitsIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Euro as EuroIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Timer as TimerIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';
import { setFixedStepDurations } from '../utils/workflowConfig';

interface ApprovalLimit {
  id: string;
  role: string;
  minAmount: number;
  maxAmount: number;
  currency: string;
  order: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStepConfig {
  id: string;
  stepName: string;
  displayName: string;
  expectedDuration: number; // in minutes
  maxDuration?: number; // in minutes
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalLimitsPageProps {
  onNavigate: (page: any) => void;
}

export const ApprovalLimitsPage: React.FC<ApprovalLimitsPageProps> = ({ onNavigate }) => {
  const { hasPermission, isRole } = useUser();
  const [activeTab, setActiveTab] = useState(0);

  // Approval Limits State
  const [limits, setLimits] = useState<ApprovalLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<ApprovalLimit | null>(null);

  // Workflow Steps State
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepConfig[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [editStepDialogOpen, setEditStepDialogOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<WorkflowStepConfig | null>(null);

  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Form state
  const [limitForm, setLimitForm] = useState({
    role: '',
    minAmount: 0,
    maxAmount: 0,
    currency: 'XOF',
    order: 1,
    isActive: true,
    description: ''
  });

  const [stepForm, setStepForm] = useState({
    expectedDuration: 0,
    maxDuration: 0,
    description: '',
    isActive: true
  });

  // Role labels mapping
  const roleLabels: Record<string, string> = {
    'ACCOUNT_MANAGER': 'Chargé d\'Affaires',
    'CREDIT_ANALYST': 'Analyste Crédit',
    'BRANCH_MANAGER': 'Directeur d\'Agence',
    'CREDIT_COMMITTEE': 'Comité de Crédit',
    'MANAGEMENT': 'Direction Générale',
    'ADMIN': 'Administrateur'
  };

  const availableRoles = [
    { value: 'ACCOUNT_MANAGER', label: 'Chargé d\'Affaires' },
    { value: 'CREDIT_ANALYST', label: 'Analyste Crédit' },
    { value: 'BRANCH_MANAGER', label: 'Directeur d\'Agence' },
    { value: 'CREDIT_COMMITTEE', label: 'Comité de Crédit' },
    { value: 'MANAGEMENT', label: 'Direction Générale' }
  ];

  const currencies = [
    { value: 'XOF', label: 'XOF (Franc CFA)', symbol: 'F' },
    { value: 'EUR', label: 'EUR (Euro)', symbol: '€' },
    { value: 'USD', label: 'USD (Dollar)', symbol: '$' }
  ];


  // Check if user has access to approval limits
  const canViewLimits = isRole('admin') || isRole('management');
  const canEditLimits = isRole('admin');

  useEffect(() => {
    if (!canViewLimits) {
      setNotification({
        open: true,
        message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.',
        severity: 'error'
      });
      return;
    }
    loadLimits();
  }, [canViewLimits]);

  useEffect(() => {
    if (activeTab === 1 && workflowSteps.length === 0) {
      loadWorkflowSteps();
    }
  }, [activeTab]);

  const loadLimits = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getApprovalLimits();
      if (response.success && response.data) {
        setLimits(response.data);
      }
    } catch (error) {
      console.error('Error loading approval limits:', error);
      setNotification({
        open: true,
        message: 'Erreur lors du chargement des limites d\'approbation',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowSteps = async () => {
    setStepsLoading(true);
    try {
      const response = await ApiService.getWorkflowStepDurations();
      if (response.success && response.data) {
        setWorkflowSteps(response.data);
      }
    } catch (error) {
      console.error('Error loading workflow steps:', error);
      setNotification({
        open: true,
        message: 'Erreur lors du chargement des durées des étapes',
        severity: 'error'
      });
    } finally {
      setStepsLoading(false);
    }
  };

  const openEditStepDialog = (step: WorkflowStepConfig) => {
    setSelectedStep(step);
    setStepForm({
      expectedDuration: step.expectedDuration,
      maxDuration: step.maxDuration || 0,
      description: step.description || '',
      isActive: step.isActive
    });
    setEditStepDialogOpen(true);
  };

  const closeStepDialog = () => {
    setEditStepDialogOpen(false);
    setSelectedStep(null);
  };

  const saveWorkflowStep = async () => {
    if (!selectedStep) return;

    try {
      const response = await ApiService.updateWorkflowStepDuration(selectedStep.id, stepForm);
      if (response.success) {
        // Update local state
        const updatedSteps = workflowSteps.map(step =>
          step.id === selectedStep.id
            ? { ...step, ...stepForm, updatedAt: new Date().toISOString() }
            : step
        );
        setWorkflowSteps(updatedSteps);

        // Update the global workflow configuration
        const durations: Record<string, number> = {};
        updatedSteps.forEach(step => {
          if (step.isActive) {
            durations[step.stepName] = step.expectedDuration / 480; // Convert minutes to workdays
          }
        });
        setFixedStepDurations(durations);

        setNotification({
          open: true,
          message: 'Durée de l\'étape mise à jour avec succès',
          severity: 'success'
        });

        closeStepDialog();
      } else {
        setNotification({
          open: true,
          message: response.error || 'Erreur lors de la mise à jour',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving workflow step:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la sauvegarde',
        severity: 'error'
      });
    }
  };

  const openEditDialog = (limit: ApprovalLimit) => {
    setSelectedLimit(limit);
    setLimitForm({
      role: limit.role,
      minAmount: limit.minAmount,
      maxAmount: limit.maxAmount,
      currency: limit.currency,
      order: limit.order ?? 1,
      isActive: limit.isActive,
      description: limit.description || ''
    });
    setEditDialogOpen(true);
  };

  const openAddDialog = () => {
    setSelectedLimit(null);
    const nextOrder = limits.length > 0 ? Math.max(...limits.map(l => l.order ?? 1)) + 1 : 1;
    setLimitForm({
      role: '',
      minAmount: 0,
      maxAmount: 0,
      currency: 'XOF',
      order: nextOrder,
      isActive: true,
      description: ''
    });
    setAddDialogOpen(true);
  };

  const closeDialogs = () => {
    setEditDialogOpen(false);
    setAddDialogOpen(false);
    setSelectedLimit(null);
  };

  const saveLimit = async () => {
    try {
      // In real implementation, this would be an API call
      if (selectedLimit) {
        // Update existing limit
        const updatedLimits = limits.map(limit =>
          limit.id === selectedLimit.id
            ? { ...limit, ...limitForm, updatedAt: new Date().toISOString() }
            : limit
        );
        setLimits(updatedLimits);
        
        setNotification({
          open: true,
          message: 'Limite d\'approbation mise à jour avec succès',
          severity: 'success'
        });
      } else {
        // Add new limit
        const newLimit: ApprovalLimit = {
          id: Date.now().toString(),
          ...limitForm,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setLimits([...limits, newLimit]);
        
        setNotification({
          open: true,
          message: 'Nouvelle limite d\'approbation créée avec succès',
          severity: 'success'
        });
      }
      
      closeDialogs();
    } catch (error) {
      console.error('Error saving limit:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la sauvegarde de la limite',
        severity: 'error'
      });
    }
  };

  const deleteLimit = async (limitId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette limite d\'approbation ?')) {
      return;
    }

    try {
      // In real implementation, this would be an API call
      setLimits(limits.filter(limit => limit.id !== limitId));
      
      setNotification({
        open: true,
        message: 'Limite d\'approbation supprimée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting limit:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la suppression de la limite',
        severity: 'error'
      });
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    const currencyData = currencies.find(c => c.value === currency);
    const symbol = currencyData?.symbol || currency;

    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ${symbol}`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K ${symbol}`;
    } else {
      return `${amount.toLocaleString()} ${symbol}`;
    }
  };

  const formatDuration = (minutes: number) => {
    const workdays = minutes / 480;
    if (workdays < 1) {
      const hours = minutes / 60;
      return `${hours.toFixed(1)}h`;
    } else {
      return `${workdays.toFixed(1)} jours`;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'MANAGEMENT': return <BusinessIcon />;
      case 'CREDIT_COMMITTEE': return <SecurityIcon />;
      case 'BRANCH_MANAGER': return <TrendingUpIcon />;
      default: return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MANAGEMENT': return 'error';
      case 'CREDIT_COMMITTEE': return 'warning';
      case 'BRANCH_MANAGER': return 'primary';
      case 'CREDIT_ANALYST': return 'info';
      case 'ACCOUNT_MANAGER': return 'secondary';
      default: return 'default';
    }
  };

  if (!canViewLimits) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Accès non autorisé. Seuls les administrateurs et la direction générale peuvent accéder à cette page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <LimitsIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Configuration Workflow
          </Typography>
          {!canEditLimits && (
            <Chip
              icon={<VisibilityIcon />}
              label="Lecture seule"
              size="small"
              variant="outlined"
              sx={{ ml: 2 }}
            />
          )}
          {canEditLimits && (
            <Chip
              icon={<LockIcon />}
              label="Administration"
              size="small"
              color="primary"
              sx={{ ml: 2 }}
            />
          )}
        </Box>
        <Typography variant="body1" color="text.secondary">
          Configuration des limites d'approbation et des durées d'étapes du workflow
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab
            icon={<LimitsIcon />}
            label="Limites d'Approbation"
            iconPosition="start"
          />
          <Tab
            icon={<TimerIcon />}
            label="Durées des Étapes"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Statistics Cards - Approval Limits Tab */}
      {activeTab === 0 && !loading && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <LimitsIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {limits.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Limites
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <SecurityIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {limits.filter(l => l.isActive).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Limites Actives
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {limits.filter(l => l.role === 'CREDIT_COMMITTEE' || l.role === 'MANAGEMENT').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Niveaux Supérieurs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                    <EuroIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {Math.max(...limits.map(l => l.maxAmount)) / 1000000}M
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Limite Max (XOF)
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content - Approval Limits Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Configuration des Limites
              </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadLimits}
                disabled={loading}
              >
                Actualiser
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAddDialog}
                disabled={!canEditLimits}
              >
                Nouvelle Limite
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Niveau</TableCell>
                    <TableCell>Rôle</TableCell>
                    <TableCell>Limite Min</TableCell>
                    <TableCell>Limite Max</TableCell>
                    <TableCell>Devise</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...limits].sort((a, b) => (a.order ?? 1) - (b.order ?? 1)).map((limit) => (
                    <TableRow key={limit.id} hover>
                      <TableCell>
                        <Chip
                          label={`N°${limit.order ?? 1}`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2, bgcolor: `${getRoleColor(limit.role)}.main` }}>
                            {getRoleIcon(limit.role)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {roleLabels[limit.role] || limit.role}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {limit.description}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatAmount(limit.minAmount, limit.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatAmount(limit.maxAmount, limit.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={limit.currency}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={limit.isActive ? 'Actif' : 'Inactif'}
                          color={limit.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Modifier la limite">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(limit)}
                            disabled={!canEditLimits}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer la limite">
                          <IconButton
                            size="small"
                            onClick={() => deleteLimit(limit.id)}
                            color="error"
                            disabled={!canEditLimits}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* Workflow Steps Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Durées des Étapes de Workflow
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadWorkflowSteps}
                disabled={stepsLoading}
              >
                Actualiser
              </Button>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Alert severity="info" sx={{ mb: 3 }}>
              Les durées sont exprimées en jours ouvrés (1 jour = 8 heures). Ces durées sont utilisées pour calculer les délais de traitement et détecter les retards dans le workflow.
            </Alert>

            {stepsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Étape</TableCell>
                      <TableCell>Durée Attendue</TableCell>
                      <TableCell>Durée Maximale</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Statut</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workflowSteps.map((step) => (
                      <TableRow key={step.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                              <ScheduleIcon />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {step.displayName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {step.stepName}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatDuration(step.expectedDuration)}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {step.maxDuration ? (
                            <Chip
                              label={formatDuration(step.maxDuration)}
                              color="warning"
                              size="small"
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Non défini
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {step.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={step.isActive ? 'Actif' : 'Inactif'}
                            color={step.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Modifier la durée">
                            <IconButton
                              size="small"
                              onClick={() => openEditStepDialog(step)}
                              disabled={!canEditLimits}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit/Add Limit Dialog */}
      <Dialog 
        open={editDialogOpen || addDialogOpen} 
        onClose={closeDialogs} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {selectedLimit ? 'Modifier la Limite' : 'Nouvelle Limite d\'Approbation'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={limitForm.role}
                  onChange={(e) => setLimitForm({ ...limitForm, role: e.target.value })}
                  label="Rôle"
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Devise</InputLabel>
                <Select
                  value={limitForm.currency}
                  onChange={(e) => setLimitForm({ ...limitForm, currency: e.target.value })}
                  label="Devise"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Montant Minimum"
                type="number"
                value={limitForm.minAmount}
                onChange={(e) => setLimitForm({ ...limitForm, minAmount: Number(e.target.value) })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {currencies.find(c => c.value === limitForm.currency)?.symbol}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Montant Maximum"
                type="number"
                value={limitForm.maxAmount}
                onChange={(e) => setLimitForm({ ...limitForm, maxAmount: Number(e.target.value) })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {currencies.find(c => c.value === limitForm.currency)?.symbol}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Niveau hiérarchique"
                type="number"
                value={limitForm.order}
                onChange={(e) => setLimitForm({ ...limitForm, order: Number(e.target.value) })}
                helperText="1 = premier niveau, 2 = deuxième, etc."
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Description"
                value={limitForm.description}
                onChange={(e) => setLimitForm({ ...limitForm, description: e.target.value })}
                placeholder="Description de la limite d'approbation"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={limitForm.isActive}
                    onChange={(e) => setLimitForm({ ...limitForm, isActive: e.target.checked })}
                  />
                }
                label="Limite active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button
            onClick={saveLimit}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!limitForm.role || limitForm.maxAmount <= limitForm.minAmount}
          >
            {selectedLimit ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Workflow Step Dialog */}
      <Dialog
        open={editStepDialogOpen}
        onClose={closeStepDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Modifier la Durée de l'Étape
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>{selectedStep?.displayName}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  1 jour ouvré = 8 heures = 480 minutes
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Durée Attendue (minutes)"
                type="number"
                value={stepForm.expectedDuration}
                onChange={(e) => setStepForm({ ...stepForm, expectedDuration: Number(e.target.value) })}
                InputProps={{
                  inputProps: { min: 0, step: 60 },
                  endAdornment: (
                    <InputAdornment position="end">
                      {formatDuration(stepForm.expectedDuration)}
                    </InputAdornment>
                  )
                }}
                helperText="Durée normale de traitement de l'étape"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Durée Maximale (minutes)"
                type="number"
                value={stepForm.maxDuration}
                onChange={(e) => setStepForm({ ...stepForm, maxDuration: Number(e.target.value) })}
                InputProps={{
                  inputProps: { min: 0, step: 60 },
                  endAdornment: (
                    <InputAdornment position="end">
                      {formatDuration(stepForm.maxDuration)}
                    </InputAdornment>
                  )
                }}
                helperText="Durée au-delà de laquelle l'étape est en retard"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={stepForm.description}
                onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                placeholder="Description de l'étape"
                multiline
                rows={3}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={stepForm.isActive}
                    onChange={(e) => setStepForm({ ...stepForm, isActive: e.target.checked })}
                  />
                }
                label="Étape active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStepDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button
            onClick={saveWorkflowStep}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={stepForm.expectedDuration <= 0}
          >
            Mettre à jour
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};