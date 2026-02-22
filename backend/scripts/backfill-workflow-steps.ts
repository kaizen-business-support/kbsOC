import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the workflow step order
const WORKFLOW_STEP_ORDER = [
  { name: 'application_created', role: 'ACCOUNT_MANAGER' },
  { name: 'credit_analysis', role: 'CREDIT_ANALYST' }
];

async function backfillWorkflowSteps() {
  console.log('🔧 Backfilling missing workflow steps...\n');

  try {
    // Get all applications with workflow steps
    const applications = await prisma.creditApplication.findMany({
      include: {
        workflowSteps: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    console.log(`📊 Found ${applications.length} applications\n`);

    let totalCreated = 0;
    let totalCompleted = 0;

    for (const app of applications) {
      console.log(`\n📋 Application: ${app.applicationNumber} (${app.id})`);
      console.log(`   Status: ${app.status}`);

      if (app.workflowSteps.length === 0) {
        console.log('   ⚠️  No workflow steps found, skipping...');
        continue;
      }

      // Create a map of existing steps
      const existingSteps = new Map(
        app.workflowSteps.map(step => [step.stepName, step])
      );

      // Find the furthest completed step
      let furthestCompletedStepIndex = -1;
      for (const step of app.workflowSteps) {
        const stepIndex = WORKFLOW_STEP_ORDER.findIndex(s => s.name === step.stepName);
        if (step.status === 'COMPLETED' && stepIndex > furthestCompletedStepIndex) {
          furthestCompletedStepIndex = stepIndex;
        }
      }

      console.log(`   📍 Furthest completed step index: ${furthestCompletedStepIndex}`);

      if (furthestCompletedStepIndex === -1) {
        console.log('   ℹ️  No completed steps found, skipping...');
        continue;
      }

      // Create and complete all prior steps if they don't exist
      const now = new Date();
      let createdCount = 0;
      let completedCount = 0;

      for (let i = 0; i < furthestCompletedStepIndex; i++) {
        const stepConfig = WORKFLOW_STEP_ORDER[i];

        if (!existingSteps.has(stepConfig.name)) {
          console.log(`   📝 Creating missing step: ${stepConfig.name}`);
          await prisma.workflowStep.create({
            data: {
              applicationId: app.id,
              stepName: stepConfig.name,
              role: stepConfig.role as any,
              assigneeId: app.createdBy,
              status: 'COMPLETED',
              completedAt: now,
              createdAt: app.createdAt // Use app creation date for consistency
            }
          });
          createdCount++;
          totalCreated++;
        } else {
          // Mark existing prior steps as completed if not already
          const existingStep = existingSteps.get(stepConfig.name)!;
          if (existingStep.status !== 'COMPLETED') {
            console.log(`   ✅ Completing prior step: ${stepConfig.name}`);
            await prisma.workflowStep.update({
              where: { id: existingStep.id },
              data: {
                status: 'COMPLETED',
                completedAt: now
              }
            });
            completedCount++;
            totalCompleted++;
          }
        }
      }

      if (createdCount > 0 || completedCount > 0) {
        console.log(`   ✨ Created ${createdCount} steps, completed ${completedCount} steps`);
      } else {
        console.log(`   ✓ All prior steps already exist and are completed`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Backfill completed successfully!`);
    console.log(`   Total steps created: ${totalCreated}`);
    console.log(`   Total steps completed: ${totalCompleted}`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('❌ Error backfilling workflow steps:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillWorkflowSteps()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
