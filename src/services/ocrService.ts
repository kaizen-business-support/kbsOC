import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Image preprocessing utilities
interface ImageProcessingOptions {
  dpi?: number;
  contrast?: number;
  brightness?: number;
  gamma?: number;
  useAdaptiveThresholding?: boolean;
  useDeskewing?: boolean;
  useNoiseReduction?: boolean;
  useSharpening?: boolean;
  useAdvancedFiltering?: boolean;
  scaleFactor?: number;
}

interface OcrOptions {
  language?: string;
  pages?: number[];
  dpi?: number;
  onProgress?: (step: string, detail: string, percent: number, extra?: any) => void;
}

interface FinancialStatement {
  type: 'bilan' | 'compte_resultat' | 'tableau_flux';
  pageNumber: number;
  confidence: number;
  text: string;
}

interface ExtractedFinancialData {
  [key: string]: number | undefined;
  confidence?: number;
}

// ─── Vérification approfondie « état financier » ─────────────────────────────
// 4 niveaux qui doivent TOUS passer pour qu'un document soit accepté par
// l'OCR. Niveau 4 (cohérence comptable) est non bloquant — il produit un
// warning visible mais n'interrompt pas l'extraction.

export interface VerificationLevel {
  passed: boolean;
  label: string;
  detail: string;
  reason?: string;
}

export interface DocumentVerification {
  passed: boolean;
  confidence: number;            // 0-100
  level1: VerificationLevel;     // Contexte SYSCOHADA/BCEAO
  level2: VerificationLevel;     // ≥1 état détecté à confiance ≥ 60 %
  level3: VerificationLevel;     // Tableaux avec ≥15 cellules numériques
  level4: VerificationLevel;     // Cohérence comptable (non bloquant)
  evidence: {
    syscohadaTerms: string[];
    syscohadaCodes: string[];
    pagesScanned: number;
    pagesWithNumericTables: number;
    detectedStatements: Array<{ type: string; page: number; confidence: number }>;
    coherenceWarnings: string[];
  };
  rejectionReasons: string[];
  warnings: string[];
}

export class FinancialDocumentVerificationError extends Error {
  verification: DocumentVerification;
  constructor(verification: DocumentVerification) {
    super(
      verification.rejectionReasons.length > 0
        ? verification.rejectionReasons.join(' · ')
        : 'Document refusé : ce n\'est pas un état financier SYSCOHADA/BCEAO valide.'
    );
    this.name = 'FinancialDocumentVerificationError';
    this.verification = verification;
  }
}

// Termes haute-valeur qui identifient un document comme un état financier
// SYSCOHADA/BCEAO. Au moins UNE occurrence requise pour Niveau 1.
const SYSCOHADA_TERMS = [
  'SYSCOHADA', 'OHADA', 'BCEAO',
  'Plan Comptable',
  'FCFA', 'F CFA', 'XOF',
  'Exercice clos au', 'Exercice clos le',
  'Acte Uniforme', 'Acte uniforme',
  'Système Comptable', 'Systeme Comptable',
];

// Codes SYSCOHADA à forte signature — apparaissent en début de ligne dans
// les états officiels. Reconnaître ≥3 codes distincts est une preuve très
// forte que le document est un état financier (cumulable avec les termes).
const SYSCOHADA_CODES = [
  // ACTIF immobilisé
  'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
  // ACTIF circulant
  'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX',
  // Trésorerie actif
  'BA', 'BB', 'BC',
  // Totaux ACTIF
  'BG', 'BH', 'BI', 'BJ', 'BK', 'BQ', 'BR', 'BT', 'BU', 'BZ',
  // PASSIF capitaux propres
  'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CP',
  // PASSIF dettes financières
  'DA', 'DB', 'DC', 'DD', 'DF', 'DG', 'DH', 'DI', 'DJ',
  // Trésorerie passif & totaux
  'DQ', 'DR', 'DT', 'DV', 'DZ',
  // Compte de résultat — produits / charges / soldes intermédiaires
  'RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ', 'RK',
  'RL', 'RM', 'RN', 'RO', 'RP', 'RQ', 'RR', 'RS', 'RT', 'RU', 'RV', 'RW', 'RX', 'RY', 'RZ',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SF', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SR',
  'TA', 'TB', 'TC', 'TD', 'TE', 'TF', 'TG', 'TH', 'TI', 'TJ', 'TK', 'TL', 'TN', 'TQ',
  'XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI',
  // Tableau de flux
  'ZA', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF', 'ZG', 'ZH',
];

// Financial statement detection criteria as specified
// Enhanced statement criteria with core terms for better detection
const STATEMENT_CRITERIA = {
  bilan: [
    // Core bilan identifiers
    'BILAN',
    'ACTIF',
    'PASSIF', 
    'TOTAL GENERAL',
    
    // Key actif sections
    'ACTIF IMMOBILISE',
    'ACTIF CIRCULANT', 
    'TRESORERIE ACTIF',
    'IMMOBILISATIONS',
    'STOCKS',
    'CREANCES',
    
    // Key passif sections
    'CAPITAUX PROPRES',
    'CAPITAL',
    'RESERVES',
    'RESULTAT NET',
    'DETTES',
    'EMPRUNTS',
    'FOURNISSEURS',
    'TRESORERIE PASSIF',
    
    // Common specific items
    'Terrains',
    'Batiments', 
    'Materiel',
    'Clients',
    'Banques'
  ],
  compte_resultat: [
    // Core identifiers
    'COMPTE RESULTAT',
    'COMPTE DE RESULTAT', 
    'CHIFFRE AFFAIRES',
    'RESULTAT NET',
    'RESULTAT EXPLOITATION',
    
    // Key revenue items
    'Ventes',
    'Produits',
    'MARGE BRUTE',
    'VALEUR AJOUTEE',
    'EXCEDENT BRUT',
    
    // Key expense items
    'Achats',
    'Charges personnel',
    'Services exterieurs',
    'Impots taxes',
    'Dotations',
    
    // Key results
    'RESULTAT FINANCIER',
    'RESULTAT ORDINAIRES',
    'RESULTAT EXCEPTIONNEL'
  ],
  tableau_flux: [
    // Core identifiers
    'TABLEAU FLUX',
    'FLUX TRESORERIE',
    'TABLEAU FLUX TRESORERIE',
    'VARIATION TRESORERIE',
    'TRESORERIE NETTE',
    
    // Key activity types  
    'ACTIVITES OPERATIONNELLES',
    'ACTIVITES INVESTISSEMENT',
    'ACTIVITES FINANCEMENT',
    
    // Key operational flows
    'Capacite Autofinancement',
    'Variation stocks',
    'Variation creances',
    'Variation passif',
    
    // Key investment flows
    'Acquisitions immobilisations',
    'Cessions immobilisations',
    'Decaissements',
    'Encaissements',
    
    // Key financing flows
    'Augmentations capital',
    'Emprunts',
    'Remboursements',
    'Dividendes'
  ]
};

export class OcrService {
  private worker: any = null;
  private financialWorker: any = null; // Specialized worker for financial docs

  async initializeOcr(): Promise<void> {
    if (!this.worker) {
      console.log('🔧 Initializing Tesseract OCR worker...');
      this.worker = await createWorker('fra', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      });

      await this.configureWorkerForFinancialDocs(this.worker);
    }
    
    // Initialize specialized financial worker for data extraction
    if (!this.financialWorker) {
      console.log('📊 Initializing specialized financial OCR worker...');
      this.financialWorker = await createWorker('fra', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`Financial OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      });
      
      await this.configureWorkerForDataExtraction(this.financialWorker);
    }
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      console.log('🧹 Cleaning up OCR worker...');
      await this.worker.terminate();
      this.worker = null;
    }
    
    if (this.financialWorker) {
      console.log('🧹 Cleaning up financial OCR worker...');
      await this.financialWorker.terminate();
      this.financialWorker = null;
    }
  }

  /**
   * Main extraction method - detects statements first, then extracts data
   */
  async extractFinancialData(file: File, options: OcrOptions = {}): Promise<ExtractedFinancialData> {
    const { onProgress } = options;
    try {
      onProgress?.('init', 'Initialisation des moteurs OCR Tesseract…', 5);
      console.log('🚀 Starting SYSCOHADA financial statement detection and extraction...');

      // Step 1: Detect financial statements + collect verification evidence
      onProgress?.('scan', `Lecture du document : ${file.name}`, 10);
      const detection = await this.detectFinancialStatements(file, onProgress);
      const detectedStatements = detection.statements;

      // Step 1bis: Vérification approfondie « état financier »
      // Niveaux 1-3 sont bloquants ; si l'un échoue, l'extraction est refusée.
      // Niveau 4 (cohérence) est vérifié plus bas, post-extraction, en warning.
      const verification = this.verifyFinancialDocument(detection.evidence, detectedStatements);
      if (!verification.passed) {
        const reasons = verification.rejectionReasons.join(' · ');
        onProgress?.('error',
          `Document refusé : ${reasons}`, 50, { verification });
        console.warn('🚫 Document rejected by verification:', verification);
        throw new FinancialDocumentVerificationError(verification);
      }
      onProgress?.('detect',
        `Vérification réussie (${verification.confidence}/100) — ${detectedStatements.length} état(s) à extraire`,
        55,
        { statements: detectedStatements, verification });

      // Step 2: Extract data from each detected statement, for BOTH year
      // columns when detectable (SYSCOHADA statements always show N and N-1).
      const dataN: ExtractedFinancialData = {};
      const dataN1: ExtractedFinancialData = {};
      let yearN: number | null = null;
      let yearN1: number | null = null;
      let totalConfidence = 0;
      let stepIdx = 0;

      for (const statement of detectedStatements) {
        try {
          const label = { bilan: 'Bilan', compte_resultat: 'Compte de Résultat', tableau_flux: 'Tableau des Flux' }[statement.type] ?? statement.type;
          onProgress?.('extract', `Extraction des données : ${label} (page ${statement.pageNumber})`,
            60 + stepIdx * 10);
          const rawData = await this.extractStatementData(file, statement);
          await this.saveDebugOutput(statement.type, rawData);

          // Pull year columns from headers when present.
          const yearCols = statement.type === 'bilan'
            ? this.detectBilanColumns(rawData)
            : this.detectYearColumns(rawData);
          if (yearCols) {
            if (yearCols.yearN != null && (yearN == null || yearCols.yearN > yearN)) yearN = yearCols.yearN;
            if (yearCols.yearN1 != null && (yearN1 == null || yearCols.yearN1 > yearN1)) yearN1 = yearCols.yearN1;
          }

          const parsedN = this.parseStatementData(statement.type, rawData, 0);
          const parsedN1 = this.parseStatementData(statement.type, rawData, 1);
          Object.assign(dataN, parsedN);
          Object.assign(dataN1, parsedN1);
          totalConfidence += statement.confidence;
          const nCount = Object.values(parsedN).filter(v => v !== undefined).length;
          onProgress?.('field', `${label} : ${nCount} champ(s) extrait(s)`,
            65 + stepIdx * 10, { count: nCount });
          stepIdx++;
        } catch (error) {
          console.warn(`⚠️ Error extracting ${statement.type}:`, error);
          onProgress?.('warn', `Erreur sur ${statement.type}: ${error instanceof Error ? error.message : '?'}`, 60 + stepIdx * 10);
        }
      }

      const confidence = detectedStatements.length > 0 ? totalConfidence / detectedStatements.length : 0;

      // Build the final result. Backwards-compat: flat fields are the N
      // (current year) values; multiyear_data is always populated (with N
      // alone when N-1 wasn't found) so downstream handleDataInput can pick
      // the snake_case data for the requested year instead of falling back to
      // the convertToOptimusFormat-renamed flat shape (which mismatches the
      // review/UI field names).
      const hasN1Data = Object.values(dataN1).some(v => v !== undefined);
      const extractedData: ExtractedFinancialData = { ...dataN, confidence };

      const nowYear = new Date().getFullYear();
      const effectiveYearN = yearN ?? nowYear;
      const effectiveYearN1 = yearN1 ?? (effectiveYearN - 1);
      const my: Record<string, { year: number; data: ExtractedFinancialData }> = {
        'N': { year: effectiveYearN, data: dataN },
      };
      if (hasN1Data) my['N-1'] = { year: effectiveYearN1, data: dataN1 };
      (extractedData as any).multiyear_data = my;
      (extractedData as any).detectedYears = hasN1Data
        ? [effectiveYearN, effectiveYearN1]
        : [effectiveYearN];

      // Niveau 4 — cohérence comptable (non bloquant, warning visible)
      this.checkCoherence(dataN, verification);
      (extractedData as any).verification = verification;

      const fieldCount = Object.keys(dataN).filter(k => dataN[k] !== undefined).length;
      if (verification.warnings.length > 0) {
        for (const w of verification.warnings) {
          onProgress?.('warn', w, 95);
        }
      }
      onProgress?.('done', `Extraction terminée — ${fieldCount} champs (N${hasN1Data ? ' + N-1' : ''}) — confiance ${confidence.toFixed(0)}%`, 100,
        { fieldCount, confidence, verification });

      return extractedData;

    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      if (error instanceof FinancialDocumentVerificationError) {
        onProgress?.('error', `Document refusé : ${error.message}`, 100);
        throw error;
      }
      onProgress?.('error', `Erreur OCR : ${error instanceof Error ? error.message : 'Erreur inconnue'}`, 100);
      throw new Error(`Erreur lors de l'extraction OCR: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // ─── Helpers de vérification approfondie ────────────────────────────────────

  /** Recense les termes haute-valeur SYSCOHADA présents dans un texte. */
  collectSyscohadaTerms(text: string): string[] {
    const upper = text.toUpperCase();
    const found = new Set<string>();
    for (const term of SYSCOHADA_TERMS) {
      if (upper.includes(term.toUpperCase())) found.add(term);
    }
    return Array.from(found);
  }

  /**
   * Recense les codes SYSCOHADA reconnus en début de ligne ou de colonne
   * (e.g. "AB Frais d'établissement", "RA Ventes de marchandises").
   * Un code = 2 lettres majuscules suivies d'un espace puis d'une lettre
   * majuscule (label en MAJ commun dans les états officiels).
   */
  collectSyscohadaCodes(text: string): string[] {
    const found = new Set<string>();
    const codesSet = new Set(SYSCOHADA_CODES);
    for (const line of text.split('\n')) {
      // Try start of line and after each pipe (column separator)
      const segments = line.split('|');
      for (const seg of segments) {
        const m = seg.trim().match(/^([A-Z]{2})\s+[A-Z]/);
        if (m && codesSet.has(m[1])) found.add(m[1]);
      }
    }
    return Array.from(found);
  }

  /** Compte les cellules numériques (montants) extraites d'un texte de page. */
  countNumericCells(text: string): number {
    let count = 0;
    for (const line of text.split('\n')) {
      count += this.numsFromLine(line).length;
    }
    return count;
  }

  /**
   * Construit le verdict de vérification à partir de l'evidence collectée
   * pendant le scan + des états détectés.
   */
  verifyFinancialDocument(
    evidence: {
      syscohadaTerms: Set<string>;
      syscohadaCodes: Set<string>;
      pagesScanned: number;
      pagesWithNumericTables: number;
    },
    statements: FinancialStatement[],
  ): DocumentVerification {
    const termsArr = Array.from(evidence.syscohadaTerms);
    const codesArr = Array.from(evidence.syscohadaCodes);

    // Niveau 1 — Contexte SYSCOHADA/BCEAO
    const level1Passed = termsArr.length > 0 || codesArr.length >= 3;
    const level1: VerificationLevel = {
      passed: level1Passed,
      label: 'Contexte SYSCOHADA/BCEAO',
      detail: level1Passed
        ? `Termes (${termsArr.length}) : ${termsArr.slice(0, 3).join(', ') || '—'} · Codes (${codesArr.length}) : ${codesArr.slice(0, 5).join(', ') || '—'}`
        : 'Aucune référence SYSCOHADA, BCEAO, OHADA, FCFA/XOF ni code comptable normalisé détecté.',
      reason: level1Passed ? undefined : 'Document non identifié comme un état financier SYSCOHADA/BCEAO',
    };

    // Niveau 2 — ≥1 état financier reconnaissable à confiance ≥ 60 %
    const strong = statements.filter(s => s.confidence >= 60);
    const level2Passed = strong.length >= 1;
    const fmtStmt = (s: FinancialStatement) => `${s.type} p.${s.pageNumber} (${s.confidence.toFixed(0)}%)`;
    const level2: VerificationLevel = {
      passed: level2Passed,
      label: 'Structure d\'état financier reconnaissable',
      detail: level2Passed
        ? `${strong.length} état(s) à confiance ≥ 60 % : ${strong.map(fmtStmt).join(' · ')}`
        : statements.length > 0
          ? `Détections trop faibles : ${statements.map(fmtStmt).join(', ')}`
          : 'Aucun bilan, compte de résultat ou tableau de flux identifié.',
      reason: level2Passed ? undefined : 'Aucun état financier reconnaissable (Bilan, CR ou TFT) à confiance ≥ 60 %',
    };

    // Niveau 3 — Tableaux numériques exploitables
    const level3Passed = evidence.pagesWithNumericTables >= 1;
    const level3: VerificationLevel = {
      passed: level3Passed,
      label: 'Tableaux numériques exploitables',
      detail: level3Passed
        ? `${evidence.pagesWithNumericTables}/${evidence.pagesScanned} page(s) avec tableau financier (≥15 cellules numériques)`
        : `Aucune page avec tableau financier exploitable sur ${evidence.pagesScanned} scannée(s)`,
      reason: level3Passed ? undefined : 'Tableaux financiers absents ou illisibles',
    };

    // Niveau 4 — Cohérence comptable : placeholder (rempli post-extraction)
    const level4: VerificationLevel = {
      passed: true,
      label: 'Cohérence comptable',
      detail: 'Vérification effectuée après extraction (total actif = total passif, CA > 0).',
    };

    // Confiance globale : base + bonus codes
    const baseConfidence = (Number(level1Passed) + Number(level2Passed) + Number(level3Passed)) * 30;
    const codeBonus = Math.min(codesArr.length * 2, 10);
    const confidence = Math.min(100, baseConfidence + codeBonus);

    const passed = level1Passed && level2Passed && level3Passed;
    const rejectionReasons: string[] = [];
    if (!level1Passed) rejectionReasons.push(level1.reason!);
    if (!level2Passed) rejectionReasons.push(level2.reason!);
    if (!level3Passed) rejectionReasons.push(level3.reason!);

    return {
      passed,
      confidence,
      level1, level2, level3, level4,
      evidence: {
        syscohadaTerms: termsArr,
        syscohadaCodes: codesArr,
        pagesScanned: evidence.pagesScanned,
        pagesWithNumericTables: evidence.pagesWithNumericTables,
        detectedStatements: statements.map(s => ({ type: s.type, page: s.pageNumber, confidence: s.confidence })),
        coherenceWarnings: [],
      },
      rejectionReasons,
      warnings: [],
    };
  }

  /**
   * Niveau 4 — cohérence comptable. Non bloquant : remplit warnings et met à
   * jour level4 dans la verification fournie.
   */
  checkCoherence(data: ExtractedFinancialData, verification: DocumentVerification): void {
    const warnings: string[] = [];

    const totalActif = data.total_actif;
    const totalPassif = data.total_passif;
    if (totalActif !== undefined && totalPassif !== undefined && totalActif > 0) {
      const diff = Math.abs(totalActif - totalPassif);
      const tolerance = Math.max(Math.abs(totalActif) * 0.01, 1);
      if (diff > tolerance) {
        const pct = (diff / Math.abs(totalActif)) * 100;
        warnings.push(
          `Bilan déséquilibré : ACTIF=${totalActif.toLocaleString('fr-FR')} vs PASSIF=${totalPassif.toLocaleString('fr-FR')} (écart ${pct.toFixed(1)} %).`
        );
      }
    }

    if (data.chiffre_affaires !== undefined && data.chiffre_affaires <= 0) {
      warnings.push("Chiffre d'affaires extrait ≤ 0 — vérifiez la lecture du Compte de Résultat.");
    }

    verification.evidence.coherenceWarnings = warnings;
    verification.warnings.push(...warnings);
    verification.level4 = {
      passed: warnings.length === 0,
      label: 'Cohérence comptable',
      detail: warnings.length === 0
        ? totalActif !== undefined && totalPassif !== undefined
          ? `ACTIF (${totalActif.toLocaleString('fr-FR')}) = PASSIF (${totalPassif.toLocaleString('fr-FR')})`
          : 'Pas de bilan extrait — cohérence non testée'
        : warnings.join(' · '),
    };
  }

  /**
   * Detect financial statements in PDF by scanning all pages.
   * Returns the detected statements AND the verification evidence collected
   * during scanning so the caller can run the strict gate check.
   */
  async detectFinancialStatements(file: File, onProgress?: OcrOptions['onProgress']): Promise<{
    statements: FinancialStatement[];
    evidence: {
      syscohadaTerms: Set<string>;
      syscohadaCodes: Set<string>;
      pagesScanned: number;
      pagesWithNumericTables: number;
    };
  }> {
    console.log('🔍 Starting financial statement detection...');
    
    // Validate file parameter
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file parameter - must be a File object');
    }
    
    console.log(`📄 File validation: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    const detectedStatements: FinancialStatement[] = [];
    const evidence = {
      syscohadaTerms: new Set<string>(),
      syscohadaCodes: new Set<string>(),
      pagesScanned: 0,
      pagesWithNumericTables: 0,
    };

    try {
      const fileArrayBuffer = await file.arrayBuffer();
      console.log(`📊 File read successfully: ${fileArrayBuffer.byteLength} bytes`);
      
      const pdf = await pdfjsLib.getDocument({ data: fileArrayBuffer }).promise;
    const totalPages = pdf.numPages;
    onProgress?.('scan', `Document chargé — ${totalPages} pages à analyser`, 12, { totalPages });
    console.log(`📄 Scanning ${totalPages} pages for financial statements...`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`🔎 Analyzing page ${pageNum}/${totalPages}...`);
      const pct = 12 + Math.round((pageNum / totalPages) * 40);
      onProgress?.('page', `Analyse page ${pageNum} / ${totalPages}`, pct, { page: pageNum, totalPages });

      // Check if we already found all three financial statements
      const foundStatements = new Set(detectedStatements.map(s => s.type));
      if (foundStatements.has('bilan') && foundStatements.has('compte_resultat') && foundStatements.has('tableau_flux')) {
        console.log(`🎯 All three financial statements found! Stopping scan at page ${pageNum - 1}`);
        onProgress?.('detect', 'Les 3 états financiers détectés — arrêt anticipé', pct);
        break;
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        
        // Check if page has extractable text first
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item: any) => item.str && item.str.trim())
          .map((item: any) => item.str)
          .join(' ');
        
        let analysisText = '';
        
        if (pageText.trim().length > 100) {
          // Text-based PDF: use extracted text directly with better formatting
          console.log(`📝 Page ${pageNum} has extractable text (${pageText.length} chars) - using direct text extraction`);
          
          // Apply the same pipe-separation logic for consistency
          const textItems = textContent.items as any[];
          const positionedItems = textItems
            .filter((item: any) => item.str && item.str.trim())
            .map((item: any) => ({
              text: item.str.trim(),
              x: item.transform[4],
              y: item.transform[5]
            }))
            .sort((a, b) => b.y - a.y || a.x - b.x);
          
          // Group items by rows and create pipe-separated format for analysis
          const rowGroups: { [key: string]: any[] } = {};
          const yTolerance = 5;
          
          positionedItems.forEach(item => {
            const existingRowKey = Object.keys(rowGroups).find(key => 
              Math.abs(parseFloat(key) - item.y) <= yTolerance
            );
            
            const rowKey = existingRowKey || item.y.toString();
            
            if (!rowGroups[rowKey]) {
              rowGroups[rowKey] = [];
            }
            
            rowGroups[rowKey].push(item);
          });
          
          const formattedRows = Object.keys(rowGroups)
            .sort((a, b) => parseFloat(b) - parseFloat(a))
            .map(rowKey => {
              const rowItems = rowGroups[rowKey]
                .sort((a, b) => a.x - b.x)
                .map(item => item.text);
              
              return rowItems.join('|');
            })
            .filter(row => row.trim().length > 0);
          
          analysisText = formattedRows.join('\n');
          console.log(`📝 Formatted ${formattedRows.length} rows with pipe separators for analysis`);
        } else {
          // Image-based PDF: fall back to OCR
          console.log(`🖼️ Page ${pageNum} has minimal text (${pageText.length} chars) - using OCR processing`);
          
          const viewport = page.getViewport({ scale: 3.0 });
          
          // Create canvas and render page
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          await page.render(renderContext).promise;
        
          // Apply optimized image preprocessing for financial documents
          const preprocessedCanvas = await this.preprocessImage(canvas, {
            dpi: 300,                    // Balanced DPI for memory efficiency
            contrast: 1.3,               // Moderate contrast increase
            brightness: 1.15,            // Slight brightness boost
            gamma: 0.85,                 // Improved text definition
            useAdaptiveThresholding: true,
            useDeskewing: false,         // Disable to reduce memory usage
            useNoiseReduction: true,
            useSharpening: true,
            useAdvancedFiltering: false, // Disable to reduce memory usage
            scaleFactor: 1.5             // Reduced scale factor for memory efficiency
          });
          
          // OCR the preprocessed page with detection worker
          const { data: { text } } = await this.worker.recognize(preprocessedCanvas);
          analysisText = text;
        }
        
        // Analyze text (either from direct extraction or OCR) for financial statements
        for (const [statementType, criteria] of Object.entries(STATEMENT_CRITERIA)) {
          const confidence = this.calculateStatementConfidence(analysisText, criteria);
          
          console.log(`📊 Page ${pageNum} - ${statementType}: ${confidence.toFixed(1)}% match`);
          
          if (confidence >= 40) { // lowered threshold for better document coverage
            // Check if we already found this statement type
            const existingStatement = detectedStatements.find(s => s.type === statementType);
            const labels: Record<string, string> = { bilan: 'Bilan', compte_resultat: 'Compte de Résultat', tableau_flux: 'Tableau des Flux' };
            const label = labels[statementType] ?? statementType;

            if (!existingStatement || confidence > existingStatement.confidence) {
              if (existingStatement) {
                const index = detectedStatements.indexOf(existingStatement);
                detectedStatements.splice(index, 1);
              }
              const pct = 12 + Math.round((pageNum / totalPages) * 40);
              onProgress?.('found', `${label} détecté — page ${pageNum} (confiance ${confidence.toFixed(0)}%)`,
                pct, { type: statementType, page: pageNum, confidence });
              console.log(`✅ Detected ${statementType} on page ${pageNum} with ${confidence.toFixed(1)}% confidence`);

              detectedStatements.push({
                type: statementType as 'bilan' | 'compte_resultat' | 'tableau_flux',
                pageNumber: pageNum,
                confidence,
                text: analysisText
              });
            }
          }
        }

        // ── Collecte d'evidence pour la vérification approfondie ──────────
        evidence.pagesScanned++;
        for (const term of this.collectSyscohadaTerms(analysisText)) evidence.syscohadaTerms.add(term);
        for (const code of this.collectSyscohadaCodes(analysisText)) evidence.syscohadaCodes.add(code);
        const numericCells = this.countNumericCells(analysisText);
        if (numericCells >= 15) evidence.pagesWithNumericTables++;

      } catch (error) {
        console.warn(`⚠️ Error processing page ${pageNum}:`, error);
      }
    }

      console.log(`🎯 Detection complete. Found ${detectedStatements.length} financial statements:`);
      detectedStatements.forEach(stmt => {
        console.log(`  - ${stmt.type}: Page ${stmt.pageNumber} (${stmt.confidence.toFixed(1)}% confidence)`);
      });
      console.log(`🔎 Evidence — SYSCOHADA terms: ${Array.from(evidence.syscohadaTerms).join(', ') || '(none)'}; codes (${evidence.syscohadaCodes.size}): ${Array.from(evidence.syscohadaCodes).slice(0,10).join(', ')}; tables on ${evidence.pagesWithNumericTables}/${evidence.pagesScanned} pages.`);

      return { statements: detectedStatements, evidence };
      
    } catch (fileError) {
      console.error('❌ Failed to read or process PDF file:', fileError);
      throw new Error(`PDF processing failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Calculate how well a page text matches statement criteria (10% threshold)
   */
  private calculateStatementConfidence(text: string, criteria: string[]): number {
    // Enhanced French text normalization for better OCR recognition
    const normalizedText = text.toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/['\u2019\u2018]/g, '')
      .replace(/[\u00A0\s]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`🔍 Analyzing text snippet (first 200 chars): "${text.substring(0, 200)}..."`);
    
    let matchedCriteria = 0;
    const matchedTerms: string[] = [];
    
    for (const criterion of criteria) {
      const normalizedCriterion = criterion.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ýÿ]/g, 'y')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/['\u2019\u2018]/g, '')
        .replace(/[\u00A0\s]+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Try exact match first
      if (normalizedText.includes(normalizedCriterion)) {
        matchedCriteria++;
        matchedTerms.push(criterion);
      } else {
        // Try flexible word matching for better OCR tolerance
        const words = normalizedCriterion.split(' ').filter(w => w.length > 2);
        if (words.length > 0) {
          const matchedWords = words.filter(word => normalizedText.includes(word));
          
          // If most key words match, count as partial match
          if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
            matchedCriteria += 0.8; // Strong partial match worth 80%
            matchedTerms.push(`${criterion} (${matchedWords.length}/${words.length} words)`);
          } else if (matchedWords.length >= Math.ceil(words.length * 0.4)) {
            matchedCriteria += 0.5; // Weak partial match worth 50%
            matchedTerms.push(`${criterion} (weak match)`);
          }
        }
      }
    }
    
    const confidence = (matchedCriteria / criteria.length) * 100;
    
    if (matchedTerms.length > 0) {
      console.log(`📝 Matched terms: ${matchedTerms.slice(0, 5).join(', ')}${matchedTerms.length > 5 ? '...' : ''}`);
    }
    
    return confidence;
  }
  
  /**
   * Extract data from a specific financial statement page
   */
  async extractStatementData(file: File, statement: FinancialStatement): Promise<string> {
    console.log(`📊 Extracting data from ${statement.type} on page ${statement.pageNumber}...`);
    
    // Validate file parameter
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file parameter - must be a File object');
    }
    
    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: fileArrayBuffer }).promise;
      const page = await pdf.getPage(statement.pageNumber);
      
      // Check if page has extractable text first
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => item.str)
        .join(' ');
      
      let extractionText = '';
      
      if (pageText.trim().length > 100) {
        // Text-based PDF: use extracted text directly with better formatting
        console.log(`📝 Using direct text extraction for ${statement.type} (${pageText.length} chars)`);
        
        // Get text with positioning information for better table structure
        const textItems = textContent.items as any[];
        const positionedItems = textItems
          .filter((item: any) => item.str && item.str.trim())
          .map((item: any) => ({
            text: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5]
          }))
          .sort((a, b) => b.y - a.y || a.x - b.x); // Sort by Y (top to bottom), then X (left to right)
        
        // Group items by rows (similar Y positions) and create pipe-separated format
        const rowGroups: { [key: string]: any[] } = {};
        const yTolerance = 5; // Pixels tolerance for same row
        
        positionedItems.forEach(item => {
          // Find existing row group with similar Y position
          const existingRowKey = Object.keys(rowGroups).find(key => 
            Math.abs(parseFloat(key) - item.y) <= yTolerance
          );
          
          const rowKey = existingRowKey || item.y.toString();
          
          if (!rowGroups[rowKey]) {
            rowGroups[rowKey] = [];
          }
          
          rowGroups[rowKey].push(item);
        });
        
        // Convert each row to pipe-separated format
        const formattedRows = Object.keys(rowGroups)
          .sort((a, b) => parseFloat(b) - parseFloat(a)) // Sort rows by Y position (top to bottom)
          .map(rowKey => {
            const rowItems = rowGroups[rowKey]
              .sort((a, b) => a.x - b.x) // Sort items in row by X position (left to right)
              .map(item => item.text);
            
            return rowItems.join('|'); // Join with pipes for consistent format
          })
          .filter(row => row.trim().length > 0);
        
        extractionText = formattedRows.join('\n');
        console.log(`📝 Formatted ${formattedRows.length} rows with pipe separators`);
      } else {
        // Image-based PDF: fall back to OCR with intensive preprocessing
        console.log(`🖼️ Using OCR extraction for ${statement.type} (minimal text: ${pageText.length} chars)`);
        
        const viewport = page.getViewport({ scale: 3.5 }); // Even higher resolution for data extraction
        
        // Create canvas and render page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Apply intensive preprocessing for data extraction
        const preprocessedCanvas = await this.preprocessImage(canvas, {
          dpi: 400, // Higher DPI for data extraction
          contrast: 1.3,
          brightness: 1.15,
          gamma: 0.85,
          useAdaptiveThresholding: true,
          useDeskewing: true,
          useNoiseReduction: true,
          useSharpening: true
        });
        
        // OCR with enhanced table-optimized settings
        await this.worker.setParameters({
          tessedit_pageseg_mode: '6', // Uniform block of text (better for tables)
          preserve_interword_spaces: '1',
          textord_tablefind_good_width: '3',
          textord_tabfind_find_tables: '1',
          // Additional parameters for financial data extraction
          tessedit_enable_numeric_mode: '1',
          numeric_punctuation: '.,',
          textord_heavy_nr: '1',
          textord_debug_tabfind: '0',
          textord_tabfind_show_vlines: '0'
        });
        
        const { data: { text, confidence } } = await this.financialWorker.recognize(preprocessedCanvas);
        console.log(`📊 OCR confidence for ${statement.type}: ${confidence}%`);
        extractionText = text;
      }
      
      // Process extracted text (either from direct extraction or OCR)
      const processedText = this.processTableData(extractionText);
      
      console.log(`✅ Extracted ${processedText.split('\n').length} lines from ${statement.type}`);
      
      return processedText;
      
    } catch (extractError) {
      console.error(`❌ Failed to extract data from ${statement.type}:`, extractError);
      throw new Error(`Data extraction failed: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process table data by converting column separators to pipes
   */
  private processTableData(text: string): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Replace multiple spaces/tabs with pipe separator
        // This helps with French thousand separators (spaces)
        let processedLine = line
          .replace(/\t+/g, '|')  // Replace tabs with pipes
          .replace(/\s{3,}/g, '|'); // Replace 3+ spaces with pipes
        
        // Clean up any double pipes
        processedLine = processedLine.replace(/\|+/g, '|');
        
        processedLines.push(processedLine);
      }
    }
    
    return processedLines.join('\n');
  }

  /**
   * Save debug output to files as specified
   */
  private async saveDebugOutput(statementType: string, rawData: string): Promise<void> {
    try {
      const fileName = {
        'bilan': 'ocr_bilan.txt',
        'compte_resultat': 'ocr_cr.txt', 
        'tableau_flux': 'ocr_tft.txt'
      }[statementType];
      
      if (fileName) {
        // In a real implementation, you'd save to file system
        // For now, we'll log the data
        console.log(`💾 Saving ${statementType} data to ${fileName}`);
        console.log(`📄 Raw data length: ${rawData.length} characters`);
        
        // You could implement actual file saving here if needed
        // For browser environment, this would typically be a download
      }
    } catch (error) {
      console.warn('⚠️ Error saving debug output:', error);
    }
  }
  
  /**
   * Parse statement data for a specific year column.
   * @param yearOffset 0 = current year (N), 1 = previous year (N-1).
   */
  private parseStatementData(statementType: string, rawData: string, yearOffset: 0 | 1 = 0): ExtractedFinancialData {
    switch (statementType) {
      case 'bilan':
        return this.parseBilanDataForYear(rawData, yearOffset);
      case 'compte_resultat':
        return this.parseCompteResultatForYear(rawData, yearOffset);
      case 'tableau_flux':
        return this.parseTableauFluxForYear(rawData, yearOffset);
      default:
        return {};
    }
  }
  
  // ─── Normalisation helpers ──────────────────────────────────────────────────

  /**
   * Normalize a French string: remove accents, strip non-alphanumeric chars, collapse spaces.
   */
  private normalizeFr(s: string): string {
    return s
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíî]/g, 'i')
      .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
      .replace(/[\u00A0]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Return true if haystack contains ≥60% of needle's significant words.
   */
  private fuzzyContains(haystack: string, needle: string): boolean {
    const words = needle.split(' ').filter(w => w.length > 3);
    if (words.length === 0) return haystack.includes(needle);
    const matched = words.filter(w => haystack.includes(w));
    return matched.length >= Math.ceil(words.length * 0.6);
  }

  /**
   * Find ALL lines matching any of the labels, ordered by match specificity.
   * Critical for ambiguous labels (e.g. "TOTAL GENERAL" appears in ACTIF and
   * PASSIF; "RESULTAT NET" in both CR and Bilan passif).
   */
  private findAllLinesByLabel(text: string, ...labels: string[]): string[] {
    const matches: Array<{ line: string; index: number; score: number }> = [];
    const allLines = text.split('\n');
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const norm = this.normalizeFr(line);
      let bestScore = 0;
      for (const label of labels) {
        const normLabel = this.normalizeFr(label);
        if (!normLabel) continue;
        if (norm.includes(normLabel)) {
          // Exact substring match wins; longer (more specific) labels score higher.
          bestScore = Math.max(bestScore, 100 + normLabel.length);
        } else if (this.fuzzyContains(norm, normLabel)) {
          const words = normLabel.split(' ').filter(w => w.length > 3);
          const matched = words.filter(w => norm.includes(w)).length;
          if (words.length > 0) bestScore = Math.max(bestScore, 50 * matched / words.length);
        }
      }
      if (bestScore > 0) matches.push({ line, index: i, score: bestScore });
    }
    // Sort by score desc, stable on document order.
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    return matches.map(m => m.line);
  }

  /**
   * Find the first line in `text` that matches any of the given label variants.
   * @deprecated Use findAllLinesByLabel for ambiguous labels.
   */
  private findLineByLabel(text: string, ...labels: string[]): string | null {
    const lines = this.findAllLinesByLabel(text, ...labels);
    return lines[0] ?? null;
  }

  /**
   * Parse a single cell into a financial amount.
   * Handles: French thousand spaces, decimal commas, parens-negatives
   * (accounting), signed numbers, currency tokens stripped, and dash
   * placeholders (returns null = "no value", not zero).
   */
  parseAmount(cell: string): number | null {
    if (!cell) return null;
    const trimmed = cell.trim();
    if (!trimmed) return null;
    if (/^[—–_\s]+$/.test(trimmed)) return null;
    if (/^-+$/.test(trimmed)) return null;

    const isNegative = /^\(.*\)$/.test(trimmed);
    let str = trimmed.replace(/[()]/g, '').trim();
    str = str.replace(/(FCFA|XOF|F\s?CFA|€|\$|£|¥|₦)/gi, '').trim();
    str = str.replace(/[\s  ]/g, '');
    str = str.replace(/,(\d+)$/, '.$1');
    if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
    const n = parseFloat(str);
    if (isNaN(n)) return null;
    return isNegative ? -Math.abs(n) : n;
  }

  /**
   * Extract numeric cells from a line, preserving null gaps for empty cells.
   * Lets callers identify NET-N as column 3 even when AMORT is empty.
   */
  extractNumbersWithGaps(line: string): (number | null)[] {
    const cells = line.includes('|') ? line.split('|') : line.split(/\s{2,}|\t+/);
    return cells.map(c => this.parseAmount(c));
  }

  /**
   * Extract all financial numbers (non-null) from a pipe/space-separated line.
   * Delegates to extractNumbersWithGaps + parseAmount which handle French
   * formats (parens-negatives, decimal commas, currency tokens, smaller
   * numbers, dash placeholders).
   */
  private numsFromLine(line: string): number[] {
    return this.extractNumbersWithGaps(line).filter((n): n is number => n !== null);
  }

  /**
   * Find a line by label, then pick a number by index.
   * numIdx: 0 = first, -1 = last, 2 = third (NET_N in SYSCOHADA ACTIF format).
   */
  private labelValue(text: string, numIdx: number, ...labels: string[]): number | undefined {
    for (const line of this.findAllLinesByLabel(text, ...labels)) {
      const nums = this.numsFromLine(line);
      if (nums.length === 0) continue;
      const idx = numIdx < 0 ? nums.length + numIdx : numIdx;
      return nums[Math.max(0, Math.min(idx, nums.length - 1))];
    }
    return undefined;
  }

  /**
   * Pick the NET-N value for an ACTIF line. Uses detected column position when
   * available; otherwise falls back to a length-aware heuristic.
   *
   * SYSCOHADA layouts:
   *   4 cols: BRUT | AMORT/DEPREC | NET-N | NET-N-1 -> NET-N at index 2
   *   3 cols: BRUT | NET-N | NET-N-1               -> NET-N at index 1
   *   2 cols: NET-N | NET-N-1                      -> NET-N at index 0
   *   1 col:  NET-N only                           -> that single value
   */
  private actifWithHint(text: string, columnHint: number | null, ...labels: string[]): number | undefined {
    for (const line of this.findAllLinesByLabel(text, ...labels)) {
      const cells = this.extractNumbersWithGaps(line);
      const nums = cells.filter((n): n is number => n !== null);
      if (nums.length === 0) continue;

      if (columnHint !== null && columnHint >= 0 && columnHint < cells.length) {
        const v = cells[columnHint];
        if (v !== null) return v;
      }
      if (nums.length >= 3) return nums[nums.length - 2];
      return nums[0];
    }
    return undefined;
  }

  /** Backwards-compatible: pick ACTIF NET-N without explicit column hint. */
  private actif(text: string, ...labels: string[]): number | undefined {
    return this.actifWithHint(text, null, ...labels);
  }

  /** For PASSIF/CR/TFT lines: current year is typically the first number after the label. */
  private cr(text: string, ...labels: string[]): number | undefined {
    return this.crWithHint(text, null, ...labels);
  }

  /**
   * Same as cr() but accepts a column hint. The hint is interpreted as a YEAR
   * column index across the numeric cells (0 = first year present on the line,
   * 1 = second year), NOT a raw cell index — CR/TFT/PASSIF lines start with a
   * non-numeric label so the label cell would otherwise be counted.
   */
  private crWithHint(text: string, columnHint: number | null, ...labels: string[]): number | undefined {
    for (const line of this.findAllLinesByLabel(text, ...labels)) {
      const nums = this.numsFromLine(line);
      if (nums.length === 0) continue;
      if (columnHint !== null && columnHint >= 0 && columnHint < nums.length) {
        return nums[columnHint];
      }
      return nums[0];
    }
    return undefined;
  }

  /**
   * Split a Bilan extraction into ACTIF / PASSIF subtexts so labels that
   * appear in both sections (TOTAL GENERAL, RESULTAT NET) can be resolved
   * unambiguously.
   */
  splitBilanSections(text: string): { actif: string; passif: string } {
    const lines = text.split('\n');
    let passifIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const norm = this.normalizeFr(lines[i]);
      if (/\bpassif\b/.test(norm) && !/\bactif\b/.test(norm)) {
        passifIdx = i;
        break;
      }
    }
    if (passifIdx < 0) {
      for (let i = 0; i < lines.length; i++) {
        if (/capitaux\s+propres/.test(this.normalizeFr(lines[i]))) {
          passifIdx = i;
          break;
        }
      }
    }
    if (passifIdx < 0) return { actif: text, passif: text };
    return {
      actif: lines.slice(0, passifIdx).join('\n'),
      passif: lines.slice(passifIdx).join('\n'),
    };
  }

  /**
   * Detect Bilan column layout from a header row containing "brut" and "net".
   * Returns null when no header line is found - callers fall back to heuristics.
   */
  detectBilanColumns(text: string): {
    brutIdx: number; amortIdx: number; netNIdx: number; netN1Idx: number;
    yearN: number | null; yearN1: number | null;
  } | null {
    for (const line of text.split('\n')) {
      const norm = this.normalizeFr(line);
      if (!(norm.includes('brut') && norm.includes('net'))) continue;
      const rawCells = line.includes('|') ? line.split('|') : line.split(/\s{2,}/);
      const cells = rawCells.map(c => this.normalizeFr(c).trim());
      const brutIdx = cells.findIndex(c => /^brut/.test(c));
      const amortIdx = cells.findIndex(c => /amort|deprec/.test(c));
      const netIdxs = cells
        .map((c, i) => (/^net\b|^nets\b/.test(c) ? i : -1))
        .filter(i => i >= 0);
      const yearMatches = (line.match(/(19|20)\d{2}/g) || []).map(y => parseInt(y, 10));
      const sortedYears = Array.from(new Set(yearMatches)).sort((a, b) => b - a);
      return {
        brutIdx,
        amortIdx,
        netNIdx: netIdxs[0] ?? -1,
        netN1Idx: netIdxs[1] ?? -1,
        yearN: sortedYears[0] ?? null,
        yearN1: sortedYears[1] ?? null,
      };
    }
    return null;
  }

  /**
   * Detect year columns (N vs N-1) for CR / TFT by scanning the first dozen
   * lines for 4-digit year tokens.
   */
  detectYearColumns(text: string): { yearN: number | null; yearN1: number | null } {
    for (const line of text.split('\n').slice(0, 12)) {
      const yearMatches = (line.match(/(19|20)\d{2}/g) || []).map(y => parseInt(y, 10));
      const sorted = Array.from(new Set(yearMatches)).sort((a, b) => b - a);
      if (sorted.length >= 1) return { yearN: sorted[0], yearN1: sorted[1] ?? null };
    }
    return { yearN: null, yearN1: null };
  }

  // ─── Parse methods ───────────────────────────────────────────────────────────

  /**
   * Parse Bilan data for a specific year column. Use sections (ACTIF/PASSIF)
   * to disambiguate labels that appear in both, and column detection (from
   * BRUT/AMORT/NET headers) to pick the right value when available.
   *
   * @param yearOffset 0 = current year (NET-N), 1 = previous year (NET-N-1).
   */
  private parseBilanDataForYear(text: string, yearOffset: 0 | 1 = 0): ExtractedFinancialData {
    const { actif, passif } = this.splitBilanSections(text);
    const cols = this.detectBilanColumns(actif);

    // ACTIF column hint: prefer detected NET-N / NET-N-1 from header row.
    const actifHint = yearOffset === 0
      ? (cols?.netNIdx ?? null)
      : (cols?.netN1Idx ?? null);
    // PASSIF column hint: 2 cols (N | N-1) — first = N, second = N-1.
    const passifHint = yearOffset;

    const a = (...l: string[]) => this.actifWithHint(actif, actifHint, ...l);
    const p = (...l: string[]) => this.crWithHint(passif, passifHint, ...l);
    // Some PASSIF labels (résultat exercice, dettes location) are not always
    // in the PASSIF subtext if section splitter misfires — fall back to full
    // text scope. Use full text only when section-scoped returns undefined.
    const pf = (...l: string[]) => p(...l) ?? this.crWithHint(text, passifHint, ...l);

    return {
      // ── ACTIF IMMOBILISÉ ────────────────────────────────────────────────
      immobilisations_incorporelles:  a('IMMOBILISATIONS INCORPORELLES'),
      frais_developpement:            a('Frais de developpement', 'frais de prospection'),
      brevets_licences:               a('Brevets', 'licences', 'logiciels'),
      fonds_commercial:               a('Fonds commercial', 'droit au bail'),
      autres_immob_incorporelles:     a('Autres immobilisations incorporelles'),
      immobilisations_corporelles:    a('IMMOBILISATIONS CORPORELLES'),
      terrains:                       a('Terrains'),
      batiments:                      a('Batiments', 'Bâtiments'),
      agencements:                    a('Agencements', 'amenagements'),
      materiel_mobilier:              a('Materiel mobilier', 'Matériel mobilier', 'actifs biologiques'),
      materiel_transport:             a('Materiel de transport', 'Matériel de transport'),
      avances_immobilisations:        a('Avances et acomptes', 'Avances acomptes immobilisations'),
      immobilisations_financieres:    a('IMMOBILISATIONS FINANCIERES'),
      titres_participation:           a('Titres de participation'),
      autres_immob_financieres:       a('Autres immobilisations financieres', 'Autres Immobilisations Financières'),
      depots_cautionnements:          a('Depots et cautionnements', 'Dépôts et cautionnements'),
      total_actif_immobilise:         a('TOTAL ACTIF IMMOBILISE', 'TOTAL IMMOBILISATIONS'),
      // ── ACTIF CIRCULANT ─────────────────────────────────────────────────
      actif_circulant_hao:            a('ACTIF CIRCULANT H.A.O', 'ACTIF CIRCULANT HAO', 'Créances HAO', 'Creances HAO'),
      stocks:                         a('STOCKS ET ENCOURS', 'STOCKS'),
      creances_clients:               a('Créances clients', 'Creances clients', 'CREANCES ET EMPLOIS'),
      fournisseurs_avances:           a('Fournisseurs avances versees', 'Fournisseurs, avances versees', 'Fournisseurs avances versées'),
      clients:                        a('Clients et comptes rattaches', 'Clients et comptes rattachés', 'Clients'),
      autres_creances:                a('Autres creances', 'Autres créances'),
      total_actif_circulant:          a('TOTAL ACTIF CIRCULANT'),
      // ── TRÉSORERIE ACTIF ────────────────────────────────────────────────
      titres_placement:               a('Titres de placement'),
      valeurs_encaisser:              a('Valeurs a encaisser', 'Valeurs à encaisser'),
      banques_caisses:                a('Banques chèques postaux caisse', 'Banques cheques postaux caisse', 'Banque', 'Caisse'),
      tresorerie_actif:               a('TOTAL TRESORERIE ACTIF', 'TRESORERIE ACTIF'),
      ecart_conversion_actif:         a('Ecart de conversion actif', 'Ecarts de conversion Actif'),
      // TOTAL GENERAL en ACTIF → vraie valeur totale du bilan
      total_actif:                    a('TOTAL GENERAL', 'TOTAL ACTIF'),

      // ── PASSIF CAPITAUX PROPRES ─────────────────────────────────────────
      // Fix bug: previous code used 'CA|CAPITAL' (literal pipe) which never
      // matched. Now matches "Capital", "CA - Capital", "CAPITAL SOCIAL"...
      capital_social:                 pf('Capital social', 'Capital'),
      actionnaires_capital:           pf('Apporteurs capital non appele', 'Apporteurs capital non appelé', 'Actionnaires capital non appele', 'capital non appele'),
      primes_capital:                 pf('Primes liees au capital', 'Primes liées au capital'),
      ecarts_reevaluation:            pf('Ecarts de reevaluation', 'Ecarts de réévaluation'),
      reserves_indisponibles:         pf('Reserves indisponibles', 'Réserves indisponibles'),
      reserves_libres:                pf('Reserves libres', 'Réserves libres'),
      report_nouveau:                 pf('Report a nouveau', 'Report à nouveau'),
      resultat_exercice:              pf('Resultat net de l\'exercice', 'Résultat net de l\'exercice', 'Resultat de l\'exercice', 'Résultat de l\'exercice'),
      subventions_investissement:     pf('Subventions d\'investissement'),
      provisions_reglementees:        pf('Provisions reglementees', 'Provisions réglementées'),
      capitaux_propres:               pf('TOTAL CAPITAUX PROPRES'),
      // ── PASSIF DETTES ───────────────────────────────────────────────────
      emprunts_dettes_financieres:    pf('Emprunts et dettes financieres', 'Emprunts et dettes financières'),
      dettes_location:                pf('Dettes de location acquisition', 'Dettes de location-acquisition', 'Dettes de location'),
      provisions_risques:             pf('Provisions pour risques et charges', 'Provisions pour risques'),
      total_dettes_financieres:       pf('TOTAL DETTES FINANCIERES', 'TOTAL DETTES FINANCIÈRES'),
      fournisseurs:                   pf('Fournisseurs d\'exploitation', 'Dettes fournisseurs', 'Fournisseurs et comptes rattaches', 'Fournisseurs et comptes rattachés'),
      dettes_fiscales:                pf('Dettes fiscales et sociales', 'Dettes fiscales', 'Organismes sociaux'),
      tva_a_payer:                    pf('TVA a payer', 'TVA à payer', 'TVA collectee', 'TVA collectée'),
      passif_circulant_hao:           pf('PASSIF CIRCULANT HAO', 'Dettes circulantes HAO'),
      total_passif_circulant:         pf('TOTAL PASSIF CIRCULANT'),
      tresorerie_passif:              pf('TOTAL TRESORERIE PASSIF', 'TRESORERIE PASSIF'),
      ecart_conversion_passif:        pf('Ecart de conversion passif', 'Ecarts de conversion Passif'),
      // TOTAL GENERAL en PASSIF → maintenant correctement résolu via section
      total_passif:                   pf('TOTAL GENERAL', 'TOTAL PASSIF'),
    };
  }

  private parseBilanData(text: string): ExtractedFinancialData {
    return this.parseBilanDataForYear(text, 0);
  }

  /**
   * Parse Compte de Résultat for a specific year column.
   * @param yearOffset 0 = current year (col N), 1 = previous year (col N-1).
   */
  private parseCompteResultatForYear(text: string, yearOffset: 0 | 1 = 0): ExtractedFinancialData {
    const v = (...l: string[]) => this.crWithHint(text, yearOffset, ...l);
    return {
      ventes_marchandises:            v('Ventes de marchandises'),
      achats_marchandises:            v('Achats de marchandises'),
      variation_stocks_marchandises:  v('Variation de stocks de marchandises'),
      marge_brute_marchandises:       v('MARGE BRUTE SUR MARCHANDISES', 'MARGE COMMERCIALE'),
      ventes_produits_fabriques:      v('Ventes de produits fabriques', 'Ventes de produits finis'),
      travaux_services:               v('Travaux services vendus', 'Travaux, services vendus'),
      produits_accessoires:           v('Produits accessoires'),
      chiffre_affaires:               v('CHIFFRE D\'AFFAIRES', 'CHIFFRE AFFAIRES'),
      production_stockee:             v('Production stockee', 'Production stockée'),
      production_immobilisee:         v('Production immobilisee', 'Production immobilisée'),
      subvention_exploitation:        v('Subvention d\'exploitation', 'Subventions d\'exploitation'),
      autres_produits:                v('Autres produits'),
      transferts_charges:             v('Transferts de charges d\'exploitation'),
      achats_matieres_premieres:      v('Achats de matieres premieres', 'Achats de matières premières'),
      variation_stocks_mp:            v('Variation de stocks de matieres', 'Variation de stocks de matières'),
      autres_achats:                  v('Autres achats'),
      variation_autres_stocks:        v('Variation des autres stocks', 'Variation autres stocks'),
      transports:                     v('Transports'),
      services_exterieurs:            v('Services exterieurs', 'Services extérieurs'),
      impots_taxes:                   v('Impots et taxes', 'Impôts et taxes'),
      autres_charges:                 v('Autres charges'),
      valeur_ajoutee:                 v('VALEUR AJOUTEE', 'VALEUR AJOUTÉE'),
      charges_personnel:              v('Charges de personnel'),
      impots_taxes_remunerations:     v('Impots et taxes sur remunerations', 'Impôts et taxes sur rémunérations'),
      excedent_brut_exploitation:     v('EXCEDENT BRUT D\'EXPLOITATION', 'EXCÉDENT BRUT D\'EXPLOITATION', 'EXCEDENT BRUT'),
      reprises_provisions:            v('Reprises de provisions et depreciations', 'Reprises de provisions et dépréciations', 'Reprises de provisions'),
      reprises_amortissements:        v('Reprises d\'amortissements'),
      autres_produits_exploitation:   v('Autres produits d\'exploitation'),
      dotations_amortissements:       v('Dotations aux amortissements et depreciations', 'Dotations aux amortissements et dépréciations', 'Dotations aux amortissements'),
      dotations_provisions:           v('Dotations aux provisions'),
      autres_charges_exploitation:    v('Autres charges d\'exploitation'),
      resultat_exploitation:          v('RESULTAT D\'EXPLOITATION', 'RÉSULTAT D\'EXPLOITATION'),
      revenus_financiers:             v('Revenus financiers', 'Revenus financiers et assimiles', 'Revenus financiers et assimilés'),
      reprises_provisions_financieres: v('Reprises de provisions financieres', 'Reprises de provisions financières'),
      transferts_charges_financieres: v('Transferts de charges financieres', 'Transferts de charges financières'),
      frais_financiers:               v('Frais financiers', 'Frais financiers et charges assimilees', 'Frais financiers et charges assimilées'),
      dotations_provisions_financieres: v('Dotations aux provisions financieres', 'Dotations aux provisions financières'),
      resultat_financier:             v('RESULTAT FINANCIER', 'RÉSULTAT FINANCIER'),
      resultat_courant:               v('RESULTAT DES ACTIVITES ORDINAIRES', 'RÉSULTAT DES ACTIVITÉS ORDINAIRES', 'RESULTAT COURANT'),
      produits_cessions:              v('Produits des cessions d\'immobilisations'),
      valeurs_comptables_cessions:    v('Valeurs comptables des cessions d\'immobilisations'),
      autres_produits_hao:            v('Autres produits HAO', 'Autres produits H.A.O'),
      autres_charges_hao:             v('Autres charges HAO', 'Autres charges H.A.O'),
      resultat_hao:                   v('RESULTAT HORS ACTIVITES ORDINAIRES', 'RÉSULTAT HORS ACTIVITÉS ORDINAIRES', 'RESULTAT HAO', 'RESULTAT H.A.O'),
      participation_travailleurs:     v('Participation des travailleurs'),
      impots_resultat:                v('Impots sur le resultat', 'Impôts sur le résultat'),
      resultat_net:                   v('RESULTAT NET', 'RÉSULTAT NET'),
    };
  }

  private parseCompteResultatData(text: string): ExtractedFinancialData {
    return this.parseCompteResultatForYear(text, 0);
  }

  /**
   * Parse Tableau de Flux de Trésorerie for a specific year column.
   * @param yearOffset 0 = current year (col N), 1 = previous year (col N-1).
   */
  private parseTableauFluxForYear(text: string, yearOffset: 0 | 1 = 0): ExtractedFinancialData {
    const v = (...l: string[]) => this.crWithHint(text, yearOffset, ...l);
    return {
      tresorerie_debut_periode:                 v('Tresorerie nette au 1er Janvier', 'Trésorerie nette au 1er janvier', 'Tresorerie nette au 1er janvier'),
      capacite_autofinancement:                 v('Capacite d\'autofinancement', 'Capacité d\'autofinancement', 'CAFG'),
      variation_actif_circulant:                v('Variation de l\'actif circulant'),
      variation_passif_circulant:               v('Variation du passif circulant'),
      flux_tresorerie_activites_operationnelles: v('Flux de tresorerie provenant des activites operationnelles', 'Flux de trésorerie provenant des activités opérationnelles', 'activites operationnelles', 'activités opérationnelles', 'FLUX OPERATIONNELS'),
      acquisitions_immobilisations:             v('Acquisitions d\'immobilisations', 'Decaissements lies aux acquisitions', 'Décaissements liés aux acquisitions'),
      cessions_immobilisations:                 v('Cessions d\'immobilisations', 'Encaissements lies aux cessions', 'Encaissements liés aux cessions'),
      flux_tresorerie_activites_investissement:  v('Flux de tresorerie provenant des activites d\'investissement', 'Flux de trésorerie provenant des activités d\'investissement', 'operations d\'investissement', 'opérations d\'investissement', 'activites d\'investissement'),
      augmentations_capital:                    v('Augmentations de capital', 'Augmentation de capital'),
      emprunts_nouveaux:                        v('Emprunts'),
      remboursements_emprunts:                  v('Remboursements d\'emprunts', 'Remboursement d\'emprunts'),
      dividendes:                               v('Dividendes verses', 'Dividendes versés', 'Dividendes'),
      flux_tresorerie_activites_financement:     v('Flux de tresorerie provenant des activites de financement', 'Flux de trésorerie provenant des activités de financement', 'activites de financement', 'activités de financement'),
      variation_tresorerie:                     v('VARIATION DE LA TRESORERIE NETTE', 'VARIATION TRESORERIE'),
      tresorerie_fin_periode:                   v('Tresorerie nette au 31 Decembre', 'Trésorerie nette au 31 décembre', 'Tresorerie nette au 31 décembre'),
      // Aliases sans "tresorerie" en préfixe (compat ancien format)
      flux_activites_operationnelles:           v('Flux de tresorerie provenant des activites operationnelles', 'activites operationnelles', 'FLUX OPERATIONNELS'),
      flux_activites_investissement:            v('Flux de tresorerie provenant des activites d\'investissement', 'operations d\'investissement'),
      flux_activites_financement:               v('Flux de tresorerie provenant des activites de financement', 'activites de financement'),
      variation_tresorerie_nette:               v('VARIATION DE LA TRESORERIE NETTE'),
    };
  }

  private parseTableauFluxData(text: string): ExtractedFinancialData {
    return this.parseTableauFluxForYear(text, 0);
  }


  convertToOptimusFormat(extractedData: ExtractedFinancialData): any {
    console.log('🔄 Converting to OptimusCredit format...');
    
    // Convert the extracted data to the expected format
    const optimusData: any = {};
    
    // Map the extracted fields to OptimusCredit field names
    const fieldMapping: { [key: string]: string } = {
      'chiffre_affaires': 'Chiffre Affaires',
      'marge_brute_marchandises': 'Marge Brute Marchandises',
      'valeur_ajoutee': 'Valeur Ajoutee',
      'excedent_brut_exploitation': 'Excedent Brut Exploitation',
      'resultat_net': 'Resultat Net',
      'total_actif': 'Total Actif',
      'total_passif': 'Total Passif',
      'total_general': 'Total General',
      'actif_immobilise': 'Actif Immobilise',
      'actif_circulant': 'Actif Circulant',
      'tresorerie_actif': 'Tresorerie Actif',
      'capitaux_propres': 'Capitaux Propres',
      'flux_activites_operationnelles': 'Flux Activites Operationnelles',
      'flux_activites_investissement': 'Flux Activites Investissement',
      'flux_activites_financement': 'Flux Activites Financement',
      'variation_tresorerie_nette': 'Variation Tresorerie Nette'
    };
    
    for (const [key, value] of Object.entries(extractedData)) {
      if (key === 'confidence' || key === 'multiyear_data' || key === 'detectedYears') continue;
      if (value === null || value === undefined) continue;
      const mappedKey = fieldMapping[key] || key;
      optimusData[mappedKey] = value;
    }

    // Pass multi-year data through untouched so downstream handleDataInput can
    // fill all matching years in one shot.
    const my = (extractedData as any).multiyear_data;
    if (my) optimusData.multiyear_data = my;
    const dy = (extractedData as any).detectedYears;
    if (dy) optimusData.detectedYears = dy;

    console.log(`✅ Converted ${Object.keys(optimusData).length} fields to OptimusCredit format`);
    return optimusData;
  }

  /**
   * Advanced image preprocessing pipeline for financial documents
   */
  private async preprocessImage(canvas: HTMLCanvasElement, options: ImageProcessingOptions): Promise<HTMLCanvasElement> {
    console.log('🖼️ Applying enhanced image preprocessing for financial documents...');
    
    const { dpi = 300, contrast = 1.2, brightness = 1.1, gamma = 0.9, scaleFactor = 1.0 } = options;
    
    // Scale up the canvas if scaleFactor is provided
    let workingCanvas = canvas;
    if (scaleFactor > 1) {
      console.log(`📏 Scaling image by factor: ${scaleFactor}`);
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = canvas.width * scaleFactor;
      scaledCanvas.height = canvas.height * scaleFactor;
      const scaledCtx = scaledCanvas.getContext('2d')!;
      
      // Use high-quality scaling
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';
      scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
      workingCanvas = scaledCanvas;
    }
    
    // Create processing canvas for DPI scaling
    const processCanvas = document.createElement('canvas');
    const processCtx = processCanvas.getContext('2d')!;
    
    // Scale for DPI if needed
    const dpiScaleFactor = dpi / 150; // Base DPI assumption
    processCanvas.width = workingCanvas.width * dpiScaleFactor;
    processCanvas.height = workingCanvas.height * dpiScaleFactor;
    
    // Draw working image scaled
    processCtx.imageSmoothingEnabled = false;
    processCtx.drawImage(workingCanvas, 0, 0, processCanvas.width, processCanvas.height);
    
    // Get image data for pixel manipulation
    const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
    const data = imageData.data;
    
    // Apply preprocessing filters
    if (options.useNoiseReduction) {
      console.log('🔧 Applying aggressive noise reduction...');
      this.applyNoiseReduction(data, processCanvas.width, processCanvas.height);
      // Apply secondary noise reduction for financial documents
      this.applyAdvancedNoiseReduction(data, processCanvas.width, processCanvas.height);
    }
    
    if (options.useDeskewing) {
      // Note: Full deskewing requires more complex algorithms
      // For now, we'll apply basic rotation correction
      this.applyBasicDeskewing(processCtx, processCanvas.width, processCanvas.height);
    }
    
    // Apply brightness, contrast, and gamma corrections
    this.applyColorCorrections(data, brightness, contrast, gamma);
    
    if (options.useAdaptiveThresholding) {
      this.applyAdaptiveThresholding(data, processCanvas.width, processCanvas.height);
    }
    
    if (options.useSharpening) {
      console.log('🔪 Applying aggressive sharpening filter...');
      this.applySharpeningFilter(data, processCanvas.width, processCanvas.height);
      // Apply additional unsharp masking for text clarity
      this.applyUnsharpMasking(data, processCanvas.width, processCanvas.height);
    }
    
    // Apply advanced filtering for financial documents
    if (options.useAdvancedFiltering) {
      console.log('⚡ Applying advanced filtering for financial text...');
      this.applyTextEnhancement(data, processCanvas.width, processCanvas.height);
    }
    
    // Put processed image data back
    processCtx.putImageData(imageData, 0, 0);
    
    console.log(`✅ Image preprocessing complete (${processCanvas.width}x${processCanvas.height} at ${dpi} DPI)`);
    return processCanvas;
  }
  
  /**
   * Apply noise reduction using median filter
   */
  private applyNoiseReduction(data: Uint8ClampedArray, width: number, height: number): void {
    console.log('🔧 Applying noise reduction...');
    
    // Create a copy for reading
    const originalData = new Uint8ClampedArray(data);
    
    // Apply 3x3 median filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get 3x3 neighborhood values for each channel
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            neighbors.push({
              r: originalData[nIdx],
              g: originalData[nIdx + 1],
              b: originalData[nIdx + 2]
            });
          }
        }
        
        // Sort and take median
        neighbors.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
        const median = neighbors[4]; // Middle value
        
        data[idx] = median.r;
        data[idx + 1] = median.g;
        data[idx + 2] = median.b;
      }
    }
  }
  
  /**
   * Apply basic deskewing by detecting text orientation
   */
  private applyBasicDeskewing(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    console.log('📐 Applying basic deskewing...');
    
    // For now, apply a small counter-clockwise rotation that's common in scanned docs
    const centerX = width / 2;
    const centerY = height / 2;
    const angle = -0.5 * (Math.PI / 180); // -0.5 degrees
    
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.translate(-centerX, -centerY);
  }
  
  /**
   * Apply brightness, contrast, and gamma corrections
   */
  private applyColorCorrections(data: Uint8ClampedArray, brightness: number, contrast: number, gamma: number): void {
    console.log('🎨 Applying color corrections...');
    
    // Precompute gamma correction lookup table
    const gammaTable = new Array(256);
    for (let i = 0; i < 256; i++) {
      gammaTable[i] = Math.pow(i / 255, gamma) * 255;
    }
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness and contrast to RGB channels
      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        
        // Brightness
        value *= brightness;
        
        // Contrast (around midpoint)
        value = ((value - 128) * contrast) + 128;
        
        // Clamp to valid range
        value = Math.max(0, Math.min(255, value));
        
        // Apply gamma correction
        value = gammaTable[Math.round(value)];
        
        data[i + c] = value;
      }
    }
  }
  
  /**
   * Apply adaptive thresholding for better text extraction
   */
  private applyAdaptiveThresholding(data: Uint8ClampedArray, width: number, height: number): void {
    console.log('⚫ Applying adaptive thresholding...');
    
    const windowSize = 15;
    const C = 10; // Constant subtracted from mean
    
    // Convert to grayscale first
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    // Create copy for reading
    const originalData = new Uint8ClampedArray(data);
    
    // Apply adaptive threshold
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Calculate local mean in window
        let sum = 0;
        let count = 0;
        
        const halfWindow = Math.floor(windowSize / 2);
        for (let wy = Math.max(0, y - halfWindow); wy <= Math.min(height - 1, y + halfWindow); wy++) {
          for (let wx = Math.max(0, x - halfWindow); wx <= Math.min(width - 1, x + halfWindow); wx++) {
            const wIdx = (wy * width + wx) * 4;
            sum += originalData[wIdx];
            count++;
          }
        }
        
        const localMean = sum / count;
        const threshold = localMean - C;
        
        const pixelValue = originalData[idx];
        const newValue = pixelValue > threshold ? 255 : 0;
        
        data[idx] = data[idx + 1] = data[idx + 2] = newValue;
      }
    }
  }
  
  /**
   * Apply sharpening filter to enhance text edges
   */
  private applySharpeningFilter(data: Uint8ClampedArray, width: number, height: number): void {
    console.log('🔪 Applying sharpening filter...');
    
    // Sharpening kernel
    const kernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ];
    
    const originalData = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          
          for (let ky = 0; ky < 3; ky++) {
            for (let kx = 0; kx < 3; kx++) {
              const nIdx = ((y + ky - 1) * width + (x + kx - 1)) * 4;
              sum += originalData[nIdx + c] * kernel[ky][kx];
            }
          }
          
          data[idx + c] = Math.max(0, Math.min(255, sum));
        }
      }
    }
  }
  
  /**
   * Configure worker optimized for financial document detection
   */
  private async configureWorkerForFinancialDocs(worker: any): Promise<void> {
    console.log('⚙️ Configuring worker for financial document detection...');
    
    await worker.setParameters({
      // Page segmentation - optimized for financial tables
      tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD (better for complex layouts)
      tessedit_ocr_engine_mode: '2', // LSTM + Legacy for best accuracy
      
      // Character recognition - enhanced for financial documents
      tessedit_char_whitelist: '0123456789.,- €$£¥₦FCFA%()ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüý\'|/',
      
      // Text and layout analysis
      preserve_interword_spaces: '1',
      textord_tablefind_good_width: '3',
      textord_tabfind_find_tables: '1',
      textord_tabfind_vertical_text: '0',
      textord_use_cjk_fp_model: '0',
      
      // Language model tuning
      language_model_penalty_non_freq_dict_word: '0.1',
      language_model_penalty_non_dict_word: '0.15',
      
      // Word recognition improvements
      textord_really_old_xheight: '0',
      textord_min_linesize: '1.25',
      textord_excess_blobsize: '1.3'
    });
  }
  
  /**
   * Configure worker optimized for financial data extraction
   */
  private async configureWorkerForDataExtraction(worker: any): Promise<void> {
    console.log('⚙️ Configuring worker for financial data extraction...');
    
    await worker.setParameters({
      // Page segmentation - optimized for tabular data
      tessedit_pageseg_mode: '6', // Uniform block of text
      tessedit_ocr_engine_mode: '2', // LSTM + Legacy
      
      // Enhanced numeric recognition for financial data
      tessedit_enable_numeric_mode: '1',
      numeric_punctuation: '., ',
      
      // Character whitelist focused on financial data
      tessedit_char_whitelist: '0123456789.,- €$£¥₦FCFA%()ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüý\'',
      
      // Table detection and processing
      preserve_interword_spaces: '1',
      textord_tablefind_good_width: '2', // Tighter table detection
      textord_tabfind_find_tables: '1',
      textord_tabfind_vertical_text: '0',
      textord_heavy_nr: '1', // Better number recognition
      
      // Enhanced for financial tables
      textord_tabfind_show_vlines: '0',
      textord_debug_tabfind: '0',
      textord_tablefind_recognize_tables: '1',
      
      // Word and line formation
      textord_min_linesize: '1.0',
      textord_excess_blobsize: '1.2',
      textord_really_old_xheight: '0',
      
      // Language model - more permissive for financial terms
      language_model_penalty_non_freq_dict_word: '0.05',
      language_model_penalty_non_dict_word: '0.1',
      
      // Confidence thresholds
      tessedit_reject_bad_qual_wds: '0', // Don't reject low quality words
      tessedit_good_quality_unrej: '1',
      
      // Edge detection for better table processing
      edges_max_children_per_outline: '10',
      edges_children_per_grandchild: '2',
      edges_children_count_limit: '45'
    });
  }

  /**
   * Apply advanced noise reduction specifically for financial documents
   */
  private applyAdvancedNoiseReduction(data: Uint8ClampedArray, width: number, height: number): void {
    const temp = new Uint8ClampedArray(data);
    
    // Apply median filter to reduce salt-and-pepper noise
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * width + x) * 4 + c;
          
          // Get surrounding pixels
          const neighbors: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
              neighbors.push(temp[nIdx]);
            }
          }
          
          // Apply median filter
          neighbors.sort((a, b) => a - b);
          data[idx] = neighbors[4]; // median of 9 values
        }
      }
    }
  }

  /**
   * Apply unsharp masking for enhanced text clarity
   */
  private applyUnsharpMasking(data: Uint8ClampedArray, width: number, height: number): void {
    const temp = new Uint8ClampedArray(data);
    const amount = 1.5; // Unsharp masking strength
    
    // Create Gaussian blur
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * width + x) * 4 + c;
          
          // Simple 3x3 Gaussian blur approximation
          let sum = 0;
          let weight = 0;
          
          const kernel = [
            [1, 2, 1],
            [2, 4, 2], 
            [1, 2, 1]
          ];
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
              const w = kernel[dy + 1][dx + 1];
              sum += temp[nIdx] * w;
              weight += w;
            }
          }
          
          const blurred = sum / weight;
          const original = temp[idx];
          
          // Apply unsharp masking formula: original + amount * (original - blurred)
          const enhanced = original + amount * (original - blurred);
          data[idx] = Math.max(0, Math.min(255, enhanced));
        }
      }
    }
  }

  /**
   * Apply text-specific enhancement for financial documents
   */
  private applyTextEnhancement(data: Uint8ClampedArray, width: number, height: number): void {
    // Apply high-pass filter to enhance text edges
    const temp = new Uint8ClampedArray(data);
    
    // Edge enhancement kernel
    const kernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * width + x) * 4 + c;
          
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
              sum += temp[nIdx] * kernel[dy + 1][dx + 1];
            }
          }
          
          data[idx] = Math.max(0, Math.min(255, sum));
        }
      }
    }
    
    // Apply additional contrast enhancement for text
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const value = data[i + c];
        // Enhance contrast around mid-tones (text areas)
        const enhanced = value < 128 ? 
          Math.max(0, value * 0.8) : 
          Math.min(255, value * 1.3);
        data[i + c] = enhanced;
      }
    }
  }
}

export const ocrService = new OcrService();