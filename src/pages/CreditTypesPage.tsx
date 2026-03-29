import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  ArrowUpward,
  ArrowDownward,
  AccountTree as WorkflowIcon
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';

interface CreditType {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultRate: number;
  minRate?: number;
  maxRate?: number;
  minDuration?: number;
  maxDuration?: number;
  requiresCollateral: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workflowSteps?: WorkflowStepConfig[];
}

interface WorkflowStepConfig {
  id: string;
  creditTypeId: string;
  stepName: string;
  stepLabel: string;
  role: string;
  order: number;
  isRequired: boolean;
  durationDays: number;
  description?: string;
  conditionMinAmount?: number | null;
  conditionMaxAmount?: number | null;
}

interface CreditTypeFormData {
  name: string;
  code: string;
  description: string;
  defaultRate: string;
  minRate: string;
  maxRate: string;
  minDuration: string;
  maxDuration: string;
  requiresCollateral: boolean;
  isActive: boolean;
}

interface NewStepFormData {
  stepName: string;
  stepLabel: string;
  role: string;
  durationDays: string;
  description: string;
  conditionMinAmount: string;
  conditionMaxAmount: string;
}

const ROLES = [
  { value: 'CREDIT_ANALYST', label: 'Analyste de Crédit' },
  { value: 'BRANCH_MANAGER', label: 'Directeur d\'Agence' },
  { value: 'CREDIT_COMMITTEE', label: 'Comité de Crédit' },
  { value: 'MANAGEMENT', label: 'Direction Générale' },
];

const emptyFormData: CreditTypeFormData = {
  name: '',
  code: '',
  description: '',
  defaultRate: '',
  minRate: '',
  maxRate: '',
  minDuration: '',
  maxDuration: '',
  requiresCollateral: false,
  isActive: true
};

const emptyStepForm: NewStepFormData = {
  stepName: '',
  stepLabel: '',
  role: '',
  durationDays: '3',
  description: '',
  conditionMinAmount: '',
  conditionMaxAmount: '',
};

export const CreditTypesPage: React.FC = () => {
  const { state: userState } = useUser();
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCreditType, setSelectedCreditType] = useState<CreditType | null>(null);
  const [formData, setFormData] = useState<CreditTypeFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreditTypeFormData, string>>>({});

  // Dialog tabs
  const [activeTab, setActiveTab] = useState(0);

  // Workflow steps state
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepConfig[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [showAddStepForm, setShowAddStepForm] = useState(false);
  const [newStepForm, setNewStepForm] = useState<NewStepFormData>(emptyStepForm);
  const [addStepError, setAddStepError] = useState<string | null>(null);

  // Check if user has write access (only ADMIN can write, MANAGEMENT can only read)
  const hasWriteAccess = userState.currentUser?.role === 'admin';

  useEffect(() => {
    loadCreditTypes();
  }, []);

  const loadCreditTypes = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.getCreditTypes();

      if (response.success && response.data) {
        setCreditTypes(response.data);
      } else {
        setError('Erreur lors du chargement des types de crédit');
      }
    } catch (err: any) {
      console.error('Error loading credit types:', err);
      setError(err.message || 'Erreur lors du chargement des types de crédit');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowSteps = async (creditTypeId: string) => {
    setWorkflowLoading(true);
    setWorkflowError(null);
    try {
      const response = await ApiService.getCreditTypeWorkflowSteps(creditTypeId);
      if (response.success) {
        setWorkflowSteps(response.data || []);
      } else {
        setWorkflowError('Erreur lors du chargement des étapes');
      }
    } catch (err: any) {
      setWorkflowError(err.message || 'Erreur lors du chargement des étapes');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleOpenDialog = (creditType?: CreditType) => {
    setActiveTab(0);
    setShowAddStepForm(false);
    setNewStepForm(emptyStepForm);
    setAddStepError(null);
    setWorkflowSteps([]);

    if (creditType) {
      setEditMode(true);
      setSelectedCreditType(creditType);
      setFormData({
        name: creditType.name,
        code: creditType.code,
        description: creditType.description || '',
        defaultRate: creditType.defaultRate.toString(),
        minRate: creditType.minRate?.toString() || '',
        maxRate: creditType.maxRate?.toString() || '',
        minDuration: creditType.minDuration?.toString() || '',
        maxDuration: creditType.maxDuration?.toString() || '',
        requiresCollateral: creditType.requiresCollateral,
        isActive: creditType.isActive
      });
      // Pre-load workflow steps from the credit type data
      if (creditType.workflowSteps) {
        setWorkflowSteps(creditType.workflowSteps);
      }
    } else {
      setEditMode(false);
      setSelectedCreditType(null);
      setFormData(emptyFormData);
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Load workflow steps when switching to the workflow tab for an existing credit type
    if (newValue === 1 && selectedCreditType && workflowSteps.length === 0) {
      loadWorkflowSteps(selectedCreditType.id);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedCreditType(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setActiveTab(0);
    setWorkflowSteps([]);
    setShowAddStepForm(false);
    setNewStepForm(emptyStepForm);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreditTypeFormData, string>> = {};

    if (!formData.name.trim()) {
      errors.name = 'Le nom est obligatoire';
    }

    if (!formData.code.trim()) {
      errors.code = 'Le code est obligatoire';
    }

    if (!formData.defaultRate || parseFloat(formData.defaultRate) <= 0) {
      errors.defaultRate = 'Le taux par défaut doit être supérieur à 0';
    }

    if (formData.minRate && parseFloat(formData.minRate) < 0) {
      errors.minRate = 'Le taux minimum ne peut pas être négatif';
    }

    if (formData.maxRate && parseFloat(formData.maxRate) < 0) {
      errors.maxRate = 'Le taux maximum ne peut pas être négatif';
    }

    if (formData.minRate && formData.maxRate && parseFloat(formData.minRate) > parseFloat(formData.maxRate)) {
      errors.minRate = 'Le taux minimum doit être inférieur au taux maximum';
    }

    if (formData.minRate && formData.defaultRate && parseFloat(formData.defaultRate) < parseFloat(formData.minRate)) {
      errors.defaultRate = 'Le taux par défaut doit être entre le taux minimum et maximum';
    }

    if (formData.maxRate && formData.defaultRate && parseFloat(formData.defaultRate) > parseFloat(formData.maxRate)) {
      errors.defaultRate = 'Le taux par défaut doit être entre le taux minimum et maximum';
    }

    if (formData.minDuration && parseInt(formData.minDuration) < 0) {
      errors.minDuration = 'La durée minimum ne peut pas être négative';
    }

    if (formData.maxDuration && parseInt(formData.maxDuration) < 0) {
      errors.maxDuration = 'La durée maximum ne peut pas être négative';
    }

    if (formData.minDuration && formData.maxDuration && parseInt(formData.minDuration) > parseInt(formData.maxDuration)) {
      errors.minDuration = 'La durée minimum doit être inférieure à la durée maximum';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        defaultRate: parseFloat(formData.defaultRate),
        minRate: formData.minRate ? parseFloat(formData.minRate) : undefined,
        maxRate: formData.maxRate ? parseFloat(formData.maxRate) : undefined,
        minDuration: formData.minDuration ? parseInt(formData.minDuration) : undefined,
        maxDuration: formData.maxDuration ? parseInt(formData.maxDuration) : undefined,
        requiresCollateral: formData.requiresCollateral,
        isActive: formData.isActive
      };

      let response;
      if (editMode && selectedCreditType) {
        response = await ApiService.updateCreditType(selectedCreditType.id, payload);
      } else {
        response = await ApiService.createCreditType(payload);
      }

      if (response.success) {
        setSuccess(editMode ? 'Type de crédit mis à jour avec succès' : 'Type de crédit créé avec succès');
        handleCloseDialog();
        loadCreditTypes();
      } else {
        setError(response.error || 'Erreur lors de l\'enregistrement');
      }
    } catch (err: any) {
      console.error('Error saving credit type:', err);
      setError(err.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleOpenDeleteDialog = (creditType: CreditType) => {
    setSelectedCreditType(creditType);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedCreditType(null);
  };

  const handleDelete = async () => {
    if (!selectedCreditType) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await ApiService.deleteCreditType(selectedCreditType.id);

      if (response.success) {
        setSuccess('Type de crédit supprimé avec succès');
        handleCloseDeleteDialog();
        loadCreditTypes();
      } else {
        setError(response.error || 'Erreur lors de la suppression');
      }
    } catch (err: any) {
      console.error('Error deleting credit type:', err);
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleInputChange = (field: keyof CreditTypeFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // ── Workflow Step Handlers ──────────────────────────────────────────────────

  const handleAddStep = async () => {
    if (!selectedCreditType) return;
    setAddStepError(null);

    if (!newStepForm.stepName.trim() || !newStepForm.stepLabel.trim() || !newStepForm.role) {
      setAddStepError('Le nom technique, le libellé et le rôle sont obligatoires');
      return;
    }

    try {
      const nextOrder = workflowSteps.length > 0 ? Math.max(...workflowSteps.map(s => s.order)) + 1 : 1;
      const response = await ApiService.createCreditTypeWorkflowStep(selectedCreditType.id, {
        stepName: newStepForm.stepName.trim(),
        stepLabel: newStepForm.stepLabel.trim(),
        role: newStepForm.role,
        order: nextOrder,
        durationDays: parseInt(newStepForm.durationDays) || 3,
        description: newStepForm.description.trim() || undefined,
        conditionMinAmount: newStepForm.conditionMinAmount ? parseFloat(newStepForm.conditionMinAmount) : null,
        conditionMaxAmount: newStepForm.conditionMaxAmount ? parseFloat(newStepForm.conditionMaxAmount) : null,
      });

      if (response.success) {
        setWorkflowSteps(prev => [...prev, response.data]);
        setNewStepForm(emptyStepForm);
        setShowAddStepForm(false);
      } else {
        setAddStepError(response.error || 'Erreur lors de l\'ajout de l\'étape');
      }
    } catch (err: any) {
      setAddStepError(err.message || 'Erreur lors de l\'ajout de l\'étape');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedCreditType) return;
    try {
      const response = await ApiService.deleteCreditTypeWorkflowStep(selectedCreditType.id, stepId);
      if (response.success) {
        // Reload fresh order from server
        await loadWorkflowSteps(selectedCreditType.id);
      }
    } catch (err: any) {
      setWorkflowError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!selectedCreditType) return;

    const sortedSteps = [...workflowSteps].sort((a, b) => a.order - b.order);
    const idx = sortedSteps.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sortedSteps.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updatedSteps = [...sortedSteps];
    const tempOrder = updatedSteps[idx].order;
    updatedSteps[idx] = { ...updatedSteps[idx], order: updatedSteps[swapIdx].order };
    updatedSteps[swapIdx] = { ...updatedSteps[swapIdx], order: tempOrder };

    // Optimistic update
    setWorkflowSteps(updatedSteps);

    try {
      await ApiService.reorderCreditTypeWorkflowSteps(
        selectedCreditType.id,
        updatedSteps.map(s => ({ id: s.id, order: s.order }))
      );
    } catch (err: any) {
      // Revert on error
      setWorkflowError(err.message || 'Erreur lors du réordonnancement');
      await loadWorkflowSteps(selectedCreditType.id);
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BusinessIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Types de Crédit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gérer les types de crédit et leurs paramètres
            </Typography>
          </Box>
        </Box>
        {hasWriteAccess && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nouveau Type
          </Button>
        )}
      </Box>

      {/* Access Info for Management Role */}
      {userState.currentUser?.role === 'management' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Vous avez un accès en lecture seule. Contactez un administrateur pour modifier les types de crédit.
        </Alert>
      )}

      {/* Error and Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Credit Types Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Code</strong></TableCell>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Taux par défaut</strong></TableCell>
                <TableCell><strong>Taux Min/Max</strong></TableCell>
                <TableCell><strong>Durée (mois)</strong></TableCell>
                <TableCell><strong>Garantie</strong></TableCell>
                <TableCell><strong>Workflow</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
                {hasWriteAccess && <TableCell align="center"><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {creditTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasWriteAccess ? 9 : 8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Aucun type de crédit disponible
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                creditTypes.map((creditType) => (
                  <TableRow key={creditType.id} hover>
                    <TableCell>
                      <Chip label={creditType.code} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {creditType.name}
                      </Typography>
                      {creditType.description && (
                        <Typography variant="caption" color="text.secondary">
                          {creditType.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="primary">
                        {creditType.defaultRate}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {creditType.minRate ? `${creditType.minRate}%` : 'N/A'} - {creditType.maxRate ? `${creditType.maxRate}%` : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {creditType.minDuration || 'N/A'} - {creditType.maxDuration || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={creditType.requiresCollateral ? 'Obligatoire' : 'Non requis'}
                        size="small"
                        color={creditType.requiresCollateral ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {creditType.workflowSteps && creditType.workflowSteps.length > 0 ? (
                        <Chip
                          icon={<WorkflowIcon />}
                          label={`${creditType.workflowSteps.length} étape(s)`}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      ) : (
                        <Chip label="Défaut" size="small" color="default" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={creditType.isActive ? 'Actif' : 'Inactif'}
                        size="small"
                        color={creditType.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    {hasWriteAccess && (
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(creditType)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteDialog(creditType)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? 'Modifier le Type de Crédit' : 'Nouveau Type de Crédit'}
        </DialogTitle>
        <DialogContent>
          {editMode && (
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Informations générales" />
              <Tab label="Configuration du Workflow" icon={<WorkflowIcon />} iconPosition="start" />
            </Tabs>
          )}

          {/* Tab 0: General Information */}
          {activeTab === 0 && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nom du Type de Crédit"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Code"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  error={!!formErrors.code}
                  helperText={formErrors.code || 'Ex: CT, CI, CIMMO'}
                  required
                  disabled={editMode} // Don't allow code changes in edit mode
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Taux par Défaut (%)"
                  type="number"
                  value={formData.defaultRate}
                  onChange={(e) => handleInputChange('defaultRate', e.target.value)}
                  error={!!formErrors.defaultRate}
                  helperText={formErrors.defaultRate}
                  required
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Taux Minimum (%)"
                  type="number"
                  value={formData.minRate}
                  onChange={(e) => handleInputChange('minRate', e.target.value)}
                  error={!!formErrors.minRate}
                  helperText={formErrors.minRate}
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Taux Maximum (%)"
                  type="number"
                  value={formData.maxRate}
                  onChange={(e) => handleInputChange('maxRate', e.target.value)}
                  error={!!formErrors.maxRate}
                  helperText={formErrors.maxRate}
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Durée Minimum (mois)"
                  type="number"
                  value={formData.minDuration}
                  onChange={(e) => handleInputChange('minDuration', e.target.value)}
                  error={!!formErrors.minDuration}
                  helperText={formErrors.minDuration}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Durée Maximum (mois)"
                  type="number"
                  value={formData.maxDuration}
                  onChange={(e) => handleInputChange('maxDuration', e.target.value)}
                  error={!!formErrors.maxDuration}
                  helperText={formErrors.maxDuration}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.requiresCollateral}
                      onChange={(e) => handleInputChange('requiresCollateral', e.target.checked)}
                    />
                  }
                  label="Garantie obligatoire"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    />
                  }
                  label="Actif"
                />
              </Grid>
            </Grid>
          )}

          {/* Tab 1: Workflow Configuration */}
          {activeTab === 1 && selectedCreditType && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configurez les étapes du workflow pour ce type de crédit. L'étape "Demande créée" est toujours incluse automatiquement.
              </Typography>

              {workflowError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setWorkflowError(null)}>
                  {workflowError}
                </Alert>
              )}

              {workflowLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Ordre</strong></TableCell>
                          <TableCell><strong>Nom de l'étape</strong></TableCell>
                          <TableCell><strong>Rôle</strong></TableCell>
                          <TableCell><strong>Durée (jours)</strong></TableCell>
                          {hasWriteAccess && <TableCell align="center"><strong>Actions</strong></TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workflowSteps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={hasWriteAccess ? 5 : 4} align="center">
                              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                Aucune étape configurée — le workflow par défaut (basé sur les montants) sera utilisé.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          [...workflowSteps]
                            .sort((a, b) => a.order - b.order)
                            .map((step, idx, arr) => (
                              <TableRow key={step.id} hover>
                                <TableCell>
                                  <Chip label={step.order} size="small" color="default" />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600}>{step.stepLabel}</Typography>
                                  <Typography variant="caption" color="text.secondary">{step.stepName}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip label={getRoleLabel(step.role)} size="small" color="primary" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                  {step.durationDays} j
                                  {(step.conditionMinAmount || step.conditionMaxAmount) && (
                                    <Typography variant="caption" color="warning.main" display="block">
                                      {step.conditionMinAmount ? `≥ ${Number(step.conditionMinAmount).toLocaleString('fr-FR')}` : ''}
                                      {step.conditionMinAmount && step.conditionMaxAmount ? ' · ' : ''}
                                      {step.conditionMaxAmount ? `≤ ${Number(step.conditionMaxAmount).toLocaleString('fr-FR')}` : ''}
                                      {' XOF'}
                                    </Typography>
                                  )}
                                </TableCell>
                                {hasWriteAccess && (
                                  <TableCell align="center">
                                    <Tooltip title="Monter">
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleMoveStep(step.id, 'up')}
                                          disabled={idx === 0}
                                        >
                                          <ArrowUpward fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="Descendre">
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleMoveStep(step.id, 'down')}
                                          disabled={idx === arr.length - 1}
                                        >
                                          <ArrowDownward fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="Supprimer">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteStep(step.id)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Add Step Form */}
                  {hasWriteAccess && (
                    <>
                      {!showAddStepForm ? (
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => setShowAddStepForm(true)}
                          size="small"
                        >
                          Ajouter une étape
                        </Button>
                      ) : (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 2 }}>Nouvelle étape</Typography>
                          {addStepError && (
                            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAddStepError(null)}>
                              {addStepError}
                            </Alert>
                          )}
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Libellé de l'étape"
                                value={newStepForm.stepLabel}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, stepLabel: e.target.value }))}
                                required
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Nom technique (snake_case)"
                                value={newStepForm.stepName}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, stepName: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                                required
                                helperText="Ex: credit_analysis"
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth size="small" required>
                                <InputLabel>Rôle</InputLabel>
                                <Select
                                  value={newStepForm.role}
                                  label="Rôle"
                                  onChange={(e) => setNewStepForm(prev => ({ ...prev, role: e.target.value }))}
                                >
                                  {ROLES.map(r => (
                                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Durée (jours)"
                                type="number"
                                value={newStepForm.durationDays}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, durationDays: e.target.value }))}
                                inputProps={{ min: 1 }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Description (optionnel)"
                                value={newStepForm.description}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                Condition sur le montant (optionnel) — laisser vide pour une étape toujours obligatoire
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Montant minimum (XOF)"
                                type="number"
                                value={newStepForm.conditionMinAmount}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, conditionMinAmount: e.target.value }))}
                                helperText="Étape active si montant ≥ cette valeur"
                                inputProps={{ min: 0 }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Montant maximum (XOF)"
                                type="number"
                                value={newStepForm.conditionMaxAmount}
                                onChange={(e) => setNewStepForm(prev => ({ ...prev, conditionMaxAmount: e.target.value }))}
                                helperText="Étape active si montant ≤ cette valeur"
                                inputProps={{ min: 0 }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button variant="contained" size="small" onClick={handleAddStep}>
                                  Ajouter
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setShowAddStepForm(false);
                                    setNewStepForm(emptyStepForm);
                                    setAddStepError(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>
                        </Paper>
                      )}
                    </>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            {activeTab === 1 ? 'Fermer' : 'Annuler'}
          </Button>
          {activeTab === 0 && (
            <Button onClick={handleSubmit} variant="contained">
              {editMode ? 'Mettre à jour' : 'Créer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer le type de crédit "{selectedCreditType?.name}" ?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Cette action ne peut pas être annulée. Le type de crédit ne peut pas être supprimé s'il est utilisé par des demandes existantes.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
