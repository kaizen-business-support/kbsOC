import { ReportConfig } from '../../types/reports';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';

const fetchMockCreditScoringData = async (filters: Record<string, any>) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  let data = [
    { grade: 'A', count: 125, volume: 2500000000, avgScore: 850, defaultRate: '0.5%' },
    { grade: 'B', count: 340, volume: 4200000000, avgScore: 720, defaultRate: '1.2%' },
    { grade: 'C', count: 210, volume: 1800000000, avgScore: 650, defaultRate: '3.5%' },
    { grade: 'D', count: 85, volume: 450000000, avgScore: 580, defaultRate: '8.0%' },
    { grade: 'E', count: 22, volume: 85000000, avgScore: 510, defaultRate: '15.5%' },
  ];

  return data;
};

export const creditScoringStatsReportConfig: ReportConfig = {
  id: 'credit_scoring_stats',
  title: 'Statistiques de Scoring',
  description: 'Analyse de la distribution des scores de crédit et qualité globale du portefeuille.',
  category: 'performance',
  icon: AssessmentRoundedIcon,
  filters: [
    {
      id: 'dateRange',
      label: 'Période d\'analyse',
      type: 'date-range',
    }
  ],
  columns: [
    { field: 'grade', headerName: 'Classe de Risque', width: 150, isExportable: true },
    { field: 'count', headerName: 'Nombre de Dossiers', width: 160, type: 'number', isExportable: true },
    { 
      field: 'volume', 
      headerName: 'Volume (FCFA)', 
      width: 200, 
      type: 'number',
      isExportable: true,
      flex: 1,
      valueFormatter: (params: any) => new Intl.NumberFormat('fr-FR').format(params.value)
    },
    { field: 'avgScore', headerName: 'Score Moyen', width: 150, type: 'number', isExportable: true },
    { field: 'defaultRate', headerName: 'Taux de Défaut Historique', width: 200, isExportable: true },
  ],
  fetchData: fetchMockCreditScoringData,
  chartConfig: {
    type: 'pie',
    dataKey: 'count',
    categoryKey: 'grade',
    title: 'Distribution par Classe de Risque'
  }
};
