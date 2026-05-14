/**
 * timeRuleMatcher.ts
 *
 * Helpers purs pour évaluer si un utilisateur est dans la fenêtre
 * autorisée d'une time rule, à un instant donné. Aucune dépendance
 * Prisma. Utilise Intl.DateTimeFormat natif pour les conversions
 * timezone (pas de nouvelle lib).
 */

export type AppliesTo = 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'ROLE' | 'USER';

export interface MatchableTimeRule {
  id: string;
  daysOfWeek: number;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  appliesTo: AppliesTo;
  targetValues: string[];
  deniedMessage?: string | null;
}

export interface MatchableUser {
  id: string;
  role: string;
  branch?: string | null;
  department?: string | null;
}

export function userMatches(user: MatchableUser, rule: MatchableTimeRule): boolean {
  switch (rule.appliesTo) {
    case 'ALL':
      return true;
    case 'BRANCH':
      return !!user.branch && rule.targetValues.includes(user.branch);
    case 'DEPARTMENT':
      return !!user.department && rule.targetValues.includes(user.department);
    case 'ROLE':
      return rule.targetValues.includes(user.role);
    case 'USER':
      return rule.targetValues.includes(user.id);
    default:
      return false;
  }
}

function localParts(date: Date, timezone: string): { isoWeekday: number; hh: number; mm: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekdayShort = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';
  const minStr  = parts.find(p => p.type === 'minute')?.value ?? '0';
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const isoWeekday = map[weekdayShort] ?? 1;
  let hh = parseInt(hourStr, 10);
  if (hh === 24) hh = 0;
  return { isoWeekday, hh, mm: parseInt(minStr, 10) };
}

function parseHm(s: string): { hh: number; mm: number } | null {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function minutesOfDay(hh: number, mm: number): number {
  return hh * 60 + mm;
}

function dayBit(isoWeekday: number): number {
  return 1 << (isoWeekday - 1);
}

function prevIsoWeekday(d: number): number {
  return d === 1 ? 7 : d - 1;
}

export function windowIsOpen(rule: MatchableTimeRule, now: Date): boolean {
  if (rule.daysOfWeek === 0) return false;
  const startHm = parseHm(rule.timeStart);
  const endHm = parseHm(rule.timeEnd);
  if (!startHm || !endHm) return false;
  const startMin = minutesOfDay(startHm.hh, startHm.mm);
  const endMin = minutesOfDay(endHm.hh, endHm.mm);
  if (startMin === endMin) return false;

  const { isoWeekday, hh, mm } = localParts(now, rule.timezone);
  const nowMin = minutesOfDay(hh, mm);

  if (startMin < endMin) {
    return (rule.daysOfWeek & dayBit(isoWeekday)) !== 0
        && nowMin >= startMin && nowMin <= endMin;
  }

  if (nowMin >= startMin && (rule.daysOfWeek & dayBit(isoWeekday)) !== 0) return true;
  if (nowMin <= endMin && (rule.daysOfWeek & dayBit(prevIsoWeekday(isoWeekday))) !== 0) return true;
  return false;
}

export function ruleAppliesNow(rule: MatchableTimeRule, user: MatchableUser, now: Date): boolean {
  return userMatches(user, rule) && windowIsOpen(rule, now);
}

export interface PreviewSlot { start: string; end: string; }
export interface PreviewDay { date: string; allowed: boolean; slots: PreviewSlot[]; }

function isoDateInTz(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date);
}

export function nextWindows(rule: MatchableTimeRule, fromDate: Date, days = 7): PreviewDay[] {
  const result: PreviewDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
    const parts = localParts(d, rule.timezone);
    const dateStr = isoDateInTz(d, rule.timezone);
    const allowed = (rule.daysOfWeek & dayBit(parts.isoWeekday)) !== 0
                 && parseHm(rule.timeStart) !== null && parseHm(rule.timeEnd) !== null
                 && rule.timeStart !== rule.timeEnd;
    result.push({
      date: dateStr,
      allowed,
      slots: allowed ? [{ start: rule.timeStart, end: rule.timeEnd }] : [],
    });
  }
  return result;
}
