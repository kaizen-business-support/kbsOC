const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Clés alignées avec PERMISSION_GROUPS dans UserManagementPage.tsx
const roles = [
  {
    role: 'ACCOUNT_MANAGER',
    label: 'Chargé d\'Affaires',
    description: 'Gère les relations clients et soumet les demandes de crédit',
    permissions: [
      'view_applications', 'view_own',
      'create_application', 'review_applications',
      'create_client', 'edit_client_data', 'manage_clients',
      'financial_analysis',
    ]
  },
  {
    role: 'CREDIT_ANALYST',
    label: 'Analyste Crédit',
    description: 'Analyse les dossiers de crédit et produit les rapports d\'analyse',
    permissions: [
      'view_applications', 'view_branch',
      'analyze_credit', 'financial_analysis',
      'score_applications', 'benchmark_analysis', 'edit_analysis',
      'review_applications', 'application_review',
    ]
  },
  {
    role: 'ANALYST_SUPERVISOR',
    label: 'Responsable Analyste',
    description: 'Supervise les analystes, dispatche les dossiers et valide les analyses',
    permissions: [
      'view_applications', 'view_all',
      'analyze_credit', 'financial_analysis',
      'review_applications', 'application_review', 'edit_analysis',
      'dispatch_applications', 'assign_analyst', 'view_analyst_workload',
      'manage_team',
    ]
  },
  {
    role: 'BRANCH_MANAGER',
    label: 'Directeur d\'Agence',
    description: 'Supervise les opérations de l\'agence et approuve les dossiers de son périmètre',
    permissions: [
      'view_applications', 'view_branch',
      'approve_credit', 'approve_applications',
      'workflow_override', 'manage_branch', 'manage_team',
      'analytics', 'reports',
      'manage_clients',
    ]
  },
  {
    role: 'CREDIT_COMMITTEE',
    label: 'Comité de Crédit',
    description: 'Prend les décisions finales sur les demandes de crédit importantes',
    permissions: [
      'view_applications', 'view_all',
      'approve_applications', 'committee_review', 'committee_vote',
      'final_approval', 'risk_override',
      'analytics', 'reports', 'risk_reporting',
    ]
  },
  {
    role: 'MANAGEMENT',
    label: 'Direction Générale',
    description: 'Accès aux tableaux de bord exécutifs et supervision globale',
    permissions: [
      'view_applications', 'view_all', 'view_portfolio',
      'analytics', 'reports', 'portfolio_analytics',
      'risk_reporting', 'data_export',
    ]
  },
  {
    role: 'ADMIN',
    label: 'Administrateur Système',
    description: 'Accès complet au système, gestion des utilisateurs et configuration',
    permissions: [
      // Administration
      'user_management', 'role_assignment', 'system_administration',
      'system_configuration', 'audit_logs', 'data_export',
      // Notifications & Annonces
      'manage_notifications', 'manage_announcements',
      // Sauvegarde & Sécurité
      'manage_backup', 'manage_2fa_config',
      // Visibilité
      'view_all', 'view_branch', 'view_own', 'view_applications', 'view_portfolio',
      // Analytiques
      'analytics', 'reports', 'portfolio_analytics', 'risk_reporting', 'policy_configuration',
      // Clients
      'create_client', 'edit_client_data', 'manage_clients',
      // Demandes
      'create_application', 'review_applications', 'application_review',
      'analyze_credit', 'financial_analysis', 'score_applications',
      'benchmark_analysis', 'edit_analysis',
      // Approbations
      'approve_credit', 'approve_applications', 'committee_review',
      'committee_vote', 'final_approval', 'risk_override', 'policy_exceptions',
      // Agence
      'manage_branch', 'manage_team', 'workflow_override',
      // Dispatching
      'dispatch_applications', 'assign_analyst', 'view_analyst_workload',
    ]
  }
];

async function main() {
  console.log('Mise à jour des permissions des rôles...');
  for (const roleData of roles) {
    // upsert : crée si absent, met à jour si existant
    await prisma.rolePermission.upsert({
      where:  { role: roleData.role },
      update: { label: roleData.label, description: roleData.description, permissions: roleData.permissions },
      create: { role: roleData.role, label: roleData.label, description: roleData.description, permissions: roleData.permissions }
    });

    // Propager les permissions à tous les utilisateurs de ce rôle
    const { count } = await prisma.user.updateMany({
      where: { role: roleData.role },
      data:  { permissions: roleData.permissions }
    });

    console.log(`  ${roleData.label} (${roleData.permissions.length} permissions) → ${count} utilisateur(s) mis à jour`);
  }
  console.log('✓ Terminé');
}

main().catch(console.error).finally(() => prisma.$disconnect());
