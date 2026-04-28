import { mergeModuleProfile, resolveDataScope } from '../services/moduleProfileService';
import { ModuleAccess } from '../constants/defaultModuleProfiles';

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
