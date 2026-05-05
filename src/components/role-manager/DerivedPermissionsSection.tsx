import React from 'react';
import { Box, Chip, Typography, Divider } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface Props {
  permissions: string[];
  userCount: number;
  isAdmin: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
  view_client: 'Voir clients', manage_clients: 'Gérer clients',
  create_client: 'Créer client', edit_client_data: 'Modifier client',
  view_applications: 'Voir demandes', create_application: 'Créer demande',
  application_review: 'Revue demandes', review_applications: 'Examiner demandes',
  approve_credit: 'Approuver crédit', approve_applications: 'Approuver demandes',
  committee_review: 'Revue comité', committee_vote: 'Vote comité',
  final_approval: 'Approbation finale', risk_override: 'Dérogation risque',
  policy_configuration: 'Config. politique', policy_exceptions: 'Exceptions politique',
  analytics: 'Analytiques', portfolio_analytics: 'Analytics portefeuille',
  view_portfolio: 'Voir portefeuille', risk_reporting: 'Rapports risque',
  reports: 'Rapports', data_export: 'Export données',
  financial_analysis: 'Analyse financière', analyze_credit: 'Analyser crédit',
  benchmark_analysis: 'Analyse benchmark', edit_analysis: 'Modifier analyse',
  score_applications: 'Scorer demandes', dispatch_applications: 'Dispatcher',
  view_analyst_workload: 'Charge analystes', assign_analyst: 'Affecter analyste',
  manage_branch: 'Gérer agence', manage_team: 'Gérer équipe',
  workflow_override: 'Dérogation workflow', user_management: 'Gérer utilisateurs',
  role_assignment: 'Attribution rôles', system_configuration: 'Config. système',
  audit_logs: 'Journaux audit', manage_notifications: 'Gérer notifications',
  manage_announcements: 'Gérer annonces', manage_contract_templates: 'Modèles contrats',
  generate_contracts: 'Générer contrats', view_contracts: 'Voir contrats',
  view_own: 'Voir ses données', view_branch: 'Voir agence', view_all: 'Voir tout',
};

export const DerivedPermissionsSection: React.FC<Props> = ({ permissions, userCount, isAdmin }) => {
  if (isAdmin) {
    return (
      <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f4ff', borderRadius: 1, border: '1px solid #c7d2fe' }}>
        <Typography variant="body2" color="primary" fontWeight={600}>
          Accès total — permissions: ['*']
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ADMIN et SUPER_ADMIN ont accès à tout. Leurs permissions ne sont pas calculées via le profil.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <InfoOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" color="text.secondary">
          Permissions dérivées (calculées automatiquement) — propagées aux {userCount} utilisateurs
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {permissions.length === 0 ? (
          <Typography variant="caption" color="text.disabled">Aucune permission calculée.</Typography>
        ) : (
          permissions.sort().map(p => (
            <Chip
              key={p}
              label={PERMISSION_LABELS[p] ?? p}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', bgcolor: '#f8fafc' }}
            />
          ))
        )}
      </Box>
    </Box>
  );
};
