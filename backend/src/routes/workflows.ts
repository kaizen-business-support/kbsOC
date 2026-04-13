import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { triggerNotification } from '../services/notificationService';
import {
  getNextWorkflowStep,
  canApproveStep,
  startWorkflowStep,
  finalizeStepDuration,
  finalizeApplicationDuration,
} from '../services/workflowService';

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

      filteredWorkflows = workflows.filter(workflow => {
        // L'étape courante est la première non-complétée
        const currentStep = workflow.workflowSteps.find(step => !step.completedAt);

        if (role === 'ACCOUNT_MANAGER') {
          return workflow.createdBy === userId;
        }

        if (role === 'CREDIT_ANALYST') {
          return currentStep?.stepName === 'credit_analysis' &&
                 workflow.status === 'UNDER_REVIEW';
        }

        // Pour tous les rôles d'approbation : on vérifie simplement
        // que l'étape courante leur est destinée — logique 100% dynamique.
        return currentStep?.role === role && workflow.status === 'UNDER_REVIEW';
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

// POST /api/workflows/:applicationId/start-step/:stepId
// Marque une étape comme "en cours" (IN_REVIEW) et enregistre startedAt
// À appeler dès qu'un profil ouvre le dossier pour traitement
router.post('/:applicationId/start-step/:stepId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { applicationId, stepId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    // Vérification : si l'étape est assignée, seul l'assigné peut la démarrer.
    // Sinon, vérifier que l'utilisateur appartient à la même agence que le créateur du dossier.
    const [step, user, application] = await Promise.all([
      prisma.workflowStep.findUnique({ where: { id: stepId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, branch: true, department: true } }),
      prisma.creditApplication.findUnique({
        where: { id: applicationId },
        select: { creator: { select: { branch: true, department: true } } },
      }),
    ]);

    if (step?.assigneeId && step.assigneeId !== userId) {
      return res.status(403).json({ success: false, error: 'Cette étape est assignée à un autre analyste.' });
    }

    const GLOBAL_ROLES = ['MANAGEMENT', 'ADMIN', 'CREDIT_COMMITTEE'];
    if (user && application && !GLOBAL_ROLES.includes(user.role)) {
      const userBranch    = (user as any).branch    || (user as any).department;
      const creatorBranch = application.creator?.branch || application.creator?.department;
      if (userBranch && creatorBranch && userBranch !== creatorBranch) {
        return res.status(403).json({
          success: false,
          error: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez traiter que les dossiers de votre agence.`,
        });
      }
    }

    await startWorkflowStep(stepId, userId);
    res.json({ success: true, message: 'Étape démarrée' });
  } catch (error) {
    console.error('Start step error:', error);
    res.status(500).json({ success: false, error: 'Erreur démarrage étape' });
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
        creator: true,
        creditType: true
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

    // Vérifier que l'approbateur a le droit d'approuver cette étape et ce montant
    const authCheck = await canApproveStep(userId, applicationId, currentStep.stepName);
    if (!authCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: authCheck.reason || 'Approbation non autorisée'
      });
    }

    // Démarrer l'étape si elle est encore en PENDING (enregistre startedAt)
    if (currentStep.status === 'PENDING') {
      await startWorkflowStep(currentStep.id, userId);
    }

    // Calculer la durée de traitement et mettre à jour l'étape
    const durationMinutes = await finalizeStepDuration(currentStep.id);

    await prisma.workflowStep.update({
      where: { id: currentStep.id },
      data: {
        status: decision,
        assigneeId: userId,
        durationMinutes: durationMinutes ?? undefined,
        comments: comments || `Décision: ${decision === 'APPROVED' ? 'Approuvé' : 'Rejeté'} par ${user.name}`
      }
    });

    if (decision === 'REJECTED') {
      await prisma.creditApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' }
      });
      // Calculer et stocker la durée totale du dossier
      await finalizeApplicationDuration(applicationId);
      triggerNotification('STEP_REJECTED', applicationId);
      triggerNotification('APPLICATION_REJECTED', applicationId);
      return res.json({ success: true, message: 'Demande rejetée', status: 'REJECTED' });
    }

    // Déterminer l'étape suivante via le service dynamique (base de données)
    const nextStep = await getNextWorkflowStep(applicationId, currentStep.stepName);

    if (nextStep) {
      await prisma.workflowStep.create({
        data: {
          applicationId,
          stepName: nextStep.stepName,
          role: nextStep.role,
          status: 'PENDING',
          deadline: new Date(
            Date.now() +
              (nextStep.expectedDurationHours ?? nextStep.durationDays * 24) * 60 * 60 * 1000
          ),
          policyStepId: nextStep.policyStepId ?? undefined,
        }
      });

      triggerNotification('STEP_ASSIGNED', applicationId, { nextRole: nextStep.role });

      return res.json({
        success: true,
        message: `Approuvé. Transféré à : ${nextStep.stepLabel}`,
        status: 'UNDER_REVIEW',
        nextStep: nextStep.stepName
      });
    }

    // Plus d'étapes → approbation finale
    await prisma.creditApplication.update({
      where: { id: applicationId },
      data: { status: 'APPROVED' }
    });

    // Calculer et stocker la durée totale du dossier
    await finalizeApplicationDuration(applicationId);

    triggerNotification('APPLICATION_APPROVED', applicationId);

    // Create final_decision step (rôle système fixe, indépendant de l'approbateur)
    await prisma.workflowStep.create({
      data: {
        applicationId: applicationId,
        stepName: 'final_decision',
        role: 'ACCOUNT_MANAGER',
        status: 'APPROVED',
        completedAt: new Date(),
        assigneeId: userId,
        comments: 'Dossier approuvé — toutes les validations requises ont été obtenues',
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

// POST /api/workflows/fix-missing-approval-steps
// Recalcule dynamiquement les étapes manquantes depuis le service
router.post('/fix-missing-approval-steps', async (req: Request, res: Response) => {
  try {
    const { getNextWorkflowStep: getNext } = await import('../services/workflowService');

    const applications = await prisma.creditApplication.findMany({
      where: { status: 'UNDER_REVIEW', creditTypeId: { not: null } },
      include: { workflowSteps: { orderBy: { createdAt: 'asc' } } }
    });

    let fixedCount = 0;
    const fixed: string[] = [];

    for (const application of applications) {
      const analysisStep = application.workflowSteps.find(
        s => s.stepName === 'credit_analysis' && s.status === 'COMPLETED'
      );
      if (!analysisStep) continue;

      const hasPendingStep = application.workflowSteps.some(s => !s.completedAt);
      if (hasPendingStep) continue;

      // Dernière étape complétée
      const lastCompleted = [...application.workflowSteps]
        .filter(s => s.completedAt)
        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];

      if (!lastCompleted) continue;

      const nextStep = await getNext(application.id, lastCompleted.stepName);
      if (nextStep) {
        await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: nextStep.stepName,
            role: nextStep.role,
            status: 'PENDING',
            deadline: new Date(Date.now() + nextStep.durationDays * 24 * 60 * 60 * 1000),
          }
        });
        fixedCount++;
        fixed.push(application.applicationNumber);
      }
    }

    res.json({ success: true, message: `${fixedCount} dossier(s) corrigé(s)`, fixed });
  } catch (error: any) {
    console.error('Error fixing approval steps:', error);
    res.status(500).json({ success: false, error: 'Erreur correction étapes' });
  }
});

// POST /api/workflows/fix-prematurely-approved
// Vérifie dynamiquement les dossiers approuvés qui auraient dû passer par plus d'étapes
router.post('/fix-prematurely-approved', async (req: Request, res: Response) => {
  try {
    const { buildWorkflowPlan } = await import('../services/workflowService');

    const applications = await prisma.creditApplication.findMany({
      where: { status: 'APPROVED', creditTypeId: { not: null } },
      include: { workflowSteps: true }
    });

    let fixedCount = 0;
    const fixed: string[] = [];

    for (const application of applications) {
      if (!application.creditTypeId) continue;

      const plan = await buildWorkflowPlan(
        application.creditTypeId,
        Number(application.amount)
      );

      // Vérifier si toutes les étapes requises sont présentes
      const missingSteps = plan.steps.filter(planStep =>
        !application.workflowSteps.some(ws => ws.stepName === planStep.stepName)
      );

      if (missingSteps.length > 0) {
        // Remettre en UNDER_REVIEW et retirer la décision finale
        await prisma.creditApplication.update({
          where: { id: application.id },
          data: { status: 'UNDER_REVIEW' }
        });
        await prisma.workflowStep.deleteMany({
          where: { applicationId: application.id, stepName: 'final_decision' }
        });

        // Créer la première étape manquante
        const firstMissing = missingSteps[0];
        await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: firstMissing.stepName,
            role: firstMissing.role,
            status: 'PENDING',
            deadline: new Date(Date.now() + firstMissing.durationDays * 24 * 60 * 60 * 1000),
          }
        });

        fixedCount++;
        fixed.push(application.applicationNumber);
      }
    }

    res.json({ success: true, message: `${fixedCount} dossier(s) corrigé(s)`, fixed });
  } catch (error: any) {
    console.error('Error fixing prematurely approved applications:', error);
    res.status(500).json({ success: false, error: 'Erreur correction dossiers' });
  }
});

export default router;