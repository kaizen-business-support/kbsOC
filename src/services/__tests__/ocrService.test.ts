/**
 * Unit tests for the OCR parser helpers. These intentionally avoid the
 * Tesseract / pdf.js runtime — they exercise the pure string-to-data logic
 * against representative SYSCOHADA/BCEAO statement layouts.
 *
 * pdfjs-dist v5 and tesseract.js use ESM/import.meta which CRA's Jest can't
 * parse. We mock them out so the parser methods on ocrService remain
 * accessible to these tests.
 */

jest.mock('pdfjs-dist', () => ({
  version: 'mock',
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0, getPage: () => Promise.resolve({}) }) }),
}));

jest.mock('tesseract.js', () => ({
  createWorker: async () => ({
    setParameters: async () => undefined,
    recognize: async () => ({ data: { text: '', confidence: 0 } }),
    terminate: async () => undefined,
  }),
}));

import { ocrService } from '../ocrService';

// ─── parseAmount ──────────────────────────────────────────────────────────────

describe('parseAmount', () => {
  const parse = (s: string) => (ocrService as any).parseAmount(s) as number | null;

  test('returns null for empty / whitespace', () => {
    expect(parse('')).toBeNull();
    expect(parse('   ')).toBeNull();
  });

  test('returns null for dash placeholders (no value, not zero)', () => {
    expect(parse('-')).toBeNull();
    expect(parse('--')).toBeNull();
    expect(parse('—')).toBeNull();
    expect(parse('–')).toBeNull();
  });

  test('parses a plain integer', () => {
    expect(parse('123')).toBe(123);
    expect(parse('1234567')).toBe(1234567);
  });

  test('parses small numbers (≥1 digit) — fixes prior \\d{3,} restriction', () => {
    expect(parse('1')).toBe(1);
    expect(parse('42')).toBe(42);
  });

  test('strips French thousands separators (regular + NBSP + narrow NBSP)', () => {
    expect(parse('1 234 567')).toBe(1234567);
    expect(parse('1 234 567')).toBe(1234567);
    expect(parse('1 234 567')).toBe(1234567);
  });

  test('handles decimal comma (French)', () => {
    expect(parse('1234,56')).toBeCloseTo(1234.56);
    expect(parse('1 234,56')).toBeCloseTo(1234.56);
  });

  test('handles parens-negatives (accounting convention)', () => {
    expect(parse('(1 234)')).toBe(-1234);
    expect(parse('(0)')).toBe(-0);
    expect(parse('(50 000)')).toBe(-50000);
  });

  test('handles signed', () => {
    expect(parse('-1234')).toBe(-1234);
    expect(parse('-1 234 567')).toBe(-1234567);
  });

  test('strips currency tokens', () => {
    expect(parse('1 234 FCFA')).toBe(1234);
    expect(parse('1 234 XOF')).toBe(1234);
    expect(parse('1234 €')).toBe(1234);
  });

  test('returns null for non-numeric labels', () => {
    expect(parse('Total Actif')).toBeNull();
    expect(parse('CA')).toBeNull();
    expect(parse('abc123')).toBeNull();
  });
});

// ─── extractNumbersWithGaps ───────────────────────────────────────────────────

describe('extractNumbersWithGaps', () => {
  const extract = (s: string) =>
    (ocrService as any).extractNumbersWithGaps(s) as (number | null)[];

  test('handles pipe-separated cells', () => {
    expect(extract('Terrains|1 000|0|1 000|800')).toEqual([null, 1000, 0, 1000, 800]);
  });

  test('preserves null gaps for empty cells', () => {
    expect(extract('Terrains|1 000||1 000|800')).toEqual([null, 1000, null, 1000, 800]);
  });

  test('handles dash placeholders as null (preserves column position)', () => {
    expect(extract('Terrains|1 000|-|1 000|800')).toEqual([null, 1000, null, 1000, 800]);
  });

  test('handles space-separated fallback', () => {
    expect(extract('Terrains   1 000   0   1 000   800'))
      .toEqual([null, 1000, 0, 1000, 800]);
  });

  test('parens-negatives in cells', () => {
    expect(extract('Resultat exercice|(50 000)|(45 000)')).toEqual([null, -50000, -45000]);
  });
});

// ─── splitBilanSections ───────────────────────────────────────────────────────

describe('splitBilanSections', () => {
  const split = (s: string) =>
    (ocrService as any).splitBilanSections(s) as { actif: string; passif: string };

  test('splits on PASSIF header', () => {
    const text = [
      'ACTIF | BRUT | AMORT | NET N | NET N-1',
      'Terrains | 100 | 0 | 100 | 95',
      'TOTAL GENERAL | 500 | 50 | 450 | 420',
      'PASSIF | N | N-1',
      'Capital social | 200 | 180',
      'TOTAL GENERAL | 450 | 420',
    ].join('\n');
    const { actif, passif } = split(text);
    expect(actif).toContain('Terrains');
    expect(actif).not.toContain('Capital social');
    expect(passif).toContain('Capital social');
    expect(passif).toContain('TOTAL GENERAL | 450');
  });

  test('falls back to capitaux propres when no PASSIF header', () => {
    const text = [
      'Terrains | 100',
      'TOTAL ACTIF | 500',
      'CAPITAUX PROPRES | 300',
      'Capital social | 200',
      'TOTAL DETTES | 200',
    ].join('\n');
    const { actif, passif } = split(text);
    expect(actif).toContain('Terrains');
    expect(passif).toContain('Capital social');
  });

  test('returns full text on both sides when no marker found', () => {
    const text = 'Some random text without bilan markers';
    const { actif, passif } = split(text);
    expect(actif).toBe(text);
    expect(passif).toBe(text);
  });
});

// ─── detectBilanColumns ───────────────────────────────────────────────────────

describe('detectBilanColumns', () => {
  const detect = (s: string) =>
    (ocrService as any).detectBilanColumns(s);

  test('detects 4-column SYSCOHADA layout with years', () => {
    const text = 'ACTIF|BRUT 2024|AMORT|NET 2024|NET 2023\nTerrains|100|0|100|95';
    const cols = detect(text);
    expect(cols).not.toBeNull();
    expect(cols.brutIdx).toBe(1);
    expect(cols.amortIdx).toBe(2);
    expect(cols.netNIdx).toBe(3);
    expect(cols.netN1Idx).toBe(4);
    expect(cols.yearN).toBe(2024);
    expect(cols.yearN1).toBe(2023);
  });

  test('returns null when no brut+net header line', () => {
    expect(detect('Terrains|100|0|100|95')).toBeNull();
  });
});

// ─── detectYearColumns ───────────────────────────────────────────────────────

describe('detectYearColumns', () => {
  const detect = (s: string) =>
    (ocrService as any).detectYearColumns(s);

  test('extracts N and N-1 years from header', () => {
    const text = 'COMPTE DE RESULTAT|2024|2023\nVentes|500|450';
    expect(detect(text)).toEqual({ yearN: 2024, yearN1: 2023 });
  });

  test('returns nulls when no years found', () => {
    expect(detect('Ventes|500|450')).toEqual({ yearN: null, yearN1: null });
  });
});

// ─── End-to-end: parseBilanData (single year, mock OCR text) ─────────────────

describe('parseBilanData — end-to-end on synthetic OCR text', () => {
  const text = [
    // Header
    'ACTIF|BRUT|AMORT/DEPREC|NET 2024|NET 2023',
    // Immobilisé
    'IMMOBILISATIONS INCORPORELLES|1 000|200|800|750',
    'Terrains|5 000|0|5 000|4 800',
    'Batiments|10 000|2 000|8 000|7 500',
    'IMMOBILISATIONS FINANCIERES|500|0|500|400',
    'TOTAL ACTIF IMMOBILISE|16 500|2 200|14 300|13 450',
    // Circulant
    'STOCKS ET ENCOURS|3 000|0|3 000|2 800',
    'Clients|2 500|0|2 500|2 100',
    'TOTAL ACTIF CIRCULANT|5 500|0|5 500|4 900',
    // Trésorerie
    'Banques cheques postaux caisse|800|0|800|700',
    'TOTAL TRESORERIE ACTIF|800|0|800|700',
    'TOTAL GENERAL|22 800|2 200|20 600|19 050',
    // PASSIF
    'PASSIF|N 2024|N-1 2023',
    'Capital social|10 000|9 500',
    'Reserves indisponibles|2 000|1 800',
    'Resultat net de l\'exercice|3 000|2 500',
    'TOTAL CAPITAUX PROPRES|15 000|13 800',
    'Emprunts et dettes financieres|3 000|2 800',
    'Fournisseurs d\'exploitation|2 000|1 800',
    'Dettes fiscales et sociales|600|450',
    'TOTAL TRESORERIE PASSIF|0|200',
    'TOTAL GENERAL|20 600|19 050',
  ].join('\n');

  const bilan = (ocrService as any).parseBilanDataForYear(text, 0) as Record<string, number | undefined>;

  test('captures ACTIF NET-N values', () => {
    expect(bilan.terrains).toBe(5000);
    expect(bilan.batiments).toBe(8000);
    expect(bilan.stocks).toBe(3000);
    expect(bilan.clients).toBe(2500);
    expect(bilan.total_actif_immobilise).toBe(14300);
    expect(bilan.total_actif_circulant).toBe(5500);
    expect(bilan.tresorerie_actif).toBe(800);
  });

  test('total_actif and total_passif resolve to their own section (regression on TOTAL GENERAL bug)', () => {
    expect(bilan.total_actif).toBe(20600);
    expect(bilan.total_passif).toBe(20600);
  });

  test('captures capital_social — fixes CA|CAPITAL literal pipe bug', () => {
    expect(bilan.capital_social).toBe(10000);
  });

  test('captures PASSIF values from the right section', () => {
    expect(bilan.reserves_indisponibles).toBe(2000);
    expect(bilan.resultat_exercice).toBe(3000);
    expect(bilan.capitaux_propres).toBe(15000);
    expect(bilan.emprunts_dettes_financieres).toBe(3000);
    expect(bilan.fournisseurs).toBe(2000);
  });

  test('N-1 extraction returns previous-year values', () => {
    const bilanN1 = (ocrService as any).parseBilanDataForYear(text, 1) as Record<string, number | undefined>;
    expect(bilanN1.terrains).toBe(4800);
    expect(bilanN1.total_actif).toBe(19050);
    expect(bilanN1.capital_social).toBe(9500);
    expect(bilanN1.total_passif).toBe(19050);
  });
});

// ─── End-to-end: parseCompteResultatData ─────────────────────────────────────

describe('parseCompteResultatData — end-to-end on synthetic OCR text', () => {
  const text = [
    'COMPTE DE RESULTAT|N 2024|N-1 2023',
    'Ventes de marchandises|2 000|1 800',
    'CHIFFRE D\'AFFAIRES|15 000|13 200',
    'VALEUR AJOUTEE|8 000|7 100',
    'Charges de personnel|3 500|3 200',
    'EXCEDENT BRUT D\'EXPLOITATION|4 500|3 900',
    'Dotations aux amortissements|1 200|1 000',
    'RESULTAT D\'EXPLOITATION|3 300|2 900',
    'Frais financiers|500|400',
    'RESULTAT FINANCIER|(500)|(400)',
    'Impots sur le resultat|800|750',
    'RESULTAT NET|2 000|1 750',
  ].join('\n');

  const cr = (ocrService as any).parseCompteResultatForYear(text, 0) as Record<string, number | undefined>;

  test('captures CR values for N', () => {
    expect(cr.ventes_marchandises).toBe(2000);
    expect(cr.chiffre_affaires).toBe(15000);
    expect(cr.valeur_ajoutee).toBe(8000);
    expect(cr.charges_personnel).toBe(3500);
    expect(cr.excedent_brut_exploitation).toBe(4500);
    expect(cr.resultat_exploitation).toBe(3300);
    expect(cr.resultat_net).toBe(2000);
  });

  test('parses parens-negatives in CR', () => {
    expect(cr.resultat_financier).toBe(-500);
  });

  test('N-1 extraction returns previous-year CR values', () => {
    const crN1 = (ocrService as any).parseCompteResultatForYear(text, 1) as Record<string, number | undefined>;
    expect(crN1.chiffre_affaires).toBe(13200);
    expect(crN1.resultat_net).toBe(1750);
    expect(crN1.resultat_financier).toBe(-400);
  });
});

// ─── findAllLinesByLabel — scoring test ───────────────────────────────────────

describe('findAllLinesByLabel', () => {
  const find = (text: string, ...labels: string[]) =>
    (ocrService as any).findAllLinesByLabel(text, ...labels) as string[];

  test('ranks longer (more specific) exact matches higher', () => {
    const text = [
      'CHIFFRE AFFAIRES|10 000',
      'CHIFFRE D\'AFFAIRES NET|9 500',
    ].join('\n');
    const lines = find(text, 'CHIFFRE D\'AFFAIRES NET', 'CHIFFRE AFFAIRES');
    expect(lines[0]).toContain("CHIFFRE D'AFFAIRES NET");
  });

  test('returns ALL matches, not just first', () => {
    const text = [
      'TOTAL GENERAL|100',
      'Other|50',
      'TOTAL GENERAL|200',
    ].join('\n');
    const lines = find(text, 'TOTAL GENERAL');
    expect(lines.length).toBe(2);
  });
});

// ─── Vérification approfondie ─────────────────────────────────────────────────

describe('collectSyscohadaTerms', () => {
  const collect = (s: string) => (ocrService as any).collectSyscohadaTerms(s) as string[];

  test('detects SYSCOHADA term', () => {
    expect(collect('Etats financiers SYSCOHADA au 31/12/2024').length).toBeGreaterThan(0);
  });

  test('detects BCEAO', () => {
    expect(collect('Banque Centrale BCEAO').length).toBeGreaterThan(0);
  });

  test('detects FCFA / XOF', () => {
    expect(collect('Montants en FCFA').length).toBeGreaterThan(0);
    expect(collect('XOF').length).toBeGreaterThan(0);
  });

  test('returns empty on irrelevant text', () => {
    expect(collect('Rapport hebdomadaire de l\'équipe marketing')).toEqual([]);
  });
});

describe('collectSyscohadaCodes', () => {
  const collect = (s: string) => (ocrService as any).collectSyscohadaCodes(s) as string[];

  test('detects codes at start of line', () => {
    const text = [
      'AB IMMOBILISATIONS INCORPORELLES|1 000',
      'AC Frais de développement|500',
      'RA Ventes de marchandises|2 000',
    ].join('\n');
    const codes = collect(text);
    expect(codes).toEqual(expect.arrayContaining(['AB', 'AC', 'RA']));
  });

  test('detects codes after pipe', () => {
    expect(collect('Label|XB CHIFFRE AFFAIRES|10 000')).toContain('XB');
  });

  test('ignores non-SYSCOHADA codes', () => {
    expect(collect('ZZ Random|100')).not.toContain('ZZ');
  });
});

describe('countNumericCells', () => {
  const count = (s: string) => (ocrService as any).countNumericCells(s) as number;

  test('counts numeric cells across pipes and lines', () => {
    const text = [
      'Terrains|1 000|0|1 000|800',
      'Batiments|10 000|2 000|8 000|7 500',
    ].join('\n');
    expect(count(text)).toBe(8);
  });

  test('returns 0 for non-numeric text', () => {
    expect(count('This is a marketing report.\nNo numbers here.')).toBe(0);
  });
});

describe('verifyFinancialDocument', () => {
  const verify = (e: any, s: any[]) =>
    (ocrService as any).verifyFinancialDocument(e, s) as any;

  const mkEvidence = (overrides: Partial<{
    terms: string[]; codes: string[]; pagesScanned: number; pagesWithNumericTables: number;
  }> = {}) => ({
    syscohadaTerms: new Set<string>(overrides.terms ?? ['SYSCOHADA']),
    syscohadaCodes: new Set<string>(overrides.codes ?? []),
    pagesScanned: overrides.pagesScanned ?? 5,
    pagesWithNumericTables: overrides.pagesWithNumericTables ?? 3,
  });

  const mkStmt = (type: any, confidence = 75, page = 1) =>
    ({ type, pageNumber: page, confidence, text: '' });

  test('passes when all 3 levels satisfied', () => {
    const v = verify(mkEvidence(), [mkStmt('bilan', 80), mkStmt('compte_resultat', 75)]);
    expect(v.passed).toBe(true);
    expect(v.level1.passed).toBe(true);
    expect(v.level2.passed).toBe(true);
    expect(v.level3.passed).toBe(true);
    expect(v.rejectionReasons).toEqual([]);
  });

  test('fails Level 1 when no SYSCOHADA terms nor codes', () => {
    const v = verify(
      mkEvidence({ terms: [], codes: [] }),
      [mkStmt('bilan', 80)],
    );
    expect(v.passed).toBe(false);
    expect(v.level1.passed).toBe(false);
    expect(v.rejectionReasons).toContain(v.level1.reason);
  });

  test('passes Level 1 via ≥3 SYSCOHADA codes (terms absent)', () => {
    const v = verify(
      mkEvidence({ terms: [], codes: ['AB', 'AC', 'RA'] }),
      [mkStmt('bilan', 80)],
    );
    expect(v.level1.passed).toBe(true);
  });

  test('fails Level 2 when no statement detected', () => {
    const v = verify(mkEvidence(), []);
    expect(v.passed).toBe(false);
    expect(v.level2.passed).toBe(false);
  });

  test('fails Level 2 when statements below 60% confidence', () => {
    const v = verify(mkEvidence(), [mkStmt('bilan', 45), mkStmt('compte_resultat', 50)]);
    expect(v.passed).toBe(false);
    expect(v.level2.passed).toBe(false);
  });

  test('fails Level 3 when no pages with numeric tables', () => {
    const v = verify(
      mkEvidence({ pagesWithNumericTables: 0 }),
      [mkStmt('bilan', 80)],
    );
    expect(v.passed).toBe(false);
    expect(v.level3.passed).toBe(false);
  });

  test('confidence reflects passed levels + code bonus', () => {
    const v = verify(
      mkEvidence({ codes: ['AB', 'AC', 'RA', 'XB', 'XE'] }),
      [mkStmt('bilan', 85)],
    );
    expect(v.confidence).toBeGreaterThanOrEqual(90);
  });
});

describe('checkCoherence', () => {
  test('flags unbalanced bilan (ACTIF != PASSIF > 1%)', () => {
    const data = { total_actif: 100_000, total_passif: 95_000 } as any;
    const verification: any = { warnings: [], evidence: {}, level4: { passed: true, label: '', detail: '' } };
    (ocrService as any).checkCoherence(data, verification);
    expect(verification.warnings.length).toBeGreaterThan(0);
    expect(verification.warnings[0]).toMatch(/Bilan déséquilibré/);
    expect(verification.level4.passed).toBe(false);
  });

  test('passes when ACTIF ~= PASSIF (within 1%)', () => {
    const data = { total_actif: 100_000, total_passif: 100_500 } as any;
    const verification: any = { warnings: [], evidence: {}, level4: { passed: true, label: '', detail: '' } };
    (ocrService as any).checkCoherence(data, verification);
    expect(verification.warnings).toEqual([]);
    expect(verification.level4.passed).toBe(true);
  });

  test('flags CA <= 0', () => {
    const data = { chiffre_affaires: 0 } as any;
    const verification: any = { warnings: [], evidence: {}, level4: { passed: true, label: '', detail: '' } };
    (ocrService as any).checkCoherence(data, verification);
    expect(verification.warnings.some((w: string) => w.includes("Chiffre d'affaires"))).toBe(true);
  });
});

describe('FinancialDocumentVerificationError', () => {
  test('carries verification + message', () => {
    const { FinancialDocumentVerificationError } = require('../ocrService');
    const verification = {
      passed: false,
      rejectionReasons: ['Pas SYSCOHADA', 'Pas de table'],
    } as any;
    const err = new FinancialDocumentVerificationError(verification);
    expect(err.name).toBe('FinancialDocumentVerificationError');
    expect(err.verification).toBe(verification);
    expect(err.message).toContain('Pas SYSCOHADA');
  });
});
