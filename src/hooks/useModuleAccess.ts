import { useModuleProfile } from '../contexts/ModuleProfileContext';

export function useModuleAccess() {
  const { profile, loading } = useModuleProfile();

  // Fail-open: if profile not loaded yet, allow access (real guards are backend-side)
  const canAccess = (moduleKey: string): boolean => {
    if (loading || !profile) return true;
    return profile.modules[moduleKey]?.visible ?? false;
  };

  const canAction = (moduleKey: string, action: string): boolean => {
    if (loading || !profile) return true;
    const mod = profile.modules[moduleKey];
    if (!mod?.visible) return false;
    return mod.actions.includes(action);
  };

  const canSeeSection = (moduleKey: string, section: string): boolean => {
    if (loading || !profile) return true;
    const mod = profile.modules[moduleKey];
    if (!mod?.visible) return false;
    // empty sections array means all sections visible
    if (mod.sections.length === 0) return true;
    return mod.sections.includes(section);
  };

  return { canAccess, canAction, canSeeSection, profile, loading };
}
