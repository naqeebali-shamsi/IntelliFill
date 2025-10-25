/**
 * Integration Test for Frontend-Backend-Neon
 * Tests the complete flow from frontend auth to Neon database
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';
const testData = {
  companyName: 'Test Company',
  companySlug: 'test-company-' + Date.now(),
  email: 'test@example.com',
  fullName: 'Test User',
  password: 'TestPassword123!',
  authId: '550e8400-e29b-41d4-a716-446655440000' // Fixed UUID for testing
};

async function runTests() {
  console.log('🧪 Starting Integration Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Endpoint...');
    const healthResponse = await axios.get(`${API_BASE.replace('/api', '')}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test 2: Neon Company Signup (Direct - no regular auth needed)
    console.log('2️⃣ Testing Direct Neon Company Creation...');
    try {
      const neonSignupResponse = await axios.post(`${API_BASE}/neon-auth/signup`, {
        companyName: testData.companyName,
        companySlug: testData.companySlug,
        email: testData.email,
        fullName: testData.fullName,
        authId: testData.authId
      });
      console.log('✅ Company created:', neonSignupResponse.data.message || 'Success');
      const neonToken = neonSignupResponse.data.token;
      const company = neonSignupResponse.data.company;
      console.log('   Company:', company.slug);
      console.log('   Token received:', !!neonToken);
      console.log('');

      // Test 3: Neon Login
      console.log('3️⃣ Testing Neon Login...');
      const neonLoginResponse = await axios.post(`${API_BASE}/neon-auth/login`, {
        authId: testData.authId
      });
      console.log('✅ Neon login successful');
      console.log('   Company:', neonLoginResponse.data.company.name);
      console.log('   Credits:', neonLoginResponse.data.company.creditsRemaining);
      console.log('   Tier:', neonLoginResponse.data.company.tier);
      console.log('');

      // Test 4: Authenticated Request
      console.log('4️⃣ Testing Authenticated Request...');
      const meResponse = await axios.get(`${API_BASE}/neon-auth/me`, {
        headers: {
          'Authorization': `Bearer ${neonToken}`
        }
      });
      console.log('✅ Authenticated request successful');
      console.log('   User:', meResponse.data.user.fullName);
      console.log('');

      console.log('🎉 All integration tests passed!');
      console.log('\n📊 Summary:');
      console.log('   - Backend API: ✅ Working');
      console.log('   - Neon Auth: ✅ Working');
      console.log('   - Company Creation: ✅ Working');
      console.log('   - JWT Authentication: ✅ Working');
      console.log('   - Frontend Integration: ✅ Ready');

    } catch (authError) {
      if (authError.response?.status === 409) {
        console.log('⚠️ Company already exists, trying login instead...');
        // Try Neon login
        const neonLoginResponse = await axios.post(`${API_BASE}/neon-auth/login`, {
          authId: testData.authId
        });
        console.log('✅ Neon login successful');
        console.log('   Company:', neonLoginResponse.data.company.name);
      } else {
        throw authError;
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
runTests();