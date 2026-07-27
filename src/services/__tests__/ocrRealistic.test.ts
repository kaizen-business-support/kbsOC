/**
 * Tests de régression sur formes RÉALISTES d'états financiers SYSCOHADA,
 * telles que produites par le pipeline OCR (processTableData → parseurs).
 *
 * Couvre les défauts constatés sur documents scannés :
 *  1. Milliers séparés par des POINTS (« 120.000.000 » — fréquent zone UEMOA)
 *  2. Scan serré : colonnes séparées par UN seul espace
 *  3. Bilan : lignes TOTAL sans colonne Note décalées par le hint de colonne
 *  4. parseAmount : formats 1.234.567 / 1,234,567 / 1.234,56
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

const svc = ocrService as any;

// ─── parseAmount : séparateurs de milliers points / virgules ──────────────────

describe('parseAmount — séparateurs de milliers', () => {
  const parse = (s: string) => svc.parseAmount(s) as number | null;

  test('milliers en points (UEMOA / OCR)', () => {
    expect(parse('120.000.000')).toBe(120_000_000);
    expect(parse('1.234.567')).toBe(1_234_567);
    expect(parse('12.500')).toBe(12_500); // point + groupe de 3 = milliers, pas décimale
  });

  test('milliers en virgules (anglo)', () => {
    expect(parse('1,234,567')).toBe(1_234_567);
  });

  test('mixte européen : points milliers + virgule décimale', () => {
    expect(parse('1.234,56')).toBeCloseTo(1234.56);
    expect(parse('1.234.567,89')).toBeCloseTo(1_234_567.89);
  });

  test('les vraies décimales restent des décimales', () => {
    expect(parse('12.5')).toBe(12.5);      // groupe ≠ 3 chiffres
    expect(parse('1 234,56')).toBeCloseTo(1234.56);
    expect(parse('0.75')).toBe(0.75);
  });

  test('négatifs comptables conservés', () => {
    expect(parse('(5.000.000)')).toBe(-5_000_000);
  });
});

// ─── CR scanné : milliers en points ───────────────────────────────────────────

const CR_SCAN_DOTS_RAW = `
Ventes de marchandises      120.000.000      100.000.000
CHIFFRE D'AFFAIRES      185.000.000      158.000.000
VALEUR AJOUTEE      80.000.000      70.000.000
EXCEDENT BRUT D'EXPLOITATION      50.000.000      42.000.000
RESULTAT NET      25.000.000      21.000.000
`.trim();

describe('Compte de résultat scanné — milliers en points', () => {
  test('extrait les montants année N corrects', () => {
    const processed = svc.processTableData(CR_SCAN_DOTS_RAW);
    const d = svc.parseCompteResultatForYear(processed, 0);
    expect(d.ventes_marchandises).toBe(120_000_000);
    expect(d.chiffre_affaires).toBe(185_000_000);
    expect(d.valeur_ajoutee).toBe(80_000_000);
    expect(d.excedent_brut_exploitation).toBe(50_000_000);
    expect(d.resultat_net).toBe(25_000_000);
  });

  test('extrait les montants année N-1 corrects', () => {
    const processed = svc.processTableData(CR_SCAN_DOTS_RAW);
    const d = svc.parseCompteResultatForYear(processed, 1);
    expect(d.chiffre_affaires).toBe(158_000_000);
    expect(d.resultat_net).toBe(21_000_000);
  });
});

// ─── CR scan serré : un seul espace entre colonnes ────────────────────────────

const CR_TIGHT_RAW = `
Ventes de marchandises 120 000 000 100 000 000
CHIFFRE D'AFFAIRES 185 000 000 158 000 000
RESULTAT NET 25 000 000 21 000 000
`.trim();

describe('Compte de résultat scan serré (1 espace entre colonnes)', () => {
  test('reconstruit les montants français à espaces simples', () => {
    const processed = svc.processTableData(CR_TIGHT_RAW);
    const d = svc.parseCompteResultatForYear(processed, 0);
    expect(d.ventes_marchandises).toBe(120_000_000);
    expect(d.chiffre_affaires).toBe(185_000_000);
    expect(d.resultat_net).toBe(25_000_000);
  });

  test('ligne avec note SYSCOHADA en tête reste correcte', () => {
    // "17" = note ref, doit être sautée
    const line = 'Charges de personnel 17 30 000 000 28 000 000';
    const d = svc.parseCompteResultatForYear(svc.processTableData(line), 0);
    expect(d.charges_personnel).toBe(30_000_000);
  });
});

// ─── Bilan : lignes TOTAL sans colonne Note ───────────────────────────────────

const BILAN_RAW = `
BILAN ACTIF|Note|BRUT|AMORT|NET 2024|NET 2023
Immobilisations incorporelles|3|10 000 000|4 000 000|6 000 000|7 000 000
Immobilisations corporelles|3|80 000 000|30 000 000|50 000 000|55 000 000
TOTAL ACTIF IMMOBILISE|90 000 000|34 000 000|56 000 000|62 000 000
Stocks et encours|6|20 000 000|2 000 000|18 000 000|15 000 000
Creances clients|7|25 000 000|1 000 000|24 000 000|20 000 000
TOTAL ACTIF CIRCULANT|45 000 000|3 000 000|42 000 000|35 000 000
Banques, cheques postaux|11|12 000 000|12 000 000|10 000 000
TOTAL GENERAL ACTIF|147 000 000|37 000 000|110 000 000|107 000 000
BILAN PASSIF|Note|NET 2024|NET 2023
Capital social|13|40 000 000|40 000 000
Reserves|14|15 000 000|12 000 000
RESULTAT NET DE L'EXERCICE|25 000 000|21 000 000
TOTAL CAPITAUX PROPRES|80 000 000|73 000 000
Emprunts et dettes financieres|16|20 000 000|24 000 000
Fournisseurs d'exploitation|17|8 000 000|7 000 000
TOTAL GENERAL PASSIF|110 000 000|107 000 000
`.trim();

describe('Bilan — lignes TOTAL sans colonne Note', () => {
  test('les totaux ACTIF prennent NET-N, pas NET-N-1', () => {
    const d = svc.parseBilanDataForYear(BILAN_RAW, 0);
    // Lignes détail (avec note) : déjà correctes
    expect(d.immobilisations_incorporelles).toBe(6_000_000);
    expect(d.immobilisations_corporelles).toBe(50_000_000);
    // Lignes TOTAL (sans note) : ne doivent PAS être décalées sur N-1
    expect(d.total_actif_immobilise).toBe(56_000_000);
    expect(d.total_actif).toBe(110_000_000);
  });

  test('le passif reste correct', () => {
    const d = svc.parseBilanDataForYear(BILAN_RAW, 0);
    expect(d.capital_social).toBe(40_000_000);
    expect(d.capitaux_propres).toBe(80_000_000);
    expect(d.total_passif).toBe(110_000_000);
  });
});
