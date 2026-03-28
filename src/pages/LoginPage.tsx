import React, { useState, useEffect } from 'react';
import {
  Box,
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
  InputAdornment,
  IconButton,
  Collapse,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import {
  Login as LoginIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Shield as ShieldIcon,
  LockReset as LockResetIcon,
  Visibility,
  VisibilityOff,
  CheckCircleOutline as CheckIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  AccountTreeOutlined,
  InsightsOutlined,
  GroupsOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import optimusIcon from '../assets/Optimus_icon.png';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { tokenManager, authPasswordApi } from '../services/api';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT || '5007'}/api`;

// ─── Keyframes ────────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeInRight = keyframes`
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const fadeInLeft = keyframes`
  from { opacity: 0; transform: translateX(-32px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
`;

const floatY = keyframes`
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-12px); }
`;

const pulseDot = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
  50%       { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
`;

const rotateGlow = keyframes`
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAVY  = '#0d2137';
const BLUE  = '#1f4e79';
const BLUE2 = '#2e6da4';
const WHITE = '#ffffff';

const anim = (
  name: ReturnType<typeof keyframes>,
  dur = '0.55s',
  delay = '0s'
) => `${name} ${dur} cubic-bezier(0.22, 1, 0.36, 1) ${delay} both`;

// ─── Shared overlay layout ────────────────────────────────────────────────────

const OverlayBg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{
    background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 55%, ${BLUE2} 100%)`,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 3,
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Background decorative blobs */}
    <Box sx={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
    <Box sx={{ position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
    <Box sx={{ position: 'absolute', top: '40%', left: '20%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', pointerEvents: 'none' }} />
    {children}
  </Box>
);

// ─── Glass card ───────────────────────────────────────────────────────────────

const GlassCard: React.FC<{ children: React.ReactNode; maxWidth?: number; animDelay?: string }> = ({
  children, maxWidth = 460, animDelay = '0s'
}) => (
  <Box sx={{
    maxWidth, width: '100%',
    background: WHITE,
    borderRadius: '24px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 2px 0 rgba(255,255,255,0.1) inset',
    border: '1px solid rgba(255,255,255,0.12)',
    p: { xs: 3, sm: 4.5 },
    animation: anim(fadeInScale, '0.55s', animDelay),
  }}>
    {children}
  </Box>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface LoginPageProps {
  onLogin: () => void;
}

type LoginStep = 'credentials' | '2fa_code' | '2fa_setup' | 'change_password' | 'forgot_password';

// ─── Component ────────────────────────────────────────────────────────────────

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { state, loginWithMicrosoft, clearError, isMsalAvailable, dispatch } = useUser() as any;
  const { t } = useTranslation();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode]   = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showNewPassword,  setShowNewPassword]  = useState(false);
  const [changePasswordError,   setChangePasswordError]   = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotSent,    setForgotSent]    = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState('');

  const demoUsers = [
    { email: 'admin@bank.sn',          role: 'Administrateur',       color: 'error'     as const },
    { email: 'direction@bank.sn',       role: 'Directeur Général',    color: 'info'      as const },
    { email: 'moussa.sarr@bank.sn',    role: 'Directeur d\'Agence',  color: 'success'   as const },
    { email: 'amadou.diop@bank.sn',    role: 'Chargé d\'Affaires',   color: 'primary'   as const },
    { email: 'resp.analyste@bank.sn',  role: 'Responsable Analyste', color: 'secondary' as const },
    { email: 'fatou.ndiaye@bank.sn',   role: 'Analyste Crédit',      color: 'secondary' as const },
    { email: 'comite@bank.sn',         role: 'Comité de Crédit',     color: 'warning'   as const },
  ];

  const features = [
    { icon: GroupsOutlined,       label: 'Gestion clientèle corporative' },
    { icon: InsightsOutlined,     label: 'Analyse financière SYSCOHADA' },
    { icon: AccountTreeOutlined,  label: 'Workflow d\'approbation multi-niveaux' },
    { icon: VerifiedUserOutlined, label: 'Score dual & benchmark sectoriel' },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispatch) dispatch({ type: 'LOGIN_START' });
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const data = response.data;
      if (data.requiresPasswordChange) { setTempToken(data.tempToken); setLoginStep('change_password'); if (dispatch) dispatch({ type: 'SET_LOADING', payload: false }); return; }
      if (data.requiresSetup)          { setTempToken(data.tempToken); setLoginStep('2fa_setup');        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false }); return; }
      if (data.requires2FA)            { setTempToken(data.tempToken); setLoginStep('2fa_code');          if (dispatch) dispatch({ type: 'SET_LOADING', payload: false }); return; }
      completeLogin(data.accessToken, data.refreshToken, data.user);
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Erreur de connexion';
      if (dispatch) dispatch({ type: 'LOGIN_FAILURE', payload: msg });
    }
  };

  const handleOtpVerify = async () => {
    setOtpError(''); setOtpLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/2fa/verify`, { token: otpCode }, { headers: { Authorization: `Bearer ${tempToken}` } });
      completeLogin(response.data.accessToken, response.data.refreshToken, response.data.user);
    } catch (error: any) {
      setOtpError(error.response?.data?.error || 'Code invalide. Réessayez.');
    } finally {
      setOtpLoading(false);
    }
  };

  const completeLogin = (accessToken: string, refreshToken: string, user: any) => {
    tokenManager.setTokens(accessToken, refreshToken);
    const roleMapping: Record<string, string> = { ADMIN: 'admin', MANAGEMENT: 'management', BRANCH_MANAGER: 'branch_manager', ACCOUNT_MANAGER: 'account_manager', CREDIT_ANALYST: 'credit_analyst', CREDIT_COMMITTEE: 'credit_committee' };
    if (dispatch) dispatch({ type: 'LOGIN_SUCCESS', payload: { id: user.id, email: user.email, name: user.name, role: roleMapping[user.role] || 'account_manager', department: user.department, jobTitle: user.jobTitle, permissions: user.permissions, lastLogin: new Date(user.lastLogin || Date.now()), isActive: true, twoFactorEnabled: user.twoFactorEnabled } });
    onLogin();
  };

  const handleForceChangePassword = async () => {
    setChangePasswordError('');
    if (newPassword.length < 8)          { setChangePasswordError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (newPassword !== confirmPassword) { setChangePasswordError('Les mots de passe ne correspondent pas.'); return; }
    setChangePasswordLoading(true);
    try {
      const data = await authPasswordApi.changePasswordForced(tempToken, newPassword);
      completeLogin(data.accessToken, data.refreshToken, data.user);
    } catch (error: any) {
      setChangePasswordError(error.response?.data?.error || 'Erreur lors du changement de mot de passe.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('Veuillez saisir votre adresse email.'); return; }
    setForgotLoading(true);
    try {
      await authPasswordApi.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setShowDemo(false);
  };

  const handleMicrosoftLogin = async () => {
    const success = await loginWithMicrosoft();
    if (success) onLogin();
  };

  useEffect(() => { return () => clearError(); }, [clearError]);

  const clearAllData = () => { localStorage.clear(); window.location.reload(); };

  // ── 2FA Setup ───────────────────────────────────────────────────────────────
  if (loginStep === '2fa_setup') {
    return (
      <OverlayBg>
        <TwoFactorSetup tempToken={tempToken} onComplete={completeLogin} />
      </OverlayBg>
    );
  }

  // ── 2FA Code ─────────────────────────────────────────────────────────────────
  if (loginStep === '2fa_code') {
    return (
      <OverlayBg>
        <GlassCard maxWidth={420}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '20px', mx: 'auto', mb: 2.5,
              background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            }}>
              <ShieldIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1e293b', mb: 0.5 }}>
              Vérification 2FA
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
              Entrez le code à 6 chiffres de votre application d'authentification ou l'un de vos codes de secours.
            </Typography>
          </Box>

          {otpError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setOtpError('')}>{otpError}</Alert>}

          <TextField
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputProps={{ style: { textAlign: 'center', fontSize: 32, letterSpacing: 10, fontWeight: 700 }, maxLength: 8 }}
            sx={{
              mb: 3, width: '100%',
              '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: '#f8fafc' },
            }}
            autoFocus
            placeholder="• • • • • •"
            onKeyDown={(e) => e.key === 'Enter' && otpCode.length >= 6 && handleOtpVerify()}
          />

          <Button
            variant="contained" fullWidth size="large"
            onClick={handleOtpVerify}
            disabled={otpCode.length < 6 || otpLoading}
            sx={{
              mb: 2, py: 1.5, borderRadius: '14px', fontWeight: 700, fontSize: '1rem',
              background: `linear-gradient(135deg, ${BLUE}, ${BLUE2})`,
              boxShadow: '0 4px 16px rgba(31,78,121,0.35)',
              '&:hover': { boxShadow: '0 6px 24px rgba(31,78,121,0.45)', transform: 'translateY(-1px)' },
              transition: 'all 0.2s ease',
            }}
          >
            {otpLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Vérifier'}
          </Button>

          <Button
            variant="text" fullWidth size="small"
            onClick={() => { setLoginStep('credentials'); setOtpCode(''); setOtpError(''); setTempToken(''); }}
            sx={{ color: '#64748b', '&:hover': { color: BLUE } }}
          >
            ← Retour à la connexion
          </Button>
        </GlassCard>
      </OverlayBg>
    );
  }

  // ── Change password ──────────────────────────────────────────────────────────
  if (loginStep === 'change_password') {
    return (
      <OverlayBg>
        <GlassCard maxWidth={460}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '20px', mx: 'auto', mb: 2.5,
              background: 'linear-gradient(135deg, #92400e, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
            }}>
              <LockResetIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1e293b', mb: 0.5 }}>
              Nouveau mot de passe requis
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
              Pour des raisons de sécurité, définissez un nouveau mot de passe avant de continuer.
            </Typography>
          </Box>

          {changePasswordError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setChangePasswordError('')}>{changePasswordError}</Alert>}

          <TextField
            label="Nouveau mot de passe"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNewPassword(v => !v)} edge="end" size="small">
                    {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <TextField
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            onKeyDown={(e) => e.key === 'Enter' && handleForceChangePassword()}
          />

          <Button
            variant="contained" fullWidth size="large"
            onClick={handleForceChangePassword}
            disabled={!newPassword || !confirmPassword || changePasswordLoading}
            sx={{
              py: 1.5, borderRadius: '14px', fontWeight: 700,
              background: `linear-gradient(135deg, ${BLUE}, ${BLUE2})`,
              boxShadow: '0 4px 16px rgba(31,78,121,0.35)',
              '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 24px rgba(31,78,121,0.45)' },
              transition: 'all 0.2s ease',
            }}
          >
            {changePasswordLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Définir mon mot de passe'}
          </Button>
        </GlassCard>
      </OverlayBg>
    );
  }

  // ── Forgot password ──────────────────────────────────────────────────────────
  if (loginStep === 'forgot_password') {
    return (
      <OverlayBg>
        <GlassCard maxWidth={440}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '20px', mx: 'auto', mb: 2.5,
              background: 'linear-gradient(135deg, #1d4ed8, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
            }}>
              <EmailIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1e293b', mb: 0.5 }}>
              Mot de passe oublié
            </Typography>
          </Box>

          {forgotSent ? (
            <>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
                Si cet email est associé à un compte actif, un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte mail et vos spams.
              </Alert>
              <Button
                variant="outlined" fullWidth
                onClick={() => { setLoginStep('credentials'); setForgotSent(false); setForgotEmail(''); }}
                sx={{ borderRadius: '14px', borderColor: BLUE, color: BLUE, fontWeight: 600 }}
              >
                ← Retour à la connexion
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 3, textAlign: 'center', lineHeight: 1.6 }}>
                Saisissez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </Typography>

              {forgotError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setForgotError('')}>{forgotError}</Alert>}

              <TextField
                label="Adresse email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                fullWidth sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: '#94a3b8', fontSize: 20 }} /></InputAdornment>
                }}
              />

              <Button
                variant="contained" fullWidth size="large"
                onClick={handleForgotPassword}
                disabled={!forgotEmail.trim() || forgotLoading}
                sx={{
                  mb: 2, py: 1.5, borderRadius: '14px', fontWeight: 700,
                  background: `linear-gradient(135deg, ${BLUE}, ${BLUE2})`,
                  boxShadow: '0 4px 16px rgba(31,78,121,0.35)',
                  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 24px rgba(31,78,121,0.45)' },
                  transition: 'all 0.2s ease',
                }}
              >
                {forgotLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Envoyer le lien'}
              </Button>

              <Button
                variant="text" fullWidth size="small"
                onClick={() => { setLoginStep('credentials'); setForgotError(''); }}
                sx={{ color: '#64748b', '&:hover': { color: BLUE } }}
              >
                ← Retour à la connexion
              </Button>
            </>
          )}
        </GlassCard>
      </OverlayBg>
    );
  }

  // ── Main login screen ────────────────────────────────────────────────────────
  return (
    <Box sx={{
      background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 55%, ${BLUE2} 100%)`,
      minHeight: '100vh',
      overflowY: 'auto',
      position: 'relative',
    }}>
      {/* Decorative blobs */}
      <Box sx={{ position: 'absolute', top: -120, right: -120, width: 480, height: 480, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', top: '30%', right: '25%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.025)', pointerEvents: 'none' }} />

      <Grid
        container
        sx={{ maxWidth: 1200, mx: 'auto', minHeight: '100vh', px: { xs: 2, md: 4 } }}
        alignItems="center"
      >
        {/* ── Mobile header ── */}
        <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', pt: 5, pb: 3 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: '20px', mb: 2,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
            animation: anim(fadeInScale, '0.55s', '0s'),
          }}>
            <img src={optimusIcon} alt="OptimusCredit" style={{ width: 46, height: 46 }} />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: WHITE, animation: anim(fadeInUp, '0.5s', '0.1s') }}>
            OptimusCredit
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', animation: anim(fadeInUp, '0.5s', '0.18s') }}>
            {t('login.platformSubtitle')}
          </Typography>
        </Grid>

        {/* ── Left branding (desktop) ── */}
        <Grid item md={6} sx={{ display: { xs: 'none', md: 'block' }, pr: 4 }}>
          {/* Floating logo */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 2.5, mb: 5,
            animation: anim(fadeInLeft, '0.6s', '0s'),
          }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '18px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `${floatY} 4s ease-in-out infinite`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            }}>
              <img src={optimusIcon} alt="OptimusCredit" style={{ width: 42, height: 42 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: WHITE, lineHeight: 1.1 }}>
                OptimusCredit
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>
                Gestion de Crédit Professionnelle
              </Typography>
            </Box>
          </Box>

          {/* Main headline */}
          <Typography
            variant="h3"
            fontWeight={800}
            sx={{
              color: WHITE, lineHeight: 1.15, mb: 2,
              animation: anim(fadeInLeft, '0.6s', '0.1s'),
            }}
          >
            Votre plateforme
            <Box component="span" sx={{
              display: 'block',
              background: 'linear-gradient(90deg, #93c5fd, #c4b5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              de crédit bancaire
            </Box>
          </Typography>

          <Typography variant="body1" sx={{
            color: 'rgba(255,255,255,0.72)', mb: 5, lineHeight: 1.75, maxWidth: 440,
            animation: anim(fadeInLeft, '0.6s', '0.18s'),
          }}>
            {t('login.platformDescription')}
          </Typography>

          {/* Feature list */}
          <Box sx={{ animation: anim(fadeInLeft, '0.6s', '0.26s') }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Box
                  key={i}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2, mb: 2,
                    animation: anim(fadeInLeft, '0.5s', `${0.3 + i * 0.08}s`),
                  }}
                >
                  <Box sx={{
                    width: 38, height: 38, borderRadius: '10px',
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon sx={{ color: '#93c5fd', fontSize: 20 }} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                    {f.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Tags */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 4, animation: anim(fadeInLeft, '0.6s', '0.55s') }}>
            {['SYSCOHADA', 'Bilingue', 'Multi-rôles', 'Score Dual'].map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.73rem' }}
              />
            ))}
          </Box>
        </Grid>

        {/* ── Right side: login form ── */}
        <Grid item xs={12} md={6} sx={{ py: { xs: 0, md: 5 }, pb: { xs: 5, md: 5 } }}>
          <Box sx={{
            maxWidth: 480, mx: 'auto',
            animation: anim(fadeInRight, '0.6s', '0.1s'),
          }}>
            {/* Card */}
            <Box sx={{
              bgcolor: WHITE,
              borderRadius: '24px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
              p: { xs: 3, sm: 4.5 },
            }}>
              {/* Header */}
              <Box sx={{ textAlign: 'center', mb: 3.5 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
                  background: `linear-gradient(135deg, ${BLUE}, ${BLUE2})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(31,78,121,0.35)',
                }}>
                  <LoginIcon sx={{ color: WHITE, fontSize: 28 }} />
                </Box>
                <Typography variant="h5" fontWeight={700} sx={{ color: '#1e293b', mb: 0.5 }}>
                  {t('login.title')}
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  {t('login.subtitle')}
                </Typography>
              </Box>

              {state.error && (
                <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                  {state.error}
                  {state.loginAttempts >= 3 && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{t('login.tooManyAttempts')}</Typography>
                  )}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth label={t('login.email')} type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required disabled={state.isLoading}
                  autoComplete="email"
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: '#f8fafc' },
                    '& .MuiOutlinedInput-root.Mui-focused': { bgcolor: WHITE },
                  }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: '#94a3b8', fontSize: 20 }} /></InputAdornment> }}
                />

                <TextField
                  fullWidth label={t('login.password')} type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required disabled={state.isLoading}
                  autoComplete="current-password"
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: '#f8fafc' },
                    '& .MuiOutlinedInput-root.Mui-focused': { bgcolor: WHITE },
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#94a3b8', fontSize: 20 }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(v => !v)} edge="end" size="small">
                          {showPassword ? <VisibilityOff fontSize="small" sx={{ color: '#94a3b8' }} /> : <Visibility fontSize="small" sx={{ color: '#94a3b8' }} />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Box sx={{ textAlign: 'right', mb: 2.5 }}>
                  <Button
                    variant="text" size="small"
                    onClick={() => { setLoginStep('forgot_password'); setForgotEmail(email); }}
                    sx={{ textTransform: 'none', fontSize: 13, color: BLUE2, p: '2px 4px' }}
                  >
                    Mot de passe oublié ?
                  </Button>
                </Box>

                <Button
                  type="submit" fullWidth variant="contained" size="large"
                  disabled={state.isLoading || state.loginAttempts >= 3}
                  sx={{
                    mb: 2.5, py: 1.5, borderRadius: '14px',
                    fontWeight: 700, fontSize: '1rem',
                    background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE2} 100%)`,
                    boxShadow: '0 4px 16px rgba(31,78,121,0.35)',
                    '&:hover': {
                      background: `linear-gradient(135deg, #163d61, ${BLUE})`,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 28px rgba(31,78,121,0.45)',
                    },
                    '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none', transform: 'none' },
                    transition: 'all 0.25s ease',
                  }}
                >
                  {state.isLoading
                    ? <><CircularProgress size={20} sx={{ mr: 1, color: WHITE }} />{t('login.connecting')}</>
                    : t('login.connect')
                  }
                </Button>
              </form>

              {/* Microsoft login */}
              {isMsalAvailable && (
                <>
                  <Divider sx={{ my: 2.5 }}><Typography variant="caption" sx={{ color: '#94a3b8', px: 1 }}>ou</Typography></Divider>
                  <Button
                    fullWidth variant="outlined" size="large"
                    onClick={handleMicrosoftLogin}
                    disabled={state.isLoading}
                    sx={{
                      mb: 2.5, py: 1.4, borderRadius: '14px', fontWeight: 600,
                      borderColor: '#e2e8f0', color: '#374151',
                      '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                    }}
                    startIcon={
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iI0YzNTMyNSIvPgo8cmVjdCB4PSIxMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzgxQkM2RiIvPgo8cmVjdCB4PSIxIiB5PSIxMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzA1QTNGNCIvPgo8cmVjdCB4PSIxMSIgeT0iMTEiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiIGZpbGw9IiNGRkI5MDAiLz4KPC9zdmc+"
                        alt="Microsoft" style={{ width: 20, height: 20 }}
                      />
                    }
                  >
                    {t('login.microsoftLogin')}
                  </Button>
                </>
              )}

              {/* Demo accounts */}
              <Divider sx={{ my: 2 }}><Typography variant="caption" sx={{ color: '#cbd5e1', px: 1 }}>{t('login.demonstration')}</Typography></Divider>

              <Button
                fullWidth variant="text" size="small"
                onClick={() => setShowDemo(!showDemo)}
                endIcon={showDemo ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600, mb: 1, borderRadius: '10px', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                {showDemo ? t('login.hideDemoAccounts') : t('login.showDemoAccounts')}
              </Button>

              <Collapse in={showDemo}>
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1, px: 1 }}>
                    Mot de passe : <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>demo123</code> pour tous les comptes
                  </Typography>
                  <List dense disablePadding>
                    {demoUsers.map((user) => (
                      <ListItem
                        key={user.email}
                        button
                        onClick={() => handleDemoLogin(user.email)}
                        sx={{
                          borderRadius: '10px', mb: 0.5, py: 0.75,
                          '&:hover': { bgcolor: 'rgba(31,78,121,0.06)' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(31,78,121,0.1)', color: BLUE, fontSize: '0.75rem' }}>
                            <PersonIcon sx={{ fontSize: 14 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={user.email}
                          secondary={user.role}
                          primaryTypographyProps={{ fontSize: '12.5px', color: '#374151', fontWeight: 500 }}
                          secondaryTypographyProps={{ fontSize: '11px', color: '#94a3b8' }}
                        />
                        <Chip label={user.role} size="small" color={user.color} variant="outlined" sx={{ fontSize: '10px', height: 20 }} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Collapse>

              {/* Dev clear cache */}
              {process.env.NODE_ENV === 'development' && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button
                    variant="text" size="small" onClick={clearAllData}
                    sx={{ color: '#f59e0b', textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    🗑️ Clear cache & reload (dev)
                  </Button>
                </Box>
              )}
            </Box>

            {/* Footer */}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(255,255,255,0.35)', mt: 2.5 }}>
              © 2025 OptimusCredit — Tous droits réservés
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoginPage;
