/**
 * Mock Helper for External Services
 *
 * Intercepts and mocks network calls to:
 * - OCR service
 * - R2/S3 storage
 * - Supabase auth email callbacks
 * - Other external services
 *
 * Uses Playwright's page.route() for network interception.
 */

import { Page, Route, Request } from '@playwright/test';

/**
 * OCR mock response data
 */
export interface OcrMockData {
  extractedFields: Record<string, string>;
  confidence: number;
  pages: number;
  rawText?: string;
}

/**
 * Default OCR mock response
 */
export const DEFAULT_OCR_RESPONSE: OcrMockData = {
  extractedFields: {
    'Passport No': 'AB1234567',
    'Full Name': 'John Test Doe',
    'Date of Birth': '1990-01-15',
    'Nationality': 'United States',
    'Issue Date': '2020-05-10',
    'Expiry Date': '2030-05-09',
    'Place of Birth': 'New York',
    'Gender': 'Male',
  },
  confidence: 0.95,
  pages: 1,
  rawText: 'PASSPORT\nAB1234567\nJohn Test Doe\n...',
};

/**
 * Storage upload mock response
 */
export interface StorageUploadMockResponse {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'github' | 'azure' | 'apple';

/**
 * OAuth mock user data
 */
export interface OAuthMockUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  provider?: OAuthProvider;
  provider_id?: string;
}

/**
 * OAuth mock tokens
 */
export interface OAuthMockTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * OAuth mock session response (Supabase format)
 */
export interface OAuthMockSession {
  user: OAuthMockUser;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    token_type: string;
  };
}

/**
 * Default OAuth mock user
 */
export const DEFAULT_OAUTH_USER: OAuthMockUser = {
  id: 'oauth-test-user-id',
  email: 'oauth-test@example.com',
  name: 'OAuth Test User',
  avatar_url: 'https://example.com/avatar.png',
  provider: 'google',
  provider_id: 'google-123456789',
};

/**
 * Default OAuth mock tokens
 */
export const DEFAULT_OAUTH_TOKENS: OAuthMockTokens = {
  access_token: 'mock-oauth-access-token-' + Date.now(),
  refresh_token: 'mock-oauth-refresh-token-' + Date.now(),
  expires_in: 3600,
  token_type: 'bearer',
};

/**
 * Mock configuration options
 */
export interface MockConfig {
  delay?: number;        // Artificial delay in ms
  statusCode?: number;   // HTTP status code
  failAfter?: number;    // Fail after N requests
}

/**
 * Mock Helper class for intercepting network requests
 */
export class MockHelper {
  private page: Page;
  private activeRoutes: string[] = [];
  private requestCounts: Map<string, number> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Mock OCR service responses
   */
  async mockOcrService(
    mockData: OcrMockData = DEFAULT_OCR_RESPONSE,
    config: MockConfig = {}
  ): Promise<void> {
    const routePattern = '**/api/ocr/**';
    this.activeRoutes.push(routePattern);

    await this.page.route(routePattern, async (route: Route) => {
      const requestCount = this.incrementRequestCount(routePattern);

      // Check if we should fail after N requests
      if (config.failAfter && requestCount > config.failAfter) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'OCR service unavailable' }),
        });
        return;
      }

      // Add artificial delay if specified
      if (config.delay) {
        await this.sleep(config.delay);
      }

      const statusCode = config.statusCode || 200;

      if (statusCode >= 400) {
        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'OCR processing failed' }),
        });
        return;
      }

      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockData,
        }),
      });
    });
  }

  /**
   * Mock R2/S3 storage upload
   */
  async mockStorageUpload(
    response: StorageUploadMockResponse = { success: true, url: 'https://mock-storage.example.com/test-file' },
    config: MockConfig = {}
  ): Promise<void> {
    // Mock R2 upload endpoints
    const patterns = [
      '**/r2.cloudflarestorage.com/**',
      '**/storage.googleapis.com/**',
      '**/s3.amazonaws.com/**',
      '**/api/upload/**',
      '**/api/documents/upload**',
    ];

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route, request: Request) => {
        // Only intercept PUT/POST requests (actual uploads)
        if (!['PUT', 'POST'].includes(request.method())) {
          await route.continue();
          return;
        }

        const requestCount = this.incrementRequestCount(pattern);

        if (config.failAfter && requestCount > config.failAfter) {
          await route.fulfill({
            status: 507,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Insufficient storage' }),
          });
          return;
        }

        if (config.delay) {
          await this.sleep(config.delay);
        }

        const statusCode = config.statusCode || 200;

        if (!response.success || statusCode >= 400) {
          await route.fulfill({
            status: statusCode || 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: response.error || 'Upload failed' }),
          });
          return;
        }

        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            url: response.url || `https://mock-storage.example.com/${Date.now()}`,
            key: response.key || `uploads/${Date.now()}/test-file`,
          }),
        });
      });
    }
  }

  /**
   * Mock storage failure (507 Insufficient Storage)
   */
  async mockStorageFailure(errorMessage: string = 'Storage full'): Promise<void> {
    await this.mockStorageUpload(
      { success: false, error: errorMessage },
      { statusCode: 507 }
    );
  }

  /**
   * Mock Supabase auth email callbacks
   */
  async mockSupabaseAuthEmail(): Promise<void> {
    const patterns = [
      '**/auth/v1/verify**',
      '**/auth/v1/recover**',
      '**/auth/v1/magiclink**',
    ];

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Email verified',
          }),
        });
      });
    }
  }

  /**
   * Mock email confirmation by directly calling the confirm endpoint
   */
  async mockEmailConfirmation(token?: string): Promise<void> {
    const confirmPattern = '**/auth/v1/verify**';
    this.activeRoutes.push(confirmPattern);

    await this.page.route(confirmPattern, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        }),
      });
    });
  }

  // =============================================================================
  // OAuth Mocking Methods
  // =============================================================================

  /**
   * Mock OAuth provider authorization flow
   *
   * Intercepts the OAuth initiation request and simulates a successful
   * authorization by redirecting to the callback URL with a mock code.
   *
   * @param provider - OAuth provider to mock (google, github, azure, apple)
   * @param callbackUrl - URL to redirect to after "authorization" (defaults to /auth/callback)
   * @param config - Optional mock configuration
   *
   * @example
   * ```typescript
   * await mockHelper.mockOAuthProvider('google');
   * // Now clicking "Sign in with Google" will redirect to callback with mock code
   * ```
   */
  async mockOAuthProvider(
    provider: OAuthProvider,
    callbackUrl?: string,
    config: MockConfig = {}
  ): Promise<void> {
    // Supabase OAuth authorize endpoint patterns
    const patterns = [
      `**/auth/v1/authorize?provider=${provider}**`,
      `**/auth/v1/authorize**provider=${provider}**`,
      `**supabase.co/auth/v1/authorize**`,
    ];

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route, request: Request) => {
        const requestCount = this.incrementRequestCount(pattern);

        if (config.failAfter && requestCount > config.failAfter) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'OAuth provider unavailable' }),
          });
          return;
        }

        if (config.delay) {
          await this.sleep(config.delay);
        }

        // Extract redirect_to from the original request if present
        const url = new URL(request.url());
        const redirectTo = url.searchParams.get('redirect_to') || callbackUrl || '/auth/callback';

        // Simulate provider authorization by redirecting to callback with mock code
        const mockCode = `mock-${provider}-auth-code-${Date.now()}`;
        const finalCallbackUrl = `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}code=${mockCode}&provider=${provider}`;

        await route.fulfill({
          status: 302,
          headers: {
            Location: finalCallbackUrl,
          },
        });
      });
    }
  }

  /**
   * Mock Supabase OAuth token exchange
   *
   * Intercepts the token exchange request that happens after the OAuth callback.
   * Returns mock tokens and user data.
   *
   * @param mockUser - User data to return (defaults to DEFAULT_OAUTH_USER)
   * @param mockTokens - Tokens to return (defaults to DEFAULT_OAUTH_TOKENS)
   * @param config - Optional mock configuration
   *
   * @example
   * ```typescript
   * await mockHelper.mockOAuthTokenExchange({
   *   user: { email: 'custom@test.com', name: 'Custom User' }
   * });
   * ```
   */
  async mockOAuthTokenExchange(
    mockUser: Partial<OAuthMockUser> = {},
    mockTokens: Partial<OAuthMockTokens> = {},
    config: MockConfig = {}
  ): Promise<void> {
    const patterns = [
      '**/auth/v1/token**',
      '**/auth/v1/token?grant_type=**',
    ];

    const user: OAuthMockUser = { ...DEFAULT_OAUTH_USER, ...mockUser };
    const tokens: OAuthMockTokens = { ...DEFAULT_OAUTH_TOKENS, ...mockTokens };

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route, request: Request) => {
        // Only intercept POST requests (token exchange)
        if (request.method() !== 'POST') {
          await route.continue();
          return;
        }

        const requestCount = this.incrementRequestCount(pattern);

        if (config.failAfter && requestCount > config.failAfter) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'invalid_grant',
              error_description: 'OAuth code expired or invalid',
            }),
          });
          return;
        }

        if (config.delay) {
          await this.sleep(config.delay);
        }

        const statusCode = config.statusCode || 200;

        if (statusCode >= 400) {
          await route.fulfill({
            status: statusCode,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'access_denied',
              error_description: 'User denied access',
            }),
          });
          return;
        }

        const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600);

        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in || 3600,
            expires_at: expiresAt,
            token_type: tokens.token_type || 'bearer',
            user: {
              id: user.id,
              aud: 'authenticated',
              role: 'authenticated',
              email: user.email,
              email_confirmed_at: new Date().toISOString(),
              phone: '',
              confirmed_at: new Date().toISOString(),
              last_sign_in_at: new Date().toISOString(),
              app_metadata: {
                provider: user.provider || 'google',
                providers: [user.provider || 'google'],
              },
              user_metadata: {
                avatar_url: user.avatar_url,
                email: user.email,
                email_verified: true,
                full_name: user.name,
                iss: `https://accounts.${user.provider || 'google'}.com`,
                name: user.name,
                picture: user.avatar_url,
                provider_id: user.provider_id,
                sub: user.provider_id,
              },
              identities: [
                {
                  id: user.provider_id,
                  user_id: user.id,
                  identity_data: {
                    email: user.email,
                    name: user.name,
                    avatar_url: user.avatar_url,
                  },
                  provider: user.provider || 'google',
                  last_sign_in_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
      });
    }
  }

  /**
   * Mock IntelliFill backend OAuth callback endpoint
   *
   * Intercepts calls to /api/auth/v2/oauth/callback and returns
   * a successful authentication response.
   *
   * @param mockUser - User data to return
   * @param mockTokens - Tokens to return
   * @param config - Optional mock configuration
   *
   * @example
   * ```typescript
   * await mockHelper.mockOAuthCallback();
   * // Backend callback endpoint now returns mock success
   * ```
   */
  async mockOAuthCallback(
    mockUser: Partial<OAuthMockUser> = {},
    mockTokens: Partial<OAuthMockTokens> = {},
    config: MockConfig = {}
  ): Promise<void> {
    const pattern = '**/api/auth/v2/oauth/callback**';
    this.activeRoutes.push(pattern);

    const user: OAuthMockUser = { ...DEFAULT_OAUTH_USER, ...mockUser };
    const tokens: OAuthMockTokens = { ...DEFAULT_OAUTH_TOKENS, ...mockTokens };

    await this.page.route(pattern, async (route: Route, request: Request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }

      const requestCount = this.incrementRequestCount(pattern);

      if (config.failAfter && requestCount > config.failAfter) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'OAUTH_ERROR', message: 'OAuth callback failed' },
          }),
        });
        return;
      }

      if (config.delay) {
        await this.sleep(config.delay);
      }

      const statusCode = config.statusCode || 200;

      if (statusCode >= 400) {
        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'OAUTH_ERROR', message: 'OAuth authentication failed' },
          }),
        });
        return;
      }

      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatar: user.avatar_url,
              emailVerified: true,
              provider: user.provider,
            },
            tokens: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresIn: tokens.expires_in,
            },
          },
        }),
      });
    });
  }

  /**
   * Mock complete OAuth flow
   *
   * Sets up all necessary mocks for a complete OAuth authentication flow:
   * 1. OAuth provider authorization
   * 2. Supabase token exchange
   * 3. IntelliFill backend callback
   *
   * @param provider - OAuth provider to mock
   * @param mockUser - User data to return
   * @param mockTokens - Tokens to return
   * @param config - Optional mock configuration
   *
   * @example
   * ```typescript
   * // Set up complete OAuth flow mock
   * await mockHelper.mockOAuthFlow('google', {
   *   user: { email: 'test@example.com', name: 'Test User' }
   * });
   *
   * // Now clicking "Sign in with Google" will complete the full mock flow
   * await page.click('[data-testid="google-signin"]');
   * ```
   */
  async mockOAuthFlow(
    provider: OAuthProvider,
    options: {
      user?: Partial<OAuthMockUser>;
      tokens?: Partial<OAuthMockTokens>;
      callbackUrl?: string;
      config?: MockConfig;
    } = {}
  ): Promise<void> {
    const { user = {}, tokens = {}, callbackUrl, config = {} } = options;

    // Set provider on user if not specified
    const userWithProvider = { ...user, provider: user.provider || provider };

    // Set up all three mocks in sequence
    await this.mockOAuthProvider(provider, callbackUrl, config);
    await this.mockOAuthTokenExchange(userWithProvider, tokens, config);
    await this.mockOAuthCallback(userWithProvider, tokens, config);
  }

  /**
   * Mock OAuth provider error (user denied access, provider error, etc.)
   *
   * @param provider - OAuth provider
   * @param errorType - Type of error to simulate
   *
   * @example
   * ```typescript
   * await mockHelper.mockOAuthError('google', 'access_denied');
   * // User clicking "Sign in with Google" will see an error
   * ```
   */
  async mockOAuthError(
    provider: OAuthProvider,
    errorType: 'access_denied' | 'invalid_request' | 'server_error' | 'temporarily_unavailable' = 'access_denied'
  ): Promise<void> {
    const pattern = `**/auth/v1/authorize?provider=${provider}**`;
    this.activeRoutes.push(pattern);

    const errorMessages: Record<string, string> = {
      access_denied: 'The user denied the authorization request',
      invalid_request: 'The request is missing a required parameter',
      server_error: 'The authorization server encountered an error',
      temporarily_unavailable: 'The authorization server is temporarily unavailable',
    };

    await this.page.route(pattern, async (route: Route) => {
      // Redirect to callback with error params (standard OAuth error response)
      const errorCallbackUrl = `/auth/callback?error=${errorType}&error_description=${encodeURIComponent(errorMessages[errorType])}`;

      await route.fulfill({
        status: 302,
        headers: {
          Location: errorCallbackUrl,
        },
      });
    });
  }

  /**
   * Mock Supabase getUser endpoint for OAuth sessions
   *
   * This is called by the frontend to verify the current user session.
   *
   * @param mockUser - User data to return
   *
   * @example
   * ```typescript
   * await mockHelper.mockGetUser({ email: 'oauth@test.com' });
   * // supabase.auth.getUser() now returns this mock user
   * ```
   */
  async mockGetUser(mockUser: Partial<OAuthMockUser> = {}): Promise<void> {
    const pattern = '**/auth/v1/user**';
    this.activeRoutes.push(pattern);

    const user: OAuthMockUser = { ...DEFAULT_OAUTH_USER, ...mockUser };

    await this.page.route(pattern, async (route: Route, request: Request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: user.email,
          email_confirmed_at: new Date().toISOString(),
          phone: '',
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {
            provider: user.provider || 'google',
            providers: [user.provider || 'google'],
          },
          user_metadata: {
            avatar_url: user.avatar_url,
            email: user.email,
            email_verified: true,
            full_name: user.name,
            name: user.name,
            picture: user.avatar_url,
          },
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });
  }

  // =============================================================================
  // End OAuth Mocking Methods
  // =============================================================================

  /**
   * Mock API response with custom delay
   */
  async mockApiDelay(
    urlPattern: string,
    delayMs: number,
    options?: {
      response?: unknown;
      statusCode?: number;
    }
  ): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await this.sleep(delayMs);

      if (options?.response) {
        await route.fulfill({
          status: options.statusCode || 200,
          contentType: 'application/json',
          body: JSON.stringify(options.response),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock API error response
   */
  async mockApiError(
    urlPattern: string,
    statusCode: number,
    errorMessage: string = 'Internal Server Error'
  ): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ error: errorMessage }),
      });
    });
  }

  /**
   * Mock Redis/queue service failure
   */
  async mockQueueServiceFailure(): Promise<void> {
    const queuePatterns = [
      '**/api/queue/**',
      '**/api/process/**',
      '**/api/jobs/**',
    ];

    for (const pattern of queuePatterns) {
      await this.mockApiError(pattern, 503, 'Queue service unavailable');
    }
  }

  /**
   * Mock network timeout
   */
  async mockNetworkTimeout(urlPattern: string, timeoutMs: number = 30000): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      // Never fulfill - let it timeout
      await this.sleep(timeoutMs);
      await route.abort('timedout');
    });
  }

  /**
   * Mock CORS error (block request from different origin)
   */
  async mockCorsError(urlPattern: string): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await route.fulfill({
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          // Intentionally missing CORS headers
        },
        body: JSON.stringify({ error: 'CORS error' }),
      });
    });
  }

  /**
   * Intercept and log requests (for debugging)
   */
  async interceptAndLog(urlPattern: string): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route, request: Request) => {
      console.log(`[Mock] ${request.method()} ${request.url()}`);
      console.log(`  Headers: ${JSON.stringify(request.headers())}`);

      const postData = request.postData();
      if (postData) {
        console.log(`  Body: ${postData.substring(0, 500)}`);
      }

      await route.continue();
    });
  }

  /**
   * Clear all active mocks
   */
  async clearMocks(): Promise<void> {
    for (const pattern of this.activeRoutes) {
      await this.page.unroute(pattern);
    }
    this.activeRoutes = [];
    this.requestCounts.clear();
  }

  /**
   * Get request count for a pattern
   */
  getRequestCount(pattern: string): number {
    return this.requestCounts.get(pattern) || 0;
  }

  /**
   * Reset request counts
   */
  resetRequestCounts(): void {
    this.requestCounts.clear();
  }

  /**
   * Wait for a specific number of requests to a pattern
   */
  async waitForRequests(
    urlPattern: string,
    count: number,
    timeoutMs: number = 10000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.getRequestCount(urlPattern) >= count) {
        return;
      }
      await this.sleep(100);
    }

    throw new Error(`Timeout waiting for ${count} requests to ${urlPattern}`);
  }

  /**
   * Increment request count for a pattern
   */
  private incrementRequestCount(pattern: string): number {
    const count = (this.requestCounts.get(pattern) || 0) + 1;
    this.requestCounts.set(pattern, count);
    return count;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock helper instance for a page
 */
export function createMockHelper(page: Page): MockHelper {
  return new MockHelper(page);
}
