import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Tooltip,
  Grid, CircularProgress, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import { contractTemplateApi } from '../services/api';
import { ContractTemplate } from '../types/contracts';
import { ContractTemplateUploadDialog } from '../components/contracts/ContractTemplateUploadDialog';
import { ContractTemplateEditDialog } from '../components/contracts/ContractTemplateEditDialog';
import { VariableCatalogPanel } from '../components/contracts/VariableCatalogPanel';

export function ContractTemplatesPage() {
  const [items, setItems] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  const reload = async () => {
    setLoading(true);
    const r = await contractTemplateApi.list();
    if (r.success) setItems(r.data); else setSnack({ msg: r.error, sev: 'error' });
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleDeactivate = async (t: ContractTemplate) => {
    if (!window.confirm(`Désactiver "${t.name}" ? Les contrats déjà générés ne seront pas affectés.`)) return;
    const r = await contractTemplateApi.deactivate(t.id);
    if (r.success) {
      setSnack({ msg: 'Modèle désactivé', sev: 'success' });
      reload();
    } else {
      setSnack({ msg: r.error, sev: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DescriptionIcon sx={{ mr: 1, color: '#7e22ce' }} />
        <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Modèles de contrats
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => setUploadOpen(true)}
        >
          Nouveau modèle
        </Button>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={9}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Nom</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Format</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Variables</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actif</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress size={24} sx={{ my: 3 }} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        Aucun modèle. Cliquez sur "Nouveau modèle" pour commencer.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{t.name}</Typography>
                      {t.description && (
                        <Typography variant="caption" color="text.secondary">
                          {t.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{t.documentType}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t.fileFormat}
                        color={t.fileFormat === 'DOCX' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={`${t.detectedVariables.length} var.`} />
                    </TableCell>
                    <TableCell>{t.isActive ? '✓' : '—'}</TableCell>
                    <TableCell align="right">
                      {t.fileFormat !== 'RICH_TEXT' && (
                        <Tooltip title="Télécharger le modèle">
                          <IconButton
                            size="small"
                            component="a"
                            href={contractTemplateApi.downloadUrl(t.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => setEditing(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Désactiver">
                        <IconButton size="small" onClick={() => handleDeactivate(t)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <VariableCatalogPanel />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ContractTemplateUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={() => {
          setUploadOpen(false);
          setSnack({ msg: 'Modèle créé', sev: 'success' });
          reload();
        }}
      />

      {editing && (
        <ContractTemplateEditDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSnack({ msg: 'Modèle mis à jour', sev: 'success' });
            reload();
          }}
        />
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
      >
        {snack ? (
          <Alert severity={snack.sev} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
