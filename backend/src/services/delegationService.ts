import { UserRole } from '@prisma/client';
import { prisma } from '../prismaClient';

// ─── Actions déléguables ──────────────────────────────────────────────────────
export const DELEGATABLE_ACTIONS = [
  'APPROVE_WORKFLOW',
  'REJECT_WORKFLOW',
  'DISPATCH_APPLICATION',
  'START_STEP',
] as const;

export type DelegatableAction = typeof DELEGATABLE_ACTIONS[number];

// ─── Résolution d'une délégation active ──────────────────────────────────────
/**
 * Si l'utilisateur est délégué actif pour l'action donnée, retourne les
 * informations du délégant. Sinon, retourne null.
 *
 * Conditions d'activation :
 *   - isActive = true
 *   - startDate <= now <= endDate
 *   - action dans permissions
 */
export async function resolveDelegation(
  userId: string,
  action: DelegatableAction
): Promise<{
  delegationId: string;
  delegatorId: string;
  delegatorRole: UserRole;
  delegatorBranch: string | null;
  delegatorDepartment: string | null;
  delegatorName: string;
} | null> {
  const now = new Date();

  const delegation = await (prisma as any).powerDelegation.findFirst({
    where: {
      delegateId: userId,
      isActive: true,
      startDate: { lte: now },
      endDate:   { gte: now },
    },
    include: {
      delegator: {
        select: { id: true, name: true, role: true, branch: true, department: true },
      },
    },
  });

  if (!delegation) return null;

  const perms = delegation.permissions as string[];
  if (!perms.includes(action)) return null;

  return {
    delegationId:        delegation.id,
    delegatorId:         delegation.delegator.id,
    delegatorRole:       delegation.delegator.role as UserRole,
    delegatorBranch:     delegation.delegator.branch,
    delegatorDepartment: delegation.delegator.department,
    delegatorName:       delegation.delegator.name,
  };
}

// ─── Synchronisation du statut "En congé" ────────────────────────────────────
/**
 * Met à jour isOnLeave sur le délégant en fonction de ses délégations actives.
 * À appeler après création, révocation, ou expiration d'une délégation.
 */
export async function syncLeaveStatus(delegatorId: string): Promise<void> {
  const now = new Date();
  const activeDelegation = await (prisma as any).powerDelegation.findFirst({
    where: {
      delegatorId,
      isActive: true,
      startDate: { lte: now },
      endDate:   { gte: now },
    },
  });

  await prisma.user.update({
    where: { id: delegatorId },
    data: { isOnLeave: !!activeDelegation } as any,
  });
}

// ─── Création d'une délégation ────────────────────────────────────────────────
export interface CreateDelegationInput {
  delegatorId:     string;
  delegateId:      string;
  startDate:       Date;
  endDate:         Date;
  reason?:         string;
  permissions:     DelegatableAction[];
  createdById:     string;
  maxDurationDays?: number;
}

export async function createDelegation(input: CreateDelegationInput) {
  const {
    delegatorId, delegateId, startDate, endDate,
    reason, permissions, createdById, maxDurationDays,
  } = input;

  // ── Validation durée ──────────────────────────────────────────────────────
  const durationMs   = endDate.getTime() - startDate.getTime();
  const durationDays = durationMs / (1000 * 60 * 60 * 24);
  if (durationDays <= 0) {
    throw new Error('La date de fin doit être après la date de début.');
  }
  if (maxDurationDays && durationDays > maxDurationDays) {
    throw new Error(`Durée maximale de délégation : ${maxDurationDays} jours.`);
  }

  // ── Validation du délégué ─────────────────────────────────────────────────
  const delegateUser = await prisma.user.findUnique({
    where: { id: delegateId },
    select: { isActive: true },
  });
  if (!delegateUser || !delegateUser.isActive) {
    throw new Error('Délégué introuvable ou inactif.');
  }

  // ── Pas de re-délégation : le délégué ne doit pas lui-même avoir une délégation active ──
  const delegateHasActiveDelegation = await (prisma as any).powerDelegation.findFirst({
    where: {
      delegatorId: delegateId,
      isActive: true,
      startDate: { lte: endDate },
      endDate:   { gte: startDate },
    },
  });
  if (delegateHasActiveDelegation) {
    throw new Error('Le délégué a lui-même une délégation active : la re-délégation est interdite.');
  }

  // ── Permissions valides ───────────────────────────────────────────────────
  const invalidPerms = permissions.filter(p => !DELEGATABLE_ACTIONS.includes(p));
  if (invalidPerms.length > 0) {
    throw new Error(`Actions invalides : ${invalidPerms.join(', ')}`);
  }
  if (permissions.length === 0) {
    throw new Error('Au moins une action doit être déléguée.');
  }

  const now = new Date();

  // ── Révoquer toute délégation active existante pour ce délégant ──────────
  const existing = await (prisma as any).powerDelegation.findFirst({
    where: { delegatorId, isActive: true },
  });
  if (existing) {
    await (prisma as any).powerDelegation.update({
      where: { id: existing.id },
      data:  { isActive: false, revokedAt: now, revokedById: createdById },
    });
  }

  // ── Créer la délégation ───────────────────────────────────────────────────
  const delegation = await (prisma as any).powerDelegation.create({
    data: {
      delegatorId,
      delegateId,
      startDate,
      endDate,
      reason: reason || null,
      permissions,
      isActive: true,
      createdById,
    },
  });

  // ── Mettre à jour isOnLeave si la délégation commence maintenant ──────────
  if (startDate <= now) {
    await syncLeaveStatus(delegatorId);
  }

  return delegation;
}

// ─── Révocation d'une délégation ─────────────────────────────────────────────
export async function revokeDelegation(
  delegationId: string,
  revokedById: string
): Promise<void> {
  const delegation = await (prisma as any).powerDelegation.findUnique({
    where: { id: delegationId },
  });
  if (!delegation || !delegation.isActive) {
    throw new Error('Délégation introuvable ou déjà inactive.');
  }

  await (prisma as any).powerDelegation.update({
    where: { id: delegationId },
    data: {
      isActive:    false,
      revokedAt:   new Date(),
      revokedById,
    },
  });

  await syncLeaveStatus(delegation.delegatorId);
}

// ─── Expiration automatique ───────────────────────────────────────────────────
/**
 * Désactive toutes les délégations dont endDate est passé.
 * Appelée au démarrage du serveur.
 */
export async function expireStaleActiveDelegations(): Promise<number> {
  const now = new Date();
  const stale = await (prisma as any).powerDelegation.findMany({
    where: { isActive: true, endDate: { lt: now } },
    select: { id: true, delegatorId: true },
  });

  for (const d of stale) {
    await (prisma as any).powerDelegation.update({
      where: { id: d.id },
      data:  { isActive: false },
    });
    await syncLeaveStatus(d.delegatorId);
  }

  return stale.length;
}
