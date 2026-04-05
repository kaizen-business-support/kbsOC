import React, { useEffect, useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
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

export function CreditManagementPage({ initialTab = 0, onNavigate }: Props) {
  const [tab, setTab] = useState(initialTab);

  // Sync tab when sidebar item changes (initialTab prop changes)
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <Box>
      {/* Barre d'onglets principale collante sous le header */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          px: 3,
          pt: 1.5,
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 64,
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ minHeight: 40 }}
          TabIndicatorProps={{ style: { height: 3, borderRadius: '2px 2px 0 0' } }}
        >
          <Tab
            icon={<CreditTypeIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Types de crédit"
            sx={{ minHeight: 40, fontSize: 13, textTransform: 'none', fontWeight: 500 }}
          />
          <Tab
            icon={<TreatmentIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Traitement"
            sx={{ minHeight: 40, fontSize: 13, textTransform: 'none', fontWeight: 500 }}
          />
          <Tab
            icon={<LimitsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Limites d'approbation"
            sx={{ minHeight: 40, fontSize: 13, textTransform: 'none', fontWeight: 500 }}
          />
        </Tabs>
      </Box>

      {/* Contenu */}
      {tab === 0 && <CreditTypesPage />}
      {tab === 1 && <CreditPolicyPage initialTab={0} />}
      {tab === 2 && <ApprovalLimitsPage onNavigate={onNavigate ?? (() => {})} />}
    </Box>
  );
}
