import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkApplication() {
  try {
    const application = await prisma.creditApplication.findFirst({
      where: { applicationNumber: 'APP-2025-000022' },
      include: {
        client: true,
        creator: true,
        workflowSteps: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!application) {
      console.log('Application not found');
      return;
    }

    console.log('\n=== Application Details ===');
    console.log('Application Number:', application.applicationNumber);
    console.log('Client:', application.client.companyName);
    console.log('Amount:', application.amount);
    console.log('Currency:', application.currency);
    console.log('Duration (months):', application.durationMonths);
    console.log('Proposed Rate:', application.proposedRate);
    console.log('Credit Type:', application.creditType);
    console.log('Collateral Type:', application.collateralType);
    console.log('Collateral Value:', application.collateralValue);
    console.log('Repayment Schedule:', application.repaymentSchedule);
    console.log('Purpose:', application.purpose);
    console.log('Status:', application.status);
    console.log('\n=== Workflow Steps ===');
    application.workflowSteps.forEach(step => {
      console.log(`- ${step.stepName}: ${step.status}`);
      if (step.comments) {
        console.log(`  Comments: ${step.comments.substring(0, 100)}${step.comments.length > 100 ? '...' : ''}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkApplication();
