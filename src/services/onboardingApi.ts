import axios from 'axios';
import { tokenManager } from './api';

const apiBase = () => `${window.location.origin}/api`;

const authHeader = () => {
  const token = tokenManager.getAccessToken() || localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function getOnboardingStatus(): Promise<{ shouldShow: boolean }> {
  const res = await axios.get(`${apiBase()}/users/me/onboarding`, { headers: authHeader() });
  return { shouldShow: Boolean(res.data?.shouldShow) };
}

export async function completeOnboarding(): Promise<void> {
  await axios.post(`${apiBase()}/users/me/onboarding/complete`, {}, { headers: authHeader() });
}

export async function resetOnboarding(): Promise<void> {
  await axios.post(`${apiBase()}/users/me/onboarding/reset`, {}, { headers: authHeader() });
}
