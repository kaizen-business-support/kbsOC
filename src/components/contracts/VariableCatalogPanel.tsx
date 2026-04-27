import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, Tooltip, Snackbar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { contractTemplateApi } from '../../services/api';

const GROUP_LABELS: Record<string, string> = {
  client: 'Client',
  application: 'Dossier',
  bank: 'Banque',
  meta: 'Méta',
};

export function VariableCatalogPanel() {
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
              <Tooltip key={f} title={`{{${g}.${f}}}`}>
                <Chip
                  size="small"
                  label={f}
                  onClick={() => copy(g, f)}
                  sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                />
              </Tooltip>
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
