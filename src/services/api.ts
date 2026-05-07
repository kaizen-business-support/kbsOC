import axios, { AxiosResponse } from 'axios';
import { AnalysisData, FileUploadResult, ApiResponse, ApprovalItem, CodirDashboardData, CodirTimelineData } from '../types';

// API Configuration - Uses same origin as browser (proxied via nginx on port 80)
const getApiBaseUrl = (): string => {
  return `${window.location.origin}/api`;
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

  setAccessToken(accessToken: string): void {
    localStorage.setItem('optimus_access_token', accessToken);
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

// Redirect to login without causing a reload loop when already on the login page
const redirectToLogin = () => {
  const onLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
  if (!onLoginPage) {
    window.location.href = '/login';
  }
};

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
          redirectToLogin();
        }
      } else {
        // No refresh token — user is not authenticated
        tokenManager.clearTokens();
        redirectToLogin();
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

  // ── Workflow approval ───────────────────────────────────────────────────────
  static async approveWorkflow(
    applicationId: string,
    payload: { userId: string; decision: 'APPROVED' | 'REJECTED' | 'REQUEST_INFO' | 'TRANSFER'; comments?: string; stepId?: string; stepName?: string }
  ): Promise<{ success: boolean; message?: string; status?: string; error?: string }> {
    try {
      const response = await api.post(`/workflows/${applicationId}/approve`, payload);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Erreur lors de la soumission de la décision');
    }
  }

  static async getPendingApprovals(): Promise<ApiResponse<ApprovalItem[]>> {
    try {
      const response = await api.get('/workflows/pending-approvals');
      return { success: true, data: response.data.data || [] };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement approbations' };
    }
  }

  static async getPendingApprovalsCount(): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await api.get('/workflows/pending-approvals/count');
      return { success: true, data: { count: response.data.count ?? 0 } };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur comptage' };
    }
  }

  // ── CODIR Dashboard ───────────────────────────────────────────────────────

  static async getCodirDashboard(): Promise<ApiResponse<CodirDashboardData>> {
    try {
      const response = await api.get('/codir/dashboard');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement dashboard CODIR' };
    }
  }

  static async codirRelance(stepId: string, message: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/codir/relance/${stepId}`, { message });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur relance' };
    }
  }

  static async codirEscalade(stepId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/codir/escalade/${stepId}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur escalade' };
    }
  }

  static async codirReassign(stepId: string, newAssigneeId: string, comment?: string): Promise<ApiResponse<void>> {
    try {
      await api.put(`/codir/reassign/${stepId}`, { newAssigneeId, comment });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur réaffectation' };
    }
  }

  static async codirGetAgents(role: string): Promise<ApiResponse<Array<{ id: string; name: string; role: string }>>> {
    try {
      const response = await api.get(`/codir/agents/${role}`);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement agents' };
    }
  }

  static async getCodirTimeline(): Promise<ApiResponse<CodirTimelineData>> {
    try {
      const response = await api.get('/codir/timeline');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur chargement timeline CODIR' };
    }
  }

  // ── OTP ────────────────────────────────────────────────────────────────────
  static async generateOtp(purpose: string): Promise<{ _testCode?: string }> {
    try {
      const response = await api.post('/otp/generate', { purpose });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Impossible de générer l\'OTP');
    }
  }

  static async verifyOtp(code: string, purpose: string): Promise<void> {
    try {
      const response = await api.post('/otp/verify', { code, purpose });
      if (!response.data.success) {
        throw new Error(response.data.error || 'OTP incorrect');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Code OTP incorrect');
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

  static async createApprovalLimit(data: {
    role: string;
    displayName: string;
    minAmount: number;
    maxAmount: number;
    currency?: string;
    reviewDuration?: number;
    maxReviewDuration?: number;
    description?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/approval-limits', data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la création' };
    }
  }

  static async updateApprovalLimit(id: string, data: Partial<{
    displayName: string;
    minAmount: number;
    maxAmount: number;
    currency: string;
    reviewDuration: number;
    maxReviewDuration: number;
    description: string;
    isActive: boolean;
    order: number;
  }>): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/approval-limits/${id}`, data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la mise à jour' };
    }
  }

  static async deleteApprovalLimit(id: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/approval-limits/${id}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la suppression' };
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
        data: {
          ...response.data.user,
          temporaryPassword: response.data.temporaryPassword,
        },
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la création de l\'utilisateur',
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
          temporaryPassword: response.data.data?.temporaryPassword,
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

  // ─── Announcements ───────────────────────────────────────────────────────────

  static async getActiveAnnouncements(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/announcements');
      return { success: true, data: response.data.data || [] };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur', data: [] };
    }
  }

  static async getAllAnnouncements(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/announcements/all');
      return { success: true, data: response.data.data || [] };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur', data: [] };
    }
  }

  static async createAnnouncement(data: { title: string; message: string; priority: string; expiresAt: string }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/announcements', data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la création' };
    }
  }

  static async updateAnnouncement(id: string, data: Partial<{ title: string; message: string; priority: string; expiresAt: string; isActive: boolean }>): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/announcements/${id}`, data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la mise à jour' };
    }
  }

  static async deleteAnnouncement(id: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/announcements/${id}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la suppression' };
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

  static async createRole(roleData: {
    role: string;
    label: string;
    description: string;
    permissions: string[];
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/roles', roleData);
      return {
        success: true,
        data: response.data.role,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Erreur lors de la création du rôle'
      };
    }
  }

  static async deleteRole(roleId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/roles/${roleId}`);
      return { success: true, message: response.data.message };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la suppression du rôle'
      };
    }
  }

  static async deleteBranch(branchId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/branches/${branchId}`);
      return { success: true, message: response.data.message };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la suppression de l\'agence'
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
    assignedAnalystId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.branch) params.append('branch', filters.branch);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.assignedAnalystId) params.append('assignedAnalystId', filters.assignedAnalystId);

      const response = await api.get(`/applications?${params.toString()}`);
      return {
        success: true,
        data: response.data.applications || response.data.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la récupération des demandes',
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
        error: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la création de la demande',
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

  static async getCreditTypeWorkflowSteps(creditTypeId: string) {
    const response = await api.get(`/credit-types/${creditTypeId}/workflow-steps`);
    return response.data;
  }

  static async createCreditTypeWorkflowStep(creditTypeId: string, step: {
    stepName: string; stepLabel: string; role: string; order: number;
    isRequired?: boolean; durationDays?: number; description?: string;
    conditionMinAmount?: number | null; conditionMaxAmount?: number | null;
  }) {
    const response = await api.post(`/credit-types/${creditTypeId}/workflow-steps`, step);
    return response.data;
  }

  static async updateCreditTypeWorkflowStep(creditTypeId: string, stepId: string, step: Partial<{
    stepName: string; stepLabel: string; role: string; order: number;
    isRequired: boolean; durationDays: number; description: string;
    conditionMinAmount: number | null; conditionMaxAmount: number | null;
  }>) {
    const response = await api.put(`/credit-types/${creditTypeId}/workflow-steps/${stepId}`, step);
    return response.data;
  }

  static async deleteCreditTypeWorkflowStep(creditTypeId: string, stepId: string) {
    const response = await api.delete(`/credit-types/${creditTypeId}/workflow-steps/${stepId}`);
    return response.data;
  }

  static async reorderCreditTypeWorkflowSteps(creditTypeId: string, steps: { id: string; order: number }[]) {
    const response = await api.put(`/credit-types/${creditTypeId}/workflow-steps/reorder`, { steps });
    return response.data;
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

  // ─── Generic HTTP helpers (used by multi-tenant pages) ───────────────────────

  static async get(path: string): Promise<any> {
    const response = await api.get(path);
    return response.data;
  }

  static async post(path: string, body?: any): Promise<any> {
    const response = await api.post(path, body);
    return response.data;
  }

  static async put(path: string, body?: any): Promise<any> {
    const response = await api.put(path, body);
    return response.data;
  }

  static async patch(path: string, body?: any): Promise<any> {
    const response = await api.patch(path, body);
    return response.data;
  }

  static async delete(path: string): Promise<any> {
    const response = await api.delete(path);
    return response.data;
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

  // ─── Notification Channels ────────────────────────────────────────────────────

  static async seedDefaultNotifications(): Promise<ApiResponse<{ created: number; skipped: number }>> {
    try {
      const response = await api.post('/notification-channels/seed-defaults');
      return { success: true, data: response.data.data, message: response.data.message };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors du chargement des défauts' };
    }
  }

  static async getNotificationChannels(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/notification-channels');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async updateNotificationChannel(type: string, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/notification-channels/${type}`, data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async testNotificationChannel(type: string, testAddress?: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.post(`/notification-channels/test/${type}`, { testAddress });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors du test' };
    }
  }

  // ─── Notification Templates ───────────────────────────────────────────────────

  static async getNotificationTemplates(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/notification-templates');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async previewNotificationTemplate(event: string, body: string, subject: string): Promise<ApiResponse<{ html: string; subject: string }>> {
    try {
      const response = await api.post('/notification-templates/preview', { event, body, subject });
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur lors de la prévisualisation' };
    }
  }

  static async createNotificationTemplate(data: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/notification-templates', data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async updateNotificationTemplate(id: string, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/notification-templates/${id}`, data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async deleteNotificationTemplate(id: string): Promise<ApiResponse<any>> {
    try {
      await api.delete(`/notification-templates/${id}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  // ─── Notification Rules ───────────────────────────────────────────────────────

  static async getNotificationRules(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/notification-rules');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async createNotificationRule(data: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/notification-rules', data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async updateNotificationRule(id: string, data: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/notification-rules/${id}`, data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async deleteNotificationRule(id: string): Promise<ApiResponse<any>> {
    try {
      await api.delete(`/notification-rules/${id}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  // ─── In-app Notifications ─────────────────────────────────────────────────────

  static async getMyNotifications(): Promise<ApiResponse<any[]>> {
    try {
      const response = await api.get('/notifications');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async getUnreadNotifCount(): Promise<ApiResponse<number>> {
    try {
      const response = await api.get('/notifications/count');
      return { success: true, data: response.data.count };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async markNotifRead(id: string): Promise<ApiResponse<any>> {
    try {
      await api.put(`/notifications/${id}/read`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  static async markAllNotifsRead(): Promise<ApiResponse<any>> {
    try {
      await api.put('/notifications/read-all');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || 'Erreur serveur' };
    }
  }

  // ─── Délégations de pouvoir ───────────────────────────────────────────────

  static async getDelegations(params?: { status?: string; delegatorId?: string; delegateId?: string }): Promise<any> {
    try {
      const res = await api.get('/delegations', { params });
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur délégations' };
    }
  }

  static async getMyDelegations(): Promise<any> {
    try {
      const res = await api.get('/delegations/my');
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mes délégations' };
    }
  }

  static async getDelegatableActions(): Promise<any> {
    try {
      const res = await api.get('/delegations/delegatable-actions');
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur actions déléguables' };
    }
  }

  static async createDelegation(payload: import('../types/delegation').CreateDelegationPayload): Promise<any> {
    try {
      const res = await api.post('/delegations', payload);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création délégation' };
    }
  }

  static async revokeDelegation(id: string): Promise<any> {
    try {
      const res = await api.patch(`/delegations/${id}/revoke`);
      return { success: true, message: res.data.message };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur révocation délégation' };
    }
  }
}

// ─── Auth: password lifecycle & 2FA admin ─────────────────────────────────────

export const authPasswordApi = {
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/auth/reset-password', { token, newPassword });
    return res.data;
  },

  async changePasswordForced(
    tempToken: string,
    newPassword: string
  ): Promise<{ success: boolean; accessToken: string; refreshToken: string; user: any }> {
    const res = await api.post('/auth/change-password-forced', { newPassword }, {
      headers: { Authorization: `Bearer ${tempToken}` }
    });
    return res.data;
  },

  async setUser2FARequired(userId: string, required: boolean): Promise<{ success: boolean }> {
    const res = await api.put(`/auth/2fa/users/${userId}/2fa-required`, { required });
    return res.data;
  },

  async setRole2FARequired(role: string, required: boolean): Promise<{ success: boolean }> {
    const res = await api.put(`/auth/2fa/roles/${role}/2fa-required`, { required });
    return res.data;
  },
};

// ─── Dispatching (Responsable Analyste) ──────────────────────────────────────
export const dispatchingApi = {
  async getWorkload(): Promise<ApiResponse<any[]>> {
    try {
      const res = await api.get('/dispatching/workload');
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur workload' };
    }
  },

  async getPendingApplications(): Promise<ApiResponse<any[]>> {
    try {
      const res = await api.get('/dispatching/pending');
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur pending' };
    }
  },

  async suggestAnalyst(applicationId: string): Promise<ApiResponse<any>> {
    try {
      const res = await api.get(`/dispatching/suggest/${applicationId}`);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur suggestion' };
    }
  },

  async assignAnalyst(applicationId: string, userId: string, comment?: string, isReassign = false): Promise<ApiResponse<any>> {
    try {
      const res = await api.post('/dispatching/assign', { applicationId, userId, comment, isReassign });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur affectation' };
    }
  },

  async getHistory(): Promise<ApiResponse<any[]>> {
    try {
      const res = await api.get('/dispatching/history');
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur historique' };
    }
  }
};

// ─── Politique de Crédit ─────────────────────────────────────────────────────
export const creditPolicyApi = {
  async getPolicies(): Promise<any> {
    try {
      const res = await api.get('/credit-policies');
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération politiques' };
    }
  },

  async createPolicy(data: any): Promise<any> {
    try {
      const res = await api.post('/credit-policies', data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      const body = e.response?.data;
      const msg = body?.error || 'Erreur création politique';
      const detail = body?.detail ? ` — ${body.detail}` : '';
      return { success: false, error: `${msg}${detail}` };
    }
  },

  async updatePolicy(id: string, data: any): Promise<any> {
    try {
      const res = await api.put(`/credit-policies/${id}`, data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour politique' };
    }
  },

  async createStep(policyId: string, data: any): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${policyId}/steps`, data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création étape' };
    }
  },

  async updateStep(policyId: string, stepId: string, data: any): Promise<any> {
    try {
      const res = await api.put(`/credit-policies/${policyId}/steps/${stepId}`, data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour étape' };
    }
  },

  async deleteStep(policyId: string, stepId: string): Promise<any> {
    try {
      await api.delete(`/credit-policies/${policyId}/steps/${stepId}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur suppression étape' };
    }
  },

  async preview(creditTypeId: string, amount: number): Promise<any> {
    try {
      const res = await api.get('/credit-policies/preview', { params: { creditTypeId, amount } });
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur prévisualisation' };
    }
  },

  async getAnalytics(): Promise<any> {
    try {
      const res = await api.get('/credit-policies/analytics');
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur analytics' };
    }
  },

  async getCreditTypes(): Promise<any> {
    try {
      const res = await api.get('/credit-types');
      return { success: true, data: res.data.data ?? res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur types crédit' };
    }
  },

  async validatePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/validate`);
      return { success: true, data: res.data };
    } catch (e: any) {
      const body = e.response?.data;
      return { success: false, valid: false, errors: body?.errors || [], error: body?.error };
    }
  },

  async activatePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/activate`);
      return { success: true, data: res.data };
    } catch (e: any) {
      const body = e.response?.data;
      return {
        success: false,
        error: body?.message || body?.error || 'Erreur lors de l\'activation',
        errors: body?.errors || [],
      };
    }
  },

  async archivePolicy(id: string): Promise<any> {
    try {
      const res = await api.post(`/credit-policies/${id}/archive`);
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur lors de l\'archivage' };
    }
  },

  async savePolicyWithSteps(id: string, data: { steps: any[]; expectedVersion: number }): Promise<any> {
    try {
      const res = await api.put(`/credit-policies/${id}`, data);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      const body = e.response?.data;
      if (e.response?.status === 409) {
        return { success: false, conflict: true, error: body?.message || 'Conflit de version' };
      }
      return { success: false, error: body?.error || 'Erreur sauvegarde' };
    }
  },

  // ─── Délégations de pouvoir ────────────────────────────────────────────────

  async getDelegations(params?: { status?: string; delegatorId?: string; delegateId?: string }): Promise<any> {
    try {
      const res = await api.get('/delegations', { params });
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur délégations' };
    }
  },

  async getMyDelegations(): Promise<any> {
    try {
      const res = await api.get('/delegations/my');
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mes délégations' };
    }
  },

  async getDelegatableActions(): Promise<any> {
    try {
      const res = await api.get('/delegations/delegatable-actions');
      return { success: true, data: res.data.data ?? [] };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur actions déléguables' };
    }
  },

  async createDelegation(payload: import('../types/delegation').CreateDelegationPayload): Promise<any> {
    try {
      const res = await api.post('/delegations', payload);
      return { success: true, data: res.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création délégation' };
    }
  },

  async revokeDelegation(id: string): Promise<any> {
    try {
      const res = await api.patch(`/delegations/${id}/revoke`);
      return { success: true, message: res.data.message };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur révocation délégation' };
    }
  },
};

// ─── Contract Templates API ──────────────────────────────────────────────────
export const contractTemplateApi = {
  async list(creditTypeId?: string): Promise<any> {
    const url = creditTypeId
      ? `/contract-templates?creditTypeId=${encodeURIComponent(creditTypeId)}`
      : '/contract-templates';
    try {
      const r = await api.get(url);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération modèles' };
    }
  },
  async get(id: string): Promise<any> {
    try {
      const r = await api.get(`/contract-templates/${id}`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération modèle' };
    }
  },
  async create(form: FormData): Promise<any> {
    try {
      const r = await api.post('/contract-templates', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création modèle' };
    }
  },
  async createRichText(payload: {
    name: string;
    documentType: string;
    creditTypeIds: string[];
    description?: string;
    htmlContent: string;
  }): Promise<any> {
    try {
      const r = await api.post('/contract-templates/rich-text', payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création modèle éditeur' };
    }
  },
  async update(id: string, data: any): Promise<any> {
    try {
      const r = await api.put(`/contract-templates/${id}`, data);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour modèle' };
    }
  },
  async deactivate(id: string): Promise<any> {
    try {
      await api.delete(`/contract-templates/${id}`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur désactivation' };
    }
  },
  downloadUrl(id: string): string {
    const t = tokenManager.getAccessToken() || localStorage.getItem('auth_token') || '';
    const q = t ? `?token=${encodeURIComponent(t)}` : '';
    return `${API_BASE_URL}/contract-templates/${id}/download${q}`;
  },
  async getCatalog(): Promise<any> {
    try {
      const r = await api.get('/contract-templates/catalog/variables');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur catalogue' };
    }
  },
};

// ─── Company signature provider config API ──────────────────────────────────
export const companySignatureApi = {
  async getStatus(): Promise<any> {
    try {
      const r = await api.get('/companies/signature-provider-status');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur statut signature' };
    }
  },
  async get(): Promise<any> {
    try {
      const r = await api.get('/companies/signature-provider-config');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération config' };
    }
  },
  async save(payload: { provider: 'docuseal'; baseUrl: string; apiKey: string; webhookSecret: string }): Promise<any> {
    try {
      await api.put('/companies/signature-provider-config', payload);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur enregistrement config' };
    }
  },
  async remove(): Promise<any> {
    try {
      await api.delete('/companies/signature-provider-config');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur suppression config' };
    }
  },
};

// ─── Contracts API ───────────────────────────────────────────────────────────
export const contractApi = {
  async listForApplication(applicationId: string): Promise<any> {
    try {
      const r = await api.get(`/contracts/application/${applicationId}`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération contrats' };
    }
  },
  async generate(payload: { templateId: string; applicationId: string; customValues: Record<string, any> }): Promise<any> {
    try {
      const r = await api.post('/contracts/generate', payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur génération contrat' };
    }
  },
  async setSignatories(id: string, signatories: any[]): Promise<any> {
    try {
      const r = await api.post(`/contracts/${id}/signatories`, { signatories });
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur signataires' };
    }
  },
  async sendForSignature(id: string, mode: 'MANUAL' | 'EXTERNAL'): Promise<any> {
    try {
      const r = await api.post(`/contracts/${id}/send-for-signature`, { mode });
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur envoi en signature' };
    }
  },
  async uploadSigned(id: string, file: File): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post(`/contracts/${id}/upload-signed`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur upload signé' };
    }
  },
  async cancel(id: string): Promise<any> {
    try {
      const r = await api.post(`/contracts/${id}/cancel`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur annulation' };
    }
  },
  downloadUrl(id: string, signed = false): string {
    const t = tokenManager.getAccessToken() || localStorage.getItem('auth_token') || '';
    const params = new URLSearchParams();
    if (signed) params.set('signed', '1');
    if (t) params.set('token', t);
    const qs = params.toString();
    return `${API_BASE_URL}/contracts/${id}/download${qs ? `?${qs}` : ''}`;
  },
  async download(id: string, signed = false): Promise<void> {
    const params: Record<string, string> = {};
    if (signed) params['signed'] = '1';
    const r = await api.get(`/contracts/${id}/download`, { params, responseType: 'blob' });
    const cd: string = (r.headers['content-disposition'] as string) || '';
    const m = cd.match(/filename[^;=\n]*=(["']?)([^"';\n]+)\1/);
    const filename = m ? m[2].trim() : 'contrat';
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ─── Module Profiles API ─────────────────────────────────────────────────────
export const moduleProfileApi = {
  async getMyProfile(): Promise<any> {
    try {
      const r = await api.get('/module-profiles/me');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération profil' };
    }
  },
  async listAll(): Promise<any> {
    try {
      const r = await api.get('/module-profiles');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération profils' };
    }
  },
  async getByRole(role: string): Promise<any> {
    try {
      const r = await api.get(`/module-profiles/${role}`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération profil rôle' };
    }
  },
  async updateRole(role: string, payload: { modules: any; defaultScope: string; allowedBranches?: string[]; label?: string }): Promise<any> {
    try {
      const r = await api.put(`/module-profiles/${role}`, payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour profil' };
    }
  },
  async setReadOnly(role: string, isReadOnly: boolean): Promise<any> {
    try {
      const r = await api.patch(`/roles/${role}/readonly`, { isReadOnly });
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour lecture seule' };
    }
  },
  async resetRole(role: string): Promise<any> {
    try {
      const r = await api.post(`/module-profiles/reset/${role}`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur réinitialisation profil' };
    }
  },
  async seed(): Promise<any> {
    try {
      const r = await api.post('/module-profiles/seed');
      return { success: true, message: r.data.message };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur seed profils' };
    }
  },
  async getUserOverride(userId: string): Promise<any> {
    try {
      const r = await api.get(`/module-profiles/users/${userId}`);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération override' };
    }
  },
  async updateUserOverride(userId: string, payload: { modules?: any; dataScope?: string; allowedBranches?: string[] }): Promise<any> {
    try {
      const r = await api.put(`/module-profiles/users/${userId}`, payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour override' };
    }
  },
  async deleteUserOverride(userId: string): Promise<any> {
    try {
      const r = await api.delete(`/module-profiles/users/${userId}`);
      return { success: true, message: r.data.message };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur suppression override' };
    }
  },
};

// ─── Scope Delegates API ─────────────────────────────────────────────────────
export const scopeDelegateApi = {
  async list(): Promise<any> {
    try {
      const r = await api.get('/scope-delegates');
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur récupération délégations' };
    }
  },
  async create(payload: { delegateId: string; scope: string; allowedBranches?: string[]; allowedActions?: string[]; startDate: string; endDate?: string }): Promise<any> {
    try {
      const r = await api.post('/scope-delegates', payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur création délégation' };
    }
  },
  async update(id: string, payload: Partial<{ scope: string; allowedBranches: string[]; allowedActions: string[]; startDate: string; endDate: string | null }>): Promise<any> {
    try {
      const r = await api.put(`/scope-delegates/${id}`, payload);
      return { success: true, data: r.data.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur mise à jour délégation' };
    }
  },
  async revoke(id: string): Promise<any> {
    try {
      const r = await api.delete(`/scope-delegates/${id}`);
      return { success: true, message: r.data.message };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Erreur révocation délégation' };
    }
  },
};

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