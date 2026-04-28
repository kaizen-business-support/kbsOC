export interface ModuleActionDef {
  key: string;
  label: string;
}

export interface ModuleSectionDef {
  key: string;
  label: string;
}

export interface ModuleDef {
  key: string;
  label: string;
  actions: ModuleActionDef[];
  sections: ModuleSectionDef[];
  superAdminOnly?: boolean;
}

export const MODULE_REGISTRY: ModuleDef[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    actions: [],
    sections: [
      { key: 'kpis', label: 'KPIs' },
      { key: 'charts', label: 'Graphiques' },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Supprimer' },
      { key: 'export', label: 'Exporter' },
    ],
    sections: [
      { key: 'documents', label: 'Documents' },
      { key: 'history', label: 'Historique' },
    ],
  },
  {
    key: 'applications',
    label: 'Demandes de crédit',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'submit', label: 'Soumettre' },
      { key: 'delete', label: 'Supprimer' },
      { key: 'export', label: 'Exporter' },
    ],
    sections: [
      { key: 'documents', label: 'Documents' },
      { key: 'guarantees', label: 'Garanties' },
      { key: 'history', label: 'Historique' },
    ],
  },
  {
    key: 'approvals',
    label: 'Approbations',
    actions: [
      { key: 'approve', label: 'Approuver' },
      { key: 'reject', label: 'Rejeter' },
      { key: 'request_info', label: 'Demander info' },
    ],
    sections: [
      { key: 'pending', label: 'En attente' },
      { key: 'history', label: 'Historique' },
    ],
  },
  {
    key: 'dispatching',
    label: 'Dispatching',
    actions: [
      { key: 'assign', label: 'Assigner' },
      { key: 'reassign', label: 'Réassigner' },
    ],
    sections: [],
  },
  {
    key: 'contracts',
    label: 'Contrats',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'sign', label: 'Signer' },
      { key: 'download', label: 'Télécharger' },
    ],
    sections: [
      { key: 'templates', label: 'Modèles' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytiques',
    actions: [
      { key: 'export', label: 'Exporter' },
    ],
    sections: [
      { key: 'portfolio', label: 'Portefeuille' },
      { key: 'performance', label: 'Performance' },
      { key: 'risk', label: 'Risque' },
    ],
  },
  {
    key: 'credit-policy',
    label: 'Politique de crédit',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'activate', label: 'Activer' },
    ],
    sections: [],
  },
  {
    key: 'users',
    label: 'Utilisateurs',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Désactiver' },
      { key: 'reset_password', label: 'Réinitialiser MDP' },
    ],
    sections: [
      { key: 'profiles', label: 'Profils modules' },
      { key: 'audit', label: 'Audit' },
    ],
  },
  {
    key: 'workflow-config',
    label: 'Configuration workflow',
    actions: [
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'approval-limits',
    label: 'Limites d\'approbation',
    actions: [
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'raci-matrix',
    label: 'Matrice RACI',
    actions: [
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'delegations',
    label: 'Délégations',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'revoke', label: 'Révoquer' },
    ],
    sections: [],
  },
  {
    key: 'announcements',
    label: 'Annonces',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Supprimer' },
    ],
    sections: [],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    actions: [
      { key: 'configure', label: 'Configurer' },
    ],
    sections: [
      { key: 'channels', label: 'Canaux' },
      { key: 'templates', label: 'Modèles' },
      { key: 'rules', label: 'Règles' },
    ],
  },
  {
    key: 'audit-logs',
    label: 'Journal d\'audit',
    actions: [
      { key: 'export', label: 'Exporter' },
    ],
    sections: [],
  },
  {
    key: 'branches',
    label: 'Agences',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'departments',
    label: 'Départements',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'credit-types',
    label: 'Types de crédit',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'backup',
    label: 'Sauvegarde',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'restore', label: 'Restaurer' },
    ],
    sections: [],
    superAdminOnly: true,
  },
  {
    key: 'platform-admin',
    label: 'Administration plateforme',
    actions: [
      { key: 'manage_tenants', label: 'Gérer les tenants' },
      { key: 'manage_plans', label: 'Gérer les plans' },
    ],
    sections: [],
    superAdminOnly: true,
  },
];

export const TENANT_MODULES = MODULE_REGISTRY.filter(m => !m.superAdminOnly);

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULE_REGISTRY.find(m => m.key === key);
}
