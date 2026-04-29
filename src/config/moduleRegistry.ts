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
    key: 'home',
    label: 'Tableau de bord',
    actions: [],
    sections: [],
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
    key: 'credit-application',
    label: 'Demandes de crédit',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'submit', label: 'Soumettre' },
    ],
    sections: [],
  },
  {
    key: 'approvals',
    label: 'Approbations',
    actions: [
      { key: 'approve', label: 'Approuver' },
      { key: 'reject', label: 'Rejeter' },
      { key: 'comment', label: 'Commenter' },
      { key: 'export', label: 'Exporter' },
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
      { key: 'dispatch', label: 'Dispatcher' },
    ],
    sections: [],
  },
  {
    key: 'data-input',
    label: 'Saisie de données financières',
    actions: [
      { key: 'save_draft', label: 'Enregistrer brouillon' },
    ],
    sections: [
      { key: 'balance-sheet', label: 'Bilan' },
      { key: 'income-statement', label: 'Compte de résultat' },
    ],
  },
  {
    key: 'analysis',
    label: 'Analyse financière',
    actions: [
      { key: 'export', label: 'Exporter' },
    ],
    sections: [
      { key: 'ratios', label: 'Ratios' },
      { key: 'benchmarks', label: 'Benchmarks' },
      { key: 'bceao', label: 'Normes BCEAO' },
    ],
  },
  {
    key: 'reports',
    label: 'Rapports',
    actions: [
      { key: 'export', label: 'Exporter' },
      { key: 'print', label: 'Imprimer' },
    ],
    sections: [],
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
      { key: 'compliance', label: 'Conformité' },
    ],
  },
  {
    key: 'credit-scoring',
    label: 'Scoring crédit',
    actions: [],
    sections: [],
  },
  {
    key: 'credit-simulation',
    label: 'Simulation crédit',
    actions: [],
    sections: [],
  },
  {
    key: 'credit-policy',
    label: 'Politique de crédit',
    actions: [
      { key: 'edit_policy', label: 'Modifier la politique' },
      { key: 'activate', label: 'Activer' },
      { key: 'archive', label: 'Archiver' },
    ],
    sections: [],
  },
  {
    key: 'credit-types',
    label: 'Types de crédit',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Supprimer' },
    ],
    sections: [],
  },
  {
    key: 'approval-limits',
    label: "Limites d'approbation",
    actions: [
      { key: 'edit', label: 'Modifier' },
    ],
    sections: [],
  },
  {
    key: 'workflow',
    label: 'Configuration workflow',
    actions: [
      { key: 'edit_workflow', label: 'Modifier le workflow' },
    ],
    sections: [],
  },
  {
    key: 'contract-templates',
    label: 'Modèles de contrats',
    actions: [
      { key: 'upload', label: 'Téléverser' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Supprimer' },
    ],
    sections: [],
  },
  {
    key: 'legal-step',
    label: 'Étape juridique',
    actions: [
      { key: 'validate', label: 'Valider' },
      { key: 'reject', label: 'Rejeter' },
    ],
    sections: [],
  },
  {
    key: 'raci-matrix',
    label: 'Matrice RACI',
    actions: [
      { key: 'edit', label: 'Modifier' },
      { key: 'import', label: 'Importer' },
    ],
    sections: [],
  },
  {
    key: 'user-management',
    label: 'Gestion des utilisateurs',
    actions: [
      { key: 'create_user', label: 'Créer utilisateur' },
      { key: 'edit_user', label: 'Modifier utilisateur' },
      { key: 'reset_password', label: 'Réinitialiser MDP' },
      { key: 'deactivate', label: 'Désactiver' },
    ],
    sections: [
      { key: 'users', label: 'Utilisateurs' },
      { key: 'roles', label: 'Rôles' },
      { key: 'module-profiles', label: 'Profils modules' },
    ],
  },
  {
    key: 'bank-holidays-admin',
    label: 'Jours fériés',
    actions: [
      { key: 'create', label: 'Créer' },
      { key: 'edit', label: 'Modifier' },
      { key: 'delete', label: 'Supprimer' },
    ],
    sections: [],
  },
  {
    key: 'notifications-config',
    label: 'Notifications',
    actions: [
      { key: 'edit', label: 'Configurer' },
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
  // Modules SUPER_ADMIN uniquement (hors tenant)
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
