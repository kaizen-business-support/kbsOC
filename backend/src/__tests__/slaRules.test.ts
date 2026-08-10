import {
  SlaStep,
  isStepOverdue,
  shouldMarkOverdue,
  shouldNotifyOverdue,
  shouldEscalate,
  elapsedHours,
  DEFAULT_RELANCE_COOLDOWN_HOURS,
} from '../services/slaRules';

/**
 * Scénario de référence : une étape créée le 25/07 avec échéance au 30/07,
 * toujours ouverte le 10/08 — exactement la situation des dossiers restés figés
 * sans qu'aucun indicateur ne bascule.
 */
const CREATED = new Date('2026-07-25T09:00:00Z');
const DEADLINE = new Date('2026-07-30T17:00:00Z');
const NOW = new Date('2026-08-10T09:00:00Z');

const hoursBefore = (ref: Date, h: number) => new Date(ref.getTime() - h * 3_600_000);

function slaStep(over: Partial<SlaStep> = {}): SlaStep {
  return {
    id: 'ws-1',
    completedAt: null,
    deadline: DEADLINE,
    isOverdue: false,
    notifiedAt: null,
    isEscalated: false,
    startedAt: null,
    createdAt: CREATED,
    assigneeId: 'u-analyste',
    maxDurationHours: 72,
    ...over,
  };
}

describe('isStepOverdue / shouldMarkOverdue — (c) passage en retard', () => {
  it('une étape ouverte dont l\'échéance est passée est en retard', () => {
    expect(isStepOverdue(slaStep(), NOW)).toBe(true);
    expect(shouldMarkOverdue(slaStep(), NOW)).toBe(true);
  });

  it('une étape dont l\'échéance n\'est pas atteinte ne l\'est pas', () => {
    const avant = new Date('2026-07-29T09:00:00Z');
    expect(isStepOverdue(slaStep(), avant)).toBe(false);
    expect(shouldMarkOverdue(slaStep(), avant)).toBe(false);
  });

  it('une étape complétée n\'est jamais en retard, même échéance dépassée', () => {
    const done = slaStep({ completedAt: new Date('2026-08-01T10:00:00Z') });
    expect(isStepOverdue(done, NOW)).toBe(false);
    expect(shouldMarkOverdue(done, NOW)).toBe(false);
  });

  it('une étape sans échéance n\'est pas en retard', () => {
    expect(isStepOverdue(slaStep({ deadline: null }), NOW)).toBe(false);
  });

  it('idempotence : le drapeau déjà posé n\'est pas réécrit', () => {
    expect(shouldMarkOverdue(slaStep({ isOverdue: true }), NOW)).toBe(false);
  });
});

describe('shouldNotifyOverdue — relance sans spam', () => {
  it('relance une étape en retard jamais notifiée', () => {
    expect(shouldNotifyOverdue(slaStep(), NOW)).toBe(true);
  });

  it('ne relance pas deux fois dans la fenêtre de silence', () => {
    const step = slaStep({ notifiedAt: hoursBefore(NOW, 2) });
    expect(shouldNotifyOverdue(step, NOW)).toBe(false);
  });

  it('relance à nouveau une fois la fenêtre écoulée', () => {
    const step = slaStep({ notifiedAt: hoursBefore(NOW, DEFAULT_RELANCE_COOLDOWN_HOURS + 1) });
    expect(shouldNotifyOverdue(step, NOW)).toBe(true);
  });

  it('la fenêtre de silence est paramétrable', () => {
    const step = slaStep({ notifiedAt: hoursBefore(NOW, 5) });
    expect(shouldNotifyOverdue(step, NOW, 4)).toBe(true);
    expect(shouldNotifyOverdue(step, NOW, 6)).toBe(false);
  });

  it('ne relance jamais une étape qui n\'est pas en retard', () => {
    const avant = new Date('2026-07-29T09:00:00Z');
    expect(shouldNotifyOverdue(slaStep(), avant)).toBe(false);
  });
});

describe('shouldEscalate — au-delà du délai maximum de politique', () => {
  it('escalade quand le délai maximum est dépassé', () => {
    // créée le 25/07, max 72 h → dépassé bien avant le 10/08
    expect(shouldEscalate(slaStep(), NOW)).toBe(true);
  });

  it('n\'escalade pas tant que le délai maximum court encore', () => {
    const now = new Date(CREATED.getTime() + 48 * 3_600_000);
    expect(shouldEscalate(slaStep(), now)).toBe(false);
  });

  it('compte à partir de la prise en charge si l\'étape a été démarrée', () => {
    const startedAt = hoursBefore(NOW, 10);
    expect(shouldEscalate(slaStep({ startedAt }), NOW)).toBe(false);
    expect(elapsedHours(slaStep({ startedAt }), NOW)).toBeCloseTo(10, 5);
  });

  it('idempotence : une étape déjà escaladée ne l\'est pas deux fois', () => {
    expect(shouldEscalate(slaStep({ isEscalated: true }), NOW)).toBe(false);
  });

  it('sans délai maximum de politique, pas d\'escalade automatique', () => {
    expect(shouldEscalate(slaStep({ maxDurationHours: null }), NOW)).toBe(false);
    expect(shouldEscalate(slaStep({ maxDurationHours: 0 }), NOW)).toBe(false);
  });

  it('une étape complétée n\'est jamais escaladée', () => {
    expect(shouldEscalate(slaStep({ completedAt: NOW }), NOW)).toBe(false);
  });
});

describe('scénario complet — étape figée depuis le 30/07', () => {
  it('bascule en retard, déclenche une relance puis une escalade', () => {
    const step = slaStep();
    expect(shouldMarkOverdue(step, NOW)).toBe(true);
    expect(shouldNotifyOverdue(step, NOW)).toBe(true);
    expect(shouldEscalate(step, NOW)).toBe(true);

    // Après un premier passage du moniteur, rien ne se redéclenche
    const apres = slaStep({ isOverdue: true, notifiedAt: NOW, isEscalated: true });
    expect(shouldMarkOverdue(apres, NOW)).toBe(false);
    expect(shouldNotifyOverdue(apres, NOW)).toBe(false);
    expect(shouldEscalate(apres, NOW)).toBe(false);
  });
});
