import React, { useState, useEffect } from 'react';
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
  TablePagination
} from '@mui/material';
import { Assessment as AnalysisIcon } from '@mui/icons-material';
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

// Local type definitions
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'branch_manager_review'
  | 'credit_committee_review'
  | 'approved'
  | 'denied'
  | 'on_hold';

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

export const WorkflowPage: React.FC<WorkflowPageProps> = ({ onNavigate }) => {
  const { state: userState, isRole } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [workflows, setWorkflows] = useState<WorkflowTimestamps[]>([]);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
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

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when filters change
  useEffect(() => {
    loadData();
  }, [filterStatus, filterBranch, filterDateFrom, filterDateTo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Only filter by userId for roles that don't have view_all permissions
      // ADMIN and MANAGEMENT can see all applications
      // CREDIT_ANALYST sees only applications in their workflow stage
      let shouldFilterByUser = false;
      let filterUserId: string | undefined = undefined;
      let statusFilter = filterStatus !== 'all' ? filterStatus : undefined;

      if (userState.currentUser) {
        const userRole = userState.currentUser.role;

        // For ACCOUNT_MANAGER, filter by userId (they only see applications they created)
        // For other roles (BRANCH_MANAGER, CREDIT_COMMITTEE, MANAGEMENT, CREDIT_ANALYST),
        // the backend filters by userRole to show applications they need to review
        if (userRole === 'account_manager') {
          shouldFilterByUser = true;
          filterUserId = userState.currentUser.id;
        }
      }

      // Build filters
      // For workflow page, we want to see ALL workflows, not just ones assigned to the user's role
      // So we pass 'all' as userRole to bypass role-based filtering
      const filters = {
        status: statusFilter,
        branch: filterBranch !== 'all' ? filterBranch : undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        userId: filterUserId,
        userRole: 'all' // Show all workflows on the workflow page
      };

      console.log('=== Loading Data ===');
      console.log('Current user:', userState.currentUser);
      console.log('Filters:', filters);

      // Load data from API
      const [workflowsResponse, applicationsResponse] = await Promise.all([
        ApiService.getWorkflows(filters),
        ApiService.getApplications(filters)
      ]);

      console.log('Workflows response:', workflowsResponse);
      console.log('Applications response:', applicationsResponse);

      if (workflowsResponse.success) {
        setWorkflows(workflowsResponse.data || []);
      } else {
        console.error('Failed to load workflows:', workflowsResponse.error);
        setError('Impossible de charger les workflows depuis l\'API');
        setWorkflows([]);
      }

      if (applicationsResponse.success) {
        let apps = applicationsResponse.data || [];

        // Filter applications for credit analysts to only show their relevant statuses and assigned to them
        if (userState.currentUser?.role === 'credit_analyst' && !statusFilter) {
          apps = apps.filter((app: CreditApplication) => {
            const isRelevantStatus = app.status === 'submitted' || app.status === 'under_review';
            const isAssignedToMe = !(app as any).assignedAnalystId || (app as any).assignedAnalystId === userState.currentUser?.id;
            return isRelevantStatus && isAssignedToMe;
          });
        }

        setApplications(apps);
      } else {
        console.error('Failed to load applications:', applicationsResponse.error);
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
      case 'denied': return 'error';
      case 'under_review': return 'info';
      case 'branch_manager_review': return 'warning';
      case 'credit_committee_review': return 'warning';
      case 'submitted': return 'primary';
      case 'draft': return 'default';
      case 'on_hold': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: ApplicationStatus): string => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'submitted': return 'Soumise';
      case 'under_review': return 'En analyse';
      case 'branch_manager_review': return 'Directeur d\'agence';
      case 'credit_committee_review': return 'Comité de crédit';
      case 'approved': return 'Approuvée';
      case 'denied': return 'Refusée';
      case 'on_hold': return 'En attente';
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
    if (workflow.finalDecision === 'approved') {
      return { label: 'Approuvé', color: 'success' };
    }
    if (workflow.finalDecision === 'rejected') {
      return { label: 'Refusé', color: 'error' };
    }

    const currentStep = getCurrentStep(workflow);
    if (currentStep) {
      const stepName = FIXED_WORKFLOW_STEPS[currentStep.stepId]?.stepName || currentStep.stepName;
      return { label: stepName, color: 'info' };
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
    page + 1 * rowsPerPage
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

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 4 }}>
        <Tab label="Vue d'ensemble" />
        <Tab label="Workflows en cours" />
        <Tab label="Historique complet" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
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

      <TabPanel value={activeTab} index={1}>
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
                  <MenuItem value="pending">En attente</MenuItem>
                  <MenuItem value="approved">Approuvé</MenuItem>
                  <MenuItem value="rejected">Refusé</MenuItem>
                  <MenuItem value="submitted">Soumis</MenuItem>
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

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Numéro</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Montant</TableCell>
                <TableCell>Statut / Étape</TableCell>
                <TableCell>Progrès</TableCell>
                <TableCell>Chargé d'affaires</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedApplications.map((application) => {
                const workflow = workflows.find(w => w.applicationId === application.id);
                const progress = workflow ? getProgressPercentage(workflow) : 0;
                const workflowStatus = workflow ? getWorkflowStatusDisplay(workflow) : { label: 'En attente', color: 'default' as const };

                return (
                  <TableRow key={application.id}>
                    <TableCell>{workflow?.applicationNumber || application.applicationNumber || application.id}</TableCell>
                    <TableCell>{application.clientName}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: application.currency
                      }).format(application.amount)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={workflowStatus.label}
                        color={workflowStatus.color}
                        size="small"
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
                    <TableCell>{application.accountManager}</TableCell>
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
                        {/* Show Analyser button for credit analysts when analysis is not completed */}
                        {userState.currentUser?.role === 'credit_analyst' &&
                         (application.status === 'submitted' || application.status === 'under_review') &&
                         (() => {
                           const workflowSteps = (application as any).workflowSteps || [];

                           // Find credit_analysis step
                           const creditAnalysisStep = workflowSteps.find(
                             (step: any) => step.stepName === 'credit_analysis'
                           );

                           // Only show button if analysis step doesn't exist or is not completed
                           return !creditAnalysisStep || creditAnalysisStep.status !== 'COMPLETED';
                         })() && (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<AnalysisIcon />}
                            onClick={() => navigate(`/credit-scoring?applicationId=${application.id}`)}
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

      <TabPanel value={activeTab} index={2}>
        {/* Complete History Tab */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Numéro</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Montant</TableCell>
                <TableCell>Statut final</TableCell>
                <TableCell>Durée totale</TableCell>
                <TableCell>Date création</TableCell>
                <TableCell>Date finalisation</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.applicationId}>
                  <TableCell>{workflow.applicationNumber}</TableCell>
                  <TableCell>{workflow.clientName}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: workflow.currency
                    }).format(workflow.requestedAmount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={workflow.finalDecision === 'approved' ? 'Approuvé' : 
                            workflow.finalDecision === 'rejected' ? 'Refusé' : 
                            'En cours'}
                      color={workflow.finalDecision === 'approved' ? 'success' : 
                            workflow.finalDecision === 'rejected' ? 'error' : 
                            'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {workflow.totalDuration ? 
                      `${Math.ceil(workflow.totalDuration / (1000 * 60 * 60 * 24))} jours` : 
                      'En cours'}
                  </TableCell>
                  <TableCell>
                    {new Date(workflow.totalStartedAt).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
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