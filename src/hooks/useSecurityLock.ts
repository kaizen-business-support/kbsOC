/**
 * useSecurityLock — hook public consommé par les CTAs métier.
 *
 * Retourne `{ disabled, reason, nextOpenAt }` :
 *   - `disabled`  : true quand l'utilisateur est verrouillé hors fenêtre.
 *   - `reason`    : message à afficher (tooltip native) ou null.
 *   - `nextOpenAt`: prochaine ouverture connue, pour countdown éventuel.
 *
 * Usage type :
 *   const { disabled, reason } = useSecurityLock();
 *   <Button disabled={disabled} title={disabled ? reason ?? '' : undefined}>…</Button>
 */

import { useContext } from 'react';
import { SecurityLockContext } from '../contexts/SecurityLockContext';

export function useSecurityLock(): {
  disabled: boolean;
  reason: string | null;
  nextOpenAt: Date | null;
} {
  const { timeLocked, timeLockedMessage, nextOpenAt } = useContext(SecurityLockContext);
  return {
    disabled: timeLocked,
    reason: timeLocked ? timeLockedMessage : null,
    nextOpenAt,
  };
}
