import { WorkflowStepId, WorkflowStepConfig } from '../types';

// Store for dynamically loaded step durations (in workdays)
let fixedStepDurations: Record<string, number> = {
  application_created: 0.5,
  credit_analysis: 4,
  final_decision: 0.5,
  contract_preparation: 1,
  disbursement: 0.5
};

// Store for approval limits with review durations
interface ApprovalLimit {
  role: string;
  displayName: string;
  minAmount: number;
  maxAmount: number;
  reviewDuration: number; // in workdays
  maxReviewDuration: number; // in workdays
  requiresCommittee: boolean;
  committeeMinMembers?: number;
}

let approvalLimits: ApprovalLimit[] = [];

// Function to update fixed step durations from API
export const setFixedStepDurations = (durations: Record<string, number>) => {
  fixedStepDurations = durations;
};

// Function to update approval limits from API
export const setApprovalLimits = (limits: ApprovalLimit[]) => {
  approvalLimits = limits.sort((a, b) => a.minAmount - b.minAmount);
};

// Get approval limit for a given amount
export const getApprovalLimitForAmount = (amount: number): ApprovalLimit | null => {
  return approvalLimits.find(limit =>
    amount >= limit.minAmount && amount <= limit.maxAmount
  ) || null;
};

// Function to get step duration (in workdays)
export const getStepDuration = (stepId: WorkflowStepId): number => {
  return fixedStepDurations[stepId] || 1;
};

// Complete workflow step configurations for FIXED steps
export const FIXED_WORKFLOW_STEPS: Record<string, WorkflowStepConfig> = {
  application_created: {
    stepId: 'application_created',
    stepName: 'Application Créée',
    description: 'Création de la demande de crédit par le chargé d\'affaires',
    get expectedDuration() { return getStepDuration('application_created'); },
    requiredRoles: ['account_manager', 'admin'],
    isApprovalStep: false,
    nextSteps: ['credit_analysis']
  },
  credit_analysis: {
    stepId: 'credit_analysis',
    stepName: 'Analyse Crédit & Évaluation Risques',
    description: 'Vérification des documents, analyse financière détaillée, évaluation des risques et scoring crédit',
    get expectedDuration() { return getStepDuration('credit_analysis'); },
    requiredRoles: ['credit_analyst', 'admin'],
    isApprovalStep: false,
    nextSteps: [] // Next step is dynamic based on amount
  },
  final_decision: {
    stepId: 'final_decision',
    stepName: 'Décision Finale',
    description: 'Notification de la décision finale au client',
    get expectedDuration() { return getStepDuration('final_decision'); },
    requiredRoles: ['account_manager', 'branch_manager', 'admin'],
    isApprovalStep: false,
    nextSteps: ['contract_preparation'] // Only if approved
  },
  contract_preparation: {
    stepId: 'contract_preparation',
    stepName: 'Préparation Contrat',
    description: 'Préparation du contrat de crédit et documents juridiques',
    get expectedDuration() { return getStepDuration('contract_preparation'); },
    requiredRoles: ['legal_officer', 'account_manager', 'admin'],
    isApprovalStep: false,
    nextSteps: ['disbursement']
  },
  disbursement: {
    stepId: 'disbursement',
    stepName: 'Déblocage',
    description: 'Déblocage des fonds et finalisation du crédit',
    get expectedDuration() { return getStepDuration('disbursement'); },
    requiredRoles: ['operations_officer', 'branch_manager', 'admin'],
    isApprovalStep: false,
    nextSteps: []
  }
};

// Get dynamic approval step configuration based on amount
export const getApprovalStepConfig = (amount: number): WorkflowStepConfig | null => {
  const limit = getApprovalLimitForAmount(amount);
  if (!limit) return null;

  // Fallback display name if not provided
  const displayName = limit.displayName || getRoleDisplayName(limit.role);

  return {
    stepId: `${limit.role.toLowerCase()}_review` as WorkflowStepId,
    stepName: `Examen ${displayName}`,
    description: `Examen et décision du ${displayName} (${(limit.minAmount / 1000000).toFixed(0)}M - ${(limit.maxAmount / 1000000).toFixed(0)}M XOF)`,
    expectedDuration: limit.reviewDuration,
    requiredRoles: [limit.role.toLowerCase(), 'admin'],
    isApprovalStep: true,
    nextSteps: ['final_decision']
  };
};

// Helper function to get role display name
const getRoleDisplayName = (role: string): string => {
  const roleNames: Record<string, string> = {
    'BRANCH_MANAGER': 'Directeur d\'Agence',
    'CREDIT_COMMITTEE': 'Comité de Crédit',
    'MANAGEMENT': 'Direction Générale',
    'branch_manager': 'Directeur d\'Agence',
    'credit_committee': 'Comité de Crédit',
    'management': 'Direction Générale'
  };

  return roleNames[role] || role;
};

// Get the complete workflow for a given amount
export const getWorkflowForAmount = (amount: number, isApproved?: boolean): WorkflowStepConfig[] => {
  const workflow: WorkflowStepConfig[] = [];

  // Always start with application creation
  workflow.push(FIXED_WORKFLOW_STEPS.application_created);

  // Credit analysis
  workflow.push(FIXED_WORKFLOW_STEPS.credit_analysis);

  // Add dynamic approval step based on amount
  const approvalStep = getApprovalStepConfig(amount);
  if (approvalStep) {
    workflow.push(approvalStep);
  }

  // Final decision
  workflow.push(FIXED_WORKFLOW_STEPS.final_decision);

  // Only add post-approval steps if approved
  if (isApproved) {
    workflow.push(FIXED_WORKFLOW_STEPS.contract_preparation);
    workflow.push(FIXED_WORKFLOW_STEPS.disbursement);
  }

  return workflow;
};

// Get the total expected duration for a complete workflow
export const getTotalExpectedDuration = (amount: number, isApproved: boolean = true): number => {
  const workflow = getWorkflowForAmount(amount, isApproved);
  return workflow.reduce((total, step) => total + step.expectedDuration, 0);
};

// Get the expected workflow steps based on amount and current status
export const getExpectedWorkflowSteps = (amount: number, isApproved?: boolean): WorkflowStepId[] => {
  const workflow = getWorkflowForAmount(amount, isApproved);
  return workflow.map(step => step.stepId);
};

// Get step display information
export const getStepDisplayInfo = (stepId: WorkflowStepId) => {
  // Check fixed steps first
  if (FIXED_WORKFLOW_STEPS[stepId]) {
    return FIXED_WORKFLOW_STEPS[stepId];
  }

  // For dynamic approval steps, we need the amount to determine the config
  // This is a fallback - in real usage, the step should be retrieved from workflow context
  return null;
};

// Calculate workflow progress percentage
export const calculateWorkflowProgress = (completedSteps: number, totalSteps: number): number => {
  if (totalSteps === 0) return 0;
  return Math.round((completedSteps / totalSteps) * 100);
};

// Get current step display name
export const getCurrentStepName = (currentStepId: WorkflowStepId, amount?: number): string => {
  const fixedStep = FIXED_WORKFLOW_STEPS[currentStepId];
  if (fixedStep) {
    return fixedStep.stepName;
  }

  // For dynamic approval steps
  if (amount) {
    const approvalStep = getApprovalStepConfig(amount);
    if (approvalStep && approvalStep.stepId === currentStepId) {
      return approvalStep.stepName;
    }
  }

  return 'Étape Inconnue';
};

// Check if a step is overdue
export const isStepOverdue = (step: { stepId: WorkflowStepId; startedAt: string; completedAt?: string }, expectedDuration: number): boolean => {
  if (step.completedAt) return false; // Already completed

  const startTime = new Date(step.startedAt).getTime();
  const expectedDurationMs = expectedDuration * 24 * 60 * 60 * 1000; // Convert workdays to ms
  const currentTime = new Date().getTime();

  return (currentTime - startTime) > expectedDurationMs;
};

// Get workflow status color
export const getWorkflowStatusColor = (status: string) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'error';
  return 'warning'; // In progress
};

// Format amount for display
export const formatAmount = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toLocaleString();
};
