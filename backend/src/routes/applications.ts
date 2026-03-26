import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { triggerNotification } from '../services/notificationService';

const router = Router();

// GET /api/applications - Get applications with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, branch, dateFrom, dateTo, userId } = req.query;
    
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

    const applications = await prisma.creditApplication.findMany({
      where: whereConditions,
      include: {
        client: true,
        creator: true,
        creditType: true,
        workflowSteps: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to match frontend expectations
    const applicationData = applications.map(app => ({
      id: app.id,
      clientName: app.client.companyName,
      clientId: app.clientId,
      amount: Number(app.amount),
      currency: app.currency || 'XOF',
      status: app.status.toLowerCase(),
      accountManager: app.creator.name,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      purpose: app.purpose || '',
      duration: app.durationMonths || 0,
      durationMonths: app.durationMonths || 0,
      proposedRate: app.proposedRate ? Number(app.proposedRate) : null,
      collateralType: app.collateralType,
      collateralValue: app.collateralValue ? Number(app.collateralValue) : null,
      repaymentSchedule: app.repaymentSchedule?.toLowerCase(),
      creditType: app.creditType,
      workflowSteps: app.workflowSteps, // Include workflow steps for checking completion status
      analysisResults: app.analysisResults, // Include analysis results with financial data
      applicationNumber: app.applicationNumber
    }));

    res.json({
      success: true,
      applications: applicationData, // Match frontend expectation
      data: applicationData
    });
  } catch (error) {
    console.error('Applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des demandes'
    });
  }
});

// GET /api/applications/:id - Get single application by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.creditApplication.findUnique({
      where: { id },
      include: {
        client: true,
        creator: true,
        creditType: true,
        workflowSteps: {
          include: {
            assignee: true
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée'
      });
    }

    // Transform to match frontend expectations
    const applicationData = {
      id: application.id,
      applicationNumber: application.applicationNumber,
      clientId: application.clientId,
      clientName: application.client.companyName,
      client: application.client,
      amount: Number(application.amount),
      currency: application.currency || 'XOF',
      status: application.status.toLowerCase(),
      accountManager: application.creator.name,
      createdBy: application.createdBy,
      creator: application.creator,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      submittedAt: application.submittedAt?.toISOString(),
      purpose: application.purpose || '',
      duration: application.durationMonths || 0,
      durationMonths: application.durationMonths || 0,
      proposedRate: application.proposedRate ? Number(application.proposedRate) : null,
      collateralType: application.collateralType,
      collateralValue: application.collateralValue ? Number(application.collateralValue) : null,
      repaymentSchedule: application.repaymentSchedule?.toLowerCase(),
      creditType: application.creditType,
      analysisResults: application.analysisResults, // Include the financial data
      workflowSteps: application.workflowSteps
    };

    res.json({
      success: true,
      data: applicationData,
      application: applicationData
    });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la demande'
    });
  }
});

// POST /api/applications - Create new application
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      amount,
      currency = 'XOF',
      purpose,
      durationMonths,
      creditTypeId,
      proposedRate,
      collateralType,
      collateralValue,
      repaymentSchedule,
      createdBy,
      assignedAnalystId,
      analysisResults
    } = req.body;

    // Validate required fields
    if (!clientId || !amount || !purpose || !createdBy) {
      return res.status(400).json({
        success: false,
        error: 'Les champs clientId, amount, purpose et createdBy sont obligatoires'
      });
    }

    // Generate application number
    const count = await prisma.creditApplication.count();
    const applicationNumber = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    // Ensure the user exists in the database (for demo users)
    const userExists = await prisma.user.findUnique({
      where: { id: createdBy }
    });

    if (!userExists) {
      return res.status(400).json({
        success: false,
        error: 'Utilisateur non trouvé. Veuillez vous reconnecter.'
      });
    }

    // Create application
    const application = await prisma.creditApplication.create({
      data: {
        applicationNumber,
        clientId,
        amount,
        currency,
        purpose,
        durationMonths: durationMonths || null,
        creditTypeId: creditTypeId || null,
        proposedRate: proposedRate || null,
        collateralType: collateralType || null,
        collateralValue: collateralValue || null,
        repaymentSchedule: repaymentSchedule ? repaymentSchedule.toUpperCase() : null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        createdBy,
        analysisResults: analysisResults || null
      },
      include: {
        client: true,
        creator: true
      }
    });

    // Create workflow steps
    const now = new Date();

    // Step 1: Application created (always completed)
    await prisma.workflowStep.create({
      data: {
        applicationId: application.id,
        stepName: 'application_created',
        role: 'ACCOUNT_MANAGER',
        assigneeId: createdBy,
        status: 'COMPLETED',
        completedAt: now,
        comments: 'Demande de crédit soumise'
      }
    });

    // Step 2+: Use credit type workflow if configured, otherwise fallback
    if (application.creditTypeId) {
      const creditTypeSteps = await prisma.creditTypeWorkflowStep.findMany({
        where: { creditTypeId: application.creditTypeId },
        orderBy: { order: 'asc' }
      });

      if (creditTypeSteps.length > 0) {
        // Create first step as PENDING
        const firstStep = creditTypeSteps[0];
        await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: firstStep.stepName,
            role: firstStep.role as any,
            assigneeId: firstStep.role === 'CREDIT_ANALYST' ? (assignedAnalystId || null) : null,
            status: 'PENDING',
            deadline: new Date(now.getTime() + firstStep.durationDays * 24 * 60 * 60 * 1000)
          }
        });
      } else {
        // Credit type exists but no workflow configured → fallback
        if (assignedAnalystId) {
          await prisma.workflowStep.create({
            data: {
              applicationId: application.id,
              stepName: 'credit_analysis',
              role: 'CREDIT_ANALYST',
              assigneeId: assignedAnalystId,
              status: 'PENDING'
            }
          });
        }
      }
    } else {
      // No credit type → legacy fallback
      if (assignedAnalystId) {
        await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: 'credit_analysis',
            role: 'CREDIT_ANALYST',
            assigneeId: assignedAnalystId,
            status: 'PENDING'
          }
        });
      }
    }

    // Trigger notification (non-blocking)
    triggerNotification('APPLICATION_SUBMITTED', application.id);

    res.status(201).json({
      success: true,
      application: {
        id: application.id,
        applicationNumber: application.applicationNumber,
        clientId: application.clientId,
        clientName: application.client.companyName,
        amount: Number(application.amount),
        currency: application.currency,
        purpose: application.purpose,
        status: application.status.toLowerCase(),
        createdBy: application.createdBy,
        createdByName: application.creator.name,
        createdAt: application.createdAt.toISOString(),
        submittedAt: application.submittedAt?.toISOString()
      },
      data: application
    });
  } catch (error: any) {
    console.error('Create application error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création de la demande',
      details: error.code ? { code: error.code, meta: error.meta } : undefined
    });
  }
});

// PUT /api/applications/:id - Update existing application (for analyst scoring)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      analystScore,
      financialScore,
      overallScore,
      overallAnalysis,
      recommendations,
      status,
      analysisResults
    } = req.body;

    // Check if application exists
    const existingApplication = await prisma.creditApplication.findUnique({
      where: { id }
    });

    if (!existingApplication) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée'
      });
    }

    // Prepare update data
    const updateData: any = {};

    // Update status if provided
    if (status !== undefined) updateData.status = status.toUpperCase();

    // Merge analysisResults with existing data
    const currentAnalysisResults = (existingApplication.analysisResults as any) || {};

    updateData.analysisResults = {
      ...currentAnalysisResults,
      ...analysisResults,
      preliminaryAnalysis: {
        ...(currentAnalysisResults.preliminaryAnalysis || {}),
        ...(analysisResults?.preliminaryAnalysis || {}),
        overallScore: overallScore !== undefined ? overallScore : currentAnalysisResults.preliminaryAnalysis?.overallScore,
        financialScore: financialScore !== undefined ? financialScore : currentAnalysisResults.preliminaryAnalysis?.financialScore,
        analystScore: analystScore !== undefined ? analystScore : currentAnalysisResults.preliminaryAnalysis?.analystScore,
        overallAnalysis: overallAnalysis !== undefined ? overallAnalysis : currentAnalysisResults.preliminaryAnalysis?.overallAnalysis,
        recommendations: recommendations !== undefined ? recommendations : currentAnalysisResults.preliminaryAnalysis?.recommendations
      }
    };

    // Also store the overall score in the score field for easy querying
    if (overallScore !== undefined) {
      updateData.score = {
        overall: overallScore,
        financial: financialScore,
        analyst: analystScore
      };
    }

    // Update the application
    const application = await prisma.creditApplication.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        creator: true,
        creditType: true,
        workflowSteps: {
          include: {
            assignee: true
          }
        }
      }
    });

    // If analyst scores are provided, complete the credit_analysis workflow step
    if (analystScore !== undefined || financialScore !== undefined || overallScore !== undefined) {
      const now = new Date();

      // Define the workflow step order
      const WORKFLOW_STEP_ORDER = [
        { name: 'application_created', role: 'ACCOUNT_MANAGER' },
        { name: 'credit_analysis', role: 'CREDIT_ANALYST' }
      ];

      // Get existing workflow steps
      const existingSteps = new Map(
        application.workflowSteps.map(step => [step.stepName, step])
      );

      // Find the credit_analysis step index
      const creditAnalysisIndex = WORKFLOW_STEP_ORDER.findIndex(s => s.name === 'credit_analysis');

      // Create and complete all prior steps if they don't exist
      for (let i = 0; i < creditAnalysisIndex; i++) {
        const stepConfig = WORKFLOW_STEP_ORDER[i];

        if (!existingSteps.has(stepConfig.name)) {
          console.log(`📝 Creating missing workflow step: ${stepConfig.name}`);
          await prisma.workflowStep.create({
            data: {
              applicationId: application.id,
              stepName: stepConfig.name,
              role: stepConfig.role as any,
              assigneeId: application.createdBy,
              status: 'COMPLETED',
              completedAt: now
            }
          });
        } else {
          // Mark existing prior steps as completed if not already
          const existingStep = existingSteps.get(stepConfig.name)!;
          if (existingStep.status !== 'COMPLETED') {
            console.log(`✅ Completing prior workflow step: ${stepConfig.name}`);
            await prisma.workflowStep.update({
              where: { id: existingStep.id },
              data: {
                status: 'COMPLETED',
                completedAt: now
              }
            });
          }
        }
      }

      // Trouver OU créer l'étape credit_analysis, puis la compléter
      let creditAnalysisStep = application.workflowSteps.find(
        step => step.stepName === 'credit_analysis' && step.status !== 'COMPLETED'
      );

      // Si elle n'existe pas encore, la créer maintenant (cas sans analyste assigné)
      if (!creditAnalysisStep && !existingSteps.has('credit_analysis')) {
        console.log('📝 Creating missing credit_analysis step on-the-fly');
        const created = await prisma.workflowStep.create({
          data: {
            applicationId: application.id,
            stepName: 'credit_analysis',
            role: 'CREDIT_ANALYST',
            assigneeId: application.createdBy,
            status: 'PENDING'
          }
        });
        creditAnalysisStep = created as any;
      }

      if (creditAnalysisStep) {
        await prisma.workflowStep.update({
          where: { id: creditAnalysisStep.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            comments: 'Analyse de crédit complétée avec succès'
          }
        });
        console.log('✅ Credit analysis workflow step marked as COMPLETED');

        // Vérifier que branch_manager_review n'existe pas déjà
        const alreadyHasBranchStep = application.workflowSteps.some(
          s => s.stepName === 'branch_manager_review'
        );

        if (!alreadyHasBranchStep) {
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
                createdAt: now
              }
            });
            console.log('✅ Created branch_manager_review workflow step');
          } else {
            console.warn('⚠️ No branch manager approval limit found');
          }
        }
      }
    }

    // Transform to match frontend expectations
    const analysisData = application.analysisResults as any;
    const prelimAnalysis = analysisData?.preliminaryAnalysis || {};

    const applicationData = {
      id: application.id,
      applicationNumber: application.applicationNumber,
      clientId: application.clientId,
      clientName: application.client.companyName,
      client: application.client,
      amount: Number(application.amount),
      currency: application.currency || 'XOF',
      status: application.status.toLowerCase(),
      accountManager: application.creator.name,
      createdBy: application.createdBy,
      creator: application.creator,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      submittedAt: application.submittedAt?.toISOString(),
      purpose: application.purpose || '',
      duration: application.durationMonths || 0,
      durationMonths: application.durationMonths || 0,
      proposedRate: application.proposedRate ? Number(application.proposedRate) : null,
      collateralType: application.collateralType,
      collateralValue: application.collateralValue ? Number(application.collateralValue) : null,
      repaymentSchedule: application.repaymentSchedule?.toLowerCase(),
      creditType: application.creditType,
      analysisResults: application.analysisResults,
      workflowSteps: application.workflowSteps,
      // Extract scores from analysisResults
      analystScore: prelimAnalysis.analystScore,
      financialScore: prelimAnalysis.financialScore,
      overallScore: prelimAnalysis.overallScore,
      overallAnalysis: prelimAnalysis.overallAnalysis,
      recommendations: prelimAnalysis.recommendations
    };

    res.json({
      success: true,
      data: applicationData,
      application: applicationData,
      message: 'Application mise à jour avec succès'
    });
  } catch (error: any) {
    console.error('Update application error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la mise à jour de la demande'
    });
  }
});

export default router;