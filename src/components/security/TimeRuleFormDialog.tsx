import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, FormControl, FormControlLabel, Switch, Checkbox,
  Box, Typography, Chip, Stack, Alert, Divider,
} from '@mui/material';
import { ApiService } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { colors } from '../home/homeTokens';

const DAYS: { iso: number; label: string; bit: number }[] = [
  { iso: 1, label: 'Lun', bit: 1 },
  { iso: 2, label: 'Mar', bit: 2 },
  { iso: 3, label: 'Mer', bit: 4 },
  { iso: 4, label: 'Jeu', bit: 8 },
  { iso: 5, label: 'Ven', bit: 16 },
  { iso: 6, label: 'Sam', bit: 32 },
  { iso: 7, label: 'Dim', bit: 64 },
];

const TIMEZONES = [
  'Europe/Paris', 'Africa/Dakar', 'Africa/Abidjan', 'Africa/Casablanca', 'UTC',
];

const APPLIES_TO = [
  { value: 'ALL',        label: 'Tous les utilisateurs' },
  { value: 'BRANCH',     label: 'Par agence' },
  { value: 'DEPARTMENT', label: 'Par département' },
  { value: 'ROLE',       label: 'Par rôle' },
  { value: 'USER',       label: 'Utilisateurs spécifiques' },
];

export interface TimeRule {
  id: string;
  name: string;
  daysOfWeek: number;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  appliesTo: 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'ROLE' | 'USER';
  targetValues: string[];
  deniedMessage: string | null;
  isActive: boolean;
  companyId: string | null;
}

interface Props {
  open: boolean;
  initial?: TimeRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TimeRuleFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { isRole } = useUser();
  const isSuperAdmin = isRole('super_admin');

  const [name, setName] = useState('');
  const [days, setDays] = useState(0);
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('18:00');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [appliesTo, setAppliesTo] = useState<TimeRule['appliesTo']>('ALL');
  const [targetValues, setTargetValues] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState('');
  const [deniedMessage, setDeniedMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPlatform, setIsPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ date: string; allowed: boolean; slots: { start: string; end: string }[] }[] | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDays(initial?.daysOfWeek ?? 31);
      setTimeStart(initial?.timeStart ?? '09:00');
      setTimeEnd(initial?.timeEnd ?? '18:00');
      setTimezone(initial?.timezone ?? 'Europe/Paris');
      setAppliesTo(initial?.appliesTo ?? 'ALL');
      setTargetValues(initial?.targetValues ?? []);
      setTargetInput('');
      setDeniedMessage(initial?.deniedMessage ?? '');
      setIsActive(initial?.isActive ?? true);
      setIsPlatform(initial ? initial.companyId === null : false);
      setError(null);
      setPreview(null);
    }
  }, [open, initial]);

  function toggleDay(bit: number) {
    setDays(d => (d & bit) ? d & ~bit : d | bit);
  }
  function setBusinessDays() { setDays(31); }
  function setAllDays()      { setDays(127); }
  function clearDays()       { setDays(0); }

  function addTarget() {
    const v = targetInput.trim();
    if (v && !targetValues.includes(v)) {
      setTargetValues([...targetValues, v]);
      setTargetInput('');
    }
  }

  async function loadPreview() {
    if (!initial) return;
    setPreviewLoading(true);
    try {
      const res = await ApiService.security.timeRules.preview(initial.id);
      setPreview(res.data.preview);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError('Nom requis'); return; }
    if (days === 0)   { setError('Sélectionnez au moins un jour'); return; }
    if (appliesTo !== 'ALL' && targetValues.length === 0) {
      setError('Cibles requises pour ce type de portée');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), daysOfWeek: days, timeStart, timeEnd, timezone,
        appliesTo, targetValues, deniedMessage: deniedMessage || undefined,
        isActive,
      };
      if (initial) {
        await ApiService.security.timeRules.update(initial.id, body);
      } else {
        await ApiService.security.timeRules.create({
          ...body,
          ...(isSuperAdmin && isPlatform ? { companyId: null } : {}),
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: colors.text.primary }}>
        {initial ? 'Modifier la plage horaire' : 'Ajouter une plage horaire'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Nom" value={name} onChange={e => setName(e.target.value)} fullWidth size="small" />

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: colors.text.secondary }}>Jours</Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {DAYS.map(d => {
                const on = (days & d.bit) !== 0;
                return (
                  <Chip
                    key={d.iso}
                    label={d.label}
                    onClick={() => toggleDay(d.bit)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: on ? colors.accent.primary : '#f1f5f9',
                      color: on ? '#fff' : '#475569',
                      fontWeight: 600,
                      '&:hover': { bgcolor: on ? colors.accent.hover : '#e2e8f0' },
                    }}
                  />
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="text" onClick={setBusinessDays}>Lun-Ven</Button>
              <Button size="small" variant="text" onClick={setAllDays}>Tous</Button>
              <Button size="small" variant="text" onClick={clearDays}>Aucun</Button>
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Heure début" type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} size="small" sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
            <TextField label="Heure fin"   type="time" value={timeEnd}   onChange={e => setTimeEnd(e.target.value)}   size="small" sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
            <FormControl size="small" sx={{ flex: 1 }}>
              <TextField select label="Timezone" value={timezone} onChange={e => setTimezone(e.target.value)} size="small">
                {TIMEZONES.map(tz => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
              </TextField>
            </FormControl>
          </Box>

          <TextField select label="S'applique à" value={appliesTo} onChange={e => setAppliesTo(e.target.value as TimeRule['appliesTo'])} size="small">
            {APPLIES_TO.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>

          {appliesTo !== 'ALL' && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: colors.text.secondary }}>Cibles</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTarget(); } }}
                  placeholder={
                    appliesTo === 'BRANCH'     ? 'Ex : AGENCE_DAKAR' :
                    appliesTo === 'DEPARTMENT' ? 'Ex : JURIDIQUE' :
                    appliesTo === 'ROLE'       ? 'Ex : CHARGE_AFFAIRES' :
                                                 'ID utilisateur'
                  }
                />
                <Button onClick={addTarget} size="small" variant="outlined">Ajouter</Button>
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {targetValues.map(v => (
                  <Chip key={v} label={v} size="small" onDelete={() => setTargetValues(targetValues.filter(x => x !== v))} />
                ))}
              </Stack>
            </Box>
          )}

          <TextField
            label="Message de refus (facultatif)"
            value={deniedMessage}
            onChange={e => setDeniedMessage(e.target.value)}
            multiline rows={2} fullWidth size="small"
          />

          <FormControlLabel control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />} label="Règle active" />

          {isSuperAdmin && !initial && (
            <FormControlLabel control={<Checkbox checked={isPlatform} onChange={e => setIsPlatform(e.target.checked)} />} label="Règle plateforme (s'applique à tous les tenants)" />
          )}

          {error && <Alert severity="error" sx={{ borderRadius: 1 }}>{error}</Alert>}

          {initial && (
            <>
              <Divider />
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>Aperçu 7 jours</Typography>
                  <Button size="small" onClick={loadPreview} disabled={previewLoading}>
                    {previewLoading ? 'Chargement…' : preview ? 'Recharger' : "Charger l'aperçu"}
                  </Button>
                </Box>
                {preview && (
                  <Stack spacing={0.5}>
                    {preview.map(d => (
                      <Box key={d.date} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5 }}>
                        <Box component="span" sx={{ fontFamily: 'monospace', minWidth: 100 }}>{d.date}</Box>
                        <Chip
                          label={d.allowed ? 'Autorisé' : 'Refusé'}
                          size="small"
                          sx={{
                            bgcolor: d.allowed ? '#d1fae5' : '#fee2e2',
                            color: d.allowed ? '#065f46' : '#9F1239',
                            border: 'none', fontWeight: 600,
                          }}
                        />
                        {d.slots.map((s, i) => (
                          <Box key={i} component="span" sx={{ fontFamily: 'monospace', color: colors.text.muted }}>
                            {s.start}–{s.end}
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || days === 0}
          variant="contained"
          sx={{ bgcolor: colors.accent.primary, '&:hover': { bgcolor: colors.accent.hover } }}
        >
          {initial ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
