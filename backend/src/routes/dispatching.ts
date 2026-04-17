import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { createInAppNotification } from '../services/notificationService';
import { resolveDelegation } from '../services/delegationService';

const router = Router();

// ─── Middleware : RESPONSABLE_RISQUES, ADMIN, ou délégué avec DISPATCH_APPLICATION ──
const requireSupervisorOrDelegate = async (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user) return res.status(403).json({ success: false, error: 'Non authentifié' });

  if (['RESPONSABLE_RISQUES', 'ADMIN'].includes(user.role)) return next();

  // Vérifier si délégué avec droit DISPATCH_APPLICATION
  const userId = user?.userId || user?.id;
  const delegation = await resolveDelegation(userId, 'DISPATCH_APPLICATION');
  if (delegation && ['RESPONSABLE_RISQUES', 'ADMIN'].includes(delegation.delegatorRole)) {
    (req as any).delegationContext = delegation;
    return next();
  }

  return res.status(403).json({ success: false, error: 'Accès réservé au Responsable Analyste' });
};

// Appliquer le middleware sur toutes les routes
router.use(requireSupervisorOrDelegate);

// ─── GET /api/dispatching/workload ─────────────────────────────────────────────
router.get('/workload', async (req: Request, res: Response) => {
  try {
    const analysts = await prisma.user.findMany({
      where: { role: 'ANALYSTE_RISQUES', isActive: true },
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

    const workload = analysts.map(analyst => {
      const overdueCount = analyst.assignedSteps.filter(
        s => s.deadline && new Date(s.deadline) < new Date()
      ).length;

      return {
        id: analyst.id,
        name: analyst.name,
        email: analyst.email,
        department: analyst.department,
        jobTitle: analyst.jobTitle,
        activeCount: analyst.assignedSteps.length,
        pendingCount: analyst.assignedSteps.filter(s => s.status === 'PENDING').length,
        inReviewCount: analyst.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
        overdueCount,
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
        // Score = nombre actifs + pénalité délai dépassé
        workloadScore: analyst.assignedSteps.length + overdueCount * 2
      };
    });

    workload.sort((a, b) => a.workloadScore - b.workloadScore);

    res.json({ success: true, data: workload });
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/pending ─────────────────────────────────────────────
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const applications = await prisma.creditApplication.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        workflowSteps: {
          none: {
            role: 'ANALYSTE_RISQUES',
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

    const data = applications.map(app => {
      const daysPending = Math.floor(
        (Date.now() - new Date(app.submittedAt || app.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: app.id,
        applicationNumber: app.applicationNumber,
        clientName: app.client.companyName,
        clientSector: app.client.sector,
        branch: app.creator.department || 'Non définie',
        amount: Number(app.amount),
        currency: app.currency,
        purpose: app.purpose,
        durationMonths: app.durationMonths,
        status: app.status,
        createdAt: app.createdAt,
        submittedAt: app.submittedAt,
        daysPending,
        accountManager: app.creator.name,
        accountManagerId: app.creator.id,
        creditType: app.creditType?.name
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Pending dispatching error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/dispatching/suggest/:applicationId ──────────────────────────────
router.get('/suggest/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: { client: true, creator: true }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    const analysts = await prisma.user.findMany({
      where: { role: 'ANALYSTE_RISQUES', isActive: true },
      include: {
        assignedSteps: {
          where: { status: { in: ['PENDING', 'IN_REVIEW'] } }
        }
      }
    });

    if (analysts.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucun analyste disponible' });
    }

    const ranked = analysts
      .map(a => {
        const overdueCount = a.assignedSteps.filter(
          s => s.deadline && new Date(s.deadline) < new Date()
        ).length;
        // Bonus si même agence que le chargé d'affaires
        const sameDeptBonus = a.department === application.creator?.department ? -0.5 : 0;
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          department: a.department,
          jobTitle: a.jobTitle,
          activeCount: a.assignedSteps.length,
          pendingCount: a.assignedSteps.filter(s => s.status === 'PENDING').length,
          inReviewCount: a.assignedSteps.filter(s => s.status === 'IN_REVIEW').length,
          overdueCount,
          workloadScore: a.assignedSteps.length + overdueCount * 2 + sameDeptBonus
        };
      })
      .sort((a, b) => a.workloadScore - b.workloadScore);

    res.json({
      success: true,
      data: {
        suggested: ranked[0],
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

// ─── GET /api/dispatching/history ─────────────────────────────────────────────
// Historique des 30 dernières affectations
router.get('/history', async (req: Request, res: Response) => {
  try {
    const steps = await prisma.workflowStep.findMany({
      where: {
        role: 'ANALYSTE_RISQUES',
        assigneeId: { not: null }
      },
      include: {
        application: {
          include: {
            client: { select: { companyName: true } },
            creator: { select: { name: true, department: true } }
          }
        },
        assignee: { select: { id: true, name: true, department: true, jobTitle: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const data = steps.map(s => ({
      stepId: s.id,
      applicationId: (s as any).application.id,
      applicationNumber: (s as any).application.applicationNumber,
      clientName: (s as any).application.client.companyName,
      amount: Number((s as any).application.amount),
      currency: (s as any).application.currency,
      status: s.status,
      appStatus: (s as any).application.status,
      assignedTo: (s as any).assignee,
      accountManager: (s as any).application.creator.name,
      branch: (s as any).application.creator.department,
      assignedAt: s.createdAt,
      deadline: s.deadline,
      comments: s.comments
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/dispatching/assign ─────────────────────────────────────────────
// Affecter (ou ré-affecter) un analyste à une demande
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { applicationId, analystId, comment, isReassign } = req.body;
    const supervisorId = (req as any).user?.userId || (req as any).user?.id;

    if (!applicationId || !analystId) {
      return res.status(400).json({ success: false, error: 'applicationId et analystId requis' });
    }

    const [application, analyst] = await Promise.all([
      prisma.creditApplication.findUnique({
        where: { id: applicationId },
        include: { workflowSteps: true, client: { select: { companyName: true } } }
      }),
      prisma.user.findUnique({ where: { id: analystId } })
    ]);

    if (!application) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    if (!analyst || analyst.role !== 'ANALYSTE_RISQUES') {
      return res.status(400).json({ success: false, error: 'Analyste invalide' });
    }

    const supervisorUser = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { name: true, role: true, branch: true, department: true }
    });
    const supervisorName = supervisorUser?.name || 'Responsable Analyste';

    // ── Guard agence : un superviseur ne peut dispatcher que les dossiers de son agence.
    // Si l'acteur est un délégué, utiliser la branche du délégant.
    // Les rôles globaux (Admin, DG) peuvent dispatcher tous les dossiers.
    const GLOBAL_ROLES = ['DIRECTION_GENERALE', 'ADMIN'];
    const delegCtx = (req as any).delegationContext as {
      delegatorBranch: string | null;
      delegatorDepartment: string | null;
      delegatorRole: string;
    } | undefined;

    const effectiveRole   = delegCtx ? delegCtx.delegatorRole : (supervisorUser?.role ?? '');
    const effectiveBranch = delegCtx
      ? (delegCtx.delegatorBranch || delegCtx.delegatorDepartment)
      : ((supervisorUser as any)?.branch || (supervisorUser as any)?.department);

    if (!GLOBAL_ROLES.includes(effectiveRole)) {
      // Branche du créateur du dossier
      const appWithCreator = await prisma.creditApplication.findUnique({
        where: { id: applicationId },
        select: { creator: { select: { branch: true, department: true } } },
      });
      const creatorBranch = appWithCreator?.creator?.branch || appWithCreator?.creator?.department;
      if (effectiveBranch && creatorBranch && effectiveBranch !== creatorBranch) {
        return res.status(403).json({
          success: false,
          error: `Ce dossier appartient à l'agence "${creatorBranch}". Vous ne pouvez dispatcher que les dossiers de votre agence ("${effectiveBranch}").`,
        });
      }
      // L'analyste assigné doit aussi appartenir à la même agence
      const analystBranch = (analyst as any).branch || (analyst as any).department;
      if (effectiveBranch && analystBranch && analystBranch !== effectiveBranch) {
        return res.status(403).json({
          success: false,
          error: `L'analyste "${analyst.name}" n'appartient pas à votre agence ("${effectiveBranch}").`,
        });
      }
    }
    const dateStr = new Date().toLocaleDateString('fr-FR');

    // Chercher un step ANALYSTE_RISQUES existant (assigné ou non)
    const existingStep = application.workflowSteps.find(s => s.role === 'ANALYSTE_RISQUES');

    if (existingStep) {
      await prisma.workflowStep.update({
        where: { id: existingStep.id },
        data: {
          assigneeId: analystId,
          status: 'PENDING',
          comments: comment ||
            (isReassign
              ? `Ré-affecté à ${analyst.name} par ${supervisorName} le ${dateStr}`
              : `Affecté à ${analyst.name} par ${supervisorName} le ${dateStr}`)
        }
      });
    } else {
      await prisma.workflowStep.create({
        data: {
          applicationId,
          stepName: 'credit_analysis',
          role: 'ANALYSTE_RISQUES',
          assigneeId: analystId,
          status: 'PENDING',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          comments: comment || `Affecté à ${analyst.name} par ${supervisorName} le ${dateStr}`
        }
      });
    }

    if (application.status === 'SUBMITTED') {
      await prisma.creditApplication.update({
        where: { id: applicationId },
        data: { status: 'UNDER_REVIEW' }
      });
    }

    // Notifier directement l'analyste assigné
    const clientName = (application as any).client?.companyName ?? 'Client';
    await createInAppNotification(analystId, {
      title: isReassign
        ? `Dossier ré-affecté — ${application.applicationNumber}`
        : `Nouveau dossier à analyser — ${application.applicationNumber}`,
      message: `Le dossier de ${clientName} (${application.applicationNumber}) vous a été ${isReassign ? 'ré-affecté' : 'affecté'} par ${supervisorName}. Veuillez procéder à l'analyse crédit.`,
      type: 'ACTION_REQUIRED',
      relatedType: 'application',
      relatedId: applicationId,
      actionUrl: `/workflow?applicationId=${applicationId}`,
    });

    res.json({
      success: true,
      message: isReassign
        ? `Dossier ${application.applicationNumber} ré-affecté à ${analyst.name}`
        : `Dossier ${application.applicationNumber} affecté à ${analyst.name}`,
      data: { applicationId, analystId, analystName: analyst.name }
    });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'affectation' });
  }
});

export default router;
