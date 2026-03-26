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
      .replace(/['\u2019\u2018]/g, '')  // Handle various apostrophe types
      .replace(/[\\u00A0\\s]+/g, ' ')      // Normalize all whitespace including non-breaking spaces
      .replace(/[^a-z0-9\\s]/g, ' ')       // Remove special chars for better matching
      .replace(/\\s+/g, ' ')               // Collapse multiple spaces
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
        .replace(/[\\u00A0\\s]+/g, ' ')
        .replace(/[^a-z0-9\\s]/g, ' ')
        .replace(/\\s+/g, ' ')
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
  
  /**
   * Parse bilan (balance sheet) data - looking for NET column for assets, N column for liabilities
   */
  private parseBilanData(text: string): ExtractedFinancialData {
    console.log('📊 Parsing bilan data...');
    const data: ExtractedFinancialData = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      
      console.log(`🔍 Processing bilan line: "${cleanLine}"`);
      
      // BILAN ACTIF FIELDS - Matching Excel import exactly
      
      // IMMOBILISATIONS INCORPORELLES section
      if (cleanLine.includes('AD|IMMOBILISATIONS INCORPORELLES')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.immobilisations_incorporelles = value;
          console.log(`✅ Set immobilisations_incorporelles = ${value}`);
        }
      }
      
      if (cleanLine.includes('Frais de développement et de prospection')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.frais_developpement = value;
          console.log(`✅ Set frais_developpement = ${value}`);
        }
      }
      
      if (cleanLine.includes('Brevets, licences, logiciels')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.brevets_licences = value;
          console.log(`✅ Set brevets_licences = ${value}`);
        }
      }
      
      if (cleanLine.includes('Fonds commercial et droit au bail')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.fonds_commercial = value;
          console.log(`✅ Set fonds_commercial = ${value}`);
        }
      }
      
      if (cleanLine.includes('Autres immobilisations incorporelles')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.autres_immob_incorporelles = value;
          console.log(`✅ Set autres_immob_incorporelles = ${value}`);
        }
      }
      
      // IMMOBILISATIONS CORPORELLES section
      if (cleanLine.includes('AI|IMMOBILISATIONS CORPORELLES')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.immobilisations_corporelles = value;
          console.log(`✅ Set immobilisations_corporelles = ${value}`);
        }
      }
      
      if (cleanLine.includes('Terrains')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.terrains = value;
          console.log(`✅ Set terrains = ${value}`);
        }
      }
      
      if (cleanLine.includes('Bâtiments')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.batiments = value;
          console.log(`✅ Set batiments = ${value}`);
        }
      }
      
      if (cleanLine.includes('Aménagements, agencements')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.agencements = value;
          console.log(`✅ Set agencements = ${value}`);
        }
      }
      
      if (cleanLine.includes('Matériel, mobilier et actifs biologiques')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.materiel_mobilier = value;
          console.log(`✅ Set materiel_mobilier = ${value}`);
        }
      }
      
      if (cleanLine.includes('Matériel de transport')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.materiel_transport = value;
          console.log(`✅ Set materiel_transport = ${value}`);
        }
      }
      
      if (cleanLine.includes('Avances & acomptes versés sur immobilisations')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.avances_immobilisations = value;
          console.log(`✅ Set avances_immobilisations = ${value}`);
        }
      }
      
      // IMMOBILISATIONS FINANCIERES section
      if (cleanLine.includes('AQ|IMMOBILISATIONS FINANCIERES')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.immobilisations_financieres = value;
          console.log(`✅ Set immobilisations_financieres = ${value}`);
        }
      }
      
      if (cleanLine.includes('Titres de participation')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.titres_participation = value;
          console.log(`✅ Set titres_participation = ${value}`);
        }
      }
      
      if (cleanLine.includes('Autres immobilisations financières')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.autres_immob_financieres = value;
          console.log(`✅ Set autres_immob_financieres = ${value}`);
        }
      }
      
      // TOTAL ACTIF IMMOBILISE
      if (cleanLine.includes('AZ|TOTAL ACTIF IMMOBILISE')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.total_actif_immobilise = value;
          console.log(`✅ Set total_actif_immobilise = ${value}`);
        }
      }
      
      // ACTIF CIRCULANT section
      if (cleanLine.includes('BA|ACTIF CIRCULANT H.A.O.')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.actif_circulant_hao = value;
          console.log(`✅ Set actif_circulant_hao = ${value}`);
        }
      }
      
      if (cleanLine.includes('BB|STOCKS ET ENCOURS')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.stocks = value;
          console.log(`✅ Set stocks = ${value}`);
        }
      }
      
      if (cleanLine.includes('BG|CREANCES ET EMPLOIS ASSIMILES')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.creances_clients = value;
          console.log(`✅ Set creances_clients = ${value}`);
        }
      }
      
      if (cleanLine.includes('Fournisseurs, avances versées')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.fournisseurs_avances = value;
          console.log(`✅ Set fournisseurs_avances = ${value}`);
        }
      }
      
      if (cleanLine.includes('BI|Clients')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.clients = value;
          console.log(`✅ Set clients = ${value}`);
        }
      }
      
      if (cleanLine.includes('BJ|Autres créances')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.autres_creances = value;
          console.log(`✅ Set autres_creances = ${value}`);
        }
      }
      
      if (cleanLine.includes('BK|TOTAL ACTIF CIRCULANT')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.total_actif_circulant = value;
          console.log(`✅ Set total_actif_circulant = ${value}`);
        }
      }
      
      // TRESORERIE section
      if (cleanLine.includes('BQ|Titres de placement')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.titres_placement = value;
          console.log(`✅ Set titres_placement = ${value}`);
        }
      }
      
      if (cleanLine.includes('BR|Valeurs a encaisser')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.valeurs_encaisser = value;
          console.log(`✅ Set valeurs_encaisser = ${value}`);
        }
      }
      
      if (cleanLine.includes('BS|Banques, chèques postaux, caisse')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.banques_caisses = value;
          console.log(`✅ Set banques_caisses = ${value}`);
        }
      }
      
      if (cleanLine.includes('BT|TOTAL TRESORERIE ACTIF')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.tresorerie_actif = value;
          console.log(`✅ Set tresorerie_actif = ${value}`);
        }
      }
      
      if (cleanLine.includes('BU|Ecarts de conversion Actif')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.ecart_conversion_actif = value;
          console.log(`✅ Set ecart_conversion_actif = ${value}`);
        }
      }
      
      if (cleanLine.includes('BZ|TOTAL GENERAL')) {
        const value = this.extractValueFromActifSection(cleanLine);
        if (value !== null) {
          data.total_actif = value;
          console.log(`✅ Set total_actif = ${value}`);
        }
      }
      
      // BILAN PASSIF FIELDS - Matching Excel import exactly (using column 11)
      
      // CAPITAUX PROPRES section  
      if (cleanLine.includes('CA|CAPITAL')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.capital_social = value;
          console.log(`✅ Set capital_social = ${value}`);
        }
      }
      
      if (cleanLine.includes('CB|Apporteurs capital non appelé')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.actionnaires_capital = value;
          console.log(`✅ Set actionnaires_capital = ${value}`);
        }
      }
      
      if (cleanLine.includes('CD|Primes liées au capital social')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.primes_capital = value;
          console.log(`✅ Set primes_capital = ${value}`);
        }
      }
      
      if (cleanLine.includes('CE|Ecarts de réévaluation')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.ecarts_reevaluation = value;
          console.log(`✅ Set ecarts_reevaluation = ${value}`);
        }
      }
      
      if (cleanLine.includes('CF|Réserves indisponibles')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.reserves_indisponibles = value;
          console.log(`✅ Set reserves_indisponibles = ${value}`);
        }
      }
      
      if (cleanLine.includes('CG|Réserves libres')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.reserves_libres = value;
          console.log(`✅ Set reserves_libres = ${value}`);
        }
      }
      
      if (cleanLine.includes('CH|Report à nouveau')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.report_nouveau = value;
          console.log(`✅ Set report_nouveau = ${value}`);
        }
      }
      
      if (cleanLine.includes('CJ|Resutat net de l\'exercice') || 
          cleanLine.includes('CJ|Resultat net de l\'exercice') ||
          cleanLine.includes('CJ|Résutat net de l\'exercice')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.resultat_exercice = value;
          console.log(`✅ Set resultat_exercice = ${value}`);
        }
      }
      
      if (cleanLine.includes('CL|Subventions d\'investissement')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.subventions_investissement = value;
          console.log(`✅ Set subventions_investissement = ${value}`);
        }
      }
      
      if (cleanLine.includes('CM|Provisions réglementées')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.provisions_reglementees = value;
          console.log(`✅ Set provisions_reglementees = ${value}`);
        }
      }
      
      if (cleanLine.includes('CP|TOTAL CAPITAUX PROPRES')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.capitaux_propres = value;
          console.log(`✅ Set capitaux_propres = ${value}`);
        }
      }
      
      // DETTES section
      if (cleanLine.includes('DA|Emprunts et dettes financières diverses')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.emprunts_dettes_financieres = value;
          console.log(`✅ Set emprunts_dettes_financieres = ${value}`);
        }
      }
      
      if (cleanLine.includes('DB|Dettes de location acquisition')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.dettes_location = value;
          console.log(`✅ Set dettes_location = ${value}`);
        }
      }
      
      if (cleanLine.includes('DC|Provisions pour risques et charges')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.provisions_risques = value;
          console.log(`✅ Set provisions_risques = ${value}`);
        }
      }
      
      if (cleanLine.includes('DD|TOTAL DETTES FINANCIERES')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.total_dettes_financieres = value;
          console.log(`✅ Set total_dettes_financieres = ${value}`);
        }
      }
      
      if (cleanLine.includes('DJ|Fournisseurs d\'exploitation')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.dettes_fournisseurs = value;
          console.log(`✅ Set dettes_fournisseurs = ${value}`);
        }
      }
      
      if (cleanLine.includes('DK|Dettes fiscales et sociales')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.dettes_fiscales_sociales = value;
          console.log(`✅ Set dettes_fiscales_sociales = ${value}`);
        }
      }
      
      if (cleanLine.includes('DM|Autres dettes')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.autres_dettes = value;
          console.log(`✅ Set autres_dettes = ${value}`);
        }
      }
      
      if (cleanLine.includes('DP|TOTAL PASSIF CIRCULANT')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.total_passif_circulant = value;
          console.log(`✅ Set total_passif_circulant = ${value}`);
        }
      }
      
      if (cleanLine.includes('DR|Banques, établissements financiers')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.banques_concours = value;
          console.log(`✅ Set banques_concours = ${value}`);
        }
      }
      
      if (cleanLine.includes('DT|TOTAL TRESORERIE PASSIF')) {
        const value = this.extractValueFromPassifSection(cleanLine);
        if (value !== null) {
          data.tresorerie_passif = value;
          console.log(`✅ Set tresorerie_passif = ${value}`);
        }
      }
    }
    
    console.log(`✅ Parsed ${Object.keys(data).length} bilan fields`);
    return data;
  }
  
  /**
   * Parse compte de résultat data - looking for 31/12/N column
   */
  private parseCompteResultatData(text: string): ExtractedFinancialData {
    console.log('📊 Parsing compte de résultat data...');
    const data: ExtractedFinancialData = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      
      console.log(`🔍 Processing compte de résultat line: "${cleanLine}"`);
      
      // COMPTE DE RESULTAT FIELDS - Matching Excel import exactly (using column 5)
      
      // PRODUITS section
      if (cleanLine.includes('TA|Ventes de marchandises')) {
        console.log(`🔍 FOUND LINE MATCHING ventes_marchandises: "${cleanLine}"`);
        const value = this.extractCurrentYearValue(cleanLine);
        console.log(`🎯 extractCurrentYearValue returned: ${value}`);
        if (value !== null) {
          data.ventes_marchandises = value;
          console.log(`✅ Set ventes_marchandises = ${value}`);
        } else {
          console.log(`❌ extractCurrentYearValue returned null for ventes_marchandises`);
        }
      }
      
      if (cleanLine.includes('RA|Achats de marchandises')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.achats_marchandises = Math.abs(value);
          console.log(`✅ Set achats_marchandises = ${data.achats_marchandises}`);
        }
      }
      
      if (cleanLine.includes('RB|Variation de stocks de marchandises')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.variation_stocks_marchandises = value;
          console.log(`✅ Set variation_stocks_marchandises = ${value}`);
        }
      }
      
      if (cleanLine.includes('XA|MARGE BRUTE SUR MARCHANDISES')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.marge_brute_marchandises = value;
          console.log(`✅ Set marge_brute_marchandises = ${value}`);
        }
      }
      
      if (cleanLine.includes('TB|Ventes de produits fabriqués')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.ventes_produits_fabriques = value;
          console.log(`✅ Set ventes_produits_fabriques = ${value}`);
        }
      }
      
      if (cleanLine.includes('TC|Travaux, services vendus')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.travaux_services = value;
          console.log(`✅ Set travaux_services = ${value}`);
        }
      }
      
      if (cleanLine.includes('TD|Produits accessoires')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.produits_accessoires = value;
          console.log(`✅ Set produits_accessoires = ${value}`);
        }
      }
      
      if (cleanLine.includes('XB|CHIFFRE D\'AFFAIRES')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.chiffre_affaires = value;
          console.log(`✅ Set chiffre_affaires = ${value}`);
        }
      }
      
      if (cleanLine.includes('TE|Production stockée')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.production_stockee = value;
          console.log(`✅ Set production_stockee = ${value}`);
        }
      }
      
      if (cleanLine.includes('TF|Production immobilisée')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.production_immobilisee = value;
          console.log(`✅ Set production_immobilisee = ${value}`);
        }
      }
      
      if (cleanLine.includes('TG|Subventions d\'exploitation')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.subvention_exploitation = value;
          console.log(`✅ Set subvention_exploitation = ${value}`);
        }
      }
      
      if (cleanLine.includes('TH|Autres produits')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.autres_produits = value;
          console.log(`✅ Set autres_produits = ${value}`);
        }
      }
      
      if (cleanLine.includes('TI|Transferts de charges d\'exploitation')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.transferts_charges = value;
          console.log(`✅ Set transferts_charges = ${value}`);
        }
      }
      
      // CHARGES section
      if (cleanLine.includes('RC|Achats de matières premières')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.achats_matieres = Math.abs(value);
          console.log(`✅ Set achats_matieres = ${data.achats_matieres}`);
        }
      }
      
      if (cleanLine.includes('RD|Variation de stocks de stocks de matières')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.variation_stocks_matieres = value;
          console.log(`✅ Set variation_stocks_matieres = ${value}`);
        }
      }
      
      if (cleanLine.includes('RE|Autres achats')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.autres_achats = Math.abs(value);
          console.log(`✅ Set autres_achats = ${data.autres_achats}`);
        }
      }
      
      if (cleanLine.includes('RF|Variation de stocks d\'autres approvisionnements')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.variation_stocks_approvisionnements = value;
          console.log(`✅ Set variation_stocks_approvisionnements = ${value}`);
        }
      }
      
      if (cleanLine.includes('RG|Transports')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.transports = Math.abs(value);
          console.log(`✅ Set transports = ${data.transports}`);
        }
      }
      
      if (cleanLine.includes('RH|Services extérieurs')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.services_exterieurs = Math.abs(value);
          console.log(`✅ Set services_exterieurs = ${data.services_exterieurs}`);
        }
      }
      
      if (cleanLine.includes('RI|Impôts et taxes')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.impots_taxes = Math.abs(value);
          console.log(`✅ Set impots_taxes = ${data.impots_taxes}`);
        }
      }
      
      if (cleanLine.includes('RJ|Autres charges')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.autres_charges = Math.abs(value);
          console.log(`✅ Set autres_charges = ${data.autres_charges}`);
        }
      }
      
      if (cleanLine.includes('XC|VALEUR AJOUTEE')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.valeur_ajoutee = value;
          console.log(`✅ Set valeur_ajoutee = ${value}`);
        }
      }
      
      if (cleanLine.includes('RK|Charges de personnel')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.charges_personnel = Math.abs(value);
          console.log(`✅ Set charges_personnel = ${data.charges_personnel}`);
        }
      }
      
      if (cleanLine.includes('XD|EXCEDENT BRUT D\'EXPLOITATION')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.excedent_brut_exploitation = value;
          console.log(`✅ Set excedent_brut_exploitation = ${value}`);
        }
      }
      
      if (cleanLine.includes('TJ|Reprises d\'amortissements')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.reprises_amortissements = value;
          console.log(`✅ Set reprises_amortissements = ${value}`);
        }
      }
      
      if (cleanLine.includes('RL|Dotations aux amortissements')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.dotations_amortissements = Math.abs(value);
          console.log(`✅ Set dotations_amortissements = ${data.dotations_amortissements}`);
        }
      }
      
      if (cleanLine.includes('XE|RESULTAT D\'EXPLOITATION')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.resultat_exploitation = value;
          console.log(`✅ Set resultat_exploitation = ${value}`);
        }
      }
      
      // RESULTAT FINANCIER section
      if (cleanLine.includes('TK|Revenus financiers')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.revenus_financiers = value;
          console.log(`✅ Set revenus_financiers = ${value}`);
        }
      }
      
      if (cleanLine.includes('RM|Frais financiers')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.frais_financiers = Math.abs(value);
          console.log(`✅ Set frais_financiers = ${data.frais_financiers}`);
        }
      }
      
      if (cleanLine.includes('XF|RESULTAT FINANCIER')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.resultat_financier = value;
          console.log(`✅ Set resultat_financier = ${value}`);
        }
      }
      
      if (cleanLine.includes('XG|RESULTAT DES ACTIVITES ORDINAIRES')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.resultat_activites_ordinaires = value;
          console.log(`✅ Set resultat_activites_ordinaires = ${value}`);
        }
      }
      
      // RESULTAT EXCEPTIONNEL section
      if (cleanLine.includes('TN|Produits des cessions d\'immobilisations')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.produits_cessions = value;
          console.log(`✅ Set produits_cessions = ${value}`);
        }
      }
      
      if (cleanLine.includes('TO|Autres produits H.A.O.')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.autres_produits_hao = value;
          console.log(`✅ Set autres_produits_hao = ${value}`);
        }
      }
      
      if (cleanLine.includes('RO|Valeurs comptables des cessions')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.valeurs_comptables_cessions = Math.abs(value);
          console.log(`✅ Set valeurs_comptables_cessions = ${data.valeurs_comptables_cessions}`);
        }
      }
      
      if (cleanLine.includes('RP|Autres charges H.A.O.')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.autres_charges_hao = Math.abs(value);
          console.log(`✅ Set autres_charges_hao = ${data.autres_charges_hao}`);
        }
      }
      
      if (cleanLine.includes('XH|RESULTAT HORS ACTIVITES ORDINAIRES')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.resultat_hors_activites_ordinaires = value;
          console.log(`✅ Set resultat_hors_activites_ordinaires = ${value}`);
        }
      }
      
      if (cleanLine.includes('RQ|Participation des travailleurs')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.participation_travailleurs = Math.abs(value);
          console.log(`✅ Set participation_travailleurs = ${data.participation_travailleurs}`);
        }
      }
      
      if (cleanLine.includes('RS|Impôts sur le résultat')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.impots_benefice = Math.abs(value);
          console.log(`✅ Set impots_benefice = ${data.impots_benefice}`);
        }
      }
      
      if (cleanLine.includes('XI|RESULTAT NET')) {
        const value = this.extractCurrentYearValue(cleanLine);
        if (value !== null) {
          data.resultat_net = value;
          console.log(`✅ Set resultat_net = ${value}`);
        }
      }
    }
    
    console.log(`✅ Parsed ${Object.keys(data).length} compte de résultat fields`);
    return data;
  }
  
  /**
   * Parse tableau de flux de trésorerie data - looking for 31/12/N column
   */
  private parseTableauFluxData(text: string): ExtractedFinancialData {
    console.log('📊 Parsing tableau de flux data...');
    const data: ExtractedFinancialData = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      
      // Look for key cash flow items with 31/12/N column
      if (cleanLine.includes('Flux de trésorerie provenant des activités opérationnelles')) {
        const value = this.extractValueFromLine(cleanLine);
        if (value !== null) data.flux_activites_operationnelles = value;
      }
      
      if (cleanLine.includes('Flux de trésorerie provenant des activités d\'investissement')) {
        const value = this.extractValueFromLine(cleanLine);
        if (value !== null) data.flux_activites_investissement = value;
      }
      
      if (cleanLine.includes('Flux de trésorerie provenant des activités de financement')) {
        const value = this.extractValueFromLine(cleanLine);
        if (value !== null) data.flux_activites_financement = value;
      }
      
      if (cleanLine.includes('VARIATION DE LA TRESORERIE NETTE')) {
        const value = this.extractValueFromLine(cleanLine);
        if (value !== null) data.variation_tresorerie_nette = value;
      }
    }
    
    console.log(`✅ Parsed ${Object.keys(data).length} tableau de flux fields`);
    return data;
  }
  
  /**
   * Parse a single pipe-separated column string as a French integer.
   * Accepts: "1234567", "1 234 567", "-500000". Returns null if not numeric.
   */
  private parseNumericCol(col: string): number | null {
    if (!col) return null;
    const s = col.trim();
    if (s === '' || s === '-' || s.toLowerCase() === 'note') return null;
    const clean = s.replace(/\s/g, '');
    if (!/^-?\d+$/.test(clean)) return null;
    const n = parseInt(clean, 10);
    return isNaN(n) ? null : n;
  }

  /**
   * Smart column extractor: tries preferred indices first, then adjacent columns,
   * then falls back to the last numeric value after index 1.
   */
  private extractFromColumns(line: string, preferredIndices: number[]): number | null {
    const cols = line.split('|').map(c => c.trim());

    // Try preferred indices
    for (const idx of preferredIndices) {
      if (idx < cols.length) {
        const v = this.parseNumericCol(cols[idx]);
        if (v !== null) return v;
      }
    }

    // Fallback: last numeric value found after label columns
    for (let i = cols.length - 1; i >= 2; i--) {
      const v = this.parseNumericCol(cols[i]);
      if (v !== null) return v;
    }

    return null;
  }

  /**
   * Extract value from ACTIF section.
   * SYSCOHADA structure: REF | LABEL | [empty?] | BRUT_N | AMORT_N | NET_N | NET_N1 | ...
   * NET_N is typically the 3rd or 4th numeric value. We try indices 4,5,3,6 then scan right-to-left.
   */
  private extractValueFromActifSection(line: string): number | null {
    return this.extractFromColumns(line, [4, 5, 3, 6, 2]);
  }

  /**
   * Extract current year value from Compte de Résultat line.
   * Structure: REF | LIBELLES | A | NOTE | 31/12/N | 31/12/N-1
   * 31/12/N is usually at index 4 or 5.
   */
  private extractCurrentYearValue(line: string): number | null {
    return this.extractFromColumns(line, [5, 4, 3, 6]);
  }

  /**
   * Extract value from PASSIF section (right side of bilan row or separate section).
   * PASSIF columns start after ACTIF data; 31/12/N is typically at index 9 or 10.
   */
  private extractValueFromPassifSection(line: string): number | null {
    return this.extractFromColumns(line, [9, 10, 8, 11, 7]);
  }

  /**
   * Extract numeric value from a table line (with pipe separators)
   */
  private extractValueFromLine(line: string): number | null {
    console.log(`🔍 Parsing line: "${line}"`);
    
    // All formats now use pipe separators for consistency
    const columns = line.split('|').map(col => col.trim());
    console.log(`📊 Columns: [${columns.map((c, i) => `${i}:"${c}"`).join(', ')}]`);
    
    // Look for numeric values in appropriate columns (prioritize later columns for Net values)
    const possibleValues: number[] = [];
    
    for (let i = 1; i < columns.length; i++) {
      const col = columns[i];
      
      // Skip empty columns or columns with just dashes/dots
      if (!col || col === '' || col === '-' || col === '.' || col === 'Note') continue;
      
      // Look for numeric values (handle French thousand separators with spaces)
      // Pattern: optional minus, digits with optional spaces for thousands, more digits
      const numberMatch = col.match(/^(-?\d+(?:\s\d{3})*)$/);
      if (numberMatch) {
        // Remove spaces (French thousand separators) and convert
        const cleanNumber = numberMatch[1].replace(/\s/g, '');
        const numericValue = parseInt(cleanNumber, 10);
        
        if (!isNaN(numericValue) && Math.abs(numericValue) > 0) {
          console.log(`💰 Found value: ${numericValue} in column ${i} (original: "${col}")`);
          possibleValues.push(numericValue);
        }
      }
    }
    
    // Return the last (rightmost) numeric value found, as it's likely the Net/current year value
    if (possibleValues.length > 0) {
      const selectedValue = possibleValues[possibleValues.length - 1];
      console.log(`✅ Selected value: ${selectedValue}`);
      return selectedValue;
    }
    
    console.log(`❌ No numeric value found in line`);
    return null;
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