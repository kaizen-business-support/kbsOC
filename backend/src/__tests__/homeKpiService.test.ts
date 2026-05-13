import { getKpiKeysForRole } from '../services/homeKpiService';

describe('getKpiKeysForRole', () => {
  it('CHARGE_AFFAIRES → 4 KPIs orientés portefeuille', () => {
    expect(getKpiKeysForRole('CHARGE_AFFAIRES')).toEqual([
      'my_in_progress', 'my_exposure', 'signed_month', 'alerts',
    ]);
  });

  it('ASSISTANT_COMMERCIAL → identique à CHARGE_AFFAIRES', () => {
    expect(getKpiKeysForRole('ASSISTANT_COMMERCIAL'))
      .toEqual(getKpiKeysForRole('CHARGE_AFFAIRES'));
  });

  it('ANALYSTE_RISQUES / RESPONSABLE_RISQUES / BACK_OFFICE → file & SLA', () => {
    const expected = ['queue', 'sla_pct', 'approval_rate', 'overdue'];
    expect(getKpiKeysForRole('ANALYSTE_RISQUES')).toEqual(expected);
    expect(getKpiKeysForRole('RESPONSABLE_RISQUES')).toEqual(expected);
    expect(getKpiKeysForRole('BACK_OFFICE')).toEqual(expected);
  });

  it('DIRECTION_GENERALE / COMITE_CREDIT / DIR_AG → vue globale', () => {
    const expected = ['volume_total', 'exposure_total', 'approval_rate', 'avg_duration'];
    expect(getKpiKeysForRole('DIRECTION_GENERALE')).toEqual(expected);
    expect(getKpiKeysForRole('COMITE_CREDIT')).toEqual(expected);
    expect(getKpiKeysForRole('DIR_AG')).toEqual(expected);
  });

  it('RESPONSABLE_ENGAGEMENTS / DIRECTION_JURIDIQUE → légal', () => {
    const expected = ['queue', 'signed_month', 'legal_avg_duration', 'overdue'];
    expect(getKpiKeysForRole('RESPONSABLE_ENGAGEMENTS')).toEqual(expected);
    expect(getKpiKeysForRole('DIRECTION_JURIDIQUE')).toEqual(expected);
  });

  it('ADMIN / SUPER_ADMIN → vue système', () => {
    const expected = ['volume_total', 'exposure_total', 'active_users_30d', 'alerts'];
    expect(getKpiKeysForRole('ADMIN')).toEqual(expected);
    expect(getKpiKeysForRole('SUPER_ADMIN')).toEqual(expected);
  });

  it('rôle inconnu → fallback générique', () => {
    expect(getKpiKeysForRole('UNKNOWN')).toEqual([
      'my_in_progress', 'signed_month', 'approval_rate', 'alerts',
    ]);
  });
});
