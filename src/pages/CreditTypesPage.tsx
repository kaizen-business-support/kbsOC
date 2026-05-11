import React, { useState, useEffect } from 'react';
import {
  Box,
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
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
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
  { value: 'ACCOUNT_MANAGER',    label: 'Chargé de Compte' },
  { value: 'CREDIT_ANALYST',     label: 'Analyste Crédit' },
  { value: 'ANALYST_SUPERVISOR', label: 'Superviseur Analyste' },
  { value: 'BRANCH_MANAGER',     label: 'Directeur d\'Agence' },
  { value: 'CREDIT_COMMITTEE',   label: 'Comité de Crédit' },
  { value: 'MANAGEMENT',         label: 'Direction Générale' },
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

export const CreditTypesPage: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
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

  const handleOpenDialog = (creditType?: CreditType) => {
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
    } else {
      setEditMode(false);
      setSelectedCreditType(null);
      setFormData(emptyFormData);
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedCreditType(null);
    setFormData(emptyFormData);
    setFormErrors({});
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


  return (
    <Box sx={{ p: compact ? 0 : { xs: 2, md: 3 } }}>
      {!compact && (
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
      )}
      {compact && (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            mb: 3,
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Types de crédit</Typography>
            <Typography variant="caption" color="text.secondary">
              {creditTypes.length} produit{creditTypes.length !== 1 ? 's' : ''} configuré{creditTypes.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          {hasWriteAccess && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Nouveau Type
            </Button>
          )}
        </Box>
      )}

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
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Code</strong></TableCell>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Taux par défaut</strong></TableCell>
                <TableCell><strong>Taux Min/Max</strong></TableCell>
                <TableCell><strong>Durée (mois)</strong></TableCell>
                <TableCell><strong>Garantie</strong></TableCell>
                <TableCell><strong>Statut</strong></TableCell>
                {hasWriteAccess && <TableCell align="center"><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {creditTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasWriteAccess ? 8 : 7} align="center">
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editMode ? 'Mettre à jour' : 'Créer'}
          </Button>
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
    </Box>
  );
};
