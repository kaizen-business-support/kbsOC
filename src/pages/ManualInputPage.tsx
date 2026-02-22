import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Button,
  Alert,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  Assessment as IncomeIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Navigation as NavigationIcon,
} from '@mui/icons-material';
import { useForm, FormProvider } from 'react-hook-form';
import * as yup from 'yup';
import { BalanceSheetForm } from '../components/forms/BalanceSheetForm';
import { IncomeStatementForm } from '../components/forms/IncomeStatementForm';
import { AnalysisSettingsForm } from '../components/forms/AnalysisSettingsForm';
import { DataReviewForm } from '../components/forms/DataReviewForm';
import { useApp } from '../contexts/AppContext';
import useFinancialAnalysis from '../hooks/useFinancialAnalysis';
import { PageType, FinancialData } from '../types';

interface ManualInputPageProps {
  onNavigate: (page: PageType) => void;
  yearContext?: {
    year: number;
    onComplete: (data: any) => void;
  };
}

interface FormData {
  // Settings
  years: number[];
  sector: string;
  currency: string;
  
  // Multi-year data
  [year: string]: FinancialData | any;
}

// Validation schema

const steps = [
  {
    label: 'Configuration',
    description: 'Paramètres de l\'analyse',
    icon: SettingsIcon,
  },
  {
    label: 'Bilan',
    description: 'Actif et Passif',
    icon: BalanceIcon,
  },
  {
    label: 'Compte de Résultat',
    description: 'Revenus et Charges',
    icon: IncomeIcon,
  },
  {
    label: 'Vérification',
    description: 'Révision des données',
    icon: CheckIcon,
  },
];

export const ManualInputPage: React.FC<ManualInputPageProps> = ({ onNavigate, yearContext }) => {
  const { processManualData, analysisState } = useFinancialAnalysis();
  
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form methods
  const methods = useForm<FormData>({
    defaultValues: {
      years: yearContext ? [yearContext.year] : [2024],
      sector: 'general',
      currency: 'XOF',
    },
    mode: 'onChange',
  });

  const { handleSubmit, watch, trigger, formState: { isValid, errors } } = methods;

  const watchedYears = watch('years') || [];

  // Navigation handlers
  const handleNext = async () => {
    const isStepValid = await trigger();
    if (isStepValid) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    methods.reset();
    setSubmitError(null);
  };

  // Form submission
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Transform form data to MultiyearData format
      const multiyearData: any = {};
      const currentYear = new Date().getFullYear();

      data.years.forEach((year, index) => {
        const yearDiff = currentYear - year;
        let key: string;

        if (yearDiff === 0) {
          key = 'N';
        } else if (yearDiff === 1) {
          key = 'N-1';
        } else if (yearDiff === 2) {
          key = 'N-2';
        } else {
          key = `N-${yearDiff}`;
        }

        multiyearData[key] = {
          year,
          data: data[year.toString()] || {},
        };
      });

      await processManualData(multiyearData);
      
      if (yearContext) {
        // In year context mode, call completion callback
        yearContext.onComplete(multiyearData);
      } else {
        // Navigate to analysis page on success
        onNavigate('analysis');
      }

    } catch (error: any) {
      setSubmitError(error.message || 'Erreur lors du traitement des données');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step content renderer
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <AnalysisSettingsForm />;
      case 1:
        return <BalanceSheetForm years={watchedYears} />;
      case 2:
        return <IncomeStatementForm years={watchedYears} />;
      case 3:
        return <DataReviewForm years={watchedYears} />;
      default:
        return <div>Étape inconnue</div>;
    }
  };

  // Calculate progress
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Saisie Manuelle des Données Financières
      </Typography>

      {/* Progress indicator */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
              Progression
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ flexGrow: 1, mx: 2, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  icon={<step.icon />}
                  optional={
                    <Typography variant="caption">{step.description}</Typography>
                  }
                >
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Error display */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}

      {/* Processing indicator */}
      {analysisState.isProcessing && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Traitement en cours...
          </Typography>
          <Typography variant="body2">
            {analysisState.processingStep}
          </Typography>
          {analysisState.uploadProgress > 0 && (
            <LinearProgress 
              variant="determinate" 
              value={analysisState.uploadProgress} 
              sx={{ mt: 1 }}
            />
          )}
        </Alert>
      )}

      {/* Form content */}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              {getStepContent(activeStep)}
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0 || isSubmitting}
              startIcon={<NavigationIcon sx={{ transform: 'rotate(180deg)' }} />}
            >
              Précédent
            </Button>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Réinitialiser
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!isValid || isSubmitting}
                  startIcon={<CheckIcon />}
                >
                  {isSubmitting ? 'Traitement...' : 'Lancer l\'Analyse'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  endIcon={<NavigationIcon />}
                >
                  Suivant
                </Button>
              )}
            </Box>
          </Box>

          {/* Form errors summary */}
          {Object.keys(errors).length > 0 && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Veuillez corriger les erreurs suivantes :
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>
                    <Typography variant="body2">
                      {field}: {(error as any)?.message}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Warnings display */}
          {analysisState.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Avertissements :
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {analysisState.warnings.map((warning, index) => (
                  <li key={index}>
                    <Typography variant="body2">{warning}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </form>
      </FormProvider>

      {/* Help section */}
      <Card sx={{ mt: 4, bgcolor: 'background.default' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 Conseils de Saisie
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" paragraph>
                <strong>Données du Bilan :</strong> Assurez-vous que l'équilibre 
                Actif = Passif est respecté pour chaque exercice.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" paragraph>
                <strong>Compte de Résultat :</strong> Vérifiez la cohérence 
                entre les différents niveaux de résultat.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" paragraph>
                <strong>Unités :</strong> Saisissez toutes les valeurs dans la même 
                unité monétaire (ex: milliers d'euros).
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" paragraph>
                <strong>Validation :</strong> Le système vérifie automatiquement 
                la cohérence des données saisies.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ManualInputPage;