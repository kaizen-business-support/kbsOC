import {
  GuardStep,
  findSequentialBlocker,
  sequentialBlockReason,
  checkBranchScope,
  pickAssignmentTarget,
  resolveDispatchStep,
} from '../services/workflowGuards';

/**
 * Circuit de référence (politique BCI) :
 *   0  application_created       CREATION   CHARGE_AFFAIRES
 *   1  charge_affaires_dispatch  DISPATCH   CHARGE_AFFAIRES
 *   2  verification_completude   ANALYSIS   CHARGE_AFFAIRES
 *   3  contre_analyse            ANALYSIS   ANALYSTE_RISQUES
 *   4  calcul_ratios             ANALYSIS   ANALYSTE_RISQUES
 *   6  avis_risques              APPROVAL   RESPONSABLE_RISQUES
 */
const T0 = new Date('2026-07-29T08:00:00Z');
const at = (m: number) => new Date(T0.getTime() + m * 60_000);

function step(over: Partial<GuardStep> & { id: string }): GuardStep {
  return {
    stepName: over.id,
    role: 'CHARGE_AFFAIRES',
    status: 'PENDING',
    completedAt: null,
    assigneeId: null,
    createdAt: at(0),
    policyStep: null,
    ...over,
  };
}

function circuit(): GuardStep[] {
  return [
    step({ id: 's0', stepName: 'application_created', status: 'COMPLETED', completedAt: at(1), createdAt: at(0), policyStep: { order: 0, stepLabel: 'Création du dossier', stepType: 'CREATION' } }),
    step({ id: 's1', stepName: 'charge_affaires_dispatch', createdAt: at(1), policyStep: { order: 1, stepLabel: 'Traitement par le CA', stepType: 'DISPATCH' } }),
    step({ id: 's2', stepName: 'verification_completude', createdAt: at(2), policyStep: { order: 2, stepLabel: 'Vérification de la complétude', stepType: 'ANALYSIS' } }),
    step({ id: 's3', stepName: 'contre_analyse', role: 'ANALYSTE_RISQUES', createdAt: at(3), policyStep: { order: 3, stepLabel: 'Contre-analyse', stepType: 'ANALYSIS' } }),
    step({ id: 's4', stepName: 'calcul_ratios_prudentiels', role: 'ANALYSTE_RISQUES', createdAt: at(4), policyStep: { order: 4, stepLabel: 'Calcul des ratios', stepType: 'ANALYSIS' } }),
    step({ id: 's6', stepName: 'avis_risques', role: 'RESPONSABLE_RISQUES', createdAt: at(6), policyStep: { order: 6, stepLabel: 'Avis risques', stepType: 'APPROVAL' } }),
  ];
}

describe('findSequentialBlocker — ordre du circuit', () => {
  it('signale l\'étape incomplète de plus petit ordre', () => {
    const steps = circuit();
    const blocker = findSequentialBlocker(steps, steps.find(s => s.id === 's6')!);
    expect(blocker?.id).toBe('s1');
  });

  it('ne bloque plus quand tout l\'amont est complété', () => {
    const steps = circuit().map(s =>
      ['s1', 's2', 's3', 's4'].includes(s.id) ? { ...s, status: 'APPROVED', completedAt: at(10) } : s
    );
    const blocker = findSequentialBlocker(steps, steps.find(s => s.id === 's6')!);
    expect(blocker).toBeNull();
  });

  it('ignore les étapes d\'ordre supérieur', () => {
    const steps = circuit().map(s => (s.id === 's1' ? { ...s, status: 'APPROVED', completedAt: at(10) } : s));
    const blocker = findSequentialBlocker(steps, steps.find(s => s.id === 's2')!);
    expect(blocker).toBeNull();
  });

  it('ne se bloque pas elle-même', () => {
    const steps = [circuit()[1]];
    expect(findSequentialBlocker(steps, steps[0])).toBeNull();
  });

  it('dossiers legacy : ordre par createdAt, entre étapes legacy uniquement', () => {
    const legacy = [
      step({ id: 'l1', stepName: 'analyse', createdAt: at(1) }),
      step({ id: 'l2', stepName: 'decision', createdAt: at(2) }),
      // une étape de politique ne doit pas bloquer une étape legacy
      step({ id: 'p9', createdAt: at(0), policyStep: { order: 9, stepLabel: 'X', stepType: 'ANALYSIS' } }),
    ];
    expect(findSequentialBlocker(legacy, legacy[1])?.id).toBe('l1');
    expect(findSequentialBlocker(legacy, legacy[0])).toBeNull();
  });

  it('le message reprend le libellé et l\'ordre de l\'étape bloquante', () => {
    const steps = circuit();
    const blocker = findSequentialBlocker(steps, steps.find(s => s.id === 's6')!)!;
    expect(sequentialBlockReason(blocker)).toBe(
      'Étape bloquée : "Traitement par le CA" (étape 1) doit être complétée en premier. Le circuit doit être respecté dans l\'ordre défini par la politique de crédit.'
    );
  });
});

describe('pickAssignmentTarget — (a) un dispatch ne saute plus d\'étape', () => {
  it('affecte la première étape d\'ordre supérieur au DISPATCH traité', () => {
    const steps = circuit();
    const dispatch = steps.find(s => s.id === 's1')!;
    expect(pickAssignmentTarget(steps, dispatch)?.id).toBe('s2');
  });

  it('ne remonte jamais à une étape d\'ordre inférieur au DISPATCH', () => {
    // DISPATCH tardif (ordre 5) : l'étape 2 encore ouverte ne doit pas être prise
    const steps = [
      ...circuit(),
      step({ id: 's5', stepName: 'dispatch_risques', createdAt: at(5), policyStep: { order: 5, stepLabel: 'Dispatch risques', stepType: 'DISPATCH' } }),
    ];
    const lateDispatch = steps.find(s => s.id === 's5')!;
    const target = pickAssignmentTarget(steps, lateDispatch);
    expect(target?.id).toBe('s6');
    expect(target?.id).not.toBe('s2');
  });

  it('n\'affecte jamais une étape DISPATCH', () => {
    const steps = [
      step({ id: 'd1', createdAt: at(1), policyStep: { order: 1, stepLabel: 'D1', stepType: 'DISPATCH' } }),
      step({ id: 'd2', createdAt: at(2), policyStep: { order: 2, stepLabel: 'D2', stepType: 'DISPATCH' } }),
      step({ id: 'a3', createdAt: at(3), policyStep: { order: 3, stepLabel: 'A3', stepType: 'ANALYSIS' } }),
    ];
    expect(pickAssignmentTarget(steps, steps[0])?.id).toBe('a3');
  });

  it('affectation initiale : ignore les étapes déjà assignées', () => {
    const steps = circuit().map(s => (s.id === 's2' ? { ...s, assigneeId: 'u-1' } : s));
    const dispatch = steps.find(s => s.id === 's1')!;
    expect(pickAssignmentTarget(steps, dispatch)?.id).toBe('s3');
  });

  it('ré-affectation : accepte une étape déjà assignée ou IN_REVIEW', () => {
    const steps = circuit().map(s => (s.id === 's2' ? { ...s, assigneeId: 'u-1', status: 'IN_REVIEW' } : s));
    const dispatch = steps.find(s => s.id === 's1')!;
    expect(pickAssignmentTarget(steps, dispatch, { isReassign: true })?.id).toBe('s2');
  });

  it('retourne null quand plus rien n\'est affectable en aval', () => {
    const steps = circuit().map(s =>
      s.id === 's1' ? s : { ...s, status: 'APPROVED', completedAt: at(20) }
    );
    expect(pickAssignmentTarget(steps, steps.find(s => s.id === 's1')!)).toBeNull();
  });
});

describe('resolveDispatchStep', () => {
  const twoDispatches = (): GuardStep[] => [
    step({ id: 'd1', createdAt: at(1), policyStep: { order: 1, stepLabel: 'D1', stepType: 'DISPATCH' } }),
    step({ id: 'a2', createdAt: at(2), policyStep: { order: 2, stepLabel: 'A2', stepType: 'ANALYSIS' } }),
    step({ id: 'd5', createdAt: at(5), policyStep: { order: 5, stepLabel: 'D5', stepType: 'DISPATCH' } }),
  ];

  it('retient le DISPATCH explicitement désigné', () => {
    expect(resolveDispatchStep(twoDispatches(), 'd5')?.id).toBe('d5');
  });

  it('repli sans identifiant : le DISPATCH ouvert d\'ordre le plus petit', () => {
    expect(resolveDispatchStep(twoDispatches(), null)?.id).toBe('d1');
  });

  it('refuse un identifiant qui ne désigne pas un DISPATCH ouvert', () => {
    expect(resolveDispatchStep(twoDispatches(), 'a2')).toBeNull();
    expect(resolveDispatchStep(twoDispatches(), 'inconnu')).toBeNull();
  });

  it('ignore les DISPATCH déjà complétés', () => {
    const steps = twoDispatches().map(s => (s.id === 'd1' ? { ...s, completedAt: at(9) } : s));
    expect(resolveDispatchStep(steps, null)?.id).toBe('d5');
  });
});

describe('checkBranchScope — (b) portée d\'agence', () => {
  it('un chargé d\'affaires d\'une autre agence est refusé', () => {
    const res = checkBranchScope(
      { role: 'CHARGE_AFFAIRES', branch: null, department: 'Thiès' },
      'DKR-SG',
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('DKR-SG');
    expect(res.reason).toContain('Thiès');
  });

  it('un chargé d\'affaires de la même agence est accepté', () => {
    expect(checkBranchScope({ role: 'CHARGE_AFFAIRES', branch: 'DKR-SG' }, 'DKR-SG').allowed).toBe(true);
  });

  it('branch prime sur department', () => {
    // branch=DKR-SG et department=Thiès → c'est branch qui compte
    expect(checkBranchScope({ role: 'CHARGE_AFFAIRES', branch: 'DKR-SG', department: 'Thiès' }, 'DKR-SG').allowed).toBe(true);
  });

  it('les rôles transversaux ne sont pas restreints', () => {
    for (const role of ['ANALYSTE_RISQUES', 'RESPONSABLE_RISQUES', 'COMITE_CREDIT', 'DIRECTION_GENERALE', 'BACK_OFFICE', 'DIRECTION_JURIDIQUE', 'ADMIN']) {
      expect(checkBranchScope({ role, department: 'Thiès' }, 'DKR-SG').allowed).toBe(true);
    }
  });

  it('reconnaît les rôles en encodage snake_case', () => {
    expect(checkBranchScope({ role: 'credit_analyst', department: 'Thiès' }, 'DKR-SG').allowed).toBe(true);
    expect(checkBranchScope({ role: 'account_manager', department: 'Thiès' }, 'DKR-SG').allowed).toBe(false);
  });

  it('le Siège Social garde une portée multi-agences', () => {
    expect(checkBranchScope({ role: 'CHARGE_AFFAIRES', branch: 'Siège Social - Dakar' }, 'DKR-SG').allowed).toBe(true);
    expect(checkBranchScope({ role: 'CHARGE_AFFAIRES', branch: 'siege central' }, 'DKR-SG').allowed).toBe(true);
  });

  it('compte sans rattachement : refusé au dispatching, toléré à l\'approbation', () => {
    const orphan = { role: 'CHARGE_AFFAIRES', branch: null, department: null };
    expect(checkBranchScope(orphan, 'DKR-SG', { requireAttachment: true }).allowed).toBe(false);
    expect(checkBranchScope(orphan, 'DKR-SG').allowed).toBe(true);
  });

  it('dossier sans agence identifiable : pas de restriction', () => {
    expect(checkBranchScope({ role: 'CHARGE_AFFAIRES', department: 'Thiès' }, null).allowed).toBe(true);
  });
});
