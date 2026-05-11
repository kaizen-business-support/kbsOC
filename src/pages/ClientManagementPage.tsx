import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
  Drawer,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as PaidIcon,
  Cancel as LateIcon,
  RadioButtonUnchecked as PendingIcon,
  PieChart as PartialIcon,
  VerifiedUser as SibIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { DossierActionDrawer } from '../components/DossierActionDrawer';
import { ApprovalItem } from '../types';

interface ClientManagementPageProps {
  onNavigate: (page: any) => void;
}

interface RawClient {
  id: string;
  companyName: string;
  accountNumber?: string | null;
  rccm: string | null;
  ninea: string | null;
  legalForm: string | null;
  sector: string | null;
  branch: string | null;
  headquarters: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  establishedYear: number | null;
  isActive: boolean;
  createdAt: string;
  creator?: { name: string; department?: string };
  totalExposure?: number;
  appCount?: number;
  activeAppCount?: number;
  lastAppStatus?: string | null;
}

interface RawApplication {
  id: string;
  applicationNumber?: string;
  amount: number;
  currency: string;
  purpose?: string;
  status: string;
  durationMonths: number;
  proposedRate: number;
  repaymentSchedule: string;
  createdAt: string;
  creditType?: { name: string };
  documents?: { id: string }[];
  workflowSteps?: { id: string; status: string; completedAt: string | null }[];
}

const industries = [
  'Agriculture et Agrobusiness',
  'Manufacture et Industrie',
  'Commerce et Distribution',
  'Services et Professionnel',
  'Technologie et Innovation',
  'Tourisme et Hôtellerie',
  'Transport et Logistique',
];

const APP_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:        { label: 'Brouillon',      color: '#6b7280', bg: '#f3f4f6' },
  SUBMITTED:    { label: 'Soumis',         color: '#1d4ed8', bg: '#eff6ff' },
  UNDER_REVIEW: { label: 'En instruction', color: '#d97706', bg: '#fffbeb' },
  APPROVED:     { label: 'Approuvé',       color: '#15803d', bg: '#f0fdf4' },
  REJECTED:     { label: 'Rejeté',         color: '#dc2626', bg: '#fef2f2' },
  DISBURSED:    { label: 'Décaissé',       color: '#7c3aed', bg: '#f5f3ff' },
  CANCELLED:    { label: 'Annulé',         color: '#374151', bg: '#f9fafb' },
};

// Roles that can create and edit clients
const CAN_CREATE_ROLES = ['CHARGE_AFFAIRES', 'ASSISTANT_COMMERCIAL', 'ADMIN', 'SUPER_ADMIN'];
// Roles that can toggle client active/inactive status
const CAN_TOGGLE_STATUS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'RESPONSABLE_ENGAGEMENTS', 'DIR_AG'];

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 42%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtXOF(amount: number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + currency;
}

function relationDuration(createdAt: string): string {
  const months = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  if (months < 1) return 'Moins d\'un mois';
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} an${y > 1 ? 's' : ''} ${m} mois` : `${y} an${y > 1 ? 's' : ''}`;
}

interface AmortizationRow {
  n: number;
  date: string;
  dueDate: Date;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
}

type RepaymentStatus = 'PENDING' | 'PAID' | 'LATE' | 'PARTIAL';

interface RepaymentEntry {
  id: string;
  periodNumber: number;
  status: RepaymentStatus;
  paidAmount?: number | null;
  paidAt?: string | null;
  notes?: string | null;
  verifiedBy?: { name: string } | null;
  verifiedAt?: string | null;
}

const REPAYMENT_CFG: Record<RepaymentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PAID:    { label: 'Réglé',    color: '#15803d', bg: '#f0fdf4', icon: <PaidIcon    sx={{ fontSize: 16, color: '#15803d' }} /> },
  PARTIAL: { label: 'Partiel',  color: '#b45309', bg: '#fffbeb', icon: <PartialIcon sx={{ fontSize: 16, color: '#b45309' }} /> },
  LATE:    { label: 'Impayé',   color: '#dc2626', bg: '#fef2f2', icon: <LateIcon    sx={{ fontSize: 16, color: '#dc2626' }} /> },
  PENDING: { label: 'En attente', color: '#6b7280', bg: '#f9fafb', icon: <PendingIcon sx={{ fontSize: 16, color: '#9ca3af' }} /> },
};

function buildAmortization(app: RawApplication): AmortizationRow[] {
  const periodsPerYear: Record<string, number> = {
    MONTHLY: 12, QUARTERLY: 4, SEMIANNUAL: 2, ANNUAL: 1,
  };
  const ppY = periodsPerYear[app.repaymentSchedule] ?? 12;
  const nPeriods = Math.round(app.durationMonths / (12 / ppY));
  const r = (app.proposedRate ?? 0) / 100 / ppY;
  const amount = Number(app.amount);
  const payment =
    r > 0
      ? (amount * r * Math.pow(1 + r, nPeriods)) / (Math.pow(1 + r, nPeriods) - 1)
      : amount / nPeriods;

  const rows: AmortizationRow[] = [];
  let remaining = amount;
  const startDate = new Date(app.createdAt);
  const monthStep = Math.round(12 / ppY);

  for (let i = 1; i <= nPeriods; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i * monthStep);
    const interest = remaining * r;
    const principal = Math.min(payment - interest, remaining);
    remaining = Math.max(0, remaining - principal);
    rows.push({
      n: i,
      date: d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      dueDate: new Date(d),
      payment,
      principal,
      interest,
      remaining,
    });
  }
  return rows;
}

const emptyForm = {
  companyName: '', rccm: '', ninea: '', legalForm: '', sector: '',
  branch: '', headquarters: '', phone: '', email: '', contactPerson: '',
};

export const ClientManagementPage: React.FC<ClientManagementPageProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation();
  const { state: userState } = useUser();
  const userRole = userState.currentUser?.role ?? '';

  const canCreate = CAN_CREATE_ROLES.includes(userRole);
  const canEdit = CAN_CREATE_ROLES.includes(userRole);
  const canToggle = CAN_TOGGLE_STATUS_ROLES.includes(userRole);

  const [currentTab, setCurrentTab] = useState(0);
  const [rawClients, setRawClients] = useState<RawClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [createNotif, setCreateNotif] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newClientForm, setNewClientForm] = useState(emptyForm);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editNotif, setEditNotif] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClient, setDrawerClient] = useState<RawClient & { applications?: RawApplication[] } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // DossierActionDrawer
  const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
  const [dossierItem, setDossierItem] = useState<ApprovalItem | null>(null);

  // Remboursements
  const [repaymentEntries, setRepaymentEntries] = useState<RepaymentEntry[]>([]);
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [sibDialog, setSibDialog] = useState<{
    open: boolean;
    row: AmortizationRow | null;
    status: RepaymentStatus;
    paidAmount: string;
    notes: string;
    saving: boolean;
  }>({ open: false, row: null, status: 'PAID', paidAmount: '', notes: '', saving: false });

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getClients();
      if (response.success && response.data) {
        setRawClients(response.data as RawClient[]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleFormChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => setNewClientForm((prev) => ({ ...prev, [field]: e.target.value as string }));

  const handleEditFormChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => setEditForm((prev) => ({ ...prev, [field]: e.target.value as string }));

  const handleCreateClient = async () => {
    if (!newClientForm.companyName.trim()) {
      setCreateNotif({ msg: 'La raison sociale est obligatoire', sev: 'error' });
      return;
    }
    setIsCreating(true);
    try {
      const res = await ApiService.createClient(newClientForm);
      if (res.success) {
        setCreateNotif({ msg: 'Client créé avec succès', sev: 'success' });
        setNewClientForm(emptyForm);
        await loadClients();
        setTimeout(() => setCurrentTab(0), 1200);
      } else {
        setCreateNotif({ msg: res.error || 'Erreur lors de la création', sev: 'error' });
      }
    } catch {
      setCreateNotif({ msg: 'Erreur lors de la création du client', sev: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (client: RawClient, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingClientId(client.id);
    setEditForm({
      companyName: client.companyName,
      rccm: client.rccm || '',
      ninea: client.ninea || '',
      legalForm: client.legalForm || '',
      sector: client.sector || '',
      branch: client.branch || '',
      headquarters: client.headquarters || '',
      phone: client.phone || '',
      email: client.email || '',
      contactPerson: client.contactPerson || '',
    });
    setEditNotif(null);
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingClientId) return;
    if (!editForm.companyName.trim()) {
      setEditNotif({ msg: 'La raison sociale est obligatoire', sev: 'error' });
      return;
    }
    setIsEditSaving(true);
    try {
      const res = await ApiService.updateClient(editingClientId, editForm);
      if (res.success) {
        setEditNotif({ msg: 'Client modifié avec succès', sev: 'success' });
        await loadClients();
        setTimeout(() => setOpenEditDialog(false), 1000);
      } else {
        setEditNotif({ msg: res.error || 'Erreur lors de la modification', sev: 'error' });
      }
    } catch {
      setEditNotif({ msg: 'Erreur lors de la modification du client', sev: 'error' });
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleOpenDrawer = async (client: RawClient) => {
    setDrawerClient(client);
    setDrawerTab(0);
    setSelectedAppId('');
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await ApiService.getClientById(client.id);
      if (res.success && res.data) {
        setDrawerClient(res.data as RawClient & { applications?: RawApplication[] });
      }
    } catch {
      /* silent */
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleToggleStatus = async (client: RawClient, e: React.MouseEvent) => {
    e.stopPropagation();
    setToggleLoadingId(client.id);
    try {
      const res = await ApiService.toggleClientStatus(client.id);
      if (res.success) {
        setRawClients((prev) =>
          prev.map((c) =>
            c.id === client.id ? { ...c, isActive: !c.isActive } : c
          )
        );
      }
    } catch {
      /* silent */
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleOpenDossier = (app: RawApplication) => {
    const item: ApprovalItem = {
      id: app.id,
      applicationId: app.id,
      applicationNumber: app.applicationNumber || app.id.slice(0, 8).toUpperCase(),
      clientName: drawerClient?.companyName || '',
      amount: Number(app.amount),
      currency: app.currency,
      stepName: '',
      stepLabel: '',
      stepType: '',
      allowedActions: [],
      type: 'financial',
      creditType: app.creditType?.name || null,
      branch: drawerClient?.branch || null,
      purpose: app.purpose || '',
      daysWaiting: Math.floor((Date.now() - new Date(app.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      deadline: null,
      isOverdue: false,
    };
    setDossierItem(item);
    setDossierDrawerOpen(true);
  };

  const loadRepaymentEntries = useCallback(async (appId: string) => {
    setRepaymentLoading(true);
    try {
      const res = await ApiService.getRepaymentEntries(appId);
      if (res.success && res.data) setRepaymentEntries(res.data);
      else setRepaymentEntries([]);
    } catch {
      setRepaymentEntries([]);
    } finally {
      setRepaymentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAppId) loadRepaymentEntries(selectedAppId);
    else setRepaymentEntries([]);
  }, [selectedAppId, loadRepaymentEntries]);

  const handleSibVerify = async () => {
    if (!sibDialog.row || !amortApp) return;
    setSibDialog((prev) => ({ ...prev, saving: true }));
    try {
      const row = sibDialog.row!;
      const res = await ApiService.updateRepaymentEntry(amortApp.id, row.n, {
        status: sibDialog.status,
        paidAmount: sibDialog.status === 'PARTIAL' ? Number(sibDialog.paidAmount) : Math.round(row.payment),
        notes: sibDialog.notes || undefined,
        dueDate: row.dueDate.toISOString(),
        expectedAmount: Math.round(row.payment),
        expectedPrincipal: Math.round(row.principal),
        expectedInterest: Math.round(row.interest),
      });
      if (res.success) {
        await loadRepaymentEntries(amortApp.id);
        setSibDialog({ open: false, row: null, status: 'PAID', paidAmount: '', notes: '', saving: false });
      }
    } catch {
      /* silent */
    } finally {
      setSibDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  const filtered = rawClients.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      (c.rccm || '').toLowerCase().includes(q) ||
      (c.sector || '').toLowerCase().includes(q) ||
      (c.accountNumber || '').toLowerCase().includes(q)
    );
  });

  const maxExposure = Math.max(...rawClients.map((c) => c.totalExposure ?? 0), 1);

  const disbursableApps = (drawerClient?.applications || []).filter(
    (a) => a.status === 'APPROVED' || a.status === 'DISBURSED'
  );

  const amortApp = disbursableApps.find((a) => a.id === selectedAppId);
  const amortRows = amortApp ? buildAmortization(amortApp) : [];
  const totalPayment = amortRows.reduce((s, r) => s + r.payment, 0);
  const totalInterest = amortRows.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = amortRows.reduce((s, r) => s + r.principal, 0);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('clients.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('clients.subtitle')}
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="Liste des Clients" />
            {canCreate && <Tab label="Nouveau Client" />}
          </Tabs>
        </Box>

        <CardContent>
          {currentTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <TextField
                  placeholder="Rechercher par nom, N° compte, RCCM ou secteur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  InputProps={{ startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> }}
                  sx={{ minWidth: 320 }}
                />
                {canCreate && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCurrentTab(1)}>
                    Nouveau Client
                  </Button>
                )}
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {['Client', 'N° Compte', 'Dossiers', 'Exposition', 'Agence', 'Chargé', 'Statut', 'Actions'].map((col) => (
                          <TableCell
                            key={col}
                            align={col === 'Actions' ? 'center' : 'left'}
                            sx={{
                              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.5px', color: '#6b7280',
                              borderBottom: '1px solid #e8ecf0', py: 1.5,
                            }}
                          >
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#9ca3af' }}>
                            Aucun client trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((client) => (
                          <TableRow
                            key={client.id}
                            sx={{
                              borderBottom: '1px solid #f1f5f9',
                              '&:last-child': { borderBottom: 'none' },
                              '&:hover': { bgcolor: 'rgba(31,78,121,0.03)', cursor: 'pointer' },
                              transition: 'background 0.15s',
                            }}
                          >
                            {/* Client */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar
                                  sx={{
                                    bgcolor: stringToColor(client.companyName),
                                    width: 36, height: 36, fontSize: '13px', fontWeight: 700,
                                  }}
                                >
                                  {initials(client.companyName)}
                                </Avatar>
                                <Box>
                                  <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
                                    {client.companyName}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                                    {client.sector || 'Secteur non précisé'}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>

                            {/* N° Compte */}
                            <TableCell sx={{ py: 1.5 }}>
                              {client.accountNumber ? (
                                <Typography
                                  sx={{
                                    fontSize: '12px', fontFamily: 'monospace', fontWeight: 600,
                                    color: '#1f4e79', bgcolor: '#eff6ff', px: 1, py: 0.3,
                                    borderRadius: 1, display: 'inline-block',
                                  }}
                                >
                                  {client.accountNumber}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary">—</Typography>
                              )}
                            </TableCell>

                            {/* Dossiers */}
                            <TableCell sx={{ py: 1.5, minWidth: 110 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={`${client.appCount ?? 0} dossier${(client.appCount ?? 0) > 1 ? 's' : ''}`}
                                  size="small"
                                  sx={{ fontSize: '11px', height: 20, bgcolor: '#eff6ff', color: '#1d4ed8', border: 'none' }}
                                />
                                {(client.activeAppCount ?? 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: '#d97706' }}>
                                    {client.activeAppCount} actif{(client.activeAppCount ?? 0) > 1 ? 's' : ''}
                                  </Typography>
                                )}
                              </Box>
                              {(client.appCount ?? 0) > 0 && (
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, ((client.totalExposure ?? 0) / maxExposure) * 100)}
                                  sx={{ mt: 0.5, height: 3, borderRadius: 1, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: '#1d4ed8' } }}
                                />
                              )}
                            </TableCell>

                            {/* Exposition */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1f4e79' }}>
                                {fmtXOF(client.totalExposure ?? 0)}
                              </Typography>
                            </TableCell>

                            {/* Agence */}
                            <TableCell sx={{ py: 1.5 }}>
                              {client.branch ? (
                                <Chip label={client.branch} size="small" variant="outlined" sx={{ fontSize: '11px', height: 22 }} />
                              ) : (
                                <Typography variant="caption" color="text.secondary">—</Typography>
                              )}
                            </TableCell>

                            {/* Chargé */}
                            <TableCell sx={{ py: 1.5, fontSize: '13px', color: '#374151' }}>
                              {client.creator?.name || '—'}
                            </TableCell>

                            {/* Statut */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={client.isActive ? 'Actif' : 'Inactif'}
                                size="small"
                                sx={{
                                  fontSize: '11px', height: 22, fontWeight: 600,
                                  bgcolor: client.isActive ? '#f0fdf4' : '#f3f4f6',
                                  color: client.isActive ? '#15803d' : '#6b7280',
                                  border: 'none',
                                }}
                              />
                            </TableCell>

                            {/* Actions */}
                            <TableCell align="center" sx={{ py: 1.5 }}>
                              <Tooltip title="Fiche client">
                                <IconButton size="small" color="primary" onClick={() => handleOpenDrawer(client)}>
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {canEdit && (
                                <Tooltip title="Modifier">
                                  <IconButton size="small" onClick={(e) => handleOpenEdit(client, e)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canToggle && (
                                <Tooltip title={client.isActive ? 'Désactiver' : 'Activer'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color={client.isActive ? 'success' : 'default'}
                                      disabled={toggleLoadingId === client.id}
                                      onClick={(e) => handleToggleStatus(client, e)}
                                    >
                                      {toggleLoadingId === client.id
                                        ? <CircularProgress size={16} />
                                        : client.isActive
                                          ? <ToggleOnIcon fontSize="small" />
                                          : <ToggleOffIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {canCreate && currentTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Création d'un Nouveau Client Corporatif
              </Typography>
              {createNotif && (
                <Alert severity={createNotif.sev} onClose={() => setCreateNotif(null)} sx={{ mb: 2 }}>
                  {createNotif.msg}
                </Alert>
              )}
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Raison Sociale *" required value={newClientForm.companyName} onChange={handleFormChange('companyName')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="RCCM" helperText="Registre du Commerce et du Crédit Mobilier" value={newClientForm.rccm} onChange={handleFormChange('rccm')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="NINEA" helperText="Numéro d'Identification Nationale des Entreprises" value={newClientForm.ninea} onChange={handleFormChange('ninea')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Forme Juridique (COFI)</InputLabel>
                    <Select label="Forme Juridique (COFI)" value={newClientForm.legalForm} onChange={handleFormChange('legalForm') as any}>
                      <MenuItem value="SARL">SARL - Société à Responsabilité Limitée</MenuItem>
                      <MenuItem value="SA">SA - Société Anonyme</MenuItem>
                      <MenuItem value="GIE">GIE - Groupement d'Intérêt Économique</MenuItem>
                      <MenuItem value="SNC">SNC - Société en Nom Collectif</MenuItem>
                      <MenuItem value="EI">EI - Entreprise Individuelle</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Secteur d'Activité</InputLabel>
                    <Select label="Secteur d'Activité" value={newClientForm.sector} onChange={handleFormChange('sector') as any}>
                      {industries.map((ind) => <MenuItem key={ind} value={ind}>{ind}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agence de Rattachement</InputLabel>
                    <Select label="Agence de Rattachement" value={newClientForm.branch} onChange={handleFormChange('branch') as any}>
                      {['Dakar Centre', 'Dakar Plateau', 'Thiès', 'Kaolack', 'Saint-Louis', 'Ziguinchor'].map((b) => (
                        <MenuItem key={b} value={b}>{b}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Personne de Contact" value={newClientForm.contactPerson} onChange={handleFormChange('contactPerson')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Siège Social" value={newClientForm.headquarters} onChange={handleFormChange('headquarters')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Téléphone" value={newClientForm.phone} onChange={handleFormChange('phone')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Email" type="email" value={newClientForm.email} onChange={handleFormChange('email')} />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={() => setCurrentTab(0)} disabled={isCreating}>
                      Annuler
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                      onClick={handleCreateClient}
                      disabled={isCreating}
                    >
                      Créer le Client
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {openEditDialog && (
        <Box
          sx={{
            position: 'fixed', inset: 0, zIndex: 1300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setOpenEditDialog(false)}
        >
          <Card
            sx={{ width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', m: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Box sx={{ p: 3, borderBottom: '1px solid #e8ecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Modifier le Client</Typography>
              <IconButton onClick={() => setOpenEditDialog(false)}><CloseIcon /></IconButton>
            </Box>
            <CardContent>
              {editNotif && (
                <Alert severity={editNotif.sev} onClose={() => setEditNotif(null)} sx={{ mb: 2 }}>
                  {editNotif.msg}
                </Alert>
              )}
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Raison Sociale *" value={editForm.companyName} onChange={handleEditFormChange('companyName')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="RCCM" value={editForm.rccm} onChange={handleEditFormChange('rccm')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="NINEA" value={editForm.ninea} onChange={handleEditFormChange('ninea')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Forme Juridique</InputLabel>
                    <Select label="Forme Juridique" value={editForm.legalForm} onChange={handleEditFormChange('legalForm') as any}>
                      <MenuItem value="SARL">SARL</MenuItem>
                      <MenuItem value="SA">SA</MenuItem>
                      <MenuItem value="GIE">GIE</MenuItem>
                      <MenuItem value="SNC">SNC</MenuItem>
                      <MenuItem value="EI">EI</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Secteur d'Activité</InputLabel>
                    <Select label="Secteur d'Activité" value={editForm.sector} onChange={handleEditFormChange('sector') as any}>
                      {industries.map((ind) => <MenuItem key={ind} value={ind}>{ind}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agence</InputLabel>
                    <Select label="Agence" value={editForm.branch} onChange={handleEditFormChange('branch') as any}>
                      {['Dakar Centre', 'Dakar Plateau', 'Thiès', 'Kaolack', 'Saint-Louis', 'Ziguinchor'].map((b) => (
                        <MenuItem key={b} value={b}>{b}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Personne de Contact" value={editForm.contactPerson} onChange={handleEditFormChange('contactPerson')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Siège Social" value={editForm.headquarters} onChange={handleEditFormChange('headquarters')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Téléphone" value={editForm.phone} onChange={handleEditFormChange('phone')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Email" type="email" value={editForm.email} onChange={handleEditFormChange('email')} />
                </Grid>
              </Grid>
            </CardContent>
            <Box sx={{ p: 2, borderTop: '1px solid #e8ecf0', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => setOpenEditDialog(false)} disabled={isEditSaving}>Annuler</Button>
              <Button
                variant="contained"
                onClick={handleSaveEdit}
                disabled={isEditSaving}
                startIcon={isEditSaving ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
              >
                Enregistrer
              </Button>
            </Box>
          </Card>
        </Box>
      )}

      {/* Drawer fiche client */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ zIndex: 1250 }}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 820 }, bgcolor: '#fafafa' } }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              px: 3, py: 2.5, bgcolor: '#1f4e79', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {drawerClient && (
                <Avatar
                  sx={{
                    bgcolor: stringToColor(drawerClient.companyName),
                    width: 48, height: 48, fontSize: '18px', fontWeight: 700,
                    border: '2px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {initials(drawerClient.companyName)}
                </Avatar>
              )}
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>
                  {drawerClient?.companyName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                  {drawerClient?.accountNumber && (
                    <Typography
                      sx={{
                        fontSize: '11px', fontFamily: 'monospace', fontWeight: 600,
                        bgcolor: 'rgba(255,255,255,0.15)', px: 1, py: 0.2,
                        borderRadius: 0.8, letterSpacing: '0.3px',
                      }}
                    >
                      {drawerClient.accountNumber}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '12px', opacity: 0.75 }}>
                    {drawerClient?.legalForm || ''}
                  </Typography>
                  {drawerClient?.isActive !== undefined && (
                    <Chip
                      label={drawerClient.isActive ? 'Actif' : 'Inactif'}
                      size="small"
                      sx={{
                        height: 18, fontSize: '10px',
                        bgcolor: drawerClient.isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)',
                        color: '#fff', border: 'none',
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
            <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: '1px solid #e8ecf0', bgcolor: '#fff' }}>
            <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)} variant="fullWidth">
              <Tab label="Identité" sx={{ fontSize: '13px' }} />
              <Tab label="Dossiers" sx={{ fontSize: '13px' }} />
              <Tab label="Échéancier" sx={{ fontSize: '13px' }} />
            </Tabs>
          </Box>

          {drawerLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

              {/* Onglet Identité */}
              {drawerTab === 0 && drawerClient && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {[
                      { label: 'Total dossiers', value: (drawerClient.applications?.length ?? drawerClient.appCount ?? 0).toString() },
                      { label: 'Exposition totale', value: fmtXOF(drawerClient.totalExposure ?? 0) },
                      { label: 'Relation depuis', value: relationDuration(drawerClient.createdAt) },
                    ].map((kpi) => (
                      <Grid item xs={4} key={kpi.label}>
                        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#1f4e79' }}>
                            {kpi.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {kpi.label}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                    <Grid container spacing={2}>
                      {[
                        { label: 'N° de Compte', value: drawerClient.accountNumber },
                        { label: 'RCCM', value: drawerClient.rccm },
                        { label: 'NINEA', value: drawerClient.ninea },
                        { label: 'Forme Juridique', value: drawerClient.legalForm },
                        { label: 'Secteur', value: drawerClient.sector },
                        { label: 'Siège Social', value: drawerClient.headquarters },
                        { label: 'Personne de Contact', value: drawerClient.contactPerson },
                        { label: 'Téléphone', value: drawerClient.phone },
                        { label: 'Email', value: drawerClient.email },
                        { label: 'Année de création', value: drawerClient.establishedYear?.toString() },
                        { label: 'Agence', value: drawerClient.branch },
                        { label: 'Chargé d\'affaires', value: drawerClient.creator?.name },
                      ].map((item) => (
                        <Grid item xs={12} sm={6} key={item.label}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.2 }}>
                            {item.label}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '13.5px', fontWeight: 500, color: '#111827',
                              fontFamily: item.label === 'N° de Compte' ? 'monospace' : 'inherit',
                            }}
                          >
                            {item.value || '—'}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Box>
              )}

              {/* Onglet Dossiers */}
              {drawerTab === 1 && (
                <Box>
                  {!drawerClient?.applications || drawerClient.applications.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Ce client n'a aucun dossier de crédit.
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {drawerClient.applications.map((app) => {
                        const cfg = APP_STATUS_CONFIG[app.status] ?? { label: app.status, color: '#6b7280', bg: '#f3f4f6' };
                        return (
                          <Paper
                            key={app.id}
                            sx={{
                              p: 2, borderRadius: 2, border: '1px solid #e8ecf0',
                              boxShadow: 'none', transition: 'box-shadow 0.15s',
                              '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Typography sx={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#1f4e79' }}>
                                  {app.applicationNumber || app.id.slice(0, 8).toUpperCase()}
                                </Typography>
                                <Chip
                                  label={cfg.label}
                                  size="small"
                                  sx={{ fontSize: '11px', height: 22, fontWeight: 600, bgcolor: cfg.bg, color: cfg.color, border: 'none' }}
                                />
                              </Box>
                              <Tooltip title="Voir le détail du dossier">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDossier(app)}
                                  sx={{
                                    bgcolor: '#eff6ff', color: '#1d4ed8',
                                    '&:hover': { bgcolor: '#dbeafe' },
                                  }}
                                >
                                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            <Grid container spacing={1.5}>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">Type de crédit</Typography>
                                <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                  {app.creditType?.name || '—'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">Montant</Typography>
                                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1f4e79' }}>
                                  {fmtXOF(app.amount, app.currency)}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">Date soumission</Typography>
                                <Typography sx={{ fontSize: '13px' }}>
                                  {new Date(app.createdAt).toLocaleDateString('fr-FR')}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">Objet</Typography>
                                <Typography sx={{ fontSize: '13px' }} noWrap title={app.purpose}>
                                  {app.purpose || '—'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}

              {/* Onglet Échéancier */}
              {drawerTab === 2 && (
                <Box>
                  {disbursableApps.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Aucun dossier approuvé ou décaissé disponible pour cet échéancier.
                    </Alert>
                  ) : (
                    <>
                      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                        <InputLabel>Sélectionner un dossier</InputLabel>
                        <Select
                          label="Sélectionner un dossier"
                          value={selectedAppId}
                          onChange={(e) => setSelectedAppId(e.target.value)}
                        >
                          {disbursableApps.map((a) => (
                            <MenuItem key={a.id} value={a.id}>
                              {a.applicationNumber || a.id.slice(0, 8).toUpperCase()} — {fmtXOF(a.amount, a.currency)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {amortApp && (() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        // Trouver la période courante : la première dont la date d'échéance >= aujourd'hui
                        const currentPeriod = amortRows.find((r) => {
                          const d = new Date(r.dueDate);
                          d.setHours(0, 0, 0, 0);
                          return d >= today;
                        })?.n ?? amortRows[amortRows.length - 1]?.n;

                        const entryMap = new Map<number, RepaymentEntry>(
                          repaymentEntries.map((e) => [e.periodNumber, e])
                        );

                        // Calculer le statut effectif de chaque ligne
                        const getEffectiveStatus = (row: AmortizationRow): RepaymentStatus => {
                          const entry = entryMap.get(row.n);
                          if (entry) return entry.status;
                          const d = new Date(row.dueDate); d.setHours(0, 0, 0, 0);
                          return d < today ? 'LATE' : 'PENDING';
                        };

                        const paidCount   = amortRows.filter((r) => entryMap.get(r.n)?.status === 'PAID').length;
                        const lateCount   = amortRows.filter((r) => getEffectiveStatus(r) === 'LATE').length;
                        const partialCount = amortRows.filter((r) => entryMap.get(r.n)?.status === 'PARTIAL').length;

                        return (
                          <>
                            {/* KPIs remboursement */}
                            <Grid container spacing={1.5} sx={{ mb: 2 }}>
                              {[
                                { label: 'Réglées', value: paidCount, color: '#15803d', bg: '#f0fdf4' },
                                { label: 'Impayées', value: lateCount, color: '#dc2626', bg: '#fef2f2' },
                                { label: 'Partielles', value: partialCount, color: '#b45309', bg: '#fffbeb' },
                                { label: 'Restantes', value: amortRows.length - paidCount - lateCount - partialCount, color: '#6b7280', bg: '#f9fafb' },
                              ].map((k) => (
                                <Grid item xs={3} key={k.label}>
                                  <Paper sx={{ p: 1.5, textAlign: 'center', borderRadius: 2, border: `1px solid ${k.bg === '#f0fdf4' ? '#bbf7d0' : k.bg === '#fef2f2' ? '#fecaca' : k.bg === '#fffbeb' ? '#fde68a' : '#e5e7eb'}`, bgcolor: k.bg, boxShadow: 'none' }}>
                                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</Typography>
                                    <Typography variant="caption" sx={{ color: k.color, opacity: 0.8 }}>{k.label}</Typography>
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>

                            {/* Résumé dossier */}
                            <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                              <Grid container spacing={2}>
                                {[
                                  { label: 'Capital', value: fmtXOF(amortApp.amount, amortApp.currency) },
                                  { label: 'Durée', value: `${amortApp.durationMonths} mois` },
                                  { label: 'Taux', value: `${amortApp.proposedRate}%` },
                                  { label: 'Fréquence', value: ({ MONTHLY: 'Mensuelle', QUARTERLY: 'Trimestrielle', SEMIANNUAL: 'Semestrielle', ANNUAL: 'Annuelle' } as Record<string, string>)[amortApp.repaymentSchedule] || amortApp.repaymentSchedule },
                                ].map((item) => (
                                  <Grid item xs={3} key={item.label} sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1f4e79' }}>{item.value}</Typography>
                                  </Grid>
                                ))}
                              </Grid>
                            </Paper>

                            {repaymentLoading ? (
                              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                            ) : (
                              <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                      {['N°', 'Date échéance', 'Mensualité', 'Capital', 'Intérêts', 'Capital restant', 'Statut', ''].map((col) => (
                                        <TableCell key={col} sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', py: 1, letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                                          {col}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {amortRows.map((row) => {
                                      const entry = entryMap.get(row.n);
                                      const effStatus = getEffectiveStatus(row);
                                      const cfg = REPAYMENT_CFG[effStatus];
                                      const isCurrent = row.n === currentPeriod;
                                      const isPaid = effStatus === 'PAID';

                                      const rowBg = isCurrent
                                        ? 'rgba(29,78,220,0.06)'
                                        : effStatus === 'PAID'    ? 'rgba(21,128,61,0.04)'
                                        : effStatus === 'LATE'    ? 'rgba(220,38,38,0.04)'
                                        : effStatus === 'PARTIAL' ? 'rgba(180,83,9,0.04)'
                                        : 'transparent';

                                      return (
                                        <TableRow
                                          key={row.n}
                                          sx={{
                                            bgcolor: rowBg,
                                            borderLeft: isCurrent ? '3px solid #1d4ed8' : '3px solid transparent',
                                            '&:hover': { bgcolor: isCurrent ? 'rgba(29,78,220,0.10)' : 'rgba(0,0,0,0.03)' },
                                            transition: 'background 0.15s',
                                          }}
                                        >
                                          <TableCell sx={{ py: 1, fontSize: '12px', color: isCurrent ? '#1d4ed8' : '#6b7280', fontWeight: isCurrent ? 700 : 400 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                              {isCurrent && <TodayIcon sx={{ fontSize: 12, color: '#1d4ed8' }} />}
                                              {row.n}
                                            </Box>
                                          </TableCell>
                                          <TableCell sx={{ py: 1, fontSize: '12px', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#1d4ed8' : 'inherit' }}>
                                            {row.date}
                                          </TableCell>
                                          <TableCell sx={{ py: 1, fontSize: '12px', fontWeight: 600, textDecoration: isPaid ? 'line-through' : 'none', color: isPaid ? '#9ca3af' : 'inherit' }}>
                                            {new Intl.NumberFormat('fr-FR').format(Math.round(row.payment))}
                                          </TableCell>
                                          <TableCell sx={{ py: 1, fontSize: '12px', textDecoration: isPaid ? 'line-through' : 'none', color: isPaid ? '#9ca3af' : 'inherit' }}>
                                            {new Intl.NumberFormat('fr-FR').format(Math.round(row.principal))}
                                          </TableCell>
                                          <TableCell sx={{ py: 1, fontSize: '12px', color: isPaid ? '#9ca3af' : '#d97706', textDecoration: isPaid ? 'line-through' : 'none' }}>
                                            {new Intl.NumberFormat('fr-FR').format(Math.round(row.interest))}
                                          </TableCell>
                                          <TableCell sx={{ py: 1, fontSize: '12px', color: '#6b7280' }}>
                                            {new Intl.NumberFormat('fr-FR').format(Math.round(row.remaining))}
                                          </TableCell>
                                          <TableCell sx={{ py: 1 }}>
                                            <Tooltip title={entry?.verifiedBy ? `Vérifié par ${entry.verifiedBy.name}${entry.notes ? ` — ${entry.notes}` : ''}` : ''}>
                                              <Chip
                                                icon={cfg.icon as any}
                                                label={cfg.label}
                                                size="small"
                                                sx={{ fontSize: '10px', height: 22, fontWeight: 600, bgcolor: cfg.bg, color: cfg.color, border: 'none', '& .MuiChip-icon': { ml: '4px' } }}
                                              />
                                            </Tooltip>
                                          </TableCell>
                                          <TableCell sx={{ py: 1, pr: 1 }}>
                                            <Tooltip title="Vérifier sur SIB et mettre à jour le statut">
                                              <IconButton
                                                size="small"
                                                onClick={() => setSibDialog({
                                                  open: true,
                                                  row,
                                                  status: effStatus === 'PAID' ? 'PAID' : 'PAID',
                                                  paidAmount: String(Math.round(row.payment)),
                                                  notes: entry?.notes || '',
                                                  saving: false,
                                                })}
                                                sx={{
                                                  bgcolor: '#eff6ff', color: '#1d4ed8', p: 0.5,
                                                  '&:hover': { bgcolor: '#dbeafe' },
                                                }}
                                              >
                                                <SibIcon sx={{ fontSize: 15 }} />
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: '#f0fdf4' }}>
                                      <TableCell colSpan={2} sx={{ py: 1, fontSize: '12px', fontWeight: 700, color: '#15803d' }}>Total</TableCell>
                                      <TableCell sx={{ py: 1, fontSize: '12px', fontWeight: 700, color: '#15803d' }}>{new Intl.NumberFormat('fr-FR').format(Math.round(totalPayment))}</TableCell>
                                      <TableCell sx={{ py: 1, fontSize: '12px', fontWeight: 700, color: '#15803d' }}>{new Intl.NumberFormat('fr-FR').format(Math.round(totalPrincipal))}</TableCell>
                                      <TableCell sx={{ py: 1, fontSize: '12px', fontWeight: 700, color: '#d97706' }}>{new Intl.NumberFormat('fr-FR').format(Math.round(totalInterest))}</TableCell>
                                      <TableCell colSpan={3} />
                                    </TableRow>
                                  </TableHead>
                                </Table>
                              </TableContainer>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Dialog vérification SIB */}
      <Dialog open={sibDialog.open} onClose={() => !sibDialog.saving && setSibDialog((p) => ({ ...p, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <SibIcon sx={{ color: '#1d4ed8' }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>Vérification SIB</Typography>
            <Typography variant="caption" color="text.secondary">
              Période {sibDialog.row?.n} — échéance du {sibDialog.row?.date}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: '12px' }}>
            Après vérification dans le Système d'Information Bancaire, enregistrez le statut du remboursement.
          </Alert>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Montant attendu
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#1f4e79', mb: 2 }}>
            {sibDialog.row ? new Intl.NumberFormat('fr-FR').format(Math.round(sibDialog.row.payment)) + ' XOF' : ''}
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Statut constaté</InputLabel>
            <Select
              label="Statut constaté"
              value={sibDialog.status}
              onChange={(e) => setSibDialog((p) => ({ ...p, status: e.target.value as RepaymentStatus }))}
            >
              <MenuItem value="PAID">Réglé intégralement</MenuItem>
              <MenuItem value="PARTIAL">Paiement partiel</MenuItem>
              <MenuItem value="LATE">Impayé</MenuItem>
              <MenuItem value="PENDING">En attente (annuler la vérification)</MenuItem>
            </Select>
          </FormControl>

          {sibDialog.status === 'PARTIAL' && (
            <TextField
              fullWidth
              size="small"
              label="Montant effectivement réglé (XOF)"
              type="number"
              value={sibDialog.paidAmount}
              onChange={(e) => setSibDialog((p) => ({ ...p, paidAmount: e.target.value }))}
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            fullWidth
            size="small"
            label="Note / référence SIB (optionnel)"
            placeholder="Ex: Virement reçu le 05/05 — réf. TRF-2026-4412"
            value={sibDialog.notes}
            onChange={(e) => setSibDialog((p) => ({ ...p, notes: e.target.value }))}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSibDialog((p) => ({ ...p, open: false }))} disabled={sibDialog.saving}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSibVerify}
            disabled={sibDialog.saving || (sibDialog.status === 'PARTIAL' && !sibDialog.paidAmount)}
            startIcon={sibDialog.saving ? <CircularProgress size={14} color="inherit" /> : <SibIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* DossierActionDrawer — ouvert depuis la fiche client, lecture seule */}
      <DossierActionDrawer
        item={dossierItem}
        open={dossierDrawerOpen}
        readOnly
        zIndex={1300}
        onClose={() => setDossierDrawerOpen(false)}
        onSuccess={() => setDossierDrawerOpen(false)}
      />
    </Box>
  );
};

export default ClientManagementPage;
