import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { useUser } from '../../contexts/UserContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { getOnboardingStatus, completeOnboarding, resetOnboarding } from '../../services/onboardingApi';
import { buildSteps, OnboardingPermissions } from './onboardingSteps';
import { OnboardingContext } from './useOnboarding';

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES: "Chargé d'affaires",
  ANALYSTE_RISQUES: 'Analyste risques',
  RESPONSABLE_RISQUES: 'Responsable risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable engagements',
  COMITE_CREDIT: 'Comité de crédit',
  DIRECTION_GENERALE: 'Direction Générale',
  DIRECTION_JURIDIQUE: 'Direction Juridique',
  BACK_OFFICE: 'Back-office',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super Administrateur',
};

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { state: userState } = useUser();
  const { canAccess } = useModuleAccess();
  const isMobile = useMediaQuery('(max-width:600px)');

  const tourRef = useRef<any | null>(null);
  const buildAndStartTourRef = useRef<() => void>(() => {});
  const destroyTourRef = useRef<() => void>(() => {});
  const autoStartedForUserRef = useRef<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const user = userState.currentUser;
  const userId = user?.id ?? null;

  const computePermissions = useCallback((): OnboardingPermissions => {
    const perms = (user?.permissions ?? []) as string[];
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const has = (perm: string) => perms.includes(perm) || perms.includes('*');
    return {
      canViewAnalytics:     has('analytics') && canAccess('analytics'),
      canViewReports:       (has('reports') || isAdmin) && canAccess('analytics'),
      canViewCodir:         (has('codir_dashboard') || isAdmin) && canAccess('codir-dashboard'),
      canViewApplications:  (has('view_applications') || has('view_own') || isAdmin) && canAccess('credit-application'),
      canFinancialAnalysis: has('financial_analysis') || has('analyze_credit'),
      canViewConfiguration: has('user_management') || isAdmin,
    };
  }, [user?.permissions, user?.role, canAccess]);

  const destroyTour = useCallback(() => {
    if (tourRef.current) {
      try { tourRef.current.complete(); } catch { /* already done */ }
      tourRef.current = null;
    }
    setIsActive(false);
  }, []);

  const buildAndStartTour = useCallback(() => {
    if (!user) return;
    destroyTour();

    const roleLabel = ROLE_LABELS[user.role] ?? '';
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 4,
        modalOverlayOpeningRadius: 8,
        classes: 'optimus-shepherd',
      },
      exitOnEsc: true,
      keyboardNavigation: true,
    });

    const steps = buildSteps({
      permissions: computePermissions(),
      isMobile,
      roleLabel,
      onComplete: () => { completeOnboarding().catch(e => console.warn('onboarding complete failed', e)); },
    });
    steps.forEach(s => tour.addStep(s));

    tour.on('complete', () => { setIsActive(false); tourRef.current = null; });
    tour.on('cancel', () => {
      completeOnboarding().catch(e => console.warn('onboarding cancel failed', e));
      setIsActive(false);
      tourRef.current = null;
    });

    tourRef.current = tour;
    setIsActive(true);
    tour.start();
  }, [user, computePermissions, isMobile, destroyTour]);

  const start = useCallback(() => {
    buildAndStartTour();
  }, [buildAndStartTour]);

  const skip = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.cancel();
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await resetOnboarding();
    } catch (e) {
      console.warn('onboarding reset failed', e);
    }
    setTimeout(() => buildAndStartTour(), 300);
  }, [buildAndStartTour]);

  // Keep refs current so the auto-launch effect can call the latest callbacks
  // without re-running on every render (callbacks change identity on each render
  // because useModuleAccess returns a fresh canAccess).
  useEffect(() => { buildAndStartTourRef.current = buildAndStartTour; }, [buildAndStartTour]);
  useEffect(() => { destroyTourRef.current = destroyTour; }, [destroyTour]);

  // Auto-launch on first login. Fires once per userId (guarded by autoStartedForUserRef)
  // to prevent re-trigger loops caused by parent context updates.
  useEffect(() => {
    if (!userId) {
      autoStartedForUserRef.current = null;
      return;
    }
    if (autoStartedForUserRef.current === userId) return;
    autoStartedForUserRef.current = userId;

    let cancelled = false;
    getOnboardingStatus()
      .then(({ shouldShow }) => {
        if (cancelled || !shouldShow) return;
        setTimeout(() => { if (!cancelled) buildAndStartTourRef.current(); }, 600);
      })
      .catch(e => console.warn('onboarding status fetch failed', e));

    return () => {
      cancelled = true;
      destroyTourRef.current();
    };
  }, [userId]);

  const value = useMemo(() => ({ start, restart, skip, isActive }), [start, restart, skip, isActive]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};
