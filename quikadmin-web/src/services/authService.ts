/**
 * Authentication Service - Backend API Integration
 *
 * Routes all authentication through the backend API at /api/auth/v2/*
 * This provides:
 * - Centralized auth handling
 * - No direct Supabase dependency in frontend
 * - Better control over auth flow
 * - Works without Supabase URL configuration
 */

import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role?: string;
}

export interface AuthTokens {
  accessToken: string;
  // refreshToken is now stored in httpOnly cookie (Phase 2 REQ-005)
  // Still optional in response for backward compatibility
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  mfaEnabled?: boolean;
  lastLogin?: string;
  createdAt?: string;
  isDemo?: boolean;
}

export interface DemoInfo {
  notice: string;
  features: string[];
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: AuthUser;
    tokens: AuthTokens | null;
    demo?: DemoInfo;
  };
  error?: string;
}

/**
 * Login via backend API
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post('/auth/v2/login', credentials);
  return response.data;
}

/**
 * Register via backend API
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post('/auth/v2/register', data);
  return response.data;
}

/**
 * Logout via backend API
 */
export async function logout(): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.post('/auth/v2/logout');
    return response.data;
  } catch {
    // Logout should always succeed client-side
    return { success: true, message: 'Logged out' };
  }
}

/**
 * Refresh token via backend API
 * Token is sent automatically via httpOnly cookie (Phase 2 REQ-005)
 * Optional refreshTokenValue for backward compatibility
 */
export async function refreshToken(refreshTokenValue?: string): Promise<AuthResponse> {
  // If token is provided, send in body (backward compatibility)
  // Otherwise, the httpOnly cookie will be sent automatically
  const body = refreshTokenValue ? { refreshToken: refreshTokenValue } : {};
  const response = await api.post('/auth/v2/refresh', body);
  return response.data;
}

/**
 * Get current user profile via backend API
 */
export async function getMe(): Promise<AuthResponse> {
  const response = await api.get('/auth/v2/me');
  return response.data;
}

/**
 * Request password reset via backend API
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/forgot-password', { email });
  return response.data;
}

/**
 * Reset password via backend API
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/reset-password', { token, newPassword });
  return response.data;
}

/**
 * Change password via backend API
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/change-password', { currentPassword, newPassword });
  return response.data;
}

/**
 * Verify reset token via backend API
 */
export async function verifyResetToken(
  token: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/verify-reset-token', { token });
  return response.data;
}

/**
 * Verify email with OTP code via backend API
 */
export async function verifyEmail(
  email: string,
  token: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/verify-email', { email, token });
  return response.data;
}

/**
 * Resend verification email via backend API
 */
export async function resendVerification(
  email: string
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post('/auth/v2/resend-verification', { email });
  return response.data;
}

/**
 * Demo login via backend API
 * Provides instant access to the demo account without credentials
 */
export async function demoLogin(): Promise<AuthResponse> {
  const response = await api.post('/auth/v2/demo');
  return response.data;
}

/**
 * Handle OAuth callback - syncs OAuth user with backend
 * Called after successful OAuth redirect from provider (e.g., Google)
 */
export async function handleOAuthCallback(params: {
  accessToken: string;
  refreshToken: string;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/v2/oauth/callback', params);
  return response.data;
}

export default {
  login,
  register,
  logout,
  refreshToken,
  getMe,
  requestPasswordReset,
  resetPassword,
  changePassword,
  verifyResetToken,
  verifyEmail,
  resendVerification,
  demoLogin,
  handleOAuthCallback,
};
