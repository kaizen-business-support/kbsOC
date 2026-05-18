import { ReportConfig } from '../../types/reports';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';

const fetchMockInterestAccrualData = async (filters: Record<string, any>) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { id: 'INT-001', loanId: 'LN-001', client: 'TechCorp SA', month: '2024-05', accrued: 312500, received: 312500, branch: 'Dakar Main' },
    { id: 'INT-002', loanId: 'LN-002', client: 'AgriFood Ltd', month: '2024-05', accrued: 800000, received: 0, branch: 'Thies' },
    { id: 'INT-003', loanId: 'LN-003', client: 'BuildRight', month: '2024-05', accrued: 1895833, received: 1895833, branch: 'Dakar Main' },
    { id: 'INT-004', loanId: 'LN-006', client: 'Logistics Pro', month: '2024-05', accrued: 481666, received: 481666, branch: 'Thies' },
    { id: 'INT-005', loanId: 'LN-007', client: 'FinServe', month: '2024-05', accrued: 1200000, received: 0, branch: 'Dakar Main' },
  ];

  if (filters.branch && filters.branch !== 'All') {
    data = data.filter(item => item.branch === filters.branch);
  }

  return data;
};

export const interestAccrualReportConfig: ReportConfig = {
  id: 'interest_accrual',
  title: 'Intérêts Courus et Perçus',
  description: 'Analyse de la rentabilité du portefeuille et des revenus d\'intérêts.',
  category: 'performance',
  icon: TrendingUpRoundedIcon,
  filters: [
    {
      id: 'month',
      label: 'Mois',
      type: 'select',
      defaultValue: '2024-05',
      options: [
        { label: 'Mai 2024', value: '2024-05' },
        { label: 'Avril 2024', value: '2024-04' },
        { label: 'Mars 2024', value: '2024-03' },
      ]
    },
    {
      id: 'branch',
      label: 'Agence',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Toutes', value: 'All' },
        { label: 'Dakar Main', value: 'Dakar Main' },
        { label: 'Thies', value: 'Thies' },
        { label: 'Saint-Louis', value: 'Saint-Louis' },
      ]
    }
  ],
  columns: [
    { field: 'loanId', headerName: 'ID Crédit', width: 120, isExportable: true },
    { field: 'client', headerName: 'Client', width: 200, flex: 1, isExportable: true },
    { field: 'branch', headerName: 'Agence', width: 150, isExportable: true },
    { field: 'month', headerName: 'Mois', width: 130, isExportable: true },
    { 
      field: 'accrued', 
      headerName: 'Intérêts Courus', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { 
      field: 'received', 
      headerName: 'Intérêts Perçus', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
  ],
  fetchData: fetchMockInterestAccrualData,
  chartConfig: {
    type: 'bar',
    dataKey: 'accrued', // Will just show accrued in the simple chart, could be expanded
    categoryKey: 'branch',
    title: 'Intérêts Courus par Agence'
  }
};
