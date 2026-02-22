import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function seedUsersWithPasswords() {
  console.log('🌱 Seeding users with hashed passwords...');

  // Define demo users with their passwords
  const users = [
    {
      id: 'user-1',
      email: 'admin@optimuscredit.com',
      name: 'Administrateur',
      role: 'ADMIN',
      department: 'Informatique',
      jobTitle: 'System Administrator',
      password: 'admin123',
      permissions: ['*']
    },
    {
      id: 'user-2',
      email: 'manager@optimuscredit.com',
      name: 'Directeur Général',
      role: 'MANAGEMENT',
      department: 'Direction Générale',
      jobTitle: 'Managing Director',
      password: 'manager123',
      permissions: ['view_all', 'analytics', 'reports', 'user_management']
    },
    {
      id: 'user-3',
      email: 'branch@optimuscredit.com',
      name: 'Jean Dupont',
      role: 'BRANCH_MANAGER',
      department: 'Opérations',
      jobTitle: 'Branch Manager',
      password: 'branch123',
      permissions: ['view_branch', 'approve_credit']
    },
    {
      id: 'user-4',
      email: 'account@optimuscredit.com',
      name: 'Marie Diallo',
      role: 'ACCOUNT_MANAGER',
      department: 'Opérations',
      jobTitle: 'Account Manager',
      password: 'account123',
      permissions: ['view_own', 'create_application']
    },
    {
      id: 'user-5',
      email: 'analyst@optimuscredit.com',
      name: 'Amadou Ba',
      role: 'CREDIT_ANALYST',
      department: 'Crédit et Risques',
      jobTitle: 'Credit Analyst',
      password: 'analyst123',
      permissions: ['analyze_credit', 'view_applications']
    },
    {
      id: 'user-6',
      email: 'fatou.seck@optimuscredit.com',
      name: 'Fatou Seck',
      role: 'CREDIT_ANALYST',
      department: 'Crédit et Risques',
      jobTitle: 'Senior Credit Analyst',
      password: 'analyst123',
      permissions: ['analyze_credit', 'view_applications']
    },
    {
      id: 'user-7',
      email: 'moussa.fall@optimuscredit.com',
      name: 'Moussa Fall',
      role: 'CREDIT_ANALYST',
      department: 'Crédit et Risques',
      jobTitle: 'Credit Analyst',
      password: 'analyst123',
      permissions: ['analyze_credit', 'view_applications']
    },
    {
      id: 'user-8',
      email: 'aissatou.diop@optimuscredit.com',
      name: 'Aïssatou Diop',
      role: 'CREDIT_ANALYST',
      department: 'Crédit et Risques',
      jobTitle: 'Junior Credit Analyst',
      password: 'analyst123',
      permissions: ['analyze_credit', 'view_applications']
    }
  ];

  for (const user of users) {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      // Hash the password
      const passwordHash = await hashPassword(user.password);

      if (existingUser) {
        // Update existing user with hashed password
        await prisma.user.update({
          where: { email: user.email },
          data: {
            passwordHash,
            name: user.name,
            role: user.role as any,
            department: user.department,
            jobTitle: user.jobTitle,
            permissions: user.permissions,
            isActive: true
          }
        });
        console.log(`✅ Updated ${user.name} (${user.email}) with password: ${user.password}`);
      } else {
        // Create new user
        await prisma.user.create({
          data: {
            email: user.email,
            passwordHash,
            name: user.name,
            role: user.role as any,
            department: user.department,
            jobTitle: user.jobTitle,
            permissions: user.permissions,
            isActive: true
          }
        });
        console.log(`✅ Created ${user.name} (${user.email}) with password: ${user.password}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${user.email}:`, error);
    }
  }

  console.log('\n🎉 User seeding complete!');
  console.log('\n📝 Demo Credentials:');
  console.log('═══════════════════════════════════════════════════════════');
  users.forEach(user => {
    console.log(`${user.role.padEnd(20)} | ${user.email.padEnd(35)} | ${user.password}`);
  });
  console.log('═══════════════════════════════════════════════════════════\n');
}

seedUsersWithPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
