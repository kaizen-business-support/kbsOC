import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Avatar, Stack,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import axios from 'axios';
import { ApiService } from '../services/api';
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

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name);
      setLogoPreview(activeCompany.logoUrl ? `${window.location.origin}${activeCompany.logoUrl}` : null);
    }
  }, [activeCompany]);

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

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" gutterBottom>Paramètres de la compagnie</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Paramètres sauvegardés</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 3 }}>
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
    </Box>
  );
};

export default CompanySettingsPage;
