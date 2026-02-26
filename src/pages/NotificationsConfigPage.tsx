import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  FormGroup,
  Checkbox,
  FormLabel,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AutoAwesome as AutoAwesomeIcon,
  Preview as PreviewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTIF_EVENTS = [
  { value: 'APPLICATION_SUBMITTED', label: 'Demande soumise' },
  { value: 'STEP_ASSIGNED',         label: 'Étape assignée' },
  { value: 'STEP_APPROVED',         label: 'Étape approuvée' },
  { value: 'STEP_REJECTED',         label: 'Étape rejetée' },
  { value: 'APPLICATION_APPROVED',  label: 'Demande approuvée' },
  { value: 'APPLICATION_REJECTED',  label: 'Demande rejetée' },
];

const ROLE_OPTIONS = [
  { value: 'ACCOUNT_MANAGER',  label: 'Chargé de compte' },
  { value: 'CREDIT_ANALYST',   label: 'Analyste crédit' },
  { value: 'BRANCH_MANAGER',   label: 'Directeur d\'agence' },
  { value: 'CREDIT_COMMITTEE', label: 'Comité de crédit' },
  { value: 'MANAGEMENT',       label: 'Direction générale' },
  { value: 'ADMIN',            label: 'Administrateur' },
];

const TEMPLATE_VARIABLES = [
  'clientName', 'applicationNumber', 'amount', 'currency',
  'stepName', 'assigneeName', 'actionUrl', 'createdByName', 'decision', 'comments',
];

const SMS_PROVIDERS = [
  { value: 'orange',   label: 'Orange API' },
  { value: 'generic',  label: 'REST Générique' },
];

function eventLabel(event: string) {
  return NOTIF_EVENTS.find(e => e.value === event)?.label || event;
}

// ─── Tab panel ────────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

const NotificationsConfigPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedMsg(null);
    const res = await ApiService.seedDefaultNotifications();
    setSeeding(false);
    if (res.success) {
      const { created, skipped } = res.data as any;
      setSeedMsg({
        type: created > 0 ? 'success' : 'info',
        text: res.message || `${created} modèle(s) créé(s), ${skipped} déjà existant(s).`,
      });
    } else {
      setSeedMsg({ type: 'error', text: res.error || 'Erreur' });
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5" fontWeight={700}>Configuration des Notifications</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Gérez les canaux d'envoi, les modèles de messages et les règles de déclenchement.
          </Typography>
        </Box>
        <Tooltip title="Charge les 6 modèles HTML professionnels par défaut (un par événement workflow)">
          <Button
            variant="outlined"
            startIcon={seeding ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={handleSeedDefaults}
            disabled={seeding}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Charger les modèles par défaut
          </Button>
        </Tooltip>
      </Box>

      {seedMsg && (
        <Alert severity={seedMsg.type} onClose={() => setSeedMsg(null)} sx={{ mb: 2 }}>
          {seedMsg.text}
          {seedMsg.type === 'success' && (
            <Typography variant="caption" display="block" mt={0.5}>
              Pensez à configurer votre canal Email (SMTP) dans l'onglet "Canaux" pour activer l'envoi.
            </Typography>
          )}
        </Alert>
      )}

      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<EmailIcon />} iconPosition="start" label="Canaux" />
          <Tab label="Modèles" />
          <Tab label="Règles" />
        </Tabs>
      </Paper>

      <TabPanel value={tab} index={0}><ChannelsTab /></TabPanel>
      <TabPanel value={tab} index={1}><TemplatesTab /></TabPanel>
      <TabPanel value={tab} index={2}><RulesTab /></TabPanel>
    </Box>
  );
};

// ─── Channels Tab ─────────────────────────────────────────────────────────────

function ChannelsTab() {
  const [channels, setChannels] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [testAddress, setTestAddress] = useState('');

  const load = useCallback(async () => {
    const res = await ApiService.getNotificationChannels();
    if (res.success && res.data) {
      const map: Record<string, any> = {};
      for (const ch of res.data) map[ch.type] = ch;
      setChannels(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getEmailCfg = () => channels['EMAIL']?.config || {};
  const getSmsCfg = () => channels['SMS']?.config || {};

  const [emailForm, setEmailForm] = useState<any>({});
  const [smsForm, setSmsForm] = useState<any>({});

  useEffect(() => {
    setEmailForm(getEmailCfg());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels['EMAIL']]);

  useEffect(() => {
    setSmsForm(getSmsCfg());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels['SMS']]);

  const saveChannel = async (type: string, config: any, isActive: boolean) => {
    setSaving(p => ({ ...p, [type]: true }));
    const res = await ApiService.updateNotificationChannel(type, { isActive, config, name: type });
    setSaving(p => ({ ...p, [type]: false }));
    if (res.success) {
      setMsg({ type: 'success', text: 'Canal mis à jour' });
      load();
    } else {
      setMsg({ type: 'error', text: res.error || 'Erreur' });
    }
  };

  const testChannel = async (type: string) => {
    setTesting(p => ({ ...p, [type]: true }));
    const res = await ApiService.testNotificationChannel(type, testAddress || undefined);
    setTesting(p => ({ ...p, [type]: false }));
    setMsg({ type: res.success ? 'success' : 'error', text: res.success ? (res.message || 'Test réussi') : (res.error || 'Échec') });
  };

  return (
    <Grid container spacing={3}>
      {msg && (
        <Grid item xs={12}>
          <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>
        </Grid>
      )}

      {/* Email Card */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <EmailIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>Email (SMTP)</Typography>
              <Box flexGrow={1} />
              <FormControlLabel
                control={
                  <Switch
                    checked={channels['EMAIL']?.isActive || false}
                    onChange={(e) => saveChannel('EMAIL', emailForm, e.target.checked)}
                  />
                }
                label="Actif"
              />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={8}>
                <TextField fullWidth size="small" label="Hôte SMTP" value={emailForm.host || ''} onChange={e => setEmailForm((p: any) => ({ ...p, host: e.target.value }))} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth size="small" label="Port" type="number" value={emailForm.port || ''} onChange={e => setEmailForm((p: any) => ({ ...p, port: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Utilisateur" value={emailForm.user || ''} onChange={e => setEmailForm((p: any) => ({ ...p, user: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="Mot de passe"
                  type={showPass ? 'text' : 'password'}
                  value={emailForm.pass || ''}
                  onChange={e => setEmailForm((p: any) => ({ ...p, pass: e.target.value }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPass(p => !p)}>
                          {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Nom expéditeur" value={emailForm.fromName || ''} onChange={e => setEmailForm((p: any) => ({ ...p, fromName: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Adresse expéditeur" value={emailForm.fromEmail || ''} onChange={e => setEmailForm((p: any) => ({ ...p, fromEmail: e.target.value }))} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={emailForm.secure === true || emailForm.secure === 'true'} onChange={e => setEmailForm((p: any) => ({ ...p, secure: e.target.checked }))} />}
                  label="TLS/SSL"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Adresse de test" placeholder="test@example.com" value={testAddress} onChange={e => setTestAddress(e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button variant="contained" size="small" disabled={saving['EMAIL']} onClick={() => saveChannel('EMAIL', emailForm, channels['EMAIL']?.isActive || false)}>
              {saving['EMAIL'] ? <CircularProgress size={16} /> : 'Enregistrer'}
            </Button>
            <Button variant="outlined" size="small" startIcon={<SendIcon />} disabled={testing['EMAIL']} onClick={() => testChannel('EMAIL')}>
              {testing['EMAIL'] ? <CircularProgress size={16} /> : 'Tester'}
            </Button>
          </CardActions>
        </Card>
      </Grid>

      {/* SMS Card */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <SmsIcon color="secondary" />
              <Typography variant="h6" fontWeight={600}>SMS</Typography>
              <Box flexGrow={1} />
              <FormControlLabel
                control={
                  <Switch
                    checked={channels['SMS']?.isActive || false}
                    onChange={(e) => saveChannel('SMS', smsForm, e.target.checked)}
                  />
                }
                label="Actif"
              />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth size="small" select label="Fournisseur" value={smsForm.provider || 'orange'} onChange={e => setSmsForm((p: any) => ({ ...p, provider: e.target.value }))}>
                  {SMS_PROVIDERS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="API Key" value={smsForm.apiKey || ''} onChange={e => setSmsForm((p: any) => ({ ...p, apiKey: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Sender ID" value={smsForm.senderId || ''} onChange={e => setSmsForm((p: any) => ({ ...p, senderId: e.target.value }))} />
              </Grid>
              {smsForm.provider !== 'orange' && (
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="URL de base" value={smsForm.baseUrl || ''} onChange={e => setSmsForm((p: any) => ({ ...p, baseUrl: e.target.value }))} />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Numéro de test" placeholder="+221701234567" value={testAddress} onChange={e => setTestAddress(e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button variant="contained" size="small" disabled={saving['SMS']} onClick={() => saveChannel('SMS', smsForm, channels['SMS']?.isActive || false)}>
              {saving['SMS'] ? <CircularProgress size={16} /> : 'Enregistrer'}
            </Button>
            <Button variant="outlined" size="small" startIcon={<SendIcon />} disabled={testing['SMS']} onClick={() => testChannel('SMS')}>
              {testing['SMS'] ? <CircularProgress size={16} /> : 'Tester'}
            </Button>
          </CardActions>
        </Card>
      </Grid>
    </Grid>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: '', event: '', channelId: '', subject: '', body: '', isActive: true });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, cRes] = await Promise.all([
      ApiService.getNotificationTemplates(),
      ApiService.getNotificationChannels(),
    ]);
    if (tRes.success && tRes.data) setTemplates(tRes.data);
    if (cRes.success && cRes.data) setChannels(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', event: '', channelId: '', subject: '', body: '', isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, event: t.event, channelId: t.channelId, subject: t.subject || '', body: t.body, isActive: t.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.event || !form.channelId || !form.body) {
      setMsg({ type: 'error', text: 'Nom, événement, canal et corps sont obligatoires.' });
      return;
    }
    const res = editing
      ? await ApiService.updateNotificationTemplate(editing.id, form)
      : await ApiService.createNotificationTemplate(form);
    if (res.success) {
      setMsg({ type: 'success', text: editing ? 'Template mis à jour' : 'Template créé' });
      setDialogOpen(false);
      load();
    } else {
      setMsg({ type: 'error', text: res.error || 'Erreur' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce template ?')) return;
    const res = await ApiService.deleteNotificationTemplate(id);
    if (res.success) { setMsg({ type: 'success', text: 'Template supprimé' }); load(); }
    else setMsg({ type: 'error', text: res.error || 'Erreur' });
  };

  /** Insert variable tag at cursor position in the body textarea */
  const insertVar = (varName: string) => {
    const el = bodyRef.current;
    const tag = `{{${varName}}}`;
    if (!el) {
      setForm((p: any) => ({ ...p, body: p.body + tag }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const newBody = el.value.slice(0, start) + tag + el.value.slice(end);
    setForm((p: any) => ({ ...p, body: newBody }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  /** Fetch rendered preview HTML from the backend */
  const handlePreview = async () => {
    if (!form.event || !form.body) {
      setMsg({ type: 'error', text: 'Sélectionnez un événement et saisissez un message avant de prévisualiser.' });
      return;
    }
    setPreviewing(true);
    const res = await ApiService.previewNotificationTemplate(form.event, form.body, form.subject);
    setPreviewing(false);
    if (res.success && res.data) {
      setPreviewHtml((res.data as any).html);
      setPreviewSubject((res.data as any).subject);
      setPreviewOpen(true);
    } else {
      setMsg({ type: 'error', text: res.error || 'Erreur lors de la prévisualisation' });
    }
  };

  const selectedChannel = channels.find(c => c.id === form.channelId);
  const charCount = form.body.length;

  return (
    <Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)} sx={{ mb: 2 }}>{msg.text}</Alert>}

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nouveau template
        </Button>
      </Box>

      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Événement</TableCell>
                <TableCell>Canal</TableCell>
                <TableCell>Actif</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={eventLabel(t.event)} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small" label={t.channel?.type}
                      color={t.channel?.type === 'EMAIL' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.isActive ? 'Actif' : 'Inactif'}
                      color={t.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifier">
                      <IconButton size="small" onClick={() => openEdit(t)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Aucun template — cliquez sur "Charger les modèles par défaut" pour démarrer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Template edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{editing ? 'Modifier le template' : 'Nouveau template'}</span>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2.5}>

            {/* Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Nom du template" required
                value={form.name}
                onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Nouvelle demande — Analyste"
              />
            </Grid>

            {/* Event */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" select label="Événement déclencheur" required
                value={form.event}
                onChange={e => setForm((p: any) => ({ ...p, event: e.target.value }))}
              >
                {NOTIF_EVENTS.map(ev => (
                  <MenuItem key={ev.value} value={ev.value}>{ev.label}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Channel */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" select label="Canal d'envoi" required
                value={form.channelId}
                onChange={e => setForm((p: any) => ({ ...p, channelId: e.target.value }))}
              >
                {channels.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.type === 'EMAIL' ? '📧' : '📱'} {c.type} — {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Subject (email only) */}
            {selectedChannel?.type === 'EMAIL' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="Objet de l'email"
                  value={form.subject}
                  onChange={e => setForm((p: any) => ({ ...p, subject: e.target.value }))}
                  placeholder="Ex: [OptimusCredit] Dossier {{applicationNumber}}"
                  helperText="Vous pouvez utiliser des variables {{...}}"
                />
              </Grid>
            )}

            {/* Body area */}
            <Grid item xs={12}>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                {/* Toolbar: variable chips */}
                <Box
                  sx={{
                    px: 1.5, py: 1,
                    bgcolor: 'grey.50',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mr: 0.5, fontWeight: 600, flexShrink: 0 }}
                  >
                    Insérer :
                  </Typography>
                  {TEMPLATE_VARIABLES.map(v => (
                    <Chip
                      key={v}
                      label={`{{${v}}}`}
                      size="small"
                      onClick={() => insertVar(v)}
                      clickable
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.68rem',
                        height: 22,
                        bgcolor: 'primary.50',
                        color: 'primary.800',
                        border: '1px solid',
                        borderColor: 'primary.200',
                        '&:hover': { bgcolor: 'primary.100' },
                      }}
                    />
                  ))}
                </Box>

                {/* Textarea */}
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={form.body}
                  onChange={e => setForm((p: any) => ({ ...p, body: e.target.value }))}
                  inputRef={bodyRef}
                  placeholder={`Rédigez votre message ici en langage naturel.\n\nUtilisez les boutons ci-dessus pour insérer des variables dynamiques, ou tapez directement {{clientName}}, {{applicationNumber}}, etc.\n\nSéparez les paragraphes avec une ligne vide.`}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      '& fieldset': { border: 'none' },
                    },
                    '& textarea': {
                      fontSize: '14px',
                      lineHeight: 1.7,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    },
                  }}
                />

                {/* Footer: char count + info */}
                <Box
                  sx={{
                    px: 1.5, py: 0.75,
                    bgcolor: 'grey.50',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.disabled">
                    Texte brut — le design email est appliqué automatiquement à l'envoi
                  </Typography>
                  <Typography variant="caption" color={charCount > 1000 ? 'warning.main' : 'text.disabled'}>
                    {charCount} caractère{charCount > 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Active toggle */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                  />
                }
                label="Template actif"
              />
            </Grid>

          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ mr: 'auto' }}>
            Annuler
          </Button>
          <Tooltip title="Voir le rendu de l'email avec des données d'exemple">
            <Button
              variant="outlined"
              startIcon={previewing ? <CircularProgress size={16} /> : <PreviewIcon />}
              onClick={handlePreview}
              disabled={previewing || !form.event || !form.body}
            >
              Aperçu
            </Button>
          </Tooltip>
          <Button variant="contained" onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Preview dialog ───────────────────────────────────────────── */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid', borderColor: 'divider', pb: 1.5,
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Aperçu de l'email</Typography>
            <Typography variant="caption" color="text.secondary">
              Rendu avec des données d'exemple · Le design réel dépend du client email
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPreviewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Subject bar */}
        <Box
          sx={{
            px: 3, py: 1.5,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'baseline',
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 600 }}>
            Objet :
          </Typography>
          <Typography variant="body2" fontWeight={500} noWrap>
            {previewSubject}
          </Typography>
        </Box>

        {/* iframe */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <iframe
            srcDoc={previewHtml}
            title="Aperçu email"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
          />
        </Box>

        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, px: 1 }}>
            Données utilisées : ACME Sénégal SARL · OC-2024-00042 · 25 000 000 XOF
          </Typography>
          <Button onClick={() => setPreviewOpen(false)}>Fermer</Button>
          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setPreviewOpen(false)}>
            Continuer l'édition
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ event: '', templateId: '', recipientRoles: [] as string[], isActive: true });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, tRes] = await Promise.all([ApiService.getNotificationRules(), ApiService.getNotificationTemplates()]);
    if (rRes.success && rRes.data) setRules(rRes.data);
    if (tRes.success && tRes.data) setTemplates(tRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ event: '', templateId: '', recipientRoles: [], isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ event: r.event, templateId: r.templateId, recipientRoles: r.recipientRoles || [], isActive: r.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const res = editing
      ? await ApiService.updateNotificationRule(editing.id, form)
      : await ApiService.createNotificationRule(form);
    if (res.success) {
      setMsg({ type: 'success', text: editing ? 'Règle mise à jour' : 'Règle créée' });
      setDialogOpen(false);
      load();
    } else {
      setMsg({ type: 'error', text: res.error || 'Erreur' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette règle ?')) return;
    const res = await ApiService.deleteNotificationRule(id);
    if (res.success) { setMsg({ type: 'success', text: 'Règle supprimée' }); load(); }
    else setMsg({ type: 'error', text: res.error || 'Erreur' });
  };

  const toggleRole = (role: string) => {
    setForm((p: any) => ({
      ...p,
      recipientRoles: p.recipientRoles.includes(role)
        ? p.recipientRoles.filter((r: string) => r !== role)
        : [...p.recipientRoles, role],
    }));
  };

  const filteredTemplates = form.event
    ? templates.filter(t => t.event === form.event && t.isActive)
    : templates.filter(t => t.isActive);

  return (
    <Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Nouvelle règle</Button>
      </Box>

      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Événement</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Rôles destinataires</TableCell>
                <TableCell>Actif</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Chip size="small" label={eventLabel(r.event)} /></TableCell>
                  <TableCell>{r.template?.name}</TableCell>
                  <TableCell>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {(r.recipientRoles as string[]).map(role => (
                        <Chip key={role} size="small" label={ROLE_OPTIONS.find(o => o.value === role)?.label || role} variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell><Chip size="small" label={r.isActive ? 'Actif' : 'Inactif'} color={r.isActive ? 'success' : 'default'} /></TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifier"><IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Supprimer"><IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>Aucune règle</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Rule Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" select label="Événement" value={form.event} onChange={e => setForm((p: any) => ({ ...p, event: e.target.value, templateId: '' }))}>
                {NOTIF_EVENTS.map(ev => <MenuItem key={ev.value} value={ev.value}>{ev.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" select label="Template" value={form.templateId} onChange={e => setForm((p: any) => ({ ...p, templateId: e.target.value }))} disabled={!form.event}>
                {filteredTemplates.map(t => <MenuItem key={t.id} value={t.id}>{t.name} ({t.channel?.type})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormLabel component="legend" sx={{ fontSize: '0.85rem', mb: 1 }}>Rôles destinataires</FormLabel>
              <FormGroup>
                <Grid container>
                  {ROLE_OPTIONS.map(role => (
                    <Grid item xs={6} key={role.value}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={form.recipientRoles.includes(role.value)}
                            onChange={() => toggleRole(role.value)}
                          />
                        }
                        label={<Typography variant="body2">{role.label}</Typography>}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={form.isActive} onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))} />} label="Actif" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default NotificationsConfigPage;
