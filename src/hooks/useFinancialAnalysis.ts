import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { AnalysisData, FileUploadResult, MultiyearData } from '../types';
import { ApiService } from '../services/api';
import { ExcelProcessor } from '../services/excelProcessor';
import { FinancialCalculator } from '../services/financialCalculator';

interface AnalysisState {
  isProcessing: boolean;
  uploadProgress: number;
  processingStep: string;
  warnings: string[];
}

interface UseFinancialAnalysisReturn {
  // State
  analysisState: AnalysisState;
  
  // Actions
  uploadAndAnalyze: (file: File, yearConfig?: { primaryYear: number; startYear: number; endYear: number }) => Promise<FileUploadResult>;
  processManualData: (data: any) => Promise<void>;
  reanalyzeData: () => Promise<void>;
  exportAnalysis: (format: 'pdf' | 'excel', options?: any) => Promise<void>;
  
  // Utilities
  validateFinancialData: (data: any) => Promise<{ isValid: boolean; errors: string[] }>;
  calculateRatios: (data: MultiyearData) => any;
  getComplianceReport: () => any;
  getTrendAnalysis: () => any;
}

export const useFinancialAnalysis = (): UseFinancialAnalysisReturn => {
  const { state, setAnalysisData, setLoading, setError, clearError } = useApp();
  
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isProcessing: false,
    uploadProgress: 0,
    processingStep: '',
    warnings: [],
  });

  // Update processing state
  const updateProcessingState = useCallback((updates: Partial<AnalysisState>) => {
    setAnalysisState(prev => ({ ...prev, ...updates }));
  }, []);

  // Upload and analyze Excel file
  const uploadAndAnalyze = useCallback(async (file: File, yearConfig?: { primaryYear: number; startYear: number; endYear: number }): Promise<FileUploadResult> => {
    clearError();
    updateProcessingState({ 
      isProcessing: true, 
      uploadProgress: 0, 
      processingStep: 'Validation du fichier...',
      warnings: []
    });

    try {
      // Step 1: Process Excel file locally
      updateProcessingState({ 
        uploadProgress: 20, 
        processingStep: 'Lecture du fichier Excel...' 
      });

      const excelResult = await ExcelProcessor.processExcelFile(file, yearConfig);
      
      if (!excelResult.success) {
        return {
          success: false,
          error: excelResult.error,
        };
      }

      // Step 2: Calculate financial ratios and analysis
      updateProcessingState({ 
        uploadProgress: 50, 
        processingStep: 'Calcul des ratios financiers...' 
      });

      const calculationResult = FinancialCalculator.calculateAnalysis(
        excelResult.data!,
        state.sector
      );

      // Step 3: Prepare final analysis data
      updateProcessingState({ 
        uploadProgress: 80, 
        processingStep: 'Préparation de l\'analyse...' 
      });

      const analysisData: AnalysisData = {
        multiyear_data: excelResult.data,
        score: calculationResult.score,
        insights: calculationResult.insights,
        recommendations: calculationResult.recommendations,
      };

      // Step 4: Save analysis data
      updateProcessingState({ 
        uploadProgress: 100, 
        processingStep: 'Finalisation...' 
      });

      setAnalysisData(analysisData);

      // Update warnings if any
      if (excelResult.warnings && excelResult.warnings.length > 0) {
        updateProcessingState({ warnings: excelResult.warnings });
      }

      return {
        success: true,
        data: analysisData,
        filename: file.name,
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du traitement du fichier';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      updateProcessingState({ 
        isProcessing: false, 
        uploadProgress: 0, 
        processingStep: '' 
      });
    }
  }, [clearError, setAnalysisData, setError, state.sector, updateProcessingState]);

  // Process manual data input
  const processManualData = useCallback(async (data: any): Promise<void> => {
    clearError();
    setLoading(true);
    
    updateProcessingState({ 
      isProcessing: true, 
      processingStep: 'Validation des données...' 
    });

    try {
      // Validate data first
      const validation = await validateFinancialData(data);
      if (!validation.isValid) {
        throw new Error(`Données invalides: ${validation.errors.join(', ')}`);
      }

      updateProcessingState({ processingStep: 'Calcul des ratios...' });

      // Calculate analysis
      const calculationResult = FinancialCalculator.calculateAnalysis(data, state.sector);

      const analysisData: AnalysisData = {
        multiyear_data: data,
        score: calculationResult.score,
        insights: calculationResult.insights,
        recommendations: calculationResult.recommendations,
      };

      setAnalysisData(analysisData);

    } catch (error: any) {
      setError(error.message || 'Erreur lors du traitement des données');
      throw error;
    } finally {
      setLoading(false);
      updateProcessingState({ 
        isProcessing: false, 
        processingStep: '' 
      });
    }
  }, [clearError, setLoading, setError, setAnalysisData, state.sector, updateProcessingState]);

  // Re-analyze existing data (useful when sector changes)
  const reanalyzeData = useCallback(async (): Promise<void> => {
    if (!state.analysisData?.multiyear_data) {
      throw new Error('Aucune donnée à réanalyser');
    }

    clearError();
    setLoading(true);

    try {
      const multiyearData = state.analysisData.multiyear_data || state.analysisData.data?.multiyear_data;
      
      if (!multiyearData) {
        throw new Error('Données d\'analyse invalides');
      }

      const calculationResult = FinancialCalculator.calculateAnalysis(
        multiyearData,
        state.sector
      );

      const updatedAnalysisData: AnalysisData = {
        ...state.analysisData,
        score: calculationResult.score,
        insights: calculationResult.insights,
        recommendations: calculationResult.recommendations,
      };

      setAnalysisData(updatedAnalysisData);

    } catch (error: any) {
      setError(error.message || 'Erreur lors de la réanalyse');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [state.analysisData, state.sector, clearError, setLoading, setError, setAnalysisData]);

  // Export analysis
  const exportAnalysis = useCallback(async (
    format: 'pdf' | 'excel', 
    options = {}
  ): Promise<void> => {
    if (!state.analysisData) {
      throw new Error('Aucune analyse à exporter');
    }

    clearError();
    setLoading(true);

    try {
      const exportOptions = {
        format,
        includeCharts: true,
        includeRecommendations: true,
        language: state.language,
        ...options,
      };

      const response = await ApiService.generateReport(state.analysisData, exportOptions);
      
      if (response.success && response.data) {
        // Download the file
        const blob = await ApiService.downloadReport(response.data.downloadUrl);
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(response.error || 'Erreur lors de l\'export');
      }

    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'export');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [state.analysisData, state.language, clearError, setLoading, setError]);

  // Validate financial data
  const validateFinancialData = useCallback(async (data: any): Promise<{ isValid: boolean; errors: string[] }> => {
    try {
      const response = await ApiService.validateData(data);
      if (response.success && response.data) {
        return response.data;
      } else {
        return {
          isValid: false,
          errors: [response.error || 'Erreur de validation']
        };
      }
    } catch (error: any) {
      return {
        isValid: false,
        errors: [error.message || 'Erreur de validation']
      };
    }
  }, []);

  // Calculate ratios for given data
  const calculateRatios = useCallback((data: MultiyearData) => {
    try {
      return FinancialCalculator.calculateAnalysis(data, state.sector);
    } catch (error) {
      console.error('Error calculating ratios:', error);
      return null;
    }
  }, [state.sector]);

  // Get compliance report
  const getComplianceReport = useCallback(() => {
    if (!state.analysisData?.multiyear_data) return null;

    try {
      const multiyearData = state.analysisData.multiyear_data || state.analysisData.data?.multiyear_data;
      if (!multiyearData) return null;

      // Get latest year data
      const years = Object.entries(multiyearData).sort(([,a], [,b]) => b.year - a.year);
      const latestData = years[0][1];
      
      const ratios = FinancialCalculator.calculateRatios(latestData.data);
      return FinancialCalculator.checkBceaoCompliance(ratios, state.sector);
    } catch (error) {
      console.error('Error generating compliance report:', error);
      return null;
    }
  }, [state.analysisData, state.sector]);

  // Get trend analysis
  const getTrendAnalysis = useCallback(() => {
    if (!state.analysisData?.multiyear_data) return null;

    try {
      const multiyearData = state.analysisData.multiyear_data || state.analysisData.data?.multiyear_data;
      if (!multiyearData) return null;

      const years = Object.entries(multiyearData).sort(([,a], [,b]) => a.year - b.year);
      
      if (years.length < 2) return null;

      const trends: any = {};
      
      // Calculate trends for key metrics
      const keyMetrics = [
        'chiffre_affaires',
        'resultat_net',
        'total_actif',
        'capitaux_propres'
      ];

      keyMetrics.forEach(metric => {
        const values = years.map(([, data]: [string, any]) => data.data[metric] || 0);
        const growth = values.map((value: number, index: number) => {
          if (index === 0) return 0;
          const previousValue = values[index - 1];
          return previousValue !== 0 ? ((value - previousValue) / previousValue) * 100 : 0;
        });

        trends[metric] = {
          values,
          growth,
          averageGrowth: growth.length > 1 ? growth.slice(1).reduce((a, b) => a + b, 0) / (growth.length - 1) : 0,
          trend: growth.length > 1 && growth[growth.length - 1] > growth[1] ? 'positive' : 'negative'
        };
      });

      return trends;
    } catch (error) {
      console.error('Error calculating trend analysis:', error);
      return null;
    }
  }, [state.analysisData]);

  return {
    analysisState,
    uploadAndAnalyze,
    processManualData,
    reanalyzeData,
    exportAnalysis,
    validateFinancialData,
    calculateRatios,
    getComplianceReport,
    getTrendAnalysis,
  };
};

export default useFinancialAnalysis;