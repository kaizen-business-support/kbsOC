import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, Tooltip, Snackbar, Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { contractTemplateApi } from '../../services/api';

const GROUP_LABELS: Record<string, string> = {
  client: 'Client',
  application: 'Dossier',
  bank: 'Banque',
  meta: 'Méta',
};

const FIELD_LABELS: Record<string, string> = {
  // client
  companyName: 'Raison sociale',
  rccm: 'RCCM',
  ninea: 'NINEA',
  legalForm: 'Forme juridique',
  headquarters: 'Siège social',
  contactPerson: 'Personne de contact',
  phone: 'Téléphone',
  email: 'E-mail',
  // application
  applicationNumber: 'Numéro de dossier',
  amount: 'Montant',
  amountInWords: 'Montant en lettres',
  currency: 'Devise',
  purpose: 'Objet du crédit',
  durationMonths: 'Durée (mois)',
  proposedRate: 'Taux proposé',
  collateralType: 'Type de garantie',
  collateralValue: 'Valeur de la garantie',
  repaymentSchedule: 'Plan de remboursement',
  // bank
  name: 'Nom de la banque',
  legalRepresentative: 'Représentant légal',
  // meta
  generatedAt: 'Date de génération',
  creditType: 'Type de crédit',
};

interface Props {
  onInsert?: (variable: string, label: string, group: string) => void;
}

export function VariableCatalogPanel({ onInsert }: Props = {}) {
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    contractTemplateApi.getCatalog().then((r) => {
      if (r.success) setGroups(r.data.groups);
    });
  }, []);

  const copy = (g: string, f: string) => {
    const tag = `{{${g}.${f}}}`;
    navigator.clipboard.writeText(tag);
    setSnack(`${tag} copié`);
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', mb: 1 }}>
        Variables disponibles (cliquer pour copier)
      </Typography>
      {Object.entries(groups).map(([g, fields]) => (
        <Accordion
          key={g}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' }, border: '1px solid #e2e8f0', mb: 0.5 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
              {GROUP_LABELS[g] || g}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {fields.map((f) => (
              <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title={`{{${g}.${f}}}`}>
                  <Chip
                    size="small"
                    label={FIELD_LABELS[f] ?? f}
                    onClick={() => copy(g, f)}
                    sx={{ cursor: 'pointer', fontSize: 11 }}
                  />
                </Tooltip>
                {onInsert && (
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 0, px: 1, fontSize: 11, py: 0 }}
                    onClick={() => onInsert(`{{${g}.${f}}}`, FIELD_LABELS[f] ?? f, g)}
                  >
                    Insérer
                  </Button>
                )}
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
      <Snackbar
        open={!!snack}
        autoHideDuration={1500}
        onClose={() => setSnack(null)}
        message={snack ?? ''}
      />
    </Box>
  );
}
