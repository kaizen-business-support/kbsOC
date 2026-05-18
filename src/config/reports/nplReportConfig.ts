import { ReportConfig } from '../../types/reports';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

const fetchMockNplData = async (filters: Record<string, any>) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { id: 'NPL-001', client: 'AgriFood Ltd', amount: 120000000, daysInArrears: 45, provision: 12000000, status: 'Substandard', branch: 'Thies' },
    { id: 'NPL-002', client: 'EduSmart', amount: 15000000, daysInArrears: 120, provision: 7500000, status: 'Doubtful', branch: 'Dakar Main' },
    { id: 'NPL-003', client: 'Retail Max', amount: 45000000, daysInArrears: 185, provision: 45000000, status: 'Loss', branch: 'Saint-Louis' },
    { id: 'NPL-004', client: 'Transport Co', amount: 25000000, daysInArrears: 32, provision: 1250000, status: 'Watch', branch: 'Thies' },
    { id: 'NPL-005', client: 'Build & Co', amount: 200000000, daysInArrears: 60, provision: 20000000, status: 'Substandard', branch: 'Dakar Main' },
  ];

  if (filters.status && filters.status !== 'All') {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters.branch && filters.branch !== 'All') {
    data = data.filter(item => item.branch === filters.branch);
  }

  return data;
};

export const nplReportConfig: ReportConfig = {
  id: 'npl_report',
  title: 'Créances Douteuses (NPL)',
  description: 'Suivi détaillé des prêts non performants, retards et provisions associées.',
  category: 'portfolio',
  icon: WarningRoundedIcon,
  filters: [
    {
      id: 'status',
      label: 'Classification',
      type: 'select',
      defaultValue: 'All',
      options: [
        { label: 'Toutes', value: 'All' },
        { label: 'Watch (1-30j)', value: 'Watch' },
        { label: 'Substandard (31-90j)', value: 'Substandard' },
        { label: 'Doubtful (91-180j)', value: 'Doubtful' },
        { label: 'Loss (>180j)', value: 'Loss' },
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
    { field: 'id', headerName: 'ID NPL', width: 120, isExportable: true },
    { field: 'client', headerName: 'Client', width: 200, flex: 1, isExportable: true },
    { field: 'branch', headerName: 'Agence', width: 150, isExportable: true },
    { 
      field: 'amount', 
      headerName: 'Encours (FCFA)', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { field: 'daysInArrears', headerName: 'Jours Retard', width: 130, type: 'number', isExportable: true },
    { 
      field: 'provision', 
      headerName: 'Provision (FCFA)', 
      width: 160, 
      type: 'number',
      isExportable: true,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { 
      field: 'status', 
      headerName: 'Classification', 
      width: 150, 
      isExportable: true 
    },
  ],
  fetchData: fetchMockNplData,
  chartConfig: {
    type: 'pie',
    dataKey: 'amount',
    categoryKey: 'status',
    title: 'Volume NPL par Classification'
  }
};
