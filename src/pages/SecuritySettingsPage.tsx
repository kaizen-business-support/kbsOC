import React, { useState } from 'react';
import { Alert, Box, Tabs, Tab, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { colors } from '../components/home/homeTokens';
import { IPRulesTab } from '../components/security/IPRulesTab';
import { TimeRulesTab } from '../components/security/TimeRulesTab';
import { BlockHistoryTab } from '../components/security/BlockHistoryTab';

interface Props {
  onNavigate: (page: PageType) => void;
}

export const SecuritySettingsPage: React.FC<Props> = () => {
  const { hasPermission } = useUser();
  const [tab, setTab] = useState(0);

  if (!hasPermission('manage_security')) {
    return (
      <Box sx={{ bgcolor: colors.bg.page, minHeight: '100%', p: { xs: 2, md: 4 } }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Accès réservé. Cette page nécessite le droit « manage_security ».
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: colors.bg.page, minHeight: '100%', p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <ShieldOutlinedIcon sx={{ color: colors.accent.primary, fontSize: 28 }} />
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: colors.text.primary }}>
          Paramètres de sécurité
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13.5, color: colors.text.secondary, mb: 3 }}>
        Règles IP, plages horaires d'accès et journal des blocages.
      </Typography>

      <Box sx={{ borderBottom: `1px solid ${colors.border.default}` }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13.5 },
            '& .Mui-selected': { color: `${colors.accent.primary} !important` },
            '& .MuiTabs-indicator': { backgroundColor: colors.accent.primary },
          }}
        >
          <Tab label="Règles IP" />
          <Tab label="Plages horaires" />
          <Tab label="Journal des blocages" />
        </Tabs>
      </Box>

      {tab === 0 && <IPRulesTab />}
      {tab === 1 && <TimeRulesTab />}
      {tab === 2 && <BlockHistoryTab />}
    </Box>
  );
};

export default SecuritySettingsPage;
