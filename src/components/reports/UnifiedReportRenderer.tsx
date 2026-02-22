import React from 'react';

interface UnifiedReportRendererProps {
  content: string;
  includeCharts?: boolean;
  multiyearData?: any;
  isPrintMode?: boolean; // For PDF generation
}

// A4 dimensions in pixels (at 96 DPI)
const A4_WIDTH = 794; // 210mm
const MARGIN = 40; // ~15mm margins

export const UnifiedReportRenderer: React.FC<UnifiedReportRendererProps> = ({
  content,
  includeCharts = false,
  multiyearData = {},
  isPrintMode = false
}) => {
  
  const containerStyles: React.CSSProperties = {
    width: isPrintMode ? `${A4_WIDTH}px` : '100%',
    maxWidth: isPrintMode ? `${A4_WIDTH}px` : '100%',
    margin: '0 auto',
    padding: `${MARGIN}px`,
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#333',
    backgroundColor: '#ffffff',
    
    // Print-friendly styles
    pageBreakInside: 'avoid',
    orphans: 3,
    widows: 3,
    
    // Enhanced text rendering for better PDF quality
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    fontFeatureSettings: '"liga", "kern"',
    
    // Ensure consistent rendering
    boxSizing: 'border-box' as const,
  };

  const printStyles = isPrintMode ? `
    @media print, screen {
      body { margin: 0; }
      
      .page-break-before { page-break-before: always; }
      .page-break-after { page-break-after: always; }
      .page-break-avoid { page-break-inside: avoid; }
      
      table { 
        border-collapse: collapse;
        width: 100%;
        font-size: 11px;
        page-break-inside: avoid;
      }
      
      th, td { 
        border: 1px solid #ddd;
        padding: 6px 8px;
        text-align: left;
        page-break-inside: avoid;
      }
      
      th {
        background-color: #f8f9fa !important;
        font-weight: 600;
        font-size: 11px;
      }
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        margin-top: 16px;
        margin-bottom: 8px;
      }
      
      .interpretation-box {
        background: #f8f9fa !important;
        border-left: 4px solid #28a745 !important;
        padding: 12px !important;
        margin: 10px 0 !important;
        border-radius: 4px !important;
        page-break-inside: avoid;
      }
      
      .blue-interpretation {
        background: #e3f2fd !important;
        border-left-color: #2196f3 !important;
      }
      
      .chart-container {
        page-break-inside: avoid;
        margin: 20px 0;
        text-align: center;
      }
      
      .chart-title {
        font-size: 14px;
        font-weight: 600;
        color: #1f4e79;
        margin-bottom: 10px;
      }
    }
  ` : '';

  // Enhanced content processing for print compatibility
  const processContentForPrint = (htmlContent: string): string => {
    let processedContent = htmlContent;

    // Add print-friendly classes
    processedContent = processedContent.replace(
      /style="background: #e8f5e8;[^"]*"/g,
      'class="interpretation-box"'
    );
    
    processedContent = processedContent.replace(
      /style="background: #e3f2fd;[^"]*"/g,
      'class="interpretation-box blue-interpretation"'
    );

    // Ensure tables have proper print styles
    processedContent = processedContent.replace(
      /<table[^>]*>/g,
      '<table class="page-break-avoid">'
    );

    // Add page breaks before major sections
    processedContent = processedContent.replace(
      /<h3[^>]*>📊 Bilan - Passif<\/h3>/g,
      '<div class="page-break-before"></div><h3>📊 Bilan - Passif</h3>'
    );
    
    processedContent = processedContent.replace(
      /<h3[^>]*>📈 Compte de Résultat<\/h3>/g,
      '<div class="page-break-before"></div><h3>📈 Compte de Résultat</h3>'
    );
    
    processedContent = processedContent.replace(
      /<h3[^>]*>💧 Tableau de Flux de Trésorerie<\/h3>/g,
      '<div class="page-break-before"></div><h3>💧 Tableau de Flux de Trésorerie</h3>'
    );

    return processedContent;
  };

  const renderChartSection = () => {
    if (!includeCharts || Object.keys(multiyearData).length < 2) {
      return null;
    }

    return (
      <div className="page-break-before">
        <h3 style={{ color: '#1f4e79', borderBottom: '2px solid #2c5aa0', paddingBottom: '8px', marginTop: '30px' }}>
          📊 Graphiques et Visualisations
        </h3>
        
        <div className="chart-container">
          <div className="chart-title">📈 Évolution du Chiffre d'Affaires</div>
          <div style={{ height: '300px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <span style={{ color: '#666' }}>Graphique du chiffre d'affaires sera généré ici</span>
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-title">💰 Évolution du Résultat Net</div>
          <div style={{ height: '300px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <span style={{ color: '#666' }}>Graphique du résultat net sera généré ici</span>
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-title">📊 Évolution des Ratios Financiers</div>
          <div style={{ height: '300px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
            <span style={{ color: '#666' }}>Graphique des ratios financiers sera généré ici</span>
          </div>
        </div>
      </div>
    );
  };

  const processedContent = isPrintMode ? processContentForPrint(content) : content;

  return (
    <>
      {isPrintMode && (
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      )}
      
      <div style={containerStyles}>
        <div dangerouslySetInnerHTML={{ __html: processedContent }} />
        {renderChartSection()}
      </div>
    </>
  );
};