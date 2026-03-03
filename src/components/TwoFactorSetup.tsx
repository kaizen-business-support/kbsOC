/**
 * TwoFactorSetup — guides the user through TOTP 2FA configuration.
 *
 * Props:
 *  tempToken   — short-lived JWT returned by the login endpoint when 2FA setup is required
 *  onComplete  — called after successful setup + first login verification
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  QrCode2 as QrCodeIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT || '5007'}/api`;

interface TwoFactorSetupProps {
  tempToken: string;
  onComplete: (accessToken: string, refreshToken: string, user: any) => void;
}

const STEPS = ['Scanner le QR Code', 'Confirmer le code', 'Codes de secours'];

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ tempToken, onComplete }) => {
  const [step, setStep] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [finalCode, setFinalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 0: Fetch QR code / secret
  useEffect(() => {
    const initSetup = async () => {
      setLoading(true);
      try {
        const response = await axios.post(
          `${API_BASE}/auth/2fa/setup`,
          {},
          { headers: { Authorization: `Bearer ${tempToken}` } }
        );
        setQrCode(response.data.qrCode);
        setSecret(response.data.secret);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erreur lors de l\'initialisation du 2FA');
      } finally {
        setLoading(false);
      }
    };
    initSetup();
  }, [tempToken]);

  const handleVerifySetup = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/auth/2fa/verify-setup`,
        { token: verifyCode },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      setBackupCodes(response.data.backupCodes);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code invalide. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/auth/2fa/verify`,
        { token: finalCode },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      onComplete(response.data.accessToken, response.data.refreshToken, response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code invalide. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card sx={{ maxWidth: 560, mx: 'auto', boxShadow: 6 }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight={600}>
            Configuration de l'authentification à deux facteurs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Votre rôle exige le 2FA. Suivez les étapes ci-dessous.
          </Typography>
        </Box>

        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 0 — QR Code */}
        {step === 0 && (
          <Box sx={{ textAlign: 'center' }}>
            {loading ? (
              <CircularProgress />
            ) : (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Scannez ce code QR avec votre application d'authentification
                  (Google Authenticator, Authy, Microsoft Authenticator…)
                </Typography>

                {qrCode && (
                  <Box sx={{ display: 'inline-block', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
                    <img src={qrCode} alt="QR Code 2FA" style={{ width: 200, height: 200 }} />
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Ou entrez manuellement :
                  </Typography>
                  <Typography variant="caption" fontFamily="monospace" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>
                    {secret}
                  </Typography>
                  <Tooltip title={copied ? 'Copié !' : 'Copier'}>
                    <IconButton size="small" onClick={copySecret}>
                      {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>

                <Button variant="contained" onClick={() => setStep(1)} disabled={!qrCode}>
                  Suivant
                </Button>
              </>
            )}
          </Box>
        )}

        {/* Step 1 — Verify first code */}
        {step === 1 && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Entrez le code à 6 chiffres généré par votre application pour confirmer la configuration.
            </Typography>
            <TextField
              label="Code de vérification"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: 24, letterSpacing: 8 } }}
              sx={{ mb: 3, width: 240 }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && verifyCode.length === 6 && handleVerifySetup()}
            />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="outlined" onClick={() => setStep(0)}>Retour</Button>
              <Button
                variant="contained"
                onClick={handleVerifySetup}
                disabled={verifyCode.length !== 6 || loading}
              >
                {loading ? <CircularProgress size={20} /> : 'Confirmer'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2 — Backup codes */}
        {step === 2 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Conservez ces codes de secours en lieu sûr.</strong> Ils ne seront affichés qu'une seule fois
              et vous permettront d'accéder à votre compte si vous perdez votre téléphone.
            </Alert>

            <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {backupCodes.map((code, i) => (
                  <Typography key={i} fontFamily="monospace" variant="body2" sx={{ textAlign: 'center' }}>
                    {code}
                  </Typography>
                ))}
              </Box>
            </Paper>

            <Button
              variant="outlined"
              fullWidth
              sx={{ mb: 2 }}
              onClick={() => {
                const text = backupCodes.join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'optimus-backup-codes.txt';
                a.click();
              }}
            >
              Télécharger les codes
            </Button>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" sx={{ mb: 2 }}>
              Pour terminer, entrez votre code 2FA pour accéder à l'application :
            </Typography>
            <TextField
              label="Code 2FA"
              value={finalCode}
              onChange={(e) => setFinalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: 24, letterSpacing: 8 } }}
              sx={{ mb: 2, width: '100%' }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && finalCode.length === 6 && handleFinalVerify()}
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handleFinalVerify}
              disabled={finalCode.length !== 6 || loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Accéder à l\'application'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorSetup;
