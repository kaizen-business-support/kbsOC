import { Router, Request, Response } from 'express';
import { prisma } from '../server';

const router = Router();

// ─── Middleware : seuls ANALYST_SUPERVISOR et ADMIN peuvent dispatching ────────
const requireSupervisor = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || !['ANALYST_SUPERVISOR', 'ADMIN'].includes(user.role)) {
    return res.status(403).json({ success: false, error: 'Accès réservé au Responsable Analyste' });
  }
  next();
};

// ─── GET /api/dispatching/workload ─────────────────────────────────────────────
// Retourne tous les analystes avec leur charge de travail (dossiers actifs)
router.get('/workload', async (req: Request, res: Response) => {
  try {
    const analysts = await prisma.user.findMany({
      where: { role: 'CREDIT_ANALYST', isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        jobTitle: true,
        assignedSteps: {
          where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
          select: {
            id: true,
            status: true,
            stepName: true,
            deadline: true,
            application: {
              select: {
                id: true,
                applicationNumber: true,
                amount: true,
                currency: true,
                status: true,
                client: { select: { companyName: true } }
              }
            }
          }
        }
      }
    });

    const workload = analysts.map(analyst => ({
      id: analyst.id,
      name: analyst.name,
      email: analyst.email,
      department: analyst.department,
      jobTitle: analyst.jobTitle,
      activeCount: analyst.assignedSteps.length,
      pendingCount: analyst.assignedSteps.filter(s => s.status === 'PENDING').length,
      inReviewCount: analyst.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
      activeDossiers: analyst.assignedSteps.map(s => ({
        stepId: s.id,
        applicationId: s.application.id,
        applicationNumber: s.application.applicationNumber,
        clientName: s.application.client.companyName,
        amount: Number(s.application.amount),
        currency: s.application.currency,
        appStatus: s.application.status,
        stepStatus: s.status,
        deadline: s.deadline
      })),
      // Score de charge : moins c'est élevé, plus l'analyste est disponible
      workloadScore: analyst.assignedSteps.length
    }));

    // Trier par charge croissante (le moins chargé en premier)
    workload.sort((a, b) => a.workloadScore - b.workloadScore);

    res.json({ success: true, data: workload });
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/pending ─────────────────────────────────────────────
// Retourne les demandes soumises sans analyste affecté (à dispatcher)
router.get('/pending', async (req: Request, res: Response) => {
  try {
    // Applications SUBMITTED ou UNDER_REVIEW sans step CREDIT_ANALYST actif assigné
    const applications = await prisma.creditApplication.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        workflowSteps: {
          none: {
            role: 'CREDIT_ANALYST',
            status: { in: ['PENDING', 'IN_REVIEW'] },
            assigneeId: { not: null }
          }
        }
      },
      include: {
        client: true,
        creator: true,
        creditType: true,
        workflowSteps: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const data = applications.map(app => ({
      id: app.id,
      applicationNumber: app.applicationNumber,
      clientName: app.client.companyName,
      clientSector: app.client.sector,
      amount: Number(app.amount),
      currency: app.currency,
      purpose: app.purpose,
      durationMonths: app.durationMonths,
      status: app.status,
      createdAt: app.createdAt,
      submittedAt: app.submittedAt,
      accountManager: app.creator.name,
      creditType: app.creditType?.name
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Pending dispatching error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/suggest/:applicationId ──────────────────────────────
// Suggère automatiquement le meilleur analyste pour une demande donnée
router.get('/suggest/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: { client: true }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    const analysts = await prisma.user.findMany({
      where: { role: 'CREDIT_ANALYST', isActive: true },
      include: {
        assignedSteps: {
          where: { status: { in: ['PENDING', 'IN_REVIEW'] } }
        }
      }
    });

    if (analysts.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucun analyste disponible' });
    }

    // Algorithme : trouver l'analyste avec la plus faible charge
    const ranked = analysts
      .map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        department: a.department,
        jobTitle: a.jobTitle,
        workloadScore: a.assignedSteps.length
      }))
      .sort((a, b) => a.workloadScore - b.workloadScore);

    const suggested = ranked[0];

    res.json({
      success: true,
      data: {
        suggested,
        ranked,
        applicationId,
        applicationNumber: application.applicationNumber
      }
    });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/dispatching/assign ─────────────────────────────────────────────
// Affecter un analyste à une demande (validation par le Responsable Analyste)
router.post('/assign', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const { applicationId, analystId, comment } = req.body;
    const supervisorId = (req as any).user?.userId;

    if (!applicationId || !analystId) {
      return res.status(400).json({ success: false, error: 'applicationId et analystId requis' });
    }

    const [application, analyst] = await Promise.all([
      prisma.creditApplication.findUnique({
        where: { id: applicationId },
        include: { workflowSteps: true }
      }),
      prisma.user.findUnique({ where: { id: analystId } })
    ]);

    if (!application) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    if (!analyst || analyst.role !== 'CREDIT_ANALYST') {
      return res.status(400).json({ success: false, error: 'Analyste invalide' });
    }

    // Chercher le step CREDIT_ANALYST existant non-assigné, ou le créer
    const existingStep = application.workflowSteps.find(
      s => s.role === 'CREDIT_ANALYST' && !s.assigneeId
    );

    if (existingStep) {
      await prisma.workflowStep.update({
        where: { id: existingStep.id },
        data: {
          assigneeId: analystId,
          status: 'PENDING',
          comments: comment || `Affecté par le Responsable Analyste le ${new Date().toLocaleDateString('fr-FR')}`
        }
      });
    } else {
      // Créer un nouveau step si aucun n'existe
      await prisma.workflowStep.create({
        data: {
          applicationId,
          stepName: 'credit_analysis',
          role: 'CREDIT_ANALYST',
          assigneeId: analystId,
          status: 'PENDING',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          comments: comment || `Affecté par le Responsable Analyste le ${new Date().toLocaleDateString('fr-FR')}`
        }
      });
    }

    // Passer la demande en UNDER_REVIEW si elle était SUBMITTED
    if (application.status === 'SUBMITTED') {
      await prisma.creditApplication.update({
        where: { id: applicationId },
        data: { status: 'UNDER_REVIEW' }
      });
    }

    res.json({
      success: true,
      message: `Demande ${application.applicationNumber} affectée à ${analyst.name}`,
      data: { applicationId, analystId, analystName: analyst.name }
    });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'affectation' });
  }
});

export default router;
