import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { triggerNotification } from '../services/notificationService';

const router = Router();

// GET /api/workflows - Get workflow data with filters and role-based filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, branch, dateFrom, dateTo, userId, userRole } = req.query;

    // Build filter conditions
    const whereConditions: any = {};

    if (status && status !== 'all') {
      whereConditions.status = (status as string).toUpperCase();
    }

    if (branch && branch !== 'all') {
      whereConditions.client = {
        creator: {
          department: branch as string
        }
      };
    }

    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) {
        whereConditions.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        whereConditions.createdAt.lte = new Date(dateTo as string);
      }
    }

    if (userId) {
      whereConditions.createdBy = userId as string;
    }

    // Fetch all applications first
    const workflows = await prisma.creditApplication.findMany({
      where: whereConditions,
      include: {
        client: {
          include: {
            creator: true
          }
        },
        creator: true,
        workflowSteps: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignee: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Role-based filtering: Show only applications pending review for the user's role
    let filteredWorkflows = workflows;

    if (userRole && userRole !== 'ADMIN' && userRole !== 'all') {
      const role = userRole as string;

      // Get approval limits to determine which amounts each role reviews
      const approvalLimits = await prisma.approvalLimit.findMany({
        where: { isActive: true },
        orderBy: { minAmount: 'asc' }
      });

      filteredWorkflows = workflows.filter(workflow => {
        // Find the current pending workflow step
        const currentStep = workflow.workflowSteps.find(step => !step.completedAt);

        // Find the last completed step
        const completedSteps = workflow.workflowSteps.filter(step => step.completedAt);
        const lastCompletedStep = completedSteps.length > 0
          ? completedSteps[completedSteps.length - 1]
          : null;

        // Role-specific filtering
        switch (role) {
          case 'CREDIT_ANALYST':
            // Show applications pending credit analysis
            return currentStep?.stepName === 'credit_analysis';

          case 'BRANCH_MANAGER':
            // Show applications where credit analysis is complete and amount falls in branch manager range
            const branchManagerLimit = approvalLimits.find(l => l.role === 'BRANCH_MANAGER');
            if (!branchManagerLimit) return false;

            const amount = Number(workflow.amount);
            const isInRange = amount >= Number(branchManagerLimit.minAmount) &&
                             amount <= Number(branchManagerLimit.maxAmount);

            // Case 1: There's a pending approval step (not credit analysis)
            if (currentStep &&
                currentStep.stepName !== 'credit_analysis' &&
                currentStep.stepName !== 'application_created' &&
                workflow.status === 'UNDER_REVIEW' &&
                isInRange) {
              return true;
            }

            // Case 2: No pending step, but credit analysis just completed and awaiting branch manager review
            if (!currentStep &&
                lastCompletedStep?.stepName === 'credit_analysis' &&
                workflow.status === 'UNDER_REVIEW' &&
                isInRange) {
              return true;
            }

            return false;

          case 'CREDIT_COMMITTEE':
            // Show applications where amount falls in credit committee range
            const committeeLimit = approvalLimits.find(l => l.role === 'CREDIT_COMMITTEE');
            if (!committeeLimit) return false;

            const committeeAmount = Number(workflow.amount);
            const committeeInRange = committeeAmount >= Number(committeeLimit.minAmount) &&
                                    committeeAmount <= Number(committeeLimit.maxAmount);

            // Case 1: There's a pending approval step
            if (currentStep &&
                currentStep.stepName !== 'credit_analysis' &&
                currentStep.stepName !== 'application_created' &&
                workflow.status === 'UNDER_REVIEW' &&
                committeeInRange) {
              return true;
            }

            // Case 2: No pending step, but credit analysis just completed
            if (!currentStep &&
                lastCompletedStep?.stepName === 'credit_analysis' &&
                workflow.status === 'UNDER_REVIEW' &&
                committeeInRange) {
              return true;
            }

            return false;

          case 'MANAGEMENT':
            // Show applications where amount falls in management range
            const mgmtLimit = approvalLimits.find(l => l.role === 'MANAGEMENT');
            if (!mgmtLimit) return false;

            const mgmtAmount = Number(workflow.amount);
            const mgmtInRange = mgmtAmount >= Number(mgmtLimit.minAmount);

            // Case 1: There's a pending approval step
            if (currentStep &&
                currentStep.stepName !== 'credit_analysis' &&
                currentStep.stepName !== 'application_created' &&
                workflow.status === 'UNDER_REVIEW' &&
                mgmtInRange) {
              return true;
            }

            // Case 2: No pending step, but credit analysis just completed
            if (!currentStep &&
                lastCompletedStep?.stepName === 'credit_analysis' &&
                workflow.status === 'UNDER_REVIEW' &&
                mgmtInRange) {
              return true;
            }

            return false;

          case 'ACCOUNT_MANAGER':
            // Show applications created by this user
            return workflow.createdBy === userId;

          default:
            return true;
        }
      });
    }

    // Transform to match frontend WorkflowTimestamps interface
    const workflowData = filteredWorkflows.map(workflow => ({
      applicationId: workflow.id,
      clientId: workflow.clientId,
      clientName: workflow.client.companyName,
      applicationNumber: workflow.applicationNumber,
      requestedAmount: Number(workflow.amount),
      currency: workflow.currency || 'XOF',
      totalStartedAt: workflow.createdAt.toISOString(),
      totalCompletedAt: (workflow.status === 'APPROVED' || workflow.status === 'REJECTED') 
        ? workflow.updatedAt.toISOString() 
        : undefined,
      totalDuration: workflow.status === 'APPROVED' || workflow.status === 'REJECTED'
        ? workflow.updatedAt.getTime() - workflow.createdAt.getTime()
        : undefined,
      currentStepId: workflow.workflowSteps.find(step => !step.completedAt)?.stepName || 'final_decision',
      finalDecision: workflow.status === 'APPROVED' ? 'approved' : 
                    workflow.status === 'REJECTED' ? 'rejected' : undefined,
      steps: workflow.workflowSteps.map(step => ({
        stepId: step.stepName as any, // Map to WorkflowStepId
        stepName: step.stepName,
        startedAt: step.createdAt.toISOString(),
        completedAt: step.completedAt?.toISOString(),
        duration: step.completedAt 
          ? step.completedAt.getTime() - step.createdAt.getTime()
          : undefined,
        userId: step.assigneeId || undefined,
        userName: step.assignee?.name || undefined,
        userRole: step.assignee?.role || undefined,
        branch: workflow.client.creator.department || 'Non spécifié',
        decision: step.status === 'APPROVED' ? 'approved' : 
                 step.status === 'REJECTED' ? 'rejected' : 
                 step.status === 'PENDING' ? 'pending' : 'on_hold',
        comments: step.comments || undefined
      })),
      createdBy: workflow.createdBy,
      createdByName: workflow.creator.name,
      branch: workflow.client.creator.department || 'Non spécifié',
      status: workflow.status === 'APPROVED' ? 'approved' :
              workflow.status === 'REJECTED' ? 'rejected' :
              workflow.status === 'UNDER_REVIEW' ? 'in_progress' :
              workflow.status === 'SUBMITTED' ? 'in_progress' :
              workflow.status === 'DRAFT' ? 'in_progress' :
              workflow.status === 'DISBURSED' ? 'approved' : 'completed'
    }));

    res.json({
      success: true,
      workflows: workflowData, // Match frontend expectation
      data: workflowData
    });
  } catch (error) {
    console.error('Workflows error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des workflows'
    });
  }
});

// POST /api/workflows/:applicationId/approve - Submit approval/rejection decision
router.post('/:applicationId/approve', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;
    const { userId, decision, comments } = req.body;

    if (!userId || !decision) {
      return res.status(400).json({
        success: false,
        error: 'userId and decision are required'
      });
    }

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        error: 'decision must be APPROVED or REJECTED'
      });
    }

    // Get the application with all workflow steps
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        workflowSteps: {
          orderBy: { createdAt: 'asc' },
          include: { assignee: true }
        },
        client: {
          include: { creator: true }
        },
        creator: true
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Find the current pending step
    const currentStep = application.workflowSteps.find(step => !step.completedAt);

    if (!currentStep) {
      return res.status(400).json({
        success: false,
        error: 'No pending workflow step found'
      });
    }

    // Get user making the decision
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update the current step
    await prisma.workflowStep.update({
      where: { id: currentStep.id },
      data: {
        status: decision,
        completedAt: new Date(),
        assigneeId: userId,
        comments: comments || `Décision: ${decision === 'APPROVED' ? 'Approuvé' : 'Rejeté'} par ${user.name}`
      }
    });

    if (decision === 'REJECTED') {
      // Reject the application
      await prisma.creditApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' }
      });

      triggerNotification('STEP_REJECTED', applicationId);
      triggerNotification('APPLICATION_REJECTED', applicationId);

      return res.json({
        success: true,
        message: 'Application rejected',
        status: 'REJECTED'
      });
    }

    // If approved, determine next step based on sequential approval hierarchy
    const approvalLimits = await prisma.approvalLimit.findMany({
      where: { isActive: true },
      orderBy: { minAmount: 'asc' }
    });

    const amount = Number(application.amount);

    // Get the approval limits
    const branchManagerLimit = approvalLimits.find(l => l.role === 'BRANCH_MANAGER');
    const committeeLimit = approvalLimits.find(l => l.role === 'CREDIT_COMMITTEE');
    const managementLimit = approvalLimits.find(l => l.role === 'MANAGEMENT');

    // Determine if we need another approval level based on SEQUENTIAL hierarchy
    let needsMoreApprovals = false;
    let nextApprovalRole: string | null = null;

    // Sequential approval logic:
    // Branch Manager (if within limit) → Credit Committee (if exceeds BM) → Management (if exceeds CC)

    if (currentStep.stepName === 'branch_manager_review') {
      // Just completed branch manager review

      // If amount exceeds branch manager limit, go to credit committee
      if (committeeLimit && amount > Number(branchManagerLimit?.maxAmount || 0)) {
        needsMoreApprovals = true;
        nextApprovalRole = 'CREDIT_COMMITTEE';
      }
    } else if (currentStep.stepName === 'credit_committee_review') {
      // Just completed credit committee review

      // If amount exceeds credit committee limit, go to management
      if (managementLimit && amount > Number(committeeLimit?.maxAmount || 0)) {
        needsMoreApprovals = true;
        nextApprovalRole = 'MANAGEMENT';
      }
    }

    if (needsMoreApprovals && nextApprovalRole) {
      // Create the next approval step
      const nextStepName = nextApprovalRole === 'BRANCH_MANAGER' ? 'branch_manager_review' :
                          nextApprovalRole === 'CREDIT_COMMITTEE' ? 'credit_committee_review' :
                          nextApprovalRole === 'MANAGEMENT' ? 'management_review' : 'final_decision';

      await prisma.workflowStep.create({
        data: {
          applicationId: applicationId,
          stepName: nextStepName,
          role: nextApprovalRole as any,
          status: 'PENDING',
          createdAt: new Date()
        }
      });

      triggerNotification('STEP_ASSIGNED', applicationId, { nextRole: nextApprovalRole });

      return res.json({
        success: true,
        message: `Approved. Forwarded to ${nextApprovalRole} for review`,
        status: 'UNDER_REVIEW',
        nextStep: nextStepName
      });
    }

    // No more approvals needed - application is fully approved
    await prisma.creditApplication.update({
      where: { id: applicationId },
      data: { status: 'APPROVED' }
    });

    triggerNotification('APPLICATION_APPROVED', applicationId);

    // Create final_decision step
    await prisma.workflowStep.create({
      data: {
        applicationId: applicationId,
        stepName: 'final_decision',
        role: user.role,
        status: 'APPROVED',
        completedAt: new Date(),
        assigneeId: userId,
        comments: 'Application fully approved - all required approvals obtained'
      }
    });

    return res.json({
      success: true,
      message: 'Application fully approved',
      status: 'APPROVED'
    });

  } catch (error) {
    console.error('Workflow approval error:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing approval decision'
    });
  }
});

// POST /api/workflows/fix-missing-approval-steps - Fix applications missing approval steps
router.post('/fix-missing-approval-steps', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Fixing missing approval steps...');

    const applications = await prisma.creditApplication.findMany({
      where: {
        status: 'UNDER_REVIEW'
      },
      include: {
        workflowSteps: true
      }
    });

    let fixedCount = 0;
    const fixed: string[] = [];

    for (const application of applications) {
      const creditAnalysisStep = application.workflowSteps.find(
        (step: any) => step.stepName === 'credit_analysis' && step.status === 'COMPLETED'
      );

      const hasApprovalStep = application.workflowSteps.some(
        (step: any) => step.stepName === 'branch_manager_review' ||
                step.stepName === 'credit_committee_review' ||
                step.stepName === 'management_review'
      );

      if (creditAnalysisStep && !hasApprovalStep) {
        // Always start with branch_manager_review (first in approval chain)
        const branchManagerLimit = await prisma.approvalLimit.findFirst({
          where: { role: 'BRANCH_MANAGER', isActive: true }
        });

        if (branchManagerLimit) {
          await prisma.workflowStep.create({
            data: {
              applicationId: application.id,
              stepName: 'branch_manager_review',
              role: 'BRANCH_MANAGER' as any,
              status: 'PENDING',
              createdAt: new Date()
            }
          });
          console.log(`✅ Created branch_manager_review for ${application.applicationNumber} (Amount: ${Number(application.amount)} XOF)`);
          fixedCount++;
          fixed.push(application.applicationNumber);
        }
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixedCount} application(s)`,
      fixed
    });

  } catch (error: any) {
    console.error('Error fixing approval steps:', error);
    res.status(500).json({
      success: false,
      error: 'Error fixing approval steps'
    });
  }
});

// POST /api/workflows/fix-prematurely-approved - Fix applications that were approved without going through all required approval layers
router.post('/fix-prematurely-approved', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Fixing prematurely approved applications...');

    // Find applications that are APPROVED but missing required approval steps
    const applications = await prisma.creditApplication.findMany({
      where: {
        status: 'APPROVED'
      },
      include: {
        workflowSteps: true
      }
    });

    const approvalLimits = await prisma.approvalLimit.findMany({
      where: { isActive: true },
      orderBy: { minAmount: 'asc' }
    });

    const branchManagerLimit = approvalLimits.find(l => l.role === 'BRANCH_MANAGER');
    const committeeLimit = approvalLimits.find(l => l.role === 'CREDIT_COMMITTEE');
    const managementLimit = approvalLimits.find(l => l.role === 'MANAGEMENT');

    let fixedCount = 0;
    const fixed: string[] = [];

    for (const application of applications) {
      const amount = Number(application.amount);

      const hasBranchManagerReview = application.workflowSteps.some(
        (step: any) => step.stepName === 'branch_manager_review'
      );
      const hasCommitteeReview = application.workflowSteps.some(
        (step: any) => step.stepName === 'credit_committee_review'
      );
      const hasManagementReview = application.workflowSteps.some(
        (step: any) => step.stepName === 'management_review'
      );

      let needsFix = false;

      // Check if it's missing required approval steps based on amount
      if (!hasBranchManagerReview && branchManagerLimit && amount >= Number(branchManagerLimit.minAmount)) {
        needsFix = true;
      } else if (!hasCommitteeReview && committeeLimit && amount > Number(branchManagerLimit?.maxAmount || 0) && amount <= Number(committeeLimit.maxAmount)) {
        needsFix = true;
      } else if (!hasManagementReview && managementLimit && amount > Number(committeeLimit?.maxAmount || 0)) {
        needsFix = true;
      }

      if (needsFix) {
        // Revert to UNDER_REVIEW status and remove final_decision step
        await prisma.creditApplication.update({
          where: { id: application.id },
          data: { status: 'UNDER_REVIEW' }
        });

        // Remove final_decision step
        await prisma.workflowStep.deleteMany({
          where: {
            applicationId: application.id,
            stepName: 'final_decision'
          }
        });

        // Ensure branch_manager_review exists as first approval step
        if (!hasBranchManagerReview && branchManagerLimit) {
          await prisma.workflowStep.create({
            data: {
              applicationId: application.id,
              stepName: 'branch_manager_review',
              role: 'BRANCH_MANAGER' as any,
              status: 'PENDING',
              createdAt: new Date()
            }
          });
        }

        console.log(`✅ Reverted ${application.applicationNumber} to UNDER_REVIEW - missing required approvals`);
        fixedCount++;
        fixed.push(application.applicationNumber);
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixedCount} prematurely approved application(s)`,
      fixed
    });

  } catch (error: any) {
    console.error('Error fixing prematurely approved applications:', error);
    res.status(500).json({
      success: false,
      error: 'Error fixing prematurely approved applications'
    });
  }
});

export default router;