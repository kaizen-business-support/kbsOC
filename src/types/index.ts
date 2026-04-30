// Financial Analysis Types
export interface FinancialData {
  [key: string]: number | string;
}

export interface YearData {
  year: number;
  period: string;
  data: FinancialData;
}

export interface MultiyearData {
  [yearKey: string]: {
    year: number;
    data: FinancialData;
    ratios?: FinancialRatios;
  };
}

export interface FinancialRatios {
  // Profitability ratios
  roe?: number; // Return on Equity
  roa?: number; // Return on Assets
  net_profit_margin?: number;
  gross_profit_margin?: number;
  
  // Liquidity ratios
  ratio_liquidite_generale?: number;
  ratio_liquidite_reduite?: number;
  ratio_liquidite_immediate?: number;
  
  // Leverage ratios
  ratio_endettement?: number;
  ratio_autonomie_financiere?: number;
  ratio_couverture_dettes?: number;
  
  // Efficiency ratios
  rotation_actif?: number;
  rotation_stocks?: number;
  delai_recouvrement?: number;
  
  // Additional ratios
  [key: string]: number | undefined;
}

export interface AnalysisData {
  multiyear_data?: MultiyearData;
  data?: {
    multiyear_data?: MultiyearData;
  };
  score?: AnalysisScore;
  insights?: AnalysisInsight[];
  recommendations?: Recommendation[];
}

export interface AnalysisScore {
  overall: number;
  profitability: number;
  liquidity: number;
  leverage: number;
  efficiency: number;
  trend: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnalysisInsight {
  category: 'profitability' | 'liquidity' | 'leverage' | 'efficiency' | 'trend';
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expected_impact: string;
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
}

// Table and Display Types
export interface FinancialTableRow {
  label: string;
  [year: string]: string | number;
}

export interface ChartData {
  name: string;
  value: number;
  year?: string | number;
  category?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// File Upload Types
export interface FileUploadResult {
  success: boolean;
  data?: AnalysisData;
  error?: string;
  filename?: string;
}

// Navigation Types
export type PageType = 'home' | 'configuration' | 'data-input' | 'upload' | 'manual-input' | 'analysis' | 'reports' | 'settings' | 'documentation' | 'clients' | 'credit-scoring' | 'credit-application' | 'workflow' | 'analytics' | 'bank-holidays-admin' | 'user-management' | 'approval-limits' | 'credit-simulation' | 'credit-types' | 'profile' | 'backup' | 'announcements' | 'notifications-config' | 'dispatching' | 'credit-policy' | 'workflow-builder' | 'company-settings' | 'platform-admin' | 'raci-matrix' | 'approvals' | 'contract-templates' | 'legal-step' | 'codir-dashboard';

// Report Types
export interface ReportData {
  analysis: AnalysisData;
  period: string;
  generated_at: string;
  type: 'pdf' | 'excel';
}

// BCEAO Norms Types
export interface BceaoNorms {
  [ratioKey: string]: {
    min?: number;
    max?: number;
    optimal?: number;
    unit: string;
    description: string;
  };
}

// Sectoral Norms Types
export interface SectoralNorms {
  [sector: string]: {
    [ratioKey: string]: {
      median: number;
      q1: number;
      q3: number;
      unit: string;
    };
  };
}

// UI State Types
export interface UIState {
  currentPage: PageType;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
}

// Form Types
export interface ManualInputForm {
  year: number;
  period: string;
  data: FinancialData;
}

// Export Types
export interface ExportOptions {
  format: 'pdf' | 'excel';
  includeCharts: boolean;
  includeRecommendations: boolean;
  language: 'fr' | 'en';
}

// Client Management Types
export interface Client {
  id: string;
  companyName: string;
  rccm: string | null;
  ninea: string | null;
  cofi: string | null;
  legalForm: string | null;
  sector: string | null;
  establishedYear: number | null;
  headquarters: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Credit Application Workflow Types
// Note: Approval review steps (branch_manager_review, credit_committee_review, management_review)
// are now dynamically generated based on credit amount and approval limits
export type WorkflowStepId =
  | 'application_created'       // Application créée
  | 'credit_analysis'          // Analyse crédit & Évaluation risques (includes document verification, financial analysis, and risk assessment)
  | 'branch_manager_review'    // Examen Directeur d'Agence (dynamic approval step)
  | 'credit_committee_review'  // Examen Comité de Crédit (dynamic approval step)
  | 'management_review'        // Examen Direction Générale (dynamic approval step)
  | 'final_decision'          // Décision finale
  | 'contract_preparation'     // Préparation contrat
  | 'disbursement';           // Déblocage

// Workflow Timestamp Tracking Types
export interface WorkflowStep {
  stepId: WorkflowStepId;
  stepName: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // in milliseconds
  userId?: string;
  userName?: string;
  userRole?: string;
  branch?: string;
  decision?: 'approved' | 'rejected' | 'on_hold' | 'pending';
  comments?: string;
  allowedActions?: string[];
}

export interface ApprovalItem {
  id: string;
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  stepName: string;
  stepLabel: string;
  stepType: string;
  allowedActions: string[];
  type: 'financial' | 'process';
  creditType: string | null;
  branch: string | null;
  purpose: string;
  daysWaiting: number;
  deadline: string | null;
  isOverdue: boolean;
}

export interface WorkflowTimestamps {
  applicationId: string;
  clientId: string;
  clientName: string;
  applicationNumber: string;
  requestedAmount: number;
  currency: string;
  totalStartedAt: string;
  totalCompletedAt?: string;
  totalDuration?: number; // in milliseconds
  currentStepId: WorkflowStepId;
  finalDecision?: 'approved' | 'rejected' | 'cancelled';
  steps: WorkflowStep[];
  createdBy: string;
  createdByName: string;
  branch: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'approved';
}

// Performance Analytics Types
export interface PerformanceMetrics {
  branch?: string;
  chargeAffaires?: string;
  period: {
    start: string;
    end: string;
  };
  averageProcessingTime: number;
  totalApplications: number;
  completedApplications: number;
  stepMetrics: {
    stepName: string;
    averageDuration: number;
    totalProcessed: number;
  }[];
}

// Bank Holiday Management Types
export interface BankHoliday {
  id: string;
  name: string;
  date: string; // ISO date string
  year: number;
  isRecurring: boolean; // true for holidays that repeat annually
  description?: string;
}

export interface WorkdayConfiguration {
  standardWorkdays: number; // default: 3
  workingHours: {
    start: string; // "08:00"
    end: string;   // "17:00"
  };
  workingDays: number[]; // [1, 2, 3, 4, 5] for Monday-Friday
  holidays: BankHoliday[];
}

// Duration calculation types
export interface WorkdayDuration {
  workdays: number;
  hours: number;
  totalHours: number;
  businessDaysOnly: boolean;
}

// Workflow Step Configuration
export interface WorkflowStepConfig {
  stepId: WorkflowStepId;
  stepName: string;
  description: string;
  expectedDuration: number; // in workdays
  requiredRoles: string[];
  isApprovalStep: boolean;
  nextSteps: WorkflowStepId[];
}

// ─── Multi-tenant types ────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CompanyWithRole extends Company {
  role: UserRole;
}

export type UserRole =
  | 'CHARGE_AFFAIRES'
  | 'ANALYSTE_RISQUES'
  | 'RESPONSABLE_RISQUES'
  | 'RESPONSABLE_ENGAGEMENTS'
  | 'COMITE_CREDIT'
  | 'DIRECTION_GENERALE'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'BACK_OFFICE'
  | 'DIRECTION_JURIDIQUE';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CHARGE_AFFAIRES:         'Chargé d\'Affaires',
  ANALYSTE_RISQUES:        'Analyste Risques',
  RESPONSABLE_RISQUES:     'Responsable Risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable Engagements',
  COMITE_CREDIT:           'Comité de Crédit',
  DIRECTION_GENERALE:      'Direction Générale',
  ADMIN:                   'Administrateur',
  SUPER_ADMIN:             'Super Administrateur',
  BACK_OFFICE:             'Back Office',
  DIRECTION_JURIDIQUE:     'Direction Juridique',
};

// CODIR Dashboard Types
export interface StepKpi {
  stepName: string;
  stepLabel: string;
  role: string;
  count: number;
  overdueCount: number;
  avgWaitHours: number;
}

export interface PendingDecisionItem {
  stepId: string;
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  stepName: string;
  stepLabel: string;
  assignedRole: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  deadline: string | null;
  isOverdue: boolean;
  daysWaiting: number;
  isEscalated: boolean;
  escalatedAt: string | null;
  lastRelancedAt: string | null;
  clientBranch?: string | null;
  creatorBranch?: string | null;
}

export interface CodirDashboardData {
  kpis: StepKpi[];
  items: PendingDecisionItem[];
}

export interface TimelineStep {
  stepName: string;
  stepLabel: string;
  order: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  agentName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationHours: number | null;
  isSlaBroken: boolean;
}

export interface ApplicationTimeline {
  applicationId: string;
  applicationNumber: string;
  clientName: string;
  clientBranch: string | null;
  amount: number;
  currency: string;
  creatorName: string;
  creatorBranch: string | null;
  isOverdue: boolean;
  daysWaiting: number;
  isEscalated: boolean;
  steps: TimelineStep[];
}

export interface CodirTimelineData {
  agences: { client: string[]; ca: string[] };
  applications: ApplicationTimeline[];
}