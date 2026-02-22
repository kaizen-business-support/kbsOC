import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  Avatar,
  LinearProgress,
  Button,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  AccountBalance as AccountBalanceIcon,
  ShowChart as ShowChartIcon,
} from '@mui/icons-material';
import { FinancialTable } from '../components/FinancialTable';
import { FinancialCharts } from '../components/charts/FinancialCharts';
import { BceaoCompliancePanel } from '../components/compliance/BceaoCompliancePanel';
import { YearOnYearAnalysis } from '../components/analysis/YearOnYearAnalysis';
import { PageType } from '../types';
import { useApp } from '../contexts/AppContext';
import { bankingColors } from '../theme/theme';

interface AnalysisPageProps {
  onNavigate: (page: PageType) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

// Financial statement fields - Updated to match ExcelProcessor field names
const balanceSheetFields = [
  { key: 'total_actif', label: 'Total Actif', format: 'currency' as const },
  { key: 'total_actif_immobilise', label: 'Actif Immobilisé', format: 'currency' as const },
  { key: 'total_actif_circulant', label: 'Actif Circulant', format: 'currency' as const },
  { key: 'tresorerie_actif', label: 'Trésorerie Actif', format: 'currency' as const },
  { key: 'capitaux_propres', label: 'Capitaux Propres', format: 'currency' as const },
  { key: 'dettes_financieres', label: 'Dettes Financières', format: 'currency' as const },
  { key: 'total_dettes', label: 'Passif Circulant', format: 'currency' as const },
];

const incomeStatementFields = [
  { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires', format: 'currency' as const },
  { key: 'total_produits_exploitation', label: 'Total Produits d\'Exploitation', format: 'currency' as const },
  { key: 'total_charges_exploitation', label: 'Total Charges d\'Exploitation', format: 'currency' as const },
  { key: 'resultat_exploitation', label: 'Résultat d\'Exploitation', format: 'currency' as const },
  { key: 'resultat_financier', label: 'Résultat Financier', format: 'currency' as const },
  { key: 'resultat_courant', label: 'Résultat Courant', format: 'currency' as const },
  { key: 'resultat_net', label: 'Résultat Net', format: 'currency' as const },
];

const cashFlowFields = [
  { key: 'tresorerie_debut_periode', label: 'Trésorerie Début de Période', format: 'currency' as const },
  { key: 'flux_tresorerie_activites_operationnelles', label: 'Flux de Trésorerie - Activités Opérationnelles', format: 'currency' as const },
  { key: 'flux_tresorerie_activites_investissement', label: 'Flux de Trésorerie - Activités d\'Investissement', format: 'currency' as const },
  { key: 'flux_tresorerie_activites_financement', label: 'Flux de Trésorerie - Activités de Financement', format: 'currency' as const },
  { key: 'spacer1', label: '', format: 'spacer' as const },
  { key: 'variation_tresorerie', label: 'Variation de Trésorerie', format: 'currency' as const },
  { key: 'spacer2', label: '', format: 'spacer' as const },
  { key: 'tresorerie_fin_periode', label: 'Trésorerie Fin de Période', format: 'currency' as const },
];

const ratiosFields = [
  { key: 'roe', label: 'ROE (%)', format: 'percentage' as const },
  { key: 'roa', label: 'ROA (%)', format: 'percentage' as const },
  { key: 'ratio_liquidite_generale', label: 'Ratio de Liquidité Générale', format: 'number' as const },
  { key: 'ratio_endettement', label: 'Ratio d\'Endettement (%)', format: 'percentage' as const },
];

const getRiskColor = (riskLevel: string): string => {
  switch (riskLevel) {
    case 'low': return bankingColors.lowRisk;
    case 'medium': return bankingColors.mediumRisk;
    case 'high': return bankingColors.highRisk;
    case 'critical': return bankingColors.poor;
    default: return bankingColors.neutral;
  }
};

const getRiskLabel = (riskLevel: string): string => {
  switch (riskLevel) {
    case 'low': return 'Faible';
    case 'medium': return 'Moyen';
    case 'high': return 'Élevé';
    case 'critical': return 'Critique';
    default: return 'Non défini';
  }
};


export const AnalysisPage: React.FC<AnalysisPageProps> = ({ onNavigate }) => {
  const { state } = useApp();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Check both old analysis data and new collected data
  let analysisData = state.analysisData;
  let multiyearData: any = {};
  let score: any = null;
  let config: any = null;

  // Try to load from the new workflow data first
  const collectedDataStr = localStorage.getItem('optimus_collected_data');
  console.log('AnalysisPage - collectedDataStr:', collectedDataStr);
  
  if (collectedDataStr) {
    const collectedData = JSON.parse(collectedDataStr);
    console.log('AnalysisPage - parsed collectedData:', collectedData);
    
    // Debug cash flow and charges data specifically
    console.log('AnalysisPage - Debugging financial data:');
    console.log('AnalysisPage - Full collected data structure:', JSON.stringify(collectedData, null, 2));
    
    Object.entries(collectedData.multiyear_data || {}).forEach(([yearKey, yearData]: [string, any]) => {
      console.log(`\n=== AnalysisPage - Year ${yearKey} (${yearData.year}) COMPLETE DATA ===`);
      console.log('Raw yearData.data:', yearData.data);
      
      // Check ALL fields in the data to see what's actually there
      const allFields = Object.keys(yearData.data || {});
      console.log(`AnalysisPage - All available fields for ${yearKey}:`, allFields);
      
      // Check specifically for TFT-related field patterns
      const tftRelatedFields = allFields.filter(field => 
        field.includes('tresorerie') || 
        field.includes('flux') || 
        field.includes('variation')
      );
      console.log(`AnalysisPage - TFT-related fields for ${yearKey}:`, tftRelatedFields);
      
      // Log specific cash flow field values
      console.log(`AnalysisPage - Cash flow data for ${yearKey}:`, {
        // Expected field names
        tresorerie_debut_periode: yearData.data.tresorerie_debut_periode,
        flux_tresorerie_activites_operationnelles: yearData.data.flux_tresorerie_activites_operationnelles,
        flux_tresorerie_activites_investissement: yearData.data.flux_tresorerie_activites_investissement,
        flux_tresorerie_activites_financement: yearData.data.flux_tresorerie_activites_financement,
        variation_tresorerie: yearData.data.variation_tresorerie,
        tresorerie_fin_periode: yearData.data.tresorerie_fin_periode,
        // Check if any alternative field names exist
        tresorerie_debut: yearData.data.tresorerie_debut,
        flux_operationnels_total: yearData.data.flux_operationnels_total,
        flux_investissements_total: yearData.data.flux_investissements_total,
        flux_financement_total: yearData.data.flux_financement_total,
        tresorerie_fin: yearData.data.tresorerie_fin
      });
      
      // Also check charges data
      console.log(`AnalysisPage - Charges data for ${yearKey}:`, {
        total_produits_exploitation: yearData.data.total_produits_exploitation,
        total_charges_exploitation: yearData.data.total_charges_exploitation,
        resultat_exploitation: yearData.data.resultat_exploitation,
        chiffre_affaires: yearData.data.chiffre_affaires
      });
    });
    config = collectedData.config;
    
    // Use the pre-transformed multiyear_data if available, otherwise transform yearData
    if (collectedData.multiyear_data) {
      multiyearData = collectedData.multiyear_data;
      console.log('AnalysisPage - using pre-transformed multiyear_data:', multiyearData);
    } else {
      // Fallback to transformation for backward compatibility
      console.log('AnalysisPage - using fallback transformation from yearData:', collectedData.yearData);
      multiyearData = {};
      Object.entries(collectedData.yearData || {}).forEach(([year, data]: [string, any]) => {
        const yearNum = parseInt(year);
        const yearKey = yearNum === config?.referenceYear ? 'N' : 
                       yearNum === config?.referenceYear - 1 ? 'N-1' :
                       yearNum === config?.referenceYear - 2 ? 'N-2' : 
                       `N-${config?.referenceYear - yearNum}`;
        
        multiyearData[yearKey] = {
          year: yearNum,
          data: data.data || data,
          ratios: data.ratios || {}
        };
      });
    }
    
    // Create analysis data structure with calculated data
    analysisData = {
      multiyear_data: multiyearData,
      score: collectedData.score || score,
      insights: collectedData.insights || [],
      recommendations: collectedData.recommendations || []
    };
    
    console.log('AnalysisPage - final analysisData:', analysisData);
    console.log('AnalysisPage - final multiyearData:', multiyearData);
  }

  // Fallback to old data structure
  if (!analysisData && state.analysisData) {
    analysisData = state.analysisData;
    multiyearData = analysisData.multiyear_data || analysisData.data?.multiyear_data || {};
    score = analysisData.score;
  }


  if (!analysisData || Object.keys(multiyearData).length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" gutterBottom>
          Aucune donnée d'analyse disponible
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Veuillez d'abord configurer et saisir vos données financières.
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => onNavigate('data-input')}
          sx={{ mt: 2 }}
        >
          Commencer une Nouvelle Analyse
        </Button>
      </Box>
    );
  }

  // Get period information
  const years = Object.values(multiyearData).map((d: any) => d.year).sort((a, b) => a - b);
  const periodText = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : years[0]?.toString() || '';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          Analyse Financière Détaillée
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Période d'analyse : {periodText} ({years.length} année{years.length > 1 ? 's' : ''})
        </Typography>
      </Box>

      {/* Score Overview */}
      {score && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)', color: 'white' }}>
          <CardContent sx={{ py: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      mx: 'auto',
                      mb: 2,
                      fontSize: '1.5rem',
                      fontWeight: 600,
                    }}
                  >
                    {score.overall}
                  </Avatar>
                  <Typography variant="h6" fontWeight={600}>
                    Score Global
                  </Typography>
                  <Chip
                    label={getRiskLabel(score.risk_level)}
                    sx={{
                      bgcolor: getRiskColor(score.risk_level),
                      color: 'white',
                      fontWeight: 600,
                      mt: 1,
                    }}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} md={9}>
                <Grid container spacing={2}>
                  {[
                    { key: 'profitability', label: 'Rentabilité', icon: <TrendingUpIcon /> },
                    { key: 'liquidity', label: 'Liquidité', icon: <AccountBalanceIcon /> },
                    { key: 'leverage', label: 'Endettement', icon: <SecurityIcon /> },
                    { key: 'efficiency', label: 'Efficacité', icon: <SpeedIcon /> },
                    { key: 'trend', label: 'Tendance', icon: <ShowChartIcon /> },
                  ].map((item) => {
                    const scoreValue = score[item.key as keyof typeof score] as number;
                    return (
                      <Grid item xs={6} sm={4} md={2.4} key={item.key}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                            {item.icon}
                            <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                              {scoreValue}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {item.label}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={scoreValue}
                            sx={{
                              mt: 1,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: 'rgba(255,255,255,0.3)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: 'white',
                              },
                            }}
                          />
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
            },
          }}
        >
          <Tab label="États Financiers" />
          <Tab label="Ratios Détaillés" />
          <Tab label="Évolution & Tendances" />
          <Tab label="Conformité BCEAO" />
          <Tab label="Recommandations" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <FinancialTable
            title="Bilan - Actifs et Passifs"
            data={multiyearData}
            fields={balanceSheetFields}
            showProgression={true}
          />
          
          <FinancialTable
            title="Compte de Résultat"
            data={multiyearData}
            fields={incomeStatementFields}
            showProgression={true}
          />

          <FinancialTable
            title="Tableau de Flux de Trésorerie"
            data={multiyearData}
            fields={cashFlowFields}
            showProgression={true}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <FinancialTable
            title="Ratios de Performance"
            data={multiyearData}
            fields={ratiosFields}
            showProgression={true}
          />
          
          {/* BCEAO Compliance */}
          <Card sx={{ mt: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📊 Conformité BCEAO
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Comparaison avec les normes de la Banque Centrale des États de l'Afrique de l'Ouest
            </Typography>
            
            <Grid container spacing={2}>
              {[
                { label: 'ROE', value: '16.4%', norm: '> 15%', status: 'good' },
                { label: 'Ratio de Liquidité', value: '1.8', norm: '> 1.2', status: 'good' },
                { label: 'Ratio d\'Endettement', value: '56%', norm: '< 60%', status: 'good' },
                { label: 'ROA', value: '7.2%', norm: '> 5%', status: 'good' },
              ].map((item) => (
                <Grid item xs={6} md={3} key={item.label}>
                  <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {item.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ color: 'success.main' }}>
                      {item.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Norme: {item.norm}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label="Conforme"
                        color="success"
                        size="small"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <YearOnYearAnalysis multiyearData={multiyearData} />
          
          <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
            📈 Visualisations Graphiques
          </Typography>
          
          <FinancialCharts 
            multiyearData={multiyearData} 
            score={score}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <BceaoCompliancePanel 
            multiyearData={multiyearData}
            sector={state.sector}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            💡 Recommandations Stratégiques
          </Typography>
          
          <Card sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'success.main', bgcolor: 'success.50' }}>
            <Typography variant="subtitle1" fontWeight={600} color="success.dark" gutterBottom>
              ✅ Points Forts
            </Typography>
            <ul>
              <li>Croissance régulière du chiffre d'affaires (+9.1% en moyenne)</li>
              <li>Amélioration de la rentabilité (ROE passant de 15% à 16.4%)</li>
              <li>Réduction progressive de l'endettement</li>
              <li>Liquidité satisfaisante et en amélioration</li>
            </ul>
          </Card>

          <Card sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'warning.main', bgcolor: 'warning.50' }}>
            <Typography variant="subtitle1" fontWeight={600} color="warning.dark" gutterBottom>
              ⚠️ Points d'Attention
            </Typography>
            <ul>
              <li>Surveiller l'évolution des charges d'exploitation</li>
              <li>Optimiser la gestion des stocks si applicable</li>
              <li>Maintenir le niveau de liquidité actuel</li>
            </ul>
          </Card>

          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              🎯 Plan d'Action Recommandé
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Court terme (3-6 mois)
              </Typography>
              <ul>
                <li>Maintenir la dynamique de croissance actuelle</li>
                <li>Optimiser la structure des coûts</li>
                <li>Renforcer le suivi de trésorerie</li>
              </ul>
              
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                Moyen terme (6-12 mois)
              </Typography>
              <ul>
                <li>Évaluer les opportunités d'investissement</li>
                <li>Consolider la position concurrentielle</li>
                <li>Développer de nouveaux marchés</li>
              </ul>
            </Box>
          </Card>
        </TabPanel>
      </Card>

      {/* Action Buttons */}
      <Card sx={{ mt: 4, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Actions Disponibles
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => onNavigate('reports')}
              startIcon={<AssessmentIcon />}
              sx={{ 
                px: 4, 
                py: 1.5,
                minWidth: '200px',
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              Générer un Rapport
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => onNavigate('data-input')}
              sx={{ 
                px: 4, 
                py: 1.5,
                minWidth: '200px',
                fontSize: '1.1rem',
                fontWeight: 600,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Nouvelle Analyse
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Générez un rapport professionnel ou commencez une nouvelle analyse financière
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};