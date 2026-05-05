import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Avatar, Stack, Divider, Chip,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import GavelIcon from '@mui/icons-material/Gavel';
import axios from 'axios';
import { ApiService, companySignatureApi } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';

const CompanySettingsPage: React.FC = () => {
  const { activeCompany, setActiveCompany } = useCompany();
  const [name, setName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Signature provider state ──────────────────────────────────────────────
  const [sigConfigured, setSigConfigured] = useState<{ baseUrl: string; hasWebhookSecret: boolean } | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigBaseUrl, setSigBaseUrl] = useState('');
  const [sigApiKey, setSigApiKey] = useState('');
  const [sigWebhookSecret, setSigWebhookSecret] = useState('');
  const [sigError, setSigError] = useState<string | null>(null);
  const [sigSuccess, setSigSuccess] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name);
      setLogoPreview(activeCompany.logoUrl ? `${window.location.origin}${activeCompany.logoUrl}` : null);
    }
  }, [activeCompany]);

  useEffect(() => {
    (async () => {
      const r = await companySignatureApi.get();
      if (r.success && r.data) {
        setSigConfigured({ baseUrl: r.data.baseUrl, hasWebhookSecret: r.data.hasWebhookSecret });
        setSigBaseUrl(r.data.baseUrl);
      }
    })();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (logoFile) {
        const form = new FormData();
        form.append('logo', logoFile);
        const token = localStorage.getItem('optimus_access_token') || localStorage.getItem('accessToken') || '';
        const res = await axios.post(
          `${window.location.origin}/api/companies/current/logo`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        );
        if (!res.data?.success) throw new Error(res.data?.error || 'Erreur upload logo');
        const token2 = localStorage.getItem('accessToken') || '';
        setActiveCompany(res.data.data, token2);
      }

      const result = await ApiService.patch('/companies/current', { name }) as any;
      if (!result.success) throw new Error(result.error || 'Erreur sauvegarde');
      const token2 = localStorage.getItem('accessToken') || '';
      setActiveCompany(result.data, token2);
      setLogoFile(null);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSig = async () => {
    setSigError(null); setSigSuccess(false); setSigLoading(true);
    if (!sigBaseUrl || !sigApiKey || !sigWebhookSecret) {
      setSigError('Tous les champs sont obligatoires');
      setSigLoading(false);
      return;
    }
    const r = await companySignatureApi.save({
      provider: 'docuseal',
      baseUrl: sigBaseUrl.replace(/\/$/, ''),
      apiKey: sigApiKey,
      webhookSecret: sigWebhookSecret,
    });
    setSigLoading(false);
    if (!r.success) { setSigError(r.error); return; }
    setSigSuccess(true);
    setSigConfigured({ baseUrl: sigBaseUrl, hasWebhookSecret: true });
    setSigApiKey('');
    setSigWebhookSecret('');
  };

  const handleRemoveSig = async () => {
    if (!window.confirm('Supprimer la configuration DocuSeal ? Le mode signature externe sera désactivé.')) return;
    setSigLoading(true);
    const r = await companySignatureApi.remove();
    setSigLoading(false);
    if (!r.success) { setSigError(r.error); return; }
    setSigConfigured(null);
    setSigBaseUrl(''); setSigApiKey(''); setSigWebhookSecret('');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 700 }}>
      <Typography variant="h5" gutterBottom>Paramètres de la compagnie</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Paramètres sauvegardés</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField fullWidth label="Nom de la compagnie" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 3 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Logo</Typography>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Avatar src={logoPreview || undefined} variant="rounded" sx={{ width: 80, height: 80, bgcolor: 'grey.100' }}>
            {!logoPreview && <UploadIcon color="disabled" />}
          </Avatar>
          <Box>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={handleFileChange} />
            <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
              Choisir un fichier
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              PNG, JPG, WEBP ou SVG — max 2 Mo
            </Typography>
          </Box>
        </Stack>

        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Sauvegarder'}
        </Button>
      </Paper>

      {/* ─── Signature électronique ─────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <GavelIcon sx={{ mr: 1, color: '#7e22ce' }} />
          <Typography variant="h6">Signature électronique (DocuSeal)</Typography>
          {sigConfigured && (
            <Chip
              label="Configuré"
              size="small"
              color="success"
              sx={{ ml: 2 }}
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configurez votre instance DocuSeal pour activer la signature électronique externe
          des contrats sur l'étape juridique. La clé API et le secret webhook sont chiffrés au repos.
        </Typography>

        {sigSuccess && <Alert severity="success" sx={{ mb: 2 }}>Configuration enregistrée</Alert>}
        {sigError && <Alert severity="error" sx={{ mb: 2 }}>{sigError}</Alert>}

        <Stack spacing={2}>
          <TextField
            fullWidth size="small"
            label="URL de l'instance DocuSeal *"
            placeholder="https://docuseal.example.com"
            value={sigBaseUrl}
            onChange={(e) => setSigBaseUrl(e.target.value)}
            disabled={sigLoading}
          />
          <TextField
            fullWidth size="small"
            type="password"
            label={sigConfigured ? 'Nouvelle clé API (laisser vide pour conserver)' : 'Clé API *'}
            value={sigApiKey}
            onChange={(e) => setSigApiKey(e.target.value)}
            disabled={sigLoading}
          />
          <TextField
            fullWidth size="small"
            type="password"
            label={sigConfigured ? 'Nouveau secret webhook (laisser vide pour conserver)' : 'Secret webhook *'}
            value={sigWebhookSecret}
            onChange={(e) => setSigWebhookSecret(e.target.value)}
            helperText="Utilisé pour vérifier la signature HMAC-SHA256 des webhooks DocuSeal"
            disabled={sigLoading}
          />

          <Divider />

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handleSaveSig}
              disabled={sigLoading || !sigBaseUrl || !sigApiKey || !sigWebhookSecret}
            >
              {sigLoading ? 'Enregistrement…' : (sigConfigured ? 'Mettre à jour' : 'Enregistrer')}
            </Button>
            {sigConfigured && (
              <Button
                color="error"
                variant="outlined"
                onClick={handleRemoveSig}
                disabled={sigLoading}
              >
                Supprimer la configuration
              </Button>
            )}
          </Stack>

          {sigConfigured && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>URL webhook à configurer dans DocuSeal :</strong><br />
                <code>{window.location.origin}/api/contracts/webhooks/docuseal</code>
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default CompanySettingsPage;
