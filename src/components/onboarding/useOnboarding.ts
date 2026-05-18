import { createContext, useContext } from 'react';

export interface OnboardingContextValue {
  start: () => void;
  restart: () => Promise<void>;
  skip: () => void;
  isActive: boolean;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return { start: () => {}, restart: async () => {}, skip: () => {}, isActive: false };
  }
  return ctx;
}
