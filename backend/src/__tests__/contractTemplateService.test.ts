import {
  extractVariablesFromText, classifyVariables, validateMagicBytes,
} from '../services/contractTemplateService';

describe('extractVariablesFromText', () => {
  it('extrait les variables simples', () => {
    expect(extractVariablesFromText('Hello {{client.name}}, {{ application.amount }}'))
      .toEqual(['client.name', 'application.amount']);
  });
  it('dédupe les répétitions', () => {
    expect(extractVariablesFromText('{{x}} et {{x}}')).toEqual(['x']);
  });
  it('ignore les chaînes mal formées', () => {
    expect(extractVariablesFromText('{single} {{ } } { {a }')).toEqual([]);
  });
});

describe('classifyVariables', () => {
  it('sépare catalogue fixe vs custom', () => {
    const r = classifyVariables(['client.companyName', 'application.amount', 'echeance', 'foo.bar']);
    expect(r.catalog).toEqual(['client.companyName', 'application.amount']);
    expect(r.custom).toEqual(['echeance', 'foo.bar']);
  });
});

describe('validateMagicBytes', () => {
  it('accepte un en-tête DOCX (PK\\x03\\x04)', () => {
    expect(validateMagicBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]), 'DOCX')).toBe(true);
  });
  it('accepte un en-tête PDF (%PDF)', () => {
    expect(validateMagicBytes(Buffer.from('%PDF-1.7\n', 'utf8'), 'PDF')).toBe(true);
  });
  it('rejette un fichier déguisé', () => {
    expect(validateMagicBytes(Buffer.from('plain text', 'utf8'), 'DOCX')).toBe(false);
    expect(validateMagicBytes(Buffer.from('plain text', 'utf8'), 'PDF')).toBe(false);
  });
});
