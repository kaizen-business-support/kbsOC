import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Avatar,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Checkbox,
  FormGroup,
  TablePagination,
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  Badge as BadgeIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Domain as DepartmentIcon,
  Security as RoleIcon,
  SecuritySharp as SecurityIcon,
  LocationOn as BranchIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Shield as ShieldIcon,
  History as HistoryIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import api, { ApiService, authPasswordApi } from '../services/api';
import { DialogHeader } from '../components/ui/DialogHeader';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import DelegationBadge from '../components/DelegationBadge';
import DelegationForm from '../components/DelegationForm';
import { PowerDelegation, DelegatableAction, DELEGATION_ACTION_LABELS } from '../types/delegation';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import { BulkUserImportDialog } from '../components/BulkUserImportDialog';
import FileUploadIcon from '@mui/icons-material/FileUpload';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  jobTitle?: string;
  branch?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  permissions: string[];
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
}

interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  userCount?: number;
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
  description?: string;
  permissions: string[];
  userCount?: number;
  isActive: boolean;
  createdAt: string;
  twoFactorRequired?: boolean;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  country?: string;
  manager?: string;
  userCount?: number;
  isActive: boolean;
  createdAt: string;
}

interface UserManagementPageProps {
  onNavigate: (page: any) => void;
}

const PERMISSION_GROUPS = [
  {
    category: 'Administration système',
    permissions: [
      { key: 'user_management', label: 'Gestion des utilisateurs' },
      { key: 'role_assignment', label: 'Attribution des rôles' },
      { key: 'system_administration', label: 'Administration système' },
      { key: 'system_configuration', label: 'Configuration système' },
      { key: 'audit_logs', label: 'Journaux d\'audit' },
      { key: 'data_export', label: 'Export des données' },
    ],
  },
  {
    category: 'Notifications & Annonces',
    permissions: [
      { key: 'manage_notifications', label: 'Gérer les notifications' },
      { key: 'manage_announcements', label: 'Gérer les annonces' },
    ],
  },
  {
    category: 'Sauvegarde & Sécurité',
    permissions: [
      { key: 'manage_backup', label: 'Gérer les sauvegardes' },
      { key: 'manage_2fa_config', label: 'Configurer la 2FA' },
    ],
  },
  {
    category: 'Visibilité des données',
    permissions: [
      { key: 'view_all', label: 'Voir toutes les données' },
      { key: 'view_branch', label: 'Voir les données d\'agence' },
      { key: 'view_own', label: 'Voir ses propres données' },
      { key: 'view_applications', label: 'Voir les demandes' },
      { key: 'view_portfolio', label: 'Voir le portefeuille' },
    ],
  },
  {
    category: 'Analytiques & Rapports',
    permissions: [
      { key: 'analytics', label: 'Accès aux analytiques' },
      { key: 'reports', label: 'Rapports' },
      { key: 'portfolio_analytics', label: 'Analytiques du portefeuille' },
      { key: 'risk_reporting', label: 'Rapports de risque' },
      { key: 'policy_configuration', label: 'Configuration des politiques' },
    ],
  },
  {
    category: 'Clients & Dossiers',
    permissions: [
      { key: 'create_client', label: 'Créer des clients' },
      { key: 'edit_client_data', label: 'Modifier les données clients' },
      { key: 'manage_clients', label: 'Gérer les clients' },
    ],
  },
  {
    category: 'Demandes de crédit',
    permissions: [
      { key: 'create_application', label: 'Créer des demandes' },
      { key: 'review_applications', label: 'Examiner les demandes' },
      { key: 'application_review', label: 'Revue des demandes' },
      { key: 'analyze_credit', label: 'Analyser le crédit' },
      { key: 'financial_analysis', label: 'Analyse financière' },
      { key: 'score_applications', label: 'Scorer les demandes' },
      { key: 'benchmark_analysis', label: 'Analyse benchmark' },
      { key: 'edit_analysis', label: 'Modifier l\'analyse' },
    ],
  },
  {
    category: 'Approbations',
    permissions: [
      { key: 'approve_credit', label: 'Approuver les crédits' },
      { key: 'approve_applications', label: 'Approuver les demandes' },
      { key: 'committee_review', label: 'Revue comité' },
      { key: 'committee_vote', label: 'Vote en comité' },
      { key: 'final_approval', label: 'Approbation finale' },
      { key: 'risk_override', label: 'Dérogation risque' },
      { key: 'policy_exceptions', label: 'Exceptions de politique' },
    ],
  },
  {
    category: 'Gestion d\'agence & équipe',
    permissions: [
      { key: 'manage_branch', label: 'Gérer l\'agence' },
      { key: 'manage_team', label: 'Gérer l\'équipe' },
      { key: 'workflow_override', label: 'Dérogation workflow' },
    ],
  },
  {
    category: 'Dispatching & Affectation',
    permissions: [
      { key: 'assign_analyst', label: 'Affecter un analyste' },
      { key: 'dispatch_applications', label: 'Dispatcher les demandes' },
      { key: 'view_analyst_workload', label: 'Voir la charge des analystes' },
    ],
  },
];

const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ onNavigate }) => {
  const { hasPermission, isRole } = useUser();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Délégations state ────────────────────────────────────────────────────
  const [delegations, setDelegations] = useState<PowerDelegation[]>([]);
  const [delegationsLoading, setDelegationsLoading] = useState(false);
  const [delegationFormOpen, setDelegationFormOpen] = useState(false);
  const [selectedDelegatorId, setSelectedDelegatorId] = useState('');

  // Inline editing — Departments
  const [deptEditingId, setDeptEditingId] = useState<string | null>(null);
  const [deptEditData, setDeptEditData] = useState({ name: '', code: '', description: '' });
  const [deptSaving, setDeptSaving] = useState(false);

  // Inline editing — Branches
  const [branchEditingId, setBranchEditingId] = useState<string | null>(null);
  const [branchEditData, setBranchEditData] = useState({ name: '', code: '', city: '', manager: '' });
  const [branchSaving, setBranchSaving] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogError, setRoleDialogError] = useState<string | null>(null);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    searchTerm: '',
    department: '',
    role: '',
    status: 'all', // 'all', 'active', 'inactive'
    branch: '',
  });

  // Form state
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    jobTitle: '',
    branch: '',
    isActive: true
  });

  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true
  });

  const [roleForm, setRoleForm] = useState({
    name: '',
    label: '',
    description: '',
    permissions: [] as string[],
    isActive: true
  });

  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: '',
    manager: '',
    isActive: true
  });

  // Password management state
  const [temporaryPasswordDialog, setTemporaryPasswordDialog] = useState({
    open: false,
    password: '',
    userName: ''
  });

  const [changePasswordDialog, setChangePasswordDialog] = useState({
    open: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Mock departments - in real app this would come from API
  const getAvailableDepartments = () => {
    return departments.filter(dept => dept.isActive).map(dept => dept.name);
  };

  const availableRoles = [
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'MANAGEMENT', label: 'Direction Générale' },
    { value: 'BRANCH_MANAGER', label: 'Directeur d\'Agence' },
    { value: 'ACCOUNT_MANAGER', label: 'Chargé d\'Affaires' },
    { value: 'CREDIT_ANALYST', label: 'Analyste Crédit' },
    { value: 'CREDIT_COMMITTEE', label: 'Comité de Crédit' }
  ];

  // 2FA management state
  const [saving2FA, setSaving2FA] = useState<string | null>(null);

  const ROLE_2FA_LABELS: Record<string, string> = {
    ADMIN:            'Administrateur',
    MANAGEMENT:       'Directeur Général',
    BRANCH_MANAGER:   "Directeur d'Agence",
    ACCOUNT_MANAGER:  "Chargé d'Affaires",
    CREDIT_ANALYST:   'Analyste Crédit',
    CREDIT_COMMITTEE: 'Comité de Crédit',
  };

  const handleRoleToggle2FA = async (roleName: string, required: boolean) => {
    setSaving2FA(`role-${roleName}`);
    try {
      await authPasswordApi.setRole2FARequired(roleName, required);
      setRoles(prev => prev.map(r => r.name === roleName ? { ...r, twoFactorRequired: required } : r));
      setNotification({ open: true, message: `2FA ${required ? 'activé' : 'désactivé'} pour le rôle ${ROLE_2FA_LABELS[roleName] || roleName}`, severity: 'success' });
    } catch {
      setNotification({ open: true, message: 'Erreur lors de la modification du paramètre 2FA.', severity: 'error' });
    } finally {
      setSaving2FA(null);
    }
  };

  const handleUserToggle2FA = async (userId: string, required: boolean) => {
    setSaving2FA(`user-${userId}`);
    try {
      await authPasswordApi.setUser2FARequired(userId, required);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, twoFactorRequired: required } : u));
    } catch {
      setNotification({ open: true, message: 'Erreur lors de la modification du paramètre 2FA utilisateur.', severity: 'error' });
    } finally {
      setSaving2FA(null);
    }
  };

  // ── Audit Log state ─────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]         = useState<any[]>([]);
  const [auditLoading, setAuditLoading]   = useState(false);
  const [auditError, setAuditError]       = useState('');
  const [auditPage, setAuditPage]         = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotal, setAuditTotal]       = useState(0);
  const [auditUsers, setAuditUsers]       = useState<any[]>([]);
  const [auditActions, setAuditActions]   = useState<string[]>([]);
  const [auditFilters, setAuditFilters]   = useState({
    userId: '', action: '', entityType: '', dateFrom: '', dateTo: '',
  });

  const ROLE_LABEL_MAP: Record<string, string> = {
    ADMIN: 'Administrateur', MANAGEMENT: 'Directeur Général',
    BRANCH_MANAGER: "Dir. d'Agence", ACCOUNT_MANAGER: "Chargé d'Affaires",
    CREDIT_ANALYST: 'Analyste Crédit', ANALYST_SUPERVISOR: 'Superviseur Analyste',
    CREDIT_COMMITTEE: 'Comité de Crédit',
  };

  const formatAuditDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const ACTION_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
    CREATE: 'success', UPDATE: 'warning', DELETE: 'error',
    LOGIN: 'success', LOGOUT: 'default',
    APPROVE: 'success', REJECT: 'error',
    ASSIGN: 'warning', REASSIGN: 'warning', START_STEP: 'default',
    CHANGE_PASSWORD: 'warning', RESET_PASSWORD: 'warning', REQUEST_PASSWORD_RESET: 'default',
    SETUP: 'success', DISABLE: 'error', VERIFY: 'default',
    RESTORE: 'warning', ARCHIVE: 'default', ACTIVATE: 'success', DEACTIVATE: 'error',
  };
  const getActionColor = (action: string): 'error' | 'warning' | 'success' | 'default' => {
    const verb = action.split('_')[0];
    return ACTION_COLOR[verb] ?? 'default';
  };

  const ACTION_LABEL: Record<string, string> = {
    // Authentification
    LOGIN_USER:                    'Connexion',
    LOGOUT_USER:                   'Déconnexion',
    CHANGE_PASSWORD_USER:          'Changement de mot de passe',
    CHANGE_PASSWORD_AUTH:          'Changement de mot de passe',
    RESET_PASSWORD_USER:           'Réinitialisation du mot de passe',
    RESET_PASSWORD_AUTH:           'Réinitialisation du mot de passe',
    REQUEST_PASSWORD_RESET_AUTH:   'Demande de réinitialisation de mot de passe',
    SETUP_TWO_FACTOR:              'Activation de la double authentification',
    DISABLE_TWO_FACTOR:            'Désactivation de la double authentification',
    VERIFY_TWO_FACTOR:             'Vérification de la double authentification',
    VERIFY_SETUP_TWO_FACTOR:       'Confirmation de la configuration 2FA',
    REGENERATE_BACKUP_CODES_TWO_FACTOR: 'Regénération des codes de secours 2FA',
    // Utilisateurs
    CREATE_USER:                   'Création d\'un utilisateur',
    UPDATE_USER:                   'Modification d\'un utilisateur',
    DELETE_USER:                   'Suppression d\'un utilisateur',
    // Clients
    CREATE_CLIENT:                 'Création d\'un client',
    UPDATE_CLIENT:                 'Modification d\'un client',
    DELETE_CLIENT:                 'Suppression d\'un client',
    // Demandes de crédit
    CREATE_APPLICATION:            'Nouvelle demande de crédit',
    UPDATE_APPLICATION:            'Modification d\'une demande de crédit',
    DELETE_APPLICATION:            'Suppression d\'une demande de crédit',
    // Circuit de traitement
    APPROVE_WORKFLOW:              'Approbation d\'un dossier',
    REJECT_WORKFLOW:               'Rejet d\'un dossier',
    START_STEP_WORKFLOW:           'Prise en charge d\'une étape',
    CREATE_WORKFLOW:               'Création d\'une étape de circuit',
    UPDATE_WORKFLOW:               'Mise à jour d\'une étape de circuit',
    // Dispatching
    ASSIGN_APPLICATION:            'Affectation d\'un dossier à un analyste',
    REASSIGN_APPLICATION:          'Réaffectation d\'un dossier',
    // Politique de crédit
    CREATE_CREDIT_POLICY:          'Création d\'une politique de crédit',
    UPDATE_CREDIT_POLICY:          'Modification d\'une politique de crédit',
    DELETE_CREDIT_POLICY:          'Suppression d\'une politique de crédit',
    // Limites d'approbation
    CREATE_APPROVAL_LIMIT:         'Ajout d\'une limite d\'approbation',
    UPDATE_APPROVAL_LIMIT:         'Modification d\'une limite d\'approbation',
    DELETE_APPROVAL_LIMIT:         'Suppression d\'une limite d\'approbation',
    // Types de crédit
    CREATE_CREDIT_TYPE:            'Création d\'un type de crédit',
    UPDATE_CREDIT_TYPE:            'Modification d\'un type de crédit',
    DELETE_CREDIT_TYPE:            'Suppression d\'un type de crédit',
    // Documents
    CREATE_DOCUMENT:               'Ajout d\'un document',
    UPDATE_DOCUMENT:               'Modification d\'un document',
    DELETE_DOCUMENT:               'Suppression d\'un document',
    // Configuration
    CREATE_WORKFLOW_CONFIG:        'Configuration du circuit de traitement',
    UPDATE_WORKFLOW_CONFIG:        'Modification du circuit de traitement',
    CREATE_ROLE:                   'Création d\'un rôle',
    UPDATE_ROLE:                   'Modification d\'un rôle',
    CREATE_DEPARTMENT:             'Création d\'un département',
    UPDATE_DEPARTMENT:             'Modification d\'un département',
    DELETE_DEPARTMENT:             'Suppression d\'un département',
    CREATE_BRANCH:                 'Création d\'une agence',
    UPDATE_BRANCH:                 'Modification d\'une agence',
    DELETE_BRANCH:                 'Suppression d\'une agence',
    CREATE_BANK_HOLIDAY:           'Ajout d\'un jour férié',
    UPDATE_BANK_HOLIDAY:           'Modification d\'un jour férié',
    DELETE_BANK_HOLIDAY:           'Suppression d\'un jour férié',
    // Annonces
    CREATE_ANNOUNCEMENT:           'Publication d\'une annonce',
    UPDATE_ANNOUNCEMENT:           'Modification d\'une annonce',
    DELETE_ANNOUNCEMENT:           'Suppression d\'une annonce',
    // Notifications
    CREATE_NOTIFICATION_CHANNEL:   'Ajout d\'un canal de notification',
    UPDATE_NOTIFICATION_CHANNEL:   'Modification d\'un canal de notification',
    DELETE_NOTIFICATION_CHANNEL:   'Suppression d\'un canal de notification',
    CREATE_NOTIFICATION_TEMPLATE:  'Création d\'un modèle de notification',
    UPDATE_NOTIFICATION_TEMPLATE:  'Modification d\'un modèle de notification',
    DELETE_NOTIFICATION_TEMPLATE:  'Suppression d\'un modèle de notification',
    CREATE_NOTIFICATION_RULE:      'Création d\'une règle de notification',
    UPDATE_NOTIFICATION_RULE:      'Modification d\'une règle de notification',
    DELETE_NOTIFICATION_RULE:      'Suppression d\'une règle de notification',
    // Sauvegarde
    CREATE_BACKUP:                 'Sauvegarde de la base de données',
    RESTORE_BACKUP:                'Restauration de la base de données',
  };

  const formatAction = (action: string): string => ACTION_LABEL[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

  const ENTITY_LABEL: Record<string, string> = {
    client:                 'Client',
    application:            'Demande de crédit',
    workflow:               'Dossier / Circuit',
    workflow_config:        'Configuration du circuit',
    user:                   'Utilisateur',
    role:                   'Rôle',
    department:             'Département',
    branch:                 'Agence',
    approval_limit:         'Limite d\'approbation',
    credit_type:            'Type de crédit',
    credit_policy:          'Politique de crédit',
    backup:                 'Sauvegarde',
    announcement:           'Annonce',
    notification_channel:   'Canal de notification',
    notification_template:  'Modèle de notification',
    notification_rule:      'Règle de notification',
    notification:           'Notification',
    document:               'Document',
    two_factor:             'Double authentification',
    session:                'Session',
    bank_holiday:           'Jour férié',
    auth:                   'Authentification',
  };

  const formatEntityType = (entityType: string): string => ENTITY_LABEL[entityType] ?? entityType;

  const formatNewValues = (action: string, newValues: any): string | null => {
    if (!newValues || typeof newValues !== 'object') return null;
    const v = newValues as Record<string, any>;

    // Décision d'approbation/rejet
    if (v.decision) {
      const decision = v.decision === 'APPROVED' ? 'Approuvé' : v.decision === 'REJECTED' ? 'Rejeté' : v.decision;
      return v.comments ? `${decision} — "${v.comments}"` : decision;
    }

    // Affectation analyste
    if (v.analystId !== undefined) {
      const verb = v.isReassign ? 'Réaffecté' : 'Affecté';
      const target = v.analystId ? `à l'analyste ${String(v.analystId).slice(0, 8)}…` : '';
      const dossier = v.applicationId ? ` (dossier ${String(v.applicationId).slice(0, 8)}…)` : '';
      return `${verb} ${target}${dossier}`.trim();
    }

    // 2FA
    if (v.userId) return `Utilisateur concerné : ${String(v.userId).slice(0, 8)}…`;

    // Fallback générique lisible
    return Object.entries(v)
      .map(([k, val]) => {
        const display = val === true ? 'Oui' : val === false ? 'Non' : String(val);
        return display;
      })
      .join(' · ');
  };

  const fetchAuditLogs = useCallback(async (page = auditPage, rowsPerPage = auditRowsPerPage, filters = auditFilters) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const params: any = { page: page + 1, limit: rowsPerPage };
      if (filters.userId)     params.userId     = filters.userId;
      if (filters.action)     params.action     = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.dateFrom)   params.dateFrom   = filters.dateFrom;
      if (filters.dateTo)     params.dateTo     = filters.dateTo;
      const res = await api.get('/audit-logs', { params });
      setAuditLogs(res.data.logs || []);
      setAuditTotal(res.data.pagination?.total || 0);
    } catch {
      setAuditError("Impossible de charger le journal d'activité.");
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditRowsPerPage, auditFilters]);

  const handleAuditSearch = () => { setAuditPage(0); fetchAuditLogs(0, auditRowsPerPage, auditFilters); };
  const handleAuditFilterChange = (field: string, value: string) => setAuditFilters(prev => ({ ...prev, [field]: value }));

  // Check if user has access to user management
  const canViewUserManagement = isRole('admin') || isRole('management');
  const canEditUserManagement = isRole('admin');

  useEffect(() => {
    if (!canViewUserManagement) {
      setNotification({
        open: true,
        message: 'Accès non autorisé. Seuls les administrateurs et la direction générale peuvent accéder à cette page.',
        severity: 'error'
      });
      return;
    }
    loadUsers();
    loadDepartments();
    loadRoles();
    loadBranches();
    loadDelegations();
  }, [canViewUserManagement]);

  // Reload data when users change to update counts
  useEffect(() => {
    if (users.length > 0) {
      loadRoles();
      loadDepartments();
      loadBranches();
    }
  }, [users]);

  // Audit log: load support data once when admin tab is active
  useEffect(() => {
    if (activeTab === 6 && canEditUserManagement) {
      api.get('/users').then(r => setAuditUsers(r.data.users || [])).catch(() => {});
      api.get('/audit-logs/actions').then(r => setAuditActions(r.data.actions || [])).catch(() => {});
      fetchAuditLogs(0, auditRowsPerPage, auditFilters);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when pagination changes (not filters — those use handleAuditSearch)
  useEffect(() => {
    if (activeTab === 6) fetchAuditLogs(auditPage, auditRowsPerPage, auditFilters);
  }, [auditPage, auditRowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getUsers();
      if (response.success && response.data) {
        setUsers(response.data || []);
      }
    } catch (error: any) {
      // Ignorer silencieusement les 403 — utilisateur sans droit de gestion
      if (error.response?.status !== 403 && error.response?.status !== 401) {
        setNotification({
          open: true,
          message: `Erreur lors du chargement des utilisateurs: ${error.response?.data?.error || error.message || 'Erreur inconnue'}`,
          severity: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await ApiService.getDepartments();
      if (response.success && response.data) {
        setDepartments(response.data);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      setNotification({
        open: true,
        message: 'Erreur lors du chargement des départements',
        severity: 'error'
      });
    }
  };

  const loadRoles = async () => {
    try {
      const response = await ApiService.getRoles();
      if (response.success && response.data) {
        setRoles(response.data);
      } else {
        console.error('Error loading roles:', response.error);
        setNotification({
          open: true,
          message: 'Erreur lors du chargement des rôles',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      setNotification({
        open: true,
        message: 'Erreur lors du chargement des rôles',
        severity: 'error'
      });
    }
  };

  const loadBranches = async () => {
    try {
      const response = await ApiService.getBranches();
      if (response.success && response.data) {
        setBranches(response.data);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      setNotification({
        open: true,
        message: 'Erreur lors du chargement des agences',
        severity: 'error'
      });
    }
  };

  const loadDelegations = async () => {
    setDelegationsLoading(true);
    try {
      const res = await ApiService.getDelegations();
      if (res.success) setDelegations(res.data || []);
    } catch (err) {
      console.error('Erreur chargement délégations:', err);
    } finally {
      setDelegationsLoading(false);
    }
  };

  // Helper function to generate branch code
  const generateBranchCode = (branchName: string) => {
    // Take first 3 letters of branch name
    const prefix = branchName.replace(/\s/g, '').substring(0, 3).toUpperCase();
    // Get next sequential number
    const existingCodes = branches
      .filter(branch => branch.code?.startsWith(prefix))
      .map(branch => {
        const match = branch.code?.match(/(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });
    const nextNumber = Math.max(0, ...existingCodes) + 1;
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  };

  // Helper function to get available staff for manager dropdown
  const getAvailableStaff = () => {
    return users.filter(user => 
      user.isActive && 
      ['ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'ACCOUNT_MANAGER'].includes(user.role)
    );
  };


  const saveUser = async () => {
    // Validate required fields
    if (!editForm.name.trim() || !editForm.role.trim()) {
      setNotification({
        open: true,
        message: 'Le nom et le rôle sont obligatoires',
        severity: 'error'
      });
      return;
    }

    // For new users, email is also required
    if (!selectedUser && !editForm.email.trim()) {
      setNotification({
        open: true,
        message: 'L\'email est obligatoire pour créer un nouvel utilisateur',
        severity: 'error'
      });
      return;
    }

    try {
      let response;
      
      if (selectedUser) {
        // Update existing user
        response = await ApiService.updateUser(selectedUser.id, editForm);
        if (response.success) {
          setNotification({
            open: true,
            message: 'Utilisateur mis à jour avec succès',
            severity: 'success'
          });
        }
      } else {
        // Create new user
        response = await ApiService.createUser({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          department: editForm.department,
          jobTitle: editForm.jobTitle,
          branch: editForm.branch,
          isActive: editForm.isActive
        });
        if (response.success) {
          // Show temporary password to admin
          if (response.data.temporaryPassword) {
            setTemporaryPasswordDialog({
              open: true,
              password: response.data.temporaryPassword,
              userName: editForm.name
            });
          }
          setNotification({
            open: true,
            message: 'Utilisateur créé avec succès',
            severity: 'success'
          });
        }
      }

      if (response.success) {
        loadUsers(); // Reload the users list
        closeEditDialog();
      } else {
        setNotification({
          open: true,
          message: response.error || 'Erreur lors de l\'opération',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setNotification({
        open: true,
        message: `Erreur lors de ${selectedUser ? 'la mise à jour' : 'la création'} de l'utilisateur`,
        severity: 'error'
      });
    }
  };

  // User management dialog functions
  const openEditDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setEditForm({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || '',
        jobTitle: user.jobTitle || '',
        branch: user.branch || '',
        isActive: user.isActive
      });
    } else {
      setSelectedUser(null);
      setEditForm({
        name: '',
        email: '',
        role: '',
        department: '',
        jobTitle: '',
        branch: '',
        isActive: true
      });
    }
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
    setEditForm({
      name: '',
      email: '',
      role: '',
      department: '',
      jobTitle: '',
      branch: '',
      isActive: true
    });
  };

  // Filtering function
  const getFilteredUsers = () => {
    return users.filter((user) => {
      // Search term filter (name or email)
      const searchMatch = !filters.searchTerm || 
        user.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Department filter
      const departmentMatch = !filters.department || user.department === filters.department;

      // Role filter  
      const roleMatch = !filters.role || user.role === filters.role;

      // Status filter
      const statusMatch = filters.status === 'all' || 
        (filters.status === 'active' && user.isActive) ||
        (filters.status === 'inactive' && !user.isActive);

      // Branch filter — '__none__' cible les utilisateurs sans agence assignée
      const branchMatch = !filters.branch
        || (filters.branch === '__none__' ? !user.branch : user.branch === filters.branch);

      return searchMatch && departmentMatch && roleMatch && statusMatch && branchMatch;
    });
  };

  // Helper functions for filter options
  const getUniqueOptions = (field: keyof User) => {
    return Array.from(new Set(users.map(user => user[field]).filter(Boolean) as string[])).sort();
  };

  // Helper functions for UI display
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGEMENT: 'Direction Générale', 
    BRANCH_MANAGER: 'Directeur d\'Agence',
    ACCOUNT_MANAGER: 'Chargé d\'Affaires',
    CREDIT_ANALYST: 'Analyste Crédit',
    CREDIT_COMMITTEE: 'Comité de Crédit'
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <AdminIcon />;
      case 'MANAGEMENT': return <BusinessIcon />;
      case 'BRANCH_MANAGER': return <BranchIcon />;
      case 'ACCOUNT_MANAGER': return <PersonIcon />;
      case 'CREDIT_ANALYST': return <GroupIcon />;
      case 'CREDIT_COMMITTEE': return <SecurityIcon />;
      default: return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'error';
      case 'MANAGEMENT': return 'primary';
      case 'BRANCH_MANAGER': return 'warning';
      case 'ACCOUNT_MANAGER': return 'info';
      case 'CREDIT_ANALYST': return 'success';
      case 'CREDIT_COMMITTEE': return 'secondary';
      default: return 'default';
    }
  };

  const formatLastLogin = (lastLogin?: string | Date) => {
    if (!lastLogin) return 'Jamais connecté';
    const date = new Date(lastLogin);
    if (isNaN(date.getTime())) return 'Date invalide';
    return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Department management functions
  const openDepartmentDialog = (department?: Department) => {
    if (department) {
      setSelectedDepartment(department);
      setDepartmentForm({
        name: department.name,
        code: department.code || '',
        description: department.description || '',
        isActive: department.isActive
      });
    } else {
      setSelectedDepartment(null);
      setDepartmentForm({
        name: '',
        code: '',
        description: '',
        isActive: true
      });
    }
    setDepartmentDialogOpen(true);
  };

  const closeDepartmentDialog = () => {
    setDepartmentDialogOpen(false);
    setSelectedDepartment(null);
    setDepartmentForm({
      name: '',
      code: '',
      description: '',
      isActive: true
    });
  };

  const saveDepartment = async () => {
    try {
      if (selectedDepartment) {
        // Update existing department
        const response = await ApiService.updateDepartment(selectedDepartment.id, {
          name: departmentForm.name,
          code: departmentForm.code,
          description: departmentForm.description,
          isActive: departmentForm.isActive
        });

        if (response.success) {
          setNotification({
            open: true,
            message: 'Département mis à jour avec succès',
            severity: 'success'
          });
          await loadDepartments();
          closeDepartmentDialog();
        } else {
          setNotification({
            open: true,
            message: response.error || 'Erreur lors de la mise à jour du département',
            severity: 'error'
          });
        }
      } else {
        // Add new department
        const response = await ApiService.createDepartment({
          name: departmentForm.name,
          code: departmentForm.code,
          description: departmentForm.description,
          isActive: departmentForm.isActive
        });

        if (response.success) {
          setNotification({
            open: true,
            message: 'Département créé avec succès',
            severity: 'success'
          });
          await loadDepartments();
          closeDepartmentDialog();
        } else {
          setNotification({
            open: true,
            message: response.error || 'Erreur lors de la création du département',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Error saving department:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la sauvegarde du département',
        severity: 'error'
      });
    }
  };

  const saveDeptInline = async () => {
    if (!deptEditingId || !deptEditData.name) return;
    setDeptSaving(true);
    try {
      await ApiService.updateDepartment(deptEditingId, {
        name: deptEditData.name,
        code: deptEditData.code,
        description: deptEditData.description,
      });
      await loadDepartments();
      setDeptEditingId(null);
      setNotification({ open: true, message: 'Département mis à jour', severity: 'success' });
    } catch {
      setNotification({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' });
    } finally {
      setDeptSaving(false);
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce département ?')) {
      return;
    }

    try {
      // Mock delete logic - in real app this would be an API call
      setDepartments(prev => prev.filter(dept => dept.id !== departmentId));
      setNotification({
        open: true,
        message: 'Département supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting department:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la suppression du département',
        severity: 'error'
      });
    }
  };

  // Role management functions
  const openRoleDialog = (role?: Role) => {
    if (role) {
      setSelectedRole(role);
      setRoleForm({
        name: role.name,
        label: role.label,
        description: role.description || '',
        permissions: role.permissions,
        isActive: role.isActive
      });
    } else {
      setSelectedRole(null);
      setRoleForm({
        name: '',
        label: '',
        description: '',
        permissions: [],
        isActive: true
      });
    }
    setRoleDialogError(null);
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
    setRoleDialogError(null);
    setSelectedRole(null);
    setRoleForm({
      name: '',
      label: '',
      description: '',
      permissions: [],
      isActive: true
    });
  };

  // Password management functions
  const handleResetPassword = async (user: User) => {
    if (!window.confirm(`Réinitialiser le mot de passe pour ${user.name}?`)) {
      return;
    }

    try {
      const response = await ApiService.resetUserPassword(user.id);
      if (response.success && response.data) {
        setTemporaryPasswordDialog({
          open: true,
          password: response.data.temporaryPassword,
          userName: user.name
        });
        setNotification({
          open: true,
          message: 'Mot de passe réinitialisé avec succès',
          severity: 'success'
        });
      } else {
        setNotification({
          open: true,
          message: response.error || 'Erreur lors de la réinitialisation',
          severity: 'error'
        });
      }
    } catch (error) {
      setNotification({
        open: true,
        message: 'Erreur lors de la réinitialisation du mot de passe',
        severity: 'error'
      });
    }
  };

  const handleChangePassword = async () => {
    if (changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword) {
      setNotification({
        open: true,
        message: 'Les mots de passe ne correspondent pas',
        severity: 'error'
      });
      return;
    }

    if (changePasswordDialog.newPassword.length < 8) {
      setNotification({
        open: true,
        message: 'Le mot de passe doit contenir au moins 8 caractères',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await ApiService.changePassword(
        changePasswordDialog.currentPassword,
        changePasswordDialog.newPassword
      );

      if (response.success) {
        setNotification({
          open: true,
          message: 'Mot de passe modifié avec succès',
          severity: 'success'
        });
        setChangePasswordDialog({
          open: false,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setNotification({
          open: true,
          message: response.error || 'Erreur lors du changement de mot de passe',
          severity: 'error'
        });
      }
    } catch (error) {
      setNotification({
        open: true,
        message: 'Erreur lors du changement de mot de passe',
        severity: 'error'
      });
    }
  };

  const saveRole = async () => {
    setRoleDialogError(null);

    if (!roleForm.label.trim()) {
      setRoleDialogError('Le nom du rôle est obligatoire.');
      return;
    }

    try {
      if (selectedRole) {
        const response = await ApiService.updateRolePermissions(selectedRole.name, {
          label: roleForm.label,
          description: roleForm.description,
          permissions: roleForm.permissions
        });

        if (response.success) {
          setNotification({ open: true, message: 'Rôle et permissions mis à jour avec succès', severity: 'success' });
          await loadUsers();
          await loadRoles();
          closeRoleDialog();
        } else {
          setRoleDialogError(response.error || 'Erreur lors de la mise à jour du rôle.');
        }
      } else {
        const autoRole = roleForm.label.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const response = await ApiService.createRole({
          role: autoRole,
          label: roleForm.label,
          description: roleForm.description,
          permissions: roleForm.permissions
        });

        if (response.success) {
          setNotification({ open: true, message: 'Rôle créé avec succès', severity: 'success' });
          await loadRoles();
          closeRoleDialog();
        } else {
          setRoleDialogError(response.error || 'Erreur lors de la création du rôle.');
        }
      }
    } catch (error) {
      console.error('Error saving role:', error);
      setRoleDialogError('Erreur lors de la sauvegarde du rôle.');
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) {
      return;
    }

    try {
      setRoles(prev => prev.filter(role => role.id !== roleId));
      setNotification({
        open: true,
        message: 'Rôle supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la suppression du rôle',
        severity: 'error'
      });
    }
  };

  // Branch management functions
  const openBranchDialog = (branch?: Branch) => {
    if (branch) {
      setSelectedBranch(branch);
      setBranchForm({
        name: branch.name,
        code: branch.code || '',
        address: branch.address || '',
        city: branch.city || '',
        country: branch.country || '',
        manager: branch.manager || '',
        isActive: branch.isActive
      });
    } else {
      setSelectedBranch(null);
      setBranchForm({
        name: '',
        code: '', // Will be auto-generated based on name
        address: '',
        city: '',
        country: '',
        manager: '',
        isActive: true
      });
    }
    setBranchDialogOpen(true);
  };

  const closeBranchDialog = () => {
    setBranchDialogOpen(false);
    setSelectedBranch(null);
    setBranchForm({
      name: '',
      code: '',
      address: '',
      city: '',
      country: '',
      manager: '',
      isActive: true
    });
  };

  const saveBranch = async () => {
    try {
      if (selectedBranch) {
        // Update existing branch
        const response = await ApiService.updateBranch(selectedBranch.id, {
          name: branchForm.name,
          code: branchForm.code,
          address: branchForm.address,
          city: branchForm.city,
          country: branchForm.country,
          manager: branchForm.manager,
          isActive: branchForm.isActive
        });

        if (response.success) {
          setNotification({
            open: true,
            message: 'Agence mise à jour avec succès',
            severity: 'success'
          });
          await loadBranches();
          closeBranchDialog();
        } else {
          setNotification({
            open: true,
            message: response.error || 'Erreur lors de la mise à jour de l\'agence',
            severity: 'error'
          });
        }
      } else {
        // Auto-generate code for new branch if not provided
        const autoCode = branchForm.code || generateBranchCode(branchForm.name);

        const response = await ApiService.createBranch({
          name: branchForm.name,
          code: autoCode,
          address: branchForm.address,
          city: branchForm.city,
          country: branchForm.country,
          manager: branchForm.manager,
          isActive: branchForm.isActive
        });

        if (response.success) {
          setNotification({
            open: true,
            message: 'Agence créée avec succès',
            severity: 'success'
          });
          await loadBranches();
          closeBranchDialog();
        } else {
          setNotification({
            open: true,
            message: response.error || 'Erreur lors de la création de l\'agence',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Error saving branch:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la sauvegarde de l\'agence',
        severity: 'error'
      });
    }
  };

  const saveBranchInline = async () => {
    if (!branchEditingId || !branchEditData.name) return;
    setBranchSaving(true);
    try {
      await ApiService.updateBranch(branchEditingId, {
        name: branchEditData.name,
        code: branchEditData.code,
        city: branchEditData.city,
        manager: branchEditData.manager,
      });
      await loadBranches();
      setBranchEditingId(null);
      setNotification({ open: true, message: 'Agence mise à jour', severity: 'success' });
    } catch {
      setNotification({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' });
    } finally {
      setBranchSaving(false);
    }
  };

  const deleteBranch = async (branchId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette agence ?')) {
      return;
    }

    try {
      setBranches(prev => prev.filter(branch => branch.id !== branchId));
      setNotification({
        open: true,
        message: 'Agence supprimée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting branch:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la suppression de l\'agence',
        severity: 'error'
      });
    }
  };


  if (!canViewUserManagement) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Accès non autorisé. Vous devez avoir les permissions d'administration pour accéder à cette page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          <GroupIcon sx={{ mr: 2 }} />
          Gestion des Utilisateurs
          {!canEditUserManagement && (
            <Chip
              icon={<VisibilityIcon />}
              label="Lecture seule"
              size="small"
              variant="outlined"
              sx={{ ml: 2 }}
            />
          )}
          {canEditUserManagement && (
            <Chip
              icon={<LockIcon />}
              label="Administration"
              size="small"
              color="primary"
              sx={{ ml: 2 }}
            />
          )}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Administration des comptes utilisateurs et des permissions système
        </Typography>
      </Box>

      {/* Statistics Cards */}
      {!loading && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ color: 'primary.main', fontSize: 28, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {users.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Utilisateurs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <BadgeIcon sx={{ color: 'success.main', fontSize: 28, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {users.filter(u => u.isActive).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Utilisateurs Actifs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AdminIcon sx={{ color: 'error.main', fontSize: 28, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {users.filter(u => u.role === 'ADMIN').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Administrateurs
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <GroupIcon sx={{ color: 'warning.main', fontSize: 28, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {new Set(users.map(u => u.department).filter(Boolean)).size}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Départements
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content with Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="user management tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab 
              label="Utilisateurs" 
              icon={<PersonIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Départements" 
              icon={<DepartmentIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Rôles" 
              icon={<RoleIcon />}
              iconPosition="start"
            />
            <Tab
              label="Agences"
              icon={<BranchIcon />}
              iconPosition="start"
            />
            <Tab
              label="Sécurité 2FA"
              icon={<ShieldIcon />}
              iconPosition="start"
            />
            <Tab
              label="Délégations"
              icon={<BeachAccessIcon />}
              iconPosition="start"
            />
            {canEditUserManagement && (
              <Tab
                label="Journal d'activité"
                icon={<HistoryIcon />}
                iconPosition="start"
              />
            )}
          </Tabs>
        </Box>

        <CardContent>
          {/* Users Tab */}
          {activeTab === 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Liste des Utilisateurs
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<FileUploadIcon />}
                    onClick={() => setBulkImportOpen(true)}
                    disabled={!canEditUserManagement}
                    sx={{ borderColor: '#0F766E', color: '#0F766E', '&:hover': { borderColor: '#0D6560', bgcolor: 'rgba(15,118,110,0.06)' } }}
                  >
                    Import Excel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openEditDialog()}
                    disabled={!canEditUserManagement}
                  >
                    Ajouter Utilisateur
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadUsers}
                    disabled={loading}
                  >
                    Actualiser
                  </Button>
                </Box>
              </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Filter Section */}
          <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Filtres
              </Typography>
              <Grid container spacing={3}>
                {/* Search Term */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Rechercher (nom ou email)"
                    variant="outlined"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    placeholder="Tapez le nom ou l'email..."
                  />
                </Grid>

                {/* Status Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      label="Statut"
                    >
                      <MenuItem value="all">Tous</MenuItem>
                      <MenuItem value="active">Actifs</MenuItem>
                      <MenuItem value="inactive">Inactifs</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Department Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Département</InputLabel>
                    <Select
                      value={filters.department}
                      onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                      label="Département"
                    >
                      <MenuItem value="">Tous</MenuItem>
                      {departments.filter(d => d.isActive).map((dept) => (
                        <MenuItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Role Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Rôle</InputLabel>
                    <Select
                      value={filters.role}
                      onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                      label="Rôle"
                    >
                      <MenuItem value="">Tous</MenuItem>
                      {availableRoles.map((r) => (
                        <MenuItem key={r.value} value={r.value}>
                          {r.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Branch Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Agence</InputLabel>
                    <Select
                      value={filters.branch}
                      onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                      label="Agence"
                    >
                      <MenuItem value="">Toutes</MenuItem>
                      <MenuItem value="__none__">Non assignée</MenuItem>
                      {branches.filter(b => b.isActive).map((b) => (
                        <MenuItem key={b.id} value={b.name}>
                          {b.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Clear Filters */}
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="secondary"
                    onClick={() => setFilters({
                      searchTerm: '',
                      department: '',
                      role: '',
                      status: 'all',
                      branch: '',
                    })}
                    sx={{ height: '56px' }}
                  >
                    Effacer les filtres
                  </Button>
                </Grid>
              </Grid>
              
              {/* Filter Results Summary */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {getFilteredUsers().length} utilisateur(s) trouvé(s) sur {users.length} total
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Utilisateur</TableCell>
                    <TableCell>Rôle</TableCell>
                    <TableCell>Département</TableCell>
                    <TableCell>Agence</TableCell>
                    <TableCell>Poste</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Dernière Connexion</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getFilteredUsers().map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2, bgcolor: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {user.name}
                              </Typography>
                              <DelegationBadge
                                isOnLeave={!!(user as any).isOnLeave}
                                delegateName={
                                  delegations.find(d =>
                                    d.isActive &&
                                    d.delegatorId === user.id &&
                                    new Date(d.startDate) <= new Date() &&
                                    new Date(d.endDate) >= new Date()
                                  )?.delegate?.name
                                }
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getRoleIcon(user.role)}
                          label={roleLabels[user.role] || user.role}
                          color={getRoleColor(user.role) as any}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.department || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {user.branch || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.jobTitle || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.isActive ? 'Actif' : 'Inactif'}
                          color={user.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatLastLogin(user.lastLogin)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Modifier l'utilisateur">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(user)}
                            disabled={!canEditUserManagement}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Réinitialiser le mot de passe">
                          <IconButton
                            size="small"
                            onClick={() => handleResetPassword(user)}
                            disabled={!canEditUserManagement}
                          >
                            <LockIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
            </>
          )}

          {/* Departments Tab */}
          {activeTab === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Gestion des Départements
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => openDepartmentDialog()}
                  disabled={!canEditUserManagement}
                >
                  Ajouter Département
                </Button>
              </Box>

              <TableContainer sx={{ border: '1px solid #e8ecf0', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell sx={{ width: 100 }}>Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell sx={{ width: 130 }}>Utilisateurs</TableCell>
                      <TableCell align="right" sx={{ width: 96 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {departments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucun département.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {departments.map((dept) =>
                      deptEditingId === dept.id ? (
                        <TableRow key={dept.id} sx={{ bgcolor: 'rgba(31,78,121,0.04)' }}>
                          <TableCell>
                            <TextField autoFocus size="small" value={deptEditData.name}
                              onChange={e => setDeptEditData(p => ({ ...p, name: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveDeptInline()} sx={{ width: '100%' }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" value={deptEditData.code}
                              onChange={e => setDeptEditData(p => ({ ...p, code: e.target.value }))}
                              sx={{ width: 80 }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" value={deptEditData.description}
                              onChange={e => setDeptEditData(p => ({ ...p, description: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveDeptInline()} sx={{ width: '100%' }} />
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Enregistrer">
                              <span>
                                <IconButton size="small" color="success" onClick={saveDeptInline}
                                  disabled={!deptEditData.name || deptSaving}>
                                  {deptSaving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Annuler">
                              <IconButton size="small" onClick={() => setDeptEditingId(null)}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={dept.id} hover
                          onDoubleClick={() => { if (canEditUserManagement) { setDeptEditingId(dept.id); setDeptEditData({ name: dept.name, code: dept.code || '', description: dept.description || '' }); } }}>
                          <TableCell sx={{ fontWeight: 500 }}>{dept.name}</TableCell>
                          <TableCell>
                            {dept.code ? <Chip label={dept.code} size="small" variant="outlined" /> : <Typography variant="body2" color="text.secondary">—</Typography>}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '13px' }}>{dept.description || '—'}</TableCell>
                          <TableCell><Chip label={`${dept.userCount ?? 0} utilisateurs`} size="small" /></TableCell>
                          <TableCell align="right">
                            <Tooltip title="Modifier">
                              <IconButton size="small"
                                onClick={() => { setDeptEditingId(dept.id); setDeptEditData({ name: dept.name, code: dept.code || '', description: dept.description || '' }); }}
                                disabled={!canEditUserManagement || deptEditingId !== null}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton size="small" color="error"
                                onClick={() => deleteDepartment(dept.id)}
                                disabled={!canEditUserManagement || deptEditingId !== null}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Roles Tab */}
          {activeTab === 2 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Gestion des Rôles
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => openRoleDialog()}
                  disabled={!canEditUserManagement}
                >
                  Ajouter Rôle
                </Button>
              </Box>

              <List>
                {roles.map((role) => (
                  <ListItem key={role.id} divider>
                    <ListItemIcon>
                      <RoleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={role.label}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {role.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Code: {role.name} • {role.userCount} utilisateurs • {role.permissions.length} permissions
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="edit"
                        onClick={() => openRoleDialog(role)}
                        sx={{ mr: 1 }}
                        disabled={!canEditUserManagement}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => deleteRole(role.id)}
                        color="error"
                        disabled={!canEditUserManagement}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* Branches Tab */}
          {activeTab === 3 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Gestion des Agences
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => openBranchDialog()}
                  disabled={!canEditUserManagement}
                >
                  Ajouter Agence
                </Button>
              </Box>

              <TableContainer sx={{ border: '1px solid #e8ecf0', borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell sx={{ width: 90 }}>Code</TableCell>
                      <TableCell sx={{ width: 140 }}>Ville</TableCell>
                      <TableCell sx={{ width: 160 }}>Responsable</TableCell>
                      <TableCell sx={{ width: 120 }}>Utilisateurs</TableCell>
                      <TableCell align="right" sx={{ width: 96 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {branches.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucune agence.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {branches.map((branch) =>
                      branchEditingId === branch.id ? (
                        <TableRow key={branch.id} sx={{ bgcolor: 'rgba(31,78,121,0.04)' }}>
                          <TableCell>
                            <TextField autoFocus size="small" value={branchEditData.name}
                              onChange={e => setBranchEditData(p => ({ ...p, name: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveBranchInline()} sx={{ width: '100%' }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" value={branchEditData.code}
                              onChange={e => setBranchEditData(p => ({ ...p, code: e.target.value }))}
                              sx={{ width: 70 }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" value={branchEditData.city}
                              onChange={e => setBranchEditData(p => ({ ...p, city: e.target.value }))}
                              sx={{ width: 120 }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" value={branchEditData.manager}
                              onChange={e => setBranchEditData(p => ({ ...p, manager: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveBranchInline()} sx={{ width: 140 }} />
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Enregistrer">
                              <span>
                                <IconButton size="small" color="success" onClick={saveBranchInline}
                                  disabled={!branchEditData.name || branchSaving}>
                                  {branchSaving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Annuler">
                              <IconButton size="small" onClick={() => setBranchEditingId(null)}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={branch.id} hover
                          onDoubleClick={() => { if (canEditUserManagement) { setBranchEditingId(branch.id); setBranchEditData({ name: branch.name, code: branch.code || '', city: (branch as any).city || '', manager: branch.manager || '' }); } }}>
                          <TableCell sx={{ fontWeight: 500 }}>{branch.name}</TableCell>
                          <TableCell>
                            {branch.code ? <Chip label={branch.code} size="small" variant="outlined" /> : <Typography variant="body2" color="text.secondary">—</Typography>}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{(branch as any).city || '—'}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{branch.manager || 'Non assigné'}</TableCell>
                          <TableCell><Chip label={`${branch.userCount ?? 0} utilisateurs`} size="small" /></TableCell>
                          <TableCell align="right">
                            <Tooltip title="Modifier">
                              <IconButton size="small"
                                onClick={() => { setBranchEditingId(branch.id); setBranchEditData({ name: branch.name, code: branch.code || '', city: (branch as any).city || '', manager: branch.manager || '' }); }}
                                disabled={!canEditUserManagement || branchEditingId !== null}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton size="small" color="error"
                                onClick={() => deleteBranch(branch.id)}
                                disabled={!canEditUserManagement || branchEditingId !== null}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* ── Sécurité 2FA ── */}
          {activeTab === 4 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
                <ShieldIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Authentification à deux facteurs (2FA)
                </Typography>
                <Chip label="Administration" size="small" color="primary" />
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={4}>
                  {/* Par rôle */}
                  <Grid item xs={12} md={5}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Par rôle
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Tous les utilisateurs du rôle seront obligés de configurer la 2FA.
                    </Typography>
                    <List dense disablePadding>
                      {Object.keys(ROLE_2FA_LABELS).map(roleName => {
                        const roleData = roles.find(r => r.name === roleName);
                        const required = roleData?.twoFactorRequired ?? false;
                        return (
                          <ListItem
                            key={roleName}
                            sx={{ px: 0, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                          >
                            <ListItemText
                              primary={ROLE_2FA_LABELS[roleName]}
                              primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={required ? 'Obligatoire' : 'Optionnel'}
                                size="small"
                                color={required ? 'success' : 'default'}
                                sx={{ minWidth: 80 }}
                              />
                              {saving2FA === `role-${roleName}` ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  checked={required}
                                  onChange={e => canEditUserManagement && handleRoleToggle2FA(roleName, e.target.checked)}
                                  size="small"
                                  disabled={!canEditUserManagement}
                                />
                              )}
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Grid>

                  {/* Par utilisateur */}
                  <Grid item xs={12} md={7}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Par utilisateur
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Forcer la 2FA pour un utilisateur spécifique, indépendamment de son rôle.
                    </Typography>
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            {['Nom', 'Rôle', '2FA activé', 'Obligatoire'].map(h => (
                              <TableCell
                                key={h}
                                sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5 }}
                              >
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {users.filter(u => u.isActive).map(user => {
                            const roleObj = roles.find(r => r.name === user.role);
                            const byRole  = roleObj?.twoFactorRequired ?? false;
                            const isRequired = user.twoFactorRequired || byRole;
                            return (
                              <TableRow key={user.id} hover sx={{ borderBottom: '1px solid #f1f5f9' }}>
                                <TableCell sx={{ py: 1.25 }}>
                                  <Typography variant="body2" fontWeight={500} sx={{ fontSize: '13px' }}>{user.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1.25 }}>
                                  <Chip label={ROLE_2FA_LABELS[user.role] || user.role} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell sx={{ py: 1.25 }} align="center">
                                  <Chip
                                    label={user.twoFactorEnabled ? 'Oui' : 'Non'}
                                    size="small"
                                    color={user.twoFactorEnabled ? 'success' : 'default'}
                                  />
                                </TableCell>
                                <TableCell sx={{ py: 1.25 }} align="center">
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                    {byRole && (
                                      <Chip label="Via rôle" size="small" color="info" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                                    )}
                                    {saving2FA === `user-${user.id}` ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <Switch
                                        checked={isRequired}
                                        onChange={e => handleUserToggle2FA(user.id, e.target.checked)}
                                        size="small"
                                        disabled={byRole || !canEditUserManagement}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* Délégations (tab 5) */}
          {activeTab === 5 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BeachAccessIcon sx={{ color: 'warning.main' }} />
                  <Typography variant="h6" fontWeight={600}>Délégations de pouvoir</Typography>
                </Box>
                {canEditUserManagement && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { setSelectedDelegatorId(''); setDelegationFormOpen(true); }}
                  >
                    Créer une délégation
                  </Button>
                )}
              </Box>

              {delegationsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : delegations.length === 0 ? (
                <Alert severity="info">Aucune délégation de pouvoir enregistrée.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Délégant</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Délégué</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Période</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Actions déléguées</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Statut</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Motif</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {delegations.map(d => {
                        const now = new Date();
                        const isExpired = new Date(d.endDate) < now;
                        const isCurrentlyActive = d.isActive && !isExpired && new Date(d.startDate) <= now;
                        const statusLabel = isCurrentlyActive ? 'Active' : d.revokedAt ? 'Révoquée' : 'Expirée';
                        const statusColor: 'success' | 'warning' | 'default' = isCurrentlyActive ? 'success' : d.revokedAt ? 'warning' : 'default';
                        return (
                          <TableRow key={d.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {d.delegator.name}
                                {(d as any).delegator?.isOnLeave && <DelegationBadge isOnLeave size="small" />}
                              </Box>
                            </TableCell>
                            <TableCell>{d.delegate.name}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                              {new Date(d.startDate).toLocaleDateString('fr-FR')} → {new Date(d.endDate).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(d.permissions as DelegatableAction[]).map(p => (
                                  <Chip key={p} label={DELEGATION_ACTION_LABELS[p]} size="small" variant="outlined" sx={{ fontSize: '0.68rem' }} />
                                ))}
                              </Box>
                            </TableCell>
                            <TableCell><Chip label={statusLabel} color={statusColor} size="small" /></TableCell>
                            <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Tooltip title={d.reason || ''}>
                                <span>{d.reason || '—'}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {isCurrentlyActive && canEditUserManagement && (
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={async () => {
                                    const res = await ApiService.revokeDelegation(d.id);
                                    if (res.success) {
                                      setNotification({ open: true, message: 'Délégation révoquée.', severity: 'success' });
                                      loadDelegations();
                                    } else {
                                      setNotification({ open: true, message: res.error || 'Erreur révocation', severity: 'error' });
                                    }
                                  }}
                                >
                                  Révoquer
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <DelegationForm
                open={delegationFormOpen}
                onClose={() => setDelegationFormOpen(false)}
                onSuccess={() => { loadDelegations(); loadUsers(); }}
                delegatorId={selectedDelegatorId}
                users={users.filter(u => u.isActive)}
                isAdmin={canEditUserManagement}
              />
            </Box>
          )}

          {/* Journal d'activité (admin only, tab 6) */}
          {activeTab === 6 && canEditUserManagement && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                  Journal d'activité
                </Typography>
                <Chip label="Administration" size="small" color="primary" />
                <Chip label="Conservation 60 j" size="small" variant="outlined" icon={<HistoryIcon sx={{ fontSize: 14 }} />} />
                <Tooltip title="Rafraîchir">
                  <IconButton size="small" onClick={() => fetchAuditLogs(auditPage, auditRowsPerPage, auditFilters)} disabled={auditLoading}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Filters */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e8ecf0' }}>
                <FilterListIcon sx={{ color: '#9ca3af', alignSelf: 'center', mr: 0.5 }} />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Utilisateur</InputLabel>
                  <Select label="Utilisateur" value={auditFilters.userId} onChange={(e) => handleAuditFilterChange('userId', e.target.value)}>
                    <MenuItem value="">Tous</MenuItem>
                    {auditUsers.filter(u => u.isActive).map((u: any) => (
                      <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Action</InputLabel>
                  <Select label="Action" value={auditFilters.action} onChange={(e) => handleAuditFilterChange('action', e.target.value)}>
                    <MenuItem value="">Toutes</MenuItem>
                    {auditActions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Type d'entité</InputLabel>
                  <Select label="Type d'entité" value={auditFilters.entityType} onChange={(e) => handleAuditFilterChange('entityType', e.target.value)}>
                    <MenuItem value="">Tous</MenuItem>
                    {[
                      'client','application','workflow','user','role','department','branch',
                      'credit_policy','credit_type','approval_limit','document',
                      'backup','announcement','two_factor','bank_holiday',
                    ].map(t => (
                      <MenuItem key={t} value={t}>{formatEntityType(t)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="Date début" type="date" InputLabelProps={{ shrink: true }} value={auditFilters.dateFrom} onChange={(e) => handleAuditFilterChange('dateFrom', e.target.value)} sx={{ minWidth: 140 }} />
                <TextField size="small" label="Date fin" type="date" InputLabelProps={{ shrink: true }} value={auditFilters.dateTo} onChange={(e) => handleAuditFilterChange('dateTo', e.target.value)} sx={{ minWidth: 140 }} />
                <Button variant="contained" size="small" onClick={handleAuditSearch} disabled={auditLoading} sx={{ alignSelf: 'center' }}>Filtrer</Button>
                <Button variant="outlined" size="small" onClick={() => {
                  const reset = { userId: '', action: '', entityType: '', dateFrom: '', dateTo: '' };
                  setAuditFilters(reset);
                  setAuditPage(0);
                  fetchAuditLogs(0, auditRowsPerPage, reset);
                }} disabled={auditLoading} sx={{ alignSelf: 'center' }}>Réinitialiser</Button>
              </Box>

              {auditError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAuditError('')}>{auditError}</Alert>}

              {auditLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                          {['Horodatage', 'Utilisateur', 'Rôle', 'Action', 'Entité', 'ID', 'Détails', 'Adresse IP'].map(h => (
                            <TableCell key={h} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', py: 1.5, whiteSpace: 'nowrap' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#9ca3af' }}>Aucune entrée trouvée</TableCell>
                          </TableRow>
                        ) : auditLogs.map((log: any) => (
                          <TableRow key={log.id} sx={{ '&:hover': { bgcolor: 'rgba(31,78,121,0.03)' }, borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none' } }}>
                            <TableCell sx={{ py: 1.25, fontSize: '12px', whiteSpace: 'nowrap', color: '#374151' }}>{formatAuditDate(log.createdAt)}</TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '13px' }}>{log.user?.name || '—'}</Typography>
                              <Typography variant="caption" color="text.secondary">{log.user?.email || ''}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              <Chip label={ROLE_LABEL_MAP[log.user?.role] || log.user?.role || '—'} size="small" variant="outlined" sx={{ fontSize: '11px', height: 22 }} />
                            </TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              <Chip label={formatAction(log.action)} size="small" color={getActionColor(log.action)} sx={{ fontSize: '11px', height: 22 }} />
                            </TableCell>
                            <TableCell sx={{ py: 1.25, fontSize: '13px', color: '#374151' }}>{formatEntityType(log.entityType) || '—'}</TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              {log.entityId ? (
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '11px' }}>
                                  {log.entityId.length > 12 ? log.entityId.slice(0, 8) + '…' : log.entityId}
                                </Typography>
                              ) : '—'}
                            </TableCell>
                            <TableCell sx={{ py: 1.25, maxWidth: 220 }}>
                              {log.newValues ? (
                                <Tooltip title={formatNewValues(log.action, log.newValues) ?? ''} placement="top" arrow>
                                  <Typography variant="caption" sx={{ color: '#374151', cursor: 'default', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                    {formatNewValues(log.action, log.newValues)}
                                  </Typography>
                                </Tooltip>
                              ) : '—'}
                            </TableCell>
                            <TableCell sx={{ py: 1.25, fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>{log.ipAddress || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={auditTotal}
                    page={auditPage}
                    onPageChange={(_, p) => setAuditPage(p)}
                    rowsPerPage={auditRowsPerPage}
                    onRowsPerPageChange={(e) => { setAuditRowsPerPage(parseInt(e.target.value, 10)); setAuditPage(0); }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Lignes par page :"
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
                  />
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={closeEditDialog} maxWidth="sm" fullWidth>
        <DialogHeader
          title={selectedUser ? `Modifier — ${selectedUser.name}` : 'Nouvel utilisateur'}
          subtitle={selectedUser?.email}
          icon={<PersonIcon sx={{ fontSize: 17 }} />}
          onClose={closeEditDialog}
        />
        <DialogContent>
          <Grid container spacing={2}>
            {/* ── Identité ── */}
            <Grid item xs={12}>
              <TextField
                fullWidth size="small"
                label="Nom complet"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth size="small"
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required={!selectedUser}
                disabled={!!selectedUser || !canEditUserManagement}
                helperText={selectedUser ? "L'email ne peut pas être modifié" : ''}
              />
            </Grid>

            {/* ── Affectation ── */}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', pt: 0.5 }}>
                Affectation
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  label="Rôle"
                  disabled={!canEditUserManagement}
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Département</InputLabel>
                <Select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  label="Département"
                  disabled={!canEditUserManagement}
                >
                  <MenuItem value=""><em>Non spécifié</em></MenuItem>
                  {getAvailableDepartments().map((dept) => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={8}>
              <FormControl fullWidth size="small">
                <InputLabel>Agence</InputLabel>
                <Select
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                  label="Agence"
                  disabled={!canEditUserManagement}
                >
                  <MenuItem value=""><em>Non spécifiée</em></MenuItem>
                  {branches.filter(b => b.isActive).map((b) => (
                    <MenuItem key={b.id} value={b.name}>
                      {b.name} {b.code && `(${b.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small"
                label="Titre du poste"
                value={editForm.jobTitle}
                onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                placeholder="Ex: Chargé Crédit"
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    disabled={!canEditUserManagement}
                    size="small"
                  />
                }
                label={<Typography sx={{ fontSize: '13px' }}>Compte actif</Typography>}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} startIcon={<CancelIcon />} size="small">Annuler</Button>
          <Button
            onClick={saveUser}
            variant="contained"
            startIcon={<SaveIcon />}
            size="small"
            disabled={
              !canEditUserManagement ||
              !editForm.name.trim() ||
              !editForm.role.trim() ||
              (!selectedUser && !editForm.email.trim())
            }
          >
            {selectedUser ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={departmentDialogOpen} onClose={closeDepartmentDialog} maxWidth="sm" fullWidth>
        <DialogHeader
          title={selectedDepartment ? `Département — ${selectedDepartment.name}` : 'Nouveau Département'}
          icon={<DepartmentIcon sx={{ fontSize: 17 }} />}
          onClose={closeDepartmentDialog}
        />
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Nom du Département"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                required
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Code"
                value={departmentForm.code}
                onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                required
                disabled={!canEditUserManagement}
                helperText="Code unique du département"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                multiline
                rows={3}
                disabled={!canEditUserManagement}
              />
            </Grid>


            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={departmentForm.isActive}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, isActive: e.target.checked })}
                    disabled={!canEditUserManagement}
                  />
                }
                label="Département actif"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDepartmentDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button 
            onClick={saveDepartment} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!canEditUserManagement}
          >
            {selectedDepartment ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onClose={closeRoleDialog} maxWidth="sm" fullWidth>
        <DialogHeader
          title={selectedRole ? `Rôle — ${selectedRole.label}` : 'Nouveau Rôle'}
          icon={<RoleIcon sx={{ fontSize: 17 }} />}
          onClose={closeRoleDialog}
        />
        <DialogContent>
          {roleDialogError && (
            <Alert severity="error" onClose={() => setRoleDialogError(null)} sx={{ mb: 2 }}>
              {roleDialogError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Nom du Rôle"
                value={roleForm.label}
                onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
                required
                placeholder="ex: Gestionnaire de Crédit"
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                multiline
                rows={3}
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Permissions
              </Typography>
              {PERMISSION_GROUPS.map((group) => (
                <Box key={group.category} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
                    {group.category}
                  </Typography>
                  <FormGroup row>
                    {group.permissions.map(({ key: permission, label }) => (
                      <FormControlLabel
                        key={permission}
                        sx={{ width: '50%', minWidth: 220 }}
                        control={
                          <Checkbox
                            checked={roleForm.permissions.includes(permission) || roleForm.permissions.includes('*')}
                            disabled={!canEditUserManagement}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRoleForm(prev => {
                                  if (prev.permissions.includes('*')) {
                                    return { ...prev, permissions: allPermissions };
                                  }
                                  if (!prev.permissions.includes(permission)) {
                                    const newPermissions = [...prev.permissions, permission];
                                    if (newPermissions.length === allPermissions.length) {
                                      return { ...prev, permissions: ['*'] };
                                    }
                                    return { ...prev, permissions: newPermissions };
                                  }
                                  return prev;
                                });
                              } else {
                                setRoleForm(prev => {
                                  if (prev.permissions.includes('*')) {
                                    return { ...prev, permissions: allPermissions.filter(p => p !== permission) };
                                  }
                                  return { ...prev, permissions: prev.permissions.filter(p => p !== permission) };
                                });
                              }
                            }}
                          />
                        }
                        label={label}
                      />
                    ))}
                  </FormGroup>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={roleForm.isActive}
                    onChange={(e) => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                    disabled={!canEditUserManagement}
                  />
                }
                label="Rôle actif"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoleDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button 
            onClick={saveRole} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!canEditUserManagement}
          >
            {selectedRole ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onClose={closeBranchDialog} maxWidth="sm" fullWidth>
        <DialogHeader
          title={selectedBranch ? `Agence — ${selectedBranch.name}` : 'Nouvelle Agence'}
          icon={<BranchIcon sx={{ fontSize: 17 }} />}
          onClose={closeBranchDialog}
        />
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Nom de l'Agence"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                required
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Code de l'Agence"
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                placeholder={selectedBranch ? "ex: DKR001" : "Auto-généré basé sur le nom"}
                disabled={!selectedBranch || !canEditUserManagement}
                helperText={!selectedBranch ? "Le code sera généré automatiquement" : ""}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Adresse"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                multiline
                rows={2}
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Responsable</InputLabel>
                <Select
                  value={branchForm.manager}
                  onChange={(e) => setBranchForm({ ...branchForm, manager: e.target.value })}
                  label="Responsable"
                  disabled={!canEditUserManagement}
                >
                  <MenuItem value="">
                    <em>Non assigné</em>
                  </MenuItem>
                  {getAvailableStaff().map((staff) => (
                    <MenuItem key={staff.id} value={staff.name}>
                      {staff.name} ({roleLabels[staff.role] || staff.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={branchForm.isActive}
                    onChange={(e) => setBranchForm({ ...branchForm, isActive: e.target.checked })}
                    disabled={!canEditUserManagement}
                  />
                }
                label="Agence active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBranchDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button 
            onClick={saveBranch} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!canEditUserManagement}
          >
            {selectedBranch ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Temporary Password Dialog */}
      <Dialog
        open={temporaryPasswordDialog.open}
        onClose={() => setTemporaryPasswordDialog({ ...temporaryPasswordDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon color="primary" />
            Mot de passe temporaire
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Veuillez noter ce mot de passe et le communiquer à <strong>{temporaryPasswordDialog.userName}</strong>.
            Il ne sera plus affiché après la fermeture de cette fenêtre.
          </Alert>
          <TextField
            fullWidth
            label="Mot de passe temporaire"
            value={temporaryPasswordDialog.password}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <Tooltip title="Copier le mot de passe">
                  <IconButton
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPasswordDialog.password);
                      setNotification({
                        open: true,
                        message: 'Mot de passe copié dans le presse-papiers',
                        severity: 'success'
                      });
                    }}
                  >
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
              )
            }}
            sx={{
              '& input': {
                fontFamily: 'monospace',
                fontSize: '1.2rem',
                letterSpacing: '0.1em'
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTemporaryPasswordDialog({ open: false, password: '', userName: '' })}
            variant="contained"
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={changePasswordDialog.open}
        onClose={() => setChangePasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon color="primary" />
            Changer mon mot de passe
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              type="password"
              label="Mot de passe actuel"
              value={changePasswordDialog.currentPassword}
              onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, currentPassword: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Nouveau mot de passe"
              value={changePasswordDialog.newPassword}
              onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, newPassword: e.target.value })}
              helperText="Au moins 8 caractères avec majuscule, minuscule et chiffre"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirmer le nouveau mot de passe"
              value={changePasswordDialog.confirmPassword}
              onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, confirmPassword: e.target.value })}
              error={changePasswordDialog.confirmPassword !== '' && changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword}
              helperText={changePasswordDialog.confirmPassword !== '' && changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword ? 'Les mots de passe ne correspondent pas' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setChangePasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}
            startIcon={<CancelIcon />}
          >
            Annuler
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={
              !changePasswordDialog.currentPassword ||
              !changePasswordDialog.newPassword ||
              !changePasswordDialog.confirmPassword ||
              changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword
            }
          >
            Changer le mot de passe
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      <BulkUserImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onComplete={(created, errors) => {
          setBulkImportOpen(false);
          loadUsers();
          if (created > 0) {
            setNotification({
              open: true,
              message: `${created} utilisateur${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''} avec succès${errors.length > 0 ? ` (${errors.length} erreur${errors.length > 1 ? 's' : ''})` : ''}`,
              severity: errors.length > 0 ? 'warning' : 'success',
            });
          }
        }}
      />
    </Box>
  );
};