import React, { useEffect, useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import {
  CreditCardOutlined as CreditTypeIcon,
  RouteOutlined as TreatmentIcon,
  GavelOutlined as LimitsIcon,
} from '@mui/icons-material';
import { CreditTypesPage } from './CreditTypesPage';
import { CreditPolicyPage } from './CreditPolicyPage';
import { ApprovalLimitsPage } from './ApprovalLimitsPage';
import { PageType } from '../types';

interface Props {
  initialTab?: number;
  onNavigate?: (page: PageType) => void;
}

const TABS = [
  {
    label: 'Types de crédit',
    icon: <CreditTypeIcon sx={{ fontSize: 16 }} />,
    desc: 'Définir et configurer les produits de crédit disponibles',
  },
  {
    label: 'Traitement',
    icon: <TreatmentIcon sx={{ fontSize: 16 }} />,
    desc: 'Circuit de validation, étapes et rôles intervenants',
  },
  {
    label: "Limites d'approbation",
    icon: <LimitsIcon sx={{ fontSize: 16 }} />,
    desc: 'Autorités d\'approbation par rôle et plage de montant',
  },
];

export function CreditManagementPage({ initialTab = 0, onNavigate }: Props) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100%' }}>

      {/* ── Header sticky : titre + onglets ──────────────────────────────── */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Titre de section */}
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            pt: 2.5,
            pb: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 26,
              bgcolor: 'primary.main',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.15}>
              Politique de Crédit
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
              {TABS[tab].desc}
            </Typography>
          </Box>
        </Box>

        {/* Onglets */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: { xs: 1, md: 3 }, mt: 0.5 }}
          TabIndicatorProps={{ style: { height: 3, borderRadius: '3px 3px 0 0' } }}
        >
          {TABS.map((t, i) => (
            <Tab
              key={i}
              icon={t.icon}
              iconPosition="start"
              label={t.label}
              sx={{
                minHeight: 44,
                fontSize: 13,
                textTransform: 'none',
                fontWeight: 500,
                gap: 0.5,
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* ── Contenu de l'onglet ───────────────────────────────────────────── */}
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
        {tab === 0 && <CreditTypesPage compact={true} />}
        {tab === 1 && <CreditPolicyPage initialTab={0} compact={true} />}
        {tab === 2 && <ApprovalLimitsPage onNavigate={onNavigate ?? (() => {})} compact={true} />}
      </Box>

    </Box>
  );
}
