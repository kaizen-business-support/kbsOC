import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRolePermissions() {
  console.log('🌱 Seeding role permissions...');

  const roles = [
    {
      role: 'ADMIN',
      label: 'Administrateur',
      description: 'Accès complet au système avec toutes les permissions',
      permissions: ['*']
    },
    {
      role: 'MANAGEMENT',
      label: 'Direction Générale',
      description: 'Accès aux rapports et analyses de performance',
      permissions: ['view_all', 'analytics', 'reports', 'user_management']
    },
    {
      role: 'BRANCH_MANAGER',
      label: 'Directeur d\'Agence',
      description: 'Gestion des opérations de l\'agence et approbation des crédits',
      permissions: ['view_branch', 'approve_credit', 'manage_branch']
    },
    {
      role: 'ACCOUNT_MANAGER',
      label: 'Chargé d\'Affaires',
      description: 'Gestion des clients et création de demandes de crédit',
      permissions: ['view_own', 'create_application', 'manage_clients']
    },
    {
      role: 'CREDIT_ANALYST',
      label: 'Analyste Crédit',
      description: 'Analyse et évaluation des demandes de crédit',
      permissions: ['analyze_credit', 'view_applications', 'edit_analysis']
    },
    {
      role: 'CREDIT_COMMITTEE',
      label: 'Comité de Crédit',
      description: 'Membre du comité de crédit pour approbation des montants élevés',
      permissions: ['view_all', 'approve_credit', 'committee_review']
    }
  ];

  for (const roleData of roles) {
    try {
      const existingRole = await prisma.rolePermission.findUnique({
        where: { role: roleData.role as any }
      });

      if (existingRole) {
        await prisma.rolePermission.update({
          where: { role: roleData.role as any },
          data: {
            label: roleData.label,
            description: roleData.description,
            permissions: roleData.permissions
          }
        });
        console.log(`✅ Updated ${roleData.label} permissions`);

        // Update all users with this role
        await prisma.user.updateMany({
          where: { role: roleData.role as any },
          data: { permissions: roleData.permissions }
        });
        console.log(`   └─ Updated all ${roleData.role} users with new permissions`);
      } else {
        await prisma.rolePermission.create({
          data: {
            role: roleData.role as any,
            label: roleData.label,
            description: roleData.description,
            permissions: roleData.permissions
          }
        });
        console.log(`✅ Created ${roleData.label} role`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${roleData.label}:`, error);
    }
  }

  console.log('\n🎉 Role permissions seeding complete!');
  console.log('\n📋 Roles Configuration:');
  console.log('═══════════════════════════════════════════════════════════════════════');
  roles.forEach(role => {
    console.log(`${role.label.padEnd(25)} | ${role.permissions.join(', ')}`);
  });
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

seedRolePermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
