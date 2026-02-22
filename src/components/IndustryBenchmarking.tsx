import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Avatar,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CompareArrows as CompareIcon,
  Business as IndustryIcon,
  Assessment as BenchmarkIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface BenchmarkData {
  ratio: string;
  clientValue: number;
  industryMedian: number;
  industryQ1: number;
  industryQ3: number;
  percentile: number;
  status: 'excellent' | 'above_average' | 'average' | 'below_average' | 'poor';
  trend: 'improving' | 'stable' | 'declining';
}

interface IndustryBenchmarkingProps {
  clientIndustry?: string;
  clientData?: any;
}

const industryBenchmarks: Record<string, BenchmarkData[]> = {
  'Agriculture et Agrobusiness': [
    {
      ratio: 'Ratio de Liquidité Générale',
      clientValue: 1.85,
      industryMedian: 1.6,
      industryQ1: 1.3,
      industryQ3: 2.1,
      percentile: 65,
      status: 'above_average',
      trend: 'stable'
    },
    {
      ratio: 'Rentabilité (ROE)',
      clientValue: 12.5,
      industryMedian: 15.2,
      industryQ1: 8.5,
      industryQ3: 22.8,
      percentile: 45,
      status: 'below_average',
      trend: 'declining'
    },
    {
      ratio: 'Ratio d\'Endettement',
      clientValue: 65.2,
      industryMedian: 58.0,
      industryQ1: 42.0,
      industryQ3: 72.0,
      percentile: 25,
      status: 'below_average',
      trend: 'stable'
    },
    {
      ratio: 'Rotation des Actifs',
      clientValue: 2.1,
      industryMedian: 1.8,
      industryQ1: 1.2,
      industryQ3: 2.4,
      percentile: 70,
      status: 'above_average',
      trend: 'improving'
    },
  ],
  'Technologie et Innovation': [
    {
      ratio: 'Ratio de Liquidité Générale',
      clientValue: 1.85,
      industryMedian: 2.2,
      industryQ1: 1.8,
      industryQ3: 2.8,
      percentile: 35,
      status: 'below_average',
      trend: 'stable'
    },
    {
      ratio: 'Rentabilité (ROE)',
      clientValue: 12.5,
      industryMedian: 18.5,
      industryQ1: 12.0,
      industryQ3: 28.0,
      percentile: 50,
      status: 'average',
      trend: 'improving'
    },
    {
      ratio: 'Ratio d\'Endettement',
      clientValue: 65.2,
      industryMedian: 45.0,
      industryQ1: 30.0,
      industryQ3: 60.0,
      percentile: 15,
      status: 'poor',
      trend: 'declining'
    },
    {
      ratio: 'Rotation des Actifs',
      clientValue: 2.1,
      industryMedian: 2.5,
      industryQ1: 1.8,
      industryQ3: 3.2,
      percentile: 45,
      status: 'below_average',
      trend: 'stable'
    },
  ],
};

export const IndustryBenchmarking: React.FC<IndustryBenchmarkingProps> = ({
  clientIndustry = 'Agriculture et Agrobusiness',
  clientData
}) => {
  const { t } = useTranslation();
  const [selectedIndustry, setSelectedIndustry] = useState(clientIndustry);

  const currentBenchmarks = industryBenchmarks[selectedIndustry] || industryBenchmarks['Agriculture et Agrobusiness'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'success';
      case 'above_average': return 'info';
      case 'average': return 'primary';
      case 'below_average': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent': return 'Excellent';
      case 'above_average': return 'Au-dessus de la moyenne';
      case 'average': return 'Dans la moyenne';
      case 'below_average': return 'En-dessous de la moyenne';
      case 'poor': return 'Faible';
      default: return 'Non défini';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUpIcon color="success" fontSize="small" />;
      case 'declining': return <TrendingDownIcon color="error" fontSize="small" />;
      case 'stable': return <CompareIcon color="info" fontSize="small" />;
      default: return null;
    }
  };

  const calculateOverallPerformance = () => {
    const avgPercentile = currentBenchmarks.reduce((sum, item) => sum + item.percentile, 0) / currentBenchmarks.length;
    return Math.round(avgPercentile);
  };

  const getPerformanceCategory = (percentile: number) => {
    if (percentile >= 80) return { label: 'Performance Excellente', color: 'success' as const };
    if (percentile >= 60) return { label: 'Performance Au-dessus de la Moyenne', color: 'info' as const };
    if (percentile >= 40) return { label: 'Performance Moyenne', color: 'primary' as const };
    if (percentile >= 20) return { label: 'Performance En-dessous de la Moyenne', color: 'warning' as const };
    return { label: 'Performance Faible', color: 'error' as const };
  };

  const overallPerformance = calculateOverallPerformance();
  const performanceCategory = getPerformanceCategory(overallPerformance);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <BenchmarkIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {t('analysis.benchmarking.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comparaison avec les standards sectoriels
            </Typography>
          </Box>
        </Box>

        <FormControl sx={{ minWidth: 250 }}>
          <InputLabel>Secteur de Comparaison</InputLabel>
          <Select
            value={selectedIndustry}
            label="Secteur de Comparaison"
            onChange={(e) => setSelectedIndustry(e.target.value)}
          >
            <MenuItem value="Agriculture et Agrobusiness">Agriculture et Agrobusiness</MenuItem>
            <MenuItem value="Technologie et Innovation">Technologie et Innovation</MenuItem>
            <MenuItem value="Commerce et Distribution">Commerce et Distribution</MenuItem>
            <MenuItem value="Services et Professionnel">Services et Professionnel</MenuItem>
            <MenuItem value="Manufacture et Industrie">Manufacture et Industrie</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Overall Performance Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ 
                width: 80, 
                height: 80, 
                mx: 'auto', 
                mb: 2,
                bgcolor: performanceCategory.color === 'success' ? 'success.main' : 
                         performanceCategory.color === 'info' ? 'info.main' :
                         performanceCategory.color === 'warning' ? 'warning.main' :
                         performanceCategory.color === 'error' ? 'error.main' : 'primary.main'
              }}>
                <Typography variant="h4" color="white" sx={{ fontWeight: 700 }}>
                  {overallPerformance}
                </Typography>
              </Avatar>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Performance Globale
              </Typography>
              <Chip 
                label={performanceCategory.label}
                color={performanceCategory.color}
                sx={{ fontWeight: 600 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Position dans le Secteur
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Percentile: {overallPerformance}e (sur 100 entreprises du secteur)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={overallPerformance}
                  color={performanceCategory.color}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              
              <Alert 
                severity={performanceCategory.color === 'success' || performanceCategory.color === 'info' ? 'success' : 
                          performanceCategory.color === 'warning' ? 'warning' : 'error'}
                sx={{ mt: 2 }}
              >
                <Typography variant="body2">
                  {overallPerformance >= 60 
                    ? `Votre entreprise performe mieux que ${overallPerformance}% des entreprises du secteur ${selectedIndustry}.`
                    : overallPerformance >= 40
                    ? `Votre entreprise a une performance moyenne dans le secteur ${selectedIndustry}.`
                    : `Des améliorations sont nécessaires pour atteindre la performance moyenne du secteur ${selectedIndustry}.`
                  }
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Benchmarking Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Analyse Détaillée par Ratio
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ratio Financier</TableCell>
                  <TableCell align="center">Valeur Client</TableCell>
                  <TableCell align="center">Médiane Secteur</TableCell>
                  <TableCell align="center">Q1 - Q3</TableCell>
                  <TableCell align="center">Percentile</TableCell>
                  <TableCell align="center">Performance</TableCell>
                  <TableCell align="center">Tendance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentBenchmarks.map((benchmark, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {benchmark.ratio}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: benchmark.clientValue > benchmark.industryMedian ? 'success.main' : 'error.main'
                        }}
                      >
                        {benchmark.clientValue}%
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {benchmark.industryMedian}%
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {benchmark.industryQ1}% - {benchmark.industryQ3}%
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
                          {benchmark.percentile}e
                        </Typography>
                        <Box sx={{ width: 60 }}>
                          <LinearProgress
                            variant="determinate"
                            value={benchmark.percentile}
                            color={getStatusColor(benchmark.status) as any}
                            sx={{ height: 4, borderRadius: 2 }}
                          />
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(benchmark.status)}
                        color={getStatusColor(benchmark.status) as any}
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    
                    <TableCell align="center">
                      {getTrendIcon(benchmark.trend)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Peer Comparison Insights */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
                Points Forts Relatifs
              </Typography>
              {currentBenchmarks
                .filter(b => b.percentile >= 60)
                .map((benchmark, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon color="success" fontSize="small" sx={{ mr: 1 }} />
                    <Typography variant="body2">
                      <strong>{benchmark.ratio}</strong>: {benchmark.percentile}e percentile
                    </Typography>
                  </Box>
                ))
              }
              {currentBenchmarks.filter(b => b.percentile >= 60).length === 0 && (
                <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic' }}>
                  Aucun ratio n'excède la performance médiane du secteur
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'warning.main' }}>
                Axes d'Amélioration
              </Typography>
              {currentBenchmarks
                .filter(b => b.percentile < 50)
                .map((benchmark, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingDownIcon color="warning" fontSize="small" sx={{ mr: 1 }} />
                    <Typography variant="body2">
                      <strong>{benchmark.ratio}</strong>: {benchmark.percentile}e percentile
                    </Typography>
                  </Box>
                ))
              }
              {currentBenchmarks.filter(b => b.percentile < 50).length === 0 && (
                <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic' }}>
                  Toutes les performances sont au-dessus de la médiane
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};