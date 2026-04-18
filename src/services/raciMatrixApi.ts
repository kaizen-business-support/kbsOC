import { ApiService } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaciCode = 'R' | 'A' | 'C' | 'I';

export interface RaciStepRole {
  role: string;
  raciCode: RaciCode;
}

export interface RaciUser {
  id: string;
  name: string;
  email: string;
}

export interface RaciStep {
  id: string;
  stepName: string;
  stepLabel: string;
  phase: string | null;
  order: number;
  stepType: string;
  assignedRole: string;
  expectedDurationHours: number;
  maxDurationHours: number;
  conditionMinAmount: number | null;
  conditionMaxAmount: number | null;
  isRequired: boolean;
  roles: RaciStepRole[];
  users: Record<string, RaciUser[]>;
}

export interface ChineseWallRule {
  id?: string;
  blockedRole: string;
  forbiddenStep: string;
  reason?: string;
  isActive?: boolean;
}

export interface RaciMatrix {
  policy: { id: string; name: string; version: number } | null;
  steps: RaciStep[];
  chineseWallRules: ChineseWallRule[];
}

export interface NewStep {
  stepName: string;
  stepLabel: string;
  phase?: string;
  assignedRole: string;
  order?: number;
  stepType?: string;
  expectedDurationHours?: number;
  maxDurationHours?: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const raciMatrixApi = {
  getMatrix: (): Promise<{ success: boolean; data: RaciMatrix }> =>
    ApiService.get('/raci-matrix'),

  updateStep: (stepId: string, data: Partial<RaciStep>): Promise<{ success: boolean; data: RaciStep }> =>
    ApiService.put(`/raci-matrix/steps/${stepId}`, data),

  updateStepRoles: (stepId: string, roles: RaciStepRole[]): Promise<{ success: boolean; data: RaciStepRole[] }> =>
    ApiService.put(`/raci-matrix/steps/${stepId}/roles`, roles),

  createStep: (data: NewStep): Promise<{ success: boolean; data: RaciStep }> =>
    ApiService.post('/raci-matrix/steps', data),

  deleteStep: (stepId: string): Promise<{ success: boolean }> =>
    ApiService.delete(`/raci-matrix/steps/${stepId}`),

  updateChineseWall: (rules: Omit<ChineseWallRule, 'id' | 'isActive'>[]): Promise<{ success: boolean; data: ChineseWallRule[] }> =>
    ApiService.put('/raci-matrix/chinese-wall', rules),
};
