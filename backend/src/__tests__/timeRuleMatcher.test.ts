import {
  userMatches, windowIsOpen, ruleAppliesNow, nextWindows,
  MatchableTimeRule, MatchableUser,
} from '../services/timeRuleMatcher';

const baseRule: MatchableTimeRule = {
  id: 'r1',
  daysOfWeek: 31,
  timeStart: '09:00',
  timeEnd: '18:00',
  timezone: 'Europe/Paris',
  appliesTo: 'ALL',
  targetValues: [],
};

const user: MatchableUser = { id: 'u1', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null };

describe('userMatches', () => {
  it('ALL → toujours vrai', () => {
    expect(userMatches(user, { ...baseRule, appliesTo: 'ALL' })).toBe(true);
  });
  it('BRANCH match exact', () => {
    expect(userMatches(user, { ...baseRule, appliesTo: 'BRANCH', targetValues: ['AGENCE_DAKAR'] })).toBe(true);
    expect(userMatches(user, { ...baseRule, appliesTo: 'BRANCH', targetValues: ['AGENCE_THIES'] })).toBe(false);
  });
  it('DEPARTMENT match exact', () => {
    const u = { ...user, department: 'JURIDIQUE' };
    expect(userMatches(u, { ...baseRule, appliesTo: 'DEPARTMENT', targetValues: ['JURIDIQUE'] })).toBe(true);
    expect(userMatches(u, { ...baseRule, appliesTo: 'DEPARTMENT', targetValues: ['RH'] })).toBe(false);
  });
  it('ROLE match exact', () => {
    expect(userMatches(user, { ...baseRule, appliesTo: 'ROLE', targetValues: ['CHARGE_AFFAIRES'] })).toBe(true);
    expect(userMatches(user, { ...baseRule, appliesTo: 'ROLE', targetValues: ['ADMIN'] })).toBe(false);
  });
  it('USER match exact', () => {
    expect(userMatches(user, { ...baseRule, appliesTo: 'USER', targetValues: ['u1'] })).toBe(true);
    expect(userMatches(user, { ...baseRule, appliesTo: 'USER', targetValues: ['u2'] })).toBe(false);
  });
  it('targetValues vide → false (sauf ALL)', () => {
    expect(userMatches(user, { ...baseRule, appliesTo: 'BRANCH', targetValues: [] })).toBe(false);
  });
  it('user.branch null → false pour BRANCH', () => {
    const u = { ...user, branch: null };
    expect(userMatches(u, { ...baseRule, appliesTo: 'BRANCH', targetValues: ['AGENCE_DAKAR'] })).toBe(false);
  });
});

describe('windowIsOpen — même journée (Europe/Paris)', () => {
  const monday12h_paris = new Date('2026-05-11T10:00:00Z');
  const monday23h_paris = new Date('2026-05-11T21:00:00Z');
  const sunday12h_paris = new Date('2026-05-10T10:00:00Z');

  it('lundi 12h dans 9h-18h → match', () => {
    expect(windowIsOpen(baseRule, monday12h_paris)).toBe(true);
  });
  it('lundi 23h hors 9h-18h → no match', () => {
    expect(windowIsOpen(baseRule, monday23h_paris)).toBe(false);
  });
  it('dimanche 12h (jour non actif) → no match', () => {
    expect(windowIsOpen(baseRule, sunday12h_paris)).toBe(false);
  });
});

describe('windowIsOpen — chevauchement minuit', () => {
  const night: MatchableTimeRule = { ...baseRule, timeStart: '22:00', timeEnd: '06:00' };

  it('mardi 03h Paris → match (fenêtre démarrée lundi)', () => {
    expect(windowIsOpen(night, new Date('2026-05-12T01:00:00Z'))).toBe(true);
  });
  it('lundi 23h Paris → match', () => {
    expect(windowIsOpen(night, new Date('2026-05-11T21:00:00Z'))).toBe(true);
  });
  it('lundi 12h → no match', () => {
    expect(windowIsOpen(night, new Date('2026-05-11T10:00:00Z'))).toBe(false);
  });
  it('dimanche 03h → no match (samedi pas dans bitmask 31)', () => {
    expect(windowIsOpen(night, new Date('2026-05-10T01:00:00Z'))).toBe(false);
  });
});

describe('windowIsOpen — bitmask', () => {
  const onlyMonday: MatchableTimeRule = { ...baseRule, daysOfWeek: 1 };
  it('lundi → match', () => {
    expect(windowIsOpen(onlyMonday, new Date('2026-05-11T10:00:00Z'))).toBe(true);
  });
  it('mardi → no match', () => {
    expect(windowIsOpen(onlyMonday, new Date('2026-05-12T10:00:00Z'))).toBe(false);
  });
});

describe('windowIsOpen — cas dégénérés', () => {
  it('daysOfWeek=0 → jamais match', () => {
    expect(windowIsOpen({ ...baseRule, daysOfWeek: 0 }, new Date('2026-05-11T10:00:00Z'))).toBe(false);
  });
  it('timeStart == timeEnd → fenêtre vide → no match', () => {
    expect(windowIsOpen({ ...baseRule, timeStart: '09:00', timeEnd: '09:00' }, new Date('2026-05-11T10:00:00Z'))).toBe(false);
  });
});

describe('ruleAppliesNow', () => {
  it('user vise && fenêtre ouverte → true', () => {
    expect(ruleAppliesNow(baseRule, user, new Date('2026-05-11T10:00:00Z'))).toBe(true);
  });
  it('user vise && fenêtre fermée → false', () => {
    expect(ruleAppliesNow(baseRule, user, new Date('2026-05-11T21:00:00Z'))).toBe(false);
  });
  it('user pas visé → false', () => {
    const r: MatchableTimeRule = { ...baseRule, appliesTo: 'BRANCH', targetValues: ['AGENCE_THIES'] };
    expect(ruleAppliesNow(r, user, new Date('2026-05-11T10:00:00Z'))).toBe(false);
  });
});

describe('nextWindows', () => {
  it('lun-ven 9-18 sur 7 jours depuis lundi → 5 jours autorisés', () => {
    const monday = new Date('2026-05-11T08:00:00Z');
    const result = nextWindows(baseRule, monday, 7);
    expect(result).toHaveLength(7);
    const allowedCount = result.filter(d => d.allowed).length;
    expect(allowedCount).toBe(5);
    for (const d of result.filter(d => d.allowed)) {
      expect(d.slots).toEqual([{ start: '09:00', end: '18:00' }]);
    }
  });
});
