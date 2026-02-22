import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  Collapse,
  TextField,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Business as BranchIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  MonetizationOn as MoneyIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  Visibility as ViewIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { WorkflowTimestamps } from '../types';
import {
  loadWorkdayConfiguration
} from '../utils/workdayUtils';
import { FIXED_WORKFLOW_STEPS, getStepDisplayInfo } from '../utils/workflowConfig';
import { ApiService } from '../services/api';

// Props interface for the AnalyticsDashboardPage component
interface AnalyticsDashboardPageProps {}

export const AnalyticsDashboardPage: React.FC<AnalyticsDashboardPageProps> = () => {
  const { state: userState, isRole } = useUser();
  const { t } = useTranslation();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedManager, setSelectedManager] = useState('all');
  const [timeRange, setTimeRange] = useState('1month');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workflowTimestamps, setWorkflowTimestamps] = useState<WorkflowTimestamps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [availableManagers, setAvailableManagers] = useState<{name: string, branch: string, clients?: number, applications?: number, approved?: number, volume?: number, performance?: number}[]>([]);

  // Reset manager selection when branch changes
  React.useEffect(() => {
    setSelectedManager('all');
  }, [selectedBranch]);

  // Load filter options on component mount
  React.useEffect(() => {
    loadFilterOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load filter options from API
  const loadFilterOptions = async () => {
    try {
      // Load branches
      const branchesResponse = await ApiService.getBranchesPerformance();
      if (branchesResponse.success && branchesResponse.data) {
        const branches = branchesResponse.data.map((b: any) => b.branch);
        setAvailableBranches(branches);
      }

      // Load managers  
      const managersResponse = await ApiService.getManagersPerformance();
      if (managersResponse.success && managersResponse.data) {
        const managers = managersResponse.data.map((m: any) => ({
          name: m.name, 
          branch: m.branch,
          clients: m.clients,
          applications: m.applications,
          approved: m.approved,
          volume: m.volume,
          performance: m.performance
        }));
        setAvailableManagers(managers);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  // Filter workflows based on selected criteria
  // Note: Date filtering is already done on the backend when calling the API
  // This function only applies additional client-side filters for branch and manager
  const getFilteredWorkflows = () => {
    // Note: All filtering (date range, branch, manager) is already handled by the backend API
    // We just return the workflows as-is since they're already filtered
    return workflowTimestamps;
  };

  // Load workflow data from backend API with filters
  const loadWorkflowData = async () => {
    setIsLoading(true);
    setApiError(null);
    
    try {
      // Use new analytics dashboard endpoint with filters
      const filters = {
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
        manager: selectedManager !== 'all' ? selectedManager : undefined,
        timeRange: timeRange !== '' ? timeRange : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      const analyticsResponse = await ApiService.getAnalyticsDashboard(filters);

      if (analyticsResponse.success && analyticsResponse.data) {
        // Backend returns { workflows: [], summary: {} }, extract workflows array
        const workflows = analyticsResponse.data.workflows || analyticsResponse.data;
        setWorkflowTimestamps(workflows);
        console.log('📊 Analytics Dashboard loaded from new endpoint:', workflows.length, 'workflow records');
      } else {
        // Try fallback to old workflow endpoint
        console.log('📊 Trying fallback to workflows endpoint');
        const workflowResponse = await ApiService.getWorkflows();
        
        if (workflowResponse.success && workflowResponse.data && workflowResponse.data.length > 0) {
          setWorkflowTimestamps(workflowResponse.data);
          console.log('📊 Analytics Dashboard loaded from fallback API:', workflowResponse.data.length, 'workflow records');
        } else {
          console.warn('API returned no data');
          setWorkflowTimestamps([]);
          setApiError('Aucune donnée disponible depuis l\'API');
        }
      }
    } catch (error: any) {
      console.error('Error loading analytics data:', error);
      setApiError(`Connexion au backend: ${error.message}`);
      setWorkflowTimestamps([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    loadWorkflowData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload data when filters change - now triggers real API call with filters
  React.useEffect(() => {
    if (isTimeframeValid()) {
      console.log('Filters changed - reloading data from backend with new filters');
      loadWorkflowData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedManager, timeRange, startDate, endDate]);

  // Generate portfolio evolution data from workflows - grouped by month
  const generatePortfolioData = () => {
    const filteredWorkflows = getFilteredWorkflows();

    if (filteredWorkflows.length === 0) {
      return [];
    }

    // Group workflows by month
    const monthlyData: { [key: string]: any } = {};
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    filteredWorkflows.forEach(wf => {
      const date = new Date(wf.totalStartedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const monthLabel = monthNames[date.getMonth()];

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthLabel,
          year: date.getFullYear(),
          applications: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          volume: 0
        };
      }

      monthlyData[monthKey].applications++;
      monthlyData[monthKey].volume += wf.requestedAmount;

      const decision = wf.finalDecision || wf.status;
      if (decision === 'approved') {
        monthlyData[monthKey].approved++;
      } else if (decision === 'rejected') {
        monthlyData[monthKey].rejected++;
      } else {
        monthlyData[monthKey].pending++;
      }
    });

    // Convert to array and sort by date
    const result = Object.entries(monthlyData)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, data]) => data);

    return result;
  };

  // Generate branch performance data from workflows
  const generateBranchData = () => {
    const filteredWorkflows = getFilteredWorkflows();

    if (filteredWorkflows.length === 0) {
      return [];
    }

    // Group by branch
    const branchMap: { [branch: string]: any } = {};

    filteredWorkflows.forEach(wf => {
      const branch = wf.branch;
      if (!branchMap[branch]) {
        branchMap[branch] = {
          branch,
          manager: 'Non défini',
          applications: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          volume: 0,
          totalDuration: 0,
          completedCount: 0
        };
      }

      branchMap[branch].applications++;
      branchMap[branch].volume += wf.requestedAmount;

      const decision = wf.finalDecision || wf.status;
      if (decision === 'approved') {
        branchMap[branch].approved++;
      } else if (decision === 'rejected') {
        branchMap[branch].rejected++;
      } else {
        branchMap[branch].pending++;
      }

      if (wf.totalDuration && (decision === 'approved' || decision === 'rejected')) {
        branchMap[branch].totalDuration += wf.totalDuration;
        branchMap[branch].completedCount++;
      }
    });

    // Calculate performance (approval rate and processing speed)
    return Object.values(branchMap).map((branch: any) => {
      const approvalRate = branch.applications > 0
        ? (branch.approved / branch.applications) * 100
        : 0;

      const avgProcessingDays = branch.completedCount > 0
        ? (branch.totalDuration / branch.completedCount) / (1000 * 60 * 60 * 24)
        : 0;

      // Performance score: higher approval rate + faster processing = higher score
      const performance = Math.round((approvalRate * 0.7) + ((1 - Math.min(avgProcessingDays / 14, 1)) * 30));

      return {
        ...branch,
        performance: Math.max(0, Math.min(100, performance))
      };
    });
  };

  // Generate processing trend data from workflows - grouped by month
  const generateProcessingTrend = () => {
    const filteredWorkflows = getFilteredWorkflows();
    const completedWorkflows = filteredWorkflows.filter(wf => {
      const decision = wf.finalDecision || wf.status;
      return (decision === 'approved' || decision === 'rejected') && wf.totalDuration;
    });

    if (completedWorkflows.length === 0) {
      return [];
    }

    // Group by month
    const monthlyData: { [key: string]: any } = {};
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    completedWorkflows.forEach(wf => {
      const date = new Date(wf.totalStartedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const monthLabel = monthNames[date.getMonth()];

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthLabel,
          year: date.getFullYear(),
          totalTime: 0,
          count: 0,
          avgTime: 0
        };
      }

      monthlyData[monthKey].totalTime += wf.totalDuration!;
      monthlyData[monthKey].count++;
    });

    // Calculate averages and convert to array
    return Object.entries(monthlyData)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, data]) => ({
        month: data.month,
        avgTime: (data.totalTime / data.count) / 3600000, // Convert to hours
        applications: data.count
      }));
  };

  // Utility function to format duration using workday calculations
  const formatDuration = (milliseconds: number): string => {
    const config = loadWorkdayConfiguration();
    // Convert to hours
    const totalHours = milliseconds / 3600000;
    const dailyWorkingHours = parseInt(config.workingHours.end.split(':')[0]) - parseInt(config.workingHours.start.split(':')[0]);
    
    const workdays = Math.floor(totalHours / dailyWorkingHours);
    const remainingHours = totalHours % dailyWorkingHours;
    
    const parts: string[] = [];
    if (workdays > 0) {
      parts.push(`${workdays} jour${workdays > 1 ? 's' : ''}`);
    }
    if (remainingHours >= 1) {
      const hours = Math.floor(remainingHours);
      const minutes = Math.round((remainingHours - hours) * 60);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}min`);
    } else if (remainingHours > 0) {
      const minutes = Math.round(remainingHours * 60);
      if (minutes > 0) parts.push(`${minutes}min`);
    }
    
    return parts.length > 0 ? parts.join(' ') : '0min';
  };

  // Get performance color based on workday duration
  const getPerformanceColor = (milliseconds: number): 'success' | 'info' | 'warning' | 'error' => {
    const config = loadWorkdayConfiguration();
    const totalHours = milliseconds / 3600000;
    const dailyWorkingHours = parseInt(config.workingHours.end.split(':')[0]) - parseInt(config.workingHours.start.split(':')[0]);
    const workdays = totalHours / dailyWorkingHours;
    
    if (workdays <= config.standardWorkdays * 0.5) return 'success';
    if (workdays <= config.standardWorkdays * 0.8) return 'info';
    if (workdays <= config.standardWorkdays) return 'warning';
    return 'error';
  };

  // Calculate step-by-step performance metrics from workflow data  
  const calculateStepPerformanceMetrics = () => {
    const filteredWorkflows = getFilteredWorkflows();
    const completedWorkflows = filteredWorkflows.filter(wf => {
      const decision = wf.finalDecision || wf.status;
      return (decision === 'approved' || decision === 'rejected') && wf.totalDuration !== undefined;
    });
    
    if (completedWorkflows.length === 0) {
      return [];
    }

    // Group by branch
    const branchData: { [branch: string]: any } = {};

    completedWorkflows.forEach(workflow => {
      const branch = workflow.branch;
      if (!branchData[branch]) {
        branchData[branch] = {
          branch,
          workflows: [],
          stepTotals: {},
          stepCounts: {}
        };
      }

      branchData[branch].workflows.push(workflow);

      // Calculate step durations
      workflow.steps?.forEach(step => {
        if (step && step.duration) {
          const stepName = step.stepName || step.stepId || 'unknown_step';
          if (!branchData[branch].stepTotals[stepName]) {
            branchData[branch].stepTotals[stepName] = 0;
            branchData[branch].stepCounts[stepName] = 0;
          }
          branchData[branch].stepTotals[stepName] += step.duration;
          branchData[branch].stepCounts[stepName]++;
        }
      });
    });

    // Convert to performance metrics format
    return Object.values(branchData).map((branch: any) => {
      const avgStepTimes: { [stepName: string]: number } = {};
      
      Object.keys(branch.stepTotals).forEach(stepName => {
        avgStepTimes[stepName] = branch.stepTotals[stepName] / branch.stepCounts[stepName];
      });

      // Calculate average total duration in milliseconds, then convert to days
      const totalAvgTimeMs = branch.workflows.reduce((sum: number, wf: any) => sum + wf.totalDuration, 0) / branch.workflows.length;
      const totalAvgTimeDays = totalAvgTimeMs / (1000 * 60 * 60 * 24); // Convert ms to days

      return {
        branch: branch.branch,
        avgProcessingTime: totalAvgTimeDays,
        totalApplications: branch.workflows.length,
        completedApplications: branch.workflows.length,
        avgStepTimes
      };
    });
  };

  // Calculate real performance metrics from workflow data
  const calculateRealPerformanceMetrics = () => {
    const filteredWorkflows = getFilteredWorkflows();
    const completedWorkflows = filteredWorkflows.filter(wf => {
      const decision = wf.finalDecision || wf.status;
      return (decision === 'approved' || decision === 'rejected') && wf.totalDuration !== undefined;
    });

    if (completedWorkflows.length === 0) {
      return [];
    }

    // Group by branch
    const branchMetrics = completedWorkflows.reduce((acc, workflow) => {
      const branch = workflow.branch;
      if (!acc[branch]) {
        acc[branch] = {
          totalTime: 0,
          count: 0,
          workflows: []
        };
      }
      acc[branch].totalTime += workflow.totalDuration!;
      acc[branch].count++;
      acc[branch].workflows.push(workflow);
      return acc;
    }, {} as any);

    return Object.entries(branchMetrics).map(([branch, metrics]: [string, any]) => ({
      branch,
      avgProcessingTime: (metrics.totalTime / metrics.count) / 3600000, // Convert to hours
      totalApplications: metrics.count,
      completedApplications: metrics.count,
      avgStepTimes: calculateAvgStepTimes(metrics.workflows)
    }));
  };

  const calculateAvgStepTimes = (workflows: WorkflowTimestamps[]) => {
    const stepTimes: { [key: string]: number[] } = {};
    
    workflows.forEach(workflow => {
      if (workflow.steps && Array.isArray(workflow.steps)) {
        workflow.steps.forEach(step => {
          if (step && step.duration && typeof step.duration === 'number') {
            const stepName = step.stepName || step.stepId || 'unknown_step';
            if (!stepTimes[stepName]) {
              stepTimes[stepName] = [];
            }
            stepTimes[stepName].push(step.duration);
          }
        });
      }
    });

    const avgStepTimes: { [key: string]: number } = {};
    Object.entries(stepTimes).forEach(([stepName, durations]) => {
      const avgMs = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      avgStepTimes[stepName] = avgMs / 3600000; // Convert to hours
    });

    return avgStepTimes;
  };

  // Handle timeframe change
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    if (value === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      setStartDate('');
      setEndDate('');
    }
  };

  // Apply custom date range
  const applyCustomRange = () => {
    if (startDate && endDate) {
      setTimeRange('custom');
      setShowCustomRange(false);
    }
  };

  // Check if timeframe is valid (either preset or custom with both dates)
  const isTimeframeValid = () => {
    if (timeRange === 'custom') {
      return startDate && endDate;
    }
    return timeRange !== '';
  };

  // Validate date format (YYYY-MM-DD)
  const isValidDate = (dateString: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // Role-based access control
  const canViewAllBranches = isRole('management') || isRole('admin') || isRole('credit_committee');
  const canViewOwnBranch = isRole('branch_manager');
  const canViewOwnPerformance = isRole('account_manager') || isRole('credit_analyst');

  // Filter data based on user role and selections
  const getVisibleBranches = () => {
    let branches = generateBranchData();

    // Apply role-based filtering
    if (canViewOwnBranch && !canViewAllBranches && userState.currentUser?.department) {
      branches = branches.filter(branch => branch.branch === userState.currentUser?.department);
    }

    // Apply branch filter if a specific branch is selected
    if (selectedBranch !== 'all') {
      branches = branches.filter(branch => branch.branch === selectedBranch);
    }

    return branches;
  };


  const getVisibleManagers = () => {
    let managers = [...availableManagers];
    
    // Apply manager filter if a specific manager is selected
    if (selectedManager !== 'all') {
      managers = managers.filter(manager => manager.name === selectedManager);
    }
    
    return managers;
  };

  const visibleBranches = getVisibleBranches();
  const visibleManagers = getVisibleManagers();

  // Generate risk distribution from actual workflow data
  const getFilteredRiskDistribution = () => {
    const filteredWorkflows = getFilteredWorkflows();

    if (filteredWorkflows.length === 0) {
      return [];
    }
    
    // Calculate approval rate and processing efficiency
    const completedWorkflows = filteredWorkflows.filter(wf => 
      wf.status === 'approved' || wf.status === 'rejected'
    );
    
    const approvalRate = completedWorkflows.length > 0 ? 
      (completedWorkflows.filter(wf => (wf.finalDecision || wf.status) === 'approved').length / completedWorkflows.length) * 100 : 0;
    
    // Calculate average processing time for completed workflows
    const avgProcessingTime = completedWorkflows.length > 0 ?
      completedWorkflows
        .filter(wf => wf.totalDuration)
        .reduce((sum, wf) => sum + (wf.totalDuration! / (1000 * 60 * 60 * 24)), 0) / completedWorkflows.length
      : 0;
    
    // Risk assessment based on performance metrics
    let riskProfile;
    if (approvalRate > 80 && avgProcessingTime < 7) {
      // High approval rate + fast processing = lower risk
      riskProfile = [
        { name: 'Faible Risque', value: 60, color: '#4caf50' },
        { name: 'Risque Modéré', value: 30, color: '#ff9800' },
        { name: 'Risque Élevé', value: 10, color: '#f44336' },
      ];
    } else if (approvalRate < 60 || avgProcessingTime > 14) {
      // Low approval rate or slow processing = higher risk
      riskProfile = [
        { name: 'Faible Risque', value: 30, color: '#4caf50' },
        { name: 'Risque Modéré', value: 35, color: '#ff9800' },
        { name: 'Risque Élevé', value: 35, color: '#f44336' },
      ];
    } else {
      // Moderate performance = moderate risk
      riskProfile = [
        { name: 'Faible Risque', value: 45, color: '#4caf50' },
        { name: 'Risque Modéré', value: 35, color: '#ff9800' },
        { name: 'Risque Élevé', value: 20, color: '#f44336' },
      ];
    }
    
    return riskProfile;
  };

  const portfolioData = generatePortfolioData();
  const processingTrendData = generateProcessingTrend();
  const filteredRiskDistribution = getFilteredRiskDistribution();

  // Calculate summary statistics from actual workflow data
  const filteredWorkflows = getFilteredWorkflows();
  
  
  
  const completedWorkflows = filteredWorkflows.filter(wf => {
    const decision = wf.finalDecision || wf.status;
    return decision === 'approved' || decision === 'rejected';
  });
  
  const totalApplications = filteredWorkflows.length;
  
  // Use finalDecision as the primary source of truth, fallback to status
  const getWorkflowDecision = (wf: any) => {
    return wf.finalDecision || wf.status || 'pending';
  };
  
  const totalApproved = filteredWorkflows.filter(wf => 
    getWorkflowDecision(wf) === 'approved'
  ).length;
  const totalRejected = filteredWorkflows.filter(wf => 
    getWorkflowDecision(wf) === 'rejected'
  ).length;
  const totalPending = filteredWorkflows.filter(wf => 
    getWorkflowDecision(wf) === 'pending'
  ).length;
  const totalVolume = filteredWorkflows.reduce((sum, wf) => sum + wf.requestedAmount, 0);
  
  // Calculate average processing time in working days for performance metric
  const avgProcessingDays = completedWorkflows.length > 0 ?
    completedWorkflows
      .filter(wf => wf.totalDuration)
      .reduce((sum, wf) => {
        // Convert milliseconds to working minutes, then to working days
        const workingMinutes = wf.totalDuration! / (1000 * 60);
        const workingDays = workingMinutes / (9 * 60); // 9 hours per working day
        return sum + workingDays;
      }, 0) / completedWorkflows.length
    : 0;
  const avgPerformance = avgProcessingDays > 0 ? Math.max(0, Math.min(100, 100 - (avgProcessingDays * 5))) : 0;
  
  const approvalRate = totalApplications > 0 ? (totalApproved / totalApplications) * 100 : 0;

  if (!userState.isAuthenticated || !userState.currentUser) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Accès non autorisé
        </Typography>
      </Box>
    );
  }
  

  // Access control check
  if (!canViewAllBranches && !canViewOwnBranch && !canViewOwnPerformance) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Vous n'avez pas les autorisations pour consulter ces statistiques.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header - Fixed */}
      <Box sx={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        p: 3,
        mb: 0
      }}>
        {/* Data status indicator */}
        {isLoading ? (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2">
              🔄 Chargement des données depuis le serveur...
            </Typography>
          </Box>
        ) : apiError ? (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              ❌ {apiError}
            </Typography>
          </Box>
        ) : workflowTimestamps.length === 0 ? (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2">
              ⚠️ Aucune donnée de workflow disponible. Sélectionnez une période pour charger les données.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="success.main">
              ✅ {workflowTimestamps.length} workflows chargés depuis le serveur
            </Typography>
          </Box>
        )}
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('dashboard.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {canViewAllBranches && 'Vue d\'ensemble de la performance bancaire'}
          {canViewOwnBranch && `Performance de l'Agence ${userState.currentUser?.department}`}
          {canViewOwnPerformance && 'Votre performance individuelle'}
        </Typography>
        

        {/* Filters - Sticky with header */}
        <Card sx={{ mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {t('dashboard.filters')}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Sélectionner la période</InputLabel>
                <Select
                  value={timeRange}
                  label="Sélectionner la période"
                  onChange={(e) => handleTimeRangeChange(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="1month">Dernier mois</MenuItem>
                  <MenuItem value="3months">3 derniers mois</MenuItem>
                  <MenuItem value="6months">6 derniers mois</MenuItem>
                  <MenuItem value="1year">Dernière année</MenuItem>
                  <MenuItem value="custom">Période personnalisée</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {(canViewAllBranches || canViewOwnBranch) && canViewAllBranches && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agence</InputLabel>
                  <Select
                    value={selectedBranch}
                    label="Agence"
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <MenuItem value="all">Toutes les Agences</MenuItem>
                    {/* Get branches from dedicated API */}
                    {availableBranches
                      .filter(branch => canViewAllBranches || 
                        (canViewOwnBranch && branch === userState.currentUser?.department)
                      )
                      .map((branch) => (
                      <MenuItem key={branch} value={branch}>
                        {branch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {(canViewAllBranches || canViewOwnBranch) && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Chargé d'Affaires</InputLabel>
                  <Select
                    value={selectedManager}
                    label="Chargé d'Affaires"
                    onChange={(e) => setSelectedManager(e.target.value)}
                  >
                    <MenuItem value="all">Tous les chargés</MenuItem>
                    {availableManagers
                      .filter(manager => canViewAllBranches || 
                        (canViewOwnBranch && manager.branch === userState.currentUser?.department) ||
                        (canViewOwnPerformance && manager.name === userState.currentUser?.name)
                      )
                      .map((manager) => (
                      <MenuItem key={manager.name} value={manager.name}>
                        {manager.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>

          {/* Custom Date Range Section */}
          <Collapse in={showCustomRange}>
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('dashboard.timeframe.startDate')}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    size="small"
                    fullWidth
                    required
                    error={startDate !== '' && !isValidDate(startDate)}
                    helperText={startDate !== '' && !isValidDate(startDate) ? 'Invalid date format' : ''}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('dashboard.timeframe.endDate')}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    size="small"
                    fullWidth
                    required
                    error={endDate !== '' && (!isValidDate(endDate) || (startDate !== '' && endDate < startDate))}
                    helperText={endDate !== '' && !isValidDate(endDate) ? 'Invalid date format' : 
                               endDate !== '' && startDate !== '' && endDate < startDate ? 'End date must be after start date' : ''}
                    inputProps={{
                      min: startDate || undefined,
                    }}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    onClick={applyCustomRange}
                    disabled={!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate) || (startDate !== '' && endDate !== '' && endDate < startDate)}
                    fullWidth
                    size="medium"
                  >
                    {t('dashboard.timeframe.applyRange')}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{ p: 3, pt: 0 }}>
      {/* Show message when no timeframe is selected */}
      {!timeRange && (
        <Card sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2, width: 56, height: 56 }}>
              <AssessmentIcon />
            </Avatar>
            <Typography variant="h6" gutterBottom color="primary">
              {t('dashboard.noTimeframeSelected.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
              {t('dashboard.noTimeframeSelected.description')}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Dashboard content - only show when timeframe is selected */}
      {isTimeframeValid() && (
        <>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      <AssessmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight={600}>
                        {totalApplications.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Demandes totales
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Sur la période sélectionnée
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                      <ApprovedIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight={600}>
                        {approvalRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Taux d'approbation
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={approvalRate}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                      <MoneyIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight={600}>
                        {(totalVolume / 1000000).toFixed(1)}M
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Volume XOF
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Montant total des demandes
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight={600}>
                        {avgPerformance.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Performance moyenne
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={avgPerformance} 
                    sx={{ height: 8, borderRadius: 4 }}
                    color="warning"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Portfolio Evolution */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Évolution du Portefeuille
                  </Typography>
                  {portfolioData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={portfolioData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="applications"
                          stroke="#1976d2"
                          strokeWidth={2}
                          name="Demandes"
                        />
                        <Line
                          type="monotone"
                          dataKey="approved"
                          stroke="#4caf50"
                          strokeWidth={2}
                          name="Approuvées"
                        />
                        <Line
                          type="monotone"
                          dataKey="rejected"
                          stroke="#f44336"
                          strokeWidth={2}
                          name="Rejetées"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Aucune donnée disponible pour la période sélectionnée
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Risk Distribution */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Distribution des Risques
                  </Typography>
                  {filteredRiskDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={filteredRiskDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          label={false}
                        >
                          {filteredRiskDistribution.map((entry: { name: string; value: number; color: string }, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value, entry: any) => `${value} (${entry.payload.value}%)`}
                          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Aucune donnée disponible pour la période sélectionnée
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Performance Tables */}
          <Grid container spacing={3}>
            {/* Branch Performance - Only for management and branch managers */}
            {(canViewAllBranches || canViewOwnBranch) && (
              <Grid item xs={12} md={visibleManagers.length > 0 ? 8 : 12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                      <BranchIcon sx={{ mr: 1 }} />
                      Performance par Agence
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Agence</TableCell>
                            <TableCell>Directeur</TableCell>
                            <TableCell align="right">Demandes</TableCell>
                            <TableCell align="right">Approuvées</TableCell>
                            <TableCell align="right">Volume (M XOF)</TableCell>
                            <TableCell align="right">Performance</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleBranches.map((branch) => (
                            <TableRow key={branch.branch}>
                              <TableCell>
                                <Chip 
                                  label={branch.branch} 
                                  variant="outlined" 
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{branch.manager}</TableCell>
                              <TableCell align="right">{branch.applications}</TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  {branch.approved}
                                  <Chip 
                                    label={`${((branch.approved / branch.applications) * 100).toFixed(0)}%`}
                                    size="small" 
                                    color="success"
                                    sx={{ ml: 1 }}
                                  />
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {(branch.volume / 1000000).toFixed(1)}M
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={branch.performance}
                                    sx={{ width: 60, mr: 1, height: 6, borderRadius: 3 }}
                                  />
                                  {branch.performance}%
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Voir détails">
                                  <IconButton size="small">
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Account Manager Performance */}
            {visibleManagers.length > 0 && (
              <Grid item xs={12} md={canViewAllBranches || canViewOwnBranch ? 4 : 12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1 }} />
                      Performance Chargés d'Affaires
                    </Typography>
                    <List>
                      {visibleManagers.map((manager, index) => (
                        <React.Fragment key={manager.name}>
                          <ListItem>
                            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                              {manager.name.split(' ').map((n: string) => n[0]).join('')}
                            </Avatar>
                            <ListItemText
                              primary={manager.name}
                              secondary={
                                <Box>
                                  <Typography variant="caption" display="block">
                                    {manager.branch} • {manager.clients || 0} clients
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={manager.performance || 0}
                                      sx={{ flexGrow: 1, mr: 1, height: 4, borderRadius: 2 }}
                                    />
                                    <Typography variant="caption">
                                      {manager.performance || 0}%
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {manager.approved || 0}/{manager.applications || 0} approuvées • {((manager.volume || 0) / 1000000).toFixed(1)}M XOF
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                          {index < visibleManagers.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Performance Tracking Section */}
          <Box sx={{ mt: 6 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <TimeIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Performance des Processus Crédit
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              {/* Performance Overview Cards */}
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
                      <TimeIcon sx={{ fontSize: 28 }} />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {(() => {
                        const filteredWorkflows = getFilteredWorkflows();
                        const completedFiltered = filteredWorkflows.filter(wf => {
                          const decision = wf.finalDecision || wf.status;
                          return (decision === 'approved' || decision === 'rejected') && wf.totalDuration;
                        });
                        return completedFiltered.length > 0 
                          ? formatDuration(
                              completedFiltered.reduce((sum, wf) => sum + wf.totalDuration!, 0) / completedFiltered.length
                            )
                          : '6h 15min';
                      })()}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      Temps Moyen Global
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'success.main' }}>
                      <AssessmentIcon sx={{ fontSize: 28 }} />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {getFilteredWorkflows().filter(wf => {
                        const decision = wf.finalDecision || wf.status;
                        return decision === 'approved' || decision === 'rejected';
                      }).length}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      Demandes Traitées
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'info.main' }}>
                      <PendingIcon sx={{ fontSize: 28 }} />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {getFilteredWorkflows().filter(wf => wf.status === 'in_progress').length}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      En Cours
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Performance by Branch */}
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Performance par Agence
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={calculateRealPerformanceMetrics()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branch" />
                        <YAxis label={{ value: 'Heures', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip 
                          formatter={(value: number) => [`${value.toFixed(1)}h`, 'Temps Moyen']}
                        />
                        <Bar dataKey="avgProcessingTime" fill="#1976d2" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Processing Trend */}
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Évolution des Délais
                    </Typography>
                    {processingTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={processingTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <RechartsTooltip
                            formatter={(value: number) => [`${value.toFixed(1)}h`, 'Temps Moyen']}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgTime"
                            stroke="#1976d2"
                            strokeWidth={3}
                            dot={{ fill: '#1976d2', strokeWidth: 2, r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Aucune donnée de traitement disponible
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Overall Approval Workflow Performance */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Performance Globale du Processus d'Approbation
                    </Typography>
                    
                    {(() => {
                      const filteredWorkflows = getFilteredWorkflows();
                      const completedWorkflows = filteredWorkflows.filter(wf => {
                        const decision = wf.finalDecision || wf.status;
                        return (decision === 'approved' || decision === 'rejected') && wf.totalDuration;
                      });
                      
                      if (completedWorkflows.length === 0) {
                        return (
                          <Typography color="text.secondary">
                            Aucune donnée de workflow disponible. Les métriques seront affichées après le traitement des premières demandes.
                          </Typography>
                        );
                      }

                      // Calculate average duration for each step across all workflows
                      const stepAverages: { [stepName: string]: { total: number, count: number, avg: number } } = {};
                      
                      completedWorkflows.forEach(workflow => {
                        if (workflow.steps && Array.isArray(workflow.steps)) {
                          workflow.steps.forEach(step => {
                            if (step && step.duration && typeof step.duration === 'number') {
                              // Convert step ID to display name using getStepDisplayInfo
                              const stepId = (step.stepId || step.stepName) as any;
                              const stepInfo = getStepDisplayInfo(stepId);
                              const stepName = stepInfo?.stepName || step.stepName || stepId || 'unknown_step';

                              if (!stepAverages[stepName]) {
                                stepAverages[stepName] = { total: 0, count: 0, avg: 0 };
                              }
                              stepAverages[stepName].total += step.duration;
                              stepAverages[stepName].count++;
                            }
                          });
                        }
                      });

                      // Calculate averages
                      Object.keys(stepAverages).forEach(stepName => {
                        stepAverages[stepName].avg = stepAverages[stepName].total / stepAverages[stepName].count;
                      });

                      // Define colors for each step
                      const stepColors: { [key: string]: string } = {
                        'Demande Soumise': '#4caf50',
                        'Vérification Documents': '#2196f3', 
                        'Analyse Crédit': '#ff9800',
                        'Évaluation Risques': '#f44336',
                        'Examen Directeur Agence': '#9c27b0',
                        'Examen Comité Crédit': '#673ab7',
                        'Décision Finale': '#3f51b5',
                        'Préparation Contrat': '#009688',
                        'Déblocage Fonds': '#4caf50'
                      };

                      // Prepare data for stacked bar chart - one entry per step for overall view
                      const chartData = Object.keys(stepAverages).map(stepName => ({
                        stepName,
                        avgDuration: stepAverages[stepName].avg / 3600000, // Keep milliseconds to hours for compatibility
                        avgWorkdays: Math.round((stepAverages[stepName].avg / (9 * 3600000)) * 10) / 10, // Convert working time milliseconds to working days (9h per day)
                        count: stepAverages[stepName].count,
                        color: stepColors[stepName] || '#1976d2'
                      })).sort((a, b) => {
                        // Sort by typical workflow order
                        const order = [
                          'Demande Soumise',
                          'Vérification Documents', 
                          'Analyse Crédit',
                          'Évaluation Risques',
                          'Examen Directeur Agence',
                          'Examen Comité Crédit',
                          'Décision Finale',
                          'Préparation Contrat',
                          'Déblocage'
                        ];
                        return order.indexOf(a.stepName || '') - order.indexOf(b.stepName || '');
                      });

                      return (
                        <Box>
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6} md={3}>
                              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                                  {completedWorkflows.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Workflows Terminés
                                </Typography>
                              </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold' }}>
                                  {completedWorkflows.filter(wf => wf.finalDecision === 'approved').length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Approuvées
                                </Typography>
                              </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h4" color="error.main" sx={{ fontWeight: 'bold' }}>
                                  {completedWorkflows.filter(wf => wf.finalDecision === 'rejected').length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Refusées
                                </Typography>
                              </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h4" color="warning.main" sx={{ fontWeight: 'bold' }}>
                                  {filteredWorkflows.filter(wf => wf.status === 'in_progress').length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  En Cours
                                </Typography>
                              </Card>
                            </Grid>
                          </Grid>

                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            Durée Moyenne par Étape d'Approbation
                          </Typography>
                          
                          <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="stepName" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                fontSize={12}
                              />
                              <YAxis 
                                label={{ value: 'Durée (jours)', angle: -90, position: 'insideLeft' }}
                              />
                              <RechartsTooltip 
                                formatter={(value: number, name: string, props: any) => [
                                  `${formatDuration(value * 9 * 3600000)}`, // 9 working hours per day
                                  'Durée moyenne'
                                ]}
                                labelFormatter={(label) => `Étape: ${label}`}
                                contentStyle={{ 
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px'
                                }}
                              />
                              <Legend
                                content={() => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', mt: 2, gap: 1 }}>
                                    {chartData.map((entry, index) => (
                                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box 
                                          sx={{ 
                                            width: 12, 
                                            height: 12, 
                                            backgroundColor: entry.color,
                                            borderRadius: '2px'
                                          }} 
                                        />
                                        <Typography variant="caption" sx={{ fontSize: '10px' }}>
                                          {entry.stepName}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                              />
                              <Bar 
                                dataKey="avgWorkdays" 
                                radius={[4, 4, 0, 0]}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          {/* Bottleneck Identification */}
                          <Box sx={{ mt: 4 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                              Identification des Goulets d'Étranglement
                            </Typography>
                            <Grid container spacing={2}>
                              {chartData
                                .filter(step => step.stepName && step.avgWorkdays > (FIXED_WORKFLOW_STEPS[step.stepName as keyof typeof FIXED_WORKFLOW_STEPS]?.expectedDuration || 1))
                                .sort((a, b) => b.avgWorkdays - a.avgWorkdays)
                                .slice(0, 3)
                                .map((step, index) => {
                                  const expectedDuration = step.stepName ? (FIXED_WORKFLOW_STEPS[step.stepName as keyof typeof FIXED_WORKFLOW_STEPS]?.expectedDuration || 1) : 1;
                                  const overrun = step.avgWorkdays - expectedDuration;
                                  const overrunPercent = Math.round((overrun / expectedDuration) * 100);
                                  
                                  return (
                                    <Grid item xs={12} md={4} key={step.stepName}>
                                      <Card 
                                        variant="outlined" 
                                        sx={{ 
                                          p: 2, 
                                          borderColor: index === 0 ? 'error.main' : index === 1 ? 'warning.main' : 'info.main',
                                          borderWidth: 2
                                        }}
                                      >
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                          {step.stepName}
                                        </Typography>
                                        <Typography variant="h5" color="error" sx={{ fontWeight: 'bold', mb: 1 }}>
                                          +{overrunPercent}%
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {formatDuration(step.avgWorkdays * 9 * 3600000)} (attendu: {expectedDuration}j)
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {step.count} demandes analysées
                                        </Typography>
                                      </Card>
                                    </Grid>
                                  );
                                })}
                              {chartData.filter(step => step.stepName && step.avgWorkdays > (FIXED_WORKFLOW_STEPS[step.stepName as keyof typeof FIXED_WORKFLOW_STEPS]?.expectedDuration || 1)).length === 0 && (
                                <Grid item xs={12}>
                                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.dark' }}>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                      ✅ Aucun goulet d'étranglement détecté
                                    </Typography>
                                    <Typography variant="body2">
                                      Toutes les étapes respectent les délais attendus
                                    </Typography>
                                  </Card>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        </Box>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>

              {/* Detailed Step Analysis */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Performance des Étapes d'Approbation par Agence
                    </Typography>
                    
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Agence</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Vérification Docs</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Analyse Crédit</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Évaluation Risques</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Examen Directeur</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Comité Crédit</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              <Tooltip title="Durée totale moyenne du dossier depuis sa création jusqu'à la décision finale. Chaque étape montre le temps réellement écoulé depuis la fin de l'étape précédente (temps passé dans chaque service)." arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>Total Moyen ⓘ</span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {calculateStepPerformanceMetrics().map((branch) => (
                            <TableRow key={branch.branch}>
                              <TableCell sx={{ fontWeight: 500 }}>{branch.branch}</TableCell>
                              <TableCell>
                                {branch.avgStepTimes['Vérification Documents'] && branch.avgStepTimes['Vérification Documents'] > 0 ? 
                                  formatDuration(branch.avgStepTimes['Vérification Documents']) : '< 1min'}
                              </TableCell>
                              <TableCell>
                                {branch.avgStepTimes['Analyse Crédit'] && branch.avgStepTimes['Analyse Crédit'] > 0 ? 
                                  formatDuration(branch.avgStepTimes['Analyse Crédit']) : '< 1min'}
                              </TableCell>
                              <TableCell>
                                {branch.avgStepTimes['Évaluation Risques'] && branch.avgStepTimes['Évaluation Risques'] > 0 ? 
                                  formatDuration(branch.avgStepTimes['Évaluation Risques']) : '< 1min'}
                              </TableCell>
                              <TableCell>
                                {branch.avgStepTimes['Examen Directeur Agence'] && branch.avgStepTimes['Examen Directeur Agence'] > 0 ? 
                                  formatDuration(branch.avgStepTimes['Examen Directeur Agence']) : '< 1min'}
                              </TableCell>
                              <TableCell>
                                {branch.avgStepTimes['Examen Comité Crédit'] && branch.avgStepTimes['Examen Comité Crédit'] > 0 ? 
                                  formatDuration(branch.avgStepTimes['Examen Comité Crédit']) : '< 1min'}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={formatDuration(branch.avgProcessingTime)}
                                  color={getPerformanceColor(branch.avgProcessingTime)}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </>
      )}
      </Box>
    </Box>
  );
};