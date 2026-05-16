import { getKpiKeysForRole } from '../services/homeKpiService';

describe('getKpiKeysForRole — release v1.0', () => {
  it('CHARGE_AFFAIRES → pending_opinion_share remplace alerts', () => {
    expect(getKpiKeysForRole('CHARGE_AFFAIRES')).toEqual([
      'my_in_progress', 'my_exposure', 'signed_month', 'pending_opinion_share',
    ]);
  });

  it('ASSISTANT_COMMERCIAL → identique à CHARGE_AFFAIRES', () => {
    expect(getKpiKeysForRole('ASSISTANT_COMMERCIAL'))
      .toEqual(getKpiKeysForRole('CHARGE_AFFAIRES'));
  });

  it('ANALYSTE_RISQUES / RESPONSABLE_RISQUES → analyst_favorable_rate remplace overdue', () => {
    const expected = ['queue', 'sla_pct', 'approval_rate', 'analyst_favorable_rate'];
    expect(getKpiKeysForRole('ANALYSTE_RISQUES')).toEqual(expected);
    expect(getKpiKeysForRole('RESPONSABLE_RISQUES')).toEqual(expected);
  });

  it('BACK_OFFICE → file & SLA (inchangé)', () => {
    expect(getKpiKeysForRole('BACK_OFFICE')).toEqual([
      'queue', 'sla_pct', 'approval_rate', 'overdue',
    ]);
  });

  it('DIRECTION_GENERALE / COMITE_CREDIT / DIR_AG → opinion_favorable_pct remplace avg_duration', () => {
    const expected = ['volume_total', 'exposure_total', 'approval_rate', 'opinion_favorable_pct'];
    expect(getKpiKeysForRole('DIRECTION_GENERALE')).toEqual(expected);
    expect(getKpiKeysForRole('COMITE_CREDIT')).toEqual(expected);
    expect(getKpiKeysForRole('DIR_AG')).toEqual(expected);
  });

  it('RESPONSABLE_ENGAGEMENTS / DIRECTION_JURIDIQUE → légal (inchangé)', () => {
    const expected = ['queue', 'signed_month', 'legal_avg_duration', 'overdue'];
    expect(getKpiKeysForRole('RESPONSABLE_ENGAGEMENTS')).toEqual(expected);
    expect(getKpiKeysForRole('DIRECTION_JURIDIQUE')).toEqual(expected);
  });

  it('ADMIN / SUPER_ADMIN → security_blocks_24h remplace alerts', () => {
    const expected = ['volume_total', 'exposure_total', 'active_users_30d', 'security_blocks_24h'];
    expect(getKpiKeysForRole('ADMIN')).toEqual(expected);
    expect(getKpiKeysForRole('SUPER_ADMIN')).toEqual(expected);
  });

  it('rôle inconnu → fallback générique (inchangé)', () => {
    expect(getKpiKeysForRole('UNKNOWN')).toEqual([
      'my_in_progress', 'signed_month', 'approval_rate', 'alerts',
    ]);
  });
});
