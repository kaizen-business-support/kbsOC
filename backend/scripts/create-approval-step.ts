import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createApprovalStep() {
  try {
    console.log('Creating branch_manager_review step for APP-2025-000023...');

    // Find the application
    const application = await prisma.creditApplication.findFirst({
      where: { applicationNumber: 'APP-2025-000023' },
      include: { workflowSteps: true }
    });

    if (!application) {
      console.error('Application APP-2025-000023 not found');
      process.exit(1);
    }

    console.log(`Found application: ${application.id}`);
    console.log(`Current steps: ${application.workflowSteps.map(s => s.stepName).join(', ')}`);

    // Check if branch_manager_review step already exists
    const existingStep = application.workflowSteps.find(s => s.stepName === 'branch_manager_review');
    if (existingStep) {
      console.log('branch_manager_review step already exists');
      process.exit(0);
    }

    // Create the step
    const newStep = await prisma.workflowStep.create({
      data: {
        applicationId: application.id,
        stepName: 'branch_manager_review',
        role: 'BRANCH_MANAGER',
        status: 'PENDING',
        createdAt: new Date()
      }
    });

    console.log(`✅ Created branch_manager_review step: ${newStep.id}`);
    console.log('Application is now ready for Branch Manager review');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createApprovalStep();
