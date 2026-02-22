import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Tabs,
  Tab,
  Card,
  CardContent,
  InputAdornment,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as AssetsIcon,
  TrendingDown as LiabilitiesIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useFormContext, Controller } from 'react-hook-form';
import numeral from 'numeral';

interface BalanceSheetFormProps {
  years: number[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

// Balance sheet field definitions matching Excel template structure
const BALANCE_SHEET_SECTIONS = {
  assets: {
    title: 'BILAN ACTIF',
    icon: <AssetsIcon />,
    color: 'primary.main',
    sections: [
      {
        title: 'Actif Immobilisé',
        fields: [
          { key: 'immobilisations_incorporelles', label: 'Immobilisations incorporelles', required: false },
          { key: 'immobilisations_corporelles', label: 'Immobilisations corporelles', required: true },
          { key: 'immobilisations_financieres', label: 'Immobilisations financières', required: false },
          { key: 'total_actif_immobilise', label: 'Total Actif Immobilisé', required: true, calculated: true },
        ]
      },
      {
        title: 'Actif Circulant',
        fields: [
          { key: 'stocks', label: 'Stocks', required: false },
          { key: 'creances_clients', label: 'Créances clients', required: true },
          { key: 'autres_creances', label: 'Autres créances', required: false },
          { key: 'total_actif_circulant', label: 'Total Actif Circulant', required: true, calculated: true },
        ]
      },
      {
        title: 'Trésorerie',
        fields: [
          { key: 'tresorerie_actif', label: 'Trésorerie Actif', required: true },
        ]
      }
    ]
  },
  liabilities: {
    title: 'BILAN PASSIF',
    icon: <LiabilitiesIcon />,
    color: 'secondary.main',
    sections: [
      {
        title: 'Capitaux Propres',
        fields: [
          { key: 'capital_social', label: 'Capital social', required: true },
          { key: 'reserves_reportees', label: 'Réserves et résultats reportés', required: false },
          { key: 'resultat_exercice', label: 'Résultat de l\'exercice', required: true },
          { key: 'capitaux_propres', label: 'Total Capitaux Propres', required: true, calculated: true },
        ]
      },
      {
        title: 'Dettes',
        fields: [
          { key: 'dettes_financieres', label: 'Dettes financières', required: false },
          { key: 'dettes_fournisseurs', label: 'Dettes fournisseurs', required: true },
          { key: 'autres_dettes', label: 'Autres dettes', required: false },
          { key: 'total_dettes', label: 'Total Dettes', required: true, calculated: true },
        ]
      },
      {
        title: 'Trésorerie',
        fields: [
          { key: 'tresorerie_passif', label: 'Trésorerie Passif', required: false },
        ]
      }
    ]
  }
};

export const BalanceSheetForm: React.FC<BalanceSheetFormProps> = ({ years }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [balanceChecks, setBalanceChecks] = useState<Record<number, { isBalanced: boolean; difference: number }>>({});

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Calculate totals and check balance for a given year
  const calculateTotals = (year: number) => {
    const yearData = watch(`${year}`) || {};
    
    // Calculate asset totals
    const totalActifImmobilise = (yearData.immobilisations_incorporelles || 0) + 
                                (yearData.immobilisations_corporelles || 0) + 
                                (yearData.immobilisations_financieres || 0);
    
    const totalActifCirculant = (yearData.stocks || 0) + 
                               (yearData.creances_clients || 0) + 
                               (yearData.autres_creances || 0);
    
    const tresorerieActif = yearData.tresorerie_actif || 0;
    
    const totalActif = totalActifImmobilise + totalActifCirculant + tresorerieActif;

    // Calculate liability totals
    const capitauxPropres = (yearData.capital_social || 0) + 
                           (yearData.reserves_reportees || 0) + 
                           (yearData.resultat_exercice || 0);
    
    const totalDettes = (yearData.dettes_financieres || 0) + 
                       (yearData.dettes_fournisseurs || 0) + 
                       (yearData.autres_dettes || 0);
    
    const tresoreriePassif = yearData.tresorerie_passif || 0;
    
    const totalPassif = capitauxPropres + totalDettes + tresoreriePassif;

    // Update calculated fields
    setValue(`${year}.total_actif_immobilise`, totalActifImmobilise);
    setValue(`${year}.total_actif_circulant`, totalActifCirculant);
    setValue(`${year}.total_actif`, totalActif);
    setValue(`${year}.capitaux_propres`, capitauxPropres);
    setValue(`${year}.total_dettes`, totalDettes);
    setValue(`${year}.total_passif`, totalPassif);

    // Check balance
    const difference = totalActif - totalPassif;
    const isBalanced = Math.abs(difference) < 1; // Allow for rounding errors

    setBalanceChecks(prev => ({
      ...prev,
      [year]: { isBalanced, difference }
    }));

    return { totalActif, totalPassif, difference, isBalanced };
  };

  // Format number for display
  const formatNumber = (value: number): string => {
    return numeral(value).format('0,0');
  };

  // Render field input
  const renderField = (field: any, year: number) => {
    const fieldName = `${year}.${field.key}`;
    
    return (
      <Controller
        key={fieldName}
        name={fieldName}
        control={control}
        render={({ field: formField }) => (
          <TextField
            {...formField}
            label={field.label}
            type="number"
            fullWidth
            variant="outlined"
            disabled={field.calculated}
            required={field.required}
            error={!!(errors as any)[year]?.[field.key]}
            helperText={(errors as any)[year]?.[field.key]?.message}
            InputProps={{
              startAdornment: <InputAdornment position="start">CFA</InputAdornment>,
              sx: field.calculated ? { bgcolor: 'action.hover' } : {},
            }}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              formField.onChange(value);
              
              // Recalculate totals when base fields change
              if (!field.calculated) {
                setTimeout(() => calculateTotals(year), 100);
              }
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: field.calculated ? 'monospace' : 'inherit',
                fontWeight: field.calculated ? 600 : 400,
              }
            }}
          />
        )}
      />
    );
  };

  // Render section for a year
  const renderYearSection = (year: number, sectionKey: 'assets' | 'liabilities') => {
    const section = BALANCE_SHEET_SECTIONS[sectionKey];
    const balance = balanceChecks[year];

    return (
      <Card key={`${year}-${sectionKey}`} variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            {section.icon}
            <Typography variant="h6" sx={{ ml: 1, color: section.color, fontWeight: 600 }}>
              {section.title} - {year}
            </Typography>
          </Box>

          {section.sections.map((subsection, index) => (
            <Accordion key={index} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {subsection.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {subsection.fields.map((field, fieldIndex) => (
                    <Grid item xs={12} sm={6} md={4} key={fieldIndex}>
                      {renderField(field, year)}
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}

          {/* Balance check for this year */}
          {sectionKey === 'liabilities' && balance && (
            <Alert 
              severity={balance.isBalanced ? 'success' : 'warning'} 
              sx={{ mt: 2 }}
              action={
                <Chip
                  icon={<CalculateIcon />}
                  label={`Écart: ${formatNumber(Math.abs(balance.difference))} CFA`}
                  color={balance.isBalanced ? 'success' : 'warning'}
                  variant="outlined"
                />
              }
            >
              <Typography variant="subtitle2">
                {balance.isBalanced 
                  ? '✅ Bilan équilibré' 
                  : '⚠️  Bilan non équilibré'
                }
              </Typography>
              <Typography variant="body2">
                Total Actif: {formatNumber(watch(`${year}.total_actif`) || 0)} CFA • 
                Total Passif: {formatNumber(watch(`${year}.total_passif`) || 0)} CFA
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

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
        <BalanceIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Bilan - Actif et Passif
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        Saisissez les éléments du bilan selon la structure comptable OHADA. 
        Les totaux sont calculés automatiquement et l'équilibre du bilan est vérifié.
      </Typography>

      {/* Year tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {years.map((year, index) => {
          const balance = balanceChecks[year];
          return (
            <Tab
              key={year}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography>{year}</Typography>
                  {balance && (
                    <Chip
                      size="small"
                      color={balance.isBalanced ? 'success' : 'warning'}
                      label={balance.isBalanced ? '✓' : '!'}
                      sx={{ ml: 1, minWidth: 24, height: 20 }}
                    />
                  )}
                </Box>
              }
              value={index}
            />
          );
        })}
      </Tabs>

      {/* Year content */}
      {years.map((year, index) => (
        <TabPanel key={year} value={activeTab} index={index}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              {renderYearSection(year, 'assets')}
            </Grid>
            <Grid item xs={12} lg={6}>
              {renderYearSection(year, 'liabilities')}
            </Grid>
          </Grid>
        </TabPanel>
      ))}

      {/* Global balance summary */}
      <Card sx={{ mt: 3, bgcolor: 'background.default' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Résumé des Bilans
          </Typography>
          <Grid container spacing={2}>
            {years.map(year => {
              const balance = balanceChecks[year];
              const totalActif = watch(`${year}.total_actif`) || 0;
              
              return (
                <Grid item xs={12} sm={6} md={4} key={year}>
                  <Box sx={{ 
                    p: 2, 
                    border: 1, 
                    borderColor: balance?.isBalanced ? 'success.main' : 'warning.main',
                    borderRadius: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {year}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total: {formatNumber(totalActif)} CFA
                    </Typography>
                    <Chip
                      size="small"
                      color={balance?.isBalanced ? 'success' : 'warning'}
                      label={balance?.isBalanced ? 'Équilibré' : 'Déséquilibré'}
                    />
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BalanceSheetForm;