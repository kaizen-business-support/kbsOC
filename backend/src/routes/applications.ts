import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { triggerNotification } from '../services/notificationService';
import { createWorkflowStepsForApplication, getActivePolicyForCreditType, buildWorkflowPlan, finalizeApplicationDuration } from '../services/workflowService';
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
            assignee: true,
            policyStep: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          include: { uploader: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
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
      analysisResults: application.analysisResults,
      workflowSteps: application.workflowSteps,
      documents: application.documents.map(d => ({
        id:         d.id,
        filename:   d.filename,
        mimeType:   d.mimeType,
        fileSize:   d.fileSize,
        category:   d.category,
        status:     d.status,
        uploadedBy: d.uploader?.name ?? null,
        createdAt:  d.createdAt.toISOString(),
        previewUrl: `/api/documents/preview/${d.id}`,
        downloadUrl:`/api/documents/download/${d.id}`,
      }))
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
    if (!clientId || amount === undefined || amount === null || !purpose || !createdBy || !creditTypeId) {
      return res.status(400).json({
        success: false,
        error: 'Les champs clientId, amount, purpose, createdBy et creditTypeId sont obligatoires'
      });
    }

    // Validate amount: doit être un nombre positif strictement supérieur à zéro
    // et plafonné à 100 milliards XOF pour éviter les saisies erronées.
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le montant doit être un nombre strictement positif',
      });
    }
    const AMOUNT_CAP = 100_000_000_000; // 100 milliards XOF
    if (numericAmount > AMOUNT_CAP) {
      return res.status(400).json({
        success: false,
        error: `Le montant ne peut pas dépasser ${AMOUNT_CAP.toLocaleString('fr-FR')} ${currency}`,
      });
    }

    // Generate application number
    const count = await prisma.creditApplication.count();
    const applicationNumber = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    // Vérifier qu'une politique active existe ET qu'elle a des étapes pour ce montant/type
    const activePolicy = await getActivePolicyForCreditType(creditTypeId, req.companyId);
    if (!activePolicy) {
      return res.status(422).json({
        success: false,
        error: 'Aucune politique de crédit active. Un administrateur doit activer une politique de crédit avant de soumettre un dossier.'
      });
    }
    try {
      await buildWorkflowPlan(creditTypeId, Number(amount), req.companyId);
    } catch (planErr: any) {
      return res.status(422).json({ success: false, error: planErr.message });
    }

    // Vérifier que le client appartient bien à cette company
    const clientExists = await prisma.client.findFirst({
      where: { id: clientId, companyId: req.companyId },
    });
    if (!clientExists) {
      return res.status(400).json({
        success: false,
        error: 'Client introuvable. Veuillez sélectionner un client valide.',
      });
    }

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

    // Vérifier que le rôle de l'utilisateur correspond à l'étape application_created de la politique active
    if (userExists.role !== 'SUPER_ADMIN') {
      const now = new Date();
      const activePolicy = await prisma.creditPolicy.findFirst({
        where: {
          status: 'ACTIVE' as any,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
          companyId: req.companyId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (activePolicy) {
        const creationStep = await prisma.creditPolicyStep.findFirst({
          where: { policyId: activePolicy.id, stepName: 'application_created', isActive: true },
          select: { assignedRole: true },
        });

        // Fallback identique à createWorkflowStepsForApplication :
        // si aucun step 'application_created' n'est en politique, le rôle requis est CHARGE_AFFAIRES.
        const requiredRole = creationStep?.assignedRole ?? 'CHARGE_AFFAIRES';

        if (userExists.role !== requiredRole) {
          return res.status(403).json({
            success: false,
            error: `Votre rôle (${userExists.role}) ne vous permet pas de créer une demande de crédit. Cette action est réservée au rôle "${requiredRole}" selon la politique de crédit active.`,
            requiredRole,
          });
        }
      }
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

    // Construction du circuit — la politique est garantie active (vérifiée ci-dessus)
    await createWorkflowStepsForApplication(
      application.id,
      application.creditTypeId!,
      Number(amount)
    );
    await prisma.creditApplication.update({
      where: { id: application.id },
      data: { status: 'UNDER_REVIEW' },
    });

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

// POST /api/applications/:id/disburse — BACK_OFFICE, DIRECTION_GENERALE, ADMIN
const DISBURSE_ROLES = ['BACK_OFFICE', 'DIRECTION_GENERALE', 'ADMIN', 'SUPER_ADMIN'];

router.post('/:id/disburse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user || !DISBURSE_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Accès réservé au Back-Office ou à la Direction Générale'
      });
    }

    const application = await prisma.creditApplication.findFirst({
      where: { id, companyId: req.companyId },
      select: { id: true, status: true, applicationNumber: true }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }

    if (application.status !== 'APPROVED') {
      return res.status(409).json({
        success: false,
        error: `Le décaissement requiert le statut APPROVED (statut actuel : ${application.status})`
      });
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.creditApplication.update({
        where: { id },
        data: { status: 'DISBURSED' }
      }),
      prisma.workflowStep.create({
        data: {
          applicationId: id,
          stepName: 'disbursement',
          role: user.role,
          assigneeId: user.id,
          status: 'COMPLETED',
          completedAt: now,
          comments: `Décaissement effectué par ${user.name ?? user.email}`
        }
      })
    ]);

    await finalizeApplicationDuration(id);
    triggerNotification('APPLICATION_APPROVED', id);

    res.json({
      success: true,
      message: `Dossier ${application.applicationNumber} décaissé avec succès`,
      status: 'DISBURSED'
    });
  } catch (error: any) {
    console.error('Disburse error:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur lors du décaissement' });
  }
});

// PUT /api/applications/:id/analysis-comment — upsert du commentaire de l'utilisateur courant
router.put('/:id/analysis-comment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const { synthesis, recommendations } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }
    if (!synthesis?.trim() && !recommendations?.trim()) {
      return res.status(400).json({ success: false, error: 'Synthèse ou recommandations requises' });
    }

    const application = await prisma.creditApplication.findUnique({
      where: { id, companyId: req.companyId },
      select: { analysisResults: true },
    });
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application non trouvée' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true, branch: true },
    });

    const analysisResults = (application.analysisResults as any) || {};
    const comments: any[] = [...(analysisResults.comments || [])];
    const now = new Date().toISOString();

    const idx = comments.findIndex((c: any) => c.userId === userId);
    if (idx >= 0) {
      comments[idx] = {
        ...comments[idx],
        synthesis:       synthesis?.trim()       ?? comments[idx].synthesis       ?? '',
        recommendations: recommendations?.trim() ?? comments[idx].recommendations ?? '',
        updatedAt:       now,
        isModified:      true,
        userName:        user?.name   ?? comments[idx].userName,
        userRole:        user?.role   ?? comments[idx].userRole,
        userBranch:      user?.branch ?? comments[idx].userBranch,
      };
    } else {
      comments.push({
        userId,
        userName:        user?.name   ?? 'Inconnu',
        userRole:        user?.role   ?? null,
        userBranch:      user?.branch ?? null,
        synthesis:       synthesis?.trim()       ?? '',
        recommendations: recommendations?.trim() ?? '',
        createdAt:       now,
        updatedAt:       now,
        isModified:      false,
      });
    }

    await prisma.creditApplication.update({
      where: { id },
      data: { analysisResults: { ...analysisResults, comments } },
    });

    return res.json({ success: true, data: comments });
  } catch (error: any) {
    console.error('Analysis comment error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erreur' });
  }
});

// PATCH /api/applications/:id/cancel — annulation d'un dossier (avec OTP déjà vérifié côté frontend)
const CANCEL_ROLES = ['CHARGE_AFFAIRES', 'ADMIN', 'SUPER_ADMIN'];
const TERMINAL_STATUSES = ['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'];

router.patch('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user || !CANCEL_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Seul un Chargé d\'Affaires ou un Administrateur peut annuler un dossier',
      });
    }

    const application = await prisma.creditApplication.findFirst({
      where: { id, companyId: req.companyId },
      select: { id: true, status: true, applicationNumber: true, createdBy: true },
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }

    if (TERMINAL_STATUSES.includes(application.status as string)) {
      return res.status(409).json({
        success: false,
        error: `Ce dossier ne peut pas être annulé (statut : ${application.status})`,
      });
    }

    // Seul le créateur ou un admin peut annuler
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
    if (!isAdmin && application.createdBy !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Seul le Chargé d\'Affaires ayant créé le dossier peut l\'annuler',
      });
    }

    const now = new Date();

    await prisma.$transaction([
      // Passer le dossier en CANCELLED
      prisma.creditApplication.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      // Marquer toutes les étapes en attente comme annulées
      prisma.workflowStep.updateMany({
        where: { applicationId: id, completedAt: null },
        data: { status: 'CANCELLED' },
      }),
      // Tracer l'annulation
      prisma.workflowStep.create({
        data: {
          applicationId: id,
          stepName:      'cancellation',
          role:          user.role,
          assigneeId:    user.id,
          status:        'COMPLETED',
          completedAt:   now,
          comments:      `Dossier annulé par ${user.name ?? user.email}`,
        },
      }),
    ]);

    return res.json({
      success: true,
      message:           `Dossier ${application.applicationNumber} annulé avec succès`,
      applicationNumber: application.applicationNumber,
      status:            'CANCELLED',
    });
  } catch (error: any) {
    console.error('[applications] PATCH /:id/cancel error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erreur lors de l\'annulation' });
  }
});

export default router;