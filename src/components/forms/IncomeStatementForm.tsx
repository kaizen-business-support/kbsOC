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
} from '@mui/material';
import {
  Assessment as IncomeIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as RevenueIcon,
  TrendingDown as ExpenseIcon,
} from '@mui/icons-material';
import { useFormContext, Controller } from 'react-hook-form';
import numeral from 'numeral';

interface IncomeStatementFormProps {
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

// Income statement structure matching Excel template
const INCOME_STATEMENT_SECTIONS = [
  {
    title: 'Produits d\'Exploitation',
    icon: <RevenueIcon />,
    color: 'success.main',
    fields: [
      { key: 'chiffre_affaires', label: 'Chiffre d\'affaires', required: true },
      { key: 'production_stockee', label: 'Production stockée', required: false },
      { key: 'production_immobilisee', label: 'Production immobilisée', required: false },
      { key: 'total_produits_exploitation', label: 'Total Produits d\'exploitation', required: true, calculated: true },
    ]
  },
  {
    title: 'Charges d\'Exploitation',
    icon: <ExpenseIcon />,
    color: 'error.main',
    fields: [
      { key: 'achats_matieres', label: 'Achats de matières premières', required: false },
      { key: 'variation_stocks', label: 'Variation de stocks', required: false },
      { key: 'services_exterieurs', label: 'Services extérieurs', required: true },
      { key: 'impots_taxes', label: 'Impôts et taxes', required: false },
      { key: 'charges_personnel', label: 'Charges de personnel', required: true },
      { key: 'dotations_amortissements', label: 'Dotations aux amortissements', required: false },
      { key: 'total_charges_exploitation', label: 'Total Charges d\'exploitation', required: true, calculated: true },
    ]
  },
  {
    title: 'Résultat d\'Exploitation',
    icon: <IncomeIcon />,
    color: 'primary.main',
    fields: [
      { key: 'resultat_exploitation', label: 'Résultat d\'exploitation', required: true, calculated: true },
    ]
  },
  {
    title: 'Résultat Financier',
    icon: <IncomeIcon />,
    color: 'info.main',
    fields: [
      { key: 'produits_financiers', label: 'Produits financiers', required: false },
      { key: 'charges_financieres', label: 'Charges financières', required: false },
      { key: 'resultat_financier', label: 'Résultat financier', required: true, calculated: true },
    ]
  },
  {
    title: 'Résultat Courant et Exceptionnel',
    icon: <IncomeIcon />,
    color: 'warning.main',
    fields: [
      { key: 'resultat_courant', label: 'Résultat courant', required: true, calculated: true },
      { key: 'produits_exceptionnels', label: 'Produits exceptionnels', required: false },
      { key: 'charges_exceptionnelles', label: 'Charges exceptionnelles', required: false },
      { key: 'resultat_exceptionnel', label: 'Résultat exceptionnel', required: true, calculated: true },
    ]
  },
  {
    title: 'Résultat Net',
    icon: <IncomeIcon />,
    color: 'secondary.main',
    fields: [
      { key: 'resultat_avant_impot', label: 'Résultat avant impôt', required: true, calculated: true },
      { key: 'impot_benefice', label: 'Impôt sur le bénéfice', required: false },
      { key: 'resultat_net', label: 'Résultat net', required: true, calculated: true },
    ]
  }
];

// Calculated fields that will be computed automatically
const CALCULATED_FIELDS = [
  { key: 'total_produits_exploitation', label: 'Total Produits d\'exploitation' },
  { key: 'total_charges_exploitation', label: 'Total Charges d\'exploitation' },
  { key: 'resultat_exploitation', label: 'Résultat d\'exploitation' },
  { key: 'resultat_financier', label: 'Résultat financier' },
  { key: 'resultat_courant', label: 'Résultat courant' },
  { key: 'resultat_exceptionnel', label: 'Résultat exceptionnel' },
  { key: 'resultat_avant_impot', label: 'Résultat avant impôt' },
  { key: 'resultat_net', label: 'Résultat net' },
];

export const IncomeStatementForm: React.FC<IncomeStatementFormProps> = ({ years }) => {
  const [activeTab, setActiveTab] = useState(0);

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Calculate income statement totals for a given year
  const calculateTotals = (year: number) => {
    const yearData = watch(`${year}`) || {};

    // Total produits d'exploitation
    const totalProduitsExploitation = (yearData.chiffre_affaires || 0) + 
                                     (yearData.production_stockee || 0) + 
                                     (yearData.production_immobilisee || 0);

    // Total charges d'exploitation
    const totalChargesExploitation = (yearData.achats_matieres || 0) + 
                                   (yearData.variation_stocks || 0) + 
                                   (yearData.services_exterieurs || 0) + 
                                   (yearData.impots_taxes || 0) + 
                                   (yearData.charges_personnel || 0) + 
                                   (yearData.dotations_amortissements || 0);

    // Résultat d'exploitation
    const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;

    // Résultat financier
    const resultatFinancier = (yearData.produits_financiers || 0) - 
                             (yearData.charges_financieres || 0);

    // Résultat courant
    const resultatCourant = resultatExploitation + resultatFinancier;

    // Résultat exceptionnel
    const resultatExceptionnel = (yearData.produits_exceptionnels || 0) - 
                                (yearData.charges_exceptionnelles || 0);

    // Résultat avant impôt
    const resultatAvantImpot = resultatCourant + resultatExceptionnel;

    // Résultat net
    const resultatNet = resultatAvantImpot - (yearData.impot_benefice || 0);

    // Update calculated fields
    setValue(`${year}.total_produits_exploitation`, totalProduitsExploitation);
    setValue(`${year}.total_charges_exploitation`, totalChargesExploitation);
    setValue(`${year}.resultat_exploitation`, resultatExploitation);
    setValue(`${year}.resultat_financier`, resultatFinancier);
    setValue(`${year}.resultat_courant`, resultatCourant);
    setValue(`${year}.resultat_exceptionnel`, resultatExceptionnel);
    setValue(`${year}.resultat_avant_impot`, resultatAvantImpot);
    setValue(`${year}.resultat_net`, resultatNet);

    return {
      totalProduitsExploitation,
      totalChargesExploitation,
      resultatExploitation,
      resultatFinancier,
      resultatCourant,
      resultatExceptionnel,
      resultatAvantImpot,
      resultatNet,
    };
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
            required={field.required}
            error={!!(errors as any)[year]?.[field.key]}
            helperText={(errors as any)[year]?.[field.key]?.message}
            InputProps={{
              startAdornment: <InputAdornment position="start">CFA</InputAdornment>,
            }}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              formField.onChange(value);
              
              // Recalculate totals when fields change
              setTimeout(() => calculateTotals(year), 100);
            }}
          />
        )}
      />
    );
  };

  // Render calculated field (read-only)
  const renderCalculatedField = (field: any, year: number) => {
    const value = watch(`${year}.${field.key}`) || 0;
    
    return (
      <TextField
        key={field.key}
        label={field.label}
        value={formatNumber(value)}
        fullWidth
        variant="outlined"
        disabled
        InputProps={{
          startAdornment: <InputAdornment position="start">CFA</InputAdornment>,
          sx: { 
            bgcolor: 'action.hover',
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontWeight: 600,
              color: value >= 0 ? 'success.main' : 'error.main',
            }
          },
        }}
      />
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
        <IncomeIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Compte de Résultat
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" paragraph>
        Saisissez les éléments du compte de résultat selon la structure OHADA. 
        Les Soldes Intermédiaires de Gestion (SIG) sont calculés automatiquement.
      </Typography>

      {/* Year tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {years.map((year, index) => (
          <Tab key={year} label={year.toString()} value={index} />
        ))}
      </Tabs>

      {/* Year content */}
      {years.map((year, index) => (
        <TabPanel key={year} value={activeTab} index={index}>
          <Grid container spacing={3}>
            {/* Input sections */}
            <Grid item xs={12} lg={8}>
              {INCOME_STATEMENT_SECTIONS.map((section, sectionIndex) => (
                <Accordion key={sectionIndex} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {section.icon}
                      <Typography variant="h6" sx={{ ml: 1, color: section.color, fontWeight: 600 }}>
                        {section.title}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {section.fields.map((field, fieldIndex) => (
                        <Grid item xs={12} sm={6} key={fieldIndex}>
                          {renderField(field, year)}
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Grid>

            {/* Calculated SIG */}
            <Grid item xs={12} lg={4}>
              <Card sx={{ position: 'sticky', top: 20 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                    📊 Soldes Intermédiaires de Gestion
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Calculés automatiquement selon OHADA
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {CALCULATED_FIELDS.map((field, index) => (
                      <Grid item xs={12} key={index}>
                        {renderCalculatedField(field, year)}
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      ))}

      {/* Performance summary */}
      <Card sx={{ mt: 3, bgcolor: 'background.default' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📈 Résumé des Performances
          </Typography>
          <Grid container spacing={2}>
            {years.map(year => {
              const ca = watch(`${year}.chiffre_affaires`) || 0;
              const resultatNet = watch(`${year}.resultat_net`) || 0;
              const margeNette = ca > 0 ? (resultatNet / ca) * 100 : 0;
              
              return (
                <Grid item xs={12} sm={6} md={4} key={year}>
                  <Box sx={{ 
                    p: 2, 
                    border: 1, 
                    borderColor: resultatNet >= 0 ? 'success.main' : 'error.main',
                    borderRadius: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {year}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      CA: {formatNumber(ca)} CFA
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={resultatNet >= 0 ? 'success.main' : 'error.main'}
                      fontWeight={600}
                    >
                      RN: {formatNumber(resultatNet)} CFA
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Marge: {margeNette.toFixed(1)}%
                    </Typography>
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

export default IncomeStatementForm;