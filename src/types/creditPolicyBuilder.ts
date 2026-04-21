export type PolicyStepType = 'DISPATCH' | 'ANALYSIS' | 'APPROVAL' | 'COMMITTEE';
export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GuardOperator = 'AND' | 'OR';
export type ConditionOperator = 'BETWEEN' | 'LT' | 'GT' | 'GTE' | 'LTE' | 'IN' | 'NOT_IN';
export type ConditionField = 'amount' | 'riskScore' | 'creditTypeId';

export interface GuardCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number | { min: number; max: number } | string[];
}

export interface GuardsJson {
  operator: GuardOperator;
  conditions: GuardCondition[];
}

export interface PolicyStep {
  id: string;
  policyId: string;
  stepName: string;
  stepLabel: string;
  order: number;
  stepType: PolicyStepType;
  assignedRole: string;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  expectedDurationHours: number;
  maxDurationHours: number;
  isRequired: boolean;
  isActive: boolean;
  description: string | null;
  creditTypeIds: string[];
  guards: GuardsJson | null;
  _error?: string; // validation error, frontend only
}

export interface CreditPolicyFull {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  status: PolicyStatus;
  version: number;
  validFrom: string;
  validTo: string | null;
  companyId: string | null;
  steps: PolicyStep[];
  _count?: { steps: number; applications: number };
}

export interface CreditType {
  id: string;
  name: string;
  code: string;
}

export const STEP_TYPE_CONFIG: Record<PolicyStepType, { label: string; color: string; bgColor: string }> = {
  DISPATCH:  { label: 'Dispatch',     color: '#1565c0', bgColor: '#e3f2fd' },
  ANALYSIS:  { label: 'Analyse',      color: '#e65100', bgColor: '#fff3e0' },
  APPROVAL:  { label: 'Approbation',  color: '#2e7d32', bgColor: '#e8f5e9' },
  COMMITTEE: { label: 'Comité',       color: '#6a1b9a', bgColor: '#f3e5f5' },
};

export const ROLES = [
  { value: 'CHARGE_AFFAIRES',         label: "Chargé d'Affaires" },
  { value: 'ANALYSTE_RISQUES',        label: 'Analyste Risques' },
  { value: 'RESPONSABLE_RISQUES',     label: 'Responsable Risques' },
  { value: 'RESPONSABLE_ENGAGEMENTS', label: 'Responsable Engagements' },
  { value: 'COMITE_CREDIT',           label: 'Comité de Crédit' },
  { value: 'DIRECTION_GENERALE',      label: 'Direction Générale' },
  { value: 'DIRECTION_JURIDIQUE',     label: 'Direction Juridique' },
  { value: 'BACK_OFFICE',             label: 'Back Office' },
];
