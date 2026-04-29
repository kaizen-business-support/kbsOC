// keep in sync with src/utils/derivePermissions.ts (frontend copy)

export interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export const MODULE_ACTION_TO_PERMISSIONS: Record<string, string[]> = {
  // ── Visibilité de module ──────────────────────────────────────────────
  'clients.visible':               ['view_client', 'manage_clients'],
  'credit-application.visible':    ['view_applications'],
  'approvals.visible':             ['view_applications', 'application_review'],
  'analytics.visible':             ['analytics', 'portfolio_analytics'],
  'reports.visible':               ['reports'],
  'dispatching.visible':           ['dispatch_applications', 'view_analyst_workload'],
  'data-input.visible':            ['financial_analysis'],
  'analysis.visible':              ['analyze_credit', 'benchmark_analysis'],
  'user-management.visible':       ['user_management'],
  'credit-policy.visible':         ['policy_configuration'],
  'credit-scoring.visible':        ['score_applications'],
  'raci-matrix.visible':           ['manage_branch'],
  'notifications-config.visible':  ['manage_notifications'],
  'announcements.visible':         ['manage_announcements'],
  'contract-templates.visible':    ['view_contracts'],
  'legal-step.visible':            ['view_contracts'],

  // ── Actions clients ───────────────────────────────────────────────────
  'clients.actions.create':        ['create_client'],
  'clients.actions.edit':          ['edit_client_data'],
  'clients.actions.delete':        ['manage_clients'],
  'clients.actions.export':        ['data_export'],

  // ── Actions demandes de crédit ────────────────────────────────────────
  'credit-application.actions.create': ['create_application'],
  'credit-application.actions.submit': ['create_application'],

  // ── Actions approbations ──────────────────────────────────────────────
  'approvals.actions.approve':     ['approve_credit', 'approve_applications',
                                    'committee_review', 'committee_vote', 'final_approval'],
  'approvals.actions.reject':      ['approve_credit', 'risk_override'],
  'approvals.actions.comment':     ['review_applications'],
  'approvals.actions.export':      ['data_export'],
  'approvals.sections.history':    ['audit_logs'],

  // ── Analytics ─────────────────────────────────────────────────────────
  'analytics.actions.export':      ['data_export'],
  'analytics.sections.portfolio':  ['view_portfolio'],
  'analytics.sections.compliance': ['risk_reporting'],

  // ── Analyse financière ────────────────────────────────────────────────
  'data-input.actions.save_draft': ['edit_analysis'],
  'analysis.actions.export':       ['data_export'],

  // ── Rapports ──────────────────────────────────────────────────────────
  'reports.actions.export':        ['data_export'],
  // reports.actions.print : purement UI (rendu navigateur), pas de permission backend

  // ── Administration ────────────────────────────────────────────────────
  'user-management.actions.create_user':    ['role_assignment'],
  'user-management.actions.edit_user':      ['user_management'],
  'user-management.actions.reset_password': ['system_configuration'],
  'user-management.actions.deactivate':     ['user_management'],
  'user-management.sections.roles':         ['role_assignment'],
  'bank-holidays-admin.visible':            ['system_configuration'],
  'notifications-config.actions.edit':      ['manage_notifications'],
  'announcements.actions.create':           ['manage_announcements'],
  'announcements.actions.edit':             ['manage_announcements'],
  'announcements.actions.delete':           ['manage_announcements'],

  // ── Politique de crédit ───────────────────────────────────────────────
  'credit-policy.actions.edit_policy': ['policy_configuration', 'policy_exceptions'],
  'credit-policy.actions.activate':    ['policy_configuration'],
  'credit-policy.actions.archive':     ['policy_configuration'],

  // ── Workflow & équipe ─────────────────────────────────────────────────
  // workflow.visible : accès lecture public pour tout user authentifié du tenant
  'workflow.actions.edit_workflow':    ['manage_branch', 'workflow_override'],
  'raci-matrix.actions.edit':          ['manage_team'],
  'raci-matrix.actions.import':        ['manage_team'],
  'dispatching.actions.dispatch':      ['dispatch_applications', 'assign_analyst'],

  // ── Juridique & contrats ──────────────────────────────────────────────
  'legal-step.actions.validate':       ['manage_contract_templates'],
  'legal-step.actions.reject':         ['manage_contract_templates'],
  'contract-templates.actions.upload': ['manage_contract_templates', 'generate_contracts'],
  'contract-templates.actions.edit':   ['manage_contract_templates', 'generate_contracts'],
  'contract-templates.actions.delete': ['manage_contract_templates'],

  // ── Modules intentionnellement sans mapping backend ───────────────────
  // home, credit-simulation, credit-types, approval-limits : display-only ou
  // visibilité déjà couverte par user-management.visible
};

// Permissions ADMIN/SUPER_ADMIN only (attribuées via ['*'], jamais via le mapping)
// manage_backup, manage_2fa_config, system_administration

export const SCOPE_TO_PERMISSIONS: Record<string, string[]> = {
  BRANCH_ONLY:  ['view_own', 'view_branch'],
  MULTI_BRANCH: ['view_branch'],
  ALL_BRANCHES: ['view_all', 'view_branch'],
};

export function derivePermissions(
  modules: Record<string, ModuleAccess>,
  defaultScope: string
): string[] {
  const perms = new Set<string>();

  (SCOPE_TO_PERMISSIONS[defaultScope] ?? []).forEach(p => perms.add(p));

  for (const [moduleKey, access] of Object.entries(modules)) {
    if (!access.visible) continue;

    MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.visible`]
      ?.forEach(p => perms.add(p));

    for (const action of access.actions) {
      MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.actions.${action}`]
        ?.forEach(p => perms.add(p));
    }

    for (const section of access.sections) {
      MODULE_ACTION_TO_PERMISSIONS[`${moduleKey}.sections.${section}`]
        ?.forEach(p => perms.add(p));
    }
  }

  return Array.from(perms);
}
