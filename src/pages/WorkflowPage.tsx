import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Alert,
  LinearProgress,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TablePagination,
  Avatar,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Assessment as AnalysisIcon,
  PlayArrow as StartIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  AssignmentLate as OverdueIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import {
  WorkflowTimestamps,
  WorkflowStepId,
  WorkflowStep
} from '../types';
import {
  FIXED_WORKFLOW_STEPS,
  getExpectedWorkflowSteps
} from '../utils/workflowConfig';
import { WorkflowTimeline } from '../components/WorkflowTimeline';
import { WorkflowDetailsDialog } from '../components/WorkflowDetailsDialog';
import { ApiService } from '../services/api';
import { PowerDelegation } from '../types/delegation';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';

// Local type definitions
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed';

// Mapping des étapes workflow → libellés affichés
const STEP_DISPLAY: Record<string, { label: string; color: 'default' | 'primary' | 'info' | 'warning' | 'success' | 'error' }> = {
  application_created:     { label: 'Création',             color: 'default'  },
  credit_analysis:         { label: 'Analyse Crédit',       color: 'info'     },
  branch_manager_review:   { label: "Dir. d'Agence",        color: 'warning'  },
  credit_committee_review: { label: 'Comité de Crédit',     color: 'warning'  },
  management_review:       { label: 'Direction Générale',   color: 'warning'  },
  final_decision:          { label: 'Décision Finale',      color: 'info'     },
  contract_preparation:    { label: 'Préparation Contrat',  color: 'info'     },
  disbursement:            { label: 'Déblocage',            color: 'success'  },
};

export interface CreditApplication {
  id: string;
  clientName: string;
  amount: number;
  status: ApplicationStatus;
  applicationNumber?: string;
  createdAt?: string;
  [key: string]: any;
}

interface WorkflowPageProps {
  onNavigate: (page: any) => void;
}

// Roles that receive step assignments and should see "Mes dossiers" tab
const ANALYST_ROLES = ['credit_analyst', 'analyst_supervisor'];

export const WorkflowPage: React.FC<WorkflowPageProps> = ({ onNavigate }) => {
  const { state: userState, isRole } = useUser();
  const navigate = useNavigate();

  const isAnalystRole = ANALYST_ROLES.includes(userState.currentUser?.role || '');

  // Analyst roles start on "Mes dossiers" tab (index 0); others start on "Vue d'ensemble"
  const [activeTab, setActiveTab] = useState(isAnalystRole ? 0 : 0);
  const [workflows, setWorkflows] = useState<WorkflowTimestamps[]>([]);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [myAssignedApps, setMyAssignedApps] = useState<any[]>([]);
  const [myAppsLoading, setMyAppsLoading] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTimestamps | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDelegationReceived, setActiveDelegationReceived] = useState<PowerDelegation | null>(null);

  // Load assigned applications for analyst roles
  const loadMyApps = useCallback(async () => {
    const userId = userState.currentUser?.id;
    if (!userId || !isAnalystRole) return;
    setMyAppsLoading(true);
    try {
      const res = await ApiService.getApplications({ assignedAnalystId: userId });
      if (res.success && res.data) {
        setMyAssignedApps(res.data);
      }
    } catch (e) {
      console.error('Error loading assigned apps:', e);
    } finally {
      setMyAppsLoading(false);
    }
  }, [userState.currentUser?.id, isAnalystRole]);

  // Charger la délégation active reçue
  useEffect(() => {
    const currentId = userState.currentUser?.id;
    if (!currentId) return;
    ApiService.getMyDelegations().then((res: any) => {
      if (!res.success) return;
      const now = new Date();
      const active = (res.data || []).find((d: PowerDelegation) =>
        d.delegateId === currentId &&
        d.isActive &&
        new Date(d.startDate) <= now &&
        new Date(d.endDate) >= now
      );
      setActiveDelegationReceived(active || null);
    }).catch(() => {});
  }, [userState.currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load data on component mount
  useEffect(() => {
    loadData();
    if (isAnalystRole) loadMyApps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ouvrir automatiquement un dossier si la notif a stocké un applicationId
  useEffect(() => {
    const pendingAppId = localStorage.getItem('pending_workflow_app');
    if (!pendingAppId) return;
    localStorage.removeItem('pending_workflow_app');

    // Attendre que les données soient chargées puis ouvrir le dossier
    const tryOpen = (retries = 0) => {
      const wf = workflows.find(w => w.applicationId === pendingAppId);
      if (wf) {
        setSelectedWorkflow(wf);
        setDialogOpen(true);
      } else if (retries < 10) {
        setTimeout(() => tryOpen(retries + 1), 300);
      }
    };
    tryOpen();
  }, [workflows]);

  // Reload data when filters change
  useEffect(() => {
    loadData();
  }, [filterStatus, filterBranch, filterDateFrom, filterDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const userRole = userState.currentUser?.role;
      const userId = userState.currentUser?.id;
      const statusFilter = filterStatus !== 'all' ? filterStatus : undefined;

      const filters: any = {
        status: statusFilter,
        branch: filterBranch !== 'all' ? filterBranch : undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        userRole: 'all',
      };

      // ACCOUNT_MANAGER sees only applications they created
      if (userRole === 'account_manager') {
        filters.userId = userId;
      }

      // CREDIT_ANALYST sees only applications assigned to them
      if (userRole === 'credit_analyst' && userId) {
        filters.assignedAnalystId = userId;
      }

      const [workflowsResponse, applicationsResponse] = await Promise.all([
        ApiService.getWorkflows(filters),
        ApiService.getApplications(filters),
      ]);

      if (workflowsResponse.success) {
        setWorkflows(workflowsResponse.data || []);
      } else {
        setError('Impossible de charger les workflows depuis l\'API');
        setWorkflows([]);
      }

      if (applicationsResponse.success) {
        setApplications(applicationsResponse.data || []);
      } else {
        setError('Impossible de charger les demandes depuis l\'API');
        setApplications([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Erreur lors du chargement des données depuis l\'API');
      setApplications([]);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ApplicationStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'disbursed': return 'success';
      case 'under_review': return 'info';
      case 'submitted': return 'primary';
      case 'draft': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: ApplicationStatus): string => {
    switch (status) {
      case 'draft':        return 'Brouillon';
      case 'submitted':    return 'Soumise';
      case 'under_review': return 'En analyse';
      case 'approved':     return 'Approuvée';
      case 'rejected':     return 'Refusée';
      case 'disbursed':    return 'Débloquée';
      default: return status;
    }
  };

  const getCurrentStep = (workflow: WorkflowTimestamps): WorkflowStep | undefined => {
    if (!workflow.steps || !Array.isArray(workflow.steps)) return undefined;
    return workflow.steps.find(step => step && !step.completedAt);
  };

  const getProgressPercentage = (workflow: WorkflowTimestamps): number => {
    if (!workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) return 0;
    const completedSteps = workflow.steps.filter(step => step && step.completedAt).length;
    return Math.round((completedSteps / workflow.steps.length) * 100);
  };

  // Unified decision function to get consistent workflow status
  const getWorkflowDecision = (workflow: WorkflowTimestamps) => {
    // If there's a finalDecision, use it
    if (workflow.finalDecision) {
      return workflow.finalDecision;
    }

    // If no finalDecision but status is completed, it means it's in progress
    if (workflow.status === 'completed' && !workflow.finalDecision) {
      return 'in_progress';
    }

    // For other statuses, return the status
    return workflow.status || 'pending';
  };

  // Get human-readable workflow status
  const getWorkflowStatusDisplay = (workflow: WorkflowTimestamps): { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' } => {
    if (workflow.finalDecision === 'approved') return { label: 'Approuvé',  color: 'success' };
    if (workflow.finalDecision === 'rejected') return { label: 'Refusé',    color: 'error'   };

    const currentStep = getCurrentStep(workflow);
    if (currentStep) {
      const display = STEP_DISPLAY[currentStep.stepId]
        || STEP_DISPLAY[currentStep.stepName]
        || { label: FIXED_WORKFLOW_STEPS[currentStep.stepId]?.stepName || currentStep.stepName, color: 'info' as const };
      return display;
    }

    return { label: 'En cours', color: 'default' };
  };

  const filteredApplications = applications.filter(app => {
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesBranch = filterBranch === 'all' || app.branch === filterBranch;
    const matchesSearch = searchTerm === '' || 
      app.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.accountManager.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date range filtering
    const appDate = new Date(app.submittedDate);
    const fromDate = filterDateFrom ? new Date(filterDateFrom) : null;
    const toDate = filterDateTo ? new Date(filterDateTo) : null;
    
    const matchesDateFrom = !fromDate || appDate >= fromDate;
    const matchesDateTo = !toDate || appDate <= toDate;
    
    return matchesStatus && matchesBranch && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const paginatedApplications = filteredApplications.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleViewWorkflow = (application: CreditApplication) => {
    // Find workflow for this application (API data only)
    const workflow = workflows.find(w => w.applicationId === application.id);

    if (!workflow) {
      console.warn('No workflow found for application:', application.id);
      console.log('Available workflows:', workflows.map(w => ({ id: w.applicationId, num: w.applicationNumber })));
      console.log('Looking for application:', application.id);
      setError('Workflow non trouvé pour cette demande');
      return;
    }

    setSelectedWorkflow(workflow);
    setDialogOpen(true);
  };

  const handleViewWorkflowDirect = (workflow: WorkflowTimestamps) => {
    // View workflow directly without needing to find matching application
    setSelectedWorkflow(workflow);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedWorkflow(null);
  };

  const TabPanel: React.FC<{ children?: React.ReactNode; value: number; index: number }> = ({ 
    children, 
    value, 
    index 
  }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`workflow-tabpanel-${index}`}
        aria-labelledby={`workflow-tab-${index}`}
      >
        {value === index && <Box>{children}</Box>}
      </div>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 600 }}>
        Suivi des Workflows de Crédit
      </Typography>

      {/* Bandeau délégation active reçue */}
      {activeDelegationReceived && (
        <Alert
          severity="info"
          icon={<BeachAccessIcon />}
          sx={{ mb: 2 }}
        >
          Vous agissez au nom de{' '}
          <strong>{activeDelegationReceived.delegator.name}</strong>
          {' '}(délégation active jusqu'au{' '}
          {new Date(activeDelegationReceived.endDate).toLocaleDateString('fr-FR')})
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading Indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CircularProgress />
        </Box>
      )}

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 4 }}
      >
        {isAnalystRole && (
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Mes dossiers
                {myAssignedApps.length > 0 && (
                  <Chip label={myAssignedApps.length} size="small" color="primary" sx={{ height: 18, fontSize: '10px' }} />
                )}
              </Box>
            }
          />
        )}
        <Tab label="Vue d'ensemble" />
        <Tab label="Workflows en cours" />
        <Tab label="Historique complet" />
      </Tabs>

      {/* ── Mes dossiers (analyst only) ─────────────────────────────────── */}
      {isAnalystRole && (
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Mes dossiers à traiter</Typography>
              <Typography variant="body2" color="text.secondary">
                Demandes de crédit qui vous ont été affectées
              </Typography>
            </Box>
            <Tooltip title="Rafraîchir">
              <IconButton onClick={loadMyApps} disabled={myAppsLoading}>
                {myAppsLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {myAppsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : myAssignedApps.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Aucun dossier ne vous est actuellement affecté.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['N° Dossier', 'Client', 'Objet du crédit', 'Montant', 'Délai', 'Avancement', 'Actions'].map(col => (
                      <TableCell key={col} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myAssignedApps.map((app: any) => {
                    const analystStep = (app.workflowSteps || []).find(
                      (s: any) => s.role === 'CREDIT_ANALYST' && s.assigneeId === userState.currentUser?.id
                    );
                    const deadline = analystStep?.deadline;
                    const isOverdue = deadline && new Date(deadline) < new Date();
                    const hasAnalysis = !!(app.analysisResults?.preliminaryAnalysis);
                    const statusColors: Record<string, any> = {
                      submitted: 'info', under_review: 'warning', approved: 'success', rejected: 'error',
                    };

                    return (
                      <TableRow
                        key={app.id}
                        sx={{
                          borderBottom: '1px solid #f1f5f9',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: isOverdue ? 'rgba(244,67,54,0.03)' : 'rgba(31,78,121,0.03)' },
                          bgcolor: isOverdue ? 'rgba(244,67,54,0.02)' : 'transparent',
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: 'primary.main' }}>
                            {app.applicationNumber || app.id.slice(0, 8).toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28 }}>
                              <BusinessIcon sx={{ fontSize: 14 }} />
                            </Avatar>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 500, color: '#374151' }}>
                              {app.clientName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5, maxWidth: 160 }}>
                          <Typography variant="body2" noWrap title={app.purpose}>{app.purpose || '—'}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1f4e79' }}>
                            {Number(app.amount).toLocaleString('fr-FR')} {app.currency || 'XOF'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          {deadline ? (
                            <Chip
                              size="small"
                              label={isOverdue ? 'Délai dépassé' : new Date(deadline).toLocaleDateString('fr-FR')}
                              color={isOverdue ? 'error' : 'default'}
                              icon={isOverdue ? <OverdueIcon /> : undefined}
                              variant={isOverdue ? 'filled' : 'outlined'}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            size="small"
                            label={hasAnalysis ? 'Analyse enregistrée' : 'Non commencé'}
                            color={hasAnalysis ? 'success' : 'default'}
                            variant={hasAnalysis ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title={hasAnalysis ? "Continuer l'analyse" : "Commencer l'analyse"}>
                              <Button
                                size="small"
                                variant="contained"
                                color={hasAnalysis ? 'success' : 'primary'}
                                startIcon={<StartIcon />}
                                onClick={() => navigate(`/credit-scoring?applicationId=${app.id}`)}
                                sx={{ textTransform: 'none', fontSize: '12px', whiteSpace: 'nowrap' }}
                              >
                                {hasAnalysis ? 'Continuer' : 'Analyser'}
                              </Button>
                            </Tooltip>
                            <Tooltip title="Voir workflow">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  const wf = workflows.find(w => w.applicationId === app.id);
                                  if (wf) { setSelectedWorkflow(wf); setDialogOpen(true); }
                                }}
                                sx={{ textTransform: 'none', fontSize: '12px' }}
                              >
                                Workflow
                              </Button>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      )}

      {/* ── Vue d'ensemble ──────────────────────────────────────────────── */}
      <TabPanel value={activeTab} index={isAnalystRole ? 1 : 0}>
        {/* Overview Tab */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Total Demandes
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {applications.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main" gutterBottom>
                  En cours
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {workflows.filter(w => getWorkflowDecision(w) === 'in_progress').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main" gutterBottom>
                  Approuvées
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {workflows.filter(w => getWorkflowDecision(w) === 'approved').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="error.main" gutterBottom>
                  Refusées
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {workflows.filter(w => getWorkflowDecision(w) === 'rejected').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Current Workflows Summary */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Workflows Actifs
            </Typography>
            {workflows.filter(w => getWorkflowDecision(w) === 'in_progress').length === 0 ? (
              <Typography color="text.secondary">
                Aucun workflow en cours
              </Typography>
            ) : (
              <List>
                {workflows
                  .filter(w => getWorkflowDecision(w) === 'in_progress')
                  .slice(0, 5)
                  .map((workflow) => {
                    const currentStep = getCurrentStep(workflow);
                    const progress = getProgressPercentage(workflow);
                    const workflowStatus = getWorkflowStatusDisplay(workflow);

                    return (
                      <ListItem key={workflow.applicationId} divider>
                        <ListItemText
                          primary={`${workflow.clientName} - ${workflow.applicationNumber}`}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {workflowStatus.label}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{ mt: 1, borderRadius: 1 }}
                              />
                            </Box>
                          }
                        />
                        <Button
                          size="small"
                          onClick={() => {
                            const app = applications.find(app => app.id === workflow.applicationId);
                            if (app) handleViewWorkflow(app);
                          }}
                        >
                          Voir détails
                        </Button>
                      </ListItem>
                    );
                  })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={activeTab} index={isAnalystRole ? 2 : 1}>
        {/* In Progress Workflows Tab */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as string)}
                  label="Statut"
                >
                  <MenuItem value="all">Tous</MenuItem>
                  <MenuItem value="submitted">Soumise</MenuItem>
                  <MenuItem value="under_review">En analyse</MenuItem>
                  <MenuItem value="approved">Approuvée</MenuItem>
                  <MenuItem value="rejected">Refusée</MenuItem>
                  <MenuItem value="disbursed">Débloquée</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Agence</InputLabel>
                <Select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value as string)}
                  label="Agence"
                >
                  <MenuItem value="all">Toutes</MenuItem>
                  <MenuItem value="Dakar Centre">Dakar Centre</MenuItem>
                  <MenuItem value="Dakar Plateau">Dakar Plateau</MenuItem>
                  <MenuItem value="Thiès">Thiès</MenuItem>
                  <MenuItem value="Kaolack">Kaolack</MenuItem>
                  <MenuItem value="Saint-Louis">Saint-Louis</MenuItem>
                  <MenuItem value="Ziguinchor">Ziguinchor</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                label="Date de début"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                label="Date de fin"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {['Numéro', 'Client', 'Montant', 'Statut / Étape', 'Progrès', "Chargé d'affaires", 'Actions'].map((col) => (
                  <TableCell key={col} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedApplications.map((application) => {
                const workflow = workflows.find(w => w.applicationId === application.id);
                const progress = workflow ? getProgressPercentage(workflow) : 0;
                const workflowStatus = workflow ? getWorkflowStatusDisplay(workflow) : { label: 'En attente', color: 'default' as const };

                return (
                  <TableRow
                    key={application.id}
                    sx={{
                      borderBottom: '1px solid #f1f5f9',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'rgba(31,78,121,0.03)', cursor: 'pointer' },
                    }}
                  >
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{workflow?.applicationNumber || application.applicationNumber || application.id}</TableCell>
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{application.clientName}</TableCell>
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: application.currency
                      }).format(application.amount)}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={workflowStatus.label}
                        color={workflowStatus.color}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{ flexGrow: 1, borderRadius: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {progress}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{application.accountManager}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            console.log('=== Voir Workflow Clicked ===');
                            console.log('Application:', application);
                            console.log('Workflow found:', workflow);
                            console.log('Total workflows:', workflows.length);
                            console.log('Workflows IDs:', workflows.map(w => w.applicationId));

                            if (workflow) {
                              console.log('Using direct workflow');
                              handleViewWorkflowDirect(workflow);
                            } else {
                              console.log('Using handleViewWorkflow');
                              handleViewWorkflow(application);
                            }
                          }}
                        >
                          Voir workflow
                        </Button>
                        {/* Bouton Analyser pour les rôles analyste quand le dossier leur est affecté */}
                        {isAnalystRole &&
                         (application.status === 'submitted' || application.status === 'under_review') &&
                         (() => {
                           const workflowSteps = (application as any).workflowSteps || [];
                           const myStep = workflowSteps.find(
                             (step: any) => step.assigneeId === userState.currentUser?.id &&
                               ['PENDING', 'IN_REVIEW'].includes(step.status)
                           );
                           return !!myStep;
                         })() && (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<StartIcon />}
                            onClick={() => navigate(`/credit-scoring?applicationId=${application.id}`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Analyser
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredApplications.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      </TabPanel>

      <TabPanel value={activeTab} index={isAnalystRole ? 3 : 2}>
        {/* Complete History Tab */}
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 780 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {['Numéro', 'Client', 'Montant', 'Statut final', 'Durée totale', 'Date création', 'Date finalisation', 'Actions'].map((col) => (
                  <TableCell key={col} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow
                  key={workflow.applicationId}
                  sx={{
                    borderBottom: '1px solid #f1f5f9',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: 'rgba(31,78,121,0.03)', cursor: 'pointer' },
                  }}
                >
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{workflow.applicationNumber}</TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{workflow.clientName}</TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: workflow.currency
                    }).format(workflow.requestedAmount)}
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={workflow.finalDecision === 'approved' ? 'Approuvé' :
                            workflow.finalDecision === 'rejected' ? 'Refusé' :
                            'En cours'}
                      color={workflow.finalDecision === 'approved' ? 'success' :
                            workflow.finalDecision === 'rejected' ? 'error' :
                            'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>
                    {workflow.totalDuration ?
                      `${Math.ceil(workflow.totalDuration / (1000 * 60 * 60 * 24))} jours` :
                      'En cours'}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>
                    {new Date(workflow.totalStartedAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>
                    {workflow.totalCompletedAt ?
                      new Date(workflow.totalCompletedAt).toLocaleDateString('fr-FR') :
                      'En cours'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setDialogOpen(true);
                      }}
                    >
                      Voir détails
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Enhanced Workflow Details Dialog */}
      <WorkflowDetailsDialog
        open={dialogOpen}
        workflow={selectedWorkflow}
        application={applications.find(app => app.id === selectedWorkflow?.applicationId)}
        onClose={handleCloseDialog}
        onApprovalSubmitted={loadData}
      />

      {workflows.length === 0 && applications.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Les données de workflow sont en cours d'initialisation. Veuillez actualiser la page dans quelques instants.
        </Alert>
      )}
    </Container>
  );
};