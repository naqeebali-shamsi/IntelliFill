/**
 * Global Setup - Runs before all test projects
 *
 * Verifies API health and test user existence before running tests.
 */
import { test as setup, expect } from '@playwright/test';
import { testUsers as testUsersData } from './data';

const apiURL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002/api';

interface TestUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  data?: {
    user: unknown;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
  error?: string;
}

interface VerificationResult {
  user: string;
  email: string;
  success: boolean;
  error?: string;
}

/**
 * Verifies that a single test user can successfully authenticate via the API.
 * Makes a POST request to /api/auth/v2/login and validates the response.
 */
async function verifyUserLogin(
  userKey: string,
  user: TestUser
): Promise<VerificationResult> {
  try {
    const response = await fetch(`${apiURL}/auth/v2/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return {
        user: userKey,
        email: user.email,
        success: false,
        error: errorMessage,
      };
    }

    const data: LoginResponse = await response.json();

    if (!data.success) {
      return {
        user: userKey,
        email: user.email,
        success: false,
        error: data.error || 'Login response indicated failure',
      };
    }

    if (!data.data?.tokens?.accessToken) {
      return {
        user: userKey,
        email: user.email,
        success: false,
        error: 'Login succeeded but no access token received',
      };
    }

    return {
      user: userKey,
      email: user.email,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      user: userKey,
      email: user.email,
      success: false,
      error: `Network error: ${errorMessage}`,
    };
  }
}

/**
 * Verifies all test users can successfully authenticate before running tests.
 * Throws a descriptive error if any user fails verification.
 */
async function verifyTestUsers(): Promise<void> {
  const testUsers = testUsersData.testUsers as Record<string, TestUser>;
  const userEntries = Object.entries(testUsers);

  console.log(`[Global Setup] Verifying ${userEntries.length} test users...`);

  const results: VerificationResult[] = [];

  // Verify each user sequentially to avoid rate limiting
  for (const [userKey, user] of userEntries) {
    const result = await verifyUserLogin(userKey, user);
    results.push(result);

    if (result.success) {
      console.log(`  [OK] ${userKey} (${user.email})`);
    } else {
      console.error(`  [FAIL] ${userKey} (${user.email}): ${result.error}`);
    }
  }

  const failures = results.filter((r) => !r.success);

  if (failures.length > 0) {
    const failureDetails = failures
      .map((f) => `  - ${f.user} (${f.email}): ${f.error}`)
      .join('\n');

    throw new Error(
      `[Global Setup] ${failures.length} of ${userEntries.length} test users failed verification:\n` +
        `${failureDetails}\n\n` +
        `Troubleshooting:\n` +
        `  1. Ensure the backend is running: cd quikadmin && npm run dev\n` +
        `  2. Run the seed script: cd quikadmin && npm run seed:e2e\n` +
        `  3. Check that Supabase Auth is properly configured\n` +
        `  4. Verify test user credentials in e2e/data/test-users.json`
    );
  }

  console.log(`[Global Setup] All ${userEntries.length} test users verified successfully`);
}

setup('verify API health', async ({ request }) => {
  console.log('[Global Setup] Verifying API health...');

  try {
    const response = await request.get(`${apiURL.replace('/api', '')}/health`);
    expect(response.ok()).toBeTruthy();
    console.log('[Global Setup] API health check passed');
  } catch (error) {
    console.error('[Global Setup] API health check failed:', error);
    throw new Error(
      `API is not healthy at ${apiURL}. ` +
        `Ensure backend is running: cd quikadmin && npm run dev`
    );
  }
});

setup('verify test users', async ({}) => {
  console.log('[Global Setup] Test users should be seeded by run-e2e-automated.js');
  // Verify each test user can actually log in via the API
  await verifyTestUsers();
});
