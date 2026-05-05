import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { moduleProfileApi } from '../services/api';

export interface ModuleAccess {
  visible: boolean;
  actions: string[];
  sections: string[];
}

export interface MergedProfile {
  role: string;
  label: string;
  modules: Record<string, ModuleAccess>;
  dataScope: 'BRANCH_ONLY' | 'MULTI_BRANCH' | 'ALL_BRANCHES';
  allowedBranches: string[];
  delegationActive: boolean;
  delegationActions: string[];
}

interface ModuleProfileContextValue {
  profile: MergedProfile | null;
  loading: boolean;
  reload: () => void;
}

const ModuleProfileContext = createContext<ModuleProfileContextValue>({
  profile: null,
  loading: true,
  reload: () => {},
});

export const ModuleProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<MergedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await moduleProfileApi.getMyProfile();
    if (res.success) setProfile(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('optimus_access_token');
    if (token) load();
    else setLoading(false);
  }, [load]);

  return (
    <ModuleProfileContext.Provider value={{ profile, loading, reload: load }}>
      {children}
    </ModuleProfileContext.Provider>
  );
};

export const useModuleProfile = () => useContext(ModuleProfileContext);
