import React from 'react';
import { Box } from '@mui/material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';
import { HomeHero } from '../components/home/HomeHero';
import { HomeKpiBand } from '../components/home/HomeKpiBand';
import { HomeModuleGrid } from '../components/home/HomeModuleGrid';
import { colors } from '../components/home/homeTokens';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

const ROLE_LABELS: Record<string, string> = {
  account_manager:      "Chargé d'affaires",
  assistant_commercial: 'Assistant commercial',
  credit_analyst:       'Analyste risques',
  analyst_supervisor:   'Responsable risques',
  branch_manager:       'Responsable engagements',
  credit_committee:     'Comité de crédit',
  management:           'Direction Générale',
  admin:                'Administrateur',
  super_admin:          'Super Administrateur',
  back_office:          'Back-office',
  direction_juridique:  'Direction Juridique',
  dir_ag:               "Directeur d'Agence",
};

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { state: userState } = useUser();
  const { activeCompany } = useCompany();

  const userName   = userState.currentUser?.name ?? 'Utilisateur';
  const tenantName = activeCompany?.name ?? 'OptimusCredit';
  const branchName = (userState.currentUser as any)?.branch ?? null;
  const roleKey    = userState.currentUser?.role ?? '';
  const roleLabel  = ROLE_LABELS[roleKey] ?? roleKey;

  return (
    <Box
      sx={{
        bgcolor: colors.bg.page,
        minHeight: '100%',
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
      }}
    >
      <HomeHero
        userName={userName}
        tenantName={tenantName}
        branchName={branchName}
        roleLabel={roleLabel}
      />
      <HomeKpiBand />
      <HomeModuleGrid onNavigate={onNavigate} />
    </Box>
  );
};

export default HomePage;
