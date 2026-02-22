import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingApprovalSteps() {
  console.log('🔧 Fixing missing approval steps for applications...');

  // Get all applications that have completed credit analysis but no approval step
  const applications = await prisma.application.findMany({
    where: {
      status: 'UNDER_REVIEW'
    },
    include: {
      workflowSteps: true
    }
  });

  console.log(`Found ${applications.length} applications under review`);

  for (const application of applications) {
    const creditAnalysisStep = application.workflowSteps.find(
      step => step.stepName === 'credit_analysis' && step.status === 'COMPLETED'
    );

    const hasApprovalStep = application.workflowSteps.some(
      step => step.stepName === 'branch_manager_review' ||
              step.stepName === 'credit_committee_review' ||
              step.stepName === 'management_review'
    );

    if (creditAnalysisStep && !hasApprovalStep) {
      console.log(`\n📋 Application ${application.applicationNumber} needs approval step`);

      // Get approval limits
      const approvalLimits = await prisma.approvalLimit.findMany({
        orderBy: { minAmount: 'asc' }
      });

      const amount = Number(application.amount);
      let approvalRole: string | null = null;
      let approvalStepName: string | null = null;

      // Find the appropriate approval level
      for (const limit of approvalLimits) {
        if (amount >= Number(limit.minAmount) && amount <= Number(limit.maxAmount)) {
          approvalRole = limit.role;
          approvalStepName = limit.role === 'BRANCH_MANAGER' ? 'branch_manager_review' :
                            limit.role === 'CREDIT_COMMITTEE' ? 'credit_committee_review' :
                            limit.role === 'MANAGEMENT' ? 'management_review' : null;
          break;
        }
      }

      if (approvalRole && approvalStepName) {
        await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: approvalStepName,
            role: approvalRole as any,
            status: 'PENDING',
            createdAt: new Date()
          }
        });
        console.log(`✅ Created ${approvalStepName} step for ${application.applicationNumber} (Amount: ${amount} XOF)`);
      } else {
        console.warn(`⚠️  No approval limit found for application ${application.applicationNumber} (Amount: ${amount} XOF)`);
      }
    }
  }

  console.log('\n✨ Done!');
}

fixMissingApprovalSteps()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
