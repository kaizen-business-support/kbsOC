/**
 * home-pulse.ts
 *
 * Endpoints "pulse" pour la page d'accueil :
 * - GET /api/home/opinion-pulse      → synthèse 7j des avis Favorable/Défavorable du tenant
 * - GET /api/home/stuck-applications → top 5 dossiers en cours considérés "enlisés"
 *                                      (daysSinceLastAction > 5 OU isOverdue=true)
 *
 * Lecture seule, scope tenant strict, fail-open : si une agrégation casse on
 * renvoie des défauts vides plutôt que 500.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany } from '../middleware/auth';
import { STEP_NAME_FR } from '../constants/stepNames';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// ─── /api/home/opinion-pulse ─────────────────────────────────────────────────

router.get('/opinion-pulse', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const apps = await prisma.creditApplication.findMany({
      where: { companyId, updatedAt: { gte: since } },
      select: { analysisResults: true },
    });

    let favorable = 0;
    let defavorable = 0;
    // Bucket par jour ISO (UTC).
    const buckets = new Map<string, { favorable: number; defavorable: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { favorable: 0, defavorable: 0 });
    }

    for (const a of apps) {
      const comments = (a.analysisResults as any)?.comments;
      if (!Array.isArray(comments)) continue;
      for (const c of comments) {
        if (c?.opinion !== 'favorable' && c?.opinion !== 'defavorable') continue;
        const ts = c?.updatedAt ?? c?.createdAt;
        const day = typeof ts === 'string' ? ts.slice(0, 10) : null;
        if (c.opinion === 'favorable') favorable++;
        else defavorable++;
        if (day && buckets.has(day)) {
          const b = buckets.get(day)!;
          if (c.opinion === 'favorable') b.favorable++;
          else b.defavorable++;
        }
      }
    }

    const last7Days = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      favorable: v.favorable,
      defavorable: v.defavorable,
    }));

    return res.json({
      success: true,
      data: {
        totalCommentsWithOpinion: favorable + defavorable,
        favorable,
        defavorable,
        last7Days,
      },
    });
  } catch (err) {
    console.error('[home-pulse] opinion-pulse error:', err);
    return res.json({
      success: true,
      data: { totalCommentsWithOpinion: 0, favorable: 0, defavorable: 0, last7Days: [] },
    });
  }
});

// ─── /api/home/stuck-applications ────────────────────────────────────────────

router.get('/stuck-applications', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const now = Date.now();

    const steps = await prisma.workflowStep.findMany({
      where: {
        completedAt: null,
        status: { in: ['PENDING', 'IN_REVIEW'] },
        application: {
          companyId,
          status: { notIn: ['APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'] },
        },
      },
      include: {
        application: {
          select: {
            id: true, applicationNumber: true, amount: true, currency: true,
            analysisResults: true,
            client: { select: { companyName: true } },
          },
        },
        policyStep: { select: { stepLabel: true } },
      },
      orderBy: [{ isOverdue: 'desc' }, { createdAt: 'asc' }],
    });

    // Une étape par dossier (la plus ancienne en cours).
    const byApp = new Map<string, typeof steps[number]>();
    for (const s of steps) {
      if (!byApp.has(s.applicationId)) byApp.set(s.applicationId, s);
    }

    const enriched = Array.from(byApp.values()).map((s) => {
      const lastActionTs = (s.startedAt ?? s.createdAt).getTime();
      const daysSinceLastAction = Math.floor((now - lastActionTs) / 86_400_000);
      const comments = (s.application.analysisResults as any)?.comments;
      const hasNegativeOpinion = Array.isArray(comments)
        && comments.some((c: any) => c?.opinion === 'defavorable');
      return {
        applicationId: s.application.id,
        applicationNumber: s.application.applicationNumber,
        clientName: s.application.client?.companyName ?? '—',
        amount: Number(s.application.amount),
        currency: s.application.currency,
        currentStepLabel: s.policyStep?.stepLabel ?? STEP_NAME_FR[s.stepName] ?? s.stepName,
        currentRoleLabel: s.role,
        daysSinceLastAction,
        isOverdue: s.isOverdue,
        hasNegativeOpinion,
      };
    });

    const stuck = enriched
      .filter((e) => e.daysSinceLastAction > 5 || e.isOverdue)
      .sort((a, b) => b.daysSinceLastAction - a.daysSinceLastAction)
      .slice(0, 5);

    return res.json({ success: true, data: stuck });
  } catch (err) {
    console.error('[home-pulse] stuck-applications error:', err);
    return res.json({ success: true, data: [] });
  }
});

export default router;
