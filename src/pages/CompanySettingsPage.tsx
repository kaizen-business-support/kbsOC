import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { ApiService } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';

const CompanySettingsPage: React.FC = () => {
  const { activeCompany, setActiveCompany } = useCompany();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name);
      setLogoUrl(activeCompany.logoUrl || '');
    }
  }, [activeCompany]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ApiService.patch('/companies/current', { name, logoUrl: logoUrl || null }) as any;
      if (result.success) {
        setSuccess(true);
        // Update company in context (keep existing token)
        const token = localStorage.getItem('accessToken') || '';
        setActiveCompany(result.data, token);
      }
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
        <TextField fullWidth label="Nom de la compagnie" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label="URL du logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} sx={{ mb: 3 }} />
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Sauvegarder'}
        </Button>
      </Paper>
    </Box>
  );
};

export default CompanySettingsPage;
