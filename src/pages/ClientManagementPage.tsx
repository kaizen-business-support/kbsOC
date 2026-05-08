import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
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
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  AccountBalance as BankIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Analytics as AnalysisIcon,
  PlayArrow as StartIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

interface ClientManagementPageProps {
  onNavigate: (page: any) => void;
}

interface Client {
  id: string;
  name: string;
  rccm: string;
  ninea: string;
  cofi: string;
  industry: string;
  branch: string;
  relationshipManager: string;
  createdDate: string;
  status: 'active' | 'inactive' | 'pending';
}

interface Shareholder {
  id: string;
  name: string;
  type: 'individual' | 'corporate';
  ownership: number;
  nationalId?: string;
  tin?: string;
  rccm?: string;
}

const industries = [
  'Agriculture et Agrobusiness',
  'Manufacture et Industrie',
  'Commerce et Distribution',
  'Services et Professionnel',
  'Technologie et Innovation',
  'Tourisme et Hôtellerie',
  'Transport et Logistique',
];

interface AssignedApplication {
  id: string;
  applicationNumber: string;
  clientName: string;
  clientId: string;
  amount: number;
  currency: string;
  purpose: string;
  status: string;
  deadline?: string;
  hasAnalysis: boolean;
  workflowStepId?: string;
}

const APP_STATUS_FR: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  submitted: { label: 'Soumis', color: 'info' },
  under_review: { label: 'En cours', color: 'warning' },
  approved: { label: 'Approuvé', color: 'success' },
  rejected: { label: 'Rejeté', color: 'error' },
  pending: { label: 'En attente', color: 'default' },
};

export const ClientManagementPage: React.FC<ClientManagementPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [rawClientsMap, setRawClientsMap] = useState<Record<string, any>>({});
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [createNotif, setCreateNotif] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit state
  const emptyEditForm = { companyName: '', rccm: '', ninea: '', legalForm: '', sector: '', branch: '', headquarters: '', phone: '', email: '', contactPerson: '' };
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editNotif, setEditNotif] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const emptyForm = { companyName: '', rccm: '', ninea: '', legalForm: '', sector: '', branch: '', headquarters: '', phone: '', email: '', contactPerson: '' };
  const [newClientForm, setNewClientForm] = useState(emptyForm);

  const mapRawClient = (c: any): Client => ({
    id: c.id,
    name: c.companyName,
    rccm: c.rccm || 'N/A',
    ninea: c.ninea || 'N/A',
    cofi: c.legalForm || 'N/A',
    industry: c.sector || 'Non spécifié',
    branch: c.branch || c.creator?.department || 'Non spécifié',
    relationshipManager: c.creator?.name || 'Non assigné',
    createdDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
    status: c.isActive ? 'active' : 'inactive',
  });

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setNewClientForm(prev => ({ ...prev, [field]: e.target.value as string }));

  const handleEditFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setEditForm(prev => ({ ...prev, [field]: e.target.value as string }));

  const handleOpenEdit = (client: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const raw = rawClientsMap[client.id];
    setEditingClientId(client.id);
    setEditForm({
      companyName: raw?.companyName || client.name,
      rccm: raw?.rccm || '',
      ninea: raw?.ninea || '',
      legalForm: raw?.legalForm || client.cofi !== 'N/A' ? (raw?.legalForm || '') : '',
      sector: raw?.sector || (client.industry !== 'Non spécifié' ? client.industry : ''),
      branch: raw?.branch || '',
      headquarters: raw?.headquarters || '',
      phone: raw?.phone || '',
      email: raw?.email || '',
      contactPerson: raw?.contactPerson || '',
    });
    setEditNotif(null);
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingClientId) return;
    if (!editForm.companyName.trim()) {
      setEditNotif({ msg: 'La raison sociale est obligatoire', sev: 'error' });
      return;
    }
    setIsEditSaving(true);
    try {
      const res = await ApiService.updateClient(editingClientId, editForm);
      if (res.success) {
        setEditNotif({ msg: 'Client modifié avec succès', sev: 'success' });
        const refreshed = await ApiService.getClients();
        if (refreshed.success && refreshed.data) {
          const raw: Record<string, any> = {};
          refreshed.data.forEach((c: any) => { raw[c.id] = c; });
          setRawClientsMap(raw);
          setClients(refreshed.data.map(mapRawClient));
        }
        setTimeout(() => setOpenEditDialog(false), 1000);
      } else {
        setEditNotif({ msg: res.error || 'Erreur lors de la modification', sev: 'error' });
      }
    } catch {
      setEditNotif({ msg: 'Erreur lors de la modification du client', sev: 'error' });
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientForm.companyName.trim()) {
      setCreateNotif({ msg: 'La raison sociale est obligatoire', sev: 'error' });
      return;
    }
    setIsCreating(true);
    try {
      const res = await ApiService.createClient(newClientForm);
      if (res.success) {
        setCreateNotif({ msg: 'Client créé avec succès', sev: 'success' });
        setNewClientForm(emptyForm);
        // Refresh client list and switch to list tab
        const refreshed = await ApiService.getClients();
        if (refreshed.success && refreshed.data) {
          const raw: Record<string, any> = {};
          refreshed.data.forEach((c: any) => { raw[c.id] = c; });
          setRawClientsMap(raw);
          setClients(refreshed.data.map(mapRawClient));
        }
        setTimeout(() => setCurrentTab(0), 1200);
      } else {
        setCreateNotif({ msg: res.error || 'Erreur lors de la création', sev: 'error' });
      }
    } catch {
      setCreateNotif({ msg: 'Erreur lors de la création du client', sev: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  // Analyse tab state
  const [assignedApps, setAssignedApps] = useState<AssignedApplication[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Load current user once
  useEffect(() => {
    ApiService.getCurrentUser().then(user => {
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserRole(user.role);
      }
    }).catch(() => {});
  }, []);

  const loadAssignedApps = useCallback(async () => {
    if (!currentUserId) return;
    setAssignedLoading(true);
    try {
      const res = await ApiService.getApplications({ assignedAnalystId: currentUserId });
      if (res.success && res.data) {
        const apps: AssignedApplication[] = res.data.map((app: any) => {
          const analystStep = (app.workflowSteps || []).find(
            (s: any) => s.role === 'CREDIT_ANALYST' && s.assigneeId === currentUserId
          );
          return {
            id: app.id,
            applicationNumber: app.applicationNumber || app.id.slice(0, 8).toUpperCase(),
            clientName: app.clientName,
            clientId: app.clientId,
            amount: app.amount,
            currency: app.currency || 'XOF',
            purpose: app.purpose || '',
            status: app.status,
            deadline: analystStep?.deadline,
            hasAnalysis: !!(app.analysisResults?.preliminaryAnalysis),
            workflowStepId: analystStep?.id,
          };
        });
        setAssignedApps(apps);
      }
    } catch (e) {
      console.error('Error loading assigned apps:', e);
    } finally {
      setAssignedLoading(false);
    }
  }, [currentUserId]);

  // Load assigned apps when Analyse tab becomes active or user loaded
  useEffect(() => {
    if (currentTab === 3 && currentUserId) {
      loadAssignedApps();
    }
  }, [currentTab, currentUserId, loadAssignedApps]);

  // Load clients from API on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        const response = await ApiService.getClients();
        if (response.success && response.data) {
          const raw: Record<string, any> = {};
          response.data.forEach((c: any) => { raw[c.id] = c; });
          setRawClientsMap(raw);
          setClients(response.data.map(mapRawClient));
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setOpenDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.rccm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('clients.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('clients.subtitle')}
        </Typography>
      </Box>

      {/* Main Content */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="Liste des Clients" />
            <Tab label="Nouveau Client" />
            <Tab label="Actionnaires" />
            {(currentUserRole === 'CREDIT_ANALYST' || currentUserRole === 'ANALYST_SUPERVISOR' || currentUserRole === 'ADMIN') && (
              <Tab label="Analyse" icon={<AnalysisIcon fontSize="small" />} iconPosition="start" />
            )}
          </Tabs>
        </Box>

        <CardContent>
          {currentTab === 0 && (
            <Box>
              {/* Search and Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <TextField
                  placeholder="Rechercher par nom ou RCCM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                  }}
                  sx={{ minWidth: 300 }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCurrentTab(1)}
                >
                  Nouveau Client
                </Button>
              </Box>

              {/* Client Table */}
              <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Client', 'RCCM', 'NINEA', 'Secteur', 'Agence', "Chargé d'Affaires", 'Statut', 'Actions'].map((col) => (
                        <TableCell key={col} align={col === 'Actions' ? 'center' : 'left'} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow
                        key={client.id}
                        sx={{
                          borderBottom: '1px solid #f1f5f9',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: 'rgba(31,78,121,0.03)', cursor: 'pointer' },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 30, height: 30 }}>
                              <BusinessIcon fontSize="small" />
                            </Avatar>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 500, color: '#374151' }}>
                              {client.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151', fontFamily: 'monospace' }}>{client.rccm}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151', fontFamily: 'monospace' }}>{client.ninea}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.industry}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.branch}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.relationshipManager}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={client.status}
                            color={getStatusColor(client.status) as any}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleClientClick(client)}
                            color="primary"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => onNavigate('credit-scoring')}
                          >
                            <AnalysisIcon />
                          </IconButton>
                          <IconButton size="small" color="default" onClick={(e) => handleOpenEdit(client, e)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {currentTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Création d'un Nouveau Client Corporatif
              </Typography>
              
              {createNotif && (
                <Alert severity={createNotif.sev} onClose={() => setCreateNotif(null)} sx={{ mb: 2 }}>
                  {createNotif.msg}
                </Alert>
              )}
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Raison Sociale *"
                    placeholder="Ex: SARL TECH SOLUTIONS"
                    required
                    value={newClientForm.companyName}
                    onChange={handleFormChange('companyName')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="RCCM"
                    placeholder="Ex: SN-DKR-2020-B-1234"
                    helperText="Registre du Commerce et du Crédit Mobilier"
                    value={newClientForm.rccm}
                    onChange={handleFormChange('rccm')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="NINEA"
                    placeholder="Ex: 0123456789"
                    helperText="Numéro d'Identification Nationale des Entreprises"
                    value={newClientForm.ninea}
                    onChange={handleFormChange('ninea')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Forme Juridique (COFI)</InputLabel>
                    <Select label="Forme Juridique (COFI)" value={newClientForm.legalForm} onChange={handleFormChange('legalForm') as any}>
                      <MenuItem value="SARL">SARL - Société à Responsabilité Limitée</MenuItem>
                      <MenuItem value="SA">SA - Société Anonyme</MenuItem>
                      <MenuItem value="GIE">GIE - Groupement d'Intérêt Économique</MenuItem>
                      <MenuItem value="SNC">SNC - Société en Nom Collectif</MenuItem>
                      <MenuItem value="EI">EI - Entreprise Individuelle</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Secteur d'Activité</InputLabel>
                    <Select label="Secteur d'Activité" value={newClientForm.sector} onChange={handleFormChange('sector') as any}>
                      {industries.map((industry) => (
                        <MenuItem key={industry} value={industry}>
                          {industry}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agence de Rattachement</InputLabel>
                    <Select label="Agence de Rattachement" value={newClientForm.branch} onChange={handleFormChange('branch') as any}>
                      <MenuItem value="Dakar Centre">Dakar Centre</MenuItem>
                      <MenuItem value="Dakar Plateau">Dakar Plateau</MenuItem>
                      <MenuItem value="Thiès">Thiès</MenuItem>
                      <MenuItem value="Kaolack">Kaolack</MenuItem>
                      <MenuItem value="Saint-Louis">Saint-Louis</MenuItem>
                      <MenuItem value="Ziguinchor">Ziguinchor</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Personne de Contact"
                    placeholder="Ex: Mamadou Diallo"
                    value={newClientForm.contactPerson}
                    onChange={handleFormChange('contactPerson')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Siège Social"
                    placeholder="Adresse du siège social"
                    value={newClientForm.headquarters}
                    onChange={handleFormChange('headquarters')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    placeholder="Ex: +221 33 123 45 67"
                    value={newClientForm.phone}
                    onChange={handleFormChange('phone')}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    placeholder="contact@entreprise.sn"
                    value={newClientForm.email}
                    onChange={handleFormChange('email')}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => setCurrentTab(0)}
                      disabled={isCreating}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                      onClick={handleCreateClient}
                      disabled={isCreating}
                    >
                      Créer le Client
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {currentTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Gestion des Actionnaires
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Traçabilité complète des structures de propriété et détection des parties liées
              </Typography>

              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Module Actionnaires
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Fonctionnalité disponible après création des clients
                  </Typography>
                  <Button variant="outlined" disabled>
                    Gérer les Actionnaires
                  </Button>
                </CardContent>
              </Card>
            </Box>
          )}

          {currentTab === 3 && (
            <Box>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Dossiers à analyser
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Demandes de crédit qui vous sont affectées
                  </Typography>
                </Box>
                <Tooltip title="Rafraîchir">
                  <IconButton onClick={loadAssignedApps} disabled={assignedLoading}>
                    {assignedLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                  </IconButton>
                </Tooltip>
              </Box>

              {assignedLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : assignedApps.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Aucun dossier ne vous est actuellement affecté.
                </Alert>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {['N° Dossier', 'Client', 'Objet', 'Montant', 'Statut', 'Avancement', 'Actions'].map(col => (
                          <TableCell
                            key={col}
                            align={col === 'Actions' ? 'center' : 'left'}
                            sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}
                          >
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assignedApps.map(app => {
                        const statusInfo = APP_STATUS_FR[app.status] || { label: app.status, color: 'default' as const };
                        const isOverdue = app.deadline && new Date(app.deadline) < new Date();
                        return (
                          <TableRow
                            key={app.id}
                            sx={{
                              borderBottom: '1px solid #f1f5f9',
                              '&:last-child': { borderBottom: 'none' },
                              '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' },
                            }}
                          >
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography sx={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: 'primary.main' }}>
                                {app.applicationNumber}
                              </Typography>
                              {isOverdue && (
                                <Typography variant="caption" color="error">
                                  Délai dépassé
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: '12px' }}>
                                  <BusinessIcon fontSize="small" />
                                </Avatar>
                                <Typography sx={{ fontSize: '13.5px', fontWeight: 500, color: '#374151' }}>
                                  {app.clientName}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, fontSize: '13px', color: '#374151', maxWidth: 180 }}>
                              <Typography variant="body2" noWrap title={app.purpose}>
                                {app.purpose || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1f4e79' }}>
                                {app.amount.toLocaleString('fr-FR')} {app.currency}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={statusInfo.label}
                                color={statusInfo.color}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={app.hasAnalysis ? 'Analyse enregistrée' : 'Non commencé'}
                                color={app.hasAnalysis ? 'success' : 'default'}
                                size="small"
                                variant={app.hasAnalysis ? 'filled' : 'outlined'}
                              />
                            </TableCell>
                            <TableCell align="center" sx={{ py: 1.5 }}>
                              <Tooltip title={app.hasAnalysis ? "Continuer l'analyse" : "Commencer l'analyse"}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color={app.hasAnalysis ? 'success' : 'primary'}
                                  startIcon={<StartIcon />}
                                  onClick={() => {
                                    localStorage.setItem('pending_scoring_app', app.id);
                                    onNavigate('credit-scoring');
                                  }}
                                  sx={{ textTransform: 'none', fontSize: '12px' }}
                                >
                                  {app.hasAnalysis ? 'Continuer' : 'Analyser'}
                                </Button>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Client Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modifier le Client</DialogTitle>
        <DialogContent>
          {editNotif && (
            <Alert severity={editNotif.sev} onClose={() => setEditNotif(null)} sx={{ mb: 2, mt: 1 }}>
              {editNotif.msg}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Raison Sociale *" value={editForm.companyName} onChange={handleEditFormChange('companyName')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="RCCM" value={editForm.rccm} onChange={handleEditFormChange('rccm')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="NINEA" value={editForm.ninea} onChange={handleEditFormChange('ninea')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Forme Juridique</InputLabel>
                <Select label="Forme Juridique" value={editForm.legalForm} onChange={handleEditFormChange('legalForm') as any}>
                  {['SA', 'SARL', 'SAS', 'SNC', 'GIE', 'Établissement Public', 'Association', 'Autre'].map(f => (
                    <MenuItem key={f} value={f}>{f}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Secteur d'Activité</InputLabel>
                <Select label="Secteur d'Activité" value={editForm.sector} onChange={handleEditFormChange('sector') as any}>
                  {industries.map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Agence" value={editForm.branch} onChange={handleEditFormChange('branch')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Siège Social" value={editForm.headquarters} onChange={handleEditFormChange('headquarters')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Téléphone" value={editForm.phone} onChange={handleEditFormChange('phone')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Email" value={editForm.email} onChange={handleEditFormChange('email')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Personne de Contact" value={editForm.contactPerson} onChange={handleEditFormChange('contactPerson')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)} disabled={isEditSaving}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={isEditSaving}
            startIcon={isEditSaving ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Details Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Détails du Client
        </DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Raison Sociale</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {selectedClient.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">RCCM</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedClient.rccm}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">NINEA</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedClient.ninea}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Forme Juridique</Typography>
                <Typography variant="body1">{selectedClient.cofi}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Secteur</Typography>
                <Typography variant="body1">{selectedClient.industry}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Agence</Typography>
                <Typography variant="body1">{selectedClient.branch}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Fermer</Button>
          <Button variant="contained" startIcon={<EditIcon />} onClick={() => { setOpenDialog(false); if (selectedClient) handleOpenEdit(selectedClient); }}>
            Modifier
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};