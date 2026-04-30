import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { triggerNotification } from '../services/notificationService';
import { createWorkflowStepsForApplication } from '../services/workflowService';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// GET /api/applications - Get applications with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, branch, dateFrom, dateTo, userId, assignedAnalystId } = req.query;

    // Build filter conditions
    const whereConditions: any = { companyId: req.companyId };

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

    if (assignedAnalystId) {
      whereConditions.workflowSteps = {
        some: {
          role: 'ANALYSTE_RISQUES',
          assigneeId: assignedAnalystId as string,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        }
      };
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
    const applicationData = applications
      .filter(app => app.client && app.creator)
      .map(app => ({
        id: app.id,
        clientName: app.client!.companyName,
        clientId: app.clientId,
        amount: Number(app.amount),
        currency: app.currency || 'XOF',
        status: app.status.toLowerCase(),
        accountManager: app.creator!.name,
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
        workflowSteps: app.workflowSteps,
        analysisResults: app.analysisResults,
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
        analysisResults: analysisResults || null,
        companyId: req.companyId
      },
      include: {
        client: true,
        creator: true
      }
    });

    // Étape "dossier créé" — toujours complétée immédiatement par le créateur
    await prisma.workflowStep.create({
      data: {
        applicationId: application.id,
        stepName: 'application_created',
        role: 'CHARGE_AFFAIRES',
        assigneeId: createdBy,
        status: 'COMPLETED',
        completedAt: new Date(),
        comments: 'Demande de crédit soumise',
      },
    });

    // Construction dynamique du circuit via la politique active (ou fallback CreditTypeWorkflowStep)
    if (application.creditTypeId) {
      await createWorkflowStepsForApplication(
        application.id,
        application.creditTypeId,
        Number(amount)
      );
      // Le dossier passe en UNDER_REVIEW dès que les étapes sont générées
      await prisma.creditApplication.update({
        where: { id: application.id },
        data: { status: 'UNDER_REVIEW' },
      });
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

    // Si des scores d'analyste sont fournis, compléter l'étape credit_analysis
    // en cours, puis laisser la politique piloter la suite (pas de step hardcodé).
    if (analystScore !== undefined || financialScore !== undefined || overallScore !== undefined) {
      const now = new Date();

      // Trouver l'étape credit_analysis active (PENDING ou IN_REVIEW)
      const creditAnalysisStep = application.workflowSteps.find(
        s => s.stepName === 'credit_analysis' && s.status !== 'COMPLETED'
      );

      if (creditAnalysisStep) {
        await prisma.workflowStep.update({
          where: { id: creditAnalysisStep.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            comments: 'Analyse de crédit complétée avec succès',
          },
        });
      }

      // Si le dossier n'a pas encore d'étapes de politique créées, les générer maintenant.
      // Cela rattrape les dossiers soumis avant qu'une politique soit active.
      const app = await prisma.creditApplication.findUnique({
        where: { id },
        select: { policyId: true, creditTypeId: true, amount: true },
      });
      if (!app?.policyId && app?.creditTypeId) {
        await createWorkflowStepsForApplication(id, app.creditTypeId, Number(app.amount));
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