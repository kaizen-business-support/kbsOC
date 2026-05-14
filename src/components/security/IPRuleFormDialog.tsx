import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, RadioGroup, Radio, FormControlLabel, FormControl,
  Switch, Alert, Box, Typography, Checkbox,
} from '@mui/material';
import { ApiService } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { colors } from '../home/homeTokens';

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/;

export interface IpRule {
  id: string;
  ipAddress: string;
  ruleType: 'ALLOW' | 'DENY';
  description: string | null;
  isActive: boolean;
  companyId: string | null;
}

interface Props {
  open: boolean;
  initial?: IpRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function IPRuleFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { isRole } = useUser();
  const isSuperAdmin = isRole('super_admin');

  const [ipAddress, setIpAddress] = useState('');
  const [ruleType, setRuleType] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPlatform, setIsPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIpAddress(initial?.ipAddress ?? '');
      setRuleType(initial?.ruleType ?? 'ALLOW');
      setDescription(initial?.description ?? '');
      setIsActive(initial?.isActive ?? true);
      setIsPlatform(initial ? initial.companyId === null : false);
      setError(null);
    }
  }, [open, initial]);

  const ipValid = !ipAddress || IP_REGEX.test(ipAddress.trim());

  async function handleSave() {
    setError(null);
    if (!ipAddress.trim()) { setError('Adresse IP requise'); return; }
    if (!ipValid) { setError('Format IP/CIDR invalide'); return; }

    setSaving(true);
    try {
      if (initial) {
        await ApiService.security.ipRules.update(initial.id, {
          ipAddress: ipAddress.trim(),
          ruleType,
          description: description || null,
          isActive,
        });
      } else {
        await ApiService.security.ipRules.create({
          ipAddress: ipAddress.trim(),
          ruleType,
          description: description || undefined,
          isActive,
          ...(isSuperAdmin && isPlatform ? { companyId: null } : {}),
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erreur lors de l\'enregistrement';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: colors.text.primary }}>
        {initial ? 'Modifier la règle IP' : 'Ajouter une règle IP'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Adresse IP / CIDR"
            value={ipAddress}
            onChange={e => setIpAddress(e.target.value)}
            placeholder="192.168.1.0/24 ou 2001:db8::/32 ou 203.0.113.42"
            error={!!ipAddress && !ipValid}
            helperText={!ipValid ? 'Format invalide' : 'IPv4, IPv6 ou CIDR (ex: 192.168.1.0/24)'}
            fullWidth
            size="small"
          />
          <FormControl>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: colors.text.secondary }}>Type</Typography>
            <RadioGroup row value={ruleType} onChange={e => setRuleType(e.target.value as 'ALLOW' | 'DENY')}>
              <FormControlLabel value="ALLOW" control={<Radio size="small" />} label="Autoriser (allow)" />
              <FormControlLabel value="DENY"  control={<Radio size="small" />} label="Bloquer (deny)" />
            </RadioGroup>
          </FormControl>
          <TextField
            label="Description (facultatif)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
            label="Règle active"
          />
          {isSuperAdmin && !initial && (
            <FormControlLabel
              control={<Checkbox checked={isPlatform} onChange={e => setIsPlatform(e.target.checked)} />}
              label="Règle plateforme (s'applique à tous les tenants)"
            />
          )}
          {error && <Alert severity="error" sx={{ borderRadius: 1 }}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !ipAddress.trim() || !ipValid}
          variant="contained"
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          {initial ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
