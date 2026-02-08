import { authToken, refreshToken, extensionSettings } from '../shared/storage';
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  User,
  UserProfile,
  UserProfileResponse,
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

  /** Attempt to refresh the access token using the refresh token */
  private async refreshAccessToken(): Promise<boolean> {
    const token = await refreshToken.getValue();
    if (!token) return false;

    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/auth/v2/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as RefreshResponse;
      if (data.accessToken) {
        await authToken.setValue(data.accessToken);
      }
      if (data.refreshToken) {
        await refreshToken.setValue(data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Login with email and password */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const baseUrl = await this.getBaseUrl();
    const response = await fetch(`${baseUrl}/auth/v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = (await response.json()) as LoginResponse;

    if (data.success && data.accessToken) {
      await authToken.setValue(data.accessToken);
      if (data.refreshToken) {
        await refreshToken.setValue(data.refreshToken);
      }
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

  /** Get current user info */
  async getCurrentUser(): Promise<User | null> {
    try {
      const data = await this.request<{ success: boolean; user?: User }>('/users/me');
      return data.user ?? null;
    } catch {
      return null;
    }
  }
}

/** Singleton API client instance */
export const api = new IntelliFillAPI();
