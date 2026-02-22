import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Grid,
  Chip,
  Divider,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useApp } from '../contexts/AppContext';

interface ConfigurationPageProps {
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

const currentYear = new Date().getFullYear();
const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

export const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ onNavigate }) => {
  const { setSector } = useApp();
  const [activeStep, setActiveStep] = useState(0);
  const [referenceYear, setReferenceYear] = useState<number>(currentYear);
  const [numberOfYears, setNumberOfYears] = useState<number>(1);
  const [selectedSector, setSelectedSector] = useState<string>('general');
  const [currency, setCurrency] = useState<string>('XOF');

  // Calculate the years based on reference year and number of years
  const getSelectedYears = () => {
    const years = [];
    for (let i = 0; i < numberOfYears; i++) {
      years.push(referenceYear - i);
    }
    return years.sort((a, b) => b - a); // Sort descending (most recent first)
  };

  const selectedYears = getSelectedYears();

  const handleNext = () => {
    if (activeStep < 2) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleStartDataInput = () => {
    // Save configuration to context
    setSector(selectedSector);
    
    // Save configuration to localStorage for persistence
    const config = {
      years: selectedYears,
      referenceYear,
      sector: selectedSector,
      currency,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('optimus_analysis_config', JSON.stringify(config));
    
    // Navigate to data input workflow
    onNavigate('data-input');
  };

  const steps = [
    {
      label: 'Période d\'Analyse',
      description: 'Sélectionnez les années à analyser',
    },
    {
      label: 'Secteur d\'Activité',
      description: 'Définissez votre secteur d\'activité',
    },
    {
      label: 'Confirmation',
      description: 'Vérifiez votre configuration',
    },
  ];

  const getYearLabel = (year: number) => {
    if (year === referenceYear) return `${year} (N)`;
    const diff = referenceYear - year;
    return `${year} (N-${diff})`;
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        <TimelineIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
        Configuration de l'Analyse
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Stepper activeStep={activeStep} orientation="vertical">
                {/* Step 1: Year Selection */}
                <Step>
                  <StepLabel>
                    <Typography variant="h6">{steps[0].label}</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {steps[0].description}
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 3 }}>
                      Sélectionnez l'année la plus récente (N) et le nombre d'années à analyser. 
                      Le système déterminera automatiquement les autres années (N-1, N-2).
                    </Alert>

                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Année de référence (N)</InputLabel>
                          <Select
                            value={referenceYear}
                            label="Année de référence (N)"
                            onChange={(e) => setReferenceYear(e.target.value as number)}
                          >
                            {availableYears.map(year => (
                              <MenuItem key={year} value={year}>
                                {year}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Nombre d'années</InputLabel>
                          <Select
                            value={numberOfYears}
                            label="Nombre d'années"
                            onChange={(e) => setNumberOfYears(e.target.value as number)}
                          >
                            <MenuItem value={1}>1 année (N seulement)</MenuItem>
                            <MenuItem value={2}>2 années (N, N-1)</MenuItem>
                            <MenuItem value={3}>3 années (N, N-1, N-2)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Années qui seront analysées :
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

                    <Box sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={!referenceYear || numberOfYears < 1}
                        endIcon={<ArrowForwardIcon />}
                      >
                        Continuer
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 2: Sector Selection */}
                <Step>
                  <StepLabel>
                    <Typography variant="h6">{steps[1].label}</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {steps[1].description}
                    </Typography>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
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
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Devise</InputLabel>
                          <Select
                            value={currency}
                            label="Devise"
                            onChange={(e) => setCurrency(e.target.value)}
                          >
                            <MenuItem value="XOF">FCFA (XOF)</MenuItem>
                            <MenuItem value="EUR">Euro (EUR)</MenuItem>
                            <MenuItem value="USD">Dollar US (USD)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Alert severity="info" sx={{ mt: 3 }}>
                      Le secteur d'activité permet d'adapter les références et benchmarks 
                      utilisés dans l'analyse selon les normes BCEAO.
                    </Alert>

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                      <Button onClick={handleBack}>
                        Retour
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        endIcon={<ArrowForwardIcon />}
                      >
                        Continuer
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 3: Confirmation */}
                <Step>
                  <StepLabel>
                    <Typography variant="h6">{steps[2].label}</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {steps[2].description}
                    </Typography>

                    <Alert severity="success" sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Configuration terminée !
                      </Typography>
                      <Typography variant="body2">
                        Vous pouvez maintenant procéder à la saisie des données financières 
                        pour chaque année sélectionnée.
                      </Typography>
                    </Alert>

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                      <Button onClick={handleBack}>
                        Retour
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleStartDataInput}
                        endIcon={<CheckIcon />}
                      >
                        Commencer la Saisie
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Configuration Summary */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <BusinessIcon sx={{ mr: 1 }} />
                Résumé de la Configuration
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Période d'analyse :
                </Typography>
                {selectedYears.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedYears.map(year => (
                      <Chip
                        key={year}
                        label={getYearLabel(year)}
                        color={year === referenceYear ? 'primary' : 'default'}
                        size="small"
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Aucune année sélectionnée
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Secteur d'activité :
                </Typography>
                <Typography variant="body2">
                  {sectors.find(s => s.value === selectedSector)?.label || 'Non défini'}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Devise :
                </Typography>
                <Typography variant="body2">
                  {currency === 'XOF' ? 'FCFA (XOF)' : 
                   currency === 'EUR' ? 'Euro (EUR)' : 
                   currency === 'USD' ? 'Dollar US (USD)' : currency}
                </Typography>
              </Box>

              {selectedYears.length > 0 && (
                <Alert severity="info" sx={{ mt: 3 }}>
                  <Typography variant="body2">
                    <strong>Prochaine étape :</strong> Saisie des données financières 
                    pour {selectedYears.length} année{selectedYears.length > 1 ? 's' : ''}.
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ConfigurationPage;