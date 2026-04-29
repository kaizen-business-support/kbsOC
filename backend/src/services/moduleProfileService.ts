import { ModuleAccess, ModuleProfileData, DEFAULT_ROLE_PROFILES } from '../constants/defaultModuleProfiles';
import { prisma } from '../prismaClient';
import { derivePermissions } from '../constants/moduleToPermissionsMap';
import type { ModuleAccess as MappingModuleAccess } from '../constants/moduleToPermissionsMap';
import { cacheDel } from './redis';
import { logger } from '../utils/logger';
import type { UserRole } from '@prisma/client';

type DataScopeValue = 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES';
const SCOPE_ORDER: DataScopeValue[] = ['BRANCH_ONLY', 'MULTI_BRANCH', 'ALL_BRANCHES'];

export function resolveDataScope(
  base: DataScopeValue,
  override: DataScopeValue | null,
  delegation: DataScopeValue | null
): DataScopeValue {
  const effective = override ?? base;
  if (!delegation) return effective;
  return SCOPE_ORDER.indexOf(delegation) > SCOPE_ORDER.indexOf(effective) ? delegation : effective;
}

export function mergeModuleProfile(
  baseModules: Record<string, ModuleAccess>,
  overrideModules: Record<string, ModuleAccess> | null
): Record<string, ModuleAccess> {
  if (!overrideModules) return { ...baseModules };
  return { ...baseModules, ...overrideModules };
}

export async function getMergedProfile(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, branch: true } });
  if (!user) throw new Error('User not found');

  const roleKey = user.role as string;

  let roleProfile = await prisma.moduleProfile.findUnique({
    where: { companyId_role: { companyId, role: user.role } }
  });

  if (!roleProfile) {
    const def = DEFAULT_ROLE_PROFILES[roleKey];
    if (!def) throw new Error(`No default profile for role ${roleKey}`);
    roleProfile = await prisma.moduleProfile.create({
      data: {
        companyId,
        role: user.role,
        label: def.label,
        modules: def.modules as any,
        defaultScope: def.defaultScope as any,
        allowedBranches: def.allowedBranches,
        isDefault: true,
        createdById: userId,
      }
    });
  }

  const userOverride = await prisma.userModuleOverride.findUnique({
    where: { userId_companyId: { userId, companyId } }
  });

  const now = new Date();
  const delegation = await prisma.scopeDelegate.findFirst({
    where: {
      delegateId: userId,
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }]
    },
    orderBy: { createdAt: 'desc' }
  });

  const finalScope = resolveDataScope(
    roleProfile.defaultScope as DataScopeValue,
    (userOverride?.dataScope as DataScopeValue | null) ?? null,
    (delegation?.scope as DataScopeValue | null) ?? null
  );

  const baseBranches = userOverride?.allowedBranches?.length
    ? userOverride.allowedBranches
    : roleProfile.allowedBranches;

  let finalBranches = delegation
    ? [...new Set([...baseBranches, ...delegation.allowedBranches])]
    : baseBranches;

  if (finalScope === 'BRANCH_ONLY' && user.branch && finalBranches.length === 0) {
    finalBranches = [user.branch];
  }

  const baseModules = roleProfile.modules as unknown as Record<string, ModuleAccess>;
  const overrideModules = (userOverride?.modules as unknown as Record<string, ModuleAccess> | null) ?? null;
  const finalModules = mergeModuleProfile(baseModules, overrideModules);

  return {
    role: roleKey,
    label: roleProfile.label,
    modules: finalModules,
    dataScope: finalScope,
    allowedBranches: finalBranches,
    delegationActive: !!delegation,
    delegationActions: delegation?.allowedActions ?? [],
  };
}

export async function invalidateRoleProfileCache(
  companyId: string,
  role: string,
  prismaClient: typeof prisma
): Promise<void> {
  try {
    // Filtre direct sur CompanyMembership.role (champ direct)
    const memberships = await prismaClient.companyMembership.findMany({
      where: { companyId, role: role as UserRole },
      select: { userId: true },
    });
    await Promise.all(
      memberships.map(({ userId }) =>
        cacheDel(`module-profile:${companyId}:${userId}`).catch((err: unknown) =>
          logger.warn(`Redis invalidation failed for ${userId}:`, err)
        )
      )
    );
  } catch (err) {
    logger.warn('invalidateRoleProfileCache: Redis unavailable, skipping', err);
  }
}

export async function syncPermissionsForRole(
  role: string,
  modules: Record<string, MappingModuleAccess>,
  defaultScope: string,
  companyId: string,
  prismaClient: typeof prisma
): Promise<void> {
  const isAdminRole = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const permissions = isAdminRole ? ['*'] : derivePermissions(modules, defaultScope);

  await prismaClient.$transaction([
    prismaClient.rolePermission.upsert({
      where: { role: role as UserRole },
      update: { permissions },
      create: { role: role as any, label: role, permissions, isActive: true },
    }),
    prismaClient.user.updateMany({
      where: {
        role: role as UserRole,
        memberships: { some: { companyId } },
      },
      data: { permissions },
    }),
  ]);

  await invalidateRoleProfileCache(companyId, role, prismaClient);
}

export async function seedDefaultProfiles(companyId: string, createdById: string) {
  for (const [roleKey, def] of Object.entries(DEFAULT_ROLE_PROFILES)) {
    await prisma.moduleProfile.upsert({
      where: { companyId_role: { companyId, role: roleKey as any } },
      update: {},
      create: {
        companyId,
        role: roleKey as any,
        label: def.label,
        modules: def.modules as any,
        defaultScope: def.defaultScope as any,
        allowedBranches: def.allowedBranches,
        isDefault: true,
        createdById,
      }
    });
  }
}
