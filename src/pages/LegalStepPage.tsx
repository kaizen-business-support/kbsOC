import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Stack, Alert,
  CircularProgress, Snackbar, Divider, Chip, IconButton,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import { ApiService, contractTemplateApi, contractApi, companySignatureApi } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { useApp } from '../contexts/AppContext';
import { ContractTemplate, GeneratedContract } from '../types/contracts';
import { GenerateContractDialog } from '../components/contracts/GenerateContractDialog';
import { ContractsListOnApplication } from '../components/contracts/ContractsListOnApplication';

interface Props {
  applicationId: string;
}

export function LegalStepPage({ applicationId }: Props) {
  const { state: userState } = useUser();
  const currentUser = userState.currentUser;
  const { navigateTo } = useApp();
  const [application, setApplication] = useState<any>(null);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [contracts, setContracts] = useState<GeneratedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ContractTemplate | null>(null);
  const [completing, setCompleting] = useState(false);
  const [externalProviderConfigured, setExternalProviderConfigured] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  const reloadAll = async () => {
    setLoading(true);
    try {
      const appRes = await ApiService.getApplicationById(applicationId);
      const app = appRes.success ? appRes.data : null;
      setApplication(app);

      const tplRes = await contractTemplateApi.list(app?.creditTypeId);
      if (tplRes.success) setTemplates(tplRes.data);

      const cRes = await contractApi.listForApplication(applicationId);
      if (cRes.success) setContracts(cRes.data);

      const sigRes = await companySignatureApi.getStatus();
      setExternalProviderConfigured(sigRes.success && !!sigRes.data?.configured);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadAll(); }, [applicationId]);

  const handleCompleteStep = async () => {
    const pending = contracts.filter((c) => c.status === 'PENDING_SIGNATURE');
    if (pending.length > 0) {
      const ok = window.confirm(
        `${pending.length} contrat(s) sont encore en attente de signature.\n\nVoulez-vous quand même terminer l'étape juridique ?`,
      );
      if (!ok) return;
    }

    setCompleting(true);
    try {
      const r = await ApiService.approveWorkflow(applicationId, {
        userId: currentUser?.id || '',
        decision: 'APPROVED',
        comments: `Étape juridique clôturée — ${contracts.length} contrat(s) traité(s).`,
      });
      if (r.success) {
        setSnack({ msg: 'Étape juridique clôturée', sev: 'success' });
        setTimeout(() => navigateTo('approvals'), 1200);
      } else {
        setSnack({ msg: r.error || 'Erreur clôture', sev: 'error' });
      }
    } catch (e: any) {
      setSnack({ msg: e.message || 'Erreur clôture', sev: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!application) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Dossier introuvable.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigateTo('approvals')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <GavelIcon sx={{ mr: 1, color: '#7e22ce' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Étape juridique</Typography>
          <Typography variant="caption" color="text.secondary">
            Dossier {application.applicationNumber} — {application.client?.companyName}
            {application.creditType && ` — ${application.creditType.name}`}
          </Typography>
        </Box>
        <Chip label={`${contracts.length} contrat(s)`} sx={{ mr: 1 }} />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center' }}>
                <DescriptionIcon sx={{ fontSize: 18, mr: 1 }} />
                Modèles disponibles
              </Typography>

              {templates.length === 0 ? (
                <Alert severity="warning">
                  Aucun modèle configuré pour ce type de crédit.
                  Demandez à un administrateur juridique d'en ajouter via la page "Modèles de contrats".
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  {templates.map((t) => (
                    <Box key={t.id} sx={{
                      p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1,
                      display: 'flex', alignItems: 'center', gap: 1,
                    }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{t.name}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          <Chip size="small" label={t.fileFormat} />
                          <Chip size="small" label={`${t.detectedVariables.length} var.`} variant="outlined" />
                        </Stack>
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setGenerating(t)}
                      >
                        Générer
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Contrats du dossier
              </Typography>
              <ContractsListOnApplication
                contracts={contracts}
                applicationDefaults={{
                  bankFullName: currentUser?.name,
                  bankEmail: currentUser?.email,
                  clientFullName: application.client?.contactPerson,
                  clientEmail: application.client?.email,
                }}
                externalProviderConfigured={externalProviderConfigured}
                onChanged={reloadAll}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={() => navigateTo('approvals')}>Retour</Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircleIcon />}
          onClick={handleCompleteStep}
          disabled={completing}
        >
          {completing ? 'Clôture…' : "Terminer l'étape juridique"}
        </Button>
      </Box>

      {generating && (
        <GenerateContractDialog
          template={generating}
          applicationId={applicationId}
          onClose={() => setGenerating(null)}
          onGenerated={() => {
            setGenerating(null);
            setSnack({ msg: 'Contrat généré', sev: 'success' });
            reloadAll();
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
