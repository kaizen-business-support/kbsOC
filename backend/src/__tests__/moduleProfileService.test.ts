import { mergeModuleProfile, resolveDataScope, syncPermissionsForRole } from '../services/moduleProfileService';
import { ModuleAccess } from '../constants/defaultModuleProfiles';
import { derivePermissions } from '../constants/moduleToPermissionsMap';
import { DEFAULT_ROLE_PROFILES } from '../constants/defaultModuleProfiles';

// jest.mock doit être au top-level du fichier pour être hissé correctement par Jest
jest.mock('../services/redis', () => ({ cacheDel: jest.fn().mockResolvedValue(undefined) }));

describe('resolveDataScope', () => {
  const BRANCH  = 'BRANCH_ONLY'  as const;
  const MULTI   = 'MULTI_BRANCH' as const;
  const ALL     = 'ALL_BRANCHES' as const;

  it('retourne le scope de base si pas d\'override ni délégation', () => {
    expect(resolveDataScope(BRANCH, null, null)).toBe('BRANCH_ONLY');
  });

  it('l\'override remplace le scope de base', () => {
    expect(resolveDataScope(BRANCH, MULTI, null)).toBe('MULTI_BRANCH');
  });

  it('la délégation étend au-delà de l\'override (prend le max)', () => {
    expect(resolveDataScope(MULTI, null, ALL)).toBe('ALL_BRANCHES');
  });

  it('délégation MULTI étend un override BRANCH même si la base est ALL', () => {
    // base=ALL, override=BRANCH → effective=BRANCH, délégation=MULTI → max(BRANCH,MULTI)=MULTI
    expect(resolveDataScope(ALL, BRANCH, MULTI)).toBe('MULTI_BRANCH');
  });

  it('override BRANCH ne réduit pas ALL_BRANCHES (fusion élargie uniquement)', () => {
    expect(resolveDataScope(ALL, BRANCH, null)).toBe('BRANCH_ONLY');
  });
});

describe('mergeModuleProfile', () => {
  const baseModules: Record<string, ModuleAccess> = {
    clients:   { visible: true,  actions: ['create','edit'], sections: [] },
    approvals: { visible: false, actions: [], sections: [] },
  };
  const overrideModules: Record<string, ModuleAccess> = {
    approvals: { visible: true, actions: ['approve'], sections: ['pending'] },
  };

  it('le profil rôle seul est retourné intact si pas d\'override', () => {
    const result = mergeModuleProfile(baseModules, null);
    expect(result['clients'].visible).toBe(true);
    expect(result['approvals'].visible).toBe(false);
  });

  it('l\'override remplace le module concerné', () => {
    const result = mergeModuleProfile(baseModules, overrideModules);
    expect(result['approvals'].visible).toBe(true);
    expect(result['approvals'].actions).toContain('approve');
    expect(result['approvals'].sections).toContain('pending');
  });

  it('les modules non overridés restent inchangés', () => {
    const result = mergeModuleProfile(baseModules, overrideModules);
    expect(result['clients'].actions).toContain('create');
    expect(result['clients'].visible).toBe(true);
  });

  it('un override null retourne une copie du profil de base', () => {
    const result = mergeModuleProfile(baseModules, null);
    expect(result).not.toBe(baseModules);
    expect(result['clients']).toEqual(baseModules['clients']);
  });
});

describe('derivePermissions', () => {
  it('produit view_own et view_branch pour BRANCH_ONLY', () => {
    const result = derivePermissions({}, 'BRANCH_ONLY');
    expect(result).toContain('view_own');
    expect(result).toContain('view_branch');
  });

  it('produit view_all et view_branch pour ALL_BRANCHES', () => {
    const result = derivePermissions({}, 'ALL_BRANCHES');
    expect(result).toContain('view_all');
    expect(result).toContain('view_branch');
    expect(result).not.toContain('view_own');
  });

  it('clients.visible produit view_client et manage_clients', () => {
    const result = derivePermissions(
      { clients: { visible: true, actions: [], sections: [] } },
      'BRANCH_ONLY'
    );
    expect(result).toContain('view_client');
    expect(result).toContain('manage_clients');
  });

  it('approvals.actions.approve produit committee_review et final_approval', () => {
    const result = derivePermissions(
      { approvals: { visible: true, actions: ['approve'], sections: [] } },
      'BRANCH_ONLY'
    );
    expect(result).toContain('committee_review');
    expect(result).toContain('final_approval');
    expect(result).toContain('approve_credit');
  });

  it('module non visible ne produit aucune permission', () => {
    const result = derivePermissions(
      { approvals: { visible: false, actions: ['approve'], sections: [] } },
      'BRANCH_ONLY'
    );
    expect(result).not.toContain('approve_credit');
  });

  it('produit des permissions dédoublonnées même si plusieurs actions mappent la même permission', () => {
    const result = derivePermissions(
      { clients: { visible: true, actions: ['create', 'delete'], sections: [] } },
      'BRANCH_ONLY'
    );
    const countManageClients = result.filter(p => p === 'manage_clients').length;
    expect(countManageClients).toBe(1);
  });

  it('ne produit pas manage_backup, manage_2fa_config, system_administration', () => {
    const allModules = Object.fromEntries(
      Object.keys(DEFAULT_ROLE_PROFILES['DIRECTION_GENERALE'].modules).map(k => [
        k, {
          visible: true,
          actions: (DEFAULT_ROLE_PROFILES['DIRECTION_GENERALE'].modules as any)[k]?.actions ?? [],
          sections: (DEFAULT_ROLE_PROFILES['DIRECTION_GENERALE'].modules as any)[k]?.sections ?? [],
        }
      ])
    );
    const result = derivePermissions(allModules, 'ALL_BRANCHES');
    expect(result).not.toContain('manage_backup');
    expect(result).not.toContain('manage_2fa_config');
    expect(result).not.toContain('system_administration');
  });
});

describe('syncPermissionsForRole', () => {
  const mockUpsert = jest.fn().mockResolvedValue({});
  const mockUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
  const mockFindMany = jest.fn().mockResolvedValue([
    { userId: 'u1' }, { userId: 'u2' },
  ]);
  const mockTransaction = jest.fn().mockImplementation((ops: any[]) =>
    Promise.all(ops)
  );

  const mockPrisma = {
    $transaction: mockTransaction,
    rolePermission: { upsert: mockUpsert },
    user: { updateMany: mockUpdateMany },
    companyMembership: { findMany: mockFindMany },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('appelle rolePermission.upsert avec les permissions dérivées', async () => {
    const modules = { clients: { visible: true, actions: ['create'], sections: [] } };
    await syncPermissionsForRole('CHARGE_AFFAIRES', modules, 'BRANCH_ONLY', 'company-1', mockPrisma);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'CHARGE_AFFAIRES' },
        update: expect.objectContaining({
          permissions: expect.arrayContaining(['view_client', 'create_client', 'view_branch']),
        }),
      })
    );
  });

  it('attribue ["*"] pour ADMIN sans calculer depuis le profil', async () => {
    await syncPermissionsForRole('ADMIN', {}, 'ALL_BRANCHES', 'company-1', mockPrisma);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ permissions: ['*'] }),
      })
    );
  });

  it('attribue ["*"] pour SUPER_ADMIN', async () => {
    await syncPermissionsForRole('SUPER_ADMIN', {}, 'ALL_BRANCHES', 'company-1', mockPrisma);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ permissions: ['*'] }),
      })
    );
  });
});
