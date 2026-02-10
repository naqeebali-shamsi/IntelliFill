import { authToken, refreshToken, extensionSettings } from '../shared/storage';
import type {
  LoginRequest,
  LoginResponse,
  RawLoginResponse,
  RawRefreshResponse,
  RawUserResponse,
  User,
  UserProfile,
  UserProfileResponse,
  FieldInferenceRequest,
  FieldInferenceResult,
} from '../shared/types';

/** Custom error for authentication failures */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Custom error for API failures */
export class APIError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

/** Typed API client for IntelliFill backend */
export class IntelliFillAPI {
  private async getBaseUrl(): Promise<string> {
    const settings = await extensionSettings.getValue();
    return settings.apiEndpoint;
  }

  /** Make an authenticated API request */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const token = await authToken.getValue();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    };

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry the original request once with new token
        const newToken = await authToken.getValue();
        const retryHeaders: HeadersInit = {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...(options.headers as Record<string, string> | undefined),
        };
        const retryResponse = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers: retryHeaders,
        });
        if (!retryResponse.ok) {
          const body = await retryResponse.json().catch(() => ({}));
          throw new APIError(
            retryResponse.status,
            (body as { message?: string }).message || `HTTP ${retryResponse.status}`,
          );
        }
        return retryResponse.json() as Promise<T>;
      }
      throw new AuthError('Session expired - please log in again');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        (body as { message?: string }).message || `HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Attempt to refresh the access token using the refresh token.
   *  Backend returns: { success, message, data: { tokens: { accessToken, expiresIn, tokenType } } } */
  private async refreshAccessToken(): Promise<boolean> {
    const token = await refreshToken.getValue();
    if (!token) return false;

    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/auth/v2/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
        credentials: 'include', // Required for httpOnly cookie
      });

      if (!response.ok) return false;

      const raw = (await response.json()) as RawRefreshResponse;
      const newAccessToken = raw.data?.tokens?.accessToken;

      if (newAccessToken) {
        await authToken.setValue(newAccessToken);
      }
      return !!newAccessToken;
    } catch {
      return false;
    }
  }

  /** Login with email and password.
   *  Backend returns: { success, message, data: { user: {...}, tokens: { accessToken, ... } } }
   *  Refresh token is set via httpOnly cookie by the backend, not in the response body. */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include', // Required for httpOnly refresh token cookie
    });

    const raw = (await response.json()) as RawLoginResponse;

    const user = raw.data?.user
      ? {
          id: raw.data.user.id,
          email: raw.data.user.email,
          firstName: raw.data.user.firstName,
          lastName: raw.data.user.lastName,
          role: raw.data.user.role,
        }
      : undefined;

    const data: LoginResponse = {
      success: !!raw.success,
      message: raw.message,
      user,
      accessToken: raw.data?.tokens?.accessToken,
    };

    if (data.success && data.accessToken) {
      await authToken.setValue(data.accessToken);
    }

    return data;
  }

  /** Get current user profile */
  async getProfile(): Promise<UserProfile | null> {
    try {
      const data = await this.request<UserProfileResponse>('/users/me/profile');
      return data.profile ?? null;
    } catch {
      return null;
    }
  }

  /** Get current user info.
   *  Backend returns: { success, data: { user: { id, email, firstName, lastName, role, ... } } } */
  async getCurrentUser(): Promise<User | null> {
    try {
      const raw = await this.request<RawUserResponse>('/auth/v2/me');
      const u = raw.data?.user;
      if (!u) return null;
      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      };
    } catch {
      return null;
    }
  }

  /** Infer field-to-profile mappings via LLM */
  async inferFields(request: FieldInferenceRequest): Promise<FieldInferenceResult[]> {
    try {
      const data = await this.request<{ success: boolean; mappings?: FieldInferenceResult[] }>(
        '/extension/infer-fields',
        { method: 'POST', body: JSON.stringify(request) },
      );
      return data.mappings ?? [];
    } catch {
      return [];
    }
  }
}

/** Singleton API client instance */
export const api = new IntelliFillAPI();
