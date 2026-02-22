import { FinancialData, FinancialRatios, MultiyearData, AnalysisScore, AnalysisInsight, Recommendation } from '../types';

export interface CalculationResult {
  ratios: FinancialRatios;
  score: AnalysisScore;
  insights: AnalysisInsight[];
  recommendations: Recommendation[];
}

export interface BceaoCompliance {
  ratioName: string;
  value: number;
  norm: { min?: number; max?: number; optimal?: number };
  isCompliant: boolean;
  status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
  recommendation?: string;
}

// BCEAO Norms and Standards
const BCEAO_NORMS = {
  // Liquidity ratios
  ratio_liquidite_generale: { min: 1.2, optimal: 2.0 },
  ratio_liquidite_reduite: { min: 1.0, optimal: 1.5 },
  ratio_liquidite_immediate: { min: 0.3, optimal: 0.8 },
  
  // Solvency ratios
  ratio_autonomie_financiere: { min: 20, optimal: 40 },
  ratio_endettement: { max: 70, optimal: 50 },
  ratio_couverture_dettes: { min: 3, optimal: 5 },
  
  // Profitability ratios
  roe: { min: 10, optimal: 20 },
  roa: { min: 5, optimal: 10 },
  marge_nette: { min: 3, optimal: 8 },
  marge_brute: { min: 15, optimal: 30 },
  
  // Activity ratios
  rotation_actif: { min: 0.8, optimal: 1.5 },
  rotation_stocks: { min: 4, optimal: 8 },
  delai_recouvrement: { max: 60, optimal: 30 },
  
  // Structure ratios
  ratio_capitaux_permanents: { min: 1.0, optimal: 1.2 },
  ratio_financement_stable: { min: 1.0, optimal: 1.3 },
};

// Sectoral norms by industry
const SECTORAL_NORMS: Record<string, Partial<typeof BCEAO_NORMS>> = {
  industrie: {
    ratio_liquidite_generale: { min: 1.2, optimal: 1.8 },
    ratio_autonomie_financiere: { min: 25, optimal: 45 },
    roe: { min: 8, optimal: 15 },
    rotation_actif: { min: 0.8, optimal: 1.2 },
  },
  commerce: {
    ratio_liquidite_generale: { min: 1.0, optimal: 1.5 },
    ratio_autonomie_financiere: { min: 20, optimal: 35 },
    roe: { min: 12, optimal: 20 },
    rotation_actif: { min: 1.2, optimal: 2.0 },
  },
  services: {
    ratio_liquidite_generale: { min: 1.5, optimal: 2.5 },
    ratio_autonomie_financiere: { min: 30, optimal: 60 },
    roe: { min: 15, optimal: 25 },
    rotation_actif: { min: 1.0, optimal: 1.8 },
  },
  agriculture: {
    ratio_liquidite_generale: { min: 1.3, optimal: 2.0 },
    ratio_autonomie_financiere: { min: 35, optimal: 55 },
    roe: { min: 10, optimal: 18 },
    rotation_actif: { min: 0.6, optimal: 1.0 },
  },
};

export class FinancialCalculator {
  
  // Main calculation method
  static calculateAnalysis(
    multiyearData: MultiyearData,
    sector: string = 'general'
  ): CalculationResult {
    const latestYearKey = this.getLatestYearKey(multiyearData);
    const latestData = multiyearData[latestYearKey];
    
    if (!latestData) {
      throw new Error('No financial data available for analysis');
    }

    // Calculate ratios for all years
    const allRatios: Record<string, FinancialRatios> = {};
    Object.entries(multiyearData).forEach(([key, yearData]) => {
      allRatios[key] = this.calculateRatios(yearData.data);
    });

    const latestRatios = allRatios[latestYearKey];
    
    // Calculate scores
    const score = this.calculateScore(latestRatios, sector);
    
    // Generate insights
    const insights = this.generateInsights(multiyearData, allRatios, sector);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(latestRatios, insights, sector);

    return {
      ratios: latestRatios,
      score,
      insights,
      recommendations,
    };
  }

  // Calculate all financial ratios
  static calculateRatios(data: FinancialData): FinancialRatios {
    const ratios: FinancialRatios = {};

    // Liquidity Ratios - Updated to use Excel processor field names
    if (data['total_actif_circulant'] && data['tresorerie_actif'] && data['total_dettes']) {
      ratios.ratio_liquidite_generale = 
        (Number(data['total_actif_circulant']) + Number(data['tresorerie_actif'])) / Number(data['total_dettes']);
    }

    if (data['tresorerie_actif'] && data['total_dettes']) {
      ratios.ratio_liquidite_immediate = Number(data['tresorerie_actif']) / Number(data['total_dettes']);
    }

    // Solvency Ratios
    if (data['capitaux_propres'] && data['total_actif']) {
      ratios.ratio_autonomie_financiere = (Number(data['capitaux_propres']) / Number(data['total_actif'])) * 100;
    }

    if (data['total_dettes'] && data['total_actif']) {
      ratios.ratio_endettement = (Number(data['total_dettes']) / Number(data['total_actif'])) * 100;
    }

    if (data['dettes_financieres'] && data['excedent_brut_exploitation']) {
      ratios.ratio_couverture_dettes = Number(data['excedent_brut_exploitation']) / Number(data['dettes_financieres']);
    }

    // Profitability Ratios
    if (data['resultat_net'] && data['capitaux_propres']) {
      ratios.roe = (Number(data['resultat_net']) / Number(data['capitaux_propres'])) * 100;
    }

    if (data['resultat_net'] && data['total_actif']) {
      ratios.roa = (Number(data['resultat_net']) / Number(data['total_actif'])) * 100;
    }

    if (data['resultat_net'] && data['chiffre_affaires']) {
      ratios.marge_nette = (Number(data['resultat_net']) / Number(data['chiffre_affaires'])) * 100;
    }

    if (data['marge_commerciale'] && data['chiffre_affaires']) {
      ratios.marge_brute = (Number(data['marge_commerciale']) / Number(data['chiffre_affaires'])) * 100;
    }

    // Activity Ratios
    if (data['chiffre_affaires'] && data['total_actif']) {
      ratios.rotation_actif = Number(data['chiffre_affaires']) / Number(data['total_actif']);
    }

    if (data['chiffre_affaires'] && data['total_actif_circulant']) {
      ratios.rotation_stocks = Number(data['chiffre_affaires']) / Number(data['total_actif_circulant']);
    }

    // Additional calculated ratios
    if (data['total_actif_circulant'] && data['total_dettes']) {
      ratios.working_capital = Number(data['total_actif_circulant']) - Number(data['total_dettes']);
    }

    if (data['capitaux_propres'] && data['total_actif_immobilise']) {
      ratios.ratio_financement_stable = Number(data['capitaux_propres']) / Number(data['total_actif_immobilise']);
    }

    if (data['excedent_brut_exploitation'] && data['chiffre_affaires']) {
      ratios.marge_ebe = (Number(data['excedent_brut_exploitation']) / Number(data['chiffre_affaires'])) * 100;
    }

    if (data['valeur_ajoutee'] && data['chiffre_affaires']) {
      ratios.taux_valeur_ajoutee = (Number(data['valeur_ajoutee']) / Number(data['chiffre_affaires'])) * 100;
    }

    return ratios;
  }

  // Calculate BCEAO compliance score
  static calculateScore(ratios: FinancialRatios, sector: string = 'general'): AnalysisScore {
    const norms = sector !== 'general' && SECTORAL_NORMS[sector] 
      ? { ...BCEAO_NORMS, ...SECTORAL_NORMS[sector] }
      : BCEAO_NORMS;

    // Liquidity score (40 points max)
    let liquidityScore = 0;
    const liquidityRatios = [
      { ratio: ratios.ratio_liquidite_generale, norm: norms.ratio_liquidite_generale },
      { ratio: ratios.ratio_liquidite_immediate, norm: norms.ratio_liquidite_immediate },
    ];

    liquidityRatios.forEach(({ ratio, norm }) => {
      if (ratio !== undefined && norm) {
        liquidityScore += this.scoreRatio(ratio, norm, 20);
      }
    });

    // Leverage score (40 points max)
    let leverageScore = 0;
    const leverageRatios = [
      { ratio: ratios.ratio_autonomie_financiere, norm: norms.ratio_autonomie_financiere },
      { ratio: ratios.ratio_endettement, norm: norms.ratio_endettement, inverse: true },
    ];

    leverageRatios.forEach(({ ratio, norm, inverse }) => {
      if (ratio !== undefined && norm) {
        leverageScore += this.scoreRatio(ratio, norm, 20, inverse);
      }
    });

    // Profitability score (30 points max)
    let profitabilityScore = 0;
    const profitabilityRatios = [
      { ratio: ratios.roe, norm: norms.roe },
      { ratio: ratios.roa, norm: norms.roa },
      { ratio: ratios.marge_nette, norm: norms.marge_nette },
    ];

    profitabilityRatios.forEach(({ ratio, norm }) => {
      if (ratio !== undefined && norm) {
        profitabilityScore += this.scoreRatio(ratio, norm, 10);
      }
    });

    // Efficiency score (15 points max)
    let efficiencyScore = 0;
    const efficiencyRatios = [
      { ratio: ratios.rotation_actif, norm: norms.rotation_actif },
    ];

    efficiencyRatios.forEach(({ ratio, norm }) => {
      if (ratio !== undefined && norm) {
        efficiencyScore += this.scoreRatio(ratio, norm, 15);
      }
    });

    // Trend score (15 points max) - simplified for now
    const trendScore = 12; // Default value, would need historical analysis

    // Calculate overall score (max 140, scaled to 100)
    const totalScore = liquidityScore + leverageScore + profitabilityScore + efficiencyScore + trendScore;
    const overall = Math.round((totalScore / 140) * 100);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (overall >= 80) riskLevel = 'low';
    else if (overall >= 60) riskLevel = 'medium';
    else if (overall >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      overall,
      profitability: Math.round((profitabilityScore / 30) * 100),
      liquidity: Math.round((liquidityScore / 40) * 100),
      leverage: Math.round((leverageScore / 40) * 100),
      efficiency: Math.round((efficiencyScore / 15) * 100),
      trend: Math.round((trendScore / 15) * 100),
      risk_level: riskLevel,
    };
  }

  // Score individual ratio against norms
  private static scoreRatio(
    value: number, 
    norm: { min?: number; max?: number; optimal?: number }, 
    maxPoints: number,
    inverse: boolean = false
  ): number {
    if (inverse) {
      // For ratios where lower is better (like debt ratios)
      if (norm.max !== undefined) {
        if (value <= (norm.optimal || norm.max * 0.7)) return maxPoints;
        if (value <= norm.max) return maxPoints * 0.7;
        if (value <= norm.max * 1.3) return maxPoints * 0.4;
        return 0;
      }
    } else {
      // For ratios where higher is better
      if (norm.min !== undefined) {
        if (value >= (norm.optimal || norm.min * 1.5)) return maxPoints;
        if (value >= norm.min) return maxPoints * 0.7;
        if (value >= norm.min * 0.7) return maxPoints * 0.4;
        return 0;
      }
    }
    
    return maxPoints * 0.5; // Default if norms not properly defined
  }

  // Generate business insights
  static generateInsights(
    multiyearData: MultiyearData,
    allRatios: Record<string, FinancialRatios>,
    sector: string
  ): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];
    const years = Object.keys(multiyearData).sort();
    
    if (years.length < 2) return insights;

    const latestKey = years[years.length - 1];
    const previousKey = years[years.length - 2];
    
    const latestRatios = allRatios[latestKey];
    const previousRatios = allRatios[previousKey];

    // Profitability insights
    if (latestRatios.roe && previousRatios.roe) {
      const roeChange = latestRatios.roe - previousRatios.roe;
      if (roeChange > 2) {
        insights.push({
          category: 'profitability',
          type: 'positive',
          title: 'Amélioration de la rentabilité',
          description: `Le ROE a progressé de ${roeChange.toFixed(1)} points, indiquant une meilleure rentabilité des capitaux propres.`,
          impact: 'high',
          recommendation: 'Maintenir cette dynamique positive en optimisant davantage la structure financière.'
        });
      } else if (roeChange < -2) {
        insights.push({
          category: 'profitability',
          type: 'negative',
          title: 'Détérioration de la rentabilité',
          description: `Le ROE a diminué de ${Math.abs(roeChange).toFixed(1)} points, nécessitant une attention particulière.`,
          impact: 'high',
          recommendation: 'Analyser les causes de cette dégradation et mettre en place un plan de redressement.'
        });
      }
    }

    // Liquidity insights
    if (latestRatios.ratio_liquidite_generale) {
      if (latestRatios.ratio_liquidite_generale < 1.2) {
        insights.push({
          category: 'liquidity',
          type: 'warning',
          title: 'Liquidité insuffisante',
          description: `Le ratio de liquidité générale (${latestRatios.ratio_liquidite_generale.toFixed(2)}) est inférieur à la norme BCEAO de 1.2.`,
          impact: 'high',
          recommendation: 'Améliorer la gestion de trésorerie et réduire les dettes à court terme.'
        });
      } else if (latestRatios.ratio_liquidite_generale > 2.5) {
        insights.push({
          category: 'liquidity',
          type: 'neutral',
          title: 'Liquidité excédentaire',
          description: `Le ratio de liquidité très élevé (${latestRatios.ratio_liquidite_generale.toFixed(2)}) pourrait indiquer une sous-utilisation des ressources.`,
          impact: 'medium',
          recommendation: 'Considérer des investissements productifs pour optimiser l\'utilisation des liquidités.'
        });
      }
    }

    // Leverage insights
    if (latestRatios.ratio_autonomie_financiere) {
      if (latestRatios.ratio_autonomie_financiere < 20) {
        insights.push({
          category: 'leverage',
          type: 'warning',
          title: 'Autonomie financière faible',
          description: `L'autonomie financière (${latestRatios.ratio_autonomie_financiere.toFixed(1)}%) est insuffisante selon les normes BCEAO.`,
          impact: 'high',
          recommendation: 'Renforcer les fonds propres ou réduire l\'endettement pour améliorer la structure financière.'
        });
      }
    }

    return insights;
  }

  // Generate strategic recommendations
  static generateRecommendations(
    ratios: FinancialRatios,
    insights: AnalysisInsight[],
    sector: string
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // High priority recommendations based on critical ratios
    if (ratios.ratio_liquidite_generale && ratios.ratio_liquidite_generale < 1.2) {
      recommendations.push({
        priority: 'high',
        category: 'Liquidité',
        title: 'Améliorer la liquidité à court terme',
        description: 'Mettre en place des mesures pour améliorer la liquidité générale et respecter les normes prudentielles.',
        expected_impact: 'Réduction du risque de défaillance et amélioration de la notation financière',
        timeframe: 'immediate',
      });
    }

    if (ratios.ratio_autonomie_financiere && ratios.ratio_autonomie_financiere < 20) {
      recommendations.push({
        priority: 'high',
        category: 'Structure Financière',
        title: 'Renforcer les fonds propres',
        description: 'Augmenter le capital ou réinvestir les bénéfices pour améliorer l\'autonomie financière.',
        expected_impact: 'Amélioration de la solvabilité et de la capacité d\'endettement',
        timeframe: 'medium-term',
      });
    }

    // Medium priority recommendations
    if (ratios.roe && ratios.roe < 10) {
      recommendations.push({
        priority: 'medium',
        category: 'Rentabilité',
        title: 'Optimiser la rentabilité des capitaux propres',
        description: 'Améliorer la marge opérationnelle et optimiser l\'utilisation des actifs.',
        expected_impact: 'Augmentation de la rentabilité et de l\'attractivité pour les investisseurs',
        timeframe: 'medium-term',
      });
    }

    if (ratios.rotation_actif && ratios.rotation_actif < 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'Efficacité Opérationnelle',
        title: 'Améliorer l\'utilisation des actifs',
        description: 'Optimiser l\'utilisation des actifs pour générer plus de chiffre d\'affaires.',
        expected_impact: 'Amélioration de l\'efficacité opérationnelle et de la rentabilité',
        timeframe: 'long-term',
      });
    }

    // Low priority recommendations for optimization
    recommendations.push({
      priority: 'low',
      category: 'Surveillance Continue',
      title: 'Mettre en place un tableau de bord financier',
      description: 'Établir un suivi régulier des indicateurs clés pour anticiper les évolutions.',
      expected_impact: 'Amélioration du pilotage financier et de la prise de décision',
      timeframe: 'short-term',
    });

    return recommendations;
  }

  // Utility methods
  private static getLatestYearKey(multiyearData: MultiyearData): string {
    const years = Object.entries(multiyearData).map(([key, data]) => ({
      key,
      year: data.year
    }));
    
    years.sort((a, b) => b.year - a.year);
    return years[0].key;
  }

  // Check BCEAO compliance for all ratios
  static checkBceaoCompliance(ratios: FinancialRatios, sector: string = 'general'): BceaoCompliance[] {
    const norms = sector !== 'general' && SECTORAL_NORMS[sector] 
      ? { ...BCEAO_NORMS, ...SECTORAL_NORMS[sector] }
      : BCEAO_NORMS;

    const compliance: BceaoCompliance[] = [];

    Object.entries(ratios).forEach(([ratioName, value]) => {
      const norm = norms[ratioName as keyof typeof norms];
      if (norm && value !== undefined) {
        const result = this.evaluateCompliance(ratioName, value, norm, sector);
        compliance.push(result);
      }
    });

    return compliance.sort((a, b) => {
      const priorityOrder = { 'critical': 0, 'poor': 1, 'acceptable': 2, 'good': 3, 'excellent': 4 };
      return priorityOrder[a.status] - priorityOrder[b.status];
    });
  }

  private static evaluateCompliance(
    ratioName: string, 
    value: number, 
    norm: { min?: number; max?: number; optimal?: number },
    sector: string = 'general'
  ): BceaoCompliance {
    let isCompliant = true;
    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' = 'good';
    let recommendation: string | undefined;

    // Evaluate based on norm type
    if (norm.min !== undefined && norm.max === undefined) {
      // Minimum threshold (higher is better)
      if (value >= (norm.optimal || norm.min * 1.5)) {
        status = 'excellent';
      } else if (value >= norm.min) {
        status = 'good';
      } else if (value >= norm.min * 0.8) {
        status = 'acceptable';
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'improve');
      } else if (value >= norm.min * 0.6) {
        status = 'poor';
        isCompliant = false;
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'critical');
      } else {
        status = 'critical';
        isCompliant = false;
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'urgent');
      }
    } else if (norm.max !== undefined && norm.min === undefined) {
      // Maximum threshold (lower is better)
      if (value <= (norm.optimal || norm.max * 0.7)) {
        status = 'excellent';
      } else if (value <= norm.max) {
        status = 'good';
      } else if (value <= norm.max * 1.2) {
        status = 'acceptable';
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'reduce');
      } else if (value <= norm.max * 1.5) {
        status = 'poor';
        isCompliant = false;
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'reduce_critical');
      } else {
        status = 'critical';
        isCompliant = false;
        recommendation = this.generateSectorSpecificRecommendation(ratioName, value, norm, sector, 'reduce_urgent');
      }
    }

    return {
      ratioName,
      value,
      norm,
      isCompliant,
      status,
      recommendation,
    };
  }

  private static generateSectorSpecificRecommendation(
    ratioName: string,
    value: number,
    norm: { min?: number; max?: number; optimal?: number },
    sector: string,
    severity: 'improve' | 'critical' | 'urgent' | 'reduce' | 'reduce_critical' | 'reduce_urgent'
  ): string {
    const gap = norm.min ? (norm.min - value).toFixed(2) : norm.max ? (value - norm.max).toFixed(2) : '0';
    const targetValue = norm.optimal || norm.min || norm.max;
    
    // Sector-specific context
    const sectorContext = {
      industrie: {
        liquidite: "Dans l'industrie, optimisez la gestion des stocks et négociez de meilleurs délais de paiement fournisseurs",
        endettement: "Pour une entreprise industrielle, réduisez l'endettement en optimisant les investissements d'équipement",
        rentabilite: "Améliorez l'efficacité opérationnelle et la productivité de vos lignes de production"
      },
      commerce: {
        liquidite: "En commerce, accélérez la rotation des stocks et optimisez la gestion de trésorerie",
        endettement: "Réduisez l'endettement en améliorant le BFR et en négociant avec les fournisseurs",
        rentabilite: "Optimisez vos marges commerciales et réduisez les coûts logistiques"
      },
      services: {
        liquidite: "Dans les services, améliorez le recouvrement des créances et la facturation",
        endettement: "Privilégiez l'autofinancement et optimisez la structure de capital",
        rentabilite: "Développez la valeur ajoutée de vos services et l'efficacité des équipes"
      },
      agriculture: {
        liquidite: "En agriculture, planifiez les flux saisonniers et diversifiez les activités",
        endettement: "Optimisez les investissements agricoles et exploitez les aides sectorielles",
        rentabilite: "Améliorez les rendements et explorez la transformation des produits"
      },
      general: {
        liquidite: "Optimisez la gestion de trésorerie et améliorez le recouvrement",
        endettement: "Réduisez l'endettement et renforcez les capitaux propres",
        rentabilite: "Améliorez l'efficacité opérationnelle et contrôlez les coûts"
      }
    };

    const currentSector = sectorContext[sector as keyof typeof sectorContext] || sectorContext.general;

    // Generate specific recommendations based on ratio type
    switch (ratioName) {
      case 'ratio_liquidite_generale':
        const liquidityActions = {
          improve: `Ratio actuel: ${value.toFixed(2)}, objectif: ${targetValue}. ${currentSector.liquidite}. Réduisez les dettes à court terme de ${gap} point.`,
          critical: `Liquidité insuffisante (${value.toFixed(2)} vs ${norm.min} requis). ${currentSector.liquidite}. Action immédiate nécessaire.`,
          urgent: `Crise de liquidité critique! Négociez un étalement de dettes et mobilisez toutes les créances disponibles.`
        };
        return liquidityActions[severity as keyof typeof liquidityActions] || liquidityActions.improve;

      case 'ratio_endettement':
        const debtActions = {
          reduce: `Endettement: ${value.toFixed(1)}%, limite: ${norm.max}%. ${currentSector.endettement}. Réduisez de ${gap} points.`,
          reduce_critical: `Endettement excessif (${value.toFixed(1)}% vs ${norm.max}% max). Élaborez un plan de désendettement sur 2-3 ans.`,
          reduce_urgent: `Endettement critique! Renégociez les échéances et augmentez les capitaux propres rapidement.`
        };
        return debtActions[severity as keyof typeof debtActions] || debtActions.reduce;

      case 'roe':
        const roeActions = {
          improve: `ROE: ${value.toFixed(1)}%, objectif: ${targetValue}%. ${currentSector.rentabilite}. Améliorez de ${gap} points.`,
          critical: `Rentabilité faible (${value.toFixed(1)}% vs ${norm.min}% min). Revoyez votre stratégie commerciale et opérationnelle.`,
          urgent: `Rentabilité critique! Analysez tous les postes de coûts et repositionnez votre offre.`
        };
        return roeActions[severity as keyof typeof roeActions] || roeActions.improve;

      case 'roa':
        const roaActions = {
          improve: `ROA: ${value.toFixed(1)}%, objectif: ${targetValue}%. Optimisez l'utilisation des actifs et réduisez les immobilisations improductives.`,
          critical: `Rendement des actifs faible. Cédez les actifs non stratégiques et améliorez l'efficacité opérationnelle.`,
          urgent: `ROA critique! Restructurez le bilan et concentrez-vous sur les activités les plus rentables.`
        };
        return roaActions[severity as keyof typeof roaActions] || roaActions.improve;

      case 'ratio_autonomie_financiere':
        const autonomyActions = {
          improve: `Autonomie: ${value.toFixed(1)}%, objectif: ${targetValue}%. Renforcez les capitaux propres par mise en réserve des bénéfices.`,
          critical: `Autonomie financière insuffisante. Envisagez une augmentation de capital ou l'entrée d'investisseurs.`,
          urgent: `Dépendance financière critique! Recherchez immédiatement de nouveaux financements en fonds propres.`
        };
        return autonomyActions[severity as keyof typeof autonomyActions] || autonomyActions.improve;

      case 'ratio_liquidite_reduite':
        const quickLiquidityActions = {
          improve: `Liquidité réduite: ${value.toFixed(2)}, objectif: ${targetValue}. Accélérez le recouvrement des créances et réduisez les stocks dormants.`,
          critical: `Liquidité réduite insuffisante. Négociez des délais de paiement fournisseurs et mobilisez les créances rapidement.`,
          urgent: `Crise de liquidité! Cédez immédiatement les actifs non essentiels et négociez un découvert bancaire.`
        };
        return quickLiquidityActions[severity as keyof typeof quickLiquidityActions] || quickLiquidityActions.improve;

      case 'ratio_liquidite_immediate':
        const immediateLiquidityActions = {
          improve: `Trésorerie disponible: ${value.toFixed(2)}, objectif: ${targetValue}. Constituez une réserve de trésorerie de sécurité.`,
          critical: `Trésorerie insuffisante. Établissez un plan de trésorerie hebdomadaire et sécurisez une ligne de crédit.`,
          urgent: `Trésorerie critique! Mobilisez immédiatement tous les comptes bancaires et négociez un financement d'urgence.`
        };
        return immediateLiquidityActions[severity as keyof typeof immediateLiquidityActions] || immediateLiquidityActions.improve;

      case 'marge_nette':
        const marginActions = {
          improve: `Marge nette: ${value.toFixed(1)}%, objectif: ${targetValue}%. Révisez votre politique de prix et optimisez les coûts directs.`,
          critical: `Marge nette faible. Analysez la rentabilité par produit/service et abandonnez les activités déficitaires.`,
          urgent: `Marge critique! Augmentez immédiatement les prix ou réduisez drastiquement les coûts variables.`
        };
        return marginActions[severity as keyof typeof marginActions] || marginActions.improve;

      case 'ratio_couverture_dettes':
        const coverageActions = {
          improve: `Couverture des dettes: ${value.toFixed(2)}, objectif: ${targetValue}. Améliorez la génération de cash-flow opérationnel.`,
          critical: `Capacité de remboursement insuffisante. Renégociez l'échéancier des dettes et augmentez la rentabilité.`,
          urgent: `Couverture critique! Suspendez les investissements non essentiels et maximisez la génération de liquidités.`
        };
        return coverageActions[severity as keyof typeof coverageActions] || coverageActions.improve;

      case 'rotation_actif':
        const assetTurnoverActions = {
          improve: `Rotation de l'actif: ${value.toFixed(2)}, objectif: ${targetValue}. Optimisez l'utilisation des actifs et cédez les immobilisations improductives.`,
          critical: `Efficacité des actifs faible. Restructurez le bilan et concentrez-vous sur les actifs générateurs de revenus.`,
          urgent: `Rotation critique! Cédez immédiatement les actifs non stratégiques et externalisez les fonctions non critiques.`
        };
        return assetTurnoverActions[severity as keyof typeof assetTurnoverActions] || assetTurnoverActions.improve;

      default:
        return `Ratio ${ratioName}: ${value.toFixed(2)}, objectif: ${targetValue}. Analysez les causes de l'écart et mettez en place un plan d'action adapté à votre secteur (${sector}).`;
    }
  }
}

export default FinancialCalculator;