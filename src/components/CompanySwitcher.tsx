import React, { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useCompany } from '../contexts/CompanyContext';

const CompanySwitcher: React.FC = () => {
  const { activeCompany, companies, switchCompany } = useCompany();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!activeCompany || companies.length <= 1) return null;

  const handleSwitch = async (companyId: string) => {
    setAnchorEl(null);
    if (companyId !== activeCompany.id) {
      await switchCompany(companyId);
      window.location.reload(); // refresh app state after company switch
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<BusinessIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ textTransform: 'none', mr: 1 }}
      >
        {activeCompany.name}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}>
          Changer de compagnie
        </Typography>
        <Divider />
        {companies.map((company) => (
          <MenuItem
            key={company.id}
            selected={company.id === activeCompany.id}
            onClick={() => handleSwitch(company.id)}
          >
            <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={company.name} secondary={company.code} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default CompanySwitcher;
