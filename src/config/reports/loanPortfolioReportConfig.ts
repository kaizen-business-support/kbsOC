import { ReportConfig } from '../../types/reports';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

// Simulate an API call with mock data
const fetchMockPortfolioData = async (filters: Record<string, any>) => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { id: 'LN-001', client: 'TechCorp SA', amount: 50000000, status: 'Active', product: 'Term Loan', rate: '7.5%', branch: 'Dakar Main', date: '2023-01-15' },
    { id: 'LN-002', client: 'AgriFood Ltd', amount: 120000000, status: 'Arrears', product: 'Working Capital', rate: '8.0%', branch: 'Thies', date: '2023-03-22' },
    { id: 'LN-003', client: 'BuildRight', amount: 350000000, status: 'Active', product: 'Equipment Finance', rate: '6.5%', branch: 'Dakar Main', date: '2023-06-10' },
    { id: 'LN-004', client: 'HealthPlus', amount: 25000000, status: 'Closed', product: 'Term Loan', rate: '7.0%', branch: 'Saint-Louis', date: '2022-11-05' },
    { id: 'LN-005', client: 'EduSmart', amount: 15000000, status: 'Default', product: 'Working Capital', rate: '9.0%', branch: 'Dakar Main', date: '2021-08-19' },
    { id: 'LN-006', client: 'Logistics Pro', amount: 85000000, status: 'Active', product: 'Equipment Finance', rate: '6.8%', branch: 'Thies', date: '2023-09-01' },
    { id: 'LN-007', client: 'FinServe', amount: 200000000, status: 'Active', product: 'Term Loan', rate: '7.2%', branch: 'Dakar Main', date: '2024-01-12' },
  ];

  // Apply basic filters for the mock
  if (filters.status && filters.status !== 'All') {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters.branch && filters.branch !== 'All') {
    data = data.filter(item => item.branch === filters.branch);
  }
  if (filters.product && filters.product !== 'All') {
    data = data.filter(item => item.product === filters.product);
  }

  return data;
};

export const loanPortfolioReportConfig: ReportConfig = {
  id: 'loan_portfolio',
  title: 'Analyse du Portefeuille de Crédit',
  description: 'Vue d\'ensemble détaillée des crédits octroyés, avec répartition par statut, produit et agence.',
  category: 'portfolio',
  icon: AccountBalanceWalletIcon,
  filters: [
    {
      id: 'dateRange',
      label: 'Période de Décaissement',
      type: 'date-range',
    },
    {
      id: 'status',
      label: 'Statut du Crédit',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Tous les statuts', value: 'All' },
        { label: 'Actif', value: 'Active' },
        { label: 'En retard', value: 'Arrears' },
        { label: 'Défaut', value: 'Default' },
        { label: 'Clôturé', value: 'Closed' },
      ]
    },
    {
      id: 'branch',
      label: 'Agence',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Toutes les agences', value: 'All' },
        { label: 'Dakar Main', value: 'Dakar Main' },
        { label: 'Thies', value: 'Thies' },
        { label: 'Saint-Louis', value: 'Saint-Louis' },
      ]
    },
    {
      id: 'product',
      label: 'Produit',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Tous les produits', value: 'All' },
        { label: 'Term Loan', value: 'Term Loan' },
        { label: 'Working Capital', value: 'Working Capital' },
        { label: 'Equipment Finance', value: 'Equipment Finance' },
      ]
    }
  ],
  columns: [
    { field: 'id', headerName: 'ID Crédit', width: 120, isExportable: true },
    { field: 'client', headerName: 'Client', width: 200, flex: 1, isExportable: true },
    { field: 'product', headerName: 'Produit', width: 180, isExportable: true },
    { field: 'branch', headerName: 'Agence', width: 150, isExportable: true },
    { 
      field: 'amount', 
      headerName: 'Montant (FCFA)', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { field: 'rate', headerName: 'Taux', width: 100, isExportable: true },
    { 
      field: 'status', 
      headerName: 'Statut', 
      width: 130, 
      isExportable: true 
    },
    { field: 'date', headerName: 'Date Décaissement', width: 150, type: 'date', valueGetter: (params: any) => new Date(params.value), isExportable: true },
  ],
  fetchData: fetchMockPortfolioData,
  chartConfig: {
    type: 'pie',
    dataKey: 'amount',
    categoryKey: 'status',
    title: 'Répartition par Statut (Volume)'
  }
};
