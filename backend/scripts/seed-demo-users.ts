import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const demoUsers = [
  {
    id: 'user-1',
    email: 'admin@optimuscredit.com',
    name: 'Administrateur',
    role: 'ADMIN',
    department: 'Informatique',
    jobTitle: 'System Administrator',
    permissions: ['*'],
    isActive: true,
  },
  {
    id: 'user-2',
    email: 'manager@optimuscredit.com',
    name: 'Directeur Général',
    role: 'MANAGEMENT',
    department: 'Direction Générale',
    jobTitle: 'Managing Director',
    permissions: ['view_all', 'analytics', 'reports', 'user_management'],
    isActive: true,
  },
  {
    id: 'user-3',
    email: 'branch@optimuscredit.com',
    name: 'Jean Dupont',
    role: 'BRANCH_MANAGER',
    department: 'Opérations',
    jobTitle: 'Branch Manager',
    permissions: ['view_branch', 'approve_credit'],
    isActive: true,
  },
  {
    id: 'user-4',
    email: 'account@optimuscredit.com',
    name: 'Marie Diallo',
    role: 'ACCOUNT_MANAGER',
    department: 'Opérations',
    jobTitle: 'Account Manager',
    permissions: ['view_own', 'create_application'],
    isActive: true,
  },
  {
    id: 'user-5',
    email: 'analyst@optimuscredit.com',
    name: 'Amadou Ba',
    role: 'CREDIT_ANALYST',
    department: 'Crédit et Risques',
    jobTitle: 'Credit Analyst',
    permissions: ['analyze_credit', 'view_applications'],
    isActive: true,
  },
  {
    id: 'user-6',
    email: 'fatou.seck@optimuscredit.com',
    name: 'Fatou Seck',
    role: 'CREDIT_ANALYST',
    department: 'Crédit et Risques',
    jobTitle: 'Senior Credit Analyst',
    permissions: ['analyze_credit', 'view_applications'],
    isActive: true,
  },
  {
    id: 'user-7',
    email: 'moussa.fall@optimuscredit.com',
    name: 'Moussa Fall',
    role: 'CREDIT_ANALYST',
    department: 'Crédit et Risques',
    jobTitle: 'Credit Analyst',
    permissions: ['analyze_credit', 'view_applications'],
    isActive: true,
  },
  {
    id: 'user-8',
    email: 'aissatou.diop@optimuscredit.com',
    name: 'Aïssatou Diop',
    role: 'CREDIT_ANALYST',
    department: 'Crédit et Risques',
    jobTitle: 'Junior Credit Analyst',
    permissions: ['analyze_credit', 'view_applications'],
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding demo users...');

  const password = 'demo123'; // Default password for all demo users
  const passwordHash = await bcrypt.hash(password, 12);

  for (const user of demoUsers) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (existingUser) {
        console.log(`✅ User ${user.email} already exists, skipping...`);
        continue;
      }

      await prisma.user.create({
        data: {
          ...user,
          passwordHash,
          permissions: user.permissions as any,
          lastLogin: new Date(),
        },
      });

      console.log(`✅ Created user: ${user.email} (${user.name})`);
    } catch (error) {
      console.error(`❌ Error creating user ${user.email}:`, error);
    }
  }

  console.log('✅ Demo users seeding completed!');
  console.log(`📝 Default password for all demo users: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding demo users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
