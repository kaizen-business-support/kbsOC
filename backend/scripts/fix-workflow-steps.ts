import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the standard workflow step order
const WORKFLOW_STEP_ORDER = [
  'application_created',
  'credit_analysis',
  'branch_manager_review',
  'credit_committee_review',
  'final_decision'
];

async function fixWorkflowSteps() {
  console.log('🔧 Fixing workflow steps...\n');

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

    for (const app of applications) {
      console.log(`\n📋 Application: ${app.applicationNumber} (${app.id})`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Workflow steps: ${app.workflowSteps.length}`);

      if (app.workflowSteps.length === 0) {
        console.log('   ⚠️  No workflow steps found, skipping...');
        continue;
      }

      // Find the furthest completed step
      let furthestCompletedStepIndex = -1;
      for (const step of app.workflowSteps) {
        const stepIndex = WORKFLOW_STEP_ORDER.indexOf(step.stepName);
        if (step.status === 'COMPLETED' && stepIndex > furthestCompletedStepIndex) {
          furthestCompletedStepIndex = stepIndex;
        }
      }

      console.log(`   📍 Furthest completed step index: ${furthestCompletedStepIndex}`);

      if (furthestCompletedStepIndex === -1) {
        console.log('   ℹ️  No completed steps found, skipping...');
        continue;
      }

      // Mark all prior steps as completed
      let updatedCount = 0;
      for (const step of app.workflowSteps) {
        const stepIndex = WORKFLOW_STEP_ORDER.indexOf(step.stepName);

        // If this step is before the furthest completed step and not yet completed
        if (stepIndex !== -1 && stepIndex < furthestCompletedStepIndex && step.status !== 'COMPLETED') {
          console.log(`   ✅ Marking "${step.stepName}" as COMPLETED`);

          await prisma.workflowStep.update({
            where: { id: step.id },
            data: {
              status: 'COMPLETED',
              completedAt: step.createdAt // Use creation date as completion date for prior steps
            }
          });

          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        console.log(`   ✨ Updated ${updatedCount} workflow steps for ${app.applicationNumber}`);
      } else {
        console.log(`   ✓ All prior steps already completed`);
      }
    }

    console.log('\n✅ Workflow steps fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing workflow steps:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixWorkflowSteps()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
