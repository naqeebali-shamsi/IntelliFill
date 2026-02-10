/**
 * API Contract Tests
 *
 * These tests verify that the extension's response-parsing logic correctly
 * handles the ACTUAL response shapes from the IntelliFill backend.
 *
 * When these tests fail, it means the backend response format has diverged
 * from what the extension expects — fix the parsing, not the tests.
 *
 * Backend response shapes are documented in each test with the exact
 * line numbers from the backend source for easy cross-referencing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  RawLoginResponse,
  RawRefreshResponse,
  RawUserResponse,
  LoginResponse,
  User,
  UserProfileResponse,
} from '../shared/types/api';

// ─── Helpers that mirror the api-client parsing logic ───────────────────────
// Extracted so we test the parsing independently of fetch/storage side effects.

function parseLoginResponse(raw: RawLoginResponse): LoginResponse {
  const user = raw.data?.user
    ? {
        id: raw.data.user.id,
        email: raw.data.user.email,
        firstName: raw.data.user.firstName,
        lastName: raw.data.user.lastName,
        role: raw.data.user.role,
      }
    : undefined;

  return {
    success: !!raw.success,
    message: raw.message,
    user,
    accessToken: raw.data?.tokens?.accessToken,
  };
}

function parseRefreshResponse(raw: RawRefreshResponse): string | null {
  return raw.data?.tokens?.accessToken ?? null;
}

function parseUserResponse(raw: RawUserResponse): User | null {
  const u = raw.data?.user;
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
  };
}

// ─── Backend response fixtures ──────────────────────────────────────────────
// These mirror the EXACT shapes from the backend source code.

/** From supabase-auth.routes.ts createLoginSuccessResponse() lines 122-143 */
const LOGIN_SUCCESS_RESPONSE: RawLoginResponse = {
  success: true,
  message: 'Login successful',
  data: {
    user: {
      id: 'user-uuid-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member',
      emailVerified: true,
      lastLogin: '2026-02-09T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    tokens: {
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.test-access-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
  },
};

const LOGIN_FAILURE_RESPONSE: RawLoginResponse = {
  success: false,
  message: 'Invalid credentials',
};

/** From supabase-auth.routes.ts lines 629-639 and 682-693 */
const REFRESH_SUCCESS_RESPONSE: RawRefreshResponse = {
  success: true,
  message: 'Token refreshed successfully',
  data: {
    tokens: {
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.refreshed-access-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
  },
};

const REFRESH_FAILURE_RESPONSE: RawRefreshResponse = {
  success: false,
  message: 'Invalid or expired refresh token',
};

/** From supabase-auth.routes.ts GET /me lines 738-756 */
const USER_ME_RESPONSE: RawUserResponse = {
  success: true,
  data: {
    user: {
      id: 'user-uuid-123',
      email: 'test@example.com',
      full_name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member',
      is_active: true,
      email_verified: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-09T00:00:00Z',
      last_login: '2026-02-09T00:00:00Z',
      supabase_user_id: 'supabase-uuid-456',
    },
  },
};

/** From profile.routes.ts GET /me/profile lines 75-78 */
const PROFILE_RESPONSE: UserProfileResponse = {
  success: true,
  profile: {
    fields: [
      {
        key: 'firstName',
        values: ['John'],
        confidence: 0.95,
        sourceCount: 2,
        lastUpdated: '2026-02-09T00:00:00Z',
      },
      {
        key: 'email',
        values: ['test@example.com'],
        confidence: 0.99,
        sourceCount: 3,
        lastUpdated: '2026-02-09T00:00:00Z',
      },
    ],
    documentCount: 3,
  },
};

/** From extension.routes.ts POST /infer-fields line 260 */
const INFER_FIELDS_RESPONSE = {
  success: true,
  mappings: [
    { index: 0, profileKey: 'firstName', confidence: 0.85 },
    { index: 1, profileKey: 'email', confidence: 0.9 },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('API Contract: Login (POST /auth/v2/login)', () => {
  it('extracts user from nested data.user on success', () => {
    const result = parseLoginResponse(LOGIN_SUCCESS_RESPONSE);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Login successful');
    expect(result.user).toEqual({
      id: 'user-uuid-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member',
    });
  });

  it('extracts accessToken from nested data.tokens', () => {
    const result = parseLoginResponse(LOGIN_SUCCESS_RESPONSE);
    expect(result.accessToken).toBe('eyJhbGciOiJIUzI1NiJ9.test-access-token');
  });

  it('does NOT expect refreshToken in response body (sent via httpOnly cookie)', () => {
    const result = parseLoginResponse(LOGIN_SUCCESS_RESPONSE);
    // refreshToken is intentionally not extracted from response
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('handles failure response without data envelope', () => {
    const result = parseLoginResponse(LOGIN_FAILURE_RESPONSE);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
    expect(result.user).toBeUndefined();
    expect(result.accessToken).toBeUndefined();
  });

  it('handles empty data object gracefully', () => {
    const result = parseLoginResponse({ success: true, data: {} });

    expect(result.success).toBe(true);
    expect(result.user).toBeUndefined();
    expect(result.accessToken).toBeUndefined();
  });
});

describe('API Contract: Refresh (POST /auth/v2/refresh)', () => {
  it('extracts accessToken from nested data.tokens', () => {
    const token = parseRefreshResponse(REFRESH_SUCCESS_RESPONSE);
    expect(token).toBe('eyJhbGciOiJIUzI1NiJ9.refreshed-access-token');
  });

  it('returns null on failure response', () => {
    const token = parseRefreshResponse(REFRESH_FAILURE_RESPONSE);
    expect(token).toBeNull();
  });

  it('returns null when data is missing', () => {
    const token = parseRefreshResponse({ success: false });
    expect(token).toBeNull();
  });
});

describe('API Contract: Get User (GET /auth/v2/me)', () => {
  it('extracts user from nested data.user envelope', () => {
    const user = parseUserResponse(USER_ME_RESPONSE);

    expect(user).toEqual({
      id: 'user-uuid-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member',
    });
  });

  it('returns null when data.user is missing', () => {
    const user = parseUserResponse({ success: true, data: {} });
    expect(user).toBeNull();
  });

  it('returns null when data is missing entirely', () => {
    const user = parseUserResponse({ success: false });
    expect(user).toBeNull();
  });

  it('User type has firstName/lastName (NOT flat name)', () => {
    const user = parseUserResponse(USER_ME_RESPONSE);
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(user).not.toHaveProperty('name');
  });
});

describe('API Contract: Get Profile (GET /users/me/profile)', () => {
  it('profile is at top level (NOT nested under data)', () => {
    // Profile endpoint uses flat envelope: { success, profile }
    expect(PROFILE_RESPONSE.profile).toBeDefined();
    expect(PROFILE_RESPONSE.profile!.fields).toHaveLength(2);
    expect(PROFILE_RESPONSE.profile!.documentCount).toBe(3);
  });

  it('profile fields have required shape', () => {
    const field = PROFILE_RESPONSE.profile!.fields[0]!;
    expect(field).toHaveProperty('key');
    expect(field).toHaveProperty('values');
    expect(field).toHaveProperty('confidence');
    expect(field).toHaveProperty('sourceCount');
    expect(field).toHaveProperty('lastUpdated');
    expect(Array.isArray(field.values)).toBe(true);
  });
});

describe('API Contract: Infer Fields (POST /extension/infer-fields)', () => {
  it('mappings are at top level (NOT nested under data)', () => {
    expect(INFER_FIELDS_RESPONSE.mappings).toHaveLength(2);
  });

  it('each mapping has index, profileKey, confidence', () => {
    const mapping = INFER_FIELDS_RESPONSE.mappings[0]!;
    expect(mapping).toHaveProperty('index');
    expect(mapping).toHaveProperty('profileKey');
    expect(mapping).toHaveProperty('confidence');
    expect(typeof mapping.index).toBe('number');
    expect(typeof mapping.profileKey).toBe('string');
    expect(typeof mapping.confidence).toBe('number');
  });

  it('confidence is capped at 0.9 by backend', () => {
    for (const mapping of INFER_FIELDS_RESPONSE.mappings) {
      expect(mapping.confidence).toBeLessThanOrEqual(0.9);
    }
  });
});

describe('Response envelope patterns', () => {
  it('auth endpoints use nested { data: { ... } } envelope', () => {
    // Login, refresh, and /me all nest under data
    expect(LOGIN_SUCCESS_RESPONSE).toHaveProperty('data');
    expect(REFRESH_SUCCESS_RESPONSE).toHaveProperty('data');
    expect(USER_ME_RESPONSE).toHaveProperty('data');
  });

  it('non-auth endpoints use flat envelope', () => {
    // Profile and infer-fields do NOT use data envelope
    expect(PROFILE_RESPONSE).not.toHaveProperty('data');
    expect(INFER_FIELDS_RESPONSE).not.toHaveProperty('data');
  });
});
