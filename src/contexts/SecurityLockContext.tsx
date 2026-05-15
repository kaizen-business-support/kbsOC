/**
 * SecurityLockContext.tsx
 *
 * Provider qui maintient l'état de verrouillage temporel de l'utilisateur :
 *   - polling toutes les 60s sur /api/security/time-status
 *   - listener event window 'security:time-locked' (dispatché par l'axios
 *     interceptor sur 423) pour mise à jour immédiate sans attendre le poll
 *   - recovery automatique quand la fenêtre se rouvre (locked: false)
 *
 * Stop le polling au logout (currentUser absent).
 */

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { ApiService } from '../services/api';
import { useUser } from './UserContext';

const POLL_INTERVAL_MS = 60_000;

export interface SecurityLockState {
  timeLocked: boolean;
  timeLockedMessage: string | null;
  nextOpenAt: Date | null;
  refresh: () => Promise<void>;
}

export const SecurityLockContext = createContext<SecurityLockState>({
  timeLocked: false,
  timeLockedMessage: null,
  nextOpenAt: null,
  refresh: async () => {},
});

export const SecurityLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: userState } = useUser();
  const isAuthed = !!userState.currentUser;

  const [timeLocked, setTimeLocked] = useState(false);
  const [timeLockedMessage, setTimeLockedMessage] = useState<string | null>(null);
  const [nextOpenAt, setNextOpenAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await ApiService.security.timeStatus();
      const d = res.data;
      setTimeLocked(d.locked);
      setTimeLockedMessage(d.message);
      setNextOpenAt(d.nextOpen ? new Date(d.nextOpen) : null);
    } catch (e) {
      // Fail-open : on ne change pas l'état si la requête échoue
      // (ex: 401 pendant un refresh token, network blip…)
      console.warn('[SecurityLock] refresh failed', e);
    }
  }, []);

  // Polling 60s tant que l'utilisateur est authentifié
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isAuthed) {
      // Reset state au logout
      setTimeLocked(false);
      setTimeLockedMessage(null);
      setNextOpenAt(null);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthed, refresh]);

  // Event listener — hydrate immédiatement depuis l'axios interceptor 423
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as {
        message?: string;
        next_open?: string | null;
        allow_read_only?: boolean;
      };
      setTimeLocked(true);
      setTimeLockedMessage(detail?.message ?? null);
      setNextOpenAt(detail?.next_open ? new Date(detail.next_open) : null);
    }
    window.addEventListener('security:time-locked', handler);
    return () => window.removeEventListener('security:time-locked', handler);
  }, []);

  return (
    <SecurityLockContext.Provider value={{ timeLocked, timeLockedMessage, nextOpenAt, refresh }}>
      {children}
    </SecurityLockContext.Provider>
  );
};
