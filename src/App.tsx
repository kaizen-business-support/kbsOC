import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Container, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, Alert, IconButton, Tooltip } from '@mui/material';
import { Lock as LockIcon, Cancel as CancelIcon, Save as SaveIcon } from '@mui/icons-material';
import { AppProvider, useApp } from './contexts/AppContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { ApiService } from './services/api';
import { ThemeWrapper } from './components/ThemeWrapper';
import { MsalWrapper } from './components/MsalWrapper';
import { Header } from './components/Header';
import { Sidebar, FULL_WIDTH, MINI_WIDTH } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { UploadPage } from './pages/UploadPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import ManualInputPage from './pages/ManualInputPage';
import DocumentationPage from './pages/DocumentationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DataInputPage from './pages/DataInputPage';
import { ClientManagementPage } from './pages/ClientManagementPage';
import { CreditScoringPage } from './pages/CreditScoringPage';
import { CreditApplicationPage } from './pages/CreditApplicationPage';
import { WorkflowPage } from './pages/WorkflowPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { BankHolidaysAdminPage } from './pages/BankHolidaysAdminPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ApprovalLimitsPage } from './pages/ApprovalLimitsPage';
import { CreditSimulationPage } from './pages/CreditSimulationPage';
import { CreditTypesPage } from './pages/CreditTypesPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { BackupPage } from './pages/BackupPage';
import AnnouncementsAdminPage from './pages/AnnouncementsAdminPage';
import NotificationsConfigPage from './pages/NotificationsConfigPage';
import { AnnouncementModal, useAnnouncements } from './components/AnnouncementModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// Main App component with context
const AppContent: React.FC = () => {
  const { state, navigateTo, hasAnalysisData, resetSession } = useApp();
  const { state: userState } = useUser();
  const [sidebarOpen, setSidebarOpen] = React.useState(true); // Start open on desktop
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [changePasswordDialog, setChangePasswordDialog] = React.useState({
    open: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = React.useState<{
    text: string;
    severity: 'success' | 'error' | 'info';
  } | null>(null);

  const { announcements, modalOpen, handleClose: handleAnnouncementClose } =
    useAnnouncements(userState.currentUser?.id);

  // Show login page if not authenticated (allow /reset-password without auth)
  if (!userState.isAuthenticated) {
    if (window.location.pathname === '/reset-password') {
      return <ResetPasswordPage />;
    }
    return <LoginPage onLogin={() => {}} />;
  }

  const handlePageChange = (page: any) => {
    navigateTo(page);
    // Only close sidebar on mobile after navigation
    if (window.innerWidth < 900) {
      setSidebarOpen(false);
    }
  };

  const handleResetClick = () => {
    setShowResetDialog(true);
  };

  const handleResetConfirm = () => {
    resetSession();
    setShowResetDialog(false);
  };

  const handleResetCancel = () => {
    setShowResetDialog(false);
  };

  const handleOpenChangePassword = () => {
    setChangePasswordDialog({
      open: true,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordMessage(null);
  };

  const handleChangePassword = async () => {
    if (changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword) {
      setPasswordMessage({
        text: 'Les mots de passe ne correspondent pas',
        severity: 'error'
      });
      return;
    }

    if (changePasswordDialog.newPassword.length < 8) {
      setPasswordMessage({
        text: 'Le mot de passe doit contenir au moins 8 caractères',
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
        setPasswordMessage({
          text: 'Mot de passe modifié avec succès',
          severity: 'success'
        });
        setTimeout(() => {
          setChangePasswordDialog({
            open: false,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
          setPasswordMessage(null);
        }, 2000);
      } else {
        setPasswordMessage({
          text: response.error || 'Erreur lors du changement de mot de passe',
          severity: 'error'
        });
      }
    } catch (error) {
      setPasswordMessage({
        text: 'Erreur lors du changement de mot de passe',
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        currentPage={state.currentPage}
        onReset={handleResetClick}
        onPageChange={handlePageChange}
        onChangePassword={handleOpenChangePassword}
      />
      
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPage={state.currentPage}
        onPageChange={handlePageChange}
        hasAnalysisData={hasAnalysisData()}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          alignSelf: 'flex-start',
          minWidth: 0,
          bgcolor: 'background.default',
          pt: { xs: 7, sm: 8 },
          pl: { xs: 0, md: sidebarOpen ? `${FULL_WIDTH}px` : `${MINI_WIDTH}px` },
          transition: 'padding-left 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          minHeight: '100vh',
          width: '100%',
          overflowX: 'hidden',
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2, md: 3 },
            px: { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          <ErrorBoundary>
            <Routes>
              <Route 
                path="/" 
                element={<HomePage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/configuration" 
                element={<ConfigurationPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/data-input" 
                element={<DataInputPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/upload" 
                element={<UploadPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/manual-input" 
                element={<ManualInputPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/analysis" 
                element={
                  hasAnalysisData() ? (
                    <AnalysisPage onNavigate={handlePageChange} />
                  ) : (
                    <Navigate to="/upload" replace />
                  )
                } 
              />
              <Route 
                path="/reports" 
                element={
                  hasAnalysisData() ? (
                    <ReportsPage onNavigate={handlePageChange} />
                  ) : (
                    <Navigate to="/upload" replace />
                  )
                } 
              />
              <Route 
                path="/settings" 
                element={<SettingsPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/documentation" 
                element={<DocumentationPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/clients" 
                element={<ClientManagementPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/credit-scoring" 
                element={<CreditScoringPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/credit-application" 
                element={<CreditApplicationPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/workflow" 
                element={<WorkflowPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/analytics" 
                element={<AnalyticsDashboardPage />} 
              />
              <Route 
                path="/bank-holidays-admin" 
                element={<BankHolidaysAdminPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/user-management" 
                element={<UserManagementPage onNavigate={handlePageChange} />} 
              />
              <Route 
                path="/approval-limits" 
                element={<ApprovalLimitsPage onNavigate={handlePageChange} />} 
              />
              <Route
                path="/credit-simulation"
                element={<CreditSimulationPage onNavigate={handlePageChange} />}
              />
              <Route
                path="/credit-types"
                element={<CreditTypesPage />}
              />
              <Route
                path="/profile"
                element={<ProfilePage onNavigate={handlePageChange} />}
              />
              <Route
                path="/backup"
                element={<BackupPage />}
              />
              <Route
                path="/announcements"
                element={<AnnouncementsAdminPage />}
              />
              <Route
                path="/notifications-config"
                element={<NotificationsConfigPage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </Container>
      </Box>

      {/* Reset Confirmation Dialog */}
      {/* Announcement Modal */}
      <AnnouncementModal
        open={modalOpen}
        onClose={handleAnnouncementClose}
        announcements={announcements}
      />

      <Dialog open={showResetDialog} onClose={handleResetCancel}>
        <DialogTitle>Réinitialiser la session</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Êtes-vous sûr de vouloir réinitialiser votre session ?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cette action supprimera toutes les données d'analyse, configurations et fichiers uploadés.
            Vous serez redirigé vers la page d'accueil.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetCancel}>
            Annuler
          </Button>
          <Button onClick={handleResetConfirm} variant="contained" color="warning">
            Réinitialiser
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
    </Box>
  );
};

function App() {
  return (
    <MsalWrapper>
      <UserProvider>
        <AppProvider>
          <ThemeWrapper>
            <AppContent />
          </ThemeWrapper>
        </AppProvider>
      </UserProvider>
    </MsalWrapper>
  );
}

export default App;