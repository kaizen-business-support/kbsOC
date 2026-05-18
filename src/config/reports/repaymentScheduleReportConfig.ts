import { ReportConfig } from '../../types/reports';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';

const fetchMockRepaymentScheduleData = async (filters: Record<string, any>) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { id: 'SCH-001', loanId: 'LN-001', client: 'TechCorp SA', dueDate: '2024-06-15', principalExpected: 1500000, interestExpected: 312500, totalExpected: 1812500, status: 'Pending' },
    { id: 'SCH-002', loanId: 'LN-001', client: 'TechCorp SA', dueDate: '2024-07-15', principalExpected: 1500000, interestExpected: 303125, totalExpected: 1803125, status: 'Pending' },
    { id: 'SCH-003', loanId: 'LN-006', client: 'Logistics Pro', dueDate: '2024-06-01', principalExpected: 2500000, interestExpected: 481666, totalExpected: 2981666, status: 'Paid' },
    { id: 'SCH-004', loanId: 'LN-007', client: 'FinServe', dueDate: '2024-06-12', principalExpected: 5000000, interestExpected: 1200000, totalExpected: 6200000, status: 'Overdue' },
    { id: 'SCH-005', loanId: 'LN-008', client: 'AgriExport', dueDate: '2024-06-05', principalExpected: 1000000, interestExpected: 300000, totalExpected: 1300000, status: 'Paid' },
  ];

  if (filters.status && filters.status !== 'All') {
    data = data.filter(item => item.status === filters.status);
  }

  return data;
};

export const repaymentScheduleReportConfig: ReportConfig = {
  id: 'repayment_schedule',
  title: 'Échéanciers de Remboursement',
  description: 'Projections des flux de trésorerie entrants et suivi des échéances.',
  category: 'operations',
  icon: EventRepeatRoundedIcon,
  filters: [
    {
      id: 'dateRange',
      label: 'Période d\'échéance',
      type: 'date-range',
    },
    {
      id: 'status',
      label: 'Statut de l\'échéance',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Toutes', value: 'All' },
        { label: 'En attente (Pending)', value: 'Pending' },
        { label: 'Payé (Paid)', value: 'Paid' },
        { label: 'En retard (Overdue)', value: 'Overdue' },
      ]
    }
  ],
  columns: [
    { field: 'loanId', headerName: 'ID Crédit', width: 120, isExportable: true },
    { field: 'client', headerName: 'Client', width: 200, flex: 1, isExportable: true },
    { field: 'dueDate', headerName: 'Date d\'échéance', width: 150, type: 'date', valueGetter: (params: any) => new Date(params.value), isExportable: true },
    { 
      field: 'principalExpected', 
      headerName: 'Principal Attendu', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { 
      field: 'interestExpected', 
      headerName: 'Intérêt Attendu', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { 
      field: 'totalExpected', 
      headerName: 'Total Attendu', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { field: 'status', headerName: 'Statut', width: 130, isExportable: true },
  ],
  fetchData: fetchMockRepaymentScheduleData,
  chartConfig: {
    type: 'bar',
    dataKey: 'totalExpected',
    categoryKey: 'status',
    title: 'Flux de Trésorerie par Statut'
  }
};
