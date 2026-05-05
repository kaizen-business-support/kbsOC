import { buildMergeContext, flattenContext } from '../services/contractGenerationService';

const fakeApp: any = {
  id: 'a1', applicationNumber: 'APP-001', amount: 25000000, currency: 'XOF',
  purpose: 'Fonds de roulement', durationMonths: 12, proposedRate: 8.5,
  collateralType: 'Hypothèque', collateralValue: 30000000, repaymentSchedule: 'MONTHLY',
  client: {
    companyName: 'Ets ABC', rccm: 'SN-DKR-2020', ninea: '1234',
    legalForm: 'SARL', headquarters: 'Dakar', contactPerson: 'M. Diop',
    phone: '+221770000000', email: 'abc@ex.com',
  },
  creditType: { name: 'Crédit moyen terme' },
  company: { name: 'BCI', headquarters: 'Dakar', legalRepresentative: 'M. Sall', rccm: 'BCI-001' },
};

describe('buildMergeContext', () => {
  it('produit les 4 groupes', () => {
    const ctx = buildMergeContext(fakeApp, {});
    expect(ctx.client.companyName).toBe('Ets ABC');
    expect(ctx.application.applicationNumber).toBe('APP-001');
    expect(ctx.bank.name).toBe('BCI');
    expect(ctx.meta.creditType).toBe('Crédit moyen terme');
    expect(ctx.meta.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('calcule amountInWords', () => {
    const ctx = buildMergeContext(fakeApp, {});
    expect(typeof ctx.application.amountInWords).toBe('string');
    expect(ctx.application.amountInWords.length).toBeGreaterThan(0);
  });

  it('mappe les valeurs nulles → chaîne vide', () => {
    const app = { ...fakeApp, durationMonths: null, client: { ...fakeApp.client, ninea: null } };
    const ctx = buildMergeContext(app, {});
    expect(ctx.application.durationMonths).toBe('');
    expect(ctx.client.ninea).toBe('');
  });

  it('fusionne customValues à plat', () => {
    const ctx = buildMergeContext(fakeApp, { echeance: '2026-12-31' });
    expect((ctx as any).echeance).toBe('2026-12-31');
  });
});

describe('flattenContext', () => {
  it('aplatit pour docxtemplater', () => {
    const flat = flattenContext({ client: { companyName: 'X' }, foo: 'bar' });
    expect(flat).toMatchObject({ 'client.companyName': 'X', foo: 'bar' });
  });
});
