import { canDownloadContract, CONTRACT_DOWNLOAD_ROLES } from '../services/contractAccess';

describe('canDownloadContract', () => {
  const baseClient = {
    creator: { id: 'creator-1', branch: 'AGENCE_DAKAR', department: null as string | null },
  };

  it('autorise BACK_OFFICE quelle que soit la branche', () => {
    expect(
      canDownloadContract({ id: 'u1', role: 'BACK_OFFICE', branch: 'AGENCE_THIES', department: null }, baseClient)
    ).toBe(true);
  });

  it('autorise DIRECTION_JURIDIQUE', () => {
    expect(
      canDownloadContract({ id: 'u1', role: 'DIRECTION_JURIDIQUE', branch: null, department: 'JURIDIQUE' }, baseClient)
    ).toBe(true);
  });

  it('autorise ADMIN et SUPER_ADMIN', () => {
    expect(canDownloadContract({ id: 'u1', role: 'ADMIN', branch: null, department: null }, baseClient)).toBe(true);
    expect(canDownloadContract({ id: 'u2', role: 'SUPER_ADMIN', branch: null, department: null }, baseClient)).toBe(true);
  });

  it('autorise CHARGE_AFFAIRES de la même branche que le créateur', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES d\'une autre branche', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: 'AGENCE_THIES', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('refuse les autres rôles', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'ANALYSTE_RISQUES', branch: 'AGENCE_DAKAR', department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('tolère department en fallback de branch', () => {
    const client = { creator: { id: 'creator-1', branch: null, department: 'AGENCE_DAKAR' } };
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: null, department: 'AGENCE_DAKAR' },
        client
      )
    ).toBe(true);
  });

  it('refuse CHARGE_AFFAIRES sans branche/département renseigné', () => {
    expect(
      canDownloadContract(
        { id: 'u9', role: 'CHARGE_AFFAIRES', branch: null, department: null },
        baseClient
      )
    ).toBe(false);
  });

  it('expose la liste CONTRACT_DOWNLOAD_ROLES', () => {
    expect(CONTRACT_DOWNLOAD_ROLES).toEqual(
      expect.arrayContaining(['BACK_OFFICE', 'DIRECTION_JURIDIQUE', 'ADMIN', 'SUPER_ADMIN'])
    );
  });
});
