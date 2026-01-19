/**
 * Debug Production Auth Issue - Standalone Script
 *
 * This script tests the auth flow on production to diagnose why
 * the refresh token cookie is not persisting after page refresh.
 *
 * Run with:
 *   cd quikadmin-web && node e2e/scripts/debug-prod-auth.mjs
 */

import { chromium } from 'playwright';

// Production URLs
const PROD_FRONTEND = 'https://intellifill.nomadcrew.uk';
const PROD_API = 'https://api.intellifill.nomadcrew.uk/api';

// Test user (use a real user that exists in production)
const TEST_USER = {
  email: 'test-member@intellifill.local',
  password: 'TestMember123!',
};

async function debugAuth() {
  console.log('Starting Production Auth Debug...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const requestLogs = [];
  const responseLogs = [];

  // Monitor all network requests
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('api.intellifill') || url.includes('auth')) {
      const headers = request.headers();
      requestLogs.push({
        url,
        method: request.method(),
        cookies: headers['cookie'] || 'none',
      });
    }
  });

  // Monitor all network responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.intellifill') || url.includes('auth')) {
      const headers = response.headers();
      let body = '';

      if (url.includes('/auth/')) {
        try {
          body = await response.text();
        } catch {
          body = '[Unable to read body]';
        }
      }

      responseLogs.push({
        url,
        status: response.status(),
        setCookie: headers['set-cookie'] || 'none',
        body: body.substring(0, 500),
      });
    }
  });

  // Listen for console messages
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Auth') || text.includes('auth') || text.includes('token') || text.includes('cookie') || text.includes('refresh')) {
      console.log(`[Browser Console] ${msg.type()}: ${text}`);
    }
  });

  try {
    console.log('========== STEP 1: Navigate to Production Frontend ==========');
    await page.goto(PROD_FRONTEND + '/login');
    await page.waitForLoadState('networkidle');
    console.log(`Current URL: ${page.url()}`);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    console.log('Login form found\n');

    console.log('========== STEP 2: Perform Login ==========');
    await page.fill('input[type="email"], input[name="email"]', TEST_USER.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);

    // Clear logs before login
    requestLogs.length = 0;
    responseLogs.length = 0;

    await page.click('button[type="submit"]');

    // Wait for login to complete
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      console.log(`After login URL: ${page.url()}`);
    } catch (e) {
      console.log('Login did not redirect - checking for errors...');
      const errorText = await page.locator('[role="alert"], .error-message').textContent().catch(() => null);
      if (errorText) {
        console.log(`Login error: ${errorText}`);
      }
      const currentUrl = page.url();
      console.log(`Still on: ${currentUrl}`);
    }

    console.log('\n========== Login Request/Response Logs ==========');
    for (const log of requestLogs) {
      console.log(`\nRequest: ${log.method} ${log.url}`);
      console.log(`  Cookies: ${log.cookies}`);
    }
    for (const log of responseLogs) {
      console.log(`\nResponse: ${log.status} ${log.url}`);
      if (log.setCookie !== 'none') {
        console.log(`  Set-Cookie: ${log.setCookie}`);
      }
      if (log.body) {
        console.log(`  Body: ${log.body}`);
      }
    }

    console.log('\n========== STEP 3: Check Cookies After Login ==========');
    const cookies = await context.cookies();
    console.log('\nAll cookies:');
    for (const cookie of cookies) {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 30)}...`);
      console.log(`    Domain: ${cookie.domain}`);
      console.log(`    Path: ${cookie.path}`);
      console.log(`    Secure: ${cookie.secure}`);
      console.log(`    HttpOnly: ${cookie.httpOnly}`);
      console.log(`    SameSite: ${cookie.sameSite}`);
    }

    const refreshTokenCookie = cookies.find(c => c.name === 'refreshToken');
    if (refreshTokenCookie) {
      console.log('\n✅ Refresh token cookie found!');
      console.log(`  Domain: ${refreshTokenCookie.domain}`);
      console.log(`  Path: ${refreshTokenCookie.path}`);
    } else {
      console.log('\n❌ WARNING: No refreshToken cookie found!');
    }

    // Check localStorage
    const localStorageAuth = await page.evaluate(() => {
      const auth = localStorage.getItem('intellifill-backend-auth');
      const accessToken = localStorage.getItem('accessToken');
      return { auth, accessToken };
    });
    console.log('\nLocalStorage:');
    console.log(`  intellifill-backend-auth: ${localStorageAuth.auth ? 'present' : 'not found'}`);
    if (localStorageAuth.auth) {
      try {
        const parsed = JSON.parse(localStorageAuth.auth);
        console.log(`    - token: ${parsed.state?.token ? 'present' : 'missing'}`);
        console.log(`    - tokenExpiresAt: ${parsed.state?.tokenExpiresAt || 'missing'}`);
      } catch {}
    }

    console.log('\n========== STEP 4: Wait and Refresh Page ==========');
    await page.waitForTimeout(3000);

    // Clear logs
    requestLogs.length = 0;
    responseLogs.length = 0;

    console.log('Refreshing page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log(`After refresh URL: ${page.url()}`);

    console.log('\n========== Refresh Request/Response Logs ==========');
    const refreshRequests = requestLogs.filter(r => r.url.includes('refresh'));
    const refreshResponses = responseLogs.filter(r => r.url.includes('refresh'));

    if (refreshRequests.length === 0) {
      console.log('❌ No refresh token requests were made!');
    } else {
      for (const log of refreshRequests) {
        console.log(`\nRequest: ${log.method} ${log.url}`);
        console.log(`  Cookie header sent: ${log.cookies}`);
        if (!log.cookies.includes('refreshToken')) {
          console.log('  ❌ refreshToken NOT included in cookie header!');
        } else {
          console.log('  ✅ refreshToken IS in cookie header');
        }
      }
    }

    for (const log of refreshResponses) {
      console.log(`\nResponse: ${log.status} ${log.url}`);
      if (log.status >= 400) {
        console.log(`  ❌ Refresh failed with status ${log.status}`);
      }
      if (log.body) {
        console.log(`  Body: ${log.body}`);
      }
    }

    // Show all auth requests
    console.log('\n========== All Auth-Related Requests After Refresh ==========');
    for (const log of requestLogs) {
      if (log.url.includes('/auth/')) {
        console.log(`${log.method} ${log.url.replace(PROD_API, '')}`);
        console.log(`  Cookies: ${log.cookies.substring(0, 100)}...`);
      }
    }
    for (const log of responseLogs) {
      if (log.url.includes('/auth/')) {
        console.log(`  -> ${log.status}`);
      }
    }

    console.log('\n========== STEP 5: Check Final State ==========');
    const finalCookies = await context.cookies();
    const finalRefreshToken = finalCookies.find(c => c.name === 'refreshToken');
    console.log(`Refresh token cookie after refresh: ${finalRefreshToken ? '✅ present' : '❌ MISSING'}`);

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    const redirectedToLogin = finalUrl.includes('/login');
    console.log(`Redirected to login: ${redirectedToLogin ? '❌ YES - AUTH FAILED' : '✅ No'}`);

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
    console.log(`LocalStorage auth valid: ${isAuthenticated ? '✅' : '❌'}`);

    console.log('\n========== DIAGNOSIS ==========');
    if (!refreshTokenCookie) {
      console.log('❌ PROBLEM: No refreshToken cookie was set during login.');
      console.log('   CHECK: Backend Set-Cookie header should include domain=.nomadcrew.uk');
    } else if (refreshRequests.length === 0) {
      console.log('❌ PROBLEM: Frontend did not call the refresh endpoint.');
      console.log('   CHECK: Frontend auth logic may not be triggering refresh');
    } else if (refreshRequests.length > 0 && !refreshRequests[0].cookies.includes('refreshToken')) {
      console.log('❌ PROBLEM: Cookie was set but not sent with refresh request.');
      console.log('   CHECK: Cookie domain/path mismatch or SameSite blocking');
      console.log(`   Cookie domain: ${refreshTokenCookie.domain}`);
      console.log(`   Cookie path: ${refreshTokenCookie.path}`);
      console.log(`   Request URL: ${refreshRequests[0].url}`);
    } else if (refreshResponses.length > 0 && refreshResponses[0].status >= 400) {
      console.log(`❌ PROBLEM: Refresh request failed with status ${refreshResponses[0].status}`);
      console.log('   CHECK: Backend refresh endpoint may have an issue');
      console.log(`   Response: ${refreshResponses[0].body}`);
    } else if (redirectedToLogin) {
      console.log('❌ PROBLEM: Session was not restored after page refresh.');
      console.log('   CHECK: Frontend may not be handling refresh response correctly');
    } else {
      console.log('✅ Auth flow appears to be working!');
    }

    // Keep browser open for manual inspection
    console.log('\n========== Browser will stay open for 30 seconds for manual inspection ==========');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await browser.close();
  }
}

debugAuth().catch(console.error);
