import { GridColDef } from '@mui/x-data-grid';

export type FilterType = 'text' | 'date' | 'date-range' | 'select' | 'multi-select' | 'number';

export interface ReportFilterOption {
  label: string;
  value: string | number;
}

export interface ReportFilter {
  id: string;
  label: string;
  type: FilterType;
  options?: ReportFilterOption[];
  defaultValue?: any;
  placeholder?: string;
}

export type ReportColumn = GridColDef & {
  // Extending standard MUI GridColDef with any custom reporting features if needed in the future
  isExportable?: boolean;
};

export interface ReportConfig {
  id: string;
  title: string;
  description: string;
  category: 'portfolio' | 'operations' | 'performance' | 'compliance' | 'other';
  icon?: React.ElementType; // Optional MUI Icon
  filters: ReportFilter[];
  columns: ReportColumn[];
  
  // Dynamic fetcher function or static mock data
  fetchData: (filters: Record<string, any>) => Promise<any[]>;
  
  // Optional chart configuration
  chartConfig?: {
    type: 'pie' | 'bar' | 'line';
    dataKey: string;
    categoryKey: string;
    title: string;
  };
}
