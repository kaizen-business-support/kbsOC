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
  CircularProgress,
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
  Refresh as RefreshIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { WorkflowTimestamps } from '../types';
import {
  loadWorkdayConfiguration
} from '../utils/workdayUtils';
import { FIXED_WORKFLOW_STEPS, getStepDisplayInfo } from '../utils/workflowConfig';
import { ApiService, creditPolicyApi } from '../services/api';

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const REFRESH_INTERVAL = 60;
  const CACHE_KEY = 'analytics_dashboard_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Credit policy analytics
  const [policyAnalytics, setPolicyAnalytics] = useState<any>(null);
  const [policyAnalyticsLoading, setPolicyAnalyticsLoading] = useState(false);

  // Reset manager selection when branch changes + reload managers for that branch
  React.useEffect(() => {
    setSelectedManager('all');
    loadFilterOptions(selectedBranch !== 'all' ? selectedBranch : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  // Load filter options on component mount
  React.useEffect(() => {
    loadFilterOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load credit policy analytics on mount
  React.useEffect(() => {
    setPolicyAnalyticsLoading(true);
    creditPolicyApi.getAnalytics().then(res => {
      if (res.success) setPolicyAnalytics(res.data);
      setPolicyAnalyticsLoading(false);
    });
  }, []);

  // Load filter options from API
  const loadFilterOptions = async (branchFilter?: string) => {
    try {
      // Load branches (toujours toutes)
      const branchesResponse = await ApiService.getBranchesPerformance();
      if (branchesResponse.success && branchesResponse.data) {
        const seen = new Set<string>();
        const branches = branchesResponse.data
          .map((b: any) => b.branch as string)
          .filter((br: string) => br && !seen.has(br) && seen.add(br));
        setAvailableBranches(branches);
      }

      // Load managers filtrés par agence si sélectionnée
      const managersResponse = await ApiService.getManagersPerformance(branchFilter);
      if (managersResponse.success && managersResponse.data) {
        const managers = managersResponse.data
          .filter((m: any) => !branchFilter || m.branch === branchFilter)
          .map((m: any) => ({
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
  // Appel API direct — toujours frais, pas de cache sur les filtres
  const loadWorkflowData = React.useCallback(async (
    tr: string,
    br: string,
    mgr: string,
    sd: string,
    ed: string
  ) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const apiFilters = {
        branch:    br  !== 'all' ? br  : undefined,
        manager:   mgr !== 'all' ? mgr : undefined,
        timeRange: tr  !== ''    ? tr  : undefined,
        startDate: sd  || undefined,
        endDate:   ed  || undefined,
      };

      const resp = await ApiService.getAnalyticsDashboard(apiFilters);

      // Accepte { data: [...] } (tableau déjà extrait) ou { data: { workflows: [...] } }
      let workflows: any[] = [];
      if (resp.success) {
        if (Array.isArray(resp.data)) {
          workflows = resp.data;
        } else if (resp.data?.workflows && Array.isArray(resp.data.workflows)) {
          workflows = resp.data.workflows;
        }
      }

      setWorkflowTimestamps(workflows);
      setLastUpdated(new Date());

      // Cache léger uniquement pour le rechargement rapide (même filtres)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: workflows, ts: Date.now(),
          filters: { tr, br, mgr, sd, ed }
        }));
      } catch (_) {}
    } catch (error: any) {
      console.error('Analytics load error:', error);
      setApiError(`Erreur de chargement : ${error.message}`);
      setWorkflowTimestamps([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // pas de dépendances — les valeurs sont passées explicitement

  // Rechargement à chaque changement de filtre (y compris le montage initial)
  React.useEffect(() => {
    const valid = timeRange === 'custom' ? !!(startDate && endDate) : timeRange !== '';
    if (valid) {
      loadWorkflowData(timeRange, selectedBranch, selectedManager, startDate, endDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedManager, timeRange, startDate, endDate]);

  // Auto-refresh every 60 seconds — capture les filtres courants via closure
  React.useEffect(() => {
    const valid = timeRange === 'custom' ? !!(startDate && endDate) : timeRange !== '';
    if (!valid) return;
    const tr = timeRange, br = selectedBranch, mgr = selectedManager, sd = startDate, ed = endDate;
    const interval = setInterval(() => {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
      loadWorkflowData(tr, br, mgr, sd, ed);
      loadFilterOptions();
    }, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, selectedBranch, selectedManager, startDate, endDate]);

  // Countdown timer - resets when data is refreshed
  React.useEffect(() => {
    setRefreshCountdown(REFRESH_INTERVAL);
    const timer = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

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
  // ── Normalisation des noms d'étapes ─────────────────────────────────────
  // Couvre les deux formats : stepIds (credit_analysis) ET labels verbeux (Analyse Crédit)
  const normalizeStepName = (raw: string): string => {
    const map: Record<string, string> = {
      'application_created': 'Demande Soumise',
      'Application Créée': 'Demande Soumise',
      'Demande Soumise': 'Demande Soumise',
      'Vérification Documents': 'Vérification Documents',
      'credit_analysis': 'Analyse Crédit',
      'Analyse Crédit': 'Analyse Crédit',
      'Analyse Crédit & Évaluation Risques': 'Analyse Crédit',
      'Évaluation Risques': 'Évaluation Risques',
      'branch_manager_review': 'Examen Directeur Agence',
      'Examen Directeur Agence': 'Examen Directeur Agence',
      'credit_committee_review': 'Examen Comité Crédit',
      'Examen Comité Crédit': 'Examen Comité Crédit',
      'management_review': 'Examen Direction Générale',
      'Examen Direction Générale': 'Examen Direction Générale',
      'final_decision': 'Décision Finale',
      'Décision Finale': 'Décision Finale',
      'contract_preparation': 'Préparation Contrat',
      'Préparation Contrat': 'Préparation Contrat',
      'disbursement': 'Déblocage',
      'Déblocage': 'Déblocage',
      'Déblocage Fonds': 'Déblocage',
    };
    return map[raw] || raw;
  };

  // Durées attendues par étape canonique (jours ouvrés)
  const STEP_EXPECTED_DAYS: Record<string, number> = {
    'Demande Soumise': 0,
    'Vérification Documents': 1,
    'Analyse Crédit': 3,
    'Évaluation Risques': 1,
    'Examen Directeur Agence': 2,
    'Examen Comité Crédit': 3,
    'Examen Direction Générale': 5,
    'Décision Finale': 1,
    'Préparation Contrat': 1,
    'Déblocage': 1,
  };

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
          const stepName = normalizeStepName(step.stepName || (step as any).stepId || 'unknown_step');
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

      // Durée totale moyenne en ms
      const totalAvgTimeMs = branch.workflows.reduce((sum: number, wf: any) => sum + wf.totalDuration, 0) / branch.workflows.length;

      return {
        branch: branch.branch,
        avgProcessingTime: totalAvgTimeMs,
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
            const stepName = normalizeStepName(step.stepName || (step as any).stepId || 'unknown_step');
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
    !['approved', 'rejected', 'disbursed'].includes(getWorkflowDecision(wf))
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
    <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>

      {/* ── Hero Header (non-sticky pour éviter le conflit avec l'AppBar du layout) ── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #0f2557 0%, #1565c0 100%)',
        px: { xs: 2, md: 4 }, pt: 2.5, pb: 2.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.3 }}>
              Tableau de Bord Analytique
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.3 }}>
              {canViewAllBranches && 'Vue direction — performance globale du portefeuille crédit'}
              {canViewOwnBranch && `Agence ${userState.currentUser?.department} — performance locale`}
              {canViewOwnPerformance && 'Votre performance individuelle'}
            </Typography>
          </Box>

          {/* Live indicator + refresh */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: isLoading ? '#ffd740' : '#69f0ae',
                animation: 'kbsPulse 2s infinite',
                '@keyframes kbsPulse': {
                  '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 },
                },
              }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                {isLoading ? 'Actualisation...' : `LIVE — ↻ ${refreshCountdown}s`}
              </Typography>
            </Box>
            {lastUpdated && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                Màj {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
            <Tooltip title="Actualiser maintenant">
              <IconButton size="small" disabled={isLoading}
                onClick={() => { try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {} loadWorkflowData(timeRange, selectedBranch, selectedManager, startDate, endDate); loadFilterOptions(); }}
                sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 1.5, p: 0.6 }}
              >
                {isLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── Barre de filtres — sticky sous l'AppBar du layout ── */}
      <Box sx={{
        position: 'sticky',
        top: { xs: 56, sm: 64 },   /* hauteur de l'AppBar du layout */
        zIndex: 1050,
        bgcolor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        px: { xs: 2, md: 4 },
        py: 1.5,
      }}>
        {/* Erreur API */}
        {apiError && (
          <Box sx={{ mb: 1, px: 2, py: 0.75, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fca5a5' }}>
            <Typography variant="caption" sx={{ color: '#dc2626' }}>
              Erreur de connexion : {apiError}
            </Typography>
          </Box>
        )}

        {/* Filtres sur une seule ligne */}
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Période</InputLabel>
              <Select value={timeRange} label="Période" onChange={(e) => handleTimeRangeChange(e.target.value)}>
                <MenuItem value="1month">Dernier mois</MenuItem>
                <MenuItem value="3months">3 derniers mois</MenuItem>
                <MenuItem value="6months">6 derniers mois</MenuItem>
                <MenuItem value="1year">Dernière année</MenuItem>
                <MenuItem value="custom">Période personnalisée</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {canViewAllBranches && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Agence</InputLabel>
                <Select value={selectedBranch} label="Agence" onChange={(e) => setSelectedBranch(e.target.value)}>
                  <MenuItem value="all">Toutes les agences</MenuItem>
                  {availableBranches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}

          {(canViewAllBranches || canViewOwnBranch) && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Chargé d'Affaires</InputLabel>
                <Select value={selectedManager} label="Chargé d'Affaires" onChange={(e) => setSelectedManager(e.target.value)}>
                  <MenuItem value="all">Tous les chargés</MenuItem>
                  {availableManagers
                    .filter(m => canViewAllBranches || (canViewOwnBranch && m.branch === userState.currentUser?.department))
                    .map(m => <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {workflowTimestamps.length > 0
                ? `${workflowTimestamps.length} workflow${workflowTimestamps.length > 1 ? 's' : ''} chargé${workflowTimestamps.length > 1 ? 's' : ''}`
                : 'Aucune donnée'}
            </Typography>
          </Grid>
        </Grid>

        {/* Plage personnalisée — en dessous des filtres, hors Grid pour éviter le chevauchement */}
        <Collapse in={showCustomRange}>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField type="date" label={t('dashboard.timeframe.startDate')} value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} size="small" fullWidth
                  error={startDate !== '' && !isValidDate(startDate)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField type="date" label={t('dashboard.timeframe.endDate')} value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} size="small" fullWidth
                  inputProps={{ min: startDate || undefined }}
                  error={endDate !== '' && (!isValidDate(endDate) || (startDate !== '' && endDate < startDate))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button variant="contained" onClick={applyCustomRange} fullWidth size="small"
                  disabled={!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate}
                  sx={{ height: 40 }}
                >
                  {t('dashboard.timeframe.applyRange')}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>

      {/* ── Contenu principal ───────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>

        {/* No timeframe selected */}
        {!timeRange && (
          <Card sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <Avatar sx={{ bgcolor: '#1565c0', mx: 'auto', mb: 2, width: 64, height: 64 }}>
                <AssessmentIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h6" gutterBottom>{t('dashboard.noTimeframeSelected.title')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
                {t('dashboard.noTimeframeSelected.description')}
              </Typography>
            </CardContent>
          </Card>
        )}

      {/* Dashboard content */}
      {isTimeframeValid() && (
        <>
          {/* ── KPI Cards ─────────────────────────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Total applications */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderTop: '4px solid #1565c0', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                        Demandes totales
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#1565c0', lineHeight: 1.1, mt: 0.5 }}>
                        {totalApplications.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Sur la période</Typography>
                    </Box>
                    <AssessmentIcon sx={{ color: '#1565c0', fontSize: 32 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Approval rate */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderTop: '4px solid #16a34a', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                        Taux d'approbation
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#16a34a', lineHeight: 1.1, mt: 0.5 }}>
                        {approvalRate.toFixed(1)}%
                      </Typography>
                      <LinearProgress variant="determinate" value={approvalRate}
                        sx={{ height: 5, borderRadius: 3, mt: 1, bgcolor: '#dcfce7', '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' } }}
                      />
                    </Box>
                    <ApprovedIcon sx={{ color: '#16a34a', fontSize: 32, ml: 1 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Volume */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderTop: '4px solid #7c3aed', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                        Volume XOF
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#7c3aed', lineHeight: 1.1, mt: 0.5 }}>
                        {(totalVolume / 1000000).toFixed(1)}M
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Montant total demandé</Typography>
                    </Box>
                    <MoneyIcon sx={{ color: '#7c3aed', fontSize: 32 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Performance */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderTop: '4px solid #d97706', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                        Performance globale
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#d97706', lineHeight: 1.1, mt: 0.5 }}>
                        {avgPerformance.toFixed(0)}%
                      </Typography>
                      <LinearProgress variant="determinate" value={avgPerformance}
                        sx={{ height: 5, borderRadius: 3, mt: 1, bgcolor: '#fef3c7', '& .MuiLinearProgress-bar': { bgcolor: '#d97706' } }}
                      />
                    </Box>
                    <TrendingUpIcon sx={{ color: '#d97706', fontSize: 32, ml: 1 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ── Status Strip ──────────────────────────────────── */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', bgcolor: '#fffbeb' }}>
                <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: '12px' } }}>
                  <HourglassIcon sx={{ color: '#d97706', fontSize: 20 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#92400e', lineHeight: 1 }}>{totalPending}</Typography>
                    <Typography variant="caption" color="text.secondary">En attente</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', bgcolor: '#f0fdf4' }}>
                <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: '12px' } }}>
                  <CheckCircleOutlineIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#166534', lineHeight: 1 }}>{totalApproved}</Typography>
                    <Typography variant="caption" color="text.secondary">Approuvées</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', bgcolor: '#fff1f2' }}>
                <CardContent sx={{ py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: '12px' } }}>
                  <CancelIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#991b1b', lineHeight: 1 }}>{totalRejected}</Typography>
                    <Typography variant="caption" color="text.secondary">Refusées</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ── Charts row ────────────────────────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Portfolio Area Chart */}
            <Grid item xs={12} md={8}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Évolution du Portefeuille
                  </Typography>
                  {portfolioData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <AreaChart data={portfolioData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1565c0" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#1565c0" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="applications" stroke="#1565c0" strokeWidth={2} fill="url(#gradApps)" name="Demandes" />
                        <Area type="monotone" dataKey="approved" stroke="#16a34a" strokeWidth={2} fill="url(#gradApproved)" name="Approuvées" />
                        <Area type="monotone" dataKey="rejected" stroke="#dc2626" strokeWidth={2} fill="url(#gradRejected)" name="Refusées" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="body2" color="text.secondary">Aucune donnée pour la période sélectionnée</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Donut Risk Distribution */}
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Distribution des Risques
                  </Typography>
                  {filteredRiskDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <PieChart>
                        <Pie
                          data={filteredRiskDistribution}
                          cx="50%" cy="45%"
                          innerRadius={55} outerRadius={88}
                          paddingAngle={3}
                          dataKey="value"
                          label={false}
                        >
                          {filteredRiskDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: number, n: string) => [`${v}%`, n]} contentStyle={{ borderRadius: 8 }} />
                        <Legend
                          verticalAlign="bottom" height={36}
                          formatter={(value, entry: any) => `${value} (${entry.payload.value}%)`}
                          wrapperStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="body2" color="text.secondary">Aucune donnée disponible</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ── Branch & Manager performance ─────────────────── */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Branch Table */}
            {(canViewAllBranches || canViewOwnBranch) && (
              <Grid item xs={12} md={visibleManagers.length > 0 ? 7 : 12}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BranchIcon sx={{ color: '#1565c0', fontSize: 20 }} />
                      Performance par Agence
                    </Typography>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 400 }}>
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: '#f8fafc', fontSize: 12, py: 1 } }}>
                            <TableCell>Agence</TableCell>
                            <TableCell align="right">Demandes</TableCell>
                            <TableCell align="right">Approuvées</TableCell>
                            <TableCell align="right">Volume (M XOF)</TableCell>
                            <TableCell align="right">Score</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleBranches.map((branch) => {
                            const pct = branch.applications > 0 ? (branch.approved / branch.applications) * 100 : 0;
                            const borderColor = branch.performance >= 70 ? '#16a34a' : branch.performance >= 40 ? '#d97706' : '#dc2626';
                            return (
                              <TableRow key={branch.branch} sx={{ '& td': { fontSize: 13 }, borderLeft: `3px solid ${borderColor}` }}>
                                <TableCell sx={{ fontWeight: 500 }}>
                                  <Chip label={branch.branch} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                </TableCell>
                                <TableCell align="right">{branch.applications}</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    {branch.approved}
                                    <Chip label={`${pct.toFixed(0)}%`} size="small" color={pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error'} sx={{ fontSize: 10 }} />
                                  </Box>
                                </TableCell>
                                <TableCell align="right">{(branch.volume / 1000000).toFixed(1)}M</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    <LinearProgress variant="determinate" value={branch.performance}
                                      sx={{ width: 50, height: 5, borderRadius: 3 }}
                                      color={branch.performance >= 70 ? 'success' : branch.performance >= 40 ? 'warning' : 'error'}
                                    />
                                    <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
                                      {branch.performance}%
                                    </Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {visibleBranches.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontSize: 13 }}>
                                Aucune donnée d'agence disponible
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Manager Ranking */}
            {visibleManagers.length > 0 && (
              <Grid item xs={12} md={canViewAllBranches || canViewOwnBranch ? 5 : 12}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                      Classement Chargés d'Affaires
                    </Typography>
                    <List disablePadding>
                      {visibleManagers
                        .sort((a, b) => (b.performance || 0) - (a.performance || 0))
                        .map((manager, index) => (
                        <React.Fragment key={manager.name}>
                          <ListItem sx={{ px: 0, py: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                              {/* Rank */}
                              <Typography variant="body2" sx={{ fontWeight: 700, color: index === 0 ? '#d97706' : 'text.secondary', minWidth: 18, fontSize: 13 }}>
                                #{index + 1}
                              </Typography>
                              <Avatar sx={{ bgcolor: index === 0 ? '#fef3c7' : 'transparent', color: index === 0 ? '#d97706' : '#475569', border: index === 0 ? 'none' : '1.5px solid #cbd5e1', width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
                                {manager.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {manager.name}
                                  </Typography>
                                  {index === 0 && <Chip label="Top" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 9, height: 18 }} />}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {manager.branch} · {manager.clients || 0} clients · {((manager.volume || 0) / 1000000).toFixed(1)}M XOF
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 0.8 }}>
                                  <LinearProgress variant="determinate" value={manager.performance || 0}
                                    sx={{ flex: 1, height: 4, borderRadius: 2 }}
                                    color={(manager.performance || 0) >= 70 ? 'success' : (manager.performance || 0) >= 40 ? 'warning' : 'error'}
                                  />
                                  <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 30 }}>
                                    {manager.performance || 0}%
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </ListItem>
                          {index < visibleManagers.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                        </React.Fragment>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* ── Process Analytics Section ────────────────────── */}
          <Box sx={{ mt: 1 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimeIcon sx={{ color: '#1565c0', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                Analyse des Processus Crédit
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              {/* Avg processing time */}
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
                  <CardContent sx={{ py: 2.5 }}>
                    <TimeIcon sx={{ color: '#1565c0', fontSize: 36, mb: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#1565c0' }}>
                      {(() => {
                        const completedFiltered = getFilteredWorkflows().filter(wf => {
                          const d = wf.finalDecision || wf.status;
                          return (d === 'approved' || d === 'rejected') && wf.totalDuration;
                        });
                        return completedFiltered.length > 0
                          ? formatDuration(completedFiltered.reduce((s, wf) => s + wf.totalDuration!, 0) / completedFiltered.length)
                          : '—';
                      })()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Temps moyen de traitement</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
                  <CardContent sx={{ py: 2.5 }}>
                    <AssessmentIcon sx={{ color: '#16a34a', fontSize: 36, mb: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      {getFilteredWorkflows().filter(wf => {
                        const d = wf.finalDecision || wf.status;
                        return d === 'approved' || d === 'rejected';
                      }).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Demandes traitées</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
                  <CardContent sx={{ py: 2.5 }}>
                    <PendingIcon sx={{ color: '#d97706', fontSize: 36, mb: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#d97706' }}>
                      {getFilteredWorkflows().filter(wf => !['approved','rejected','disbursed'].includes(wf.status)).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>En cours de traitement</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Branch processing time bar chart */}
              <Grid item xs={12} lg={8}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Temps de Traitement par Agence (heures)
                    </Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={calculateRealPerformanceMetrics()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: 'Heures', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                        <RechartsTooltip
                          formatter={(value: number) => [`${value.toFixed(1)}h`, 'Temps moyen']}
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                        />
                        <Bar dataKey="avgProcessingTime" radius={[4, 4, 0, 0]}>
                          {calculateRealPerformanceMetrics().map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#1565c0', '#7c3aed', '#16a34a', '#d97706', '#dc2626'][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Processing trend area chart */}
              <Grid item xs={12} lg={4}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Évolution des Délais
                    </Typography>
                    {processingTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={processingTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1565c0" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#1565c0" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} label={{ value: 'Heures', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                          <RechartsTooltip
                            formatter={(value: number) => [`${value.toFixed(1)}h`, 'Durée moyenne']}
                            labelFormatter={(label) => `Mois : ${label}`}
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                          />
                          <Area type="monotone" dataKey="avgTime" stroke="#1565c0" strokeWidth={2.5} fill="url(#gradTrend)" dot={{ fill: '#1565c0', r: 4 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="body2" color="text.secondary">Aucune donnée de traitement disponible</Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Step-by-step approval performance */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Performance Globale du Processus d'Approbation
                    </Typography>

                    {(() => {
                      const fwf = getFilteredWorkflows();
                      const cwf = fwf.filter(wf => {
                        const d = wf.finalDecision || wf.status;
                        return (d === 'approved' || d === 'rejected') && wf.totalDuration;
                      });

                      if (cwf.length === 0) {
                        return (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.secondary" variant="body2">
                              Aucune donnée disponible. Les métriques s'afficheront après le traitement des premières demandes.
                            </Typography>
                          </Box>
                        );
                      }

                      const stepAverages: { [s: string]: { total: number; count: number; avg: number } } = {};
                      cwf.forEach(workflow => {
                        if (workflow.steps && Array.isArray(workflow.steps)) {
                          workflow.steps.forEach(step => {
                            if (step && step.duration && typeof step.duration === 'number') {
                              const stepName = normalizeStepName(step.stepName || (step as any).stepId || 'unknown_step');
                              if (!stepAverages[stepName]) stepAverages[stepName] = { total: 0, count: 0, avg: 0 };
                              stepAverages[stepName].total += step.duration;
                              stepAverages[stepName].count++;
                            }
                          });
                        }
                      });
                      Object.keys(stepAverages).forEach(s => { stepAverages[s].avg = stepAverages[s].total / stepAverages[s].count; });

                      const stepColors: { [k: string]: string } = {
                        'Demande Soumise': '#4caf50',
                        'Vérification Documents': '#2196f3',
                        'Analyse Crédit': '#ff9800',
                        'Évaluation Risques': '#ef5350',
                        'Examen Directeur Agence': '#9c27b0',
                        'Examen Comité Crédit': '#673ab7',
                        'Examen Direction Générale': '#e91e63',
                        'Décision Finale': '#3f51b5',
                        'Préparation Contrat': '#009688',
                        'Déblocage': '#43a047',
                      };
                      const stepOrder = ['Demande Soumise','Vérification Documents','Analyse Crédit','Évaluation Risques','Examen Directeur Agence','Examen Comité Crédit','Examen Direction Générale','Décision Finale','Préparation Contrat','Déblocage'];
                      const chartData = Object.keys(stepAverages).map(stepName => ({
                        stepName,
                        avgWorkdays: Math.round((stepAverages[stepName].avg / (9 * 3600000)) * 10) / 10,
                        count: stepAverages[stepName].count,
                        color: stepColors[stepName] || '#1976d2'
                      })).sort((a, b) => {
                        const ia = stepOrder.indexOf(a.stepName || '');
                        const ib = stepOrder.indexOf(b.stepName || '');
                        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                      });

                      const bottlenecks = chartData
                        .filter(s => s.stepName && s.avgWorkdays > (STEP_EXPECTED_DAYS[s.stepName] ?? 1))
                        .sort((a, b) => b.avgWorkdays - a.avgWorkdays)
                        .slice(0, 3);

                      return (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: '#475569' }}>
                            Durée moyenne par étape (jours ouvrés)
                          </Typography>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 70 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="stepName" angle={-40} textAnchor="end" height={90} tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} label={{ value: 'Jours', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                              <RechartsTooltip
                                formatter={(value: number) => [`${formatDuration(value * 9 * 3600000)}`, 'Durée moyenne']}
                                labelFormatter={(label) => `Étape : ${label}`}
                                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                              />
                              <Bar dataKey="avgWorkdays" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          {/* Bottlenecks */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: '#475569' }}>
                              Goulets d'étranglement identifiés
                            </Typography>
                            <Grid container spacing={2}>
                              {bottlenecks.length > 0 ? bottlenecks.map((step, index) => {
                                const expected = step.stepName ? (STEP_EXPECTED_DAYS[step.stepName] ?? 1) : 1;
                                const overrunPct = Math.round(((step.avgWorkdays - expected) / expected) * 100);
                                const borderColors = ['#dc2626', '#d97706', '#2563eb'];
                                return (
                                  <Grid item xs={12} md={4} key={step.stepName}>
                                    <Card variant="outlined" sx={{ p: 2, borderColor: borderColors[index], borderWidth: 2, borderRadius: 2 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: borderColors[index], textTransform: 'uppercase', fontSize: 10 }}>
                                        {index === 0 ? 'Critique' : index === 1 ? 'Modéré' : 'Mineur'}
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{step.stepName}</Typography>
                                      <Typography variant="h5" sx={{ fontWeight: 700, color: borderColors[index], mt: 0.5 }}>+{overrunPct}%</Typography>
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {formatDuration(step.avgWorkdays * 9 * 3600000)} · attendu {expected}j · {step.count} dossiers
                                      </Typography>
                                    </Card>
                                  </Grid>
                                );
                              }) : (
                                <Grid item xs={12}>
                                  <Card variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: '#f0fdf4', borderColor: '#16a34a', borderRadius: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534' }}>
                                      Aucun goulet d'étranglement — toutes les étapes respectent les délais
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

              {/* Detailed step analysis per branch */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <CardContent>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Performance des Étapes par Agence
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                        Chaque cellule indique la <strong>durée ouvrée moyenne</strong> passée à cette étape pour les dossiers clôturés (approuvés ou rejetés) de l'agence.
                        «&nbsp;—&nbsp;» signifie que l'étape n'est pas présente dans le workflow de cette agence.
                        Le <strong>Total Moyen</strong> est le temps ouvré total entre la création du dossier et sa décision finale&nbsp;; le code couleur reflète les seuils configurés (vert&nbsp;≤&nbsp;50&nbsp;%, orange&nbsp;≤&nbsp;80&nbsp;%, rouge&nbsp;&gt;&nbsp;100&nbsp;% de la norme).
                      </Typography>
                    </Box>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 560 }}>
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: '#f8fafc', fontSize: 12, py: 1.2 } }}>
                            <TableCell>Agence</TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'étape Vérification des Documents (pièces justificatives, KYC…)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Vérif. Docs</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'étape Analyse Crédit (scoring, ratio financiers, capacité de remboursement)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Analyse Crédit</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'étape Évaluation des Risques (garanties, secteur, historique)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Éval. Risques</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'examen par le Directeur d'Agence (validation intermédiaire)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Dir. Agence</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'examen en Comité de Crédit (dossiers dépassant le seuil de délégation)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Comité Crédit</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Durée moyenne de l'examen par la Direction Générale (montants très élevés)" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Direction Gén.</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Temps ouvré total moyen du dossier (création → décision finale). Vert ≤ 50 % de la norme · Orange ≤ 80 % · Rouge > 100 %" arrow placement="top">
                                <span style={{ cursor: 'help', borderBottom: '1px dotted #94a3b8' }}>Total Moyen ⓘ</span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {calculateStepPerformanceMetrics().map((branch) => {
                            const st = branch.avgStepTimes;
                            const cell = (key: string) => (st[key] > 0 ? formatDuration(st[key]) : '—');
                            return (
                              <TableRow key={branch.branch} sx={{ '& td': { fontSize: 12 }, '&:hover': { bgcolor: '#f8fafc' } }}>
                                <TableCell sx={{ fontWeight: 600 }}>{branch.branch}</TableCell>
                                <TableCell>{cell('Vérification Documents')}</TableCell>
                                <TableCell>{cell('Analyse Crédit')}</TableCell>
                                <TableCell>{cell('Évaluation Risques')}</TableCell>
                                <TableCell>{cell('Examen Directeur Agence')}</TableCell>
                                <TableCell>{cell('Examen Comité Crédit')}</TableCell>
                                <TableCell>{cell('Examen Direction Générale')}</TableCell>
                                <TableCell>
                                  <Tooltip
                                    title={`${branch.completedApplications} dossier${branch.completedApplications > 1 ? 's' : ''} clôturé${branch.completedApplications > 1 ? 's' : ''}`}
                                    arrow placement="left"
                                  >
                                    <span>
                                      <Chip label={formatDuration(branch.avgProcessingTime)} color={getPerformanceColor(branch.avgProcessingTime)} size="small" sx={{ fontWeight: 600, fontSize: 11, cursor: 'default' }} />
                                    </span>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {calculateStepPerformanceMetrics().length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary', fontSize: 13 }}>
                                Aucune donnée de performance disponible
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* ── Analytiques Politique de Crédit ──────────────────────────────── */}
          <Box mt={4}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ width: 4, height: 20, bgcolor: 'primary.main', borderRadius: 2, display: 'inline-block' }} />
              Temps de traitement par étape (Politique de Crédit)
            </Typography>
            {policyAnalyticsLoading ? (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
            ) : !policyAnalytics ? (
              <Card variant="outlined"><CardContent><Typography color="text.secondary" fontSize={13}>Aucune donnée disponible.</Typography></CardContent></Card>
            ) : (
              <>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {policyAnalytics.totalApplications}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Dossiers analysés</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {policyAnalytics.averageTotalDurationMinutes !== null
                          ? `${Math.round(policyAnalytics.averageTotalDurationMinutes / 60)}h`
                          : '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Durée moyenne totale</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {policyAnalytics.stepAverages?.filter((s: any) => s.overdueRate > 0).length ?? 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Étapes avec retards</Typography>
                    </Card>
                  </Grid>
                </Grid>
                <Card variant="outlined">
                  <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 420 }}>
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell>Étape</TableCell>
                        <TableCell align="center">Dossiers traités</TableCell>
                        <TableCell align="center">Durée moyenne</TableCell>
                        <TableCell align="center">Taux de retard</TableCell>
                        <TableCell>Indicateur</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {policyAnalytics.stepAverages
                        ?.sort((a: any, b: any) => b.averageDurationMinutes - a.averageDurationMinutes)
                        .map((s: any) => (
                          <TableRow key={s.stepName} hover>
                            <TableCell><Typography variant="body2" fontWeight={600}>{s.stepName}</Typography></TableCell>
                            <TableCell align="center">{s.count}</TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight={600}>
                                {s.averageDurationMinutes < 60
                                  ? `${s.averageDurationMinutes} min`
                                  : `${Math.round(s.averageDurationMinutes / 60)} h`}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${s.overdueRate}%`}
                                size="small"
                                color={s.overdueRate > 30 ? 'error' : s.overdueRate > 10 ? 'warning' : 'success'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{
                                height: 6,
                                width: `${Math.min(100, (s.averageDurationMinutes / 480) * 100)}%`,
                                minWidth: 4,
                                bgcolor: s.overdueRate > 30 ? 'error.main' : s.overdueRate > 10 ? 'warning.main' : 'success.main',
                                borderRadius: 3,
                              }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      {(!policyAnalytics.stepAverages || policyAnalytics.stepAverages.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontSize: 13 }}>
                            Aucune donnée d'étape disponible
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </TableContainer>
                </Card>
              </>
            )}
          </Box>
        </>
      )}
      </Box>
    </Box>
  );
};