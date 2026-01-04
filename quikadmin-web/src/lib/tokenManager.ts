/**
 * In-Memory Token Manager
 *
 * Stores access tokens in JavaScript memory instead of localStorage
 * to mitigate XSS token theft risks.
 *
 * Task 277: Security Hardening - Access Token Migration
 *
 * Security benefits:
 * - Tokens are not accessible via document.cookie or localStorage
 * - XSS attacks cannot exfiltrate tokens to external servers
 * - Tokens are automatically cleared on page refresh (requires refresh token rotation)
 *
 * Trade-offs:
 * - Page refresh requires token refresh via refresh token (httpOnly cookie)
 * - Slightly more complex initialization flow
 */

// Private token storage - not accessible from browser DevTools or XSS scripts
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;

/**
 * Token Manager Singleton
 *
 * Provides secure in-memory storage for access tokens
 */
export const tokenManager = {
  /**
   * Get the current access token
   * @returns The access token or null if not set
   */
  getToken(): string | null {
    return accessToken;
  },

  /**
   * Set the access token in memory
   * @param token - The access token to store (or null to clear)
   * @param expiresIn - Optional expiration time in seconds
   */
  setToken(token: string | null, expiresIn?: number): void {
    accessToken = token;
    if (token && expiresIn) {
      tokenExpiresAt = Date.now() + expiresIn * 1000;
    } else if (!token) {
      tokenExpiresAt = null;
    }
  },

  /**
   * Clear the access token from memory
   */
  clearToken(): void {
    accessToken = null;
    tokenExpiresAt = null;
  },

  /**
   * Check if a token exists in memory
   * @returns True if token is set
   */
  hasToken(): boolean {
    return accessToken !== null;
  },

  /**
   * Get token expiration timestamp
   * @returns Unix timestamp in ms when token expires, or null
   */
  getExpiresAt(): number | null {
    return tokenExpiresAt;
  },

  /**
   * Check if token is expired or expiring soon
   * @param bufferMs - Buffer time in ms before expiration to consider "expiring soon"
   * @returns True if token is expired or expiring within buffer
   */
  isExpiringSoon(bufferMs: number = 5 * 60 * 1000): boolean {
    if (!tokenExpiresAt) return true;
    return Date.now() >= tokenExpiresAt - bufferMs;
  },

  /**
   * Get token for Authorization header
   * @returns Bearer token string or empty string if no token
   */
  getAuthorizationHeader(): string {
    if (!accessToken) return '';
    return `Bearer ${accessToken}`;
  },
};

// Freeze the object to prevent tampering
Object.freeze(tokenManager);

export default tokenManager;
