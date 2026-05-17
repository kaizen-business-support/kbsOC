import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  Divider
} from '@mui/material';
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector
} from '@mui/x-data-grid';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  FileDownload as DownloadIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { ReportConfig, ReportFilter } from '../../types/reports';

// Simple Pie Chart using Recharts (assuming recharts is available, otherwise fallback to simple visual)
// Since we don't know for sure if recharts is installed, we will use a robust fallback or basic implementation
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface DynamicReportViewerProps {
  config: ReportConfig;
  onBack?: () => void;
}

const COLORS = ['#1F4E79', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <Box>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
      </Box>
      <Box>
        <GridToolbarExport 
          csvOptions={{ fileName: 'export_rapport.csv', delimiter: ';' }}
          printOptions={{ disableToolbarButton: true }}
        />
      </Box>
    </GridToolbarContainer>
  );
}

export const DynamicReportViewer: React.FC<DynamicReportViewerProps> = ({ config, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [showChart, setShowChart] = useState(true);

  // Initialize filters and load data
  useEffect(() => {
    const initialFilters: Record<string, any> = {};
    config.filters.forEach(f => {
      if (f.defaultValue !== undefined) {
        initialFilters[f.id] = f.defaultValue;
      }
    });
    setFilterValues(initialFilters);
    
    // Load data immediately with initial filters
    setLoading(true);
    config.fetchData(initialFilters).then(result => {
      setData(result);
      setLoading(false);
    }).catch(error => {
      console.error('Failed to fetch report data', error);
      setLoading(false);
    });
  }, [config]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await config.fetchData(filterValues);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch report data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (id: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
  };

  const handleApplyFilters = () => {
    loadData();
  };

  // Prepare chart data if config exists
  const chartData = useMemo(() => {
    if (!config.chartConfig || !data.length) return [];
    
    const { categoryKey, dataKey } = config.chartConfig;
    const aggregated: Record<string, number> = {};
    
    data.forEach(item => {
      const cat = item[categoryKey] || 'Inconnu';
      const val = Number(item[dataKey]) || 0;
      aggregated[cat] = (aggregated[cat] || 0) + val;
    });
    
    return Object.keys(aggregated).map(key => ({
      name: key,
      value: aggregated[key]
    })).sort((a, b) => b.value - a.value);
  }, [data, config.chartConfig]);

  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.5s ease-in-out' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
            {config.title}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {config.description}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {onBack && (
            <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '10px' }}>
              Retour
            </Button>
          )}
          <Button 
            variant="contained" 
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{ 
              background: 'linear-gradient(135deg, #0F172A 0%, #1F4E79 100%)',
              color: '#FFFFFF',
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Actualiser
          </Button>
        </Box>
      </Box>

      {/* Dynamic Filter Bar */}
      <Card sx={{ mb: 3, borderRadius: '16px', border: 1, borderColor: 'divider', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterIcon sx={{ color: 'primary.main', mr: 1 }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>Filtres Dynamiques</Typography>
          </Box>
          <Grid container spacing={3} alignItems="flex-end">
            {config.filters.map((filter) => (
              <Grid item xs={12} sm={6} md={3} key={filter.id}>
                {filter.type === 'select' && filter.options ? (
                  <TextField
                    select
                    fullWidth
                    label={filter.label}
                    value={filterValues[filter.id] || ''}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  >
                    {filter.options.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                ) : filter.type === 'date-range' ? (
                  <TextField
                    fullWidth
                    type="date"
                    label={filter.label}
                    value={filterValues[filter.id] || ''}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                ) : (
                  <TextField
                    fullWidth
                    label={filter.label}
                    value={filterValues[filter.id] || ''}
                    onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                )}
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={handleApplyFilters}
                sx={{ height: 40, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
              >
                Appliquer les filtres
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Optional Chart Section */}
      {config.chartConfig && chartData.length > 0 && (
        <Paper sx={{ mb: 3, p: 3, borderRadius: '16px', border: 1, borderColor: 'divider', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary', display: 'flex', alignItems: 'center' }}>
                <PieChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                {config.chartConfig.title}
             </Typography>
             <Button size="small" onClick={() => setShowChart(!showChart)} sx={{ textTransform: 'none' }}>
               {showChart ? 'Masquer' : 'Afficher'}
             </Button>
           </Box>
           
           {showChart && (
             <Box sx={{ height: 300, width: '100%', mt: 2 }}>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={chartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={100}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {chartData.map((entry, index) => (
                       <Cell key={'cell-'+index} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <RechartsTooltip formatter={(value: number) => new Intl.NumberFormat('fr-FR').format(value)} />
                   <Legend verticalAlign="middle" align="right" layout="vertical" />
                 </PieChart>
               </ResponsiveContainer>
             </Box>
           )}
        </Paper>
      )}

      {/* Main DataGrid */}
      <Card sx={{ borderRadius: '16px', border: 1, borderColor: 'divider', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={data}
            columns={config.columns}
            loading={loading}
            slots={{ toolbar: CustomToolbar }}
            initialState={{
              pagination: { paginationModel: { pageSize: 15 } },
            }}
            pageSizeOptions={[15, 50, 100]}
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                borderBottom: 1,
                borderColor: 'divider',
                color: 'text.primary',
                fontWeight: 700,
                fontSize: '0.9rem'
              },
              '& .MuiDataGrid-cell': {
                borderBottom: 1,
                borderColor: 'divider',
                color: 'text.secondary'
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#F8FAFC'
              }
            }}
          />
        </Box>
      </Card>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Box>
  );
};
