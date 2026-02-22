import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartConfiguration,
  BarController,
  LineController
} from 'chart.js';

// Register Chart.js components including controllers
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController
);

export interface ChartImageConfig {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export class ChartImageService {
  private static instance: ChartImageService;
  private defaultConfig: ChartImageConfig = {
    width: 800,
    height: 400,
    devicePixelRatio: 2
  };

  private constructor() {
    // Ensure Chart.js is properly initialized
    console.log('ChartImageService initialized with Chart.js version:', ChartJS.version || 'unknown');
  }

  public static getInstance(): ChartImageService {
    if (!ChartImageService.instance) {
      ChartImageService.instance = new ChartImageService();
    }
    return ChartImageService.instance;
  }

  // Test function to verify chart generation works
  public async testChartGeneration(): Promise<string> {
    console.log('Testing chart generation...');
    
    const testData = {
      'test1': {
        year: 2023,
        data: { chiffre_affaires: 1000000 }
      },
      'test2': {
        year: 2024,
        data: { chiffre_affaires: 1200000 }
      }
    };

    try {
      const testChart = await this.generateRevenueEvolutionChart(testData);
      console.log('Test chart generated successfully, length:', testChart.length);
      return testChart;
    } catch (error) {
      console.error('Test chart generation failed:', error);
      throw error;
    }
  }

  public async generateRevenueEvolutionChart(
    multiyearData: any,
    config: Partial<ChartImageConfig> = {}
  ): Promise<string> {
    const chartConfig = { ...this.defaultConfig, ...config };
    
    console.log('Generating revenue chart with data:', multiyearData);
    
    if (!multiyearData || typeof multiyearData !== 'object') {
      throw new Error('Invalid multiyearData provided to generateRevenueEvolutionChart');
    }
    
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });

    if (sortedKeys.length === 0) {
      throw new Error('No data keys found in multiyearData for revenue chart');
    }

    const labels = sortedKeys.map(key => {
      const year = multiyearData[key].year || key;
      return year.toString();
    });
    
    const data = sortedKeys.map(key => {
      const chiffresAffaires = multiyearData[key].data?.chiffre_affaires || 
                               multiyearData[key].chiffre_affaires || 
                               0;
      console.log(`Revenue for ${key}:`, chiffresAffaires);
      return chiffresAffaires;
    });

    console.log('Revenue chart - labels:', labels);
    console.log('Revenue chart - data:', data);

    if (data.every(value => value === 0)) {
      console.warn('All revenue data points are zero');
    }

    const chartConfiguration: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Chiffre d\'Affaires (FCFA)',
          data,
          backgroundColor: '#2c5aa0',
          borderColor: '#1f4e79',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        animation: {
          duration: 0
        },
        plugins: {
          title: {
            display: true,
            text: '📈 Évolution du Chiffre d\'Affaires',
            font: {
              size: 16,
              weight: 'bold'
            },
            color: '#1f4e79'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('fr-FR').format(value as number) + ' FCFA';
              }
            }
          }
        }
      }
    };

    return this.createChartImage(chartConfiguration, chartConfig);
  }

  public async generateProfitEvolutionChart(
    multiyearData: any,
    config: Partial<ChartImageConfig> = {}
  ): Promise<string> {
    const chartConfig = { ...this.defaultConfig, ...config };
    
    console.log('Generating profit chart with data:', multiyearData);
    
    if (!multiyearData || typeof multiyearData !== 'object') {
      throw new Error('Invalid multiyearData provided to generateProfitEvolutionChart');
    }
    
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year || parseInt(a);
      const bYear = multiyearData[b].year || parseInt(b);
      return aYear - bYear;
    });

    if (sortedKeys.length === 0) {
      throw new Error('No data keys found in multiyearData for profit chart');
    }

    const labels = sortedKeys.map(key => {
      const year = multiyearData[key].year || key;
      return year.toString();
    });
    
    const data = sortedKeys.map(key => {
      const resultatNet = multiyearData[key].data?.resultat_net || 
                          multiyearData[key].resultat_net || 
                          0;
      console.log(`Profit for ${key}:`, resultatNet);
      return resultatNet;
    });

    console.log('Profit chart - labels:', labels);
    console.log('Profit chart - data:', data);

    const chartConfiguration: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Résultat Net (FCFA)',
          data,
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          borderColor: '#28a745',
          borderWidth: 3,
          pointBackgroundColor: '#28a745',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          tension: 0.1,
          fill: true
        }]
      },
      options: {
        responsive: false,
        animation: {
          duration: 0
        },
        plugins: {
          title: {
            display: true,
            text: '💰 Évolution du Résultat Net',
            font: {
              size: 16,
              weight: 'bold'
            },
            color: '#1f4e79'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('fr-FR').format(value as number) + ' FCFA';
              }
            }
          }
        }
      }
    };

    return this.createChartImage(chartConfiguration, chartConfig);
  }

  public async generateRatiosChart(
    multiyearData: any,
    config: Partial<ChartImageConfig> = {}
  ): Promise<string> {
    const chartConfig = { ...this.defaultConfig, ...config };
    
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year;
      const bYear = multiyearData[b].year;
      return aYear - bYear;
    });

    const labels = sortedKeys.map(key => multiyearData[key].year.toString());
    
    // Calculate key ratios
    const roeData = sortedKeys.map(key => {
      const data = multiyearData[key].data;
      return data.resultat_net && data.capitaux_propres 
        ? (data.resultat_net / data.capitaux_propres) * 100 
        : 0;
    });

    const roaData = sortedKeys.map(key => {
      const data = multiyearData[key].data;
      return data.resultat_net && data.total_actif 
        ? (data.resultat_net / data.total_actif) * 100 
        : 0;
    });

    const autonomyData = sortedKeys.map(key => {
      const data = multiyearData[key].data;
      return data.capitaux_propres && data.total_actif 
        ? (data.capitaux_propres / data.total_actif) * 100 
        : 0;
    });

    const chartConfiguration: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'ROE (%)',
            data: roeData,
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.1
          },
          {
            label: 'ROA (%)',
            data: roaData,
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.1
          },
          {
            label: 'Autonomie Financière (%)',
            data: autonomyData,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: false,
        animation: {
          duration: 0
        },
        plugins: {
          title: {
            display: true,
            text: '📊 Évolution des Ratios Financiers',
            font: {
              size: 16,
              weight: 'bold'
            },
            color: '#1f4e79'
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    };

    return this.createChartImage(chartConfiguration, chartConfig);
  }

  public async generateCashFlowChart(
    multiyearData: any,
    config: Partial<ChartImageConfig> = {}
  ): Promise<string> {
    const chartConfig = { ...this.defaultConfig, ...config };
    
    const sortedKeys = Object.keys(multiyearData).sort((a, b) => {
      const aYear = multiyearData[a].year;
      const bYear = multiyearData[b].year;
      return aYear - bYear;
    });

    const labels = sortedKeys.map(key => multiyearData[key].year.toString());
    
    const operationalData = sortedKeys.map(key => 
      multiyearData[key].data.flux_tresorerie_activites_operationnelles || 0
    );
    
    const investmentData = sortedKeys.map(key => 
      multiyearData[key].data.flux_tresorerie_activites_investissement || 0
    );
    
    const financingData = sortedKeys.map(key => 
      multiyearData[key].data.flux_tresorerie_activites_financement || 0
    );

    const chartConfiguration: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Flux Opérationnels',
            data: operationalData,
            backgroundColor: '#28a745',
            borderColor: '#1e7e34',
            borderWidth: 1
          },
          {
            label: 'Flux d\'Investissement',
            data: investmentData,
            backgroundColor: '#dc3545',
            borderColor: '#c82333',
            borderWidth: 1
          },
          {
            label: 'Flux de Financement',
            data: financingData,
            backgroundColor: '#007bff',
            borderColor: '#0056b3',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: false,
        animation: {
          duration: 0
        },
        plugins: {
          title: {
            display: true,
            text: '💧 Flux de Trésorerie par Activité',
            font: {
              size: 16,
              weight: 'bold'
            },
            color: '#1f4e79'
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('fr-FR').format(value as number) + ' FCFA';
              }
            }
          }
        }
      }
    };

    return this.createChartImage(chartConfiguration, chartConfig);
  }

  private createChartImage(
    chartConfig: ChartConfiguration,
    imageConfig: ChartImageConfig
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Creating chart image with config:', { chartConfig: chartConfig.type, imageConfig });
        
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const error = new Error('Could not get canvas context');
          console.error('Canvas context error:', error);
          reject(error);
          return;
        }

        // Set canvas dimensions with device pixel ratio
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = imageConfig.width * devicePixelRatio;
        canvas.height = imageConfig.height * devicePixelRatio;
        canvas.style.width = imageConfig.width + 'px';
        canvas.style.height = imageConfig.height + 'px';
        
        // Scale the context for high DPI displays
        ctx.scale(devicePixelRatio, devicePixelRatio);

        console.log('Canvas created with dimensions:', canvas.width, 'x', canvas.height, 'DPR:', devicePixelRatio);

        // Create chart with animation disabled and better error handling
        const finalConfig: ChartConfiguration = {
          ...chartConfig,
          options: {
            ...chartConfig.options,
            responsive: false,
            animation: {
              duration: 0
            },
            maintainAspectRatio: false,
            // Ensure proper rendering
            layout: {
              padding: 10
            }
          }
        };

        let chart: ChartJS | null = null;
        
        try {
          chart = new ChartJS(ctx, finalConfig);
          console.log('Chart created successfully');

          // Use requestAnimationFrame for better rendering timing
          const convertChart = () => {
            try {
              console.log('Converting chart to image...');
              
              // Ensure chart is fully rendered
              if (!chart) {
                throw new Error('Chart is null during conversion');
              }
              
              // Convert to base64 image with error handling
              const imageDataUrl = canvas.toDataURL('image/png', 1.0);
              
              if (!imageDataUrl || imageDataUrl === 'data:,') {
                throw new Error('Failed to generate image data URL');
              }
              
              console.log('Chart converted to image successfully, data URL length:', imageDataUrl.length);
              
              chart.destroy();
              resolve(imageDataUrl);
              
            } catch (conversionError) {
              console.error('Error converting chart to image:', conversionError);
              if (chart) chart.destroy();
              reject(conversionError);
            }
          };

          // Use multiple fallback methods for timing
          if (chart.data.datasets.length > 0 && chart.data.labels && chart.data.labels.length > 0) {
            // Chart has data, proceed with conversion
            requestAnimationFrame(() => {
              setTimeout(convertChart, 100);
            });
          } else {
            throw new Error('Chart has no data to render');
          }

        } catch (chartError) {
          console.error('Error creating Chart.js instance:', chartError);
          reject(chartError);
        }

      } catch (error) {
        console.error('Error in createChartImage setup:', error);
        reject(error);
      }
    });
  }

  public async generateAllCharts(multiyearData: any): Promise<{
    revenueChart: string;
    profitChart: string;
    ratiosChart: string;
    cashFlowChart: string;
  }> {
    try {
      console.log('Starting chart generation for multiyear data:', Object.keys(multiyearData));
      
      // Generate charts with error handling for each
      const results = await Promise.allSettled([
        this.generateRevenueEvolutionChart(multiyearData),
        this.generateProfitEvolutionChart(multiyearData),
        this.generateRatiosChart(multiyearData),
        this.generateCashFlowChart(multiyearData)
      ]);

      const charts = {
        revenueChart: '',
        profitChart: '',
        ratiosChart: '',
        cashFlowChart: ''
      };

      if (results[0].status === 'fulfilled') {
        charts.revenueChart = results[0].value;
        console.log('Revenue chart generated successfully');
      } else {
        console.error('Revenue chart failed:', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        charts.profitChart = results[1].value;
        console.log('Profit chart generated successfully');
      } else {
        console.error('Profit chart failed:', results[1].reason);
      }

      if (results[2].status === 'fulfilled') {
        charts.ratiosChart = results[2].value;
        console.log('Ratios chart generated successfully');
      } else {
        console.error('Ratios chart failed:', results[2].reason);
      }

      if (results[3].status === 'fulfilled') {
        charts.cashFlowChart = results[3].value;
        console.log('Cash flow chart generated successfully');
      } else {
        console.error('Cash flow chart failed:', results[3].reason);
      }

      console.log('Chart generation completed. Generated charts:', Object.keys(charts).filter(k => charts[k as keyof typeof charts]));
      return charts;

    } catch (error) {
      console.error('Error in generateAllCharts:', error);
      return {
        revenueChart: '',
        profitChart: '',
        ratiosChart: '',
        cashFlowChart: ''
      };
    }
  }
}

export const chartImageService = ChartImageService.getInstance();