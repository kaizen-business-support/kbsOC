import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { ApiService } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';

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

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ onNavigate }) => {
  const { hasPermission, isRole } = useUser();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
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
  }, [canViewUserManagement]);

  // Reload data when users change to update counts
  useEffect(() => {
    if (users.length > 0) {
      loadRoles();
      loadDepartments();
      loadBranches();
    }
  }, [users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      console.log('Loading users...');
      const response = await ApiService.getUsers();
      console.log('Users API response:', response);
      if (response.success && response.data) {
        setUsers(response.data || []);
      } else {
        console.error('Failed to load users:', response.error);
        setNotification({
          open: true,
          message: response.error || 'Erreur lors du chargement des utilisateurs',
          severity: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      setNotification({
        open: true,
        message: `Erreur lors du chargement des utilisateurs: ${error.response?.data?.error || error.message || 'Erreur inconnue'}`,
        severity: 'error'
      });
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
        branch: user.branch || 'Siège Social',
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
        branch: 'Siège Social',
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
      branch: 'Siège Social',
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

      // Branch filter
      const branchMatch = !filters.branch || user.branch === filters.branch;

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
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
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
    try {
      if (selectedRole) {
        // Update the role via API
        const response = await ApiService.updateRolePermissions(selectedRole.name, {
          label: roleForm.label,
          description: roleForm.description,
          permissions: roleForm.permissions
        });

        if (response.success) {
          setNotification({
            open: true,
            message: 'Rôle et permissions utilisateurs mis à jour avec succès',
            severity: 'success'
          });

          // Reload users and roles to get updated data
          await loadUsers();
          await loadRoles();
          closeRoleDialog();
        } else {
          setNotification({
            open: true,
            message: response.error || 'Erreur lors de la mise à jour du rôle',
            severity: 'error'
          });
        }
      } else {
        // Note: Role creation is not implemented in the API yet
        // For now, just show a message
        setNotification({
          open: true,
          message: 'La création de nouveaux rôles n\'est pas encore disponible',
          severity: 'warning'
        });
        closeRoleDialog();
      }
    } catch (error) {
      console.error('Error saving role:', error);
      setNotification({
        open: true,
        message: 'Erreur lors de la sauvegarde du rôle',
        severity: 'error'
      });
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
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <PersonIcon />
                  </Avatar>
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
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <BadgeIcon />
                  </Avatar>
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
                  <Avatar sx={{ bgcolor: 'error.main', mr: 2 }}>
                    <AdminIcon />
                  </Avatar>
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
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <GroupIcon />
                  </Avatar>
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
                      {getUniqueOptions('department').map((dept) => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
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
                      {getUniqueOptions('role').map((role) => (
                        <MenuItem key={role} value={role}>
                          {role}
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
                      {getUniqueOptions('branch').map((branch) => (
                        <MenuItem key={branch} value={branch}>
                          {branch}
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
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {user.name}
                            </Typography>
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
                          {user.branch || 'Siège Social'}
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

              <List>
                {departments.map((department) => (
                  <ListItem key={department.id} divider>
                    <ListItemIcon>
                      <DepartmentIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={department.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {department.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {department.userCount} utilisateurs
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="edit"
                        onClick={() => openDepartmentDialog(department)}
                        sx={{ mr: 1 }}
                        disabled={!canEditUserManagement}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => deleteDepartment(department.id)}
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

              <List>
                {branches.map((branch) => (
                  <ListItem key={branch.id} divider>
                    <ListItemIcon>
                      <BranchIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={branch.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {branch.address}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Code: {branch.code} • Responsable: {branch.manager || 'Non assigné'} • {branch.userCount} utilisateurs
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="edit"
                        onClick={() => openBranchDialog(branch)}
                        sx={{ mr: 1 }}
                        disabled={!canEditUserManagement}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => deleteBranch(branch.id)}
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
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={closeEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUser ? 'Modifier l\'Utilisateur' : 'Ajouter un Utilisateur'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom complet"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required={!selectedUser}
                disabled={!!selectedUser || !canEditUserManagement}
                helperText={selectedUser ? "L'email ne peut pas être modifié" : ""}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  label="Rôle"
                  disabled={!canEditUserManagement}
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Département</InputLabel>
                <Select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  label="Département"
                  disabled={!canEditUserManagement}
                >
                  <MenuItem value="">
                    <em>Non spécifié</em>
                  </MenuItem>
                  {getAvailableDepartments().map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Agence</InputLabel>
                <Select
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                  label="Agence"
                  disabled={!canEditUserManagement}
                >
                  <MenuItem value="Siège Social">
                    <em>Siège Social (accès à toutes les agences)</em>
                  </MenuItem>
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.code || branch.name}>
                      {branch.name} {branch.code && `(${branch.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titre du poste"
                value={editForm.jobTitle}
                onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                placeholder="Ex: Responsable Crédit Senior"
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
                  />
                }
                label="Compte actif"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button
            onClick={saveUser}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={
              !canEditUserManagement ||
              !editForm.name.trim() || 
              !editForm.role.trim() || 
              (!selectedUser && !editForm.email.trim())
            }
          >
            {selectedUser ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Department Dialog */}
      <Dialog open={departmentDialogOpen} onClose={closeDepartmentDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedDepartment ? 'Modifier le Département' : 'Ajouter un Département'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
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
        <DialogTitle>
          {selectedRole ? 'Modifier le Rôle' : 'Ajouter un Rôle'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Code du Rôle"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toUpperCase() })}
                required
                placeholder="ex: MANAGER"
                disabled={!canEditUserManagement}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nom d'Affichage"
                value={roleForm.label}
                onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
                required
                placeholder="ex: Gestionnaire"
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
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
              <FormGroup>
                {[
                  'user_management',
                  'view_all',
                  'analytics', 
                  'reports',
                  'view_branch',
                  'approve_credit',
                  'view_own',
                  'create_application',
                  'analyze_credit',
                  'view_applications',
                  'application_review',
                  'committee_vote'
                ].map((permission) => (
                  <FormControlLabel
                    key={permission}
                    control={
                      <Checkbox
                        checked={roleForm.permissions.includes(permission) || roleForm.permissions.includes('*')}
                        disabled={!canEditUserManagement}
                        onChange={(e) => {
                          const allPermissions = [
                            'user_management',
                            'view_all',
                            'analytics', 
                            'reports',
                            'view_branch',
                            'approve_credit',
                            'view_own',
                            'create_application',
                            'analyze_credit',
                            'view_applications',
                            'application_review',
                            'committee_vote'
                          ];
                          
                          if (e.target.checked) {
                            setRoleForm(prev => {
                              // If user has wildcard, convert to explicit permissions and add new one
                              if (prev.permissions.includes('*')) {
                                return {
                                  ...prev,
                                  permissions: allPermissions
                                };
                              }
                              // Add permission if not already present
                              if (!prev.permissions.includes(permission)) {
                                const newPermissions = [...prev.permissions, permission];
                                // If all permissions are selected, use wildcard
                                if (newPermissions.length === allPermissions.length) {
                                  return { ...prev, permissions: ['*'] };
                                }
                                return { ...prev, permissions: newPermissions };
                              }
                              return prev;
                            });
                          } else {
                            setRoleForm(prev => {
                              // If user has wildcard, convert to explicit permissions minus this one
                              if (prev.permissions.includes('*')) {
                                return {
                                  ...prev,
                                  permissions: allPermissions.filter(p => p !== permission)
                                };
                              }
                              // Remove permission
                              return {
                                ...prev,
                                permissions: prev.permissions.filter(p => p !== permission)
                              };
                            });
                          }
                        }}
                      />
                    }
                    label={t(`permissions.${permission}`)}
                  />
                ))}
              </FormGroup>
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
        <DialogTitle>
          {selectedBranch ? 'Modifier l\'Agence' : 'Ajouter une Agence'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
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
                label="Adresse"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                multiline
                rows={2}
                disabled={!canEditUserManagement}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
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
    </Box>
  );
};