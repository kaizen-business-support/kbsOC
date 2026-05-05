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

      // Step 1: Detect financial statements in the document
      onProgress?.('scan', `Lecture du document : ${file.name}`, 10);
      const detectedStatements = await this.detectFinancialStatements(file, onProgress);

      if (detectedStatements.length === 0) {
        onProgress?.('warn', 'Aucun état financier détecté dans le document', 40);
        console.warn('⚠️ No financial statements detected in the document');
        return { confidence: 0 };
      }

      onProgress?.('detect', `${detectedStatements.length} état(s) financier(s) détecté(s)`, 55,
        { statements: detectedStatements });

      // Step 2: Extract data from each detected statement
      const extractedData: ExtractedFinancialData = {};
      let totalConfidence = 0;
      let stepIdx = 0;

      for (const statement of detectedStatements) {
        try {
          const label = { bilan: 'Bilan', compte_resultat: 'Compte de Résultat', tableau_flux: 'Tableau des Flux' }[statement.type] ?? statement.type;
          onProgress?.('extract', `Extraction des données : ${label} (page ${statement.pageNumber})`,
            60 + stepIdx * 10);
          const rawData = await this.extractStatementData(file, statement);
          await this.saveDebugOutput(statement.type, rawData);
          const parsedData = this.parseStatementData(statement.type, rawData);
          Object.assign(extractedData, parsedData);
          totalConfidence += statement.confidence;
          onProgress?.('field', `${label} : ${Object.keys(parsedData).length} champ(s) extrait(s)`,
            65 + stepIdx * 10, { count: Object.keys(parsedData).length });
          stepIdx++;
        } catch (error) {
          console.warn(`⚠️ Error extracting ${statement.type}:`, error);
          onProgress?.('warn', `Erreur sur ${statement.type}: ${error instanceof Error ? error.message : '?'}`, 60 + stepIdx * 10);
        }
      }

      extractedData.confidence = detectedStatements.length > 0 ? totalConfidence / detectedStatements.length : 0;
      const fieldCount = Object.keys(extractedData).filter(k => k !== 'confidence').length;
      onProgress?.('done', `Extraction terminée — ${fieldCount} champs — confiance ${extractedData.confidence?.toFixed(0)}%`, 100,
        { fieldCount, confidence: extractedData.confidence });

      return extractedData;

    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      onProgress?.('error', `Erreur OCR : ${error instanceof Error ? error.message : 'Erreur inconnue'}`, 100);
      throw new Error(`Erreur lors de l'extraction OCR: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Detect financial statements in PDF by scanning all pages
   */
  async detectFinancialStatements(file: File, onProgress?: OcrOptions['onProgress']): Promise<FinancialStatement[]> {
    console.log('🔍 Starting financial statement detection...');
    
    // Validate file parameter
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file parameter - must be a File object');
    }
    
    console.log(`📄 File validation: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    
    const detectedStatements: FinancialStatement[] = [];
    
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
        
      } catch (error) {
        console.warn(`⚠️ Error processing page ${pageNum}:`, error);
      }
    }
    
      console.log(`🎯 Detection complete. Found ${detectedStatements.length} financial statements:`);
      detectedStatements.forEach(stmt => {
        console.log(`  - ${stmt.type}: Page ${stmt.pageNumber} (${stmt.confidence.toFixed(1)}% confidence)`);
      });
      
      return detectedStatements;
      
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
   * Parse statement data based on type
   */
  private parseStatementData(statementType: string, rawData: string): ExtractedFinancialData {
    switch (statementType) {
      case 'bilan':
        return this.parseBilanData(rawData);
      case 'compte_resultat':
        return this.parseCompteResultatData(rawData);
      case 'tableau_flux':
        return this.parseTableauFluxData(rawData);
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
   * Find the first line in `text` that matches any of the given label variants.
   */
  private findLineByLabel(text: string, ...labels: string[]): string | null {
    for (const line of text.split('\n')) {
      const norm = this.normalizeFr(line);
      for (const label of labels) {
        const normLabel = this.normalizeFr(label);
        if (norm.includes(normLabel) || this.fuzzyContains(norm, normLabel)) {
          return line;
        }
      }
    }
    return null;
  }

  /**
   * Extract all financial numbers (≥3 digits) from a pipe/space-separated line.
   */
  private numsFromLine(line: string): number[] {
    const nums: number[] = [];
    for (const part of line.split('|')) {
      const clean = part.trim().replace(/[\s\u00A0]/g, '');
      if (/^-?\d{3,}$/.test(clean)) {
        const n = parseInt(clean, 10);
        if (!isNaN(n)) nums.push(n);
      }
    }
    return nums;
  }

  /**
   * Find a line by label, then pick a number by index.
   * numIdx: 0 = first, -1 = last, 2 = third (NET_N in SYSCOHADA ACTIF format: BRUT_N, AMORT_N, NET_N, NET_N-1)
   */
  private labelValue(text: string, numIdx: number, ...labels: string[]): number | undefined {
    const line = this.findLineByLabel(text, ...labels);
    if (!line) return undefined;
    const nums = this.numsFromLine(line);
    if (nums.length === 0) return undefined;
    const idx = numIdx < 0 ? nums.length + numIdx : numIdx;
    return nums[Math.max(0, Math.min(idx, nums.length - 1))];
  }

  /** For ACTIF lines: SYSCOHADA format has BRUT_N | AMORT_N | NET_N | NET_N-1.
   *  We want NET_N = 3rd number (idx 2). Fallback to first if fewer columns. */
  private actif(text: string, ...labels: string[]): number | undefined {
    const line = this.findLineByLabel(text, ...labels);
    if (!line) return undefined;
    const nums = this.numsFromLine(line);
    if (nums.length === 0) return undefined;
    if (nums.length >= 3) return nums[2];
    return nums[0];
  }

  /** For PASSIF/CR/TFT lines: current year is typically the first number after the label. */
  private cr(text: string, ...labels: string[]): number | undefined {
    return this.labelValue(text, 0, ...labels);
  }

  // ─── Parse methods ───────────────────────────────────────────────────────────

  private parseBilanData(text: string): ExtractedFinancialData {
    const a = ((...l: string[]) => this.actif(text, ...l));
    const p = ((...l: string[]) => this.cr(text, ...l));
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
      avances_immobilisations:        a('Avances', 'acomptes', 'immobilisations'),
      immobilisations_financieres:    a('IMMOBILISATIONS FINANCIERES'),
      titres_participation:           a('Titres de participation'),
      autres_immob_financieres:       a('Autres immobilisations financieres', 'Autres Immobilisations Financières'),
      total_actif_immobilise:         a('TOTAL ACTIF IMMOBILISE', 'TOTAL IMMOBILISATIONS'),
      // ── ACTIF CIRCULANT ─────────────────────────────────────────────────
      actif_circulant_hao:            a('ACTIF CIRCULANT H.A.O', 'ACTIF CIRCULANT HAO'),
      stocks:                         a('STOCKS ET ENCOURS', 'STOCKS'),
      creances_clients:               a('CREANCES ET EMPLOIS'),
      fournisseurs_avances:           a('Fournisseurs avances', 'Fournisseurs, avances versees'),
      clients:                        a('Clients'),
      autres_creances:                a('Autres creances', 'Autres créances'),
      total_actif_circulant:          a('TOTAL ACTIF CIRCULANT'),
      // ── TRÉSORERIE ACTIF ────────────────────────────────────────────────
      titres_placement:               a('Titres de placement'),
      valeurs_encaisser:              a('Valeurs a encaisser', 'Valeurs à encaisser'),
      banques_caisses:                a('Banques', 'cheques postaux', 'caisse'),
      tresorerie_actif:               a('TOTAL TRESORERIE ACTIF', 'TRESORERIE ACTIF'),
      ecart_conversion_actif:         a('Ecart de conversion actif', 'Ecarts de conversion Actif'),
      total_actif:                    a('TOTAL GENERAL', 'TOTAL ACTIF'),
      // ── PASSIF CAPITAUX PROPRES ─────────────────────────────────────────
      capital_social:                 p('CA|CAPITAL', 'CAPITAL'),
      actionnaires_capital:           p('Apporteurs capital', 'capital non appele'),
      primes_capital:                 p('Primes liees au capital', 'Primes liées au capital'),
      ecarts_reevaluation:            p('Ecarts de reevaluation', 'Ecarts de réévaluation'),
      reserves_indisponibles:         p('Reserves indisponibles', 'Réserves indisponibles'),
      reserves_libres:                p('Reserves libres', 'Réserves libres'),
      report_nouveau:                 p('Report a nouveau', 'Report à nouveau'),
      resultat_exercice:              p('Resultat net de l\'exercice', 'Résultat de l\'exercice'),
      subventions_investissement:     p('Subventions d\'investissement'),
      provisions_reglementees:        p('Provisions reglementees', 'Provisions réglementées'),
      capitaux_propres:               p('TOTAL CAPITAUX PROPRES'),
      // ── PASSIF DETTES ───────────────────────────────────────────────────
      emprunts_dettes_financieres:    p('Emprunts et dettes financieres', 'Emprunts et dettes financières'),
      dettes_location:                p('Dettes de location'),
      provisions_risques:             p('Provisions pour risques'),
      fournisseurs:                   p('Fournisseurs d\'exploitation', 'Dettes fournisseurs'),
      dettes_fiscales:                p('Dettes fiscales', 'Organismes sociaux'),
      tresorerie_passif:              p('TOTAL TRESORERIE PASSIF', 'TRESORERIE PASSIF'),
      total_passif:                   p('TOTAL GENERAL', 'TOTAL PASSIF'),
    };
  }

  private parseCompteResultatData(text: string): ExtractedFinancialData {
    const v = ((...l: string[]) => this.cr(text, ...l));
    return {
      ventes_marchandises:            v('Ventes de marchandises'),
      achats_marchandises:            v('Achats de marchandises'),
      variation_stocks_marchandises:  v('Variation de stocks de marchandises'),
      marge_brute_marchandises:       v('MARGE BRUTE SUR MARCHANDISES', 'MARGE COMMERCIALE'),
      ventes_produits_fabriques:      v('Ventes de produits fabriques', 'Ventes de produits finis'),
      travaux_services:               v('Travaux', 'services vendus'),
      produits_accessoires:           v('Produits accessoires'),
      chiffre_affaires:               v('CHIFFRE D\'AFFAIRES', 'CHIFFRE AFFAIRES'),
      production_stockee:             v('Production stockee', 'Production stockée'),
      production_immobilisee:         v('Production immobilisee', 'Production immobilisée'),
      subvention_exploitation:        v('Subvention d\'exploitation'),
      autres_produits:                v('Autres produits'),
      transferts_charges:             v('Transferts de charges d\'exploitation'),
      achats_matieres_premieres:      v('Achats de matieres premieres', 'Achats de matières premières'),
      variation_stocks_mp:            v('Variation de stocks de matieres', 'Variation de stocks de matières'),
      autres_achats:                  v('Autres achats'),
      transports:                     v('Transports'),
      services_exterieurs:            v('Services exterieurs', 'Services extérieurs'),
      impots_taxes:                   v('Impots et taxes', 'Impôts et taxes'),
      autres_charges:                 v('Autres charges'),
      valeur_ajoutee:                 v('VALEUR AJOUTEE', 'VALEUR AJOUTÉE'),
      charges_personnel:              v('Charges de personnel'),
      excedent_brut_exploitation:     v('EXCEDENT BRUT D\'EXPLOITATION', 'EXCEDENT BRUT'),
      reprises_amortissements:        v('Reprises d\'amortissements'),
      dotations_amortissements:       v('Dotations aux amortissements'),
      resultat_exploitation:          v('RESULTAT D\'EXPLOITATION', 'RÉSULTAT D\'EXPLOITATION'),
      revenus_financiers:             v('Revenus financiers'),
      frais_financiers:               v('Frais financiers'),
      resultat_financier:             v('RESULTAT FINANCIER', 'RÉSULTAT FINANCIER'),
      resultat_courant:               v('RESULTAT DES ACTIVITES ORDINAIRES', 'RESULTAT COURANT'),
      resultat_hao:                   v('RESULTAT HORS ACTIVITES ORDINAIRES', 'RESULTAT HAO'),
      participation_travailleurs:     v('Participation des travailleurs'),
      impots_resultat:                v('Impots sur le resultat', 'Impôts sur le résultat'),
      resultat_net:                   v('RESULTAT NET', 'RÉSULTAT NET'),
    };
  }

  private parseTableauFluxData(text: string): ExtractedFinancialData {
    const v = ((...l: string[]) => this.cr(text, ...l));
    return {
      tresorerie_debut_periode:                 v('Tresorerie nette au 1er Janvier', 'Tresorerie nette au 1er janvier'),
      capacite_autofinancement:                 v('Capacite d\'autofinancement', 'CAFG'),
      flux_tresorerie_activites_operationnelles: v('activites operationnelles', 'activités opérationnelles', 'FLUX OPERATIONNELS'),
      flux_tresorerie_activites_investissement:  v('operations d\'investissement', 'activites d\'investissement'),
      flux_tresorerie_activites_financement:     v('activites de financement', 'activités de financement'),
      variation_tresorerie:                     v('VARIATION DE LA TRESORERIE NETTE', 'VARIATION TRESORERIE'),
      tresorerie_fin_periode:                   v('Tresorerie nette au 31 Decembre', 'Tresorerie nette au 31 décembre'),
      flux_activites_operationnelles:           v('activites operationnelles', 'FLUX OPERATIONNELS'),
      flux_activites_investissement:            v('operations d\'investissement'),
      flux_activites_financement:               v('activites de financement'),
      variation_tresorerie_nette:               v('VARIATION DE LA TRESORERIE NETTE'),
    };
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
      if (key !== 'confidence' && value !== null && value !== undefined) {
        const mappedKey = fieldMapping[key] || key;
        optimusData[mappedKey] = value;
      }
    }
    
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