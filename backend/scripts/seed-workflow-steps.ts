import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultStepConfigs = [
  {
    stepName: 'application_created',
    displayName: 'Application Créée',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Création de la demande de crédit par le chargé d\'affaires',
    isActive: true
  },
  {
    stepName: 'credit_analysis',
    displayName: 'Analyse Crédit & Évaluation Risques',
    expectedDuration: 1920, // 4 workdays (32 hours)
    maxDuration: 2880, // 6 workdays
    description: 'Vérification des documents, analyse financière détaillée, évaluation des risques et scoring crédit',
    isActive: true
  },
  {
    stepName: 'branch_manager_review',
    displayName: 'Examen Directeur Agence',
    expectedDuration: 480, // 1 workday (8 hours)
    maxDuration: 960, // 2 workdays
    description: 'Examen et décision du directeur d\'agence (montants ≤ 5M XOF)',
    isActive: true
  },
  {
    stepName: 'credit_committee_review',
    displayName: 'Examen Comité Crédit',
    expectedDuration: 960, // 2 workdays (16 hours)
    maxDuration: 1920, // 4 workdays
    description: 'Examen et décision du comité de crédit (montants > 5M XOF)',
    isActive: true
  },
  {
    stepName: 'final_decision',
    displayName: 'Décision Finale',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Notification de la décision finale au client',
    isActive: true
  },
  {
    stepName: 'contract_preparation',
    displayName: 'Préparation Contrat',
    expectedDuration: 480, // 1 workday (8 hours)
    maxDuration: 1440, // 3 workdays
    description: 'Préparation du contrat de crédit et documents juridiques',
    isActive: true
  },
  {
    stepName: 'disbursement',
    displayName: 'Déblocage',
    expectedDuration: 240, // 0.5 workday (4 hours)
    maxDuration: 480, // 1 workday
    description: 'Déblocage des fonds et finalisation du crédit',
    isActive: true
  }
];

async function seedWorkflowSteps() {
  console.log('🌱 Seeding workflow step configurations...\n');

  try {
    for (const config of defaultStepConfigs) {
      // Check if step config already exists
      const existing = await prisma.workflowStepConfig.findUnique({
        where: { stepName: config.stepName }
      });

      if (existing) {
        console.log(`⏭️  Skipping ${config.stepName} - already exists`);
        continue;
      }

      // Create new step config
      const created = await prisma.workflowStepConfig.create({
        data: config
      });

      console.log(`✅ Created ${config.stepName} - Expected: ${config.expectedDuration}min (${config.expectedDuration / 480} workdays)`);
    }

    console.log('\n✅ Workflow step configurations seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding workflow steps:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedWorkflowSteps()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
