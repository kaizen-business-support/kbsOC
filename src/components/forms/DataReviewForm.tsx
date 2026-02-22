import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useFormContext } from 'react-hook-form';
import numeral from 'numeral';

interface DataReviewFormProps {
  years: number[];
}

export const DataReviewForm: React.FC<DataReviewFormProps> = ({ years }) => {
  const { watch } = useFormContext();

  // Format number for display
  const formatNumber = (value: number): string => {
    if (value === 0) return '0';
    return numeral(value).format('0,0');
  };

  // Validate data completeness and consistency
  const validateData = () => {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];
    let totalFields = 0;
    let completedFields = 0;

    years.forEach(year => {
      const yearData = watch(`${year}`) || {};
      
      // Check balance sheet balance
      const totalActif = yearData.total_actif || 0;
      const totalPassif = yearData.total_passif || 0;
      const balanceDiff = Math.abs(totalActif - totalPassif);
      
      if (balanceDiff > 1) {
        issues.push({
          type: 'error',
          message: `${year}: Bilan non équilibré (écart: ${formatNumber(balanceDiff)} FCFA)`
        });
      }

      // Check key fields completion
      const requiredFields = [
        'chiffre_affaires',
        'resultat_net',
        'total_actif',
        'capitaux_propres'
      ];

      requiredFields.forEach(field => {
        totalFields++;
        if (yearData[field] && yearData[field] !== 0) {
          completedFields++;
        } else {
          issues.push({
            type: 'warning',
            message: `${year}: Champ requis manquant - ${field}`
          });
        }
      });

      // Check data consistency
      if (yearData.resultat_net && Math.abs(yearData.resultat_net) > (yearData.chiffre_affaires || 0)) {
        issues.push({
          type: 'warning',
          message: `${year}: Résultat net très élevé par rapport au CA`
        });
      }

      if (yearData.capitaux_propres && yearData.capitaux_propres < 0) {
        issues.push({
          type: 'error',
          message: `${year}: Capitaux propres négatifs`
        });
      }
    });

    const completionRate = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

    return { issues, completionRate };
  };

  const { issues, completionRate } = validateData();

  // Summary data for display
  const getSummaryData = () => {
    return years.map(year => {
      const yearData = watch(`${year}`) || {};
      return {
        year,
        chiffre_affaires: yearData.chiffre_affaires || 0,
        resultat_net: yearData.resultat_net || 0,
        total_actif: yearData.total_actif || 0,
        capitaux_propres: yearData.capitaux_propres || 0,
        marge_nette: yearData.chiffre_affaires ? 
          ((yearData.resultat_net || 0) / yearData.chiffre_affaires * 100) : 0,
        roe: yearData.capitaux_propres ? 
          ((yearData.resultat_net || 0) / yearData.capitaux_propres * 100) : 0,
      };
    });
  };

  const summaryData = getSummaryData();

  if (years.length === 0) {
    return (
      <Alert severity="warning">
        Veuillez d'abord sélectionner au moins un exercice dans la configuration.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CheckIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Vérification et Validation des Données
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        Vérifiez l'exactitude et la cohérence de vos données avant de lancer l'analyse financière.
      </Typography>

      {/* Completion Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 État de Completion
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="body1">
              Completion globale:
            </Typography>
            <Chip
              label={`${completionRate.toFixed(1)}%`}
              color={completionRate >= 90 ? 'success' : completionRate >= 70 ? 'warning' : 'error'}
              variant="outlined"
            />
          </Box>
          
          {completionRate < 100 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Certains champs optionnels ne sont pas remplis. L'analyse peut être lancée 
              mais sera plus précise avec des données complètes.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Issues Summary */}
      {issues.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ⚠️ Points à Vérifier
            </Typography>
            {issues.map((issue, index) => (
              <Alert 
                key={index} 
                severity={issue.type} 
                sx={{ mb: 1 }}
                icon={
                  issue.type === 'error' ? <ErrorIcon /> :
                  issue.type === 'warning' ? <WarningIcon /> : <InfoIcon />
                }
              >
                {issue.message}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Summary Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 Résumé des Données Saisies
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Exercice</strong></TableCell>
                  <TableCell align="right"><strong>Chiffre d'Affaires</strong></TableCell>
                  <TableCell align="right"><strong>Résultat Net</strong></TableCell>
                  <TableCell align="right"><strong>Total Actif</strong></TableCell>
                  <TableCell align="right"><strong>Capitaux Propres</strong></TableCell>
                  <TableCell align="right"><strong>Marge Nette</strong></TableCell>
                  <TableCell align="right"><strong>ROE</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryData.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell component="th" scope="row">
                      <Chip label={row.year} color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {formatNumber(row.chiffre_affaires)} FCFA
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontFamily: 'monospace',
                        color: row.resultat_net >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600
                      }}
                    >
                      {formatNumber(row.resultat_net)} FCFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {formatNumber(row.total_actif)} FCFA
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {formatNumber(row.capitaux_propres)} FCFA
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontFamily: 'monospace',
                        color: row.marge_nette >= 0 ? 'success.main' : 'error.main'
                      }}
                    >
                      {row.marge_nette.toFixed(1)}%
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontFamily: 'monospace',
                        color: row.roe >= 0 ? 'success.main' : 'error.main'
                      }}
                    >
                      {row.roe.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Analysis Preview */}
      <Card sx={{ bgcolor: 'background.default' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🎯 Aperçu de l'Analyse
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Exercices à analyser
                </Typography>
                <Typography variant="h4" color="primary.main" fontWeight={600}>
                  {years.length}
                </Typography>
                <Typography variant="body2">
                  {years.length > 1 ? 'Analyse multi-exercices' : 'Analyse simple'}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Ratios calculés
                </Typography>
                <Typography variant="h4" color="secondary.main" fontWeight={600}>
                  25+
                </Typography>
                <Typography variant="body2">
                  Ratios financiers BCEAO
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Score de qualité
                </Typography>
                <Typography 
                  variant="h4" 
                  color={completionRate >= 90 ? 'success.main' : 'warning.main'} 
                  fontWeight={600}
                >
                  {completionRate >= 90 ? 'A' : completionRate >= 70 ? 'B' : 'C'}
                </Typography>
                <Typography variant="body2">
                  Qualité des données
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              ✅ Prêt pour l'analyse
            </Typography>
            <Typography variant="body2">
              Les données sont suffisantes pour lancer l'analyse financière complète. 
              Vous obtiendrez un scoring BCEAO, des ratios détaillés et des recommandations personnalisées.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataReviewForm;