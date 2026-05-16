import React, { useEffect, useState } from 'react';
import { Alert, Box, Link } from '@mui/material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';
import { HomeHero } from '../components/home/HomeHero';
import { HomeKpiBand } from '../components/home/HomeKpiBand';
import { HomeModuleGrid } from '../components/home/HomeModuleGrid';
import { HomeOpinionStrip } from '../components/home/HomeOpinionStrip';
import { HomeStuckApplications } from '../components/home/HomeStuckApplications';
import { colors } from '../components/home/homeTokens';
import { ApiService } from '../services/api';

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

// Rôles ciblés par les widgets v1.0
const DECIDER_ROLES = new Set(['credit_committee', 'management', 'dir_ag', 'admin', 'super_admin']);
const STUCK_AUDIENCE_ROLES = new Set([
  'account_manager', 'assistant_commercial', 'branch_manager', 'analyst_supervisor',
]);
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { state: userState } = useUser();
  const { activeCompany } = useCompany();

  const userName   = userState.currentUser?.name ?? 'Utilisateur';
  const tenantName = activeCompany?.name ?? 'OptimusCredit';
  const branchName = (userState.currentUser as any)?.branch ?? null;
  const roleKey    = userState.currentUser?.role ?? '';
  const roleLabel  = ROLE_LABELS[roleKey] ?? roleKey;

  const showOpinionStrip = DECIDER_ROLES.has(roleKey);
  const showStuckList    = STUCK_AUDIENCE_ROLES.has(roleKey);
  const isAdmin          = ADMIN_ROLES.has(roleKey);

  // v1.0 — bandeau d'alerte sécurité (ADMIN / SUPER_ADMIN uniquement).
  // Lit le KPI security_blocks_24h directement via /home/kpis pour éviter un
  // appel supplémentaire dédié.
  const [securityBlocks, setSecurityBlocks] = useState<number | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    ApiService.getHomeKpis()
      .then(res => {
        const k = res.kpis?.find(kpi => kpi.key === 'security_blocks_24h');
        if (k && typeof k.value === 'number') setSecurityBlocks(k.value);
      })
      .catch(() => { /* silencieux — pas critique */ });
  }, [isAdmin]);

  return (
    <Box
      sx={{
        bgcolor: colors.bg.page,
        minHeight: '100%',
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
      }}
    >
      {isAdmin && securityBlocks !== null && securityBlocks > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {securityBlocks} blocage{securityBlocks > 1 ? 's' : ''} sécurité enregistré{securityBlocks > 1 ? 's' : ''} sur les dernières 24h ·{' '}
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => onNavigate('security-settings')}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          >
            Voir l'historique des blocages
          </Link>
        </Alert>
      )}

      <HomeHero
        userName={userName}
        tenantName={tenantName}
        branchName={branchName}
        roleLabel={roleLabel}
      />
      <HomeKpiBand />
      {showOpinionStrip && <HomeOpinionStrip />}
      {showStuckList && <HomeStuckApplications onNavigate={onNavigate} />}
      <HomeModuleGrid onNavigate={onNavigate} />
    </Box>
  );
};

export default HomePage;
