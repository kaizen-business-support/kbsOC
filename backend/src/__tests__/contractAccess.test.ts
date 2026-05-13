import {
  canDownloadContract,
  CONTRACT_DOWNLOAD_ROLES,
  CONTRACT_ELIGIBLE_APPLICATION_STATUSES,
} from '../services/contractAccess';

describe('canDownloadContract', () => {
  const baseClient = {
    creator: { branch: 'AGENCE_DAKAR', department: null as string | null },
  };

  it('autorise BACK_OFFICE quelle que soit la branche', () => {
    expect(
      canDownloadContract({ role: 'BACK_OFFICE', branch: 'AGENCE_THIES', department: null }, baseClient)
    ).toBe(true);
  });

  it('autorise DIRECTION_JURIDIQUE', () => {
    expect(
      canDownloadContract({ role: 'DIRECTION_JURIDIQUE', branch: null, department: 'JURIDIQUE' }, baseClient)
    ).toBe(true);
  });

  it('autorise ADMIN et SUPER_ADMIN', () => {
    expect(canDownloadContract({ role: 'ADMIN', branch: null, department: null }, baseClient)).toBe(true);
    expect(canDownloadContract({ role: 'SUPER_ADMIN', branch: null, department: null }, baseClient)).toBe(true);
  });

  it('autorise CHARGE_AFFAIRES de la même branche que le créateur', () => {
    expect(
      canDownloadContract(
        { role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES d\'une autre branche', () => {
    expect(
      canDownloadContract(
        { role: 'CHARGE_AFFAIRES', branch: 'AGENCE_THIES', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('refuse les autres rôles', () => {
    expect(
      canDownloadContract(
        { role: 'ANALYSTE_RISQUES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('tolère department en fallback de branch', () => {
    const client = { creator: { branch: null, department: 'AGENCE_DAKAR' } };
    expect(
      canDownloadContract(
        { role: 'CHARGE_AFFAIRES', branch: null, department: 'AGENCE_DAKAR' },
        client
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES sans branche/département renseigné', () => {
    expect(
      canDownloadContract(
        { role: 'CHARGE_AFFAIRES', branch: null, department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('expose CONTRACT_DOWNLOAD_ROLES avec exactement BACK_OFFICE/DIRECTION_JURIDIQUE/ADMIN/SUPER_ADMIN', () => {
    expect(CONTRACT_DOWNLOAD_ROLES).toEqual(['BACK_OFFICE', 'DIRECTION_JURIDIQUE', 'ADMIN', 'SUPER_ADMIN']);
  });

  it('expose CONTRACT_ELIGIBLE_APPLICATION_STATUSES avec exactement APPROVED/DISBURSED/UNDER_REVIEW', () => {
    expect(CONTRACT_ELIGIBLE_APPLICATION_STATUSES).toEqual(['APPROVED', 'DISBURSED', 'UNDER_REVIEW']);
  });
});
