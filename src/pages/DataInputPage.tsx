import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Grid,
  Chip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { PageType } from '../types';
import { UploadPage } from './UploadPage';
import ManualInputPage from './ManualInputPage';
import { FinancialCalculator } from '../services/financialCalculator';
import { OcrUpload } from '../components/OcrUpload';

interface DataInputPageProps {
  onNavigate: (page: PageType) => void;
}


const sectors = [
  { value: 'agriculture', label: 'Agriculture et Agro-alimentaire' },
  { value: 'commerce', label: 'Commerce et Distribution' },
  { value: 'industrie', label: 'Industrie et Manufacturing' },
  { value: 'services', label: 'Services et Consulting' },
  { value: 'transport', label: 'Transport et Logistique' },
  { value: 'immobilier', label: 'Immobilier et Construction' },
  { value: 'telecommunications', label: 'Télécommunications et IT' },
  { value: 'finance', label: 'Services Financiers' },
  { value: 'sante', label: 'Santé et Pharmaceutique' },
  { value: 'education', label: 'Éducation et Formation' },
  { value: 'general', label: 'Secteur Général' },
];

const currentYearConst = new Date().getFullYear();
const availableYears = Array.from({ length: 10 }, (_, i) => currentYearConst - i);


const TabPanel: React.FC<{ children?: React.ReactNode; value: number; index: number }> = ({ 
  children, value, index 
}) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const DataInputPage: React.FC<DataInputPageProps> = ({ onNavigate }) => {
  // Configuration state
  const [referenceYear, setReferenceYear] = useState<number>(currentYearConst);
  const [numberOfYears, setNumberOfYears] = useState<number>(1);
  const [selectedSector, setSelectedSector] = useState<string>('general');
  const [currency, setCurrency] = useState<string>('XOF');
  
  // Data input state
  const [activeDataTab, setActiveDataTab] = useState(0); // Excel/Manual/OCR tabs
  const [activeYearTab, setActiveYearTab] = useState(0); // Year tabs (N, N-1, N-2)
  const [financialData, setFinancialData] = useState<Record<number, any>>({});

  // Calculate the years based on reference year and number of years
  const getSelectedYears = () => {
    const years = [];
    for (let i = 0; i < numberOfYears; i++) {
      years.push(referenceYear - i);
    }
    return years.sort((a, b) => b - a); // Sort descending (most recent first)
  };

  const selectedYears = getSelectedYears();

  const getYearLabel = (year: number) => {
    if (year === referenceYear) return `${year} (N)`;
    const diff = referenceYear - year;
    return `${year} (N-${diff})`;
  };

  const handleDataInput = (year: number, data: any) => {
    // Check if data is from Excel upload (has multiyear_data structure)
    if (data && data.multiyear_data) {
      // The Excel processor returns data with keys like 'N', 'N-1', 'N-2' based on reference year
      // Find the data that corresponds to the specific year we're inputting
      let yearData: any = null;
      
      // First, try to find data by matching the actual year number
      Object.entries(data.multiyear_data).forEach(([yearKey, yearInfo]: [string, any]) => {
        if (yearInfo.year === year) {
          yearData = yearInfo;
        }
      });
      
      // Fallback: If no direct year match, try using the year key based on reference year
      if (!yearData) {
        const yearKey = year === referenceYear ? 'N' : 
                       year === referenceYear - 1 ? 'N-1' :
                       year === referenceYear - 2 ? 'N-2' : 
                       `N-${referenceYear - year}`;
        
        yearData = data.multiyear_data[yearKey];
      }
      
      if (yearData && yearData.data) {
        setFinancialData(prev => ({ ...prev, [year]: yearData.data }));
      }
    } else {
      // Handle manual input or other direct data
      setFinancialData(prev => ({ ...prev, [year]: data }));
    }
  };

  const getCurrentYear = () => {
    return selectedYears[activeYearTab] || referenceYear;
  };

  const hasDataForYear = (year: number) => {
    return financialData[year] && Object.keys(financialData[year]).length > 0;
  };

  const getDataCompletionStatus = () => {
    const completedYears = selectedYears.filter(year => hasDataForYear(year));
    return `${completedYears.length}/${selectedYears.length}`;
  };

  const validateAndProceed = () => {
    // Check if we have data for all selected years
    const hasAllData = selectedYears.every(year => financialData[year] && Object.keys(financialData[year]).length > 0);
    
    if (!hasAllData) {
      alert('Veuillez saisir les données pour toutes les années sélectionnées.');
      return;
    }

    // Save configuration and data
    const config = {
      years: selectedYears,
      referenceYear,
      numberOfYears,
      sector: selectedSector,
      currency,
      timestamp: new Date().toISOString()
    };

    // Transform financial data to MultiyearData format expected by AnalysisPage
    const multiyearData: Record<string, any> = {};
    
    selectedYears.forEach(year => {
      const yearDiff = referenceYear - year;
      let yearKey: string;
      
      if (yearDiff === 0) yearKey = 'N';
      else if (yearDiff === 1) yearKey = 'N-1';
      else if (yearDiff === 2) yearKey = 'N-2';
      else yearKey = `N-${yearDiff}`;
      
      if (financialData[year]) {
        multiyearData[yearKey] = {
          year: year,
          data: financialData[year]
        };
      }
    });

    // Debug: Log the multiyear data structure
    console.log('DataInputPage - multiyearData before calculation:', JSON.stringify(multiyearData, null, 2));

    // Calculate financial analysis using the FinancialCalculator
    let calculationResult = null;
    try {
      calculationResult = FinancialCalculator.calculateAnalysis(multiyearData, selectedSector);
      
      // Add calculated ratios to each year's data
      Object.entries(multiyearData).forEach(([yearKey, yearInfo]) => {
        const ratios = FinancialCalculator.calculateRatios(yearInfo.data);
        yearInfo.ratios = ratios;
      });
      
      console.log('DataInputPage - calculation result:', calculationResult);
    } catch (error) {
      console.warn('Failed to calculate financial analysis:', error);
    }

    // Create analysis data structure that matches what AnalysisPage expects
    const analysisData = {
      config,
      yearData: financialData, // Keep original for compatibility
      multiyear_data: multiyearData, // Add transformed data with ratios
      score: calculationResult?.score,
      insights: calculationResult?.insights || [],
      recommendations: calculationResult?.recommendations || [],
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('optimus_analysis_config', JSON.stringify(config));
    localStorage.setItem('optimus_collected_data', JSON.stringify(analysisData));
    
    // Debug: Log what we're saving
    console.log('DataInputPage - Saved config:', config);
    console.log('DataInputPage - Saved analysis data:', analysisData);
    
    // Navigate to analysis
    onNavigate('analysis');
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        <TimelineIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
        Saisie des Données Financières
      </Typography>

      {/* Step 1: Configuration */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            📊 Configuration de l'Analyse
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Sélectionnez l'année la plus récente (N) et le nombre d'années à analyser.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Année de référence (N)</InputLabel>
                <Select
                  value={referenceYear.toString()}
                  label="Année de référence (N)"
                  onChange={(e) => setReferenceYear(Number(e.target.value))}
                >
                  {availableYears.map(year => (
                    <MenuItem key={year} value={year.toString()}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Nombre d'années</InputLabel>
                <Select
                  value={numberOfYears}
                  label="Nombre d'années"
                  onChange={(e) => setNumberOfYears(e.target.value as number)}
                >
                  <MenuItem value={1}>1 année</MenuItem>
                  <MenuItem value={2}>2 années</MenuItem>
                  <MenuItem value={3}>3 années</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Secteur d'activité</InputLabel>
                <Select
                  value={selectedSector}
                  label="Secteur d'activité"
                  onChange={(e) => setSelectedSector(e.target.value)}
                >
                  {sectors.map(sector => (
                    <MenuItem key={sector.value} value={sector.value}>
                      {sector.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Devise</InputLabel>
                <Select
                  value={currency}
                  label="Devise"
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <MenuItem value="XOF">CFA Francs</MenuItem>
                  <MenuItem value="EUR">Euro</MenuItem>
                  <MenuItem value="USD">Dollar US</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Années à analyser :
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedYears.map((year, index) => (
                <Chip
                  key={year}
                  label={getYearLabel(year)}
                  color={index === 0 ? 'primary' : 'default'}
                  size="small"
                />
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Step 2: Data Input */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            💾 Saisie des Données Financières
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Saisissez les données financières pour chaque année sélectionnée. Progression: {getDataCompletionStatus()}
          </Typography>

          {/* Year Selection Tabs */}
          {selectedYears.length > 1 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sélectionnez l'année :
              </Typography>
              <Tabs 
                value={activeYearTab} 
                onChange={(_, newValue) => setActiveYearTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                {selectedYears.map((year, index) => (
                  <Tab 
                    key={year} 
                    label={getYearLabel(year)}
                    icon={hasDataForYear(year) ? <CheckIcon color="success" /> : undefined}
                    iconPosition="end"
                  />
                ))}
              </Tabs>
            </Box>
          )}

          {/* Current Year Display */}
          <Alert 
            severity={hasDataForYear(getCurrentYear()) ? "success" : "info"} 
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle2">
              Données pour l'année {getYearLabel(getCurrentYear())}
            </Typography>
            <Typography variant="body2">
              {hasDataForYear(getCurrentYear()) 
                ? "✅ Données saisies et sauvegardées" 
                : "Aucune donnée saisie pour cette année"}
            </Typography>
          </Alert>

          {/* Method Selection Tabs */}
          <Tabs value={activeDataTab} onChange={(_, newValue) => setActiveDataTab(newValue)}>
            <Tab label="📄 Import Excel" />
            <Tab label="✏️ Saisie Manuelle" />
            <Tab label="📸 OCR" />
          </Tabs>

          <TabPanel value={activeDataTab} index={0}>
            <UploadPage 
              onNavigate={onNavigate}
              yearContext={{ 
                year: getCurrentYear(),
                onComplete: (data) => handleDataInput(getCurrentYear(), data)
              }}
            />
          </TabPanel>

          <TabPanel value={activeDataTab} index={1}>
            <ManualInputPage 
              onNavigate={onNavigate}
              yearContext={{ 
                year: getCurrentYear(),
                onComplete: (data) => handleDataInput(getCurrentYear(), data)
              }}
            />
          </TabPanel>

          <TabPanel value={activeDataTab} index={2}>
            <OcrUpload 
              targetYear={getCurrentYear()}
              onDataExtracted={(data) => handleDataInput(getCurrentYear(), data)}
            />
          </TabPanel>
        </CardContent>
      </Card>

      {/* Step 3: Validation */}
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            ✅ Validation et Analyse
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Une fois vos données saisies pour toutes les années, validez pour lancer l'analyse financière.
          </Typography>
          
          {/* Data completion status */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              État de completion : {getDataCompletionStatus()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              {selectedYears.map(year => (
                <Chip
                  key={year}
                  label={getYearLabel(year)}
                  color={hasDataForYear(year) ? 'success' : 'default'}
                  variant={hasDataForYear(year) ? 'filled' : 'outlined'}
                  icon={hasDataForYear(year) ? <CheckIcon /> : undefined}
                  size="small"
                />
              ))}
            </Box>
          </Box>
          
          <Button
            variant="contained"
            size="large"
            onClick={validateAndProceed}
            startIcon={<CheckIcon />}
            disabled={selectedYears.some(year => !hasDataForYear(year))}
            sx={{ mt: 2 }}
          >
            {selectedYears.every(year => hasDataForYear(year)) 
              ? 'Valider et Analyser' 
              : `Saisir les données manquantes (${selectedYears.length - selectedYears.filter(year => hasDataForYear(year)).length} années)`
            }
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataInputPage;