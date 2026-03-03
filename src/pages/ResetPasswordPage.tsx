import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Avatar,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  LockReset as LockResetIcon,
  Visibility,
  VisibilityOff,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { authPasswordApi } from '../services/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (success) {
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            window.location.href = '/';
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [success]);

  const handleReset = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await authPasswordApi.resetPassword(token!, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lien invalide ou expiré. Veuillez faire une nouvelle demande.');
    } finally {
      setLoading(false);
    }
  };

  const containerSx = {
    background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 3,
  };

  if (!token) {
    return (
      <Box sx={containerSx}>
        <Card sx={{ maxWidth: 440, width: '100%', boxShadow: 6 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              Lien invalide. Ce lien de réinitialisation est manquant ou incorrect.
            </Alert>
            <Button variant="outlined" onClick={() => { window.location.href = '/'; }}>
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={containerSx}>
        <Card sx={{ maxWidth: 440, width: '100%', boxShadow: 6 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Mot de passe réinitialisé !
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion dans{' '}
              <strong>{countdown}</strong> seconde{countdown > 1 ? 's' : ''}.
            </Typography>
            <Button variant="contained" onClick={() => { window.location.href = '/'; }}>
              Se connecter maintenant
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={containerSx}>
      <Card sx={{ maxWidth: 460, width: '100%', boxShadow: 6 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'primary.main', width: 56, height: 56 }}>
            <LockResetIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Réinitialiser votre mot de passe
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choisissez un nouveau mot de passe sécurisé pour votre compte OptimusCredit.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }} onClose={() => setError('')}>
              {error}
              {error.includes('invalide ou expiré') && (
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => { window.location.href = '/'; }}
                    sx={{ p: 0, textTransform: 'none', fontSize: 12 }}
                  >
                    Retour à la connexion pour faire une nouvelle demande
                  </Button>
                </Box>
              )}
            </Alert>
          )}

          <TextField
            label="Nouveau mot de passe"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(v => !v)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <TextField
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            sx={{ mb: 3 }}
            onKeyDown={(e) => e.key === 'Enter' && handleReset()}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleReset}
            disabled={!newPassword || !confirmPassword || loading}
          >
            {loading ? <CircularProgress size={22} /> : 'Réinitialiser le mot de passe'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ResetPasswordPage;
