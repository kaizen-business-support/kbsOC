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
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Shield as ShieldIcon,
  LockReset as LockResetIcon,
  Visibility,
  VisibilityOff,
  KeyboardArrowDown,
  KeyboardArrowUp,
  AccountTreeOutlined,
  InsightsOutlined,
  GroupsOutlined,
  VerifiedUserOutlined,
  ArrowForward,
} from '@mui/icons-material';
import { useUser } from '../contexts/UserContext';
import { useCompany } from '../contexts/CompanyContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import optimusIcon from '../assets/Optimus_icon.png';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import CompanySelector from '../components/CompanySelector';
import { tokenManager, authPasswordApi, ApiService } from '../services/api';
import { CompanyWithRole } from '../types';

const API_BASE = `${window.location.origin}/api`;

// ─── Keyframes ────────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeInLeft = keyframes`
  from { opacity: 0; transform: translateX(-32px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const fadeInRight = keyframes`
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
`;

// ─── Tokens (Light Concept Theme) ─────────────────────────────────────────────

const BG_GRADIENT = 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)';
const BRAND_PRIMARY = '#0F172A'; // Very dark blue/black
const BRAND_SECONDARY = '#1F4E79'; // Deep Trust Blue
const BRAND_ACCENT = '#3B82F6';
const WHITE = '#ffffff';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const BORDER_COLOR = '#E2E8F0';

const anim = (name: ReturnType<typeof keyframes>, dur = '0.7s', delay = '0s') =>
  `${name} ${dur} cubic-bezier(0.22, 1, 0.36, 1) ${delay} both`;

// ─── Shared overlay layout ────────────────────────────────────────────────────

const OverlayBg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{
    background: BG_GRADIENT,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 3,
    position: 'relative',
    overflow: 'hidden',
  }}>
    <Box sx={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
      {children}
    </Box>
  </Box>
);

// ─── Glass card ───────────────────────────────────────────────────────────────

const GlassCard: React.FC<{ children: React.ReactNode; maxWidth?: number; animDelay?: string }> = ({
  children, maxWidth = 460, animDelay = '0s'
}) => (
  <Box sx={{
    maxWidth, width: '100%',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
    border: `1px solid rgba(255,255,255,0.9)`,
    p: { xs: 3.5, sm: 5 },
    animation: anim(fadeInScale, '0.6s', animDelay),
  }}>
    {children}
  </Box>
);

// ─── Styled TextField ─────────────────────────────────────────────────────────

const StyledTextField = (props: any) => (
  <TextField
    {...props}
    sx={{
      mb: 2.5,
      '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        bgcolor: WHITE,
        color: TEXT_PRIMARY,
        transition: 'all 0.2s ease',
        '& fieldset': { borderColor: BORDER_COLOR, borderWidth: '1px' },
        '&:hover fieldset': { borderColor: '#CBD5E1' },
        '&.Mui-focused fieldset': { 
          borderColor: BRAND_SECONDARY, 
          borderWidth: '2px',
        },
        '&.Mui-disabled': { opacity: 0.6, bgcolor: '#F1F5F9' },
      },
      '& .MuiInputLabel-root': { color: TEXT_SECONDARY },
      '& .MuiInputLabel-root.Mui-focused': { color: BRAND_SECONDARY, fontWeight: 600 },
      ...props.sx,
    }}
  />
);

// ─── Styled Button ────────────────────────────────────────────────────────────

const GradientButton = (props: any) => (
  <Button
    {...props}
    sx={{
      py: 1.5,
      borderRadius: '14px',
      fontWeight: 600,
      fontSize: '1.05rem',
      background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%)`,
      color: WHITE,
      boxShadow: `0 10px 20px -5px rgba(15, 23, 42, 0.3)`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      textTransform: 'none',
      '&:hover': {
        background: `linear-gradient(135deg, #000000 0%, ${BRAND_PRIMARY} 100%)`,
        transform: 'translateY(-1px)',
        boxShadow: `0 15px 25px -5px rgba(15, 23, 42, 0.4)`,
      },
      '&:disabled': {
        background: '#CBD5E1',
        color: '#F8FAFC',
        boxShadow: 'none',
        transform: 'none'
      },
      ...props.sx,
    }}
  />
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface LoginPageProps {
  onLogin: () => void;
}

type LoginStep = 'credentials' | '2fa_code' | '2fa_setup' | 'change_password' | 'forgot_password';

// ─── Component ────────────────────────────────────────────────────────────────

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { state, loginWithMicrosoft, clearError, isMsalAvailable, dispatch } = useUser() as any;
  const companyCtx = useCompany();
  const navigate = useNavigate();
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

  const [showCompanySelector, setShowCompanySelector] = useState(false);
  const [partialToken, setPartialToken] = useState('');
  const [companyOptions, setCompanyOptions] = useState<CompanyWithRole[]>([]);

  // Le compte Super Admin Plateforme est volontairement masqué de la liste démo
  // pour ne pas exposer un point d'entrée privilégié sur l'écran de connexion publique.
  // Il reste accessible en saisissant manuellement l'email + mot de passe.
  const demoUsers = [
    { email: 'admin@bci.sn',               role: 'Administrateur BCI',        color: 'error'     as const, password: 'Demo2024!' },
    { email: 'dg@bci.sn',                  role: 'Direction Générale',        color: 'info'      as const, password: 'Demo2024!' },
    { email: 'comite@bci.sn',              role: 'Comité de Crédit',          color: 'warning'   as const, password: 'Demo2024!' },
    { email: 'resp.risques@bci.sn',        role: 'Responsable Risques',       color: 'secondary' as const, password: 'Demo2024!' },
    { email: 'resp.eng@bci.sn',            role: 'Responsable Engagements',   color: 'secondary' as const, password: 'Demo2024!' },
    { email: 'analyste@bci.sn',            role: 'Analyste Risques',          color: 'primary'   as const, password: 'Demo2024!' },
    { email: 'ca1@bci.sn',                 role: "Chargé d'Affaires",         color: 'primary'   as const, password: 'Demo2024!' },
    { email: 'juridique@bci.sn',           role: 'Direction Juridique',       color: 'success'   as const, password: 'Demo2024!' },
    { email: 'backoffice@bci.sn',          role: 'Back Office',               color: 'default'   as const, password: 'Demo2024!' },
  ];

  const features = [
    { icon: VerifiedUserOutlined, label: 'Infrastructure Sécurisée & Conforme' },
    { icon: GroupsOutlined,       label: 'Gestion Clientèle Corporative' },
    { icon: InsightsOutlined,     label: 'Analyse Financière SYSCOHADA' },
    { icon: AccountTreeOutlined,  label: 'Workflows d\'Approbation Dédiés' },
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
      if (data.requiresCompanySelection) {
        setPartialToken(data.partialToken);
        setCompanyOptions(data.companies || []);
        setShowCompanySelector(true);
        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      if (data.companies?.length === 1 || data.autoSelected) {
        companyCtx.setActiveCompany(data.companies[0], data.accessToken);
        companyCtx.setCompanies(data.companies || []);
      }
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
      const data = response.data;
      if (data.requiresCompanySelection) {
        setPartialToken(data.partialToken);
        setCompanyOptions(data.companies || []);
        setShowCompanySelector(true);
        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      if (data.companies?.length === 1 || data.autoSelected) {
        companyCtx.setActiveCompany(data.companies[0], data.accessToken);
        companyCtx.setCompanies(data.companies || []);
      }
      completeLogin(data.accessToken, data.refreshToken, data.user);
    } catch (error: any) {
      setOtpError(error.response?.data?.error || 'Code invalide. Réessayez.');
    } finally {
      setOtpLoading(false);
    }
  };

  const completeLogin = (accessToken: string, refreshToken: string, user: any) => {
    tokenManager.setTokens(accessToken, refreshToken);
    const roleMapping: Record<string, string> = {
      ADMIN: 'admin', MANAGEMENT: 'management', BRANCH_MANAGER: 'branch_manager',
      ACCOUNT_MANAGER: 'account_manager', CREDIT_ANALYST: 'credit_analyst',
      ANALYST_SUPERVISOR: 'analyst_supervisor', CREDIT_COMMITTEE: 'credit_committee',
      SUPER_ADMIN:             'admin',
      CHARGE_AFFAIRES:         'account_manager',
      ANALYSTE_RISQUES:        'credit_analyst',
      RESPONSABLE_RISQUES:     'analyst_supervisor',
      RESPONSABLE_ENGAGEMENTS: 'branch_manager',
      COMITE_CREDIT:           'credit_committee',
      DIRECTION_GENERALE:      'management',
      DIRECTION_JURIDIQUE:     'management',
      BACK_OFFICE:             'account_manager',
    };
    if (dispatch) dispatch({
      type: 'LOGIN_SUCCESS',
      payload: {
        id: user.id, email: user.email, name: user.name,
        role: roleMapping[user.role] || user.role || 'account_manager',
        department: user.department, jobTitle: user.jobTitle,
        permissions: user.permissions,
        lastLogin: new Date(user.lastLogin || Date.now()),
        isActive: true,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
    onLogin();
  };

  const handleForceChangePassword = async () => {
    setChangePasswordError('');
    if (newPassword.length < 8)          { setChangePasswordError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (newPassword !== confirmPassword) { setChangePasswordError('Les mots de passe ne correspondent pas.'); return; }
    setChangePasswordLoading(true);
    try {
      const data = await authPasswordApi.changePasswordForced(tempToken, newPassword);
      if (data.requiresCompanySelection) {
        setPartialToken(data.partialToken ?? '');
        setCompanyOptions(data.companies ?? []);
        setShowCompanySelector(true);
        if (dispatch) dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      if ((data.companies?.length === 1 || data.autoSelected) && data.companies?.[0]) {
        companyCtx.setActiveCompany(data.companies[0], data.accessToken ?? '');
        companyCtx.setCompanies(data.companies);
      }
      completeLogin(data.accessToken ?? '', data.refreshToken ?? '', data.user);
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
    const found = demoUsers.find(u => u.email === demoEmail);
    setEmail(demoEmail);
    setPassword(found?.password ?? 'Demo2024!');
    setShowDemo(false);
  };

  const handleMicrosoftLogin = async () => {
    const success = await loginWithMicrosoft();
    if (success) onLogin();
  };

  const handleCompanySelect = async (company: CompanyWithRole) => {
    try {
      const result = await ApiService.post('/auth/select-company', {
        companyId: company.id,
        partialToken,
      }) as any;
      if (result.success) {
        companyCtx.setActiveCompany(result.company, result.accessToken);
        companyCtx.setCompanies(companyOptions);
        setShowCompanySelector(false);
        completeLogin(result.accessToken, result.refreshToken, result.user);
      }
    } catch (error: any) {
      if (dispatch) dispatch({ type: 'LOGIN_FAILURE', payload: error.message || 'Erreur lors de la sélection de compagnie' });
    }
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
              background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 10px 20px -5px rgba(15, 23, 42, 0.3)`,
            }}>
              <ShieldIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: TEXT_PRIMARY, mb: 0.5, letterSpacing: '-0.5px' }}>
              Vérification 2FA
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
              Entrez le code à 6 chiffres de votre application d'authentification ou l'un de vos codes de secours.
            </Typography>
          </Box>

          {otpError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setOtpError('')}>{otpError}</Alert>}

          <StyledTextField
            value={otpCode}
            onChange={(e: any) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputProps={{ style: { textAlign: 'center', fontSize: 32, letterSpacing: 10, fontWeight: 700 }, maxLength: 8 }}
            sx={{ mb: 3, width: '100%' }}
            autoFocus
            placeholder="• • • • • •"
            onKeyDown={(e: any) => e.key === 'Enter' && otpCode.length >= 6 && handleOtpVerify()}
          />

          <GradientButton fullWidth onClick={handleOtpVerify} disabled={otpCode.length < 6 || otpLoading} sx={{ mb: 2 }}>
            {otpLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Vérifier'}
          </GradientButton>

          <Button
            variant="text" fullWidth size="small"
            onClick={() => { setLoginStep('credentials'); setOtpCode(''); setOtpError(''); setTempToken(''); }}
            sx={{ color: TEXT_SECONDARY, fontWeight: 600, '&:hover': { color: BRAND_PRIMARY } }}
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
              background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 10px 20px -5px rgba(15, 23, 42, 0.3)`,
            }}>
              <LockResetIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: TEXT_PRIMARY, mb: 0.5, letterSpacing: '-0.5px' }}>
              Nouveau mot de passe requis
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
              Pour des raisons de sécurité, définissez un nouveau mot de passe avant de continuer.
            </Typography>
          </Box>

          {changePasswordError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setChangePasswordError('')}>{changePasswordError}</Alert>}

          <StyledTextField
            label="Nouveau mot de passe"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e: any) => setNewPassword(e.target.value)}
            fullWidth
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNewPassword(v => !v)} edge="end" size="small">
                    {showNewPassword ? <VisibilityOff fontSize="small" sx={{ color: TEXT_SECONDARY }} /> : <Visibility fontSize="small" sx={{ color: TEXT_SECONDARY }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <StyledTextField
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e: any) => setConfirmPassword(e.target.value)}
            fullWidth sx={{ mb: 3 }}
            onKeyDown={(e: any) => e.key === 'Enter' && handleForceChangePassword()}
          />

          <GradientButton fullWidth onClick={handleForceChangePassword} disabled={!newPassword || !confirmPassword || changePasswordLoading}>
            {changePasswordLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Définir mon mot de passe'}
          </GradientButton>
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
              background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 10px 20px -5px rgba(15, 23, 42, 0.3)`,
            }}>
              <EmailIcon sx={{ color: WHITE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: TEXT_PRIMARY, mb: 0.5, letterSpacing: '-0.5px' }}>
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
                sx={{ borderRadius: '14px', borderColor: BORDER_COLOR, color: BRAND_PRIMARY, fontWeight: 700, textTransform: 'none', py: 1.2, '&:hover': { borderColor: BRAND_PRIMARY, bgcolor: 'rgba(31,78,121,0.05)' } }}
              >
                ← Retour à la connexion
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: TEXT_SECONDARY, mb: 3, textAlign: 'center', lineHeight: 1.6 }}>
                Saisissez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </Typography>

              {forgotError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setForgotError('')}>{forgotError}</Alert>}

              <StyledTextField
                label="Adresse email"
                type="email"
                value={forgotEmail}
                onChange={(e: any) => setForgotEmail(e.target.value)}
                fullWidth sx={{ mb: 3 }}
                autoFocus
                onKeyDown={(e: any) => e.key === 'Enter' && handleForgotPassword()}
              />

              <GradientButton fullWidth onClick={handleForgotPassword} disabled={!forgotEmail.trim() || forgotLoading} sx={{ mb: 2 }}>
                {forgotLoading ? <CircularProgress size={22} sx={{ color: WHITE }} /> : 'Envoyer le lien'}
              </GradientButton>

              <Button
                variant="text" fullWidth size="small"
                onClick={() => { setLoginStep('credentials'); setForgotError(''); }}
                sx={{ color: TEXT_SECONDARY, fontWeight: 600, '&:hover': { color: BRAND_PRIMARY } }}
              >
                ← Retour à la connexion
              </Button>
            </>
          )}
        </GlassCard>
      </OverlayBg>
    );
  }

  // ── Company selector ─────────────────────────────────────────────────────────
  if (showCompanySelector) {
    return (
      <OverlayBg>
        <CompanySelector
          open={showCompanySelector}
          companies={companyOptions}
          onSelect={handleCompanySelect}
        />
      </OverlayBg>
    );
  }

  // ── Main login screen ────────────────────────────────────────────────────────
  return (
    <Box sx={{
      background: BG_GRADIENT,
      minHeight: '100vh',
      overflowY: 'auto',
      position: 'relative',
    }}>
      <Grid
        container
        sx={{ maxWidth: 1200, mx: 'auto', minHeight: '100vh', px: { xs: 2, md: 4 }, position: 'relative', zIndex: 10 }}
        alignItems="center"
      >
        {/* ── Mobile header ── */}
        <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', pt: 5, pb: 3 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, mb: 2,
            animation: anim(fadeInScale, '0.55s', '0s'),
          }}>
            <img src={optimusIcon} alt="OptimusCredit" style={{ width: 56, height: 56 }} />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: TEXT_PRIMARY, letterSpacing: '-0.5px', animation: anim(fadeInUp, '0.5s', '0.1s') }}>
            OptimusCredit
          </Typography>
          <Typography variant="body2" sx={{ color: TEXT_SECONDARY, animation: anim(fadeInUp, '0.5s', '0.18s') }}>
            {t('login.platformSubtitle')}
          </Typography>
        </Grid>

        {/* ── Left branding (desktop) ── */}
        <Grid item md={6} sx={{ display: { xs: 'none', md: 'block' }, pr: 6 }}>
          {/* Logo */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 2.5, mb: 6,
            animation: anim(fadeInLeft, '0.6s', '0s'),
          }}>
            <img src={optimusIcon} alt="OptimusCredit" style={{ width: 48, height: 48 }} />
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: BRAND_PRIMARY, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
                OptimusCredit
              </Typography>
            </Box>
          </Box>

          {/* Main headline */}
          <Typography
            variant="h3"
            fontWeight={800}
            sx={{
              color: TEXT_PRIMARY, lineHeight: 1.15, mb: 2,
              animation: anim(fadeInLeft, '0.6s', '0.1s'),
              letterSpacing: '-1px'
            }}
          >
            Bienvenue sur votre <br />Espace Digital
          </Typography>

          {/* Feature list */}
          <Box sx={{ mt: 5, animation: anim(fadeInLeft, '0.6s', '0.2s') }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Box
                  key={i}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2.5, mb: 3,
                  }}
                >
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '12px',
                    background: WHITE,
                    border: `1px solid ${BORDER_COLOR}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 6px -1px rgba(0,0,0,0.05)`,
                  }}>
                    <Icon sx={{ color: TEXT_SECONDARY, fontSize: 20 }} />
                  </Box>
                  <Typography variant="body1" sx={{ color: TEXT_PRIMARY, fontWeight: 500, fontSize: '1.05rem' }}>
                    {f.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Grid>

        {/* ── Right side: login form ── */}
        <Grid item xs={12} md={6} sx={{ py: { xs: 0, md: 5 }, pb: { xs: 5, md: 5 } }}>
          <Box sx={{
            maxWidth: 440, mx: 'auto', ml: 'auto',
            animation: anim(fadeInRight, '0.6s', '0.1s'),
          }}>
            {/* Card */}
            <Box sx={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              borderRadius: '24px',
              border: `1px solid rgba(255,255,255,0.9)`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
              p: { xs: 3.5, sm: 5 },
            }}>
              {/* Header */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: TEXT_PRIMARY, mb: 0.5, letterSpacing: '-0.5px' }}>
                  {t('login.title')}
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
                <StyledTextField
                  fullWidth label={t('login.email')} type="text"
                  inputMode="email"
                  value={email} onChange={(e: any) => setEmail(e.target.value)}
                  disabled={state.isLoading}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />

                <StyledTextField
                  fullWidth label={t('login.password')} type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e: any) => setPassword(e.target.value)}
                  required disabled={state.isLoading}
                  autoComplete="current-password"
                  sx={{ mb: 1.5 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(v => !v)} edge="end" size="small">
                          {showPassword ? <VisibilityOff fontSize="small" sx={{ color: TEXT_SECONDARY }} /> : <Visibility fontSize="small" sx={{ color: TEXT_SECONDARY }} />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
                  <Button
                    variant="text" size="small"
                    onClick={() => { setLoginStep('forgot_password'); setForgotEmail(email); }}
                    sx={{ textTransform: 'none', fontSize: 14, color: BRAND_SECONDARY, p: 0, fontWeight: 600, '&:hover': { color: BRAND_PRIMARY, background: 'none' } }}
                  >
                    Mot de passe oublié ?
                  </Button>
                </Box>

                <GradientButton
                  type="submit" fullWidth disabled={state.isLoading || state.loginAttempts >= 3} sx={{ mb: 2.5 }}
                  endIcon={state.isLoading ? null : <ArrowForward fontSize="small" />}
                >
                  {state.isLoading
                    ? <><CircularProgress size={20} sx={{ mr: 1, color: WHITE }} />{t('login.connecting')}</>
                    : t('login.connect')
                  }
                </GradientButton>
              </form>

              {/* Microsoft login */}
              {isMsalAvailable && (
                <>
                  <Divider sx={{ my: 3, borderColor: BORDER_COLOR }}><Typography variant="caption" sx={{ color: TEXT_SECONDARY, px: 1, fontWeight: 600 }}>ou</Typography></Divider>
                  <Button
                    fullWidth variant="outlined" size="large"
                    onClick={handleMicrosoftLogin}
                    disabled={state.isLoading}
                    sx={{
                      mb: 2.5, py: 1.2, borderRadius: '14px', fontWeight: 600,
                      borderColor: BORDER_COLOR, color: TEXT_PRIMARY,
                      bgcolor: WHITE, textTransform: 'none',
                      '&:hover': { borderColor: '#CBD5E1', bgcolor: '#F8FAFC' },
                    }}
                    startIcon={
                      <img
                        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCAyMSAyMSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iI0YzNTMyNSIvPgo8cmVjdCB4PSIxMSIgeT0iMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzgxQkM2RiIvPgo8cmVjdCB4PSIxIiB5PSIxMSIgd2lkdGg9IjkiIGhlaWdodD0iOSIgZmlsbD0iIzA1QTNGNCIvPgo8cmVjdCB4PSIxMSIgeT0iMTEiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiIGZpbGw9IiNGRkI5MDAiLz4KPC9zdmc+"
                        alt="Microsoft" style={{ width: 18, height: 18 }}
                      />
                    }
                  >
                    {t('login.microsoftLogin')}
                  </Button>
                </>
              )}

              {/* Demo accounts */}
              <Divider sx={{ my: 3, borderColor: BORDER_COLOR }} />

              <Button
                fullWidth variant="text" size="small"
                onClick={() => setShowDemo(!showDemo)}
                endIcon={showDemo ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                sx={{ color: TEXT_SECONDARY, textTransform: 'none', fontWeight: 600, mb: 1, borderRadius: '10px', '&:hover': { bgcolor: '#F1F5F9', color: BRAND_PRIMARY } }}
              >
                {showDemo ? t('login.hideDemoAccounts') : t('login.showDemoAccounts')}
              </Button>

              <Collapse in={showDemo}>
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: WHITE, borderRadius: '14px', border: `1px solid ${BORDER_COLOR}` }}>
                  <List dense disablePadding>
                    {demoUsers.map((user) => (
                      <ListItem
                        key={user.email}
                        button
                        onClick={() => handleDemoLogin(user.email)}
                        sx={{
                          borderRadius: '10px', mb: 0.5, py: 0.75,
                          '&:hover': { bgcolor: '#F8FAFC' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: '#F1F5F9', color: TEXT_SECONDARY, fontSize: '0.75rem' }}>
                            <PersonIcon sx={{ fontSize: 14 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={user.email}
                          secondary={user.role}
                          primaryTypographyProps={{ fontSize: '12.5px', color: TEXT_PRIMARY, fontWeight: 600 }}
                          secondaryTypographyProps={{ fontSize: '11px', color: TEXT_SECONDARY, fontWeight: 500 }}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.3 }}>
                          <Chip label={user.role} size="small" color={user.color} variant="outlined" sx={{ fontSize: '10px', height: 20, fontWeight: 600 }} />
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Collapse>
            </Box>

            {/* Footer */}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: TEXT_SECONDARY, mt: 3, fontWeight: 500 }}>
              OptimusCredit • Gestion de Crédit Professionnelle | Tous droits réservés
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoginPage;
