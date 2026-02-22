import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Gavel as ComplianceIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';
import { MultiyearData } from '../../types';
import { FinancialCalculator, BceaoCompliance } from '../../services/financialCalculator';

interface BceaoCompliancePanelProps {
  multiyearData: MultiyearData;
  sector: string;
}

interface ComplianceCategory {
  name: string;
  ratios: BceaoCompliance[];
  description: string;
  weight: number;
}

export const BceaoCompliancePanel: React.FC<BceaoCompliancePanelProps> = ({
  multiyearData,
  sector
}) => {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<BceaoCompliance | null>(null);

  // Get all years data sorted chronologically
  const getSortedYearsData = () => {
    return Object.entries(multiyearData)
      .map(([key, value]) => ({ key, year: value.year, data: value }))
      .sort((a, b) => a.year - b.year);
  };

  const sortedYears = getSortedYearsData();
  const latestYearData = sortedYears[sortedYears.length - 1]?.data;
  
  // Calculate compliance for all years
  const multiyearCompliance = sortedYears.map(({ year, data }) => ({
    year,
    compliance: FinancialCalculator.checkBceaoCompliance(
      FinancialCalculator.calculateRatios(data.data), 
      sector
    )
  }));

  // Get latest year compliance for summary
  const compliance = latestYearData ? 
    FinancialCalculator.checkBceaoCompliance(
      FinancialCalculator.calculateRatios(latestYearData.data), 
      sector
    ) : [];

  // Group compliance results by category
  const groupComplianceByCategory = (): ComplianceCategory[] => {
    const categories: Record<string, ComplianceCategory> = {
      liquidity: {
        name: 'Liquidité',
        ratios: [],
        description: 'Capacité à honorer les engagements à court terme',
        weight: 30,
      },
      solvency: {
        name: 'Solvabilité',
        ratios: [],
        description: 'Structure financière et autonomie',
        weight: 25,
      },
      profitability: {
        name: 'Rentabilité',
        ratios: [],
        description: 'Performance et génération de bénéfices',
        weight: 25,
      },
      activity: {
        name: 'Activité',
        ratios: [],
        description: 'Efficacité dans l\'utilisation des actifs',
        weight: 20,
      },
    };

    // Categorize ratios
    compliance.forEach(item => {
      if (item.ratioName.includes('liquidite')) {
        categories.liquidity.ratios.push(item);
      } else if (item.ratioName.includes('autonomie') || item.ratioName.includes('endettement')) {
        categories.solvency.ratios.push(item);
      } else if (item.ratioName.includes('roe') || item.ratioName.includes('roa') || item.ratioName.includes('marge')) {
        categories.profitability.ratios.push(item);
      } else if (item.ratioName.includes('rotation')) {
        categories.activity.ratios.push(item);
      } else {
        // Default to solvency for other ratios
        categories.solvency.ratios.push(item);
      }
    });

    return Object.values(categories).filter(cat => cat.ratios.length > 0);
  };

  const categorizedCompliance = groupComplianceByCategory();

  // Calculate overall compliance score
  const calculateComplianceScore = (): { score: number; compliantCount: number; totalCount: number } => {
    if (compliance.length === 0) return { score: 0, compliantCount: 0, totalCount: 0 };

    const compliantCount = compliance.filter(item => item.isCompliant).length;
    const score = (compliantCount / compliance.length) * 100;

    return { score, compliantCount, totalCount: compliance.length };
  };

  const { score: complianceScore, compliantCount, totalCount } = calculateComplianceScore();

  // Get status color based on compliance status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'success';
      case 'good': return 'success';
      case 'acceptable': return 'warning';
      case 'poor': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  // Translate status to French
  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'excellent': 'Excellent',
      'good': 'Bon',
      'acceptable': 'Acceptable',
      'poor': 'Insuffisant',
      'critical': 'Critique'
    };
    
    return statusMap[status] || status;
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <CheckIcon sx={{ color: 'success.main' }} />;
      case 'acceptable':
        return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'poor':
      case 'critical':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      default:
        return <InfoIcon sx={{ color: 'info.main' }} />;
    }
  };

  // Format ratio name for display
  const formatRatioName = (ratioName: string): string => {
    const nameMap: Record<string, string> = {
      'ratio_liquidite_generale': 'Ratio de Liquidité Générale',
      'ratio_liquidite_reduite': 'Ratio de Liquidité Réduite',
      'ratio_liquidite_immediate': 'Ratio de Liquidité Immédiate',
      'ratio_autonomie_financiere': 'Ratio d\'Autonomie Financière',
      'ratio_endettement': 'Ratio d\'Endettement',
      'ratio_couverture_dettes': 'Ratio de Couverture des Dettes',
      'roe': 'Rentabilité des Capitaux Propres (ROE)',
      'roa': 'Rentabilité de l\'Actif (ROA)',
      'marge_nette': 'Marge Nette',
      'rotation_actif': 'Rotation de l\'Actif',
    };
    
    return nameMap[ratioName] || ratioName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get formula for ratio
  const getRatioFormula = (ratioName: string): { formula: string; description: string } => {
    const formulas: Record<string, { formula: string; description: string }> = {
      'ratio_liquidite_generale': {
        formula: 'Actif Circulant / Passif Circulant',
        description: 'Mesure la capacité de l\'entreprise à honorer ses dettes à court terme avec ses actifs liquides.'
      },
      'ratio_liquidite_reduite': {
        formula: '(Actif Circulant - Stocks) / Passif Circulant',
        description: 'Évalue la liquidité en excluant les stocks, moins facilement convertibles en liquidités.'
      },
      'ratio_liquidite_immediate': {
        formula: 'Disponibilités / Passif Circulant',
        description: 'Mesure la capacité de paiement immédiat avec les liquidités disponibles.'
      },
      'ratio_autonomie_financiere': {
        formula: '(Capitaux Propres / Total Bilan) × 100',
        description: 'Indique le degré d\'indépendance financière de l\'entreprise vis-à-vis des créanciers.'
      },
      'ratio_endettement': {
        formula: '(Total Dettes / Total Bilan) × 100',
        description: 'Mesure le niveau d\'endettement global de l\'entreprise par rapport à ses actifs.'
      },
      'ratio_couverture_dettes': {
        formula: 'Capacité d\'Autofinancement / Endettement Net',
        description: 'Évalue la capacité de l\'entreprise à rembourser ses dettes avec sa génération de cash-flow.'
      },
      'roe': {
        formula: '(Résultat Net / Capitaux Propres) × 100',
        description: 'Mesure la rentabilité des capitaux investis par les actionnaires.'
      },
      'roa': {
        formula: '(Résultat Net / Total Actif) × 100',
        description: 'Indique l\'efficacité de l\'entreprise dans l\'utilisation de ses actifs pour générer des profits.'
      },
      'marge_nette': {
        formula: '(Résultat Net / Chiffre d\'Affaires) × 100',
        description: 'Mesure la rentabilité nette de l\'entreprise par rapport à son chiffre d\'affaires.'
      },
      'rotation_actif': {
        formula: 'Chiffre d\'Affaires / Total Actif',
        description: 'Indique l\'efficacité avec laquelle l\'entreprise utilise ses actifs pour générer du chiffre d\'affaires.'
      },
      'marge_brute': {
        formula: '((Chiffre d\'Affaires - Coût des Ventes) / Chiffre d\'Affaires) × 100',
        description: 'Mesure la rentabilité brute avant déduction des charges d\'exploitation.'
      },
      'rotation_stocks': {
        formula: 'Coût des Ventes / Stock Moyen',
        description: 'Indique la vitesse de rotation des stocks dans l\'année.'
      },
      'delai_recouvrement': {
        formula: '(Créances Clients / Chiffre d\'Affaires TTC) × 365',
        description: 'Temps moyen nécessaire pour recouvrer les créances clients.'
      }
    };
    
    return formulas[ratioName] || {
      formula: 'Formule non disponible',
      description: 'Description non disponible pour ce ratio.'
    };
  };

  // Format value for display
  const formatValue = (value: number, ratioName: string): string => {
    if (ratioName.includes('ratio') && !ratioName.includes('endettement') && !ratioName.includes('autonomie')) {
      return value.toFixed(2);
    } else if (ratioName.includes('endettement') || ratioName.includes('autonomie') || ratioName.includes('marge')) {
      return `${value.toFixed(1)}%`;
    } else {
      return `${value.toFixed(1)}%`;
    }
  };

  // Handle ratio click for detailed view
  const handleRatioClick = (ratio: BceaoCompliance) => {
    setSelectedRatio(ratio);
    setHelpDialogOpen(true);
  };

  if (!latestYearData) {
    return (
      <Alert severity="warning">
        Aucune donnée disponible pour l'analyse de conformité BCEAO.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ComplianceIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Conformité BCEAO
        </Typography>
        <Tooltip title="Aide sur les normes BCEAO">
          <IconButton 
            onClick={() => setHelpDialogOpen(true)} 
            sx={{ ml: 1 }}
          >
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Overall Score */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)', color: 'white' }}>
        <CardContent>
          <Grid container alignItems="center" spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h2" fontWeight={700} sx={{ color: 'white' }}>
                  {complianceScore.toFixed(0)}%
                </Typography>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  Score de Conformité
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                Analyse de Conformité - Période {sortedYears[0]?.year} - {sortedYears[sortedYears.length - 1]?.year}
              </Typography>
              <Typography variant="body1" paragraph sx={{ color: 'white' }}>
                {compliantCount} sur {totalCount} ratios sont conformes aux normes BCEAO (exercice {latestYearData?.year})
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', opacity: 0.9 }}>
                Analyse sur {sortedYears.length} année{sortedYears.length > 1 ? 's' : ''} - Évolution et tendances incluses
              </Typography>
              <LinearProgress
                variant="determinate"
                value={complianceScore}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.3)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: complianceScore >= 80 ? '#27ae60' : complianceScore >= 60 ? '#f39c12' : '#e74c3c',
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" sx={{ color: 'white' }}>Critique</Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>Excellent</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Compliance by Category */}
      {categorizedCompliance.map((category, index) => (
        <Accordion key={index} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                {category.name}
              </Typography>
              <Chip
                label={`${category.ratios.filter(r => r.isCompliant).length}/${category.ratios.length}`}
                color={category.ratios.every(r => r.isCompliant) ? 'success' : 'warning'}
                size="small"
                sx={{ mr: 2 }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              {category.description}
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Ratio</strong></TableCell>
                    {sortedYears.map(({ year }) => (
                      <TableCell key={year} align="center"><strong>{year}</strong></TableCell>
                    ))}
                    <TableCell align="center"><strong>Norme</strong></TableCell>
                    <TableCell align="center"><strong>Évolution</strong></TableCell>
                    <TableCell align="center"><strong>Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {category.ratios.map((ratio, ratioIndex) => {
                    // Get historical values for this ratio across all years
                    const historicalValues = multiyearCompliance.map(({ year, compliance: yearCompliance }) => {
                      const ratioData = yearCompliance.find(r => r.ratioName === ratio.ratioName);
                      return { year, value: ratioData?.value, status: ratioData?.status, isCompliant: ratioData?.isCompliant };
                    });

                    // Calculate trend
                    const values = historicalValues.map(h => h.value).filter(v => v !== undefined) as number[];
                    const trend = values.length > 1 ? 
                      (values[values.length - 1] > values[0] ? 'improving' : 
                       values[values.length - 1] < values[0] ? 'declining' : 'stable') : 'stable';

                    return (
                      <TableRow 
                        key={ratioIndex}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleRatioClick(ratio)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {formatRatioName(ratio.ratioName)}
                          </Typography>
                        </TableCell>
                        {historicalValues.map(({ year, value, status, isCompliant }) => (
                          <TableCell key={year} align="center">
                            {value !== undefined ? (
                              <Box>
                                <Typography 
                                  variant="body2" 
                                  fontWeight={600}
                                  sx={{ 
                                    fontFamily: 'monospace',
                                    color: isCompliant ? 'success.main' : 'error.main'
                                  }}
                                >
                                  {formatValue(value, ratio.ratioName)}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={getStatusLabel(status || 'default')}
                                  color={getStatusColor(status || 'default') as any}
                                  sx={{ 
                                    fontSize: '0.6rem', 
                                    height: '16px',
                                    mt: 0.5
                                  }}
                                />
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.disabled">
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                        ))}
                        <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                          {ratio.norm.min !== undefined && `Min: ${ratio.norm.min}`}
                          {ratio.norm.max !== undefined && `Max: ${ratio.norm.max}`}
                          {ratio.norm.optimal !== undefined && ` (Opt: ${ratio.norm.optimal})`}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {trend === 'improving' && <TrendingUpIcon sx={{ color: 'success.main', mr: 0.5 }} />}
                            {trend === 'declining' && <TrendingDownIcon sx={{ color: 'error.main', mr: 0.5 }} />}
                            {trend === 'stable' && <TrendingFlatIcon sx={{ color: 'warning.main', mr: 0.5 }} />}
                            <Typography variant="caption">
                              {trend === 'improving' ? 'Amélioration' : 
                               trend === 'declining' ? 'Dégradation' : 'Stable'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation();
                            handleRatioClick(ratio);
                          }}>
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Recommendations */}
      {compliance.some(item => !item.isCompliant) && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Recommandations Prioritaires
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {compliance
              .filter(item => !item.isCompliant && item.recommendation)
              .slice(0, 3)
              .map((item, index) => (
                <li key={index}>
                  <Typography variant="body2">
                    <strong>{formatRatioName(item.ratioName)}:</strong> {item.recommendation}
                  </Typography>
                </li>
              ))}
          </ul>
        </Alert>
      )}

      {/* Help Dialog */}
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedRatio ? 
            `Détails - ${formatRatioName(selectedRatio.ratioName)}` : 
            'Normes BCEAO'
          }
        </DialogTitle>
        <DialogContent dividers>
          {selectedRatio ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Valeur Actuelle
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {formatValue(selectedRatio.value, selectedRatio.ratioName)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Statut
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(selectedRatio.status)}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                      {getStatusLabel(selectedRatio.status)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Formula Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Formule de Calcul
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography 
                    variant="h6" 
                    fontWeight={600}
                    sx={{ 
                      fontFamily: 'monospace',
                      color: 'primary.main',
                      textAlign: 'center',
                      mb: 1 
                    }}
                  >
                    {getRatioFormula(selectedRatio.ratioName).formula}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getRatioFormula(selectedRatio.ratioName).description}
                  </Typography>
                </Paper>
              </Box>

              {selectedRatio.norm && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Normes BCEAO
                  </Typography>
                  <Grid container spacing={2}>
                    {selectedRatio.norm.min !== undefined && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Minimum
                          </Typography>
                          <Typography variant="h6">
                            {selectedRatio.norm.min}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                    {selectedRatio.norm.max !== undefined && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Maximum
                          </Typography>
                          <Typography variant="h6">
                            {selectedRatio.norm.max}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                    {selectedRatio.norm.optimal !== undefined && (
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                          <Typography variant="body2" color="text.secondary">
                            Optimal
                          </Typography>
                          <Typography variant="h6">
                            {selectedRatio.norm.optimal}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}

              {selectedRatio.recommendation && (
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Recommandation
                  </Typography>
                  <Typography variant="body2">
                    {selectedRatio.recommendation}
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" paragraph>
                Les normes de la Banque Centrale des États de l'Afrique de l'Ouest (BCEAO) 
                définissent les seuils prudentiels pour l'évaluation de la santé financière 
                des entreprises dans la zone UEMOA.
              </Typography>
              
              <Typography variant="h6" gutterBottom>
                Catégories d'Évaluation
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🟢 Excellent/Bon
                    </Typography>
                    <Typography variant="body2">
                      Conforme aux normes, situation financière saine
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🟡 Acceptable
                    </Typography>
                    <Typography variant="body2">
                      Légèrement en dessous des normes, surveillance nécessaire
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🟠 Insuffisant
                    </Typography>
                    <Typography variant="body2">
                      En dessous des normes, actions correctives requises
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🔴 Critique
                    </Typography>
                    <Typography variant="body2">
                      Très en dessous des normes, intervention urgente
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setHelpDialogOpen(false);
            setSelectedRatio(null);
          }}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BceaoCompliancePanel;