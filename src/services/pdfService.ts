import jsPDF from 'jspdf';
import { chartImageService } from './chartImageService';

export interface PDFGenerationOptions {
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  filename?: string;
}

export class EnhancedPDFService {
  private static instance: EnhancedPDFService;

  private constructor() {}

  public static getInstance(): EnhancedPDFService {
    if (!EnhancedPDFService.instance) {
      EnhancedPDFService.instance = new EnhancedPDFService();
    }
    return EnhancedPDFService.instance;
  }

  public async generateFinancialReportPDF(
    reportContent: string,
    multiyearData: any,
    options: PDFGenerationOptions = {}
  ): Promise<Blob> {
    console.log('Starting text-based PDF generation with selectable content...');
    
    // Use the intelligent HTML-to-PDF conversion for better text handling
    return await this.generateIntelligentPDF(reportContent, multiyearData, options);
  }

  private async generateIntelligentPDF(
    reportContent: string,
    multiyearData: any,
    options: PDFGenerationOptions = {}
  ): Promise<Blob> {
    console.log('Generating intelligent PDF with selectable text and proper page breaks...');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 6;
    
    let yPos = margin + 10;
    
    // Generate chart images if needed
    let chartImages: any = {};
    if (options.includeCharts && Object.keys(multiyearData).length > 1) {
      console.log('Generating chart images for intelligent PDF...');
      try {
        chartImages = await chartImageService.generateAllCharts(multiyearData);
        console.log('Chart images generated successfully');
      } catch (error) {
        console.error('Error generating chart images:', error);
      }
    }
    
    // Parse HTML content and convert to structured PDF content
    const parsedContent = this.parseHTMLContent(reportContent);
    
    // Add header
    yPos = this.addPDFHeader(pdf, multiyearData, pageWidth, pageHeight);
    
    // Process content sections with intelligent page breaks
    await this.processContentSections(
      pdf, 
      parsedContent, 
      chartImages, 
      options,
      margin, 
      yPos, 
      contentWidth, 
      lineHeight, 
      pageWidth, 
      pageHeight
    );
    
    // Add footer to all pages
    this.addPDFFooters(pdf, pageWidth, pageHeight);
    
    console.log('Intelligent PDF generation completed');
    return pdf.output('blob');
  }

  private parseHTMLContent(htmlContent: string): any[] {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const sections: any[] = [];
    const elements = tempDiv.children;
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const tagName = element.tagName.toLowerCase();
      
      if (tagName === 'div' && element.innerHTML.includes('margin-bottom: 30px')) {
        // This is a main section
        const section = this.parseSection(element);
        if (section) sections.push(section);
      }
    }
    
    return sections;
  }

  private parseSection(sectionElement: Element): any {
    const section: any = { type: 'section', items: [] };
    
    // Find the section title
    const titleElement = sectionElement.querySelector('h3');
    if (titleElement) {
      section.title = titleElement.textContent?.trim() || '';
    }
    
    // Parse tables
    const tables = sectionElement.querySelectorAll('table');
    tables.forEach(table => {
      section.items.push(this.parseTable(table));
    });
    
    // Parse interpretation boxes
    const interpretationBoxes = sectionElement.querySelectorAll('div[style*="background: #e8f5e8"], div[style*="background: #e3f2fd"]');
    interpretationBoxes.forEach(box => {
      const titleEl = box.querySelector('h5');
      const contentEl = box.querySelector('p');
      if (titleEl && contentEl) {
        section.items.push({
          type: 'interpretation',
          title: titleEl.textContent?.trim() || '',
          content: contentEl.textContent?.trim() || '',
          color: box.getAttribute('style')?.includes('#e3f2fd') ? 'blue' : 'green'
        });
      }
    });
    
    // Parse recommendation sections
    const recommendations = sectionElement.querySelectorAll('div[style*="background: #e8f5e8"], div[style*="background: #fff3cd"]');
    recommendations.forEach(rec => {
      const titleEl = rec.querySelector('h4');
      const listEl = rec.querySelector('ul');
      if (titleEl && listEl) {
        const items: string[] = [];
        listEl.querySelectorAll('li').forEach(li => {
          if (li.textContent) items.push(li.textContent.trim());
        });
        
        section.items.push({
          type: 'recommendation',
          title: titleEl.textContent?.trim() || '',
          items: items,
          color: rec.getAttribute('style')?.includes('#fff3cd') ? 'orange' : 'green'
        });
      }
    });
    
    return section;
  }

  private parseTable(tableElement: Element): any {
    const table = { type: 'table', headers: [] as string[], rows: [] as string[][] };
    
    // Parse headers
    const headerRow = tableElement.querySelector('thead tr');
    if (headerRow) {
      const headers = headerRow.querySelectorAll('th');
      headers.forEach(header => {
        table.headers.push(header.textContent?.trim() || '');
      });
    }
    
    // Parse rows
    const bodyRows = tableElement.querySelectorAll('tbody tr');
    bodyRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const rowData: string[] = [];
      cells.forEach(cell => {
        rowData.push(cell.textContent?.trim() || '');
      });
      table.rows.push(rowData);
    });
    
    return table;
  }

  private addPDFHeader(pdf: jsPDF, multiyearData: any, pageWidth: number, pageHeight: number): number {
    // Add title header with proper French characters
    pdf.setFillColor(31, 78, 121);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Rapport d\'Analyse Financière', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text('OptimusCredit - Analyse Professionnelle', pageWidth / 2, 30, { align: 'center' });
    
    // Period information
    const years = Object.values(multiyearData)
      .map((d: any) => d.year)
      .filter(year => year && !isNaN(year))
      .sort((a, b) => a - b);
    const periodText = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : years[0]?.toString() || 'Période non définie';
    
    pdf.setTextColor(0, 0, 0);
    const margin = 15;
    let yPos = 50;
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Période d'analyse: ${periodText}`, margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, yPos);
    yPos += 20;
    
    return yPos;
  }

  private async processContentSections(
    pdf: jsPDF,
    sections: any[],
    chartImages: any,
    options: PDFGenerationOptions,
    margin: number,
    startY: number,
    contentWidth: number,
    lineHeight: number,
    pageWidth: number,
    pageHeight: number
  ): Promise<number> {
    let yPos = startY;
    
    // Helper function for page breaks
    const checkPageBreak = (requiredSpace: number): boolean => {
      if (yPos + requiredSpace > pageHeight - 30) {
        pdf.addPage();
        yPos = margin + 10;
        return true;
      }
      return false;
    };

    for (const section of sections) {
      // Add section title
      checkPageBreak(20);
      yPos = this.addSectionTitle(pdf, section.title, margin, yPos, contentWidth);
      
      // Process section items
      for (const item of section.items) {
        if (item.type === 'table') {
          checkPageBreak(60); // Reserve space for table header + a few rows
          yPos = this.addIntelligentTable(pdf, item, margin, yPos, contentWidth);
        } else if (item.type === 'interpretation') {
          checkPageBreak(40);
          yPos = this.addInterpretationBox(pdf, item.title, item.content, margin, yPos, contentWidth, lineHeight, item.color);
        } else if (item.type === 'recommendation') {
          checkPageBreak(50);
          yPos = this.addRecommendationBox(pdf, item.title, item.items, margin, yPos, contentWidth, lineHeight, item.color);
        }
        
        yPos += 5; // Space between items
      }
      
      // Add charts if this is the charts section
      if (section.title.includes('Graphiques') && options.includeCharts) {
        yPos = await this.addChartsWithPageBreaks(
          pdf, 
          chartImages, 
          margin, 
          yPos, 
          contentWidth, 
          pageHeight,
          checkPageBreak
        );
      }
      
      yPos += 10; // Space between sections
    }
    
    return yPos;
  }

  private addSectionTitle(pdf: jsPDF, title: string, x: number, y: number, width: number): number {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 78, 121);
    
    // Handle long titles by wrapping them
    const titleLines = pdf.splitTextToSize(title, width);
    titleLines.forEach((line: string) => {
      pdf.text(line, x, y);
      y += 8;
    });
    
    pdf.setTextColor(0, 0, 0);
    return y + 5;
  }

  private addIntelligentTable(pdf: jsPDF, table: any, x: number, y: number, width: number): number {
    const colWidth = width / table.headers.length;
    const cellHeight = 8;
    const cellPadding = 2;
    
    // Headers with background
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(248, 249, 250);
    pdf.setFontSize(11);
    
    table.headers.forEach((header: string, i: number) => {
      pdf.rect(x + (i * colWidth), y, colWidth, cellHeight, 'FD');
      
      // Wrap header text if needed
      const headerText = pdf.splitTextToSize(header, colWidth - 4);
      pdf.text(headerText[0] || header, x + (i * colWidth) + cellPadding, y + cellHeight - cellPadding);
    });
    y += cellHeight;
    
    // Data rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFillColor(255, 255, 255);
    pdf.setFontSize(10);
    
    table.rows.forEach((row: string[]) => {
      row.forEach((cell: string, i: number) => {
        pdf.rect(x + (i * colWidth), y, colWidth, cellHeight, 'S');
        
        // Handle long cell content
        const cellText = pdf.splitTextToSize(cell, colWidth - 4);
        pdf.text(cellText[0] || cell, x + (i * colWidth) + cellPadding, y + cellHeight - cellPadding);
      });
      y += cellHeight;
    });
    
    return y + 5;
  }

  private addInterpretationBox(
    pdf: jsPDF, 
    title: string, 
    content: string, 
    x: number, 
    y: number, 
    width: number, 
    lineHeight: number,
    color: string = 'green'
  ): number {
    // Set colors based on type
    const colors = {
      green: { bg: [232, 245, 232] as [number, number, number], border: [40, 167, 69] as [number, number, number], text: [21, 87, 36] as [number, number, number] },
      blue: { bg: [227, 242, 253] as [number, number, number], border: [33, 150, 243] as [number, number, number], text: [13, 71, 161] as [number, number, number] }
    };
    const colorScheme = colors[color as keyof typeof colors] || colors.green;
    
    // Calculate box height based on content
    const titleLines = pdf.splitTextToSize(title, width - 10);
    const contentLines = pdf.splitTextToSize(content, width - 10);
    const boxHeight = (titleLines.length + contentLines.length + 1) * lineHeight + 15;
    
    // Draw background
    pdf.setFillColor(colorScheme.bg[0], colorScheme.bg[1], colorScheme.bg[2]);
    pdf.rect(x, y, width, boxHeight, 'F');
    
    // Draw left border
    pdf.setFillColor(colorScheme.border[0], colorScheme.border[1], colorScheme.border[2]);
    pdf.rect(x, y, 4, boxHeight, 'F');
    
    let currentY = y + 10;
    
    // Add title
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colorScheme.text[0], colorScheme.text[1], colorScheme.text[2]);
    titleLines.forEach((line: string) => {
      pdf.text(line, x + 8, currentY);
      currentY += lineHeight;
    });
    
    // Add content
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    currentY += 3;
    
    contentLines.forEach((line: string) => {
      pdf.text(line, x + 8, currentY);
      currentY += lineHeight;
    });
    
    return y + boxHeight + 5;
  }

  private addRecommendationBox(
    pdf: jsPDF,
    title: string,
    items: string[],
    x: number,
    y: number,
    width: number,
    lineHeight: number,
    color: string = 'green'
  ): number {
    const colors = {
      green: { bg: [232, 245, 232] as [number, number, number], border: [40, 167, 69] as [number, number, number], text: [21, 87, 36] as [number, number, number] },
      orange: { bg: [255, 243, 205] as [number, number, number], border: [255, 193, 7] as [number, number, number], text: [133, 100, 4] as [number, number, number] }
    };
    const colorScheme = colors[color as keyof typeof colors] || colors.green;
    
    // Calculate height
    const titleHeight = lineHeight + 5;
    const itemsHeight = items.length * lineHeight;
    const boxHeight = titleHeight + itemsHeight + 15;
    
    // Draw background and border
    pdf.setFillColor(colorScheme.bg[0], colorScheme.bg[1], colorScheme.bg[2]);
    pdf.rect(x, y, width, boxHeight, 'F');
    pdf.setFillColor(colorScheme.border[0], colorScheme.border[1], colorScheme.border[2]);
    pdf.rect(x, y, 4, boxHeight, 'F');
    
    let currentY = y + 10;
    
    // Add title
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colorScheme.text[0], colorScheme.text[1], colorScheme.text[2]);
    pdf.text(title, x + 8, currentY);
    currentY += titleHeight;
    
    // Add items as bullet points
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    items.forEach(item => {
      const itemLines = pdf.splitTextToSize(`• ${item}`, width - 16);
      itemLines.forEach((line: string) => {
        pdf.text(line, x + 12, currentY);
        currentY += lineHeight;
      });
    });
    
    return y + boxHeight + 5;
  }

  private async addChartsWithPageBreaks(
    pdf: jsPDF,
    chartImages: any,
    margin: number,
    yPos: number,
    contentWidth: number,
    pageHeight: number,
    checkPageBreak: (space: number) => boolean
  ): Promise<number> {
    const imageWidth = contentWidth;
    const imageHeight = imageWidth * 0.5; // 2:1 aspect ratio
    const spaceNeeded = imageHeight + 20; // Image + margin
    
    const charts = [
      { key: 'revenueChart', title: 'Évolution du Chiffre d\'Affaires' },
      { key: 'profitChart', title: 'Évolution du Résultat Net' },
      { key: 'ratiosChart', title: 'Évolution des Ratios Financiers' },
      { key: 'cashFlowChart', title: 'Flux de Trésorerie par Activité' }
    ];
    
    for (const chart of charts) {
      if (chartImages[chart.key]) {
        // Check if we need a new page - ensure charts don't get cut
        if (checkPageBreak(spaceNeeded)) {
          yPos = margin + 10;
        }
        
        try {
          // Add chart title
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(31, 78, 121);
          pdf.text(chart.title, margin, yPos);
          yPos += 15;
          
          // Add chart image
          pdf.addImage(chartImages[chart.key], 'PNG', margin, yPos, imageWidth, imageHeight);
          yPos += imageHeight + 15;
          
          console.log(`Added ${chart.key} to PDF at position ${yPos - imageHeight - 15}`);
        } catch (error) {
          console.error(`Error adding ${chart.key} to PDF:`, error);
        }
      }
    }
    
    return yPos;
  }

  private addPDFFooters(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
    const totalPages = pdf.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      
      const footerText = `OptimusCredit - Page ${i}/${totalPages} - © ${new Date().getFullYear()} Kaizen Business Support`;
      pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
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
    // No cleanup needed for browser-based solution
    console.log('Enhanced PDF service cleanup (no-op)');
  }
}

export const pdfService = EnhancedPDFService.getInstance();
