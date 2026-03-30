const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const roles = [
  {
    role: 'ACCOUNT_MANAGER',
    label: 'Chargé d\'Affaires',
    description: 'Gère les relations clients et soumet les demandes de crédit',
    permissions: ['view_applications', 'create_application', 'edit_own_application', 'view_clients', 'create_client', 'edit_client', 'view_documents', 'upload_documents']
  },
  {
    role: 'CREDIT_ANALYST',
    label: 'Analyste Crédit',
    description: 'Analyse les dossiers de crédit et produit les rapports d\'analyse',
    permissions: ['view_applications', 'edit_application', 'view_clients', 'view_documents', 'upload_documents', 'view_financial_data', 'edit_financial_data', 'view_workflow', 'edit_workflow_step']
  },
  {
    role: 'ANALYST_SUPERVISOR',
    label: 'Responsable Analyste',
    description: 'Supervise les analystes, dispatche les dossiers et valide les analyses',
    permissions: ['view_applications', 'edit_application', 'view_clients', 'view_documents', 'upload_documents', 'view_financial_data', 'edit_financial_data', 'view_workflow', 'edit_workflow_step', 'dispatch_applications', 'view_dispatching', 'view_all_analysts', 'reassign_analyst']
  },
  {
    role: 'BRANCH_MANAGER',
    label: 'Directeur d\'Agence',
    description: 'Supervise les opérations de l\'agence et approuve les dossiers de son périmètre',
    permissions: ['view_applications', 'edit_application', 'approve_application', 'view_clients', 'edit_client', 'view_documents', 'view_workflow', 'view_analytics', 'view_branch_reports']
  },
  {
    role: 'CREDIT_COMMITTEE',
    label: 'Comité de Crédit',
    description: 'Prend les décisions finales sur les demandes de crédit importantes',
    permissions: ['view_applications', 'approve_application', 'reject_application', 'view_clients', 'view_documents', 'view_financial_data', 'view_workflow', 'view_analytics', 'view_all_reports']
  },
  {
    role: 'MANAGEMENT',
    label: 'Direction Générale',
    description: 'Accès aux tableaux de bord exécutifs et supervision globale',
    permissions: ['view_applications', 'view_clients', 'view_documents', 'view_workflow', 'view_analytics', 'view_all_reports', 'view_kpis', 'export_reports']
  },
  {
    role: 'ADMIN',
    label: 'Administrateur Système',
    description: 'Accès complet au système, gestion des utilisateurs et configuration',
    permissions: ['view_applications', 'create_application', 'edit_application', 'approve_application', 'reject_application', 'delete_application', 'view_clients', 'create_client', 'edit_client', 'delete_client', 'view_documents', 'upload_documents', 'delete_documents', 'view_financial_data', 'edit_financial_data', 'view_workflow', 'edit_workflow_step', 'dispatch_applications', 'view_dispatching', 'view_all_analysts', 'reassign_analyst', 'view_analytics', 'view_all_reports', 'view_kpis', 'export_reports', 'manage_users', 'manage_roles', 'manage_branches', 'system_settings']
  }
];

async function main() {
  console.log('Seeding role permissions...');
  for (const roleData of roles) {
    const existing = await prisma.rolePermission.findUnique({ where: { role: roleData.role } });
    if (!existing) {
      await prisma.rolePermission.create({ data: roleData });
      console.log(`  Created: ${roleData.label}`);
    } else {
      console.log(`  Already exists: ${roleData.label}`);
    }
  }
  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
