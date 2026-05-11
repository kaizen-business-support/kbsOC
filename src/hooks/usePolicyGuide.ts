import { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import type { PolicyGuide } from '../components/PolicyGuideDialog';

const STORAGE_KEY = 'policy_guide_seen';

function getSeenPolicyId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function markPolicySeen(policyId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, policyId);
  } catch {
    // ignore
  }
}

export function usePolicyGuide(isAuthenticated: boolean) {
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<PolicyGuide | null>(null);

  // Fetch and auto-open on first session per policy
  useEffect(() => {
    if (!isAuthenticated) return;

    ApiService.getPolicyGuide().then(r => {
      if (!r.success || !r.data) return;
      const guide: PolicyGuide = r.data;
      setPolicy(guide);

      const seenId = getSeenPolicyId();
      if (seenId !== guide.id) {
        // Petite temporisation pour laisser l'UI se stabiliser après le login
        setTimeout(() => setOpen(true), 1200);
      }
    });
  }, [isAuthenticated]);

  const openGuide = useCallback(() => {
    if (policy) setOpen(true);
  }, [policy]);

  const closeGuide = useCallback(() => {
    setOpen(false);
    if (policy) markPolicySeen(policy.id);
  }, [policy]);

  return { open, policy, openGuide, closeGuide };
}
