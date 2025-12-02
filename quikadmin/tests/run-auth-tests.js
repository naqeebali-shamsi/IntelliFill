/**
 * Simple Node.js script to run auth tests
 * Uses axios directly without TypeScript compilation
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3002';
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  validateStatus: () => true,
});

const results = [];

function logTest(name, passed, error, details) {
  results.push({ name, passed, error, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   Details:`, JSON.stringify(details, null, 2));
}

// Test data
const testUsers = {
  valid: {
    email: `test-${Date.now()}@example.com`,
    password: 'Test123!',
    fullName: 'Test User',
  },
};

async function testRegistrationValid() {
  try {
    const response = await api.post('/api/auth/v2/register', testUsers.valid);
    if (response.status === 201 && response.data.success) {
      logTest('Registration - Valid Data', true, undefined, {
        userId: response.data.data?.user?.id,
        email: response.data.data?.user?.email,
      });
      return response.data.data;
    } else {
      logTest('Registration - Valid Data', false, `Expected 201, got ${response.status}`, response.data);
      return null;
    }
  } catch (error) {
    logTest('Registration - Valid Data', false, error.message);
    return null;
  }
}

async function testLoginValid() {
  try {
    const response = await api.post('/api/auth/v2/login', {
      email: testUsers.valid.email,
      password: testUsers.valid.password,
    });
    if (response.status === 200 && response.data.success && response.data.data?.tokens) {
      logTest('Login - Valid Credentials', true, undefined, {
        hasAccessToken: !!response.data.data.tokens.accessToken,
        hasRefreshToken: !!response.data.data.tokens.refreshToken,
      });
      return response.data.data;
    } else {
      logTest('Login - Valid Credentials', false, `Expected 200 with tokens, got ${response.status}`, response.data);
      return null;
    }
  } catch (error) {
    logTest('Login - Valid Credentials', false, error.message);
    return null;
  }
}

async function testProtectedRoute(loginData) {
  try {
    const token = loginData?.tokens?.accessToken;
    if (!token) {
      logTest('Protected Route - Authenticated', false, 'No access token available');
      return false;
    }
    const response = await api.get('/api/auth/v2/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 200 && response.data.success) {
      logTest('Protected Route - Authenticated User', true);
      return true;
    } else {
      logTest('Protected Route - Authenticated User', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error) {
    logTest('Protected Route - Authenticated User', false, error.message);
    return false;
  }
}

async function testLogout(loginData) {
  try {
    const token = loginData?.tokens?.accessToken;
    if (!token) {
      logTest('Logout', false, 'No access token available');
      return false;
    }
    const response = await api.post('/api/auth/v2/logout', {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 200 && response.data.success) {
      logTest('Logout - Authenticated User', true);
      return true;
    } else {
      logTest('Logout - Authenticated User', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error) {
    logTest('Logout - Authenticated User', false, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting Authentication E2E Tests\n');
  console.log('='.repeat(60));
  
  // Check backend
  try {
    await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Backend is running\n');
  } catch (error) {
    console.error('❌ Backend is not running');
    console.error(`   URL: ${API_BASE_URL}`);
    process.exit(1);
  }
  
  console.log('📝 Running Tests');
  console.log('-'.repeat(60));
  
  const registeredUser = await testRegistrationValid();
  const loginData = await testLoginValid();
  if (loginData) {
    await testProtectedRoute(loginData);
    await testLogout(loginData);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary');
  console.log('-'.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);

