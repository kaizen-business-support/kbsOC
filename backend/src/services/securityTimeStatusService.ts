/**
 * securityTimeStatusService.ts
 *
 * Calcul du statut horaire courant d'un utilisateur (locked, message,
 * nextOpen, allowReadOnly). Utilisé par l'endpoint GET /api/security/
 * time-status, qui doit toujours répondre — y compris quand l'utilisateur
 * est en dehors de la fenêtre — pour permettre au frontend de poller.
 */

import {
  userMatches, windowIsOpen, nextOpenAt,
  MatchableTimeRule, MatchableUser,
} from './timeRuleMatcher';
import {
  getCachedPlatformTimeRules, getCachedTenantTimeRules,
} from './securityRulesCache';

export interface TimeStatusResult {
  locked: boolean;
  message: string | null;
  nextOpen: Date | null;
  allowReadOnly: boolean;
}

const GENERIC_MESSAGE = 'Accès restreint en dehors des heures autorisées.';

export async function getCurrentTimeStatus(
  user: MatchableUser,
  companyId: string | null
): Promise<TimeStatusResult> {
  const platform = await getCachedPlatformTimeRules();
  const tenant = companyId ? await getCachedTenantTimeRules(companyId) : [];
  const allRules = [...platform, ...tenant];

  const rules: MatchableTimeRule[] = allRules.map(r => ({
    id: r.id,
    daysOfWeek: r.daysOfWeek,
    timeStart: r.timeStart,
    timeEnd: r.timeEnd,
    timezone: r.timezone,
    appliesTo: r.appliesTo,
    targetValues: r.targetValues,
    deniedMessage: r.deniedMessage,
    allowReadOnly: r.allowReadOnly,
  }));

  const targeting = rules.filter(r => userMatches(user, r));
  if (targeting.length === 0) {
    return { locked: false, message: null, nextOpen: null, allowReadOnly: false };
  }

  const now = new Date();
  if (targeting.some(r => windowIsOpen(r, now))) {
    return { locked: false, message: null, nextOpen: null, allowReadOnly: false };
  }

  const firstRule = targeting[0];
  return {
    locked: true,
    message: firstRule.deniedMessage ?? GENERIC_MESSAGE,
    nextOpen: nextOpenAt(rules, user, now),
    allowReadOnly: targeting.every(r => r.allowReadOnly === true),
  };
}
