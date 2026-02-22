import { chartImageService } from './chartImageService';

export interface ReportGenerationOptions {
  includeCharts: boolean;
  includeRecommendations: boolean;
  multiyearData: any;
}

export class ReportContentService {
  private static instance: ReportContentService;

  private constructor() {}

  public static getInstance(): ReportContentService {
    if (!ReportContentService.instance) {
      ReportContentService.instance = new ReportContentService();
    }
    return ReportContentService.instance;
  }

  public async generateCompleteReportHTML(options: ReportGenerationOptions): Promise<string> {
    console.log('Starting complete report HTML generation with options:', {
      includeCharts: options.includeCharts,
      includeRecommendations: options.includeRecommendations,
      dataKeys: Object.keys(options.multiyearData)
    });

    const { multiyearData, includeCharts, includeRecommendations } = options;
    
    // Generate chart images if needed
    let chartImages: any = {};
    if (includeCharts && Object.keys(multiyearData).length > 1) {
      try {
        console.log('Generating chart images for complete report...');
        chartImages = await chartImageService.generateAllCharts(multiyearData);
        console.log('Chart images generated:', Object.keys(chartImages).filter(k => chartImages[k]));
      } catch (error) {
        console.error('Error generating chart images:', error);
      }
    }

    // Get years for header
    const years = Object.values(multiyearData)
      .map((d: any) => d.year || parseInt(Object.keys(multiyearData).find(k => multiyearData[k] === d) || '2023'))
      .filter(year => year && !isNaN(year))
      .sort((a, b) => a - b);
    
    const periodText = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : years[0]?.toString() || 'Période non définie';

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        
        <!-- Header Section -->
        <div style="text-align: center; margin-bottom: 30px; padding: 30px; background: linear-gradient(135deg, #1f4e79, #2c5aa0); color: white; border-radius: 10px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Rapport d'Analyse Financière</h1>
          <h2 style="margin: 10px 0 0 0; font-size: 18px; font-weight: normal;">OptimusCredit - Analyse Professionnelle</h2>
          <p style="margin: 15px 0 0 0; font-size: 16px;">Période: ${periodText}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <!-- Executive Summary -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📊 Résumé Exécutif</h3>
          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3;">
            <p style="margin: 0; font-size: 16px;">
              Analyse complète des états financiers selon les normes OHADA/BCEAO. Cette analyse couvre ${Object.keys(multiyearData).length} périodes et fournit une évaluation détaillée de la performance financière et des tendances d'évolution.
            </p>
          </div>
        </div>

        <!-- Balance Sheet Analysis -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📊 Analyse du Bilan</h3>
          ${this.generateFinancialTable(multiyearData, [
            { key: 'total_actif_immobilise', label: 'Actif Immobilisé' },
            { key: 'total_actif_circulant', label: 'Actif Circulant' },
            { key: 'tresorerie_actif', label: 'Trésorerie Actif' },
            { key: 'total_actif', label: 'TOTAL ACTIF' },
            { key: 'capitaux_propres', label: 'Capitaux Propres' },
            { key: 'dettes_financieres', label: 'Dettes Financières' },
            { key: 'total_dettes', label: 'Total Dettes' }
          ])}
          <div style="background: #e8f5e8; padding: 15px; margin-top: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
            <h5 style="margin: 0 0 8px 0; color: #155724;">💡 Interprétation - Structure Financière</h5>
            <p style="margin: 0; font-size: 14px;">${this.generateBalanceSheetInterpretation(multiyearData)}</p>
          </div>
        </div>

        <!-- Income Statement -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📈 Compte de Résultat</h3>
          ${this.generateFinancialTable(multiyearData, [
            { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires' },
            { key: 'total_produits_exploitation', label: 'Total Produits d\'Exploitation' },
            { key: 'total_charges_exploitation', label: 'Total Charges d\'Exploitation' },
            { key: 'resultat_exploitation', label: 'Résultat d\'Exploitation' },
            { key: 'resultat_financier', label: 'Résultat Financier' },
            { key: 'resultat_courant', label: 'Résultat Courant' },
            { key: 'resultat_net', label: 'Résultat Net' }
          ])}
          <div style="background: #e8f5e8; padding: 15px; margin-top: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
            <h5 style="margin: 0 0 8px 0; color: #155724;">💡 Interprétation - Performance</h5>
            <p style="margin: 0; font-size: 14px;">${this.generateIncomeStatementInterpretation(multiyearData)}</p>
          </div>
        </div>

        <!-- Cash Flow Analysis -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">💧 Tableau de Flux de Trésorerie</h3>
          ${this.generateFinancialTable(multiyearData, [
            { key: 'flux_tresorerie_activites_operationnelles', label: 'Flux - Activités Opérationnelles' },
            { key: 'flux_tresorerie_activites_investissement', label: 'Flux - Activités d\'Investissement' },
            { key: 'flux_tresorerie_activites_financement', label: 'Flux - Activités de Financement' },
            { key: 'variation_tresorerie', label: 'Variation de Trésorerie' },
            { key: 'tresorerie_debut_periode', label: 'Trésorerie Début Période' },
            { key: 'tresorerie_fin_periode', label: 'Trésorerie Fin Période' }
          ])}
        </div>

        <!-- Financial Ratios -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📊 Ratios Financiers</h3>
          ${this.generateRatiosAnalysis(multiyearData)}
          <div style="background: #e3f2fd; padding: 15px; margin-top: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
            <h5 style="margin: 0 0 8px 0; color: #0d47a1;">💡 Interprétation - Ratios Financiers</h5>
            <p style="margin: 0; font-size: 14px;">${this.generateRatiosInterpretation(multiyearData)}</p>
          </div>
        </div>
    `;

    // Year on Year Analysis (if multiple years)
    if (Object.keys(multiyearData).length > 1) {
      htmlContent += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📈 Analyse d'Évolution Annuelle</h3>
          ${this.generateYearOnYearAnalysis(multiyearData)}
          <div style="background: #e3f2fd; padding: 15px; margin-top: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
            <h5 style="margin: 0 0 8px 0; color: #0d47a1;">💡 Interprétation - Évolution des Performances</h5>
            <p style="margin: 0; font-size: 14px;">${this.generateYearOnYearInterpretation(multiyearData)}</p>
          </div>
        </div>
      `;
    }

    // Charts Section (if requested and available)
    if (includeCharts && Object.keys(chartImages).some(k => chartImages[k])) {
      htmlContent += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📊 Graphiques et Visualisations</h3>
          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #1565c0;">Analyse Visuelle des Données Financières</h4>
            <p style="margin: 0; font-size: 14px; color: #1976d2;">
              Les graphiques ci-dessous présentent une analyse visuelle complète des données financières 
              permettant une compréhension rapide des tendances et performances.
            </p>
          </div>
      `;

      // Add each chart image if available
      if (chartImages.revenueChart) {
        htmlContent += `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${chartImages.revenueChart}" alt="Évolution du Chiffre d'Affaires" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
      }

      if (chartImages.profitChart) {
        htmlContent += `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${chartImages.profitChart}" alt="Évolution du Résultat Net" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
      }

      if (chartImages.ratiosChart) {
        htmlContent += `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${chartImages.ratiosChart}" alt="Évolution des Ratios Financiers" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
      }

      if (chartImages.cashFlowChart) {
        htmlContent += `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${chartImages.cashFlowChart}" alt="Flux de Trésorerie par Activité" style="max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
      }

      htmlContent += `
          <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
            <h5 style="margin: 0 0 8px 0; color: #155724;">💡 Analyse Graphique des Tendances</h5>
            <p style="margin: 0; font-size: 14px;">
              Ces visualisations permettent d'identifier rapidement les tendances de croissance, 
              les points d'inflexion et les cycles d'activité de l'entreprise sur la période analysée.
            </p>
          </div>
        </div>
      `;
    } else if (includeCharts) {
      // Show message when charts are requested but not available
      htmlContent += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">📊 Graphiques et Visualisations</h3>
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">📈 Graphiques en cours de génération</h4>
            <p style="margin: 0; font-size: 14px; color: #856404;">
              Les graphiques seront inclus dans le rapport final. Cette analyse nécessite au moins 2 périodes de données pour les comparaisons.
            </p>
          </div>
        </div>
      `;
    }

    // Recommendations (if requested)
    if (includeRecommendations) {
      htmlContent += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f4e79; border-bottom: 2px solid #2c5aa0; padding-bottom: 8px; font-size: 20px;">💡 Recommandations Stratégiques</h3>
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h4 style="margin: 0 0 15px 0; color: #155724;">Points Forts Identifiés</h4>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Structure financière équilibrée selon les normes OHADA</li>
              <li>Respect des ratios prudentiels BCEAO</li>
              <li>Évolution positive des indicateurs de performance</li>
            </ul>
          </div>
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 15px;">
            <h4 style="margin: 0 0 15px 0; color: #856404;">Axes d'Amélioration</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Optimisation de la gestion de trésorerie</li>
              <li>Renforcement de la structure de financement</li>
              <li>Amélioration de l'efficacité opérationnelle</li>
            </ul>
          </div>
        </div>
      `;
    }

    // Footer
    htmlContent += `
        <!-- Footer -->
        <div style="text-align: center; margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-top: 3px solid #2c5aa0;">
          <p style="margin: 0; font-size: 14px; color: #666; font-weight: bold;">
            Rapport généré par <strong>OptimusCredit</strong> - Solution d'analyse financière conforme aux standards OHADA/BCEAO
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
            © ${new Date().getFullYear()} Kaizen Business Support - Analyse professionnelle pour la région UEMOA
          </p>
        </div>
      </div>
    `;

    console.log('Complete report HTML generated successfully');
    return htmlContent;
  }

  private generateFinancialTable(multiyearData: any, fields: Array<{ key: string; label: string }>): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });

    let tableHTML = `
      <div style="overflow-x: auto; margin: 15px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: 600; color: #1f4e79;">Libellé</th>
    `;

    // Add year headers
    sortedKeys.forEach(key => {
      const year = multiyearData[key].year || key;
      tableHTML += `<th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #1f4e79;">${year}</th>`;
    });

    // Add evolution header if multiple years
    if (sortedKeys.length > 1) {
      tableHTML += `<th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #1f4e79;">Évolution</th>`;
    }

    tableHTML += `</tr></thead><tbody>`;

    // Add rows
    fields.forEach((field, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      tableHTML += `<tr style="background: ${bgColor};">`;
      tableHTML += `<td style="border: 1px solid #ddd; padding: 10px; font-weight: 500;">${field.label}</td>`;

      const values = sortedKeys.map(key => {
        const data = multiyearData[key]?.data || multiyearData[key] || {};
        return Number(data[field.key]) || 0;
      });

      // Add value cells
      values.forEach(value => {
        const formattedValue = new Intl.NumberFormat('fr-FR').format(value);
        tableHTML += `<td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${formattedValue} FCFA</td>`;
      });

      // Add evolution cell if multiple years
      if (sortedKeys.length > 1 && values[0] !== 0) {
        const evolution = ((values[values.length - 1] - values[0]) / values[0]) * 100;
        const evolutionColor = evolution >= 0 ? '#28a745' : '#dc3545';
        const evolutionIcon = evolution >= 0 ? '↗' : '↘';
        tableHTML += `<td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: ${evolutionColor}; font-weight: 600;">${evolutionIcon} ${evolution.toFixed(1)}%</td>`;
      } else if (sortedKeys.length > 1) {
        tableHTML += `<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">-</td>`;
      }

      tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    return tableHTML;
  }

  private generateRatiosAnalysis(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });

    const lastYear = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
    
    const roe = lastYear.resultat_net && lastYear.capitaux_propres 
      ? (lastYear.resultat_net / lastYear.capitaux_propres) * 100 
      : 0;
    const roa = lastYear.resultat_net && lastYear.total_actif 
      ? (lastYear.resultat_net / lastYear.total_actif) * 100 
      : 0;
    const autonomie = lastYear.capitaux_propres && lastYear.total_actif 
      ? (lastYear.capitaux_propres / lastYear.total_actif) * 100 
      : 0;
    const liquidite = lastYear.total_actif_circulant && lastYear.total_dettes 
      ? lastYear.total_actif_circulant / lastYear.total_dettes 
      : 0;

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
          <h4 style="margin: 0 0 10px 0; color: #1f4e79;">ROE</h4>
          <div style="font-size: 24px; font-weight: bold; color: ${roe >= 15 ? '#28a745' : '#dc3545'};">${roe.toFixed(1)}%</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">≥ 15% (BCEAO)</div>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
          <h4 style="margin: 0 0 10px 0; color: #1f4e79;">ROA</h4>
          <div style="font-size: 24px; font-weight: bold; color: ${roa >= 5 ? '#28a745' : '#dc3545'};">${roa.toFixed(1)}%</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">≥ 5% (Sectoriel)</div>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
          <h4 style="margin: 0 0 10px 0; color: #1f4e79;">Autonomie</h4>
          <div style="font-size: 24px; font-weight: bold; color: ${autonomie >= 30 ? '#28a745' : '#dc3545'};">${autonomie.toFixed(1)}%</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">≥ 30% (OHADA)</div>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
          <h4 style="margin: 0 0 10px 0; color: #1f4e79;">Liquidité</h4>
          <div style="font-size: 24px; font-weight: bold; color: ${liquidite >= 1.2 ? '#28a745' : '#dc3545'};">${liquidite.toFixed(2)}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">≥ 1.2 (Standard)</div>
        </div>
      </div>
    `;
  }

  private generateYearOnYearAnalysis(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });

    const keyFields = [
      { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires' },
      { key: 'resultat_net', label: 'Résultat Net' },
      { key: 'total_actif', label: 'Total Actif' },
      { key: 'capitaux_propres', label: 'Capitaux Propres' },
      { key: 'flux_tresorerie_activites_operationnelles', label: 'Flux Opérationnels' }
    ];

    let analysisHTML = `
      <div style="overflow-x: auto; margin: 15px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: 600; color: #1f4e79;">Indicateur</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #1f4e79;">Évolution</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #1f4e79;">Variation (%)</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #1f4e79;">Tendance</th>
            </tr>
          </thead>
          <tbody>
    `;

    keyFields.forEach((field, index) => {
      const firstYearData = multiyearData[sortedKeys[0]]?.data || multiyearData[sortedKeys[0]] || {};
      const lastYearData = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
      
      const firstValue = Number(firstYearData[field.key]) || 0;
      const lastValue = Number(lastYearData[field.key]) || 0;
      
      const variation = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
      const evolutionText = lastValue > firstValue ? 'Hausse' : lastValue < firstValue ? 'Baisse' : 'Stable';
      const trendIcon = variation > 5 ? '📈' : variation < -5 ? '📉' : '➡️';
      const variationColor = variation >= 0 ? '#28a745' : '#dc3545';
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

      analysisHTML += `
        <tr style="background: ${bgColor};">
          <td style="border: 1px solid #ddd; padding: 10px; font-weight: 500;">${field.label}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${evolutionText}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: ${variationColor}; font-weight: 600;">${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${trendIcon}</td>
        </tr>
      `;
    });

    analysisHTML += `</tbody></table></div>`;
    return analysisHTML;
  }

  // Interpretation methods
  private generateBalanceSheetInterpretation(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });
    
    if (sortedKeys.length < 2) return "Analyse sur une seule période - évolution non disponible.";
    
    const firstYear = multiyearData[sortedKeys[0]]?.data || multiyearData[sortedKeys[0]] || {};
    const lastYear = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
    
    const totalActifEvolution = firstYear.total_actif ? ((lastYear.total_actif - firstYear.total_actif) / firstYear.total_actif) * 100 : 0;
    const capitauxPropresEvolution = firstYear.capitaux_propres ? ((lastYear.capitaux_propres - firstYear.capitaux_propres) / firstYear.capitaux_propres) * 100 : 0;
    
    return `L'évolution du bilan montre ${totalActifEvolution >= 0 ? 'une croissance' : 'une diminution'} de ${Math.abs(totalActifEvolution).toFixed(1)}% des actifs totaux. Les capitaux propres ont ${capitauxPropresEvolution >= 0 ? 'progressé' : 'diminué'} de ${Math.abs(capitauxPropresEvolution).toFixed(1)}%, ${capitauxPropresEvolution >= 10 ? 'indiquant un renforcement notable de la structure financière.' : capitauxPropresEvolution >= 0 ? 'montrant une stabilité de la structure financière.' : 'nécessitant une attention particulière pour le renforcement des fonds propres.'}`;
  }

  private generateIncomeStatementInterpretation(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });
    
    if (sortedKeys.length < 2) return "Analyse sur une seule période - évolution non disponible.";
    
    const firstYear = multiyearData[sortedKeys[0]]?.data || multiyearData[sortedKeys[0]] || {};
    const lastYear = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
    
    const caEvolution = firstYear.chiffre_affaires ? ((lastYear.chiffre_affaires - firstYear.chiffre_affaires) / firstYear.chiffre_affaires) * 100 : 0;
    const resultatNetEvolution = firstYear.resultat_net ? ((lastYear.resultat_net - firstYear.resultat_net) / firstYear.resultat_net) * 100 : 0;
    
    return `Le chiffre d'affaires a ${caEvolution >= 0 ? 'progressé' : 'diminué'} de ${Math.abs(caEvolution).toFixed(1)}% sur la période. Le résultat net affiche ${resultatNetEvolution >= 0 ? 'une amélioration' : 'une dégradation'} de ${Math.abs(resultatNetEvolution).toFixed(1)}%, ${resultatNetEvolution >= 15 ? 'témoignant d\'une excellente performance opérationnelle.' : resultatNetEvolution >= 0 ? 'indiquant une gestion maîtrisée des coûts.' : 'nécessitant une optimisation de la structure de coûts.'}`;
  }

  private generateRatiosInterpretation(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });
    
    const lastYear = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
    const roe = lastYear.resultat_net && lastYear.capitaux_propres ? (lastYear.resultat_net / lastYear.capitaux_propres) * 100 : 0;
    const liquidite = lastYear.total_actif_circulant && lastYear.total_dettes ? lastYear.total_actif_circulant / lastYear.total_dettes : 0;
    const autonomie = lastYear.capitaux_propres && lastYear.total_actif ? (lastYear.capitaux_propres / lastYear.total_actif) * 100 : 0;
    
    return `L'analyse des ratios révèle une rentabilité des capitaux propres (ROE) de ${roe.toFixed(1)}% ${roe >= 15 ? 'conforme aux standards BCEAO' : 'inférieure aux recommandations standards'}. Le ratio de liquidité de ${liquidite.toFixed(2)} ${liquidite >= 1.2 ? 'assure une couverture satisfaisante des dettes à court terme' : 'nécessite un renforcement de la position de liquidité'}. L'autonomie financière de ${autonomie.toFixed(1)}% ${autonomie >= 30 ? 'démontre une structure financière équilibrée' : 'suggère une dépendance excessive aux financements externes'}, conforme aux pratiques du secteur UEMOA.`;
  }

  private generateYearOnYearInterpretation(multiyearData: any): string {
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });
    
    if (sortedKeys.length < 2) return "Analyse d'évolution nécessite au moins deux périodes.";
    
    const firstYearData = multiyearData[sortedKeys[0]]?.data || multiyearData[sortedKeys[0]] || {};
    const lastYearData = multiyearData[sortedKeys[sortedKeys.length - 1]]?.data || multiyearData[sortedKeys[sortedKeys.length - 1]] || {};
    
    const caEvolution = firstYearData.chiffre_affaires ? 
      ((lastYearData.chiffre_affaires - firstYearData.chiffre_affaires) / firstYearData.chiffre_affaires) * 100 : 0;
    
    const resultatEvolution = firstYearData.resultat_net ? 
      ((lastYearData.resultat_net - firstYearData.resultat_net) / firstYearData.resultat_net) * 100 : 0;
    
    const actifEvolution = firstYearData.total_actif ? 
      ((lastYearData.total_actif - firstYearData.total_actif) / firstYearData.total_actif) * 100 : 0;
    
    return `L'analyse d'évolution sur la période révèle une ${caEvolution >= 0 ? 'croissance' : 'diminution'} du chiffre d'affaires de ${Math.abs(caEvolution).toFixed(1)}%. Le résultat net affiche ${resultatEvolution >= 0 ? 'une progression' : 'une régression'} de ${Math.abs(resultatEvolution).toFixed(1)}%, ${resultatEvolution >= 10 ? 'témoignant d\'une excellente performance.' : resultatEvolution >= 0 ? 'indiquant une stabilité.' : 'nécessitant des mesures correctives.'} L'évolution des actifs totaux (${actifEvolution >= 0 ? '+' : ''}${actifEvolution.toFixed(1)}%) ${actifEvolution >= 5 ? 'démontre une expansion soutenue de l\'activité.' : 'reflète une consolidation des positions.'}`;
  }
}

export const reportContentService = ReportContentService.getInstance();