/**
 * Debug Production Auth Issue
 *
 * This script tests the auth flow on production to diagnose why
 * the refresh token cookie is not persisting after page refresh.
 *
 * Run with:
 *   cd quikadmin-web && npx playwright test e2e/debug-production-auth.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// Production URLs
const PROD_FRONTEND = 'https://intellifill.nomadcrew.uk';
const PROD_API = 'https://api.intellifill.nomadcrew.uk/api';

// Test user (use a real user that exists in production)
const TEST_USER = {
  email: 'test-member@intellifill.local',
  password: 'TestMember123!',
};

interface RequestLog {
  url: string;
  method: string;
  headers: Record<string, string>;
  cookies?: string;
}

interface ResponseLog {
  url: string;
  status: number;
  headers: Record<string, string>;
  setCookie?: string[];
  body?: string;
}

test.describe('Production Auth Debug', () => {
  test('debug refresh token cookie flow', async ({ page }) => {
    const requestLogs: RequestLog[] = [];
    const responseLogs: ResponseLog[] = [];

    // Monitor all network requests
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('api.intellifill') || url.includes('auth')) {
        const headers = request.headers();
        requestLogs.push({
          url,
          method: request.method(),
          headers: {
            'content-type': headers['content-type'] || '',
            'authorization': headers['authorization'] ? '[REDACTED]' : 'none',
            'cookie': headers['cookie'] || 'none',
          },
          cookies: headers['cookie'],
        });
      }
    });

    // Monitor all network responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api.intellifill') || url.includes('auth')) {
        const headers = response.headers();
        let body = '';

        // Try to capture response body for auth endpoints
        if (url.includes('/auth/')) {
          try {
            body = await response.text();
          } catch {
            body = '[Unable to read body]';
          }
        }

        const setCookieHeaders: string[] = [];
        const rawSetCookie = headers['set-cookie'];
        if (rawSetCookie) {
          setCookieHeaders.push(rawSetCookie);
        }

        responseLogs.push({
          url,
          status: response.status(),
          headers: {
            'content-type': headers['content-type'] || '',
            'set-cookie': rawSetCookie || 'none',
          },
          setCookie: setCookieHeaders,
          body: body.substring(0, 500), // Truncate for readability
        });
      }
    });

    // Listen for console messages
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Auth') || text.includes('auth') || text.includes('token') || text.includes('cookie')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });

    console.log('\n========== STEP 1: Navigate to Production Frontend ==========');
    await page.goto(PROD_FRONTEND + '/login');
    await page.waitForLoadState('networkidle');
    console.log(`Current URL: ${page.url()}`);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    console.log('Login form found');

    console.log('\n========== STEP 2: Perform Login ==========');
    await page.fill('input[type="email"], input[name="email"]', TEST_USER.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);

    // Clear logs before login
    requestLogs.length = 0;
    responseLogs.length = 0;

    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`After login URL: ${page.url()}`);

    console.log('\n========== Login Request/Response Logs ==========');
    for (const log of requestLogs) {
      console.log(`\nRequest: ${log.method} ${log.url}`);
      console.log(`  Cookie header: ${log.cookies || 'none'}`);
    }
    for (const log of responseLogs) {
      console.log(`\nResponse: ${log.status} ${log.url}`);
      if (log.setCookie && log.setCookie.length > 0) {
        console.log(`  Set-Cookie: ${log.setCookie.join(' | ')}`);
      }
      if (log.body) {
        console.log(`  Body: ${log.body}`);
      }
    }

    console.log('\n========== STEP 3: Check Cookies After Login ==========');
    const cookies = await page.context().cookies();
    console.log('\nAll cookies:');
    for (const cookie of cookies) {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      console.log(`    Domain: ${cookie.domain}`);
      console.log(`    Path: ${cookie.path}`);
      console.log(`    Secure: ${cookie.secure}`);
      console.log(`    HttpOnly: ${cookie.httpOnly}`);
      console.log(`    SameSite: ${cookie.sameSite}`);
    }

    const refreshTokenCookie = cookies.find(c => c.name === 'refreshToken');
    if (refreshTokenCookie) {
      console.log('\nRefresh token cookie found!');
      console.log(`  Domain: ${refreshTokenCookie.domain}`);
      console.log(`  Path: ${refreshTokenCookie.path}`);
    } else {
      console.log('\nWARNING: No refreshToken cookie found!');
    }

    // Check localStorage
    const localStorageAuth = await page.evaluate(() => {
      const auth = localStorage.getItem('intellifill-backend-auth');
      const accessToken = localStorage.getItem('accessToken');
      return { auth, accessToken };
    });
    console.log('\nLocalStorage:');
    console.log(`  intellifill-backend-auth: ${localStorageAuth.auth ? 'present' : 'not found'}`);
    console.log(`  accessToken: ${localStorageAuth.accessToken ? 'present' : 'not found'}`);

    console.log('\n========== STEP 4: Wait and Refresh Page ==========');
    await page.waitForTimeout(2000); // Small wait to ensure everything is saved

    // Clear logs
    requestLogs.length = 0;
    responseLogs.length = 0;

    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log(`After refresh URL: ${page.url()}`);

    console.log('\n========== Refresh Request/Response Logs ==========');
    const refreshRequests = requestLogs.filter(r => r.url.includes('refresh'));
    const refreshResponses = responseLogs.filter(r => r.url.includes('refresh'));

    if (refreshRequests.length === 0 && refreshResponses.length === 0) {
      console.log('No refresh token requests made!');
    }

    for (const log of refreshRequests) {
      console.log(`\nRequest: ${log.method} ${log.url}`);
      console.log(`  Cookie header sent: ${log.cookies || 'NONE - THIS IS THE PROBLEM'}`);
    }
    for (const log of refreshResponses) {
      console.log(`\nResponse: ${log.status} ${log.url}`);
      console.log(`  Status: ${log.status}`);
      if (log.body) {
        console.log(`  Body: ${log.body}`);
      }
    }

    // All requests
    console.log('\n========== All Auth-Related Requests After Refresh ==========');
    for (const log of requestLogs) {
      console.log(`${log.method} ${log.url}`);
      console.log(`  Cookies: ${log.cookies || 'none'}`);
    }
    for (const log of responseLogs) {
      console.log(`${log.status} ${log.url}`);
    }

    console.log('\n========== STEP 5: Check Final State ==========');
    const finalCookies = await page.context().cookies();
    const finalRefreshToken = finalCookies.find(c => c.name === 'refreshToken');
    console.log(`Refresh token cookie after refresh: ${finalRefreshToken ? 'present' : 'MISSING'}`);

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    const redirectedToLogin = finalUrl.includes('/login');
    console.log(`Redirected to login (session lost): ${redirectedToLogin ? 'YES - AUTH FAILED' : 'No'}`);

    // Check if we're still authenticated
    const isAuthenticated = await page.evaluate(() => {
      const auth = localStorage.getItem('intellifill-backend-auth');
      if (!auth) return false;
      try {
        const parsed = JSON.parse(auth);
        return !!parsed.state?.token;
      } catch {
        return false;
      }
    });
    console.log(`LocalStorage auth valid: ${isAuthenticated}`);

    console.log('\n========== DIAGNOSIS ==========');
    if (!refreshTokenCookie) {
      console.log('PROBLEM: No refreshToken cookie was set during login.');
      console.log('CHECK: Backend Set-Cookie header should include domain=.nomadcrew.uk');
    } else if (refreshRequests.length > 0 && refreshRequests[0].cookies?.includes('refreshToken') === false) {
      console.log('PROBLEM: Cookie was set but not sent with refresh request.');
      console.log('CHECK: Cookie domain/path mismatch or SameSite blocking cross-subdomain');
    } else if (refreshResponses.length > 0 && refreshResponses[0].status >= 400) {
      console.log('PROBLEM: Refresh request failed with status ' + refreshResponses[0].status);
      console.log('CHECK: Backend refresh endpoint may have an issue processing the token');
    } else if (redirectedToLogin) {
      console.log('PROBLEM: Session was not restored after page refresh.');
      console.log('CHECK: Frontend may not be calling refresh endpoint or handling response');
    }
  });
});
