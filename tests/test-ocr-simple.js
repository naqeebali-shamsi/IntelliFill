// Simple test to verify setup
const axios = require('axios');

console.log('🧪 OCR E2E Test - Simple Connectivity Check\n');
console.log('='.repeat(60));

async function testBackend() {
  try {
    console.log('\n1. Checking backend health...');
    const healthResponse = await axios.get('http://localhost:3002/health', {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (healthResponse.status === 200) {
      console.log('✅ Backend is running');
      console.log('   Status:', healthResponse.data.status);
      return true;
    } else {
      console.log('❌ Backend returned status:', healthResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Backend is NOT running');
    console.log('   Error:', error.message);
    console.log('\n💡 Make sure the backend is running:');
    console.log('   cd quikadmin && npm run dev');
    return false;
  }
}

async function testAuth() {
  try {
    console.log('\n2. Testing authentication...');
    const response = await axios.post('http://localhost:3002/api/auth/v2/login', {
      email: 'newuser@test.com',
      password: 'Admin123!'
    }, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Authentication successful');
      console.log('   User ID:', response.data.data.user.id);
      return response.data.data.tokens.accessToken;
    } else {
      console.log('⚠️  Login failed, will try registration...');
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication test failed');
    console.log('   Error:', error.message);
    return null;
  }
}

async function main() {
  const backendOk = await testBackend();
  if (!backendOk) {
    console.log('\n❌ Cannot proceed - backend is not running');
    process.exit(1);
  }
  
  const token = await testAuth();
  if (token) {
    console.log('\n✅ Ready to run full OCR tests');
    console.log('\n💡 Run full test suite:');
    console.log('   npm run test:ocr-e2e');
  } else {
    console.log('\n⚠️  Authentication issue - tests may fail');
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

