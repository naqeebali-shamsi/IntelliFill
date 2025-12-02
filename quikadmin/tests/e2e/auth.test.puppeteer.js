/**
 * End-to-End Authentication Test Suite
 * Tests login, registration, JWT token handling, and protected routes
 */

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  apiUrl: 'http://localhost:3000',
  timeout: 30000,
  testUser: {
    email: `test${Date.now()}@example.com`,
    password: 'Test@123456',
    fullName: 'Test User'
  }
};

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  environment: {
    frontend: TEST_CONFIG.baseUrl,
    backend: TEST_CONFIG.apiUrl
  },
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

function logTest(name, status, details = {}) {
  const result = {
    name,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };
  testResults.tests.push(result);
  testResults.summary.total++;
  if (status === 'passed') testResults.summary.passed++;
  if (status === 'failed') testResults.summary.failed++;
  
  console.log(`[${status.toUpperCase()}] ${name}`);
  if (details.error) console.error(`  Error: ${details.error}`);
  if (details.message) console.log(`  ${details.message}`);
}

async function testBackendHealth() {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      logTest('Backend Health Check', 'passed', { 
        message: 'Backend is healthy',
        response: data 
      });
      return true;
    } else {
      logTest('Backend Health Check', 'failed', { 
        error: 'Backend not healthy',
        response: data 
      });
      return false;
    }
  } catch (error) {
    logTest('Backend Health Check', 'failed', { 
      error: error.message 
    });
    return false;
  }
}

async function testRegistrationAPI() {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CONFIG.testUser)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      logTest('Registration API', 'passed', {
        message: 'User registered successfully',
        userId: data.data?.user?.id
      });
      return data.data;
    } else {
      logTest('Registration API', 'failed', {
        error: data.error || 'Registration failed',
        status: response.status
      });
      return null;
    }
  } catch (error) {
    logTest('Registration API', 'failed', {
      error: error.message
    });
    return null;
  }
}

async function testLoginAPI(email, password) {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      logTest('Login API', 'passed', {
        message: 'Login successful',
        hasAccessToken: !!data.data?.tokens?.accessToken,
        hasRefreshToken: !!data.data?.tokens?.refreshToken
      });
      return data.data;
    } else {
      logTest('Login API', 'failed', {
        error: data.error || 'Login failed',
        status: response.status
      });
      return null;
    }
  } catch (error) {
    logTest('Login API', 'failed', {
      error: error.message
    });
    return null;
  }
}

async function testProtectedRoute(token) {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      logTest('Protected Route Access', 'passed', {
        message: 'Successfully accessed protected route',
        userEmail: data.data?.user?.email
      });
      return true;
    } else {
      logTest('Protected Route Access', 'failed', {
        error: data.error || 'Access denied',
        status: response.status
      });
      return false;
    }
  } catch (error) {
    logTest('Protected Route Access', 'failed', {
      error: error.message
    });
    return false;
  }
}

async function testTokenRefresh(refreshToken) {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      logTest('Token Refresh', 'passed', {
        message: 'Token refreshed successfully',
        hasNewAccessToken: !!data.data?.tokens?.accessToken
      });
      return data.data?.tokens;
    } else {
      logTest('Token Refresh', 'failed', {
        error: data.error || 'Refresh failed',
        status: response.status
      });
      return null;
    }
  } catch (error) {
    logTest('Token Refresh', 'failed', {
      error: error.message
    });
    return null;
  }
}

async function testLogout(token, refreshToken) {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      logTest('Logout', 'passed', {
        message: 'Logout successful'
      });
      return true;
    } else {
      logTest('Logout', 'failed', {
        error: data.error || 'Logout failed',
        status: response.status
      });
      return false;
    }
  } catch (error) {
    logTest('Logout', 'failed', {
      error: error.message
    });
    return false;
  }
}

async function testInvalidLogin() {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      logTest('Invalid Login Rejection', 'passed', {
        message: 'Invalid credentials properly rejected'
      });
      return true;
    } else {
      logTest('Invalid Login Rejection', 'failed', {
        error: 'Invalid credentials not rejected properly',
        status: response.status
      });
      return false;
    }
  } catch (error) {
    logTest('Invalid Login Rejection', 'failed', {
      error: error.message
    });
    return false;
  }
}

async function testRateLimiting() {
  const attempts = [];
  
  // Try to login 6 times rapidly (rate limit is 5)
  for (let i = 0; i < 6; i++) {
    try {
      const response = await fetch(`${TEST_CONFIG.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `ratelimit${i}@example.com`,
          password: 'password'
        })
      });
      
      attempts.push({
        attempt: i + 1,
        status: response.status
      });
      
      if (response.status === 429 && i === 5) {
        logTest('Rate Limiting', 'passed', {
          message: 'Rate limiting working correctly',
          blockedAtAttempt: i + 1
        });
        return true;
      }
    } catch (error) {
      // Continue
    }
  }
  
  logTest('Rate Limiting', 'failed', {
    error: 'Rate limiting not triggered',
    attempts
  });
  return false;
}

// Main test runner
async function runAuthTests() {
  console.log('========================================');
  console.log('AUTHENTICATION TEST SUITE');
  console.log('========================================');
  console.log(`Frontend: ${TEST_CONFIG.baseUrl}`);
  console.log(`Backend: ${TEST_CONFIG.apiUrl}`);
  console.log(`Test User: ${TEST_CONFIG.testUser.email}`);
  console.log('----------------------------------------\n');

  // 1. Test backend health
  const backendHealthy = await testBackendHealth();
  if (!backendHealthy) {
    console.error('\n❌ Backend is not healthy. Stopping tests.');
    return testResults;
  }

  // 2. Test registration
  const registrationData = await testRegistrationAPI();
  
  // 3. Test login with registered user
  let loginData = null;
  if (registrationData) {
    loginData = await testLoginAPI(
      TEST_CONFIG.testUser.email,
      TEST_CONFIG.testUser.password
    );
  }

  // 4. Test protected route access
  if (loginData?.tokens?.accessToken) {
    await testProtectedRoute(loginData.tokens.accessToken);
  }

  // 5. Test token refresh
  let newTokens = null;
  if (loginData?.tokens?.refreshToken) {
    newTokens = await testTokenRefresh(loginData.tokens.refreshToken);
  }

  // 6. Test with new access token
  if (newTokens?.accessToken) {
    await testProtectedRoute(newTokens.accessToken);
  }

  // 7. Test logout
  if (loginData?.tokens) {
    await testLogout(
      newTokens?.accessToken || loginData.tokens.accessToken,
      loginData.tokens.refreshToken
    );
  }

  // 8. Test invalid login
  await testInvalidLogin();

  // 9. Test rate limiting
  await testRateLimiting();

  // Print summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`✅ Passed: ${testResults.summary.passed}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  console.log(`Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  return testResults;
}

// Export for use in other tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAuthTests,
    testResults,
    TEST_CONFIG
  };
}

// Run tests if executed directly
if (typeof window === 'undefined') {
  runAuthTests().then(results => {
    // Save results to file
    const fs = require('fs');
    const path = require('path');
    const resultsPath = path.join(__dirname, 'auth-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
    
    // Exit with appropriate code
    process.exit(results.summary.failed > 0 ? 1 : 0);
  });
}