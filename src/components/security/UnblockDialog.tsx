import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Alert, Box, Typography,
} from '@mui/material';
import { colors } from '../home/homeTokens';

interface BlockedEntry {
  id: string;
  blockedIp: string;
  blockReason: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  /** Entrée unique en cours de déblocage, ou null pour le bulk. */
  entry?: BlockedEntry | null;
  /** Nombre d'entrées matchées pour le mode bulk. */
  bulkCount?: number;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}

export function UnblockDialog({ open, entry, bulkCount, onClose, onConfirm }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBulk = !entry && bulkCount !== undefined;

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const noteValid = note.trim().length >= 5 && note.trim().length <= 500;

  async function handleConfirm() {
    if (!noteValid) {
      setError('Note requise (entre 5 et 500 caractères)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(note.trim());
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur lors du déblocage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: colors.text.primary }}>
        {isBulk ? `Débloquer ${bulkCount} entrées` : 'Débloquer cette entrée'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {entry && (
            <Box sx={{
              bgcolor: colors.bg.subtle, border: `1px solid ${colors.border.default}`,
              borderRadius: 1, p: 1.5, fontSize: 13,
            }}>
              <Typography sx={{ fontSize: 12, color: colors.text.muted, mb: 0.5 }}>Entrée concernée</Typography>
              <Box sx={{ fontFamily: 'monospace' }}>IP : {entry.blockedIp}</Box>
              <Box>Raison : {entry.blockReason}</Box>
              <Box sx={{ color: colors.text.muted, fontSize: 12 }}>{new Date(entry.createdAt).toLocaleString('fr-FR')}</Box>
            </Box>
          )}
          {isBulk && (
            <Alert severity="warning" sx={{ borderRadius: 1 }}>
              Cette action débloquera <strong>{bulkCount} entrées</strong> correspondant à vos filtres actuels.
              L'action est tracée dans l'audit (qui, quand, note) — elle ne modifie pas les règles IP/horaires.
            </Alert>
          )}

          <TextField
            label="Note de déblocage (5 à 500 caractères)"
            value={note}
            onChange={e => setNote(e.target.value)}
            multiline
            rows={3}
            fullWidth
            size="small"
            error={!!note && !noteValid}
            helperText={!noteValid && note ? 'Entre 5 et 500 caractères' : `${note.trim().length} / 500`}
          />

          {error && <Alert severity="error" sx={{ borderRadius: 1 }}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button
          onClick={handleConfirm}
          disabled={saving || !noteValid}
          variant="contained"
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          {saving ? 'Déblocage…' : 'Confirmer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
