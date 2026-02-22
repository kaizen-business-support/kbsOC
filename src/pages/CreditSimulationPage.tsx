import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  AccountBalance as LoanIcon,
  TrendingUp as InterestIcon,
  Schedule as PaymentIcon,
  Security as InsuranceIcon,
  LocalAtm as MoneyIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { PageType } from '../types';

interface CreditSimulationPageProps {
  onNavigate: (page: PageType) => void;
}

interface LoanParameters {
  loanAmount: number;
  durationMonths: number;
  annualInterestRate: number;
  insuranceRate: number;
  tafRate: number;
  insuranceOnRemainingBalance: boolean;
}

interface SimulationResult {
  monthlyPayment: number;
  monthlyCredit: number;
  monthlyInsurance: number;
  monthlyTaf: number;
  totalInterest: number;
  totalInsurance: number;
  totalTaf: number;
  totalCost: number;
  lastPaymentDate: Date;
}

interface AmortizationEntry {
  month: number;
  date: Date;
  remainingBalance: number;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  tafPayment: number;
  totalPayment: number;
}

const COMMON_LOAN_DURATIONS = [
  { value: 12, label: '1 an (12 mois)' },
  { value: 24, label: '2 ans (24 mois)' },
  { value: 36, label: '3 ans (36 mois)' },
  { value: 48, label: '4 ans (48 mois)' },
  { value: 60, label: '5 ans (60 mois)' },
  { value: 72, label: '6 ans (72 mois)' },
  { value: 84, label: '7 ans (84 mois)' },
  { value: 96, label: '8 ans (96 mois)' },
  { value: 120, label: '10 ans (120 mois)' },
  { value: 180, label: '15 ans (180 mois)' },
  { value: 240, label: '20 ans (240 mois)' },
];

export const CreditSimulationPage: React.FC<CreditSimulationPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  
  // Loan parameters
  const [loanParams, setLoanParams] = useState<LoanParameters>({
    loanAmount: 1000000,
    durationMonths: 60,
    annualInterestRate: 12,
    insuranceRate: 0.5,
    tafRate: 15,
    insuranceOnRemainingBalance: false,
  });

  // Borrowing capacity parameters
  const [maxMonthlyPayment, setMaxMonthlyPayment] = useState<number>(150000);
  const [capacityParams, setCapacityParams] = useState({
    durationMonths: 60,
    annualInterestRate: 12,
    insuranceRate: 0.5,
    tafRate: 15,
    insuranceOnRemainingBalance: false,
  });

  // Results
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [maxLoanAmount, setMaxLoanAmount] = useState<number>(0);
  const [amortizationTable, setAmortizationTable] = useState<AmortizationEntry[]>([]);
  const [showAmortization, setShowAmortization] = useState(false);

  // Calculate monthly payment for a loan
  const calculateMonthlyPayment = (
    principal: number,
    monthlyRate: number,
    months: number
  ): number => {
    if (monthlyRate === 0) return principal / months;
    const power = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * power) / (power - 1);
  };

  // Calculate simulation results
  const calculateSimulation = (params: LoanParameters): SimulationResult => {
    const monthlyInterestRate = params.annualInterestRate / 100 / 12;
    const monthlyCredit = calculateMonthlyPayment(
      params.loanAmount,
      monthlyInterestRate,
      params.durationMonths
    );

    // Calculate insurance (on initial capital or remaining balance)
    const monthlyInsuranceRate = params.insuranceRate / 100 / 12;
    const monthlyInsurance = params.insuranceOnRemainingBalance
      ? 0 // Will be calculated per month in amortization
      : params.loanAmount * monthlyInsuranceRate;

    // TAF is applied to interest
    const tafRate = params.tafRate / 100;
    
    let totalInterest = 0;
    let totalInsurance = 0;
    let totalTaf = 0;
    let remainingBalance = params.loanAmount;

    for (let month = 1; month <= params.durationMonths; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = monthlyCredit - interestPayment;
      
      const monthlyInsurancePayment = params.insuranceOnRemainingBalance
        ? remainingBalance * monthlyInsuranceRate
        : monthlyInsurance;
      
      const monthlyTafPayment = interestPayment * tafRate;

      totalInterest += interestPayment;
      totalInsurance += monthlyInsurancePayment;
      totalTaf += monthlyTafPayment;

      remainingBalance -= principalPayment;
    }

    const avgMonthlyInsurance = totalInsurance / params.durationMonths;
    const avgMonthlyTaf = totalTaf / params.durationMonths;
    const monthlyPayment = monthlyCredit + avgMonthlyInsurance + avgMonthlyTaf;

    const lastPaymentDate = new Date();
    lastPaymentDate.setMonth(lastPaymentDate.getMonth() + params.durationMonths);

    return {
      monthlyPayment,
      monthlyCredit,
      monthlyInsurance: avgMonthlyInsurance,
      monthlyTaf: avgMonthlyTaf,
      totalInterest,
      totalInsurance,
      totalTaf,
      totalCost: params.loanAmount + totalInterest + totalInsurance + totalTaf,
      lastPaymentDate,
    };
  };

  // Calculate borrowing capacity
  const calculateBorrowingCapacity = (
    maxPayment: number,
    params: Omit<LoanParameters, 'loanAmount'>
  ): number => {
    const monthlyInterestRate = params.annualInterestRate / 100 / 12;
    const monthlyInsuranceRate = params.insuranceRate / 100 / 12;
    const tafRate = params.tafRate / 100;

    // Estimate through iteration (binary search)
    let low = 0;
    let high = 100000000; // 100M CFA
    let bestAmount = 0;

    while (high - low > 1000) {
      const mid = (low + high) / 2;
      const testParams: LoanParameters = { ...params, loanAmount: mid };
      const result = calculateSimulation(testParams);
      
      if (result.monthlyPayment <= maxPayment) {
        bestAmount = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return bestAmount;
  };

  // Generate amortization table
  const generateAmortizationTable = (params: LoanParameters): AmortizationEntry[] => {
    const table: AmortizationEntry[] = [];
    const monthlyInterestRate = params.annualInterestRate / 100 / 12;
    const monthlyInsuranceRate = params.insuranceRate / 100 / 12;
    const tafRate = params.tafRate / 100;
    
    const monthlyCredit = calculateMonthlyPayment(
      params.loanAmount,
      monthlyInterestRate,
      params.durationMonths
    );

    let remainingBalance = params.loanAmount;
    const startDate = new Date();

    for (let month = 1; month <= params.durationMonths; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = monthlyCredit - interestPayment;
      
      const insurancePayment = params.insuranceOnRemainingBalance
        ? remainingBalance * monthlyInsuranceRate
        : params.loanAmount * monthlyInsuranceRate;
      
      const tafPayment = interestPayment * tafRate;
      const totalPayment = monthlyCredit + insurancePayment + tafPayment;

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + month);

      table.push({
        month,
        date: paymentDate,
        remainingBalance: remainingBalance - principalPayment,
        principalPayment,
        interestPayment,
        insurancePayment,
        tafPayment,
        totalPayment,
      });

      remainingBalance -= principalPayment;
    }

    return table;
  };

  // Update simulation when parameters change
  useEffect(() => {
    const result = calculateSimulation(loanParams);
    setSimulationResult(result);
    
    if (showAmortization) {
      const table = generateAmortizationTable(loanParams);
      setAmortizationTable(table);
    }
  }, [loanParams, showAmortization]);

  // Update borrowing capacity when parameters change
  useEffect(() => {
    const capacity = calculateBorrowingCapacity(maxMonthlyPayment, capacityParams);
    setMaxLoanAmount(capacity);
  }, [maxMonthlyPayment, capacityParams]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const exportAmortization = () => {
    // Generate CSV content
    const headers = ['Mois', 'Date', 'Capital Restant', 'Capital', 'Intérêts', 'Assurance', 'TAF', 'Total'];
    const csvContent = [
      headers.join(','),
      ...amortizationTable.map(entry => [
        entry.month,
        entry.date.toISOString().split('T')[0],
        entry.remainingBalance.toFixed(0),
        entry.principalPayment.toFixed(0),
        entry.interestPayment.toFixed(0),
        entry.insurancePayment.toFixed(0),
        entry.tafPayment.toFixed(0),
        entry.totalPayment.toFixed(0),
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tableau_amortissement_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          <CalculateIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          Simulateur de Crédit
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Calculez vos mensualités, votre capacité d'emprunt et générez un tableau d'amortissement
        </Typography>
      </Box>

      {/* Main Tabs */}
      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab 
              label="Calcul de Mensualités" 
              icon={<PaymentIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Capacité d'Emprunt" 
              icon={<MoneyIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Monthly Payment Calculator */}
        {activeTab === 0 && (
          <CardContent>
            <Grid container spacing={4}>
              {/* Input Parameters */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <LoanIcon sx={{ mr: 1 }} />
                  Paramètres du Prêt
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Montant du Prêt"
                      type="number"
                      value={loanParams.loanAmount}
                      onChange={(e) => setLoanParams(prev => ({ 
                        ...prev, 
                        loanAmount: Number(e.target.value) 
                      }))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Montant total du crédit demandé">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="Montant en Francs CFA"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Durée</InputLabel>
                      <Select
                        value={loanParams.durationMonths}
                        label="Durée"
                        onChange={(e) => setLoanParams(prev => ({ 
                          ...prev, 
                          durationMonths: Number(e.target.value) 
                        }))}
                      >
                        {COMMON_LOAN_DURATIONS.map(duration => (
                          <MenuItem key={duration.value} value={duration.value}>
                            {duration.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Durée Personnalisée"
                      type="number"
                      value={loanParams.durationMonths}
                      onChange={(e) => setLoanParams(prev => ({ 
                        ...prev, 
                        durationMonths: Number(e.target.value) 
                      }))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Durée du prêt en mois">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="En mois"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Taux d'Intérêt Annuel"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 50 }}
                      value={loanParams.annualInterestRate}
                      onChange={(e) => setLoanParams(prev => ({ 
                        ...prev, 
                        annualInterestRate: Number(e.target.value) 
                      }))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Taux d'intérêt annuel du crédit">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Taux d'Assurance"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 10 }}
                      value={loanParams.insuranceRate}
                      onChange={(e) => setLoanParams(prev => ({ 
                        ...prev, 
                        insuranceRate: Number(e.target.value) 
                      }))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Taux d'assurance annuel">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="TAF"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 50 }}
                      value={loanParams.tafRate}
                      onChange={(e) => setLoanParams(prev => ({ 
                        ...prev, 
                        tafRate: Number(e.target.value) 
                      }))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Taxe sur les Activités Financières appliquée aux intérêts">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={loanParams.insuranceOnRemainingBalance}
                          onChange={(e) => setLoanParams(prev => ({ 
                            ...prev, 
                            insuranceOnRemainingBalance: e.target.checked 
                          }))}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          Assurance sur Capital Restant Dû
                          <Tooltip title="Si activé, l'assurance est calculée sur le capital restant dû, sinon sur le capital initial">
                            <InfoIcon sx={{ ml: 1, color: 'text.secondary', fontSize: 16 }} />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Results */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <InterestIcon sx={{ mr: 1 }} />
                  Résultats de la Simulation
                </Typography>

                {simulationResult && (
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Card variant="outlined" sx={{ bgcolor: 'primary.50', borderColor: 'primary.main' }}>
                        <CardContent>
                          <Typography variant="h4" color="primary.main" sx={{ fontWeight: 600 }}>
                            {formatCurrency(simulationResult.monthlyPayment)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Mensualité Totale
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {formatCurrency(simulationResult.monthlyCredit)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Mensualité Crédit
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {formatCurrency(simulationResult.monthlyInsurance)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Assurance Mensuelle
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {formatCurrency(simulationResult.monthlyTaf)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            TAF Mensuelle
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {formatCurrency(simulationResult.totalInterest)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Intérêts
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12}>
                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>Date de fin de remboursement:</strong> {formatDate(simulationResult.lastPaymentDate)}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Coût total du crédit:</strong> {formatCurrency(simulationResult.totalCost)} 
                          (dont {formatCurrency(simulationResult.totalInterest)} d'intérêts, {formatCurrency(simulationResult.totalInsurance)} d'assurance, et {formatCurrency(simulationResult.totalTaf)} de TAF)
                        </Typography>
                      </Alert>
                    </Grid>
                  </Grid>
                )}
              </Grid>
            </Grid>

            {/* Amortization Table */}
            <Divider sx={{ my: 4 }} />
            
            <Accordion expanded={showAmortization} onChange={() => setShowAmortization(!showAmortization)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Tableau d'Amortissement</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={exportAmortization}
                    disabled={amortizationTable.length === 0}
                  >
                    Exporter CSV
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={() => window.print()}
                    disabled={amortizationTable.length === 0}
                  >
                    Imprimer
                  </Button>
                </Box>

                {amortizationTable.length > 0 && (
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Mois</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Capital Restant</TableCell>
                          <TableCell align="right">Capital</TableCell>
                          <TableCell align="right">Intérêts</TableCell>
                          <TableCell align="right">Assurance</TableCell>
                          <TableCell align="right">TAF</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {amortizationTable.map((entry) => (
                          <TableRow key={entry.month}>
                            <TableCell>{entry.month}</TableCell>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.remainingBalance)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.principalPayment)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.interestPayment)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.insurancePayment)}</TableCell>
                            <TableCell align="right">{formatCurrency(entry.tafPayment)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(entry.totalPayment)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </AccordionDetails>
            </Accordion>
          </CardContent>
        )}

        {/* Borrowing Capacity Calculator */}
        {activeTab === 1 && (
          <CardContent>
            <Grid container spacing={4}>
              {/* Input Parameters */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <MoneyIcon sx={{ mr: 1 }} />
                  Paramètres de Capacité
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Mensualité Maximale"
                      type="number"
                      value={maxMonthlyPayment}
                      onChange={(e) => setMaxMonthlyPayment(Number(e.target.value))}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Montant maximum que vous pouvez payer chaque mois">
                            <InfoIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </Tooltip>
                        ),
                      }}
                      helperText="Montant en Francs CFA"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Durée</InputLabel>
                      <Select
                        value={capacityParams.durationMonths}
                        label="Durée"
                        onChange={(e) => setCapacityParams(prev => ({ 
                          ...prev, 
                          durationMonths: Number(e.target.value) 
                        }))}
                      >
                        {COMMON_LOAN_DURATIONS.map(duration => (
                          <MenuItem key={duration.value} value={duration.value}>
                            {duration.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Durée Personnalisée"
                      type="number"
                      value={capacityParams.durationMonths}
                      onChange={(e) => setCapacityParams(prev => ({ 
                        ...prev, 
                        durationMonths: Number(e.target.value) 
                      }))}
                      helperText="En mois"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Taux d'Intérêt Annuel"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 50 }}
                      value={capacityParams.annualInterestRate}
                      onChange={(e) => setCapacityParams(prev => ({ 
                        ...prev, 
                        annualInterestRate: Number(e.target.value) 
                      }))}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Taux d'Assurance"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 10 }}
                      value={capacityParams.insuranceRate}
                      onChange={(e) => setCapacityParams(prev => ({ 
                        ...prev, 
                        insuranceRate: Number(e.target.value) 
                      }))}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="TAF"
                      type="number"
                      inputProps={{ step: 0.1, min: 0, max: 50 }}
                      value={capacityParams.tafRate}
                      onChange={(e) => setCapacityParams(prev => ({ 
                        ...prev, 
                        tafRate: Number(e.target.value) 
                      }))}
                      helperText="En pourcentage (%)"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={capacityParams.insuranceOnRemainingBalance}
                          onChange={(e) => setCapacityParams(prev => ({ 
                            ...prev, 
                            insuranceOnRemainingBalance: e.target.checked 
                          }))}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          Assurance sur Capital Restant Dû
                          <Tooltip title="Si activé, l'assurance est calculée sur le capital restant dû">
                            <InfoIcon sx={{ ml: 1, color: 'text.secondary', fontSize: 16 }} />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Results */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <LoanIcon sx={{ mr: 1 }} />
                  Capacité d'Emprunt
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ bgcolor: 'success.50', borderColor: 'success.main' }}>
                      <CardContent>
                        <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
                          {formatCurrency(maxLoanAmount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Montant Maximum du Prêt
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>Avec une mensualité de {formatCurrency(maxMonthlyPayment)}</strong> sur {capacityParams.durationMonths} mois, 
                        vous pouvez emprunter jusqu'à <strong>{formatCurrency(maxLoanAmount)}</strong>.
                      </Typography>
                    </Alert>
                  </Grid>

                  <Grid item xs={12}>
                    <Alert severity="warning">
                      <Typography variant="body2">
                        <strong>Recommandation:</strong> Il est conseillé de ne pas dépasser 33% de vos revenus nets 
                        pour vos mensualités de crédit afin de maintenir un équilibre financier sain.
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        )}
      </Card>

      {/* Information Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <InfoIcon sx={{ mr: 1 }} />
            Informations Importantes
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <LoanIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Calcul Précis
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Simulation basée sur les formules financières standards
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <InsuranceIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Assurance Incluse
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prise en compte de l'assurance emprunteur
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <PaymentIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  TAF Comprise
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Taxe sur les Activités Financières incluse
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <CalculateIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Temps Réel
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Résultats calculés instantanément
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary" align="center">
            <strong>Avertissement:</strong> Ces simulations sont données à titre indicatif. 
            Les conditions réelles peuvent varier selon votre profil et la politique de l'établissement financier.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};