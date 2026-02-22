import { PrismaClient, UserRole, StepType } from '@prisma/client';

const prisma = new PrismaClient();

// Fixed workflow steps (apply to all applications regardless of amount)
const fixedWorkflowSteps = [
  {
    stepName: 'application_created',
    displayName: 'Application Créée',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Création de la demande de crédit par le chargé d\'affaires',
    stepType: 'FIXED' as StepType,
    isActive: true
  },
  {
    stepName: 'credit_analysis',
    displayName: 'Analyse Crédit & Évaluation Risques',
    expectedDuration: 1920, // 4 workdays (32 hours)
    maxDuration: 2880, // 6 workdays
    description: 'Vérification des documents, analyse financière détaillée, évaluation des risques et scoring crédit',
    stepType: 'FIXED' as StepType,
    isActive: true
  },
  {
    stepName: 'final_decision',
    displayName: 'Décision Finale',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Notification de la décision finale au client',
    stepType: 'FIXED' as StepType,
    isActive: true
  },
  {
    stepName: 'contract_preparation',
    displayName: 'Préparation Contrat',
    expectedDuration: 480, // 1 workday (8 hours)
    maxDuration: 1440, // 3 workdays
    description: 'Préparation du contrat de crédit et documents juridiques',
    stepType: 'FIXED' as StepType,
    isActive: true
  },
  {
    stepName: 'disbursement',
    displayName: 'Déblocage',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Déblocage des fonds et finalisation du crédit',
    stepType: 'FIXED' as StepType,
    isActive: true
  }
];

// Approval limits with review durations (these determine dynamic workflow steps)
const approvalLimits = [
  {
    role: 'BRANCH_MANAGER' as UserRole,
    displayName: 'Directeur d\'Agence',
    minAmount: 0,
    maxAmount: 25000000, // 25M XOF
    currency: 'XOF',
    reviewDuration: 480, // 1 workday (8 hours) for branch manager review
    maxReviewDuration: 960, // 2 workdays max
    requiresCommittee: false,
    committeeMinMembers: null,
    description: 'Peut approuver les crédits jusqu\'à 25M XOF',
    isActive: true
  },
  {
    role: 'CREDIT_COMMITTEE' as UserRole,
    displayName: 'Comité de Crédit',
    minAmount: 25000001,
    maxAmount: 100000000, // 100M XOF
    currency: 'XOF',
    reviewDuration: 960, // 2 workdays (16 hours) for committee review
    maxReviewDuration: 1920, // 4 workdays max
    requiresCommittee: true,
    committeeMinMembers: 3,
    description: 'Peut approuver les crédits de 25M à 100M XOF (nécessite un comité de 3 membres minimum)',
    isActive: true
  },
  {
    role: 'MANAGEMENT' as UserRole,
    displayName: 'Direction Générale',
    minAmount: 100000001,
    maxAmount: 500000000, // 500M XOF
    currency: 'XOF',
    reviewDuration: 1440, // 3 workdays (24 hours) for management review
    maxReviewDuration: 2880, // 6 workdays max
    requiresCommittee: true,
    committeeMinMembers: 5,
    description: 'Peut approuver les crédits au-delà de 100M XOF jusqu\'à 500M (nécessite un comité de 5 membres minimum)',
    isActive: true
  }
];

async function seedIntegratedWorkflow() {
  console.log('🌱 Seeding integrated workflow configuration...\n');

  try {
    // Seed fixed workflow steps
    console.log('📋 Seeding fixed workflow steps...');
    for (const step of fixedWorkflowSteps) {
      const existing = await prisma.workflowStepConfig.findUnique({
        where: { stepName: step.stepName }
      });

      if (existing) {
        // Update existing step
        await prisma.workflowStepConfig.update({
          where: { stepName: step.stepName },
          data: step
        });
        console.log(`  ✅ Updated ${step.stepName} - ${step.expectedDuration}min (${step.expectedDuration / 480} workdays)`);
      } else {
        // Create new step
        await prisma.workflowStepConfig.create({
          data: step
        });
        console.log(`  ✅ Created ${step.stepName} - ${step.expectedDuration}min (${step.expectedDuration / 480} workdays)`);
      }
    }

    // Seed approval limits
    console.log('\n💰 Seeding approval limits with review durations...');
    for (const limit of approvalLimits) {
      const existing = await prisma.approvalLimit.findUnique({
        where: { role: limit.role }
      });

      if (existing) {
        // Update existing limit
        await prisma.approvalLimit.update({
          where: { role: limit.role },
          data: limit
        });
        console.log(`  ✅ Updated ${limit.displayName} (${limit.role})`);
        console.log(`     Amount: ${limit.minAmount.toLocaleString()} - ${limit.maxAmount.toLocaleString()} ${limit.currency}`);
        console.log(`     Review: ${limit.reviewDuration}min (${limit.reviewDuration / 480} workdays), Max: ${limit.maxReviewDuration}min`);
      } else {
        // Create new limit
        await prisma.approvalLimit.create({
          data: limit
        });
        console.log(`  ✅ Created ${limit.displayName} (${limit.role})`);
        console.log(`     Amount: ${limit.minAmount.toLocaleString()} - ${limit.maxAmount.toLocaleString()} ${limit.currency}`);
        console.log(`     Review: ${limit.reviewDuration}min (${limit.reviewDuration / 480} workdays), Max: ${limit.maxReviewDuration}min`);
      }
    }

    console.log('\n✅ Integrated workflow configuration seeded successfully!\n');

    console.log('📊 Workflow Logic Summary:');
    console.log('  • Fixed Steps (all applications): application_created → credit_analysis → final_decision → contract_preparation → disbursement');
    console.log('  • Dynamic Approval Steps (based on amount):');
    console.log('    - 0 - 25M XOF: Branch Manager Review (1 day)');
    console.log('    - 25M - 100M XOF: Credit Committee Review (2 days, 3+ members)');
    console.log('    - 100M+ XOF: Management Review (3 days, 5+ members)');
    console.log('  • The approval step is inserted between credit_analysis and final_decision');

  } catch (error) {
    console.error('❌ Error seeding integrated workflow:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedIntegratedWorkflow()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
