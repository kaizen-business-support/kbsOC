import React from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  DateRange as DateIcon,
  Business as BusinessIcon,
  AccountBalance as CurrencyIcon,
} from '@mui/icons-material';
import { useFormContext, Controller } from 'react-hook-form';

const SECTORS = [
  { value: 'general', label: 'Général' },
  { value: 'industrie', label: 'Industrie Manufacturière' },
  { value: 'commerce', label: 'Commerce de Détail' },
  { value: 'services', label: 'Services Professionnels' },
  { value: 'agriculture', label: 'Agriculture et Agroalimentaire' },
  { value: 'construction', label: 'BTP et Construction' },
  { value: 'transport', label: 'Transport et Logistique' },
  { value: 'finance', label: 'Services Financiers' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'energie', label: 'Énergie et Utilities' },
];

const CURRENCIES = [
  { value: 'XOF', label: 'Franc CFA (XOF)', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { value: 'USD', label: 'Dollar US (USD)', symbol: '$' },
  { value: 'XAF', label: 'Franc CFA Centrale (XAF)', symbol: 'FCFA' },
];

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: year, label: year.toString() };
});

export const AnalysisSettingsForm: React.FC = () => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  const selectedYears = watch('years') || [];
  const selectedSector = watch('sector') || 'general';
  const selectedCurrency = watch('currency') || 'XOF';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Configuration de l'Analyse
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        Configurez les paramètres de base pour votre analyse financière. 
        Ces informations permettront d'adapter l'analyse aux spécificités de votre secteur.
      </Typography>

      <Grid container spacing={4}>
        {/* Years Selection */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DateIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Exercices à Analyser
                </Typography>
              </Box>
              
              <Controller
                name="years"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.years}>
                    <InputLabel id="years-label">Sélectionnez les exercices</InputLabel>
                    <Select
                      {...field}
                      labelId="years-label"
                      multiple
                      input={<OutlinedInput label="Sélectionnez les exercices" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as number[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {YEAR_OPTIONS.map((year) => (
                        <MenuItem key={year.value} value={year.value}>
                          {year.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.years && (
                      <FormHelperText>{(errors.years as any)?.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Sélectionnez entre 1 et 3 exercices pour l'analyse. 
                Plus d'exercices permettent une analyse des tendances.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Sector Selection */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Secteur d'Activité
                </Typography>
              </Box>
              
              <Controller
                name="sector"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.sector}>
                    <InputLabel id="sector-label">Secteur</InputLabel>
                    <Select
                      {...field}
                      labelId="sector-label"
                      label="Secteur"
                    >
                      {SECTORS.map((sector) => (
                        <MenuItem key={sector.value} value={sector.value}>
                          {sector.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.sector && (
                      <FormHelperText>{(errors.sector as any)?.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Le secteur permet d'appliquer les normes de référence appropriées.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Currency Selection */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CurrencyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Devise de Référence
                </Typography>
              </Box>
              
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.currency}>
                    <InputLabel id="currency-label">Devise</InputLabel>
                    <Select
                      {...field}
                      labelId="currency-label"
                      label="Devise"
                    >
                      {CURRENCIES.map((currency) => (
                        <MenuItem key={currency.value} value={currency.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 600, mr: 1 }}>
                              {currency.symbol}
                            </Typography>
                            <Typography>
                              {currency.label}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.currency && (
                      <FormHelperText>{(errors.currency as any)?.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Toutes les valeurs doivent être saisies dans cette devise.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Configuration Summary */}
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Résumé de la Configuration
            </Typography>
            <Typography variant="body2">
              <strong>Exercices :</strong> {selectedYears.length > 0 ? selectedYears.join(', ') : 'Aucun'} • 
              <strong> Secteur :</strong> {SECTORS.find(s => s.value === selectedSector)?.label || 'Non défini'} • 
              <strong> Devise :</strong> {CURRENCIES.find(c => c.value === selectedCurrency)?.symbol || 'Non définie'}
            </Typography>
            {selectedYears.length > 1 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                💡 Analyse multi-exercices activée : vous pourrez visualiser les évolutions et tendances.
              </Typography>
            )}
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalysisSettingsForm;