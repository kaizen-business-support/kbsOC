import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFGenerationOptions {
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  filename?: string;
}

export class UnifiedPDFService {
  private static instance: UnifiedPDFService;

  private constructor() {}

  public static getInstance(): UnifiedPDFService {
    if (!UnifiedPDFService.instance) {
      UnifiedPDFService.instance = new UnifiedPDFService();
    }
    return UnifiedPDFService.instance;
  }

  public async generateFinancialReportPDF(
    reportContent: string,
    multiyearData: any,
    options: PDFGenerationOptions = {}
  ): Promise<Blob> {
    console.log('Starting unified PDF generation with WYSIWYG approach...');
    
    // Create a unified rendering container that matches PDF dimensions
    const renderContainer = this.createUnifiedRenderContainer(reportContent, multiyearData, options);
    
    try {
      // Generate PDF using html2canvas + jsPDF for true WYSIWYG
      const pdfBlob = await this.generatePDFFromContainer(renderContainer, options);
      
      // Clean up
      document.body.removeChild(renderContainer);
      
      return pdfBlob;
    } catch (error) {
      // Clean up on error
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
      throw error;
    }
  }

  private createUnifiedRenderContainer(
    content: string,
    multiyearData: any,
    options: PDFGenerationOptions
  ): HTMLElement {
    const container = document.createElement('div');
    
    // A4 dimensions at 96 DPI - exact same as preview
    const A4_WIDTH = 794; // 210mm
    const MARGIN = 40; // ~15mm margins
    
    // Placer le container dans le viewport mais invisible — html2canvas
    // ne capture pas correctement les éléments placés très hors de l'écran.
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: ${A4_WIDTH}px;
      max-width: ${A4_WIDTH}px;
      margin: 0;
      padding: ${MARGIN}px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      background-color: #ffffff;
      box-sizing: border-box;
      overflow: visible;
      z-index: -9999;
      pointer-events: none;
    `;

    // Add print-specific CSS
    const printStyles = `
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .page-section { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: avoid !important; break-inside: avoid !important; }
          .interpretation-box { page-break-inside: avoid !important; break-inside: avoid !important; }
          h1, h2, h3, h4, h5 { page-break-after: avoid !important; break-after: avoid !important; }
        }
        * { box-sizing: border-box; }
        
        table { 
          border-collapse: collapse !important;
          width: 100% !important;
          font-size: 11px !important;
          margin-bottom: 15px !important;
        }
        
        th, td { 
          border: 1px solid #ddd !important;
          padding: 6px 8px !important;
          text-align: left !important;
          font-size: 11px !important;
        }
        
        th {
          background-color: #f8f9fa !important;
          font-weight: 600 !important;
        }
        
        h1, h2, h3, h4, h5, h6 {
          margin-top: 16px !important;
          margin-bottom: 8px !important;
          break-after: avoid !important;
        }
        
        h1 { font-size: 24px !important; }
        h2 { font-size: 20px !important; }
        h3 { font-size: 16px !important; color: #1f4e79 !important; border-bottom: 2px solid #2c5aa0 !important; padding-bottom: 8px !important; }
        h4 { font-size: 14px !important; }
        h5 { font-size: 12px !important; font-weight: 600 !important; margin-bottom: 8px !important; }
        
        .interpretation-box {
          background: #f8f9fa !important;
          border-left: 4px solid #28a745 !important;
          padding: 12px !important;
          margin: 10px 0 !important;
          border-radius: 4px !important;
          break-inside: avoid !important;
        }
        
        .blue-interpretation {
          background: #e3f2fd !important;
          border-left-color: #2196f3 !important;
        }
        
        .orange-recommendation {
          background: #fff3cd !important;
          border-left-color: #ffc107 !important;
        }
        
        .page-section {
          margin-bottom: 30px !important;
          break-inside: avoid !important;
        }
        
        .chart-placeholder {
          height: 300px !important;
          background: #f8f9fa !important;
          border: 1px solid #ddd !important;
          border-radius: 4px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 20px 0 !important;
          break-inside: avoid !important;
        }
        
        .header-section {
          text-align: center !important;
          margin-bottom: 30px !important;
          padding: 20px !important;
          background: linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%) !important;
          color: white !important;
          border-radius: 8px !important;
        }
        
        .footer-section {
          text-align: center !important;
          margin-top: 30px !important;
          padding: 20px !important;
          background: #f8f9fa !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          color: #666 !important;
        }
        
        p { margin: 0 0 8px 0 !important; }
        ul { margin: 0 0 8px 0 !important; padding-left: 20px !important; }
        li { margin-bottom: 4px !important; }
      </style>
    `;

    // Process content for consistent rendering
    let processedContent = this.processContentForUnifiedRendering(content);
    
    // Add charts section if needed
    if (options.includeCharts && Object.keys(multiyearData).length > 1) {
      processedContent += this.generateChartsSection();
    }

    container.innerHTML = printStyles + processedContent;
    document.body.appendChild(container);
    
    return container;
  }

  private processContentForUnifiedRendering(content: string): string {
    let processed = content;

    // Replace inline styles with CSS classes for consistency
    processed = processed.replace(
      /style="background: #e8f5e8;[^"]*"/g,
      'class="interpretation-box"'
    );
    
    processed = processed.replace(
      /style="background: #e3f2fd;[^"]*"/g,
      'class="interpretation-box blue-interpretation"'
    );
    
    processed = processed.replace(
      /style="background: #fff3cd;[^"]*"/g,
      'class="interpretation-box orange-recommendation"'
    );

    // Wrap major sections for better page control
    processed = processed.replace(
      /<div style="margin-bottom: 30px;">/g,
      '<div class="page-section">'
    );

    // Ensure tables have consistent styling
    processed = processed.replace(
      /<table[^>]*style="[^"]*"[^>]*>/g,
      '<table>'
    );

    // Fix header section
    processed = processed.replace(
      /<div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient[^"]*"[^>]*>/g,
      '<div class="header-section">'
    );

    // Fix footer section
    processed = processed.replace(
      /<div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa[^"]*"[^>]*>/g,
      '<div class="footer-section">'
    );

    return processed;
  }

  private generateChartsSection(): string {
    return `
      <div class="page-section">
        <h3>📊 Graphiques et Visualisations</h3>
        
        <div style="margin-bottom: 30px;">
          <h4 style="color: #1f4e79; margin-bottom: 10px;">📈 Évolution du Chiffre d'Affaires</h4>
          <div class="chart-placeholder">
            <span style="color: #666; font-size: 14px;">Graphique du chiffre d'affaires</span>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h4 style="color: #1f4e79; margin-bottom: 10px;">💰 Évolution du Résultat Net</h4>
          <div class="chart-placeholder">
            <span style="color: #666; font-size: 14px;">Graphique du résultat net</span>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h4 style="color: #1f4e79; margin-bottom: 10px;">📊 Évolution des Ratios Financiers</h4>
          <div class="chart-placeholder">
            <span style="color: #666; font-size: 14px;">Graphique des ratios financiers</span>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h4 style="color: #1f4e79; margin-bottom: 10px;">💧 Flux de Trésorerie par Activité</h4>
          <div class="chart-placeholder">
            <span style="color: #666; font-size: 14px;">Graphique des flux de trésorerie</span>
          </div>
        </div>
      </div>
    `;
  }

  private async generatePDFFromContainer(
    container: HTMLElement,
    options: PDFGenerationOptions
  ): Promise<Blob> {
    console.log('Capturing container content with html2canvas...');
    
    // Configure html2canvas for maximum quality
    const canvas = await html2canvas(container, {
      scale: 3, // Higher DPI for crisp text - increased from 2 to 3
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794, // A4 width
      // height: auto calculated by html2canvas
      scrollX: 0,
      scrollY: 0,
      logging: false,
      foreignObjectRendering: true, // Better text rendering
      imageTimeout: 0, // No timeout for image loading
      removeContainer: true, // Clean up after capture
      onclone: (clonedDoc) => {
        // Ensure fonts are loaded and text is crisp in cloned document
        const clonedContainer = clonedDoc.querySelector('div');
        if (clonedContainer) {
          clonedContainer.style.visibility = 'visible';
          (clonedContainer.style as any).webkitFontSmoothing = 'antialiased';
          (clonedContainer.style as any).mozOsxFontSmoothing = 'grayscale';
        }
        
        // Apply anti-aliasing to all text elements
        const textElements = clonedDoc.querySelectorAll('*');
        textElements.forEach((el: any) => {
          el.style.webkitFontSmoothing = 'antialiased';
          el.style.mozOsxFontSmoothing = 'grayscale';
          el.style.textRendering = 'optimizeLegibility';
        });
      }
    });

    console.log('Canvas captured, dimensions:', canvas.width, 'x', canvas.height);

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('La capture du rapport a échoué (canvas vide). Réessayez.');
    }

    // Create PDF with proper dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Split content across multiple pages with smart page breaks
    const ctx = canvas.getContext('2d')!;
    const pageHeightPx = Math.round((pdfHeight / pdfWidth) * canvasWidth); // page height in canvas pixels
    let srcY = 0; // current position in canvas pixels
    let pageNumber = 1;

    while (srcY < canvasHeight) {
      // Ideal cut at exactly one page height
      let cutY = Math.min(srcY + pageHeightPx, canvasHeight);

      // If not the last page, scan backwards up to 80px to find a white row
      if (cutY < canvasHeight) {
        const searchFrom = cutY;
        const searchTo = Math.max(srcY + Math.round(pageHeightPx * 0.85), srcY + 1);
        outer: for (let y = searchFrom; y >= searchTo; y--) {
          const row = ctx.getImageData(0, y, canvasWidth, 1).data;
          for (let i = 0; i < row.length; i += 4) {
            if (row[i] < 245 || row[i + 1] < 245 || row[i + 2] < 245) continue outer;
          }
          cutY = y; // found a white row — break here
          break;
        }
      }

      const sliceHeight = cutY - srcY;
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = sliceHeight;
      pageCanvas.getContext('2d')!.drawImage(canvas, 0, srcY, canvasWidth, sliceHeight, 0, 0, canvasWidth, sliceHeight);

      const topMarginMm = pageNumber > 1 ? 10 : 0; // 10 mm margin on pages 2+

      if (pageNumber > 1) pdf.addPage();

      const heightMm = (sliceHeight / canvasWidth) * pdfWidth;
      const imgData = pageCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, topMarginMm, pdfWidth, heightMm, undefined, 'FAST');

      srcY = cutY;
      pageNumber++;
    }

    console.log(`PDF generated with ${pageNumber - 1} pages`);
    return pdf.output('blob');
  }

  public downloadPDF(pdfBlob: Blob, filename: string): void {
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  public async cleanup(): Promise<void> {
    console.log('Unified PDF service cleanup completed');
  }
}

export const unifiedPdfService = UnifiedPDFService.getInstance();