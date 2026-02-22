import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import numeral from 'numeral';
import { MultiyearData } from '../types';
import { bankingColors } from '../theme/theme';

// Styled components for financial tables
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '& .MuiTable-root': {
    minWidth: 650,
  },
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  '& .MuiTableCell-root': {
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `2px solid ${theme.palette.divider}`,
    padding: '16px 12px',
  },
}));

const HeaderCell = styled(TableCell)(({ theme }) => ({
  textAlign: 'center',
  fontWeight: 600,
  backgroundColor: '#f8f9fa',
  color: theme.palette.primary.main,
}));

const IndicatorHeaderCell = styled(TableCell)(({ theme }) => ({
  textAlign: 'left', // Always align left for Indicateur column
  fontWeight: 600,
  backgroundColor: '#f8f9fa',
  color: theme.palette.primary.main,
}));

const LabelCell = styled(TableCell)(() => ({
  textAlign: 'left',
  fontWeight: 500,
  fontSize: '0.9rem',
  maxWidth: '200px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const NumberCell = styled(TableCell)(() => ({
  textAlign: 'right',
  fontFamily: '"Roboto Mono", monospace',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.875rem',
  fontWeight: 500,
  padding: '12px 16px',
  minWidth: '120px',
}));

const PercentageCell = styled(NumberCell)(() => ({
  fontSize: '0.875rem',
  fontWeight: 500,
}));

const ProgressionHeaderCell = styled(TableCell)(({ theme }) => ({
  textAlign: 'center',
  fontWeight: 600,
  backgroundColor: '#f8f9fa',
  color: theme.palette.primary.main,
  textTransform: 'capitalize',
  fontSize: '0.875rem',
  letterSpacing: '0.5px',
  borderBottom: `2px solid ${theme.palette.divider}`,
  padding: '16px 12px',
  '&.MuiTableCell-root': {
    textTransform: 'capitalize',
  },
}));

interface FinancialTableProps {
  title: string;
  data: MultiyearData;
  fields: Array<{
    key: string;
    label: string;
    format: 'currency' | 'percentage' | 'number' | 'spacer';
  }>;
  showEvolution?: boolean;
  showProgression?: boolean; // Show variation per year, tendance, and croissance moyenne
}

// Format currency with French locale
const formatCurrency = (value: number): string => {
  return numeral(value).format('0,0');
};

// Format percentage
const formatPercentage = (value: number): string => {
  return numeral(value / 100).format('0.0%');
};

// Format number
const formatNumber = (value: number): string => {
  return numeral(value).format('0,0.0');
};

// Calculate evolution percentage
const calculateEvolution = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// Get variation color based on percentage
const getVariationColor = (percentage: number): string => {
  if (percentage > 5) return '#4caf50'; // Green for positive
  if (percentage < -5) return '#f44336'; // Red for negative
  return '#ff9800'; // Orange for stable
};

// Analyze trend from variations
const analyzeTrend = (variations: Array<{ percentage: number }>): 'upward' | 'downward' | 'stable' | 'volatile' => {
  if (variations.length === 0) return 'stable';
  
  const positiveChanges = variations.filter(v => v.percentage > 5).length;
  const negativeChanges = variations.filter(v => v.percentage < -5).length;
  
  if (positiveChanges > negativeChanges) return 'upward';
  if (negativeChanges > positiveChanges) return 'downward';
  if (positiveChanges === 0 && negativeChanges === 0) return 'stable';
  return 'volatile';
};

// Get trend icon - same as YearOnYearAnalysis
const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'upward': return <TrendingUpIcon sx={{ color: bankingColors.positive }} />;
    case 'downward': return <TrendingDownIcon sx={{ color: bankingColors.negative }} />;
    case 'stable': return <TrendingFlatIcon sx={{ color: bankingColors.neutral }} />;
    default: return <AnalyticsIcon sx={{ color: bankingColors.warning }} />;
  }
};

// Get trend color - same as YearOnYearAnalysis
const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'upward': return bankingColors.positive;
    case 'downward': return bankingColors.negative;
    case 'stable': return bankingColors.neutral;
    default: return bankingColors.warning;
  }
};

// Get evolution color
const getEvolutionColor = (evolution: number): string => {
  if (evolution > 5) return bankingColors.positive;
  if (evolution < -5) return bankingColors.negative;
  return bankingColors.neutral;
};

export const FinancialTable: React.FC<FinancialTableProps> = ({
  title,
  data,
  fields,
  showEvolution = false,
  showProgression = false,
}) => {
  // Sort years chronologically
  const sortedYears = Object.entries(data)
    .map(([key, value]) => ({ key, year: value.year, data: value }))
    .sort((a, b) => a.year - b.year);

  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return formatPercentage(value);
      case 'number':
        return formatNumber(value);
      default:
        return value.toString();
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      
      <StyledTableContainer>
        <Table>
          <StyledTableHead>
            <TableRow>
              <IndicatorHeaderCell>Indicateur</IndicatorHeaderCell>
              {sortedYears.map(({ year }) => (
                <HeaderCell key={year}>{year}</HeaderCell>
              ))}
              {showEvolution && sortedYears.length > 1 && (
                <HeaderCell>Évolution</HeaderCell>
              )}
              {showProgression && sortedYears.length > 1 && (
                <>
                  <ProgressionHeaderCell>Tendance</ProgressionHeaderCell>
                  <ProgressionHeaderCell>Croissance Moyenne</ProgressionHeaderCell>
                </>
              )}
            </TableRow>
          </StyledTableHead>
          <TableBody>
            {fields.map((field) => {
              // Handle spacer rows
              if (field.format === 'spacer') {
                return (
                  <TableRow key={field.key}>
                    <TableCell colSpan={sortedYears.length + 1 + 
                      (showEvolution && sortedYears.length > 1 ? 1 : 0) + 
                      (showProgression && sortedYears.length > 1 ? 2 : 0)} 
                               sx={{ height: '16px', border: 'none', padding: 0 }} />
                  </TableRow>
                );
              }

              const values = sortedYears.map(({ data }) => {
                const value = data.data[field.key] || data.ratios?.[field.key] || 0;
                // Debug specific fields that are showing as empty
                if (['tresorerie_debut_periode', 'flux_tresorerie_activites_operationnelles', 
                     'flux_tresorerie_activites_investissement', 'flux_tresorerie_activites_financement',
                     'tresorerie_fin_periode', 'total_charges_exploitation'].includes(field.key)) {
                  console.log(`FinancialTable - Field ${field.key} for year ${data.year}: ${value}`);
                  console.log(`FinancialTable - Raw data for year ${data.year}:`, data.data);
                }
                return value;
              });
              
              const evolution = values.length > 1 
                ? calculateEvolution(Number(values[values.length - 1]), Number(values[values.length - 2]))
                : 0;

              // Calculate progression data if showProgression is enabled
              let variations: Array<{ percentage: number }> = [];
              let trend = 'stable';
              let avgGrowthRate = 0;
              
              if (showProgression && values.length > 1) {
                variations = [];
                for (let i = 1; i < values.length; i++) {
                  const currentValue = Number(values[i]);
                  const previousValue = Number(values[i - 1]);
                  const percentage = calculateEvolution(currentValue, previousValue);
                  variations.push({ percentage });
                }
                
                trend = analyzeTrend(variations);
                avgGrowthRate = variations.length > 0 
                  ? variations.reduce((sum, v) => sum + v.percentage, 0) / variations.length 
                  : 0;
              }

              return (
                <TableRow key={field.key} hover>
                  <LabelCell component="th" scope="row">
                    {field.label}
                  </LabelCell>
                  {values.map((value, index) => {
                    const year = sortedYears[index].year;
                    // Calculate variation for this year (compared to previous year)
                    const variation = index > 0 && showProgression ? 
                      calculateEvolution(Number(value), Number(values[index - 1])) : null;
                    
                    const CellComponent = field.format === 'percentage' ? PercentageCell : NumberCell;
                    
                    return (
                      <CellComponent key={year}>
                        {showProgression ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {formatValue(Number(value), field.format)}
                            </Typography>
                            {variation !== null && (
                              <Chip
                                size="small"
                                label={`${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`}
                                sx={{
                                  mt: 0.5,
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  bgcolor: getVariationColor(variation),
                                  color: 'white'
                                }}
                              />
                            )}
                          </Box>
                        ) : (
                          formatValue(Number(value), field.format)
                        )}
                      </CellComponent>
                    );
                  })}
                  {showEvolution && values.length > 1 && (
                    <TableCell sx={{ textAlign: 'center', padding: '12px 16px' }}>
                      <Chip
                        label={`${evolution >= 0 ? '+' : ''}${evolution.toFixed(1)}%`}
                        size="small"
                        sx={{
                          bgcolor: getEvolutionColor(evolution),
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          fontFamily: '"Roboto Mono", monospace',
                        }}
                      />
                    </TableCell>
                  )}
                  {showProgression && values.length > 1 && (
                    <>
                      {/* Tendance Column - same format as YearOnYearAnalysis */}
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getTrendIcon(trend)}
                          <Chip
                            size="small"
                            label={trend === 'upward' ? 'Hausse' : 
                                  trend === 'downward' ? 'Baisse' :
                                  trend === 'stable' ? 'Stable' : 'Volatil'}
                            sx={{
                              ml: 1,
                              bgcolor: getTrendColor(trend),
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </TableCell>
                      
                      {/* Croissance Moyenne Column - same format as YearOnYearAnalysis */}
                      <TableCell align="center">
                        <Box>
                          <Typography 
                            variant="body2" 
                            fontWeight={600}
                            sx={{ color: getVariationColor(avgGrowthRate) }}
                          >
                            {avgGrowthRate >= 0 ? '+' : ''}{avgGrowthRate.toFixed(1)}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(Math.abs(avgGrowthRate), 100)}
                            sx={{
                              mt: 0.5,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: getVariationColor(avgGrowthRate),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: getVariationColor(avgGrowthRate),
                              }
                            }}
                          />
                        </Box>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </StyledTableContainer>
    </Box>
  );
};