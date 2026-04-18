import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, Container, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, Alert, IconButton, Tooltip, LinearProgress } from '@mui/material';
import { Lock as LockIcon, Cancel as CancelIcon, Save as SaveIcon } from '@mui/icons-material';
import { AppProvider, useApp } from './contexts/AppContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { ApiService } from './services/api';
import { ThemeWrapper } from './components/ThemeWrapper';
import { MsalWrapper } from './components/MsalWrapper';
import { Header } from './components/Header';
import { Sidebar, FULL_WIDTH, MINI_WIDTH } from './components/Sidebar';
import { AnnouncementModal, useAnnouncements } from './components/AnnouncementModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DialogHeader } from './components/ui/DialogHeader';
import { SessionTimeoutDialog } from './components/SessionTimeoutDialog';

// ── Lazy-loaded pages (code splitting) ────────────────────────────────────────
// Each page is a separate JS chunk loaded only when first visited.
const HomePage              = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage             = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ResetPasswordPage     = lazy(() => import('./pages/ResetPasswordPage'));
const UploadPage            = lazy(() => import('./pages/UploadPage').then(m => ({ default: m.UploadPage })));
const AnalysisPage          = lazy(() => import('./pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })));
const ReportsPage           = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage          = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ManualInputPage       = lazy(() => import('./pages/ManualInputPage'));
const DocumentationPage     = lazy(() => import('./pages/DocumentationPage'));
const ConfigurationPage     = lazy(() => import('./pages/ConfigurationPage'));
const DataInputPage         = lazy(() => import('./pages/DataInputPage'));
const ClientManagementPage  = lazy(() => import('./pages/ClientManagementPage').then(m => ({ default: m.ClientManagementPage })));
const CreditScoringPage     = lazy(() => import('./pages/CreditScoringPage').then(m => ({ default: m.CreditScoringPage })));
const CreditApplicationPage = lazy(() => import('./pages/CreditApplicationPage').then(m => ({ default: m.CreditApplicationPage })));
const WorkflowPage          = lazy(() => import('./pages/WorkflowPage').then(m => ({ default: m.WorkflowPage })));
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage').then(m => ({ default: m.AnalyticsDashboardPage })));
const BankHolidaysAdminPage  = lazy(() => import('./pages/BankHolidaysAdminPage').then(m => ({ default: m.BankHolidaysAdminPage })));
const UserManagementPage    = lazy(() => import('./pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const CreditSimulationPage  = lazy(() => import('./pages/CreditSimulationPage').then(m => ({ default: m.CreditSimulationPage })));
const ProfilePage           = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const BackupPage            = lazy(() => import('./pages/BackupPage').then(m => ({ default: m.BackupPage })));
const AnnouncementsAdminPage = lazy(() => import('./pages/AnnouncementsAdminPage'));
const NotificationsConfigPage = lazy(() => import('./pages/NotificationsConfigPage'));
const DispatchingPage        = lazy(() => import('./pages/DispatchingPage').then(m => ({ default: m.DispatchingPage })));
const CreditManagementPage   = lazy(() => import('./pages/CreditManagementPage').then(m => ({ default: m.CreditManagementPage })));
const CompanySettingsPage    = lazy(() => import('./pages/CompanySettingsPage'));
const PlatformAdminPage      = lazy(() => import('./pages/PlatformAdminPage'));

// ── Thin branded progress bar while chunk loads ────────────────────────────
const PageLoader = () => (
  <LinearProgress
    sx={{
      position:   'fixed',
      top:        0, left: 0, right: 0,
      zIndex:     9999,
      height:     '2.5px',
      background: 'rgba(58,86,168,0.12)',
      '& .MuiLinearProgress-bar': {
        background: 'linear-gradient(90deg, #3A56A8 0%, #2878C8 50%, #28A8E2 100%)',
      },
    }}
  />
);

// ── Scroll-to-top on every route change ────────────────────────────────────
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
};

// ── Page transition wrapper — re-animates on each route change ─────────────
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <Box
      key={pathname}
      className="page-enter"
      sx={{ width: '100%', willChange: 'opacity, transform' }}
    >
      {children}
    </Box>
  );
};

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
      return <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>;
    }
    return <Suspense fallback={<PageLoader />}><LoginPage onLogin={() => {}} /></Suspense>;
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
          flexGrow:   1,
          alignSelf:  'flex-start',
          minWidth:   0,
          bgcolor:    'transparent',
          pt:         { xs: 7, sm: 8 },
          pl:         { xs: 0, md: sidebarOpen ? `${FULL_WIDTH}px` : `${MINI_WIDTH}px` },
          transition: 'padding-left 0.25s cubic-bezier(0.22,1,0.36,1)',
          minHeight:  '100vh',
          width:      '100%',
          overflowX:  'hidden',
        }}
      >
        <ScrollToTop />
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2, md: 3 },
            px: { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <PageTransition>
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
                path="/credit-types"
                element={<CreditManagementPage initialTab={0} onNavigate={handlePageChange} />}
              />
              <Route
                path="/credit-simulation"
                element={<CreditSimulationPage onNavigate={handlePageChange} />}
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
              <Route
                path="/dispatching"
                element={<DispatchingPage />}
              />
              <Route
                path="/credit-policy"
                element={<CreditManagementPage initialTab={1} onNavigate={handlePageChange} />}
              />
              <Route
                path="/approval-limits"
                element={<CreditManagementPage initialTab={2} onNavigate={handlePageChange} />}
              />
              <Route
                path="/company-settings"
                element={<CompanySettingsPage />}
              />
              <Route
                path="/platform-admin"
                element={<PlatformAdminPage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </Container>
      </Box>

      {/* Session timeout — avertissement 2 min avant, déconnexion auto à 15 min */}
      <SessionTimeoutDialog />

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
        <DialogHeader
          title="Changer mon mot de passe"
          icon={<LockIcon sx={{ fontSize: 17 }} />}
          onClose={() => setChangePasswordDialog({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}
        />
        <DialogContent>
          {passwordMessage && (
            <Alert severity={passwordMessage.severity} sx={{ mb: 1.5 }}>
              {passwordMessage.text}
            </Alert>
          )}
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Mot de passe actuel"
            value={changePasswordDialog.currentPassword}
            onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, currentPassword: e.target.value })}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Nouveau mot de passe"
            value={changePasswordDialog.newPassword}
            onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, newPassword: e.target.value })}
            helperText="Au moins 8 caractères avec majuscule, minuscule et chiffre"
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Confirmer le nouveau mot de passe"
            value={changePasswordDialog.confirmPassword}
            onChange={(e) => setChangePasswordDialog({ ...changePasswordDialog, confirmPassword: e.target.value })}
            error={changePasswordDialog.confirmPassword !== '' && changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword}
            helperText={changePasswordDialog.confirmPassword !== '' && changePasswordDialog.newPassword !== changePasswordDialog.confirmPassword ? 'Les mots de passe ne correspondent pas' : ''}
          />
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
      <CompanyProvider>
        <UserProvider>
          <AppProvider>
            <ThemeWrapper>
              <AppContent />
            </ThemeWrapper>
          </AppProvider>
        </UserProvider>
      </CompanyProvider>
    </MsalWrapper>
  );
}

export default App;