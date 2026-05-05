import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, LinearProgress,
} from '@mui/material';
import { AccessTime as ClockIcon } from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';

const IDLE_TIMEOUT_MS   = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS =  2 * 60 * 1000; // Avertissement 2 min avant
const WARNING_SECONDS   = WARNING_BEFORE_MS / 1000;

const ACTIVITY_EVENTS = [
  'mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll',
] as const;

export const SessionTimeoutDialog: React.FC = () => {
  const { state, logout } = useUser();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  // Refs stables pour éviter les re-subscriptions inutiles
  const logoutRef   = useRef(logout);
  const warningRef  = useRef(false); // true quand le dialog est visible

  useEffect(() => { logoutRef.current = logout; }, [logout]);

  const timers = useRef<{
    warning:   ReturnType<typeof setTimeout>  | undefined;
    logout:    ReturnType<typeof setTimeout>  | undefined;
    countdown: ReturnType<typeof setInterval> | undefined;
  }>({ warning: undefined, logout: undefined, countdown: undefined });

  const stopAll = useCallback(() => {
    clearTimeout(timers.current.warning);
    clearTimeout(timers.current.logout);
    clearInterval(timers.current.countdown);
  }, []);

  const doLogout = useCallback(() => {
    stopAll();
    warningRef.current = false;
    setShowWarning(false);
    logoutRef.current();
  }, [stopAll]);

  const startTimers = useCallback(() => {
    stopAll();
    warningRef.current = false;
    setShowWarning(false);
    setSecondsLeft(WARNING_SECONDS);

    // Afficher le dialog 2 min avant l'expiration
    timers.current.warning = setTimeout(() => {
      warningRef.current = true;
      setShowWarning(true);
      setSecondsLeft(WARNING_SECONDS);

      timers.current.countdown = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(timers.current.countdown); return 0; }
          return s - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Déconnecter automatiquement à 15 min
    timers.current.logout = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [stopAll, doLogout]);

  useEffect(() => {
    if (!state.isAuthenticated) {
      stopAll();
      setShowWarning(false);
      warningRef.current = false;
      return;
    }

    startTimers();

    const handleActivity = () => {
      // Ignorer l'activité quand le dialog est visible (l'utilisateur doit cliquer "Continuer")
      if (!warningRef.current) startTimers();
    };

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );
    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      stopAll();
    };
  // startTimers est stable grâce aux refs — on ne se ré-abonne que sur changement d'auth
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isAuthenticated]);

  if (!state.isAuthenticated) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = (secondsLeft / WARNING_SECONDS) * 100;
  const isUrgent = secondsLeft < 30;

  return (
    <Dialog open={showWarning} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ClockIcon color="warning" />
        Session sur le point d'expirer
      </DialogTitle>

      <DialogContent>
        <Typography gutterBottom>
          Votre session va expirer dans{' '}
          <Box component="strong" sx={{ color: isUrgent ? 'error.main' : 'warning.main' }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </Box>{' '}
          en raison d'inactivité.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cliquez sur <strong>Continuer</strong> pour rester connecté.
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={isUrgent ? 'error' : 'warning'}
          sx={{ borderRadius: 1, height: 6 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={doLogout} color="inherit">
          Se déconnecter
        </Button>
        <Button onClick={startTimers} variant="contained" autoFocus>
          Continuer la session
        </Button>
      </DialogActions>
    </Dialog>
  );
};
