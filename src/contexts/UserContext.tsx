import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ApiService, tokenManager } from '../services/api';

// User Types and Interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  jobTitle?: string;
  branch?: string;
  phone?: string;
  permissions: string[];
  lastLogin?: Date;
  isActive: boolean;
  azureId?: string;
  memberOf?: string[];
  createdAt?: string;
}

export type UserRole =
  // Anciennes valeurs DB @map (legacy — conservées pour compatibilité)
  | 'account_manager' | 'credit_analyst' | 'analyst_supervisor'
  | 'branch_manager' | 'credit_committee' | 'management' | 'admin'
  | 'super_admin' | 'back_office' | 'direction_juridique'
  // Nouvelles clés Prisma TypeScript (valeur réelle retournée par l'API)
  | 'CHARGE_AFFAIRES' | 'ANALYSTE_RISQUES' | 'RESPONSABLE_RISQUES'
  | 'RESPONSABLE_ENGAGEMENTS' | 'COMITE_CREDIT' | 'DIRECTION_GENERALE'
  | 'ADMIN' | 'SUPER_ADMIN' | 'BACK_OFFICE' | 'DIRECTION_JURIDIQUE';

export interface UserState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginAttempts: number;
}


// Actions
type UserAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'INCREMENT_LOGIN_ATTEMPTS' }
  | { type: 'RESET_LOGIN_ATTEMPTS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' };

// Reducer
const userReducer = (state: UserState, action: UserAction): UserState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        currentUser: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        loginAttempts: 0,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        loginAttempts: state.loginAttempts + 1,
      };
    case 'LOGOUT':
      return {
        ...state,
        currentUser: null,
        isAuthenticated: false,
        error: null,
        loginAttempts: 0,
      };
    case 'INCREMENT_LOGIN_ATTEMPTS':
      return {
        ...state,
        loginAttempts: state.loginAttempts + 1,
      };
    case 'RESET_LOGIN_ATTEMPTS':
      return {
        ...state,
        loginAttempts: 0,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Context
interface UserContextType {
  state: UserState;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isRole: (role: UserRole) => boolean;
  getRoleLabel: (role: UserRole) => string;
  clearError: () => void;
  isMsalAvailable: boolean;
  dispatch: React.Dispatch<any>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Hook to use context
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Provider component
interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, {
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    loginAttempts: 0,
  });

  // Microsoft 365 authentication is not available in this simplified version
  const isMsalAvailable = false;

  // Initialize user session from token
  useEffect(() => {
    const initializeUser = async () => {
      const token = tokenManager.getAccessToken();
      if (token) {
        try {
          dispatch({ type: 'SET_LOADING', payload: true });
          const user = await ApiService.getCurrentUser();
          const roleMapping: Record<string, any> = {
            // New RACI names (from backend)
            'CHARGE_AFFAIRES':         'account_manager',      // frontend legacy compat
            'ANALYSTE_RISQUES':        'credit_analyst',
            'RESPONSABLE_RISQUES':     'analyst_supervisor',
            'RESPONSABLE_ENGAGEMENTS': 'branch_manager',
            'COMITE_CREDIT':           'credit_committee',
            'DIRECTION_GENERALE':      'management',
            'ADMIN':                   'admin',
            'SUPER_ADMIN':             'admin',
            'BACK_OFFICE':             'account_manager',
            'DIRECTION_JURIDIQUE':     'account_manager',
            // Old names (backward compat)
            'ACCOUNT_MANAGER':    'account_manager',
            'CREDIT_ANALYST':     'credit_analyst',
            'ANALYST_SUPERVISOR': 'analyst_supervisor',
            'BRANCH_MANAGER':     'branch_manager',
            'CREDIT_COMMITTEE':   'credit_committee',
            'MANAGEMENT':         'management',
          };
          
          const userWithDefaults: User = {
            ...user,
            role: roleMapping[user.role] || 'account_manager',
            lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined,
            isActive: true // Default to active for authenticated users
          };
          dispatch({ type: 'LOGIN_SUCCESS', payload: userWithDefaults });
        } catch (error: any) {
          console.error('Failed to initialize user session:', error);
          // Clear all tokens and related data on initialization failure
          tokenManager.clearTokens();
          localStorage.removeItem('optimus_user');
          dispatch({ type: 'LOGOUT' });
          
          // If it's a network error, show a helpful message
          if (error.code === 'NETWORK_ERROR' || error.message?.includes('fetch')) {
            dispatch({ type: 'LOGIN_FAILURE', payload: 'Impossible de se connecter au serveur. Vérifiez votre connexion.' });
          }
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else {
        // No token found, ensure we're not in loading state
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeUser();
  }, []);

  // Microsoft 365 login function (placeholder)
  const loginWithMicrosoft = async (): Promise<boolean> => {
    dispatch({ type: 'LOGIN_FAILURE', payload: 'Microsoft 365 authentication not available in this version' });
    return false;
  };

  // Real API login function
  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await ApiService.login({ email, password });
      
      // Convert backend user format to frontend User format with role mapping
      const roleMapping: Record<string, any> = {
        // New RACI names (from backend)
        'CHARGE_AFFAIRES':         'account_manager',      // frontend legacy compat
        'ANALYSTE_RISQUES':        'credit_analyst',
        'RESPONSABLE_RISQUES':     'analyst_supervisor',
        'RESPONSABLE_ENGAGEMENTS': 'branch_manager',
        'COMITE_CREDIT':           'credit_committee',
        'DIRECTION_GENERALE':      'management',
        'ADMIN':                   'admin',
        'SUPER_ADMIN':             'admin',
        'BACK_OFFICE':             'account_manager',
        'DIRECTION_JURIDIQUE':     'account_manager',
        // Old names (backward compat)
        'ACCOUNT_MANAGER':    'account_manager',
        'CREDIT_ANALYST':     'credit_analyst',
        'ANALYST_SUPERVISOR': 'analyst_supervisor',
        'BRANCH_MANAGER':     'branch_manager',
        'CREDIT_COMMITTEE':   'credit_committee',
        'MANAGEMENT':         'management',
      };

      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: roleMapping[response.user.role] || 'account_manager',
        department: response.user.department,
        jobTitle: response.user.jobTitle,
        permissions: response.user.permissions,
        lastLogin: new Date(response.user.lastLogin),
        isActive: true
      };

      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur de connexion au serveur';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      return false;
    }
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('optimus_user'); // Legacy cleanup
      dispatch({ type: 'LOGOUT' });
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!state.currentUser?.permissions) return false;
    
    // Check for wildcard permission (admin has all permissions)
    if (state.currentUser.permissions.includes('*')) return true;
    
    // Check for specific permission
    return state.currentUser.permissions.includes(permission);
  };

  const isRole = (role: UserRole): boolean => {
    const current = state.currentUser?.role;
    if (!current) return false;
    // Compare insensible à la casse pour gérer les deux formats de rôle
    // (ancien @map lowercase: 'admin', nouveau Prisma key uppercase: 'ADMIN')
    return current.toLowerCase() === role.toLowerCase();
  };

  const getRoleLabel = (role: UserRole): string => {
    const roleLabels: Partial<Record<UserRole, string>> = {
      account_manager: 'Chargé d\'Affaires', CHARGE_AFFAIRES: 'Chargé d\'Affaires',
      credit_analyst: 'Analyste Crédit', ANALYSTE_RISQUES: 'Analyste Risques',
      analyst_supervisor: 'Responsable Risques', RESPONSABLE_RISQUES: 'Responsable Risques',
      branch_manager: 'Responsable Engagements', RESPONSABLE_ENGAGEMENTS: 'Responsable Engagements',
      credit_committee: 'Comité de Crédit', COMITE_CREDIT: 'Comité de Crédit',
      management: 'Direction Générale', DIRECTION_GENERALE: 'Direction Générale',
      admin: 'Administrateur', ADMIN: 'Administrateur',
      super_admin: 'Super Administrateur', SUPER_ADMIN: 'Super Administrateur',
      back_office: 'Back Office', BACK_OFFICE: 'Back Office',
      direction_juridique: 'Direction Juridique', DIRECTION_JURIDIQUE: 'Direction Juridique',
    };
    return roleLabels[role] ?? role;
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <UserContext.Provider value={{
      state,
      login,
      loginWithMicrosoft,
      logout,
      hasPermission,
      isRole,
      getRoleLabel,
      clearError,
      isMsalAvailable,
      dispatch,
    }}>
      {children}
    </UserContext.Provider>
  );
};