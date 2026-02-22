import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Assessment as AnalysisIcon,
  Save as SaveIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface FinancialDataInputProps {
  clientId?: string;
  onDataSaved?: (data: any) => void;
}

interface YearData {
  year: number;
  period: 'annual' | 'semester' | 'quarterly';
  data: Record<string, number>;
}

const syscohadaAccounts = {
  'Actif Immobilisé': [
    'Immobilisations incorporelles',
    'Immobilisations corporelles',
    'Immobilisations financières',
  ],
  'Actif Circulant': [
    'Stocks et encours',
    'Créances et emplois assimilés',
    'Trésorerie-Actif',
  ],
  'Capitaux Propres': [
    'Capital',
    'Réserves',
    'Résultat net',
  ],
  'Passif': [
    'Dettes financières',
    'Dettes circulantes',
    'Trésorerie-Passif',
  ],
  'Produits': [
    'Chiffre d\'affaires',
    'Production stockée',
    'Autres produits',
  ],
  'Charges': [
    'Achats consommés',
    'Services extérieurs',
    'Charges de personnel',
    'Impôts et taxes',
    'Charges financières',
  ]
};

export const FinancialDataInput: React.FC<FinancialDataInputProps> = ({
  clientId,
  onDataSaved
}) => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [years, setYears] = useState<YearData[]>([
    { year: 2023, period: 'annual', data: {} },
    { year: 2022, period: 'annual', data: {} },
    { year: 2021, period: 'annual', data: {} },
  ]);
  const [selectedYear, setSelectedYear] = useState<number>(2023);

  const currentYearData = years.find(y => y.year === selectedYear);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const addYear = () => {
    const newYear = Math.max(...years.map(y => y.year)) + 1;
    setYears(prev => [
      { year: newYear, period: 'annual', data: {} },
      ...prev
    ]);
    setSelectedYear(newYear);
  };

  const removeYear = (year: number) => {
    if (years.length > 1) {
      setYears(prev => prev.filter(y => y.year !== year));
      if (selectedYear === year) {
        setSelectedYear(years.filter(y => y.year !== year)[0].year);
      }
    }
  };

  const updateValue = (account: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value.replace(/,/g, ''));
    setYears(prev => prev.map(y => 
      y.year === selectedYear 
        ? { ...y, data: { ...y.data, [account]: numValue } }
        : y
    ));
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value);
  };

  const calculateTotal = (category: string) => {
    if (!currentYearData) return 0;
    return syscohadaAccounts[category as keyof typeof syscohadaAccounts]
      .reduce((sum, account) => sum + (currentYearData.data[account] || 0), 0);
  };

  const handleSave = () => {
    const financialData = {
      clientId,
      years,
      lastUpdated: new Date().toISOString()
    };
    
    if (onDataSaved) {
      onDataSaved(financialData);
    }

    // Store in localStorage for demo purposes
    localStorage.setItem(`financial_data_${clientId}`, JSON.stringify(financialData));
    
    alert('Données financières enregistrées avec succès!');
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <AnalysisIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Saisie des États Financiers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Données SYSCOHADA sur plusieurs exercices
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => {}}
          >
            Importer Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        </Box>
      </Box>

      {/* Year Selection */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Exercices Financiers
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addYear}
              variant="outlined"
              size="small"
            >
              Ajouter Exercice
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {years.map((yearData) => (
              <Chip
                key={yearData.year}
                label={`${yearData.year} (${yearData.period === 'annual' ? 'Annuel' : yearData.period})`}
                onClick={() => setSelectedYear(yearData.year)}
                onDelete={years.length > 1 ? () => removeYear(yearData.year) : undefined}
                color={selectedYear === yearData.year ? 'primary' : 'default'}
                variant={selectedYear === yearData.year ? 'filled' : 'outlined'}
                deleteIcon={<DeleteIcon />}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Data Input Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="Bilan" />
            <Tab label="Compte de Résultat" />
            <Tab label="Résumé" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Bilan Tab */}
          {currentTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Bilan {selectedYear} (en XOF)
              </Typography>
              
              <Grid container spacing={3}>
                {/* Actif */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                      ACTIF
                    </Typography>
                    
                    {Object.entries(syscohadaAccounts).slice(0, 2).map(([category, accounts]) => (
                      <Box key={category} sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                          {category}
                        </Typography>
                        
                        {accounts.map((account) => (
                          <Box key={account} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
                              {account}
                            </Typography>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={currentYearData?.data[account] ? formatNumber(currentYearData.data[account]) : ''}
                              onChange={(e) => updateValue(account, e.target.value)}
                              sx={{ width: 140 }}
                              inputProps={{ style: { textAlign: 'right', fontSize: '0.85rem' } }}
                            />
                          </Box>
                        ))}
                        
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                          <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
                            Total {category}
                          </Typography>
                          <Typography variant="body2" sx={{ width: 140, textAlign: 'right', fontWeight: 600 }}>
                            {formatNumber(calculateTotal(category))}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Paper>
                </Grid>

                {/* Passif */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main' }}>
                      PASSIF
                    </Typography>
                    
                    {Object.entries(syscohadaAccounts).slice(2, 4).map(([category, accounts]) => (
                      <Box key={category} sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                          {category}
                        </Typography>
                        
                        {accounts.map((account) => (
                          <Box key={account} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
                              {account}
                            </Typography>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={currentYearData?.data[account] ? formatNumber(currentYearData.data[account]) : ''}
                              onChange={(e) => updateValue(account, e.target.value)}
                              sx={{ width: 140 }}
                              inputProps={{ style: { textAlign: 'right', fontSize: '0.85rem' } }}
                            />
                          </Box>
                        ))}
                        
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                          <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
                            Total {category}
                          </Typography>
                          <Typography variant="body2" sx={{ width: 140, textAlign: 'right', fontWeight: 600 }}>
                            {formatNumber(calculateTotal(category))}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Compte de Résultat Tab */}
          {currentTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Compte de Résultat {selectedYear} (en XOF)
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
                      PRODUITS
                    </Typography>
                    
                    {syscohadaAccounts.Produits.map((account) => (
                      <Box key={account} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {account}
                        </Typography>
                        <TextField
                          size="small"
                          variant="outlined"
                          value={currentYearData?.data[account] ? formatNumber(currentYearData.data[account]) : ''}
                          onChange={(e) => updateValue(account, e.target.value)}
                          sx={{ width: 160 }}
                          inputProps={{ style: { textAlign: 'right' } }}
                        />
                      </Box>
                    ))}
                    
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                      <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 600 }}>
                        Total Produits
                      </Typography>
                      <Typography variant="body1" sx={{ width: 160, textAlign: 'right', fontWeight: 600, color: 'success.main' }}>
                        {formatNumber(calculateTotal('Produits'))}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'error.main' }}>
                      CHARGES
                    </Typography>
                    
                    {syscohadaAccounts.Charges.map((account) => (
                      <Box key={account} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {account}
                        </Typography>
                        <TextField
                          size="small"
                          variant="outlined"
                          value={currentYearData?.data[account] ? formatNumber(currentYearData.data[account]) : ''}
                          onChange={(e) => updateValue(account, e.target.value)}
                          sx={{ width: 160 }}
                          inputProps={{ style: { textAlign: 'right' } }}
                        />
                      </Box>
                    ))}
                    
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                      <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 600 }}>
                        Total Charges
                      </Typography>
                      <Typography variant="body1" sx={{ width: 160, textAlign: 'right', fontWeight: 600, color: 'error.main' }}>
                        {formatNumber(calculateTotal('Charges'))}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      Résultat Net: {formatNumber(calculateTotal('Produits') - calculateTotal('Charges'))} XOF
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Summary Tab */}
          {currentTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Résumé Multi-Exercices
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Indicateur</TableCell>
                      {years.map(year => (
                        <TableCell key={year.year} align="right" sx={{ fontWeight: 600 }}>
                          {year.year}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {['Actif Immobilisé', 'Actif Circulant', 'Capitaux Propres', 'Passif', 'Produits', 'Charges'].map((category) => (
                      <TableRow key={category}>
                        <TableCell sx={{ fontWeight: 500 }}>{category}</TableCell>
                        {years.map(year => (
                          <TableCell key={year.year} align="right">
                            {formatNumber(
                              syscohadaAccounts[category as keyof typeof syscohadaAccounts]
                                .reduce((sum, account) => sum + (year.data[account] || 0), 0)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'primary.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Résultat Net</TableCell>
                      {years.map(year => {
                        const produits = syscohadaAccounts.Produits.reduce((sum, account) => sum + (year.data[account] || 0), 0);
                        const charges = syscohadaAccounts.Charges.reduce((sum, account) => sum + (year.data[account] || 0), 0);
                        return (
                          <TableCell key={year.year} align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            {formatNumber(produits - charges)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};