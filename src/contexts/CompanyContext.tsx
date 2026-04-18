import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Company, CompanyWithRole } from '../types';
import { ApiService, tokenManager } from '../services/api';

interface CompanyContextType {
  activeCompany: Company | null;
  companies: CompanyWithRole[];
  setActiveCompany: (company: Company, token: string) => void;
  setCompanies: (companies: CompanyWithRole[]) => void;
  switchCompany: (companyId: string) => Promise<boolean>;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
};

interface CompanyProviderProps {
  children: ReactNode;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(() => {
    const stored = localStorage.getItem('active_company');
    return stored ? JSON.parse(stored) : null;
  });
  const [companies, setCompaniesState] = useState<CompanyWithRole[]>([]);

  const setActiveCompany = useCallback((company: Company, token: string) => {
    setActiveCompanyState(company);
    localStorage.setItem('active_company', JSON.stringify(company));
    tokenManager.setAccessToken(token);
  }, []);

  const setCompanies = useCallback((companies: CompanyWithRole[]) => {
    setCompaniesState(companies);
  }, []);

  const switchCompany = useCallback(async (companyId: string): Promise<boolean> => {
    try {
      const response = await ApiService.post('/auth/switch-company', { companyId }) as any;
      if (response.success && response.accessToken) {
        setActiveCompany(response.company, response.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [setActiveCompany]);

  const clearCompany = useCallback(() => {
    setActiveCompanyState(null);
    localStorage.removeItem('active_company');
  }, []);

  return (
    <CompanyContext.Provider value={{ activeCompany, companies, setActiveCompany, setCompanies, switchCompany, clearCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};
