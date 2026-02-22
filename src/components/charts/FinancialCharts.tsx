import React from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MultiyearData, AnalysisScore } from '../../types';
import numeral from 'numeral';

interface FinancialChartsProps {
  multiyearData: MultiyearData;
  score?: AnalysisScore;
}

// Custom tooltip formatter
const formatTooltip = (value: any, name: string) => {
  if (typeof value === 'number') {
    if (name.includes('%') || name.includes('Ratio')) {
      return [`${value.toFixed(2)}%`, name];
    }
    return [`${numeral(value).format('0,0')} FCFA`, name];
  }
  return [value, name];
};

// Custom label formatter for years
const labelFormatter = (label: any) => `Année ${label}`;

// Color palette for charts
const CHART_COLORS = {
  primary: '#1f4e79',
  secondary: '#2c5aa0',
  success: '#27ae60',
  warning: '#f39c12',
  error: '#e74c3c',
  info: '#3498db',
  neutral: '#7f8c8d',
};

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ 
  multiyearData, 
  score 
}) => {

  // Prepare data for charts
  const prepareTimeSeriesData = () => {
    const years = Object.entries(multiyearData)
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => a.year - b.year);

    return years.map(({ year, data, ratios }) => ({
      year,
      chiffre_affaires: data.chiffre_affaires || 0,
      resultat_net: data.resultat_net || 0,
      total_actif: data.total_actif || 0,
      capitaux_propres: data.capitaux_propres || 0,
      roe: ratios?.roe || 0,
      roa: ratios?.roa || 0,
      ratio_liquidite: ratios?.ratio_liquidite_generale || 0,
      ratio_endettement: ratios?.ratio_endettement || 0,
      marge_nette: (data as any).chiffre_affaires ? 
        (((data as any).resultat_net || 0) / (data as any).chiffre_affaires * 100) : 0,
    }));
  };

  const timeSeriesData = prepareTimeSeriesData();

  // Prepare balance sheet structure data (latest year)
  const prepareBalanceSheetData = () => {
    const latestYear = Object.entries(multiyearData)
      .sort(([,a], [,b]) => b.year - a.year)[0];
    
    if (!latestYear) return [];

    const data = latestYear[1].data;
    
    return [
      {
        name: 'Actif Immobilisé',
        value: (data as any).total_actif_immobilise || 0,
        color: CHART_COLORS.primary,
      },
      {
        name: 'Actif Circulant',
        value: (data as any).total_actif_circulant || 0,
        color: CHART_COLORS.info,
      },
      {
        name: 'Trésorerie',
        value: (data as any).tresorerie_actif || 0,
        color: CHART_COLORS.success,
      },
    ].filter(item => item.value > 0);
  };

  const balanceSheetData = prepareBalanceSheetData();

  // Prepare liability structure data
  const prepareLiabilityData = () => {
    const latestYear = Object.entries(multiyearData)
      .sort(([,a], [,b]) => b.year - a.year)[0];
    
    if (!latestYear) return [];

    const data = latestYear[1].data;
    
    return [
      {
        name: 'Capitaux Propres',
        value: (data as any).capitaux_propres || 0,
        color: CHART_COLORS.success,
      },
      {
        name: 'Dettes Financières',
        value: (data as any).dettes_financieres || 0,
        color: CHART_COLORS.warning,
      },
      {
        name: 'Passif Circulant',
        value: (data as any).total_dettes || 0,
        color: CHART_COLORS.error,
      },
    ].filter(item => item.value > 0);
  };

  const liabilityData = prepareLiabilityData();

  // Prepare performance radar data
  const prepareRadarData = () => {
    if (!score) return [];

    return [
      {
        metric: 'Rentabilité',
        value: score.profitability,
        fullMark: 100,
      },
      {
        metric: 'Liquidité',
        value: score.liquidity,
        fullMark: 100,
      },
      {
        metric: 'Endettement',
        value: 100 - (score.leverage || 0), // Inverse for radar display
        fullMark: 100,
      },
      {
        metric: 'Efficacité',
        value: score.efficiency,
        fullMark: 100,
      },
      {
        metric: 'Tendance',
        value: score.trend,
        fullMark: 100,
      },
    ];
  };

  const radarData = prepareRadarData();

  return (
    <Grid container spacing={3}>
      {/* Revenue and Net Income Evolution */}
      {timeSeriesData.length > 1 && (
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 Évolution du CA et Résultat Net
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tickFormatter={(value) => numeral(value).format('0.0a')}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={formatTooltip}
                    labelFormatter={labelFormatter}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="chiffre_affaires"
                    stackId="1"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.6}
                    name="Chiffre d'Affaires"
                  />
                  <Area
                    type="monotone"
                    dataKey="resultat_net"
                    stackId="2"
                    stroke={timeSeriesData.some(d => d.resultat_net < 0) ? CHART_COLORS.error : CHART_COLORS.success}
                    fill={timeSeriesData.some(d => d.resultat_net < 0) ? CHART_COLORS.error : CHART_COLORS.success}
                    fillOpacity={0.6}
                    name="Résultat Net"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Key Ratios Evolution */}
      {timeSeriesData.length > 1 && (
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Évolution des Ratios Clés
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                    labelFormatter={labelFormatter}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="roe"
                    stroke={CHART_COLORS.success}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.success, r: 6 }}
                    name="ROE (%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="roa"
                    stroke={CHART_COLORS.info}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.info, r: 6 }}
                    name="ROA (%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="marge_nette"
                    stroke={CHART_COLORS.warning}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.warning, r: 6 }}
                    name="Marge Nette (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Balance Sheet Structure */}
      {balanceSheetData.length > 0 && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🏦 Structure de l'Actif
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={balanceSheetData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {balanceSheetData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${numeral(value).format('0,0')} FCFA`, 'Montant']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Liability Structure */}
      {liabilityData.length > 0 && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💰 Structure du Financement
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={liabilityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {liabilityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${numeral(value).format('0,0')} FCFA`, 'Montant']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Performance Radar */}
      {radarData.length > 0 && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🎯 Radar de Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip 
                    formatter={(value) => [`${Number(value).toFixed(1)}`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Financial Health Comparison */}
      {timeSeriesData.length > 0 && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚖️ Santé Financière
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                    labelFormatter={labelFormatter}
                  />
                  <Legend />
                  <Bar
                    dataKey="ratio_liquidite"
                    fill={CHART_COLORS.info}
                    name="Liquidité Générale"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="ratio_endettement"
                    fill={CHART_COLORS.warning}
                    name="Endettement (%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export default FinancialCharts;