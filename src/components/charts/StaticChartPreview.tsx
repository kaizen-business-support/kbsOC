import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { chartImageService } from '../../services/chartImageService';

interface StaticChartPreviewProps {
  multiyearData: any;
  includeCharts: boolean;
}

export const StaticChartPreview: React.FC<StaticChartPreviewProps> = ({ 
  multiyearData, 
  includeCharts 
}) => {
  const [chartImages, setChartImages] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (!includeCharts || Object.keys(multiyearData).length < 2) {
      setChartImages({});
      return;
    }

    const generateCharts = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Generating chart images for preview with data:', multiyearData);
        const images = await chartImageService.generateAllCharts(multiyearData);
        console.log('Chart images received:', Object.keys(images).filter(k => images[k as keyof typeof images]));
        setChartImages(images);
        console.log('Chart images set in state successfully');
      } catch (err) {
        console.error('Error generating chart images for preview:', err);
        setError('Erreur lors de la génération des graphiques');
      } finally {
        setLoading(false);
      }
    };

    generateCharts();
  }, [multiyearData, includeCharts]);

  const handleTestChart = async () => {
    try {
      setDebugInfo('Testing chart service...');
      const testResult = await chartImageService.testChartGeneration();
      setDebugInfo(`Test successful! Chart data URL length: ${testResult.length}`);
      console.log('Test chart result:', testResult.substring(0, 100) + '...');
    } catch (error) {
      setDebugInfo(`Test failed: ${error}`);
      console.error('Test chart error:', error);
    }
  };

  if (!includeCharts) {
    return null;
  }

  if (Object.keys(multiyearData).length < 2) {
    return (
      <Box sx={{ mt: 4, p: 3, border: '2px dashed #ccc', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          📊 Graphiques et Visualisations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Les graphiques nécessitent au moins 2 périodes de données pour l'analyse comparative.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ mt: 4, p: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#1f4e79' }}>
          📊 Génération des Graphiques...
        </Typography>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Création des visualisations en cours...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ p: 3, border: '2px dashed #ccc', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            📊 Graphiques et Visualisations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Erreur lors de la génération des graphiques. Debug en cours...
          </Typography>
          <Button variant="outlined" size="small" onClick={handleTestChart} sx={{ mb: 2 }}>
            Tester le Service de Graphiques
          </Button>
          {debugInfo && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              {debugInfo}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  if (!chartImages.revenueChart) {
    return (
      <Box sx={{ mt: 4 }}>
        <Box sx={{ p: 3, border: '2px dashed #ccc', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            📊 Graphiques et Visualisations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Aucun graphique n'a été généré. Vérification en cours...
          </Typography>
          <Button variant="outlined" size="small" onClick={handleTestChart} sx={{ mb: 2 }}>
            Tester le Service de Graphiques
          </Button>
          {debugInfo && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              {debugInfo}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Données disponibles: {Object.keys(multiyearData).length} périodes
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" sx={{ 
        color: '#1f4e79', 
        borderBottom: '2px solid #2c5aa0', 
        pb: 1, 
        mb: 3,
        fontSize: '1.5rem',
        fontWeight: 600
      }}>
        📊 Graphiques et Visualisations
      </Typography>
      
      <Box sx={{ 
        bgcolor: '#f0f7ff', 
        p: 2, 
        borderRadius: 1, 
        borderLeft: '4px solid #2196f3', 
        mb: 3 
      }}>
        <Typography variant="h6" sx={{ color: '#1565c0', mb: 1 }}>
          Analyse Visuelle des Données Financières
        </Typography>
        <Typography variant="body2" sx={{ color: '#1976d2', fontSize: '0.9rem' }}>
          Les graphiques ci-dessous présentent une analyse visuelle complète des données financières 
          permettant une compréhension rapide des tendances et performances.
        </Typography>
      </Box>

      {/* Revenue Evolution Chart */}
      {chartImages.revenueChart && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <img 
            src={chartImages.revenueChart} 
            alt="Évolution du Chiffre d'Affaires"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }} 
          />
        </Box>
      )}

      {/* Profit Evolution Chart */}
      {chartImages.profitChart && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <img 
            src={chartImages.profitChart} 
            alt="Évolution du Résultat Net"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }} 
          />
        </Box>
      )}

      {/* Ratios Chart */}
      {chartImages.ratiosChart && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <img 
            src={chartImages.ratiosChart} 
            alt="Évolution des Ratios Financiers"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }} 
          />
        </Box>
      )}

      {/* Cash Flow Chart */}
      {chartImages.cashFlowChart && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <img 
            src={chartImages.cashFlowChart} 
            alt="Flux de Trésorerie par Activité"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }} 
          />
        </Box>
      )}

      <Box sx={{ 
        bgcolor: '#e8f5e8', 
        p: 2, 
        borderRadius: 1, 
        borderLeft: '4px solid #28a745', 
        mt: 3 
      }}>
        <Typography variant="h6" sx={{ color: '#155724', mb: 1 }}>
          💡 Analyse Graphique des Tendances
        </Typography>
        <Typography variant="body2" sx={{ color: '#155724', fontSize: '0.9rem' }}>
          Ces visualisations permettent d'identifier rapidement les tendances de croissance, 
          les points d'inflexion et les cycles d'activité de l'entreprise sur la période analysée.
        </Typography>
      </Box>
    </Box>
  );
};