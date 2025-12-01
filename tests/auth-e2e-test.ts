/**
 * End-to-End Authentication Test Suite
 * 
 * Tests all authentication scenarios:
 * - User registration (valid, duplicate, invalid data)
 * - User login (valid, invalid credentials)
 * - Protected route access
 * - Session refresh
 * - Logout
 * - Password reset flow
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3002';
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  validateStatus: () => true, // Don't throw on any status
});

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper to log test results
function logTest(name: string, passed: boolean, error?: string, details?: any) {
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
  duplicate: {
    email: '',
    password: 'Test123!',
    fullName: 'Duplicate User',
  },
  invalidEmail: {
    email: 'invalid-email',
    password: 'Test123!',
    fullName: 'Invalid Email User',
  },
  weakPassword: {
    email: `weak-${Date.now()}@example.com`,
    password: 'weak',
    fullName: 'Weak Password User',
  },
};

/**
 * Test 1: User Registration - Valid Data
 */
async function testRegistrationValid() {
  try {
    const response = await api.post('/api/auth/v2/register', testUsers.valid);
    
    if (response.status === 201 && response.data.success) {
      logTest('Registration - Valid Data', true, undefined, {
        userId: response.data.data?.user?.id,
        email: response.data.data?.user?.email,
      });
      // Store email for duplicate test
      testUsers.duplicate.email = testUsers.valid.email;
      return response.data.data;
    } else {
      logTest('Registration - Valid Data', false, `Expected 201, got ${response.status}`, response.data);
      return null;
    }
  } catch (error: any) {
    logTest('Registration - Valid Data', false, error.message);
    return null;
  }
}

/**
 * Test 2: User Registration - Duplicate Email
 */
async function testRegistrationDuplicate() {
  try {
    const response = await api.post('/api/auth/v2/register', testUsers.duplicate);
    
    if (response.status === 409 || (response.status === 400 && response.data.error?.includes('already exists'))) {
      logTest('Registration - Duplicate Email', true);
      return true;
    } else {
      logTest('Registration - Duplicate Email', false, `Expected 409 or 400 with "already exists", got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Registration - Duplicate Email', false, error.message);
    return false;
  }
}

/**
 * Test 3: User Registration - Invalid Email Format
 */
async function testRegistrationInvalidEmail() {
  try {
    const response = await api.post('/api/auth/v2/register', testUsers.invalidEmail);
    
    if (response.status === 400 && response.data.error?.includes('email')) {
      logTest('Registration - Invalid Email Format', true);
      return true;
    } else {
      logTest('Registration - Invalid Email Format', false, `Expected 400 with email error, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Registration - Invalid Email Format', false, error.message);
    return false;
  }
}

/**
 * Test 4: User Registration - Weak Password
 */
async function testRegistrationWeakPassword() {
  try {
    const response = await api.post('/api/auth/v2/register', testUsers.weakPassword);
    
    if (response.status === 400 && response.data.error?.includes('password')) {
      logTest('Registration - Weak Password', true);
      return true;
    } else {
      logTest('Registration - Weak Password', false, `Expected 400 with password error, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Registration - Weak Password', false, error.message);
    return false;
  }
}

/**
 * Test 5: User Login - Valid Credentials
 */
async function testLoginValid(registeredUser?: any) {
  try {
    const credentials = {
      email: testUsers.valid.email,
      password: testUsers.valid.password,
    };
    
    const response = await api.post('/api/auth/v2/login', credentials);
    
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
  } catch (error: any) {
    logTest('Login - Valid Credentials', false, error.message);
    return null;
  }
}

/**
 * Test 6: User Login - Invalid Email
 */
async function testLoginInvalidEmail() {
  try {
    const response = await api.post('/api/auth/v2/login', {
      email: 'nonexistent@example.com',
      password: 'Test123!',
    });
    
    if (response.status === 401) {
      logTest('Login - Invalid Email', true);
      return true;
    } else {
      logTest('Login - Invalid Email', false, `Expected 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Login - Invalid Email', false, error.message);
    return false;
  }
}

/**
 * Test 7: User Login - Wrong Password
 */
async function testLoginWrongPassword() {
  try {
    const response = await api.post('/api/auth/v2/login', {
      email: testUsers.valid.email,
      password: 'WrongPassword123!',
    });
    
    if (response.status === 401) {
      logTest('Login - Wrong Password', true);
      return true;
    } else {
      logTest('Login - Wrong Password', false, `Expected 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Login - Wrong Password', false, error.message);
    return false;
  }
}

/**
 * Test 8: Protected Route Access - Authenticated User
 */
async function testProtectedRouteAuthenticated(loginData: any) {
  try {
    const token = loginData?.tokens?.accessToken;
    if (!token) {
      logTest('Protected Route - Authenticated', false, 'No access token available');
      return false;
    }
    
    const response = await api.get('/api/auth/v2/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (response.status === 200 && response.data.success && response.data.data?.user) {
      logTest('Protected Route - Authenticated User', true, undefined, {
        userId: response.data.data.user.id,
        email: response.data.data.user.email,
      });
      return true;
    } else {
      logTest('Protected Route - Authenticated User', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Protected Route - Authenticated User', false, error.message);
    return false;
  }
}

/**
 * Test 9: Protected Route Access - Unauthenticated User
 */
async function testProtectedRouteUnauthenticated() {
  try {
    const response = await api.get('/api/auth/v2/me');
    
    if (response.status === 401) {
      logTest('Protected Route - Unauthenticated User', true);
      return true;
    } else {
      logTest('Protected Route - Unauthenticated User', false, `Expected 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Protected Route - Unauthenticated User', false, error.message);
    return false;
  }
}

/**
 * Test 10: Session Refresh - Valid Token
 */
async function testSessionRefresh(loginData: any) {
  try {
    const refreshToken = loginData?.tokens?.refreshToken;
    if (!refreshToken) {
      logTest('Session Refresh - Valid Token', false, 'No refresh token available');
      return false;
    }
    
    const response = await api.post('/api/auth/v2/refresh', {
      refreshToken,
    });
    
    if (response.status === 200 && response.data.success && response.data.data?.tokens) {
      logTest('Session Refresh - Valid Token', true, undefined, {
        hasNewAccessToken: !!response.data.data.tokens.accessToken,
        hasNewRefreshToken: !!response.data.data.tokens.refreshToken,
      });
      return response.data.data;
    } else {
      logTest('Session Refresh - Valid Token', false, `Expected 200 with tokens, got ${response.status}`, response.data);
      return null;
    }
  } catch (error: any) {
    logTest('Session Refresh - Valid Token', false, error.message);
    return null;
  }
}

/**
 * Test 11: Logout - Authenticated User
 */
async function testLogout(loginData: any) {
  try {
    const token = loginData?.tokens?.accessToken;
    if (!token) {
      logTest('Logout - Authenticated User', false, 'No access token available');
      return false;
    }
    
    const response = await api.post('/api/auth/v2/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (response.status === 200 && response.data.success) {
      logTest('Logout - Authenticated User', true);
      return true;
    } else {
      logTest('Logout - Authenticated User', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Logout - Authenticated User', false, error.message);
    return false;
  }
}

/**
 * Test 12: Forgot Password - Valid Email
 */
async function testForgotPasswordValid() {
  try {
    const response = await api.post('/api/auth/v2/forgot-password', {
      email: testUsers.valid.email,
    });
    
    // Should always return success (to prevent email enumeration)
    if (response.status === 200 && response.data.success) {
      logTest('Forgot Password - Valid Email', true);
      return true;
    } else {
      logTest('Forgot Password - Valid Email', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Forgot Password - Valid Email', false, error.message);
    return false;
  }
}

/**
 * Test 13: Forgot Password - Invalid Email Format
 */
async function testForgotPasswordInvalidEmail() {
  try {
    const response = await api.post('/api/auth/v2/forgot-password', {
      email: 'invalid-email',
    });
    
    if (response.status === 400) {
      logTest('Forgot Password - Invalid Email Format', true);
      return true;
    } else {
      logTest('Forgot Password - Invalid Email Format', false, `Expected 400, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Forgot Password - Invalid Email Format', false, error.message);
    return false;
  }
}

/**
 * Test 14: Password Reset - Invalid Token (can't test valid token without email)
 */
async function testPasswordResetInvalidToken() {
  try {
    const response = await api.post('/api/auth/v2/reset-password', {
      token: 'invalid-token-12345',
      newPassword: 'NewPassword123!',
    });
    
    // Should fail with invalid token
    if (response.status === 400 || response.status === 401) {
      logTest('Password Reset - Invalid Token', true);
      return true;
    } else {
      logTest('Password Reset - Invalid Token', false, `Expected 400 or 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Password Reset - Invalid Token', false, error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 Starting End-to-End Authentication Tests\n');
  console.log('='.repeat(60));
  
  // Registration tests
  console.log('\n📝 Registration Tests');
  console.log('-'.repeat(60));
  const registeredUser = await testRegistrationValid();
  await testRegistrationDuplicate();
  await testRegistrationInvalidEmail();
  await testRegistrationWeakPassword();
  
  // Login tests
  console.log('\n🔐 Login Tests');
  console.log('-'.repeat(60));
  const loginData = await testLoginValid(registeredUser);
  await testLoginInvalidEmail();
  await testLoginWrongPassword();
  
  // Protected route tests
  console.log('\n🛡️ Protected Route Tests');
  console.log('-'.repeat(60));
  if (loginData) {
    await testProtectedRouteAuthenticated(loginData);
  }
  await testProtectedRouteUnauthenticated();
  
  // Session management tests
  console.log('\n🔄 Session Management Tests');
  console.log('-'.repeat(60));
  if (loginData) {
    await testSessionRefresh(loginData);
    await testLogout(loginData);
  }
  
  // Password reset tests
  console.log('\n🔑 Password Reset Tests');
  console.log('-'.repeat(60));
  await testForgotPasswordValid();
  await testForgotPasswordInvalidEmail();
  await testPasswordResetInvalidToken();
  
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
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
async function main() {
  // Check if backend is running
  try {
    const healthCheck = await axios.get(`${API_BASE_URL}/health`);
    if (healthCheck.status !== 200) {
      console.error('❌ Backend health check failed');
      process.exit(1);
    }
    console.log('✅ Backend is running\n');
  } catch (error: any) {
    console.error('❌ Backend is not running or not accessible');
    console.error(`   URL: ${API_BASE_URL}`);
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
  
  await runAllTests();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runAllTests, testUsers };

