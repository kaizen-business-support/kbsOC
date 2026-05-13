/**
 * contractAccess.ts
 *
 * Règles d'accès aux contrats signés (Document.category = CONTRACT)
 * affichés depuis la fiche client.
 *
 * - Listing + preview : tout utilisateur ayant accès à la fiche client.
 *   (Le filtre tenant + le scope client est appliqué côté route.)
 * - Téléchargement : restreint via canDownloadContract().
 *
 * Helper pur (pas de dépendance runtime à Prisma — uniquement les types d'enum).
 */

import type { UserRole } from '@prisma/client';

export const CONTRACT_DOWNLOAD_ROLES = [
  'BACK_OFFICE',
  'DIRECTION_JURIDIQUE',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export const CONTRACT_ELIGIBLE_APPLICATION_STATUSES = [
  'APPROVED',
  'DISBURSED',
  'UNDER_REVIEW',
] as const;

interface UserCtx {
  role: UserRole;
  branch: string | null;
  department: string | null;
}

interface ClientCtx {
  creator: { branch: string | null; department: string | null };
}

const downloadRoles: ReadonlySet<UserRole> = new Set(CONTRACT_DOWNLOAD_ROLES);

/**
 * Retourne true si l'utilisateur a le droit de télécharger un contrat
 * appartenant au client donné.
 */
export function canDownloadContract(user: UserCtx, client: ClientCtx): boolean {
  if (downloadRoles.has(user.role)) {
    return true;
  }
  if (user.role !== 'CHARGE_AFFAIRES') {
    return false;
  }
  const userScope = user.branch ?? user.department;
  const creatorScope = client.creator.branch ?? client.creator.department;
  if (!userScope || !creatorScope) return false;
  return userScope === creatorScope;
}

export const CONTRACT_DOWNLOAD_DENIED_MESSAGE =
  "Téléchargement réservé aux services Back-office / Juridique ou aux chargés d'affaires de l'agence concernée.";
