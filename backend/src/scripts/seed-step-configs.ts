import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting workflow step configurations seeding...');

  // Default step configurations based on typical banking workflow
  const stepConfigs = [
    {
      stepName: 'Application Créée',
      displayName: 'Création de la demande',
      expectedDuration: 30, // 30 minutes
      maxDuration: 120, // 2 hours
      description: 'Temps nécessaire pour créer et soumettre une nouvelle demande de crédit'
    },
    {
      stepName: 'Vérification Documents',
      displayName: 'Vérification des documents',
      expectedDuration: 120, // 2 hours
      maxDuration: 480, // 8 hours
      description: 'Temps pour vérifier la conformité et la complétude des documents fournis'
    },
    {
      stepName: 'Analyse Crédit',
      displayName: 'Analyse de crédit',
      expectedDuration: 480, // 8 hours (1 jour ouvrable)
      maxDuration: 1440, // 24 hours (3 jours ouvrables)
      description: 'Temps pour l\'analyse financière et l\'évaluation du risque de crédit'
    },
    {
      stepName: 'Évaluation Risques',
      displayName: 'Évaluation des risques',
      expectedDuration: 240, // 4 hours
      maxDuration: 720, // 12 hours
      description: 'Temps pour l\'évaluation approfondie des risques et la notation'
    },
    {
      stepName: 'Examen Directeur Agence',
      displayName: 'Validation directeur d\'agence',
      expectedDuration: 120, // 2 hours
      maxDuration: 480, // 8 hours
      description: 'Temps pour la validation par le directeur d\'agence'
    },
    {
      stepName: 'Examen Comité Crédit',
      displayName: 'Validation comité de crédit',
      expectedDuration: 180, // 3 hours
      maxDuration: 720, // 12 hours
      description: 'Temps pour la décision finale du comité de crédit (montants importants)'
    }
  ];

  // Clear existing configurations
  await prisma.workflowStepConfig.deleteMany();

  // Insert new configurations
  const createdConfigs = await Promise.all(
    stepConfigs.map(config => 
      prisma.workflowStepConfig.create({ data: config })
    )
  );

  console.log('✅ Workflow step configurations seeding completed!');
  console.log('📊 Summary:');
  console.log(`   - Step configurations created: ${createdConfigs.length}`);
  console.log('🔧 Default expected durations:');
  stepConfigs.forEach(config => {
    const hours = config.expectedDuration >= 60 ? `${Math.floor(config.expectedDuration / 60)}h` : '';
    const minutes = config.expectedDuration % 60 > 0 ? `${config.expectedDuration % 60}min` : '';
    const duration = hours && minutes ? `${hours} ${minutes}` : hours || minutes;
    console.log(`   - ${config.displayName}: ${duration} (max: ${Math.floor(config.maxDuration / 60)}h)`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error during step configurations seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });