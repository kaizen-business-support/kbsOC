import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Alert,
  CircularProgress, Divider, Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

export interface OtpVerificationDialogProps {
  open: boolean;
  /** Libellé affiché dans le dialog : "Approuver", "Rejeter", "Soumettre"… */
  actionLabel: string;
  /** Clé unique identifiant l'action côté backend (ex: "approve_credit") */
  purpose: string;
  onClose: () => void;
  /** Appelé uniquement après vérification OTP réussie */
  onVerified: () => Promise<void> | void;
}

const OTP_LENGTH = 6;
const RESEND_DELAY = 60; // secondes avant de pouvoir re-générer

export const OtpVerificationDialog: React.FC<OtpVerificationDialogProps> = ({
  open,
  actionLabel,
  purpose,
  onClose,
  onVerified,
}) => {
  const [code, setCode] = useState('');
  const [testCode, setTestCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  // ── Générer l'OTP dès l'ouverture ────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
      setTestCode(null);
      generateOtp();
    }
    return () => clearInterval(countdownRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus automatique sur l'input
  useEffect(() => {
    if (open && testCode) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, testCode]);

  const startCountdown = () => {
    setResendCountdown(RESEND_DELAY);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(s => {
        if (s <= 1) { clearInterval(countdownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const generateOtp = async () => {
    setGenerating(true);
    setError(null);
    setCode('');
    try {
      const result = await ApiService.generateOtp(purpose);
      setTestCode(result._testCode ?? null);
      startCountdown();
    } catch (err: any) {
      setError(err.message || 'Impossible de générer l\'OTP');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== OTP_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      await ApiService.verifyOtp(code, purpose);
    } catch (err: any) {
      setError(err.message || 'Code OTP incorrect');
      setCode('');
      inputRef.current?.focus();
      setVerifying(false);
      return;
    }
    // OTP vérifié — exécuter l'action
    try {
      await onVerified();
      handleClose();
    } catch (err: any) {
      // Erreur de l'action (pas de l'OTP) — afficher sans effacer le code
      setError(err.message || 'Erreur lors de la soumission');
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    clearInterval(countdownRef.current);
    setCode('');
    setTestCode(null);
    setError(null);
    setResendCountdown(0);
    onClose();
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose} disableEscapeKeyDown={verifying}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <SecurityIcon color="primary" />
        Confirmation par OTP
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pour confirmer <strong>{actionLabel}</strong>, entrez le code OTP à{' '}
          {OTP_LENGTH} chiffres.
        </Typography>

        {/* ── Zone de test ── */}
        {testCode && (
          <Box
            sx={{
              bgcolor: 'warning.light',
              borderRadius: 1,
              px: 2,
              py: 1.5,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="caption" color="warning.dark" fontWeight={600}>
                ⚠️ MODE TEST — code affiché à l'écran
              </Typography>
              <Typography variant="h5" fontWeight={700} color="warning.dark" letterSpacing={4}>
                {testCode}
              </Typography>
            </Box>
            <Chip label="10 min" size="small" color="warning" variant="outlined" />
          </Box>
        )}

        {generating && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Divider sx={{ my: 1.5 }} />

        <TextField
          inputRef={inputRef}
          label={`Code OTP (${OTP_LENGTH} chiffres)`}
          value={code}
          onChange={e => handleCodeChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && code.length === OTP_LENGTH) handleVerify(); }}
          fullWidth
          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: OTP_LENGTH }}
          disabled={verifying || generating}
          error={!!error}
          autoComplete="one-time-code"
          sx={{ mt: 1 }}
        />

        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={generateOtp}
            disabled={resendCountdown > 0 || generating || verifying}
          >
            {resendCountdown > 0 ? `Renvoyer (${resendCountdown}s)` : 'Nouveau code'}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={verifying}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleVerify}
          disabled={code.length !== OTP_LENGTH || verifying || generating}
          startIcon={verifying ? <CircularProgress size={16} /> : <SecurityIcon />}
        >
          Confirmer
        </Button>
      </DialogActions>
    </Dialog>
  );
};
