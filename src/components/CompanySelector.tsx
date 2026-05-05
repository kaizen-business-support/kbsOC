import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, List, ListItem, ListItemButton,
  ListItemText, ListItemAvatar, Avatar, Typography, Chip
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { CompanyWithRole } from '../types';

interface CompanySelectorProps {
  open: boolean;
  companies: CompanyWithRole[];
  onSelect: (company: CompanyWithRole) => void;
}

const ROLE_LABELS: Record<string, string> = {
  CHARGE_AFFAIRES:         'Chargé d\'Affaires',
  ANALYSTE_RISQUES:        'Analyste Risques',
  RESPONSABLE_RISQUES:     'Responsable Risques',
  RESPONSABLE_ENGAGEMENTS: 'Responsable Engagements',
  COMITE_CREDIT:           'Comité de Crédit',
  DIRECTION_GENERALE:      'Direction Générale',
  ADMIN:                   'Administrateur',
  SUPER_ADMIN:             'Super Administrateur',
  BACK_OFFICE:             'Back Office',
  DIRECTION_JURIDIQUE:     'Direction Juridique',
};

const CompanySelector: React.FC<CompanySelectorProps> = ({ open, companies, onSelect }) => {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Sélectionner une compagnie</Typography>
        <Typography variant="body2" color="text.secondary">
          Votre compte est associé à plusieurs compagnies
        </Typography>
      </DialogTitle>
      <DialogContent>
        <List>
          {companies.map((company) => (
            <ListItem key={company.id} disablePadding>
              <ListItemButton onClick={() => onSelect(company)} sx={{ borderRadius: 1, mb: 0.5 }}>
                <ListItemAvatar>
                  <Avatar src={company.logoUrl || undefined} sx={{ bgcolor: 'primary.main' }}>
                    <BusinessIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={company.name}
                  secondary={company.code}
                />
                <Chip
                  label={ROLE_LABELS[company.role] || company.role}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default CompanySelector;
