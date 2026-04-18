/**
 * raci-matrix.ts — Routes de gestion de la Matrice RACI par tenant
 *
 * La matrice RACI est une vue/édition de la CreditPolicy active du tenant.
 * R  = CreditPolicyStep.assignedRole (source de vérité workflow)
 * A/C/I/co-R = CreditPolicyStepRole (table dédiée)
 * Mur chinois = TenantChineseWallRule (remplace le dict hardcodé dans workflowService)
 *
 * Endpoints :
 *   GET  /api/raci-matrix                         → matrice complète + utilisateurs + mur chinois
 *   PUT  /api/raci-matrix/steps/:stepId           → modifier une étape (label, assignedRole, SLA…)
 *   PUT  /api/raci-matrix/steps/:stepId/roles     → remplacer les rôles A/C/I d'une étape
 *   POST /api/raci-matrix/steps                   → créer une étape dans la politique active
 *   DELETE /api/raci-matrix/steps/:stepId         → soft-delete une étape
 *   PUT  /api/raci-matrix/chinese-wall            → remplacer les règles mur chinois du tenant
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { authenticate, requireCompany, authorize } from '../middleware/auth';
import { UserRole, RaciCode, PolicyStepType } from '@prisma/client';

const router = Router();
router.use(requireCompany);

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_USER_ROLES = ['CHARGE_AFFAIRES', 'ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES',
  'RESPONSABLE_ENGAGEMENTS', 'COMITE_CREDIT', 'DIRECTION_GENERALE', 'DIRECTION_JURIDIQUE',
  'BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'] as const;

const VALID_RACI_CODES = ['R', 'A', 'C', 'I'] as const;

// ─── GET /api/raci-matrix ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;

    const policy = await prisma.creditPolicy.findFirst({
      where: { companyId, isActive: true },
      select: { id: true, name: true, version: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!policy) {
      return res.json({ success: true, data: { policy: null, steps: [], chineseWallRules: [] } });
    }

    const steps = await prisma.creditPolicyStep.findMany({
      where: { policyId: policy.id, isActive: true },
      include: { stepRoles: { orderBy: { createdAt: 'asc' } } },
      orderBy: { order: 'asc' },
    });

    // Collect all unique roles across all steps in one pass
    const allUniqueRoles = [...new Set(
      steps.flatMap((s) => [s.assignedRole, ...s.stepRoles.map((r) => r.role)])
    )] as UserRole[];

    // Single query for all users across all roles
    const allMemberships = await prisma.companyMembership.findMany({
      where: { companyId, role: { in: allUniqueRoles }, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const membersByRole: Record<string, { id: string; name: string; email: string }[]> = {};
    for (const m of allMemberships) {
      if (!membersByRole[m.role]) membersByRole[m.role] = [];
      membersByRole[m.role].push(m.user);
    }

    const stepsWithUsers = steps.map((step) => {
      const rolesForStep = [step.assignedRole, ...step.stepRoles.map((r) => r.role)];
      const usersPerRole: Record<string, { id: string; name: string; email: string }[]> = {};
      for (const role of rolesForStep) {
        usersPerRole[role] = membersByRole[role] ?? [];
      }
      return {
        id: step.id,
        stepName: step.stepName,
        stepLabel: step.stepLabel,
        phase: step.phase,
        order: step.order,
        stepType: step.stepType,
        assignedRole: step.assignedRole,
        expectedDurationHours: step.expectedDurationHours,
        maxDurationHours: step.maxDurationHours,
        conditionMinAmount: step.conditionMinAmount,
        conditionMaxAmount: step.conditionMaxAmount,
        isRequired: step.isRequired,
        roles: step.stepRoles.map((r) => ({ role: r.role, raciCode: r.raciCode })),
        users: usersPerRole,
      };
    });

    const chineseWallRules = await prisma.tenantChineseWallRule.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ blockedRole: 'asc' }, { forbiddenStep: 'asc' }],
    });

    res.json({ success: true, data: { policy, steps: stepsWithUsers, chineseWallRules } });
  } catch (error) {
    console.error('[raci-matrix] GET /', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/steps/:stepId ───────────────────────────────────────

router.put('/steps/:stepId', authorize([], ['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const {
      stepLabel, phase, assignedRole,
      expectedDurationHours, maxDurationHours,
      conditionMinAmount, conditionMaxAmount,
    } = req.body;

    if (assignedRole !== undefined && !VALID_USER_ROLES.includes(assignedRole)) {
      return res.status(400).json({ success: false, message: `Role invalide : ${assignedRole}` });
    }

    const companyId = req.companyId!;
    const owned = await prisma.creditPolicyStep.findFirst({
      where: { id: stepId, policy: { companyId } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ success: false, error: 'Étape introuvable' });

    const step = await prisma.creditPolicyStep.update({
      where: { id: stepId },
      data: {
        ...(stepLabel !== undefined && { stepLabel }),
        ...(phase !== undefined && { phase }),
        ...(assignedRole !== undefined && { assignedRole: assignedRole as UserRole }),
        ...(expectedDurationHours !== undefined && { expectedDurationHours: Number(expectedDurationHours) }),
        ...(maxDurationHours !== undefined && { maxDurationHours: Number(maxDurationHours) }),
        ...(conditionMinAmount !== undefined && { conditionMinAmount }),
        ...(conditionMaxAmount !== undefined && { conditionMaxAmount }),
      },
    });

    res.json({ success: true, data: step });
  } catch (error) {
    console.error('[raci-matrix] PUT /steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/steps/:stepId/roles ─────────────────────────────────

router.put('/steps/:stepId/roles', authorize([], ['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const roles: { role: string; raciCode: string }[] = req.body;

    if (!Array.isArray(roles)) {
      return res.status(400).json({ success: false, error: 'body doit être un tableau [{ role, raciCode }]' });
    }

    for (const r of roles) {
      if (!VALID_USER_ROLES.includes(r.role as typeof VALID_USER_ROLES[number])) {
        return res.status(400).json({ success: false, message: `Role invalide : ${r.role}` });
      }
      if (!VALID_RACI_CODES.includes(r.raciCode as typeof VALID_RACI_CODES[number])) {
        return res.status(400).json({ success: false, message: `Code RACI invalide : ${r.raciCode}` });
      }
    }

    const companyId = req.companyId!;
    const owned = await prisma.creditPolicyStep.findFirst({
      where: { id: stepId, policy: { companyId } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ success: false, error: 'Étape introuvable' });

    await prisma.$transaction([
      prisma.creditPolicyStepRole.deleteMany({ where: { policyStepId: stepId } }),
      ...(roles.length > 0 ? [prisma.creditPolicyStepRole.createMany({
        data: roles.map((r) => ({
          policyStepId: stepId,
          role: r.role as UserRole,
          raciCode: r.raciCode as RaciCode,
        })),
      })] : []),
    ]);

    const updated = await prisma.creditPolicyStepRole.findMany({
      where: { policyStepId: stepId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[raci-matrix] PUT /steps/:stepId/roles', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/raci-matrix/steps ──────────────────────────────────────────────

router.post('/steps', authorize([], ['ADMIN']), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const { stepName, stepLabel, phase, assignedRole, order, stepType, expectedDurationHours, maxDurationHours } = req.body;

    if (!stepName || !stepLabel || !assignedRole) {
      return res.status(400).json({ success: false, error: 'stepName, stepLabel et assignedRole sont obligatoires' });
    }

    if (!VALID_USER_ROLES.includes(assignedRole)) {
      return res.status(400).json({ success: false, message: `Role invalide : ${assignedRole}` });
    }

    const policy = await prisma.creditPolicy.findFirst({
      where: { companyId, isActive: true },
    });

    if (!policy) {
      return res.status(409).json({
        success: false,
        error: 'Aucune politique de crédit active. Créez une politique avant de modifier la matrice RACI.',
      });
    }

    const step = await prisma.creditPolicyStep.create({
      data: {
        policyId: policy.id,
        stepName,
        stepLabel,
        phase: phase ?? null,
        order: order ?? 99,
        stepType: (stepType as PolicyStepType) ?? 'DISPATCH',
        assignedRole: assignedRole as UserRole,
        expectedDurationHours: expectedDurationHours ? Number(expectedDurationHours) : 24,
        maxDurationHours: maxDurationHours ? Number(maxDurationHours) : 72,
      },
    });

    res.status(201).json({ success: true, data: step });
  } catch (error) {
    console.error('[raci-matrix] POST /steps', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/raci-matrix/steps/:stepId ────────────────────────────────────

router.delete('/steps/:stepId', authorize([], ['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;

    const companyId = req.companyId!;
    const owned = await prisma.creditPolicyStep.findFirst({
      where: { id: stepId, policy: { companyId } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ success: false, error: 'Étape introuvable' });

    await prisma.creditPolicyStep.update({
      where: { id: stepId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[raci-matrix] DELETE /steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── PUT /api/raci-matrix/chinese-wall ────────────────────────────────────────

router.put('/chinese-wall', authorize([], ['ADMIN']), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId!;
    const rules: { blockedRole: string; forbiddenStep: string; reason?: string }[] = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'body doit être un tableau [{ blockedRole, forbiddenStep, reason? }]' });
    }

    for (const r of rules) {
      if (!VALID_USER_ROLES.includes(r.blockedRole as typeof VALID_USER_ROLES[number])) {
        return res.status(400).json({ success: false, message: `Role invalide : ${r.blockedRole}` });
      }
    }

    await prisma.$transaction([
      prisma.tenantChineseWallRule.deleteMany({ where: { companyId } }),
      ...(rules.length > 0 ? [prisma.tenantChineseWallRule.createMany({
        data: rules.map((r) => ({
          companyId,
          blockedRole: r.blockedRole as UserRole,
          forbiddenStep: r.forbiddenStep,
          reason: r.reason ?? null,
        })),
      })] : []),
    ]);

    const updated = await prisma.tenantChineseWallRule.findMany({
      where: { companyId },
      orderBy: [{ blockedRole: 'asc' }, { forbiddenStep: 'asc' }],
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[raci-matrix] PUT /chinese-wall', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
