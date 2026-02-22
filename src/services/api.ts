import axios, { AxiosResponse } from 'axios';
import { AnalysisData, FileUploadResult, ApiResponse } from '../types';

// API Configuration - Dynamic URL based on current host
const getApiBaseUrl = (): string => {
  // If explicit env var is set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Otherwise, use same host as frontend with backend port
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // VM IP or localhost or domain
  const apiPort = process.env.REACT_APP_API_PORT || '5006';

  return `${protocol}//${hostname}:${apiPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();

// Token management
export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem('optimus_access_token');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('optimus_refresh_token');
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('optimus_access_token', accessToken);
    localStorage.setItem('optimus_refresh_token', refreshToken);
  },

  clearTokens(): void {
    localStorage.removeItem('optimus_access_token');
    localStorage.removeItem('optimus_refresh_token');
    localStorage.removeItem('auth_token'); // Legacy token
    localStorage.removeItem('optimus_user'); // Legacy user data
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken() || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token first
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          
          // Update access token
          tokenManager.setTokens(response.data.accessToken, refreshToken);
          
          // Update authorization header and retry original request
          originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
          return api.request(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          console.error('Token refresh failed:', refreshError);
          tokenManager.clearTokens();
          window.location.href = '/login';
        }
      } else {
        // No refresh token, clear all tokens and redirect
        console.log('No refresh token available, redirecting to login');
        tokenManager.clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    department?: string;
    jobTitle?: string;
    permissions: string[];
    lastLogin: string;
    isActive: boolean;
  };
  accessToken: string;
  refreshToken: string;
  message?: string;
}

// API Service Methods
export class ApiService {
  // Authentication Methods
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<LoginResponse> = await api.post('/auth/login', credentials);
      
      // Store tokens (backend returns them at root level)
      tokenManager.setTokens(
        response.data.accessToken,
        response.data.refreshToken
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  static async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      tokenManager.clearTokens();
    }
  }

  static async refreshToken(): Promise<{ accessToken: string; expiresIn: string }> {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      
      // Update access token
      tokenManager.setTokens(response.data.accessToken, refreshToken);
      
      return response.data;
    } catch (error: any) {
      tokenManager.clearTokens();
      throw error;
    }
  }

  static async getCurrentUser(): Promise<LoginResponse['user']> {
    try {
      const response = await api.get('/auth/me');
      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get user profile');
    }
  }
  // File Upload and Processing
  static async uploadExcelFile(file: File): Promise<FileUploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response: AxiosResponse<ApiResponse<AnalysisData>> = await api.post(
        '/upload/excel',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return {
        success: response.data.success,
        data: response.data.data,
        filename: file.name,
        error: response.data.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors du téléchargement du fichier',
      };
    }
  }

  // Manual Data Processing
  static async processManualData(data: any): Promise<ApiResponse<AnalysisData>> {
    try {
      const response: AxiosResponse<ApiResponse<AnalysisData>> = await api.post(
        '/analysis/manual',
        data
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors du traitement des données',
      };
    }
  }

  // Get Analysis Results
  static async getAnalysis(analysisId: string): Promise<ApiResponse<AnalysisData>> {
    try {
      const response: AxiosResponse<ApiResponse<AnalysisData>> = await api.get(
        `/analysis/${analysisId}`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération de l\'analyse',
      };
    }
  }

  // Generate Reports
  static async generateReport(
    analysisData: AnalysisData,
    options: {
      format: 'pdf' | 'excel';
      includeCharts: boolean;
      includeRecommendations: boolean;
      language: 'fr' | 'en';
    }
  ): Promise<ApiResponse<{ downloadUrl: string; filename: string }>> {
    try {
      const response = await api.post('/reports/generate', {
        analysisData,
        options,
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la génération du rapport',
      };
    }
  }

  // Download Report
  static async downloadReport(downloadUrl: string): Promise<Blob> {
    try {
      const response = await api.get(downloadUrl, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error: any) {
      throw new Error('Erreur lors du téléchargement du rapport');
    }
  }

  // Get BCEAO Norms
  static async getBceaoNorms(): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/norms/bceao');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des normes BCEAO',
      };
    }
  }

  // Get Sectoral Norms
  static async getSectoralNorms(sector: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/norms/sectoral/${sector}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des normes sectorielles',
      };
    }
  }

  // Validate Financial Data
  static async validateData(data: any): Promise<ApiResponse<{ isValid: boolean; errors: string[] }>> {
    try {
      const response = await api.post('/validation/financial', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la validation des données',
      };
    }
  }

  // Get Template File
  static async getTemplateFile(): Promise<Blob> {
    try {
      const response = await api.get('/templates/excel', {
        responseType: 'blob',
      });
      return response.data;
    } catch (error: any) {
      throw new Error('Erreur lors du téléchargement du template');
    }
  }

  // Clients Management
  static async getClients(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/clients');
      return {
        success: true,
        data: response.data.clients || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des clients',
      };
    }
  }

  static async getClient(clientId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/clients/${clientId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération du client',
      };
    }
  }

  static async createClient(clientData: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/clients', clientData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la création du client',
      };
    }
  }

  // Legacy workflow management methods removed - use getWorkflows() and getApplications() with filters instead

  // Analytics Methods
  static async getAnalyticsDashboard(filters?: {
    branch?: string;
    manager?: string;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const queryParams = new URLSearchParams();
      if (filters?.branch) queryParams.append('branch', filters.branch);
      if (filters?.manager) queryParams.append('manager', filters.manager);
      if (filters?.timeRange) queryParams.append('timeRange', filters.timeRange);
      if (filters?.startDate) queryParams.append('startDate', filters.startDate);
      if (filters?.endDate) queryParams.append('endDate', filters.endDate);

      const response = await api.get(`/analytics/dashboard?${queryParams.toString()}`);
      return {
        success: true,
        data: response.data.data.workflows || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des données analytiques',
      };
    }
  }

  static async getBranchesPerformance(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/analytics/branches');
      return {
        success: true,
        data: response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des données de branches',
      };
    }
  }

  static async getManagersPerformance(branch?: string): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = branch ? `?branch=${branch}` : '';
      const response = await api.get(`/analytics/managers${queryParams}`);
      return {
        success: true,
        data: response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des données de chargés d\'affaires',
      };
    }
  }

  // User Management Methods
  static async getUsers(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/users');
      return {
        success: true,
        data: response.data.users || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des utilisateurs',
      };
    }
  }

  static async getDepartments(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/departments');
      return {
        success: true,
        data: response.data.departments || response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des départements',
      };
    }
  }

  static async getBranches(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/branches');
      return {
        success: true,
        data: response.data.branches || response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des agences',
      };
    }
  }

  static async createDepartment(departmentData: {
    name: string;
    code: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/departments', departmentData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la création du département'
      };
    }
  }

  static async updateDepartment(departmentId: string, departmentData: {
    name?: string;
    code?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/departments/${departmentId}`, departmentData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la mise à jour du département'
      };
    }
  }

  static async createBranch(branchData: {
    name: string;
    code: string;
    address?: string;
    city?: string;
    country?: string;
    manager?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/branches', branchData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la création de l\'agence'
      };
    }
  }

  static async updateBranch(branchId: string, branchData: {
    name?: string;
    code?: string;
    address?: string;
    city?: string;
    country?: string;
    manager?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/branches/${branchId}`, branchData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la mise à jour de l\'agence'
      };
    }
  }

  static async getApprovalLimits(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/approval-limits');
      return {
        success: true,
        data: response.data.approvalLimits || response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des limites d\'approbation',
      };
    }
  }

  static async getUser(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/users/${userId}`);
      return {
        success: true,
        data: response.data.user
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération de l\'utilisateur',
      };
    }
  }

  static async createUser(userData: {
    name: string;
    email: string;
    role: string;
    department?: string;
    jobTitle?: string;
    branch?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/users', userData);
      return {
        success: true,
        data: response.data.user,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la création de l\'utilisateur',
      };
    }
  }

  static async updateUser(userId: string, userData: {
    name?: string;
    role?: string;
    department?: string;
    jobTitle?: string;
    branch?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return {
        success: true,
        data: response.data.user,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la mise à jour de l\'utilisateur',
      };
    }
  }

  static async resetUserPassword(userId: string): Promise<ApiResponse<{ temporaryPassword: string }>> {
    try {
      const response = await api.post(`/users/${userId}/reset-password`);
      return {
        success: true,
        data: {
          temporaryPassword: response.data.temporaryPassword
        },
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la réinitialisation du mot de passe',
      };
    }
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      return {
        success: true,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors du changement de mot de passe',
      };
    }
  }

  static async updateUserProfile(profileData: { phone: string }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put('/auth/profile', profileData);
      return {
        success: true,
        data: response.data,
        message: 'Profil mis à jour avec succès'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la mise à jour du profil',
      };
    }
  }

  // Roles API
  static async getRoles(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/roles');
      return {
        success: true,
        data: response.data.roles || response.data.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des rôles',
        data: []
      };
    }
  }

  static async updateRolePermissions(role: string, roleData: {
    label: string;
    description: string;
    permissions: string[];
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/roles/${role}`, roleData);
      return {
        success: true,
        data: response.data.role,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la mise à jour du rôle'
      };
    }
  }

  // Workflows API
  static async getWorkflows(filters?: {
    status?: string;
    branch?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
    userRole?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.branch) params.append('branch', filters.branch);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.userRole) params.append('userRole', filters.userRole);

      const response = await api.get(`/workflows?${params.toString()}`);
      return {
        success: true,
        data: response.data.workflows || response.data.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des workflows',
      };
    }
  }

  // Applications API
  static async getApplications(filters?: {
    status?: string;
    branch?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.branch) params.append('branch', filters.branch);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      if (filters?.userId) params.append('userId', filters.userId);

      const response = await api.get(`/applications?${params.toString()}`);
      return {
        success: true,
        data: response.data.applications || response.data.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des demandes',
      };
    }
  }

  static async getApplicationById(applicationId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/applications/${applicationId}`);
      return {
        success: true,
        data: response.data.application || response.data.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération de la demande',
      };
    }
  }

  static async createApplication(applicationData: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/applications', applicationData);
      return {
        success: true,
        data: response.data.application || response.data.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la création de la demande',
      };
    }
  }

  static async updateApplication(applicationId: string, updateData: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/applications/${applicationId}`, updateData);
      return {
        success: true,
        data: response.data.application || response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la mise à jour de la demande',
      };
    }
  }

  static async getCreditAnalysts(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/users/credit-analysts');
      return {
        success: true,
        data: response.data.analysts || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des analystes',
      };
    }
  }

  // Credit Types API
  static async getCreditTypes(includeInactive?: boolean): Promise<ApiResponse<any[]>> {
    try {
      const params = includeInactive ? '?includeInactive=true' : '';
      const response = await api.get(`/credit-types${params}`);
      return {
        success: true,
        data: response.data.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des types de crédit',
      };
    }
  }

  static async getCreditType(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/credit-types/${id}`);
      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération du type de crédit',
      };
    }
  }

  static async createCreditType(creditTypeData: {
    name: string;
    code: string;
    description?: string;
    defaultRate: number;
    minRate?: number;
    maxRate?: number;
    minDuration?: number;
    maxDuration?: number;
    requiresCollateral?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/credit-types', creditTypeData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la création du type de crédit',
      };
    }
  }

  static async updateCreditType(id: string, creditTypeData: {
    name?: string;
    code?: string;
    description?: string;
    defaultRate?: number;
    minRate?: number;
    maxRate?: number;
    minDuration?: number;
    maxDuration?: number;
    requiresCollateral?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/credit-types/${id}`, creditTypeData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la mise à jour du type de crédit',
      };
    }
  }

  static async deleteCreditType(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.delete(`/credit-types/${id}`);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la suppression du type de crédit',
      };
    }
  }

  // Workflow Configuration API
  static async getWorkflowStepDurations(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/workflow-config/steps');
      return {
        success: true,
        data: response.data.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la récupération des durées des étapes',
      };
    }
  }

  static async updateWorkflowStepDuration(stepId: string, updateData: {
    expectedDuration?: number;
    maxDuration?: number;
    displayName?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/workflow-config/steps/${stepId}`, updateData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la mise à jour de la durée de l\'étape',
      };
    }
  }

  // Health Check
  static async healthCheck(): Promise<ApiResponse<{ status: string; version: string }>> {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: 'Service indisponible',
      };
    }
  }
}

// Utility function to handle API errors
export const handleApiError = (error: any): string => {
  if (error.response) {
    // Server responded with error status
    return error.response.data?.message || `Erreur serveur: ${error.response.status}`;
  } else if (error.request) {
    // Request made but no response received
    return 'Erreur de connexion au serveur';
  } else {
    // Something else happened
    return error.message || 'Erreur inconnue';
  }
};

export default api;