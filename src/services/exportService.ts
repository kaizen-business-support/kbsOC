import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export async function exportToPDF(element: HTMLElement, filename: string): Promise<void> {
  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.width / canvas.height;
    const pdfWidth = pageWidth - 20;
    let renderWidth = pdfWidth;
    let renderHeight = pdfWidth / imgRatio;
    if (renderHeight > pageHeight - 20) {
      renderHeight = pageHeight - 20;
      renderWidth = renderHeight * imgRatio;
    }
    const xOffset = (pageWidth - renderWidth) / 2;
    const yOffset = (pageHeight - renderHeight) / 2;
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight);
    pdf.save(filename);
  } catch (err) {
    throw new Error(`Échec de l'export PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function exportToExcel(
  sheets: Array<{ name: string; rows: Record<string, any>[] }>,
  filename: string
): void {
  try {
    const wb = XLSX.utils.book_new();
    sheets.forEach(sheet => {
      const ws = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [{ '(aucune donnée)': '' }]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  } catch (err) {
    throw new Error(`Échec de l'export Excel: ${err instanceof Error ? err.message : String(err)}`);
  }
}
