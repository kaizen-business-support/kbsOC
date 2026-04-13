import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import {
  DELEGATABLE_ACTIONS,
  createDelegation,
  revokeDelegation,
} from '../services/delegationService';
import { createInAppNotification } from '../services/notificationService';

const router = Router();

// Helper pour extraire l'userId du token JWT (cohérent avec le reste de l'app)
const getActorId = (req: Request): string =>
  (req as any).user?.userId || (req as any).user?.id;

// ─── GET /api/delegations/delegatable-actions ─────────────────────────────────
// Retourne les actions déléguables (liste constante)
router.get('/delegatable-actions', (_req: Request, res: Response) => {
  res.json({ success: true, data: DELEGATABLE_ACTIONS });
});

// ─── GET /api/delegations/my ──────────────────────────────────────────────────
// Délégations données ET reçues par l'utilisateur courant
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = getActorId(req);
    const delegations = await (prisma as any).powerDelegation.findMany({
      where: {
        OR: [{ delegatorId: userId }, { delegateId: userId }],
      },
      include: {
        delegator: { select: { id: true, name: true, role: true, branch: true } },
        delegate:  { select: { id: true, name: true, role: true, branch: true } },
        createdBy: { select: { id: true, name: true } },
        revokedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: delegations });
  } catch (error) {
    console.error('GET /delegations/my error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/delegations ─────────────────────────────────────────────────────
// Admin uniquement — toutes les délégations avec filtres optionnels
router.get('/', async (req: Request, res: Response) => {
  const actor = (req as any).user;
  if (!actor || actor.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: "Accès réservé à l'administrateur" });
  }
  try {
    const { status, delegatorId, delegateId } = req.query as Record<string, string>;
    const where: any = {};
    if (status === 'active')   where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (delegatorId) where.delegatorId = delegatorId;
    if (delegateId)  where.delegateId  = delegateId;

    const delegations = await (prisma as any).powerDelegation.findMany({
      where,
      include: {
        delegator: { select: { id: true, name: true, role: true, branch: true } },
        delegate:  { select: { id: true, name: true, role: true, branch: true } },
        createdBy: { select: { id: true, name: true } },
        revokedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: delegations });
  } catch (error) {
    console.error('GET /delegations error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/delegations ────────────────────────────────────────────────────
// Créer une délégation (admin ou utilisateur lui-même)
router.post('/', async (req: Request, res: Response) => {
  try {
    const actorId   = getActorId(req);
    const actorRole = (req as any).user?.role;
    const {
      delegatorId,
      delegateId,
      startDate,
      endDate,
      reason,
      permissions,
    } = req.body;

    // L'utilisateur ne peut créer que pour lui-même ; l'admin peut pour n'importe qui
    if (actorRole !== 'ADMIN' && actorId !== delegatorId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez créer une délégation que pour vous-même.',
      });
    }

    if (!delegatorId || !delegateId || !startDate || !endDate || !permissions?.length) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants.' });
    }

    // Vérification cohérence agence (délégué même agence que délégant, sauf Admin)
    if (actorRole !== 'ADMIN') {
      const [delegator, delegate] = await Promise.all([
        prisma.user.findUnique({ where: { id: delegatorId }, select: { branch: true, department: true } }),
        prisma.user.findUnique({ where: { id: delegateId },  select: { branch: true, department: true } }),
      ]);
      const dBranch = delegator?.branch || delegator?.department;
      const eBranch = delegate?.branch  || delegate?.department;
      if (dBranch && eBranch && dBranch !== eBranch) {
        return res.status(403).json({
          success: false,
          error: `Le délégué doit appartenir à la même agence que vous ("${dBranch}").`,
        });
      }
    }

    const delegation = await createDelegation({
      delegatorId,
      delegateId,
      startDate:  new Date(startDate),
      endDate:    new Date(endDate),
      reason,
      permissions,
      createdById: actorId,
    });

    // Notifier le délégué
    const delegatorUser = await prisma.user.findUnique({
      where: { id: delegatorId },
      select: { name: true },
    });
    const startStr = new Date(startDate).toLocaleDateString('fr-FR');
    const endStr   = new Date(endDate).toLocaleDateString('fr-FR');
    await createInAppNotification(delegateId, {
      title:       `Délégation de pouvoir reçue de ${delegatorUser?.name}`,
      message:     `${delegatorUser?.name} vous a délégué des droits du ${startStr} au ${endStr}. Vous pouvez agir en son nom pendant cette période.`,
      type:        'ACTION_REQUIRED',
      relatedType: 'delegation',
      relatedId:   delegation.id,
      actionUrl:   '/profile',
    });

    res.status(201).json({ success: true, data: delegation });
  } catch (error: any) {
    console.error('POST /delegations error:', error);
    const isValidationError = [
      'interdite', 'invalide', 'fin doit être', 'agence', 'inactif', 'Durée maximale'
    ].some(kw => error.message?.includes(kw));
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ─── PATCH /api/delegations/:id/revoke ────────────────────────────────────────
// Révoquer une délégation (admin ou délégant)
router.patch('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const actorId   = getActorId(req);
    const actorRole = (req as any).user?.role;
    const { id }    = req.params;

    const delegation = await (prisma as any).powerDelegation.findUnique({
      where: { id },
      include: {
        delegator: { select: { id: true, name: true } },
        delegate:  { select: { id: true, name: true } },
      },
    });

    if (!delegation) {
      return res.status(404).json({ success: false, error: 'Délégation introuvable.' });
    }

    if (actorRole !== 'ADMIN' && delegation.delegatorId !== actorId) {
      return res.status(403).json({
        success: false,
        error: 'Seul le délégant ou un administrateur peut révoquer cette délégation.',
      });
    }

    await revokeDelegation(id, actorId);

    // Notifier les deux parties
    await Promise.all([
      createInAppNotification(delegation.delegatorId, {
        title:       'Votre délégation de pouvoir a été révoquée',
        message:     `La délégation accordée à ${delegation.delegate.name} a été révoquée.`,
        type:        'INFO',
        relatedType: 'delegation',
        relatedId:   id,
        actionUrl:   '/profile',
      }),
      createInAppNotification(delegation.delegateId, {
        title:       'Délégation de pouvoir révoquée',
        message:     `La délégation reçue de ${delegation.delegator.name} a été révoquée.`,
        type:        'INFO',
        relatedType: 'delegation',
        relatedId:   id,
        actionUrl:   '/profile',
      }),
    ]);

    res.json({ success: true, message: 'Délégation révoquée.' });
  } catch (error: any) {
    console.error('PATCH /delegations/:id/revoke error:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

export default router;
