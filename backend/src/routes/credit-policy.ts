/**
 * credit-policy.ts — Routes de gestion de la Politique de Crédit
 *
 * La politique de crédit remplace dynamiquement les anciens
 * ApprovalLimit + WorkflowStepConfig + CreditTypeWorkflowStep.
 *
 * Endpoints :
 *   GET    /api/credit-policies               → lister toutes les politiques
 *   POST   /api/credit-policies               → créer une politique
 *   GET    /api/credit-policies/:id           → détail d'une politique avec ses étapes
 *   PUT    /api/credit-policies/:id           → mettre à jour une politique
 *   DELETE /api/credit-policies/:id           → désactiver une politique
 *   GET    /api/credit-policies/:id/steps     → lister les étapes d'une politique
 *   POST   /api/credit-policies/:id/steps     → ajouter une étape
 *   PUT    /api/credit-policies/:id/steps/:stepId  → modifier une étape
 *   DELETE /api/credit-policies/:id/steps/:stepId  → supprimer une étape
 *   GET    /api/credit-policies/preview       → simuler le circuit pour un montant/type donné
 *   GET    /api/credit-policies/analytics     → statistiques de traitement agrégées
 */

import { Router, Request, Response } from 'express';
import { PolicyStatus } from '@prisma/client';
import { prisma } from '../prismaClient';
import { buildWorkflowPlan, getApplicationProcessingStats } from '../services/workflowService';
import { STEP_NAME_FR } from '../constants/stepNames';
import { authenticate, requireCompany } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireCompany);

// ─── Étape Création par défaut ────────────────────────────────────────────────

const DEFAULT_CREATION_STEP = {
  stepName: 'creation',
  stepLabel: 'Création',
  stepType: 'CREATION' as const,
  assignedRole: 'CHARGE_AFFAIRES',
  order: 1,
  isRequired: true,
  expectedDurationHours: 24,
  maxDurationHours: 72,
  conditionMinAmount: null,
  conditionMaxAmount: null,
  approvalMinAmount: null,
  approvalMaxAmount: null,
  creditTypeIds: [],
  allowedActions: [],
  description: null,
  phase: null,
  guards: null,
  isActive: true,
};

function normalizeStepsWithCreation(clientSteps: any[]): any[] {
  const clientCreation = clientSteps.find((s: any) => s.stepType === 'CREATION');
  const nonCreation    = clientSteps.filter((s: any) => s.stepType !== 'CREATION');
  const creationStep   = {
    ...DEFAULT_CREATION_STEP,
    // Conserver le rôle et le label personnalisés si l'utilisateur les a modifiés
    ...(clientCreation?.assignedRole           && { assignedRole:           clientCreation.assignedRole }),
    ...(clientCreation?.stepLabel              && { stepLabel:              clientCreation.stepLabel }),
    ...(clientCreation?.expectedDurationHours  && { expectedDurationHours:  clientCreation.expectedDurationHours }),
    ...(clientCreation?.maxDurationHours       && { maxDurationHours:       clientCreation.maxDurationHours }),
    ...(clientCreation?.description            && { description:            clientCreation.description }),
  };
  return [
    creationStep,
    ...nonCreation.map((s: any, idx: number) => ({
      stepName: s.stepName || `step_${idx + 2}`,
      stepLabel: s.stepLabel,
      order: idx + 2,
      stepType: s.stepType,
      assignedRole: s.assignedRole,
      conditionMinAmount: s.conditionMinAmount ?? null,
      conditionMaxAmount: s.conditionMaxAmount ?? null,
      approvalMinAmount: s.approvalMinAmount ?? null,
      approvalMaxAmount: s.approvalMaxAmount ?? null,
      expectedDurationHours: s.expectedDurationHours ?? 24,
      maxDurationHours: s.maxDurationHours ?? 72,
      isRequired: s.isRequired ?? true,
      isActive: s.isActive ?? true,
      description: s.description ?? null,
      creditTypeIds: s.creditTypeIds ?? [],
      allowedActions: s.allowedActions ?? [],
      phase: s.phase ?? null,
      guards: s.guards ?? null,
    })),
  ];
}

// ─── GET /api/credit-policies ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const policies = await prisma.creditPolicy.findMany({
      where: { companyId: req.companyId },
      include: {
        _count: { select: { steps: true, applications: true } },
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('[credit-policy] GET /', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des politiques' });
  }
});

// ─── POST /api/credit-policies ────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, description, validFrom, validTo, steps } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'name et code sont obligatoires' });
    }

    // Toute nouvelle politique commence en DRAFT inactif.
    // L'activation passe exclusivement par POST /:id/activate.
    const policy = await prisma.creditPolicy.create({
      data: {
        name,
        code,
        description,
        isActive: false,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        companyId: req.companyId,
        steps: {
          create: normalizeStepsWithCreation(Array.isArray(steps) ? steps : []),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ success: true, data: policy });
  } catch (error: any) {
    console.error('[credit-policy] POST /', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ce code de politique existe déjà' });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la politique',
      detail: error?.message ?? String(error),
    });
  }
});

// ─── GET /api/credit-policies/preview ────────────────────────────────────────

router.get('/preview', async (req: Request, res: Response) => {
  try {
    const { creditTypeId, amount } = req.query;

    if (!creditTypeId || !amount) {
      return res.status(400).json({ success: false, error: 'creditTypeId et amount sont requis' });
    }

    const plan = await buildWorkflowPlan(String(creditTypeId), Number(amount), req.companyId);
    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('[credit-policy] GET /preview', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/credit-policies/analytics ──────────────────────────────────────

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, status } = req.query;

    const where: any = {};
    if (status) where.status = String(status).toUpperCase();
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(String(dateFrom));
      if (dateTo) where.createdAt.lte = new Date(String(dateTo));
    }

    const applications = await prisma.creditApplication.findMany({
      where: {
        ...where,
        status: { in: ['APPROVED', 'REJECTED'] },
        companyId: req.companyId,
      },
      select: {
        id: true,
        applicationNumber: true,
        totalDurationMinutes: true,
        status: true,
        workflowSteps: {
          select: {
            stepName: true,
            role: true,
            durationMinutes: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            isOverdue: true,
            policyStep: { select: { stepLabel: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Agrégation par étape
    const stepStats: Record<string, { count: number; totalMinutes: number; overdueCount: number; stepLabel: string }> = {};

    for (const app of applications) {
      for (const step of app.workflowSteps) {
        if (!step.completedAt) continue;

        // Calcul de la durée — ignorer les valeurs négatives (données incohérentes)
        let duration: number;
        if (step.durationMinutes != null && step.durationMinutes > 0) {
          duration = step.durationMinutes;
        } else {
          const ref = step.startedAt ?? step.createdAt;
          const computed = Math.round((step.completedAt.getTime() - ref.getTime()) / 60000);
          if (computed <= 0) continue; // ignorer si durée nulle ou négative
          duration = computed;
        }

        if (!stepStats[step.stepName]) {
          const label = (step as any).policyStep?.stepLabel ?? STEP_NAME_FR[step.stepName] ?? step.stepName;
          stepStats[step.stepName] = { count: 0, totalMinutes: 0, overdueCount: 0, stepLabel: label };
        }
        stepStats[step.stepName].count++;
        stepStats[step.stepName].totalMinutes += duration;
        if (step.isOverdue) stepStats[step.stepName].overdueCount++;
      }
    }

    const stepAverages = Object.entries(stepStats).map(([stepName, s]) => ({
      stepName,
      stepLabel: s.stepLabel,
      count: s.count,
      averageDurationMinutes: s.count > 0 ? Math.round(s.totalMinutes / s.count) : 0,
      overdueRate: s.count > 0 ? Math.round((s.overdueCount / s.count) * 100) : 0,
    }));

    // Durée totale moyenne
    const totalDurations = applications
      .map(a => a.totalDurationMinutes)
      .filter((d): d is number => d !== null);

    const avgTotal =
      totalDurations.length > 0
        ? Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length)
        : null;

    res.json({
      success: true,
      data: {
        totalApplications: applications.length,
        averageTotalDurationMinutes: avgTotal,
        stepAverages,
      },
    });
  } catch (error) {
    console.error('[credit-policy] GET /analytics', error);
    res.status(500).json({ success: false, error: 'Erreur analytics politique crédit' });
  }
});

// ─── GET /api/credit-policies/:id ────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!policy) return res.status(404).json({ success: false, error: 'Politique introuvable' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error('[credit-policy] GET /:id', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération' });
  }
});

// ─── PUT /api/credit-policies/:id ────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, validFrom, validTo, steps, expectedVersion } = req.body;

    // Vérification companyId + optimistic locking
    const current = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      select: { version: true, companyId: true, status: true },
    });
    if (!current) return res.status(404).json({ success: false, error: 'Politique introuvable' });
    if (current.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });
    if (current.status === PolicyStatus.ARCHIVED) {
      return res.status(422).json({ success: false, error: 'Une politique archivée ne peut pas être modifiée' });
    }
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: 'CONFLICT',
        message: 'La politique a été modifiée par quelqu\'un d\'autre. Veuillez recharger avant de sauvegarder.',
      });
    }

    // Remplacement complet des étapes si fourni
    if (Array.isArray(steps)) {
      await prisma.creditPolicyStep.deleteMany({ where: { policyId: req.params.id } });
      const allSteps = normalizeStepsWithCreation(steps);
      if (allSteps.length > 0) {
        await prisma.creditPolicyStep.createMany({
          data: allSteps.map((s: any) => ({ ...s, policyId: req.params.id })),
        });
      }
    }

    const policy = await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(validFrom && { validFrom: new Date(validFrom) }),
        ...(validTo && { validTo: new Date(validTo) }),
        version: { increment: 1 },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    res.json({ success: true, data: policy });
  } catch (error: any) {
    console.error('[credit-policy] PUT /:id', error);
    if (error?.code === 'P2009' || error?.message?.includes('Invalid value for argument')) {
      return res.status(400).json({
        success: false,
        error: 'Un rôle utilisé dans les étapes n\'est pas reconnu. Vérifiez les rôles assignés.',
        detail: error.message,
      });
    }
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
  }
});

// ─── DELETE /api/credit-policies/:id ─────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      select: { companyId: true, status: true },
    });
    if (!policy) return res.status(404).json({ success: false, error: 'Politique introuvable' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { status: PolicyStatus.ARCHIVED, isActive: false },
    });
    res.json({ success: true, message: 'Politique archivée' });
  } catch (error) {
    console.error('[credit-policy] DELETE /:id', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'archivage' });
  }
});

// ─── GET /api/credit-policies/:id/steps ──────────────────────────────────────

router.get('/:id/steps', async (req: Request, res: Response) => {
  try {
    const steps = await prisma.creditPolicyStep.findMany({
      where: { policyId: req.params.id },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: steps });
  } catch (error) {
    console.error('[credit-policy] GET /:id/steps', error);
    res.status(500).json({ success: false, error: 'Erreur récupération étapes' });
  }
});

// ─── POST /api/credit-policies/:id/steps ─────────────────────────────────────

router.post('/:id/steps', async (req: Request, res: Response) => {
  try {
    const {
      stepName, stepLabel, order, stepType, assignedRole,
      conditionMinAmount, conditionMaxAmount,
      approvalMinAmount, approvalMaxAmount,
      expectedDurationHours, maxDurationHours,
      isRequired, description, creditTypeIds, allowedActions, dispatchTargetRole,
    } = req.body;

    if (!stepName || !stepLabel || !stepType || !assignedRole) {
      return res.status(400).json({
        success: false,
        error: 'stepName, stepLabel, stepType et assignedRole sont obligatoires',
      });
    }

    if (stepType === 'CREATION') {
      return res.status(403).json({
        success: false,
        error: "L'étape Création est unique et ne peut pas être ajoutée manuellement",
      });
    }

    // Validation cohérence des plages de montant
    if (conditionMinAmount != null && conditionMaxAmount != null && Number(conditionMinAmount) > Number(conditionMaxAmount)) {
      return res.status(400).json({ success: false, error: 'conditionMinAmount doit être ≤ conditionMaxAmount' });
    }
    if (approvalMinAmount != null && approvalMaxAmount != null && Number(approvalMinAmount) > Number(approvalMaxAmount)) {
      return res.status(400).json({ success: false, error: 'approvalMinAmount doit être ≤ approvalMaxAmount' });
    }

    // Vérifier l'unicité du stepName dans cette politique
    const duplicate = await prisma.creditPolicyStep.findFirst({
      where: { policyId: req.params.id, stepName },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Une étape avec le nom "${stepName}" existe déjà dans cette politique`,
      });
    }

    // Calculer l'ordre si non fourni
    let stepOrder = order;
    if (!stepOrder) {
      const last = await prisma.creditPolicyStep.findFirst({
        where: { policyId: req.params.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      stepOrder = (last?.order ?? 0) + 1;
    }

    const step = await prisma.creditPolicyStep.create({
      data: {
        policyId: req.params.id,
        stepName,
        stepLabel,
        order: stepOrder,
        stepType,
        assignedRole,
        dispatchTargetRole: dispatchTargetRole ?? null,
        conditionMinAmount: conditionMinAmount ?? null,
        conditionMaxAmount: conditionMaxAmount ?? null,
        approvalMinAmount: approvalMinAmount ?? null,
        approvalMaxAmount: approvalMaxAmount ?? null,
        expectedDurationHours: expectedDurationHours ?? 24,
        maxDurationHours: maxDurationHours ?? 72,
        isRequired: isRequired ?? true,
        description: description ?? null,
        creditTypeIds: creditTypeIds ?? [],
        allowedActions: allowedActions ?? [],
      },
    });

    // Incrémenter la version de la politique
    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { version: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: step });
  } catch (error: any) {
    console.error('[credit-policy] POST /:id/steps', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Une étape avec cet ordre existe déjà dans cette politique' });
    }
    res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'étape' });
  }
});

// ─── PUT /api/credit-policies/:id/steps/:stepId ──────────────────────────────

router.put('/:id/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const {
      stepLabel, order, stepType, assignedRole,
      conditionMinAmount, conditionMaxAmount,
      approvalMinAmount, approvalMaxAmount,
      expectedDurationHours, maxDurationHours,
      isRequired, isActive, description, creditTypeIds, allowedActions, dispatchTargetRole,
    } = req.body;

    // Validation cohérence des plages de montant
    if (conditionMinAmount != null && conditionMaxAmount != null && Number(conditionMinAmount) > Number(conditionMaxAmount)) {
      return res.status(400).json({ success: false, error: 'conditionMinAmount doit être ≤ conditionMaxAmount' });
    }
    if (approvalMinAmount != null && approvalMaxAmount != null && Number(approvalMinAmount) > Number(approvalMaxAmount)) {
      return res.status(400).json({ success: false, error: 'approvalMinAmount doit être ≤ approvalMaxAmount' });
    }

    const existing = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Étape introuvable' });
    if (existing.stepType === 'CREATION' && stepType !== undefined && stepType !== 'CREATION') {
      return res.status(403).json({
        success: false,
        error: "Le type de l'étape Création ne peut pas être modifié",
      });
    }
    if (existing.stepType === 'CREATION' && order !== undefined && order !== 1) {
      return res.status(403).json({
        success: false,
        error: "L'étape Création doit rester en position 1",
      });
    }

    const step = await prisma.creditPolicyStep.update({
      where: { id: req.params.stepId },
      data: {
        ...(stepLabel !== undefined && { stepLabel }),
        ...(order !== undefined && { order }),
        ...(stepType !== undefined && { stepType }),
        ...(assignedRole !== undefined && { assignedRole }),
        ...(conditionMinAmount !== undefined && { conditionMinAmount }),
        ...(conditionMaxAmount !== undefined && { conditionMaxAmount }),
        ...(approvalMinAmount !== undefined && { approvalMinAmount }),
        ...(approvalMaxAmount !== undefined && { approvalMaxAmount }),
        ...(expectedDurationHours !== undefined && { expectedDurationHours }),
        ...(maxDurationHours !== undefined && { maxDurationHours }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isActive !== undefined && { isActive }),
        ...(description !== undefined && { description }),
        ...(creditTypeIds !== undefined && { creditTypeIds }),
        ...(allowedActions !== undefined && { allowedActions }),
        ...(dispatchTargetRole !== undefined && { dispatchTargetRole: dispatchTargetRole || null }),
      },
    });

    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { version: { increment: 1 } },
    });

    res.json({ success: true, data: step });
  } catch (error) {
    console.error('[credit-policy] PUT /:id/steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour de l\'étape' });
  }
});

// ─── DELETE /api/credit-policies/:id/steps/:stepId ───────────────────────────

router.delete('/:id/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const stepToDelete = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
    if (!stepToDelete) return res.status(404).json({ success: false, error: 'Étape introuvable' });
    if (stepToDelete.stepType === 'CREATION') {
      return res.status(403).json({
        success: false,
        error: "L'étape Création est obligatoire et ne peut pas être supprimée",
      });
    }
    await prisma.creditPolicyStep.delete({ where: { id: req.params.stepId } });

    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { version: { increment: 1 } },
    });

    res.json({ success: true, message: 'Étape supprimée' });
  } catch (error) {
    console.error('[credit-policy] DELETE /:id/steps/:stepId', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'étape' });
  }
});

// ─── Helper : validation des règles métier d'une politique ───────────────────

function getPolicyValidationErrors(
  steps: { id: string; stepType: string; assignedRole: string | null; stepLabel: string }[]
) {
  const errors: { stepId: string | null; message: string }[] = [];
  const hasDispatch = steps.some((s) => s.stepType === 'DISPATCH');
  const hasApproval = steps.some((s) => s.stepType === 'APPROVAL' || s.stepType === 'COMMITTEE');
  if (!hasDispatch) errors.push({ stepId: null, message: 'Au moins une étape DISPATCH est requise' });
  if (!hasApproval) errors.push({ stepId: null, message: 'Au moins une étape APPROVAL ou COMMITTEE est requise' });
  for (const step of steps) {
    if (!step.assignedRole) {
      errors.push({ stepId: step.id, message: `L'étape "${step.stepLabel}" n'a pas de rôle assigné` });
    }
  }
  return errors;
}

// ─── POST /api/credit-policies/:id/duplicate ─────────────────────────────────

router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const source = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!source) return res.status(404).json({ success: false, error: 'Politique source introuvable' });
    if (source.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'name et code sont obligatoires' });
    }

    const duplicate = await prisma.creditPolicy.create({
      data: {
        name,
        code,
        description: source.description,
        isActive: false,
        status: 'DRAFT',
        validFrom: new Date(),
        validTo: null,
        companyId: req.companyId,
        steps: {
          create: source.steps.map((s) => ({
            stepName:              s.stepName,
            stepLabel:             s.stepLabel,
            order:                 s.order,
            stepType:              s.stepType,
            assignedRole:          s.assignedRole,
            dispatchTargetRole:    s.dispatchTargetRole,
            conditionMinAmount:    s.conditionMinAmount,
            conditionMaxAmount:    s.conditionMaxAmount,
            approvalMinAmount:     s.approvalMinAmount,
            approvalMaxAmount:     s.approvalMaxAmount,
            expectedDurationHours: s.expectedDurationHours,
            maxDurationHours:      s.maxDurationHours,
            isRequired:            s.isRequired,
            isActive:              s.isActive,
            description:           s.description,
            creditTypeIds:         s.creditTypeIds,
            allowedActions:        s.allowedActions,
            phase:                 s.phase ?? null,
            guards:                s.guards ?? undefined,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ success: true, data: duplicate });
  } catch (error: any) {
    console.error('[credit-policy] POST /:id/duplicate', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ce code de politique existe déjà' });
    }
    res.status(500).json({ success: false, error: 'Erreur lors de la duplication' });
  }
});

// ─── POST /api/credit-policies/:id/validate ───────────────────────────────────

router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    const errors = getPolicyValidationErrors(policy.steps);
    if (errors.length > 0) return res.status(422).json({ success: false, valid: false, errors });
    res.json({ success: true, valid: true });
  } catch (error) {
    console.error('[credit-policy] POST /:id/validate', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation' });
  }
});

// ─── POST /api/credit-policies/:id/activate ──────────────────────────────────

router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });
    if (policy.status === PolicyStatus.ARCHIVED) {
      return res.status(422).json({ success: false, error: 'Une politique archivée ne peut pas être activée' });
    }

    const validationErrors = getPolicyValidationErrors(policy.steps);
    if (validationErrors.length > 0) {
      return res.status(422).json({
        success: false,
        error: 'VALIDATION_REQUIRED',
        message: 'La politique doit être validée avant activation',
        errors: validationErrors,
      });
    }

    const oldActive = await prisma.creditPolicy.findFirst({
      where: { companyId: req.companyId, status: PolicyStatus.ACTIVE, id: { not: req.params.id } },
    });

    await prisma.$transaction(async (tx) => {
      if (oldActive) {
        await tx.creditPolicy.update({
          where: { id: oldActive.id },
          data: { status: PolicyStatus.ARCHIVED, isActive: false },
        });
      }
      await tx.creditPolicy.update({
        where: { id: req.params.id },
        data: { status: PolicyStatus.ACTIVE, isActive: true },
      });
    });

    res.json({ success: true, activated: true, archivedPolicyId: oldActive?.id ?? null });
  } catch (error) {
    console.error('[credit-policy] POST /:id/activate', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'activation' });
  }
});

// ─── POST /api/credit-policies/:id/archive ───────────────────────────────────

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const policy = await prisma.creditPolicy.findUnique({
      where: { id: req.params.id },
      select: { id: true, companyId: true },
    });
    if (!policy) return res.status(404).json({ success: false, error: 'Politique non trouvée' });
    if (policy.companyId !== req.companyId) return res.status(403).json({ success: false, error: 'Accès interdit' });

    await prisma.creditPolicy.update({
      where: { id: req.params.id },
      data: { status: PolicyStatus.ARCHIVED, isActive: false },
    });

    res.json({ success: true, archived: true });
  } catch (error) {
    console.error('[credit-policy] POST /:id/archive', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'archivage' });
  }
});

// ─── GET /api/credit-policies/:id/application-stats ──────────────────────────

router.get('/:id/application-stats/:applicationId', async (req: Request, res: Response) => {
  try {
    const stats = await getApplicationProcessingStats(req.params.applicationId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[credit-policy] GET application-stats', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
