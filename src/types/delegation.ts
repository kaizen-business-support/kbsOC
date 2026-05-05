export type DelegatableAction =
  | 'APPROVE_WORKFLOW'
  | 'REJECT_WORKFLOW'
  | 'DISPATCH_APPLICATION'
  | 'START_STEP';

export const DELEGATION_ACTION_LABELS: Record<DelegatableAction, string> = {
  APPROVE_WORKFLOW:     "Approuver un dossier",
  REJECT_WORKFLOW:      "Rejeter un dossier",
  DISPATCH_APPLICATION: "Dispatcher un dossier à un analyste",
  START_STEP:           "Démarrer une étape d'analyse",
};

export interface DelegationUser {
  id:     string;
  name:   string;
  role:   string;
  branch: string | null;
}

export interface PowerDelegation {
  id:          string;
  delegatorId: string;
  delegateId:  string;
  startDate:   string;
  endDate:     string;
  reason:      string | null;
  permissions: DelegatableAction[];
  isActive:    boolean;
  revokedAt:   string | null;
  createdAt:   string;
  delegator:   DelegationUser;
  delegate:    DelegationUser;
  createdBy:   { id: string; name: string };
  revokedBy:   { id: string; name: string } | null;
}

export interface CreateDelegationPayload {
  delegatorId: string;
  delegateId:  string;
  startDate:   string; // ISO
  endDate:     string; // ISO
  reason?:     string;
  permissions: DelegatableAction[];
}
