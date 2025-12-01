/**
 * Password Reset Flow Test Script
 *
 * Tests the complete forgot password / reset password flow
 * Run with: node tests/test-password-reset.js
 */

const axios = require('axios');

// Simple color helpers (without chalk dependency)
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: {
    cyan: (text) => `\x1b[1m\x1b[36m${text}\x1b[0m`
  }
};
const chalk = colors;

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const AUTH_BASE = `${API_BASE_URL}/auth/v2`;

// Test configuration
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const NEW_PASSWORD = 'NewPassword456!';

// Test results tracker
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Helper function to log test results
 */
function logTest(name, passed, message = '') {
  const status = passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  console.log(`${status} - ${name}`);
  if (message) {
    console.log(`  ${chalk.gray(message)}`);
  }

  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

/**
 * Helper function to make API requests
 */
async function apiRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: endpoint,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Test Suite 1: Forgot Password Flow
 */
async function testForgotPasswordFlow() {
  console.log(chalk.blue('\n📧 Test Suite 1: Forgot Password Flow\n'));

  // Test 1.1: Valid email submission
  const result1 = await apiRequest('POST', `${AUTH_BASE}/forgot-password`, {
    email: TEST_EMAIL
  });

  logTest(
    'Valid email submission',
    result1.success && result1.data.success,
    result1.success ? 'Reset email request processed' : `Error: ${JSON.stringify(result1.error)}`
  );

  // Test 1.2: Non-existent email (should still return success to prevent enumeration)
  const result2 = await apiRequest('POST', `${AUTH_BASE}/forgot-password`, {
    email: 'nonexistent@example.com'
  });

  logTest(
    'Non-existent email (security check)',
    result2.success && result2.data.success,
    'Generic success message returned (prevents email enumeration)'
  );

  // Test 1.3: Invalid email format
  const result3 = await apiRequest('POST', `${AUTH_BASE}/forgot-password`, {
    email: 'notanemail'
  });

  logTest(
    'Invalid email format validation',
    !result3.success && result3.status === 400,
    result3.error?.error || 'Invalid email rejected'
  );

  // Test 1.4: Empty email field
  const result4 = await apiRequest('POST', `${AUTH_BASE}/forgot-password`, {
    email: ''
  });

  logTest(
    'Empty email validation',
    !result4.success && result4.status === 400,
    result4.error?.error || 'Empty email rejected'
  );

  // Test 1.5: Rate limiting (requires 6 rapid requests)
  console.log(chalk.yellow('\n  ⏱️  Testing rate limiting (5 rapid requests)...'));

  let rateLimitHit = false;
  for (let i = 0; i < 6; i++) {
    const rateLimitTest = await apiRequest('POST', `${AUTH_BASE}/forgot-password`, {
      email: 'ratelimit@example.com'
    });

    if (rateLimitTest.status === 429) {
      rateLimitHit = true;
      break;
    }
  }

  logTest(
    'Rate limiting protection',
    rateLimitHit,
    rateLimitHit ? 'Rate limit triggered after 5 requests' : 'Rate limit may be disabled in development mode'
  );
}

/**
 * Test Suite 2: Password Reset Validation
 */
async function testPasswordResetValidation() {
  console.log(chalk.blue('\n🔐 Test Suite 2: Password Reset Validation\n'));

  // Test 2.1: Missing token
  const result1 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    newPassword: NEW_PASSWORD
  });

  logTest(
    'Missing token validation',
    !result1.success && result1.status === 400,
    result1.error?.error || 'Token required'
  );

  // Test 2.2: Missing password
  const result2 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    token: 'dummy-token'
  });

  logTest(
    'Missing password validation',
    !result2.success && result2.status === 400,
    result2.error?.error || 'Password required'
  );

  // Test 2.3: Weak password (< 8 chars)
  const result3 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    token: 'dummy-token',
    newPassword: 'Short1'
  });

  logTest(
    'Password length validation (< 8 chars)',
    !result3.success && result3.status === 400,
    result3.error?.error || 'Short password rejected'
  );

  // Test 2.4: Password without uppercase
  const result4 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    token: 'dummy-token',
    newPassword: 'alllowercase123'
  });

  logTest(
    'Password uppercase requirement',
    !result4.success && result4.status === 400,
    result4.error?.error || 'Password without uppercase rejected'
  );

  // Test 2.5: Password without lowercase
  const result5 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    token: 'dummy-token',
    newPassword: 'ALLUPPERCASE123'
  });

  logTest(
    'Password lowercase requirement',
    !result5.success && result5.status === 400,
    result5.error?.error || 'Password without lowercase rejected'
  );

  // Test 2.6: Password without number
  const result6 = await apiRequest('POST', `${AUTH_BASE}/reset-password`, {
    token: 'dummy-token',
    newPassword: 'NoNumbersHere'
  });

  logTest(
    'Password number requirement',
    !result6.success && result6.status === 400,
    result6.error?.error || 'Password without number rejected'
  );
}

/**
 * Test Suite 3: Verify Reset Token Endpoint
 */
async function testVerifyResetToken() {
  console.log(chalk.blue('\n🔍 Test Suite 3: Verify Reset Token\n'));

  // Test 3.1: Missing token
  const result1 = await apiRequest('POST', `${AUTH_BASE}/verify-reset-token`, {});

  logTest(
    'Verify missing token',
    !result1.success && result1.status === 400,
    result1.error?.error || 'Token required for verification'
  );

  // Test 3.2: Valid token format (Supabase handles actual verification)
  const result2 = await apiRequest('POST', `${AUTH_BASE}/verify-reset-token`, {
    token: 'dummy-token-for-format-check'
  });

  logTest(
    'Verify token format check',
    result2.success && result2.data.success,
    'Token format validation passes (actual verification happens in Supabase)'
  );
}

/**
 * Test Suite 4: Health Check
 */
async function testHealthEndpoints() {
  console.log(chalk.blue('\n🏥 Test Suite 4: Health Check\n'));

  // Test 4.1: Health endpoint
  const result1 = await apiRequest('GET', `${API_BASE_URL}/health`);

  logTest(
    'Health endpoint',
    result1.success && result1.status === 200,
    result1.success ? `Status: ${result1.data.status}` : 'Health check failed'
  );

  // Test 4.2: Ready endpoint
  const result2 = await apiRequest('GET', `${API_BASE_URL}/ready`);

  logTest(
    'Ready endpoint',
    result2.success && (result2.status === 200 || result2.status === 503),
    result2.success ? `Status: ${result2.data.status}` : 'Ready check unavailable'
  );
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   Password Reset Flow - API Test Suite            ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════╝\n'));

  console.log(chalk.gray(`Testing API at: ${AUTH_BASE}\n`));

  try {
    // Check if server is running
    console.log(chalk.yellow('Checking if backend server is running...\n'));
    const healthCheck = await apiRequest('GET', `${API_BASE_URL}/health`);

    if (!healthCheck.success) {
      console.log(chalk.red('✗ Backend server is not running!'));
      console.log(chalk.yellow('\nPlease start the backend server with:'));
      console.log(chalk.cyan('  cd quikadmin && npm run dev\n'));
      process.exit(1);
    }

    console.log(chalk.green('✓ Backend server is running\n'));

    // Run test suites
    await testHealthEndpoints();
    await testForgotPasswordFlow();
    await testPasswordResetValidation();
    await testVerifyResetToken();

    // Print summary
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║   Test Results Summary                             ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════╝\n'));

    const total = testResults.passed + testResults.failed + testResults.skipped;
    const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

    console.log(chalk.green(`✓ Passed:  ${testResults.passed}`));
    console.log(chalk.red(`✗ Failed:  ${testResults.failed}`));
    console.log(chalk.yellow(`⊘ Skipped: ${testResults.skipped}`));
    console.log(chalk.cyan(`━ Total:   ${total}`));
    console.log(chalk.cyan(`━ Pass Rate: ${passRate}%\n`));

    if (testResults.failed > 0) {
      console.log(chalk.red('❌ Some tests failed. Please review the output above.\n'));
      process.exit(1);
    } else {
      console.log(chalk.green('✅ All tests passed!\n'));

      console.log(chalk.yellow('📝 Next Steps:'));
      console.log(chalk.gray('  1. Configure Supabase email settings'));
      console.log(chalk.gray('  2. Test with real email (requires Supabase setup)'));
      console.log(chalk.gray('  3. Test complete flow end-to-end'));
      console.log(chalk.gray('  4. Run E2E tests with Cypress\n'));

      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Unexpected error during testing:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Run tests
runTests();
