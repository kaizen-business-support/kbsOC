import { ReportConfig } from '../../types/reports';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';

const fetchMockDisbursementsData = async (filters: Record<string, any>) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { id: 'DIS-001', loanId: 'LN-001', client: 'TechCorp SA', amount: 50000000, date: '2023-01-15', officer: 'M. Fall', branch: 'Dakar Main' },
    { id: 'DIS-002', loanId: 'LN-003', client: 'BuildRight', amount: 350000000, date: '2023-06-10', officer: 'A. Ndiaye', branch: 'Dakar Main' },
    { id: 'DIS-003', loanId: 'LN-006', client: 'Logistics Pro', amount: 85000000, date: '2023-09-01', officer: 'S. Diop', branch: 'Thies' },
    { id: 'DIS-004', loanId: 'LN-007', client: 'FinServe', amount: 200000000, date: '2024-01-12', officer: 'M. Fall', branch: 'Dakar Main' },
    { id: 'DIS-005', loanId: 'LN-008', client: 'AgriExport', amount: 45000000, date: '2024-02-05', officer: 'O. Ba', branch: 'Saint-Louis' },
  ];

  if (filters.branch && filters.branch !== 'All') {
    data = data.filter(item => item.branch === filters.branch);
  }

  return data;
};

export const disbursementsReportConfig: ReportConfig = {
  id: 'disbursements',
  title: 'Historique des Décaissements',
  description: 'Suivi des montants décaissés sur la période sélectionnée.',
  category: 'operations',
  icon: TimelineRoundedIcon,
  filters: [
    {
      id: 'dateRange',
      label: 'Période',
      type: 'date-range',
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
    { field: 'id', headerName: 'Réf. Décaissement', width: 150, isExportable: true },
    { field: 'loanId', headerName: 'ID Crédit', width: 120, isExportable: true },
    { field: 'client', headerName: 'Client', width: 200, flex: 1, isExportable: true },
    { field: 'branch', headerName: 'Agence', width: 150, isExportable: true },
    { 
      field: 'amount', 
      headerName: 'Montant Décaissé', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { field: 'date', headerName: 'Date', width: 150, type: 'date', valueGetter: (params: any) => new Date(params.value), isExportable: true },
    { field: 'officer', headerName: 'Agent', width: 150, isExportable: true },
  ],
  fetchData: fetchMockDisbursementsData,
  chartConfig: {
    type: 'bar',
    dataKey: 'amount',
    categoryKey: 'branch',
    title: 'Décaissements par Agence'
  }
};
