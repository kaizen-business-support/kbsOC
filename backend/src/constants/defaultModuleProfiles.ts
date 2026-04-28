export interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export interface ModuleProfileData {
  label: string;
  defaultScope: 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES';
  allowedBranches: string[];
  modules: Record<string, ModuleAccess>;
}

const ALL_MODULES: Record<string, ModuleAccess> = {
  home:                  { visible: true, actions: [], sections: [] },
  clients:               { visible: true, actions: ['create','edit','delete','export'], sections: [] },
  'credit-application':  { visible: true, actions: ['create','submit'], sections: [] },
  dispatching:           { visible: true, actions: ['dispatch'], sections: [] },
  approvals:             { visible: true, actions: ['approve','reject','comment','export'], sections: ['pending','history'] },
  workflow:              { visible: true, actions: ['edit_workflow'], sections: [] },
  analytics:             { visible: true, actions: ['export'], sections: ['portfolio','performance','compliance'] },
  'credit-scoring':      { visible: true, actions: [], sections: [] },
  'credit-simulation':   { visible: true, actions: [], sections: [] },
  'data-input':          { visible: true, actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
  analysis:              { visible: true, actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
  reports:               { visible: true, actions: ['export','print'], sections: [] },
  'credit-policy':       { visible: true, actions: ['edit_policy','activate','archive'], sections: [] },
  'credit-types':        { visible: true, actions: ['create','edit','delete'], sections: [] },
  'approval-limits':     { visible: true, actions: ['edit'], sections: [] },
  'contract-templates':  { visible: true, actions: ['upload','edit','delete'], sections: [] },
  'legal-step':          { visible: true, actions: ['validate','reject'], sections: [] },
  'raci-matrix':         { visible: true, actions: ['edit','import'], sections: [] },
  'user-management':     { visible: true, actions: ['create_user','edit_user','reset_password','deactivate'], sections: ['users','roles','module-profiles'] },
  'bank-holidays-admin': { visible: true, actions: ['create','edit','delete'], sections: [] },
  'notifications-config':{ visible: true, actions: ['edit'], sections: [] },
  announcements:         { visible: true, actions: ['create','edit','delete'], sections: [] },
};

function none(overrides: Partial<Record<string, Partial<ModuleAccess>>> = {}): Record<string, ModuleAccess> {
  const base: Record<string, ModuleAccess> = {};
  for (const key of Object.keys(ALL_MODULES)) {
    base[key] = { visible: false, actions: [], sections: [] };
  }
  for (const [key, val] of Object.entries(overrides)) {
    base[key] = { visible: true, actions: [], sections: [], ...val };
  }
  return base;
}

export const DEFAULT_ROLE_PROFILES: Record<string, ModuleProfileData> = {
  CHARGE_AFFAIRES: {
    label: "Chargé d'Affaires",
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:                 {},
      clients:              { actions: ['create','edit'] },
      'credit-application': { actions: ['create','submit'] },
      approvals:            { actions: ['comment'], sections: ['pending'] },
      workflow:             {},
    }),
  },
  ANALYSTE_RISQUES: {
    label: 'Analyste Risques',
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:             {},
      clients:          { actions: ['edit'] },
      approvals:        { actions: ['comment'], sections: ['pending','history'] },
      'data-input':     { actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
      analysis:         { actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
      reports:          { actions: ['export'] },
      'credit-scoring': {},
    }),
  },
  RESPONSABLE_RISQUES: {
    label: 'Responsable Risques',
    defaultScope: 'MULTI_BRANCH',
    allowedBranches: [],
    modules: none({
      home:             {},
      clients:          { actions: ['edit','export'] },
      approvals:        { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      'data-input':     { actions: ['save_draft'], sections: ['balance-sheet','income-statement'] },
      analysis:         { actions: ['export'], sections: ['ratios','benchmarks','bceao'] },
      reports:          { actions: ['export','print'] },
      analytics:        { sections: ['portfolio','performance'] },
      'credit-scoring': {},
    }),
  },
  RESPONSABLE_ENGAGEMENTS: {
    label: 'Responsable Engagements',
    defaultScope: 'MULTI_BRANCH',
    allowedBranches: [],
    modules: none({
      home:            {},
      clients:         { actions: ['export'] },
      approvals:       { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      analytics:       { actions: ['export'], sections: ['portfolio','performance','compliance'] },
      'credit-policy': {},
      workflow:        {},
    }),
  },
  COMITE_CREDIT: {
    label: 'Comité de Crédit',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: none({
      home:            {},
      clients:         { actions: ['export'] },
      approvals:       { actions: ['approve','reject','comment'], sections: ['pending','history'] },
      analytics:       { actions: ['export'], sections: ['portfolio','performance','compliance'] },
      'credit-policy': {},
      workflow:        {},
    }),
  },
  DIRECTION_GENERALE: {
    label: 'Direction Générale',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: { ...ALL_MODULES },
  },
  BACK_OFFICE: {
    label: 'Back Office',
    defaultScope: 'BRANCH_ONLY',
    allowedBranches: [],
    modules: none({
      home:                 {},
      clients:              { actions: ['edit'] },
      workflow:             {},
      'legal-step':         { actions: ['validate','reject'] },
      'contract-templates': { actions: ['upload'] },
    }),
  },
  DIRECTION_JURIDIQUE: {
    label: 'Direction Juridique',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: none({
      home:                 {},
      clients:              { actions: ['export'] },
      'legal-step':         { actions: ['validate','reject'] },
      'contract-templates': { actions: ['upload','edit','delete'] },
      approvals:            { actions: ['comment'], sections: ['history'] },
    }),
  },
  ADMIN: {
    label: 'Administrateur',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: { ...ALL_MODULES },
  },
  SUPER_ADMIN: {
    label: 'Super Administrateur',
    defaultScope: 'ALL_BRANCHES',
    allowedBranches: [],
    modules: { ...ALL_MODULES },
  },
};
