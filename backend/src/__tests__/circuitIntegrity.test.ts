import {
  GuardStep,
  findOrderInconsistencies,
  findSequentialBlocker,
  pickAssignmentTarget,
  resolveDispatchStep,
  checkBranchScope,
} from '../services/workflowGuards';

/**
 * Reproduction du circuit décrit dans le rapport d'incident (politique
 * POL-1784834535142), avec les incohérences constatées en base :
 *
 *   0  creation                CREATION   CHARGE_AFFAIRES     complétée
 *   1  dispatch_ca             DISPATCH   CHARGE_AFFAIRES     complétée
 *   2  analysis                ANALYSIS   CHARGE_AFFAIRES     ouverte    ← bloque
 *   3  affecte_au_risque_      DISPATCH   RESPONSABLE_RISQUES ouverte
 *   4  retour_resp_risque      ANALYSIS   RESPONSABLE_RISQUES ouverte
 *   5  go_chef_dagence         APPROVAL   RESPONSABLE_ENGAGEMENTS
 *   6  go_comite_credit        COMMITTEE  COMITE_CREDIT
 *   7  go_dg                   APPROVAL   DIRECTION_GENERALE
 */
const T0 = new Date('2026-07-29T14:00:00Z');
const at = (m: number) => new Date(T0.getTime() + m * 60_000);

function mk(
  id: string,
  order: number,
  stepType: string,
  role: string,
  over: Partial<GuardStep> = {},
): GuardStep {
  return {
    id,
    stepName: id,
    role,
    status: 'PENDING',
    completedAt: null,
    assigneeId: null,
    createdAt: at(order),
    policyStep: { order, stepLabel: id, stepType },
    ...over,
  };
}

/** Circuit sain, tout ouvert après le dispatch initial. */
function circuit(): GuardStep[] {
  return [
    mk('creation', 0, 'CREATION', 'CHARGE_AFFAIRES', { status: 'COMPLETED', completedAt: at(1) }),
    mk('dispatch_ca', 1, 'DISPATCH', 'CHARGE_AFFAIRES'),
    mk('analysis', 2, 'ANALYSIS', 'CHARGE_AFFAIRES'),
    mk('affecte_au_risque_', 3, 'DISPATCH', 'RESPONSABLE_RISQUES'),
    mk('retour_resp_risque', 4, 'ANALYSIS', 'RESPONSABLE_RISQUES'),
    mk('go_chef_dagence', 5, 'APPROVAL', 'RESPONSABLE_ENGAGEMENTS'),
    mk('go_comite_credit', 6, 'COMMITTEE', 'COMITE_CREDIT'),
    mk('go_dg', 7, 'APPROVAL', 'DIRECTION_GENERALE'),
  ];
}

describe('(a) le dispatching ne peut plus clôturer un DISPATCH d\'ordre supérieur à une étape incomplète', () => {
  it('refuse de clôturer affecte_au_risque_ tant que analysis est ouverte', () => {
    const steps = circuit().map(s => (s.id === 'dispatch_ca' ? { ...s, status: 'APPROVED', completedAt: at(5) } : s));
    const dispatch = resolveDispatchStep(steps, 'affecte_au_risque_')!;

    const blocker = findSequentialBlocker(steps, dispatch);

    expect(dispatch.id).toBe('affecte_au_risque_');
    expect(blocker).not.toBeNull();
    expect(blocker!.id).toBe('analysis');
  });

  it('autorise la clôture une fois analysis traitée', () => {
    const steps = circuit().map(s =>
      ['dispatch_ca', 'analysis'].includes(s.id) ? { ...s, status: 'APPROVED', completedAt: at(5) } : s
    );
    const dispatch = resolveDispatchStep(steps, 'affecte_au_risque_')!;
    expect(findSequentialBlocker(steps, dispatch)).toBeNull();
  });

  it('le premier dispatch affecte analysis (ordre 2), et non une étape plus lointaine', () => {
    const steps = circuit();
    const dispatch = resolveDispatchStep(steps, 'dispatch_ca')!;
    expect(pickAssignmentTarget(steps, dispatch)?.id).toBe('analysis');
  });

  it('le repli sans dispatchStepId reste sûr : il vise le DISPATCH le plus amont', () => {
    // Ancien client qui n'envoie pas dispatchStepId : on ne doit pas retenir
    // affecte_au_risque_ (ordre 3) alors que dispatch_ca (ordre 1) est ouvert.
    const steps = circuit();
    expect(resolveDispatchStep(steps, undefined)?.id).toBe('dispatch_ca');
  });

  it('après correction, aucune incohérence d\'ordre n\'est produite', () => {
    // Déroulé conforme : chaque étape complétée dans l'ordre
    const steps = circuit().map(s =>
      ['dispatch_ca', 'analysis', 'affecte_au_risque_'].includes(s.id)
        ? { ...s, status: 'APPROVED', completedAt: at(10) }
        : s
    );
    expect(findOrderInconsistencies('APP-TEST', steps)).toEqual([]);
  });
});

describe('findOrderInconsistencies — détection du dégât historique', () => {
  it('repère une étape d\'ordre 3 complétée alors que l\'ordre 2 est ouverte', () => {
    // Exactement le cas constaté : le dispatch CA a bien été fait, puis
    // affecte_au_risque_ a été clôturée en sautant analysis, restée pending.
    const steps = circuit().map(s => {
      if (s.id === 'dispatch_ca') return { ...s, status: 'APPROVED', completedAt: at(10) };
      if (s.id === 'affecte_au_risque_') return { ...s, status: 'APPROVED', completedAt: at(20) };
      return s;
    });

    const found = findOrderInconsistencies('APP-2026-000019', steps);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      applicationNumber: 'APP-2026-000019',
      completedStep: 'affecte_au_risque_',
      completedOrder: 3,
      blockingStep: 'analysis',
      blockingOrder: 2,
    });
  });

  it('signale chaque étape complétée trop tôt', () => {
    const steps = circuit().map(s =>
      ['dispatch_ca', 'affecte_au_risque_', 'retour_resp_risque'].includes(s.id)
        ? { ...s, status: 'APPROVED', completedAt: at(20) }
        : s
    );
    const found = findOrderInconsistencies('APP-2026-000018', steps);
    expect(found.map(f => f.completedStep).sort()).toEqual(['affecte_au_risque_', 'retour_resp_risque']);
  });

  it('un circuit sain ne remonte rien', () => {
    expect(findOrderInconsistencies('APP-SAIN', circuit())).toEqual([]);
  });

  it('un circuit intégralement complété ne remonte rien', () => {
    const steps = circuit().map(s => ({ ...s, status: 'APPROVED', completedAt: at(30) }));
    expect(findOrderInconsistencies('APP-FINI', steps)).toEqual([]);
  });
});

describe('(b) suggest n\'expose pas de candidat hors agence', () => {
  // Données réelles du seed : ousmane.ba est account_manager, département Thiès,
  // sans branch, et n'avait aucun dossier — donc score de charge minimal.
  interface Profil { role: string; branch: string | null; department: string | null }
  const user8: Profil = { role: 'account_manager', branch: null, department: 'Thiès' };
  const analysteDkr: Profil = { role: 'account_manager', branch: 'DKR-SG', department: 'Risques et Conformité' };

  const ranked = (candidats: Array<{ id: string; charge: number; profil: Profil }>, creatorBranch: string) =>
    candidats
      .map(c => ({
        id: c.id,
        charge: c.charge,
        eligible: checkBranchScope(c.profil, creatorBranch, { requireAttachment: true }).allowed,
      }))
      .sort((a, b) => (a.eligible !== b.eligible ? (a.eligible ? -1 : 1) : a.charge - b.charge));

  it('un compte d\'une autre agence n\'est jamais suggéré, même à charge nulle', () => {
    const classement = ranked(
      [
        { id: 'user8', charge: 0, profil: user8 },
        { id: 'ca-dkr', charge: 7, profil: analysteDkr },
      ],
      'DKR-SG',
    );

    expect(classement[0].id).toBe('ca-dkr');
    expect(classement.find(c => c.id === 'user8')!.eligible).toBe(false);
  });

  it('un compte sans agence ni département exploitable est écarté', () => {
    const orphelin: Profil = { role: 'account_manager', branch: null, department: null };
    expect(checkBranchScope(orphelin, 'DKR-SG', { requireAttachment: true }).allowed).toBe(false);
  });

  it('le motif d\'inéligibilité nomme les deux agences', () => {
    const res = checkBranchScope(user8, 'DKR-SG', { requireAttachment: true });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('DKR-SG');
    expect(res.reason).toContain('Thiès');
  });

  it('les rôles transversaux restent suggérables pour toutes les agences', () => {
    const analysteRisques: Profil = { role: 'ANALYSTE_RISQUES', branch: null, department: 'Risques' };
    expect(checkBranchScope(analysteRisques, 'DKR-SG', { requireAttachment: true }).allowed).toBe(true);
  });
});
