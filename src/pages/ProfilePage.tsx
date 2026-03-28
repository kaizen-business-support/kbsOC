import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Avatar,
  Grid,
  TextField,
  Button,
  Divider,
  Chip,
  Card,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Lock as LockIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Shield as ShieldIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { ApiService } from '../services/api';
import axios from 'axios';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { tokenManager } from '../services/api';

const API_BASE = `${window.location.origin}/api`;

interface ProfilePageProps {
  onNavigate?: (page: any) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { state: userState, getRoleLabel } = useUser();
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
    phone: userState.currentUser?.phone || '',
  });
  const [changePasswordDialog, setChangePasswordDialog] = useState({
    open: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState<{
    text: string;
    severity: 'success' | 'error' | 'info';
  } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{
    text: string;
    severity: 'success' | 'error' | 'info';
  } | null>(null);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean>(
    (userState.currentUser as any)?.twoFactorEnabled ?? false
  );
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAMessage, setTwoFAMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [backupCodesCount, setBackupCodesCount] = useState<number | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[]>([]);

  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` }
  });

  const handleDisable2FA = async () => {
    setTwoFALoading(true);
    try {
      await axios.post(`${API_BASE}/auth/2fa/disable`, {}, getAuthHeader());
      setTwoFAEnabled(false);
      setTwoFAMessage({ text: '2FA désactivé', severity: 'success' });
    } catch (err: any) {
      setTwoFAMessage({ text: err.response?.data?.error || 'Erreur lors de la désactivation', severity: 'error' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleFetchBackupCodesCount = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/2fa/backup-codes`, getAuthHeader());
      setBackupCodesCount(res.data.count);
    } catch {
      setBackupCodesCount(0);
    }
  };

  const handleRegenBackupCodes = async () => {
    setRegenLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/regenerate-backup-codes`, {}, getAuthHeader());
      setRegenCodes(res.data.backupCodes);
    } catch (err: any) {
      setTwoFAMessage({ text: err.response?.data?.error || 'Erreur', severity: 'error' });
    } finally {
      setRegenLoading(false);
    }
  };

  if (!userState.currentUser) {
    return null;
  }

  const user = userState.currentUser;

  // Generate initials from user name
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Cancel edit - reset data
      setProfileData({
        phone: user.phone || '',
      });
    }
    setEditMode(!editMode);
    setMessage(null);
  };

  const handleSaveProfile = async () => {
    try {
      // Call API to update profile
      const response = await ApiService.updateUserProfile(profileData);

      if (response.success) {
        setMessage({
          text: 'Profil mis à jour avec succès',
          severity: 'success',
        });
        setEditMode(false);
        // Reload user data
        window.location.reload();
      } else {
        setMessage({
          text: response.error || 'Erreur lors de la mise à jour du profil',
          severity: 'error',
        });
      }
    } catch (error) {
      setMessage({
        text: 'Erreur lors de la mise à jour du profil',
        severity: 'error',
      });
    }
  };

  const handleOpenChangePassword = () => {
    setChangePasswordDialog({
      open: true,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordMessage(null);
  };

  const handleChangePassword = async () => {
    if (changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword) {
      setPasswordMessage({
        text: 'Les mots de passe ne correspondent pas',
        severity: 'error',
      });
      return;
    }

    if (changePasswordDialog.newPassword.length < 8) {
      setPasswordMessage({
        text: 'Le mot de passe doit contenir au moins 8 caractères',
        severity: 'error',
      });
      return;
    }

    try {
      const response = await ApiService.changePassword(
        changePasswordDialog.currentPassword,
        changePasswordDialog.newPassword
      );

      if (response.success) {
        setPasswordMessage({
          text: 'Mot de passe modifié avec succès',
          severity: 'success',
        });
        setTimeout(() => {
          setChangePasswordDialog({
            open: false,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          setPasswordMessage(null);
        }, 2000);
      } else {
        setPasswordMessage({
          text: response.error || 'Erreur lors du changement de mot de passe',
          severity: 'error',
        });
      }
    } catch (error) {
      setPasswordMessage({
        text: 'Erreur lors du changement de mot de passe',
        severity: 'error',
      });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Mon Profil
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gérez vos informations personnelles et vos préférences
        </Typography>
      </Box>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Header Card */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    fontSize: '2.5rem',
                    bgcolor: 'primary.main',
                    fontWeight: 600,
                  }}
                >
                  {getUserInitials(user.name)}
                </Avatar>
                <Tooltip title="Changer la photo (à venir)">
                  <IconButton
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: 'background.paper',
                      border: '2px solid',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: 'white',
                      },
                    }}
                    size="small"
                    disabled
                  >
                    <PhotoCameraIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  {user.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {user.email}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<WorkIcon />}
                    label={getRoleLabel(user.role)}
                    color="primary"
                    variant="outlined"
                  />
                  {user.department && (
                    <Chip
                      icon={<BusinessIcon />}
                      label={user.department}
                      variant="outlined"
                    />
                  )}
                  {user.branch && (
                    <Chip label={user.branch} variant="outlined" />
                  )}
                </Box>
              </Box>

              <Box>
                {!editMode ? (
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleEditToggle}
                  >
                    Modifier
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleEditToggle}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveProfile}
                    >
                      Enregistrer
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Personal Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Informations Personnelles
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PersonIcon color="action" />
                    <TextField
                      fullWidth
                      label="Nom complet"
                      value={user.name}
                      disabled
                      variant="standard"
                      helperText="Contactez l'administrateur pour modifier"
                    />
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <EmailIcon color="action" />
                    <TextField
                      fullWidth
                      label="Email"
                      value={user.email}
                      disabled
                      variant="standard"
                      type="email"
                      helperText="Contactez l'administrateur pour modifier"
                    />
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PhoneIcon color="action" />
                    <TextField
                      fullWidth
                      label="Téléphone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!editMode}
                      variant={editMode ? 'outlined' : 'standard'}
                      placeholder="+221 XX XXX XX XX"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Informations Professionnelles
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <WorkIcon color="action" />
                    <TextField
                      fullWidth
                      label="Rôle"
                      value={getRoleLabel(user.role)}
                      disabled
                      variant="standard"
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <BusinessIcon color="action" />
                    <TextField
                      fullWidth
                      label="Département"
                      value={user.department || 'Non assigné'}
                      disabled
                      variant="standard"
                    />
                  </Box>
                </Grid>

                {user.branch && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Agence"
                      value={user.branch}
                      disabled
                      variant="standard"
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Security & Settings */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Sécurité
              </Typography>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={handleOpenChangePassword}
                sx={{ mb: 2 }}
              >
                Changer le mot de passe
              </Button>

              <Divider sx={{ my: 2 }} />

              {/* 2FA section */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ShieldIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Authentification à deux facteurs
                </Typography>
              </Box>

              {twoFAMessage && (
                <Alert severity={twoFAMessage.severity} sx={{ mb: 1 }} onClose={() => setTwoFAMessage(null)}>
                  {twoFAMessage.text}
                </Alert>
              )}

              {twoFAEnabled ? (
                <Box>
                  <Chip label="2FA Activé" color="success" size="small" sx={{ mb: 1 }} />
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleDisable2FA}
                    disabled={twoFALoading}
                    sx={{ mb: 1 }}
                  >
                    {twoFALoading ? <CircularProgress size={18} /> : 'Désactiver le 2FA'}
                  </Button>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<VpnKeyIcon />}
                    onClick={handleRegenBackupCodes}
                    disabled={regenLoading}
                    sx={{ mb: 1 }}
                  >
                    {regenLoading ? <CircularProgress size={18} /> : 'Régénérer les codes de secours'}
                  </Button>

                  {regenCodes.length > 0 && (
                    <Box sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                      <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 0.5 }}>
                        Sauvegardez ces codes :
                      </Typography>
                      {regenCodes.map((c, i) => (
                        <Typography key={i} fontFamily="monospace" variant="caption" display="block">
                          {c}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <Chip label="2FA Désactivé" color="default" size="small" sx={{ mb: 1 }} />
                  {show2FASetup ? (
                    <Box sx={{ mt: 1 }}>
                      <TwoFactorSetup
                        tempToken={tokenManager.getAccessToken() || ''}
                        onComplete={() => {
                          setTwoFAEnabled(true);
                          setShow2FASetup(false);
                          setTwoFAMessage({ text: '2FA activé avec succès !', severity: 'success' });
                        }}
                      />
                    </Box>
                  ) : (
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<ShieldIcon />}
                      onClick={() => setShow2FASetup(true)}
                    >
                      Activer le 2FA
                    </Button>
                  )}
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Dernière connexion:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date().toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Membre depuis:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Date inconnue'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog
        open={changePasswordDialog.open}
        onClose={() =>
          setChangePasswordDialog({
            open: false,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          })
        }
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
          {passwordMessage && (
            <Alert severity={passwordMessage.severity} sx={{ mb: 2 }}>
              {passwordMessage.text}
            </Alert>
          )}
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              type="password"
              label="Mot de passe actuel"
              value={changePasswordDialog.currentPassword}
              onChange={(e) =>
                setChangePasswordDialog({
                  ...changePasswordDialog,
                  currentPassword: e.target.value,
                })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Nouveau mot de passe"
              value={changePasswordDialog.newPassword}
              onChange={(e) =>
                setChangePasswordDialog({
                  ...changePasswordDialog,
                  newPassword: e.target.value,
                })
              }
              helperText="Au moins 8 caractères avec majuscule, minuscule et chiffre"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirmer le nouveau mot de passe"
              value={changePasswordDialog.confirmPassword}
              onChange={(e) =>
                setChangePasswordDialog({
                  ...changePasswordDialog,
                  confirmPassword: e.target.value,
                })
              }
              error={
                changePasswordDialog.confirmPassword !== '' &&
                changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword
              }
              helperText={
                changePasswordDialog.confirmPassword !== '' &&
                changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword
                  ? 'Les mots de passe ne correspondent pas'
                  : ''
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setChangePasswordDialog({
                open: false,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
              })
            }
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
    </Container>
  );
};

export default ProfilePage;
