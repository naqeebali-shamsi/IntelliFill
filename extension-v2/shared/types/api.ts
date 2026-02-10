/**
 * API response types matching IntelliFill backend.
 *
 * IMPORTANT: The backend uses a nested envelope pattern for auth endpoints:
 *   { success, message, data: { user, tokens } }
 * These "Raw" types represent the actual wire format.
 * The api-client normalizes them into the flat types used by the rest of the extension.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

/** Raw backend login response (nested envelope) */
export interface RawLoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      emailVerified: boolean | null;
      lastLogin: string | null;
      createdAt: string;
    };
    tokens?: {
      accessToken: string;
      expiresIn: number;
      tokenType: string;
    };
  };
}

/** Normalized login response used by the extension */
export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  user?: User;
  message?: string;
}

/** Raw backend refresh response (nested envelope) */
export interface RawRefreshResponse {
  success: boolean;
  message?: string;
  data?: {
    tokens?: {
      accessToken: string;
      expiresIn: number;
      tokenType: string;
    };
  };
}

/** Normalized refresh response */
export interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  message?: string;
}

/** Raw backend /auth/v2/me response (nested envelope) */
export interface RawUserResponse {
  success: boolean;
  data?: {
    user?: {
      id: string;
      email: string;
      full_name: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      is_active: boolean;
      email_verified: boolean;
      created_at: string;
      updated_at: string;
      last_login: string | null;
      supabase_user_id: string;
    };
  };
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export interface UserProfileResponse {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

export interface UserProfile {
  fields: ProfileField[];
  documentCount: number;
}

export interface ProfileField {
  key: string;
  values: string[];
  confidence: number;
  sourceCount: number;
  lastUpdated: string;
}

export interface ClientProfile {
  id: string;
  clientId: string;
  fields: ProfileField[];
  updatedAt: string;
}

export interface APIErrorResponse {
  success: false;
  message: string;
  code?: string;
}
