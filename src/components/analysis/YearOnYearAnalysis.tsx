import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Analytics as AnalyticsIcon,
  Compare as CompareIcon,
} from '@mui/icons-material';
import { MultiyearData } from '../../types';
import { bankingColors } from '../../theme/theme';
import numeral from 'numeral';

interface YearOnYearAnalysisProps {
  multiyearData: MultiyearData;
}

interface VariationAnalysis {
  field: string;
  label: string;
  values: Array<{ year: number; value: number }>;
  variations: Array<{ fromYear: number; toYear: number; change: number; percentage: number }>;
  trend: 'upward' | 'downward' | 'stable' | 'volatile';
  avgGrowthRate: number;
  category: 'balance' | 'income' | 'ratios' | 'cash';
}

// Key financial indicators to analyze
const analysisFields = [
  // Balance Sheet
  { key: 'total_actif', label: 'Total Actif', category: 'balance' as const },
  { key: 'capitaux_propres', label: 'Capitaux Propres', category: 'balance' as const },
  { key: 'total_actif_circulant', label: 'Actif Circulant', category: 'balance' as const },
  { key: 'tresorerie_actif', label: 'Trésorerie Actif', category: 'balance' as const },
  { key: 'dettes_financieres', label: 'Dettes Financières', category: 'balance' as const },
  { key: 'total_dettes', label: 'Passif Circulant', category: 'balance' as const },
  
  // Income Statement
  { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires', category: 'income' as const },
  { key: 'valeur_ajoutee', label: 'Valeur Ajoutée', category: 'income' as const },
  { key: 'excedent_brut_exploitation', label: 'EBE', category: 'income' as const },
  { key: 'resultat_exploitation', label: 'Résultat d\'Exploitation', category: 'income' as const },
  { key: 'resultat_net', label: 'Résultat Net', category: 'income' as const },
  
  // Cash Flow Statement
  { key: 'flux_tresorerie_activites_operationnelles', label: 'Flux Trésorerie Opérationnel', category: 'cash' as const },
  { key: 'flux_tresorerie_activites_investissement', label: 'Flux Trésorerie Investissement', category: 'cash' as const },
  { key: 'flux_tresorerie_activites_financement', label: 'Flux Trésorerie Financement', category: 'cash' as const },
  { key: 'variation_tresorerie', label: 'Variation de Trésorerie', category: 'cash' as const },
  
  // Financial Ratios
  { key: 'roe', label: 'ROE (%)', category: 'ratios' as const },
  { key: 'roa', label: 'ROA (%)', category: 'ratios' as const },
  { key: 'ratio_liquidite_generale', label: 'Ratio de Liquidité', category: 'ratios' as const },
  { key: 'ratio_autonomie_financiere', label: 'Autonomie Financière (%)', category: 'ratios' as const },
  { key: 'ratio_endettement', label: 'Ratio d\'Endettement (%)', category: 'ratios' as const },
];

const formatCurrency = (value: number): string => {
  return `${numeral(value).format('0,0')} FCFA`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value: number): string => {
  return numeral(value).format('0,0.00');
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'upward': return <TrendingUpIcon sx={{ color: bankingColors.positive }} />;
    case 'downward': return <TrendingDownIcon sx={{ color: bankingColors.negative }} />;
    case 'stable': return <TrendingFlatIcon sx={{ color: bankingColors.neutral }} />;
    default: return <AnalyticsIcon sx={{ color: bankingColors.warning }} />;
  }
};

const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'upward': return bankingColors.positive;
    case 'downward': return bankingColors.negative;
    case 'stable': return bankingColors.neutral;
    default: return bankingColors.warning;
  }
};

const getVariationColor = (percentage: number): string => {
  if (Math.abs(percentage) < 5) return bankingColors.neutral;
  return percentage > 0 ? bankingColors.positive : bankingColors.negative;
};

const analyzeTrend = (variations: Array<{ percentage: number }>): 'upward' | 'downward' | 'stable' | 'volatile' => {
  if (variations.length === 0) return 'stable';
  
  const positiveChanges = variations.filter(v => v.percentage > 5).length;
  const negativeChanges = variations.filter(v => v.percentage < -5).length;
  const stableChanges = variations.filter(v => Math.abs(v.percentage) <= 5).length;
  
  if (positiveChanges > negativeChanges && positiveChanges > stableChanges) return 'upward';
  if (negativeChanges > positiveChanges && negativeChanges > stableChanges) return 'downward';
  if (stableChanges > positiveChanges && stableChanges > negativeChanges) return 'stable';
  return 'volatile';
};

export const YearOnYearAnalysis: React.FC<YearOnYearAnalysisProps> = ({ multiyearData }) => {
  // Sort years chronologically
  const sortedYears = Object.entries(multiyearData)
    .map(([key, value]) => ({ key, year: value.year, data: value }))
    .sort((a, b) => a.year - b.year);

  if (sortedYears.length < 2) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        L'analyse des variations année sur année nécessite au moins deux années de données.
      </Alert>
    );
  }

  // Analyze each field
  const variationAnalyses: VariationAnalysis[] = analysisFields.map(field => {
    const values = sortedYears.map(({ year, data }) => {
      const fieldValue = (data.data as any)[field.key] || (data.ratios as any)?.[field.key] || 0;
      return {
        year,
        value: Number(fieldValue)
      };
    });

    const variations: Array<{ fromYear: number; toYear: number; change: number; percentage: number }> = [];
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const change = curr.value - prev.value;
      const percentage = prev.value !== 0 ? (change / prev.value) * 100 : 0;
      variations.push({
        fromYear: prev.year,
        toYear: curr.year,
        change,
        percentage
      });
    }

    const trend = analyzeTrend(variations);
    const avgGrowthRate = variations.length > 0 
      ? variations.reduce((sum, v) => sum + v.percentage, 0) / variations.length 
      : 0;

    return {
      field: field.key,
      label: field.label,
      values,
      variations,
      trend,
      avgGrowthRate,
      category: field.category
    };
  }).filter(analysis => analysis.values.some(v => v.value !== 0)); // Filter out fields with no data

  // Group by category
  const groupedAnalyses = {
    balance: variationAnalyses.filter(a => a.category === 'balance'),
    income: variationAnalyses.filter(a => a.category === 'income'),
    cash: variationAnalyses.filter(a => a.category === 'cash'),
    ratios: variationAnalyses.filter(a => a.category === 'ratios'),
  };

  // Summary statistics
  const totalFields = variationAnalyses.length;
  const improvingFields = variationAnalyses.filter(a => a.avgGrowthRate > 0).length;
  const decliningFields = variationAnalyses.filter(a => a.avgGrowthRate < 0).length;
  const stableFields = totalFields - improvingFields - decliningFields;

  return (
    <Box>
      {/* Summary Overview */}
      <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CompareIcon sx={{ mr: 1, fontSize: '2rem', color: 'white' }} />
            <Typography variant="h5" fontWeight={600} sx={{ color: 'white' }}>
              Analyse des Variations Année sur Année
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={600} sx={{ color: 'white' }}>
                  {totalFields}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                  Indicateurs Analysés
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={600} sx={{ color: '#4caf50' }}>
                  {improvingFields}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                  En Amélioration
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={600} sx={{ color: '#f44336' }}>
                  {decliningFields}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                  En Dégradation
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={600} sx={{ color: '#ffffff' }}>
                  {stableFields}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                  Stables
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Detailed Analysis by Category */}
      {Object.entries(groupedAnalyses).map(([category, analyses]) => {
        if (analyses.length === 0) return null;
        
        const categoryTitle = {
          balance: 'Bilan - Structure Financière',
          income: 'Compte de Résultat - Performance',
          cash: 'Tableau de Flux de Trésorerie',
          ratios: 'Ratios - Indicateurs Clés'
        }[category];

        return (
          <Card key={category} sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
                {categoryTitle}
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                    <TableRow>
                      <TableCell><strong>Indicateur</strong></TableCell>
                      {sortedYears.map(({ year }) => (
                        <TableCell key={year} align="center"><strong>{year}</strong></TableCell>
                      ))}
                      <TableCell align="center"><strong>Tendance</strong></TableCell>
                      <TableCell align="center"><strong>Croissance Moyenne</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyses.map((analysis) => (
                      <TableRow key={analysis.field} hover>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {analysis.label}
                        </TableCell>
                        {analysis.values.map(({ year, value }, index) => {
                          const variation = index > 0 ? analysis.variations[index - 1] : null;
                          return (
                            <TableCell key={year} align="center">
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {category === 'ratios' 
                                    ? (analysis.field.includes('ratio_') && !analysis.field.includes('autonomie') && !analysis.field.includes('endettement'))
                                      ? formatNumber(value)
                                      : formatPercentage(value)
                                    : formatCurrency(value)
                                  }
                                </Typography>
                                {variation && (
                                  <Chip
                                    size="small"
                                    label={`${variation.percentage >= 0 ? '+' : ''}${variation.percentage.toFixed(1)}%`}
                                    sx={{
                                      mt: 0.5,
                                      fontSize: '0.7rem',
                                      height: '20px',
                                      bgcolor: getVariationColor(variation.percentage),
                                      color: 'white'
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                          );
                        })}
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getTrendIcon(analysis.trend)}
                            <Chip
                              size="small"
                              label={analysis.trend === 'upward' ? 'Hausse' : 
                                    analysis.trend === 'downward' ? 'Baisse' :
                                    analysis.trend === 'stable' ? 'Stable' : 'Volatil'}
                              sx={{
                                ml: 1,
                                bgcolor: getTrendColor(analysis.trend),
                                color: 'white',
                                fontSize: '0.7rem'
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box>
                            <Typography 
                              variant="body2" 
                              fontWeight={600}
                              sx={{ color: getVariationColor(analysis.avgGrowthRate) }}
                            >
                              {analysis.avgGrowthRate >= 0 ? '+' : ''}{analysis.avgGrowthRate.toFixed(1)}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(Math.abs(analysis.avgGrowthRate), 100)}
                              sx={{
                                mt: 0.5,
                                height: 4,
                                borderRadius: 2,
                                bgcolor: 'rgba(0,0,0,0.1)',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: getVariationColor(analysis.avgGrowthRate),
                                },
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        );
      })}

      {/* Key Insights */}
      <Card sx={{ bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
            Points Clés de l'Analyse
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} color="success.main" gutterBottom>
                ✅ Évolutions Positives
              </Typography>
              <Box sx={{ pl: 2 }}>
                {variationAnalyses
                  .filter(a => a.avgGrowthRate > 5)
                  .slice(0, 5)
                  .map(analysis => (
                    <Typography key={analysis.field} variant="body2" paragraph>
                      • <strong>{analysis.label}</strong>: +{analysis.avgGrowthRate.toFixed(1)}% en moyenne
                    </Typography>
                  ))
                }
                {variationAnalyses.filter(a => a.avgGrowthRate > 5).length === 0 && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Aucune évolution fortement positive détectée
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} color="error.main" gutterBottom>
                ⚠️ Points d'Attention
              </Typography>
              <Box sx={{ pl: 2 }}>
                {variationAnalyses
                  .filter(a => a.avgGrowthRate < -5)
                  .slice(0, 5)
                  .map(analysis => (
                    <Typography key={analysis.field} variant="body2" paragraph>
                      • <strong>{analysis.label}</strong>: {analysis.avgGrowthRate.toFixed(1)}% en moyenne
                    </Typography>
                  ))
                }
                {variationAnalyses.filter(a => a.avgGrowthRate < -5).length === 0 && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Aucune dégradation significative détectée
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};