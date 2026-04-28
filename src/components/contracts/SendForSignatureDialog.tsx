import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  RadioGroup, Radio, FormControlLabel, Alert, Typography, IconButton, Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { contractApi } from '../../services/api';
import { GeneratedContract, SignatureMode } from '../../types/contracts';

interface Props {
  contract: GeneratedContract;
  externalProviderConfigured?: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SendForSignatureDialog({ contract, externalProviderConfigured = false, onClose, onSent }: Props) {
  const [mode, setMode] = useState<SignatureMode>('MANUAL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setError(null); setLoading(true);
    const r = await contractApi.sendForSignature(contract.id, mode);
    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    onSent();
  };

  const noSignatories = contract.signatories.length === 0;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        Envoyer en signature
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {noSignatories && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Aucun signataire défini. Configurez d'abord les signataires.
          </Alert>
        )}

        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as SignatureMode)}>
          <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1, mb: 1 }}>
            <FormControlLabel
              value="MANUAL"
              control={<Radio />}
              label={<Typography sx={{ fontWeight: 600 }}>Signature manuelle traçable</Typography>}
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
              Imprimer le contrat, faire signer hors-ligne, puis téléverser le PDF signé.
              Le système conserve une empreinte SHA-256 du document.
            </Typography>
          </Box>

          <Box sx={{
            p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1,
            opacity: externalProviderConfigured ? 1 : 0.6,
          }}>
            <FormControlLabel
              value="EXTERNAL"
              control={<Radio />}
              disabled={!externalProviderConfigured}
              label={
                <Typography sx={{ fontWeight: 600 }}>
                  Signature électronique (DocuSeal)
                  {!externalProviderConfigured && (
                    <Typography component="span" sx={{ ml: 1, fontSize: 11, color: '#dc2626' }}>
                      (non configuré — Phase 3)
                    </Typography>
                  )}
                </Typography>
              }
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
              Envoi automatique aux signataires par email via DocuSeal.
              Statut mis à jour automatiquement après signature.
            </Typography>
          </Box>
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={loading || noSignatories}
        >
          {loading ? 'Envoi…' : 'Envoyer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
