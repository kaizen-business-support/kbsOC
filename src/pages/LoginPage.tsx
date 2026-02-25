import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Avatar,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Login as LoginIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import optimusIcon from '../assets/Optimus_icon.png';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { tokenManager } from '../services/api';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT || '5007'}/api`;

interface LoginPageProps {
  onLogin: () => void;
}

type LoginStep = 'credentials' | '2fa_code' | '2fa_setup';

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { state, loginWithMicrosoft, clearError, isMsalAvailable, dispatch } = useUser() as any;
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  // 2FA state
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const demoUsers = [
    { email: 'admin@bank.sn', role: 'Administrateur', color: 'error' as const },
    { email: 'direction@bank.sn', role: 'Directeur Général', color: 'info' as const },
    { email: 'moussa.sarr@bank.sn', role: 'Directeur d\'Agence', color: 'success' as const },
    { email: 'amadou.diop@bank.sn', role: 'Chargé d\'Affaires', color: 'primary' as const },
    { email: 'fatou.ndiaye@bank.sn', role: 'Analyste Crédit', color: 'secondary' as const },
    { email: 'comite@bank.sn', role: 'Comité de Crédit', color: 'warning' as const },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispatch) dispatch({ type: 'LOGIN_START' });

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const data = response.data;

      if (data.requiresSetup) {
        // Role forces 2FA and user hasn't configured it yet
        setTempToken(data.tempToken);
        setLoginStep('2fa_setup');
        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      if (data.requires2FA) {
        // 2FA configured — ask for OTP code
        setTempToken(data.tempToken);
        setLoginStep('2fa_code');
        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      // Full login — store tokens and set user
      completeLogin(data.accessToken, data.refreshToken, data.user);
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Erreur de connexion';
      if (dispatch) dispatch({ type: 'LOGIN_FAILURE', payload: msg });
    }
  };

  const handleOtpVerify = async () => {
    setOtpError('');
    setOtpLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/auth/2fa/verify`,
        { token: otpCode },
        { headers: { Authorization: `Bearer ${tempToken}` } }
      );
      completeLogin(response.data.accessToken, response.data.refreshToken, response.data.user);
    } catch (error: any) {
      setOtpError(error.response?.data?.error || 'Code invalide. Réessayez.');
    } finally {
      setOtpLoading(false);
    }
  };

  const completeLogin = (accessToken: string, refreshToken: string, user: any) => {
    tokenManager.setTokens(accessToken, refreshToken);

    const roleMapping: Record<string, string> = {
      'ADMIN': 'admin',
      'MANAGEMENT': 'management',
      'BRANCH_MANAGER': 'branch_manager',
      'ACCOUNT_MANAGER': 'account_manager',
      'CREDIT_ANALYST': 'credit_analyst',
      'CREDIT_COMMITTEE': 'credit_committee'
    };

    const mappedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleMapping[user.role] || 'account_manager',
      department: user.department,
      jobTitle: user.jobTitle,
      permissions: user.permissions,
      lastLogin: new Date(user.lastLogin || Date.now()),
      isActive: true,
      twoFactorEnabled: user.twoFactorEnabled
    };

    if (dispatch) dispatch({ type: 'LOGIN_SUCCESS', payload: mappedUser });
    onLogin();
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
  };

  const handleMicrosoftLogin = async () => {
    const success = await loginWithMicrosoft();
    if (success) onLogin();
  };

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const clearAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  // ── 2FA Setup screen ────────────────────────────────────────────────────────
  if (loginStep === '2fa_setup') {
    return (
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <TwoFactorSetup
          tempToken={tempToken}
          onComplete={completeLogin}
        />
      </Box>
    );
  }

  // ── 2FA Code entry screen ────────────────────────────────────────────────────
  if (loginStep === '2fa_code') {
    return (
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Card sx={{ maxWidth: 440, width: '100%', boxShadow: 6 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <ShieldIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Vérification en deux étapes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Entrez le code à 6 chiffres de votre application d'authentification
              ou l'un de vos codes de secours.
            </Typography>

            {otpError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOtpError('')}>
                {otpError}
              </Alert>
            )}

            <TextField
              label="Code d'authentification"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputProps={{ style: { textAlign: 'center', fontSize: 28, letterSpacing: 8 } }}
              sx={{ mb: 3, width: '100%' }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && otpCode.length >= 6 && handleOtpVerify()}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleOtpVerify}
              disabled={otpCode.length < 6 || otpLoading}
              sx={{ mb: 2 }}
            >
              {otpLoading ? <CircularProgress size={22} /> : 'Vérifier'}
            </Button>

            <Button
              variant="text"
              size="small"
              onClick={() => {
                setLoginStep('credentials');
                setOtpCode('');
                setOtpError('');
                setTempToken('');
              }}
            >
              ← Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ── Normal login screen ──────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)',
        minHeight: '100vh',
        overflowY: 'auto',
        p: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 4 },
      }}
    >
      <Grid container spacing={4} alignItems="center" sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Mini header mobile uniquement */}
        <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', color: 'white', pb: 0 }}>
          <Avatar sx={{ width: 60, height: 60, bgcolor: 'rgba(255,255,255,0.15)', mx: 'auto', mb: 1 }}>
            <img src={optimusIcon} alt="OptimusCredit" style={{ width: 40, height: 40 }} />
          </Avatar>
          <Typography variant="h6" fontWeight={700} gutterBottom>OptimusCredit</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mb: 1 }}>{t('login.platformSubtitle')}</Typography>
        </Grid>

        {/* Left Side - Branding (desktop uniquement) */}
        <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'rgba(255,255,255,0.1)',
                mx: 'auto',
                mb: 4,
              }}
            >
              <img
                src={optimusIcon}
                alt="OptimusCredit Logo"
                style={{ width: '80px', height: '80px' }}
              />
            </Avatar>

            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              {t('login.platformTitle')}
            </Typography>

            <Typography variant="h5" sx={{ mb: 4, opacity: 0.9 }}>
              {t('login.platformSubtitle')}
            </Typography>

            <Typography variant="body1" sx={{ mb: 4, opacity: 0.8, maxWidth: 500, mx: 'auto' }}>
              {t('login.platformDescription')}
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip label={t('login.features.syscohadaCompliance')} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              <Chip label={t('login.features.multiRole')} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              <Chip label={t('login.features.dualScore')} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            </Box>
          </Box>
        </Grid>

        {/* Right Side - Login Form */}
        <Grid item xs={12} md={6}>
          <Card sx={{ maxWidth: 500, mx: 'auto', boxShadow: 6 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <LoginIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                  {t('login.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('login.subtitle')}
                </Typography>
              </Box>

              {state.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {state.error}
                  {state.loginAttempts >= 3 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {t('login.tooManyAttempts')}
                    </Typography>
                  )}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label={t('login.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={state.isLoading}
                    autoComplete="email"
                    inputProps={{ style: { fontSize: 16 } }}
                    InputProps={{
                      startAdornment: <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Box>

                <Box sx={{ mb: 4 }}>
                  <TextField
                    fullWidth
                    label={t('login.password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={state.isLoading}
                    autoComplete="current-password"
                    inputProps={{ style: { fontSize: 16 } }}
                    InputProps={{
                      startAdornment: <LockIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={state.isLoading || state.loginAttempts >= 3}
                  sx={{ mb: 3, py: 1.5 }}
                >
                  {state.isLoading ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      {t('login.connecting')}
                    </>
                  ) : (
                    t('login.connect')
                  )}
                </Button>
              </form>

              {/* Microsoft 365 Login Option */}
              {isMsalAvailable && (
                <>
                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('login.or')}
                    </Typography>
                  </Divider>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={handleMicrosoftLogin}
                    disabled={state.isLoading}
                    sx={{ mb: 3, py: 1.5 }}
                    startIcon={
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iI0YzNTMyNSIvPgo8cmVjdCB4PSIxMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzgxQkM2RiIvPgo8cmVjdCB4PSIxIiB5PSIxMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzA1QTNGNCIvPgo8cmVjdCB4PSIxMSIgeT0iMTEiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiIGZpbGw9IiNGRkI5MDAiLz4KPC9zdmc+"
                        alt="Microsoft"
                        style={{ width: '20px', height: '20px' }}
                      />
                    }
                  >
                    {t('login.microsoftLogin')}
                  </Button>
                </>
              )}

              <Divider sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('login.demonstration')}
                </Typography>
              </Divider>

              <Box sx={{ textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowDemo(!showDemo)}
                  sx={{ mb: 2 }}
                >
                  {showDemo ? t('login.hideDemoAccounts') : t('login.showDemoAccounts')}
                </Button>

                {showDemo && (
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                      {t('login.demoAccountsTitle')}
                    </Typography>
                    <List dense>
                      {demoUsers.map((user) => (
                        <ListItem
                          key={user.email}
                          button
                          onClick={() => handleDemoLogin(user.email)}
                          sx={{
                            borderRadius: 1,
                            mb: 1,
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <ListItemIcon>
                            <PersonIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={user.email}
                            secondary={user.role}
                          />
                          <Chip
                            label={user.role}
                            size="small"
                            color={user.color}
                            variant="outlined"
                          />
                        </ListItem>
                      ))}
                    </List>
                    <Typography variant="caption" color="text.secondary">
                      Cliquez sur un compte pour remplir automatiquement les identifiants
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearAllData}
                  sx={{
                    color: 'warning.main',
                    borderColor: 'warning.main',
                    fontSize: '0.8rem',
                    mb: 1
                  }}
                >
                  🗑️ Clear All Data & Reload
                </Button>
                <Typography variant="caption" display="block" color="text.secondary">
                  If login fails, click above to clear cache
                </Typography>
                {process.env.NODE_ENV === 'development' && (
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    Loading: {state.isLoading.toString()} | Attempts: {state.loginAttempts} | Error: {state.error || 'None'}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
