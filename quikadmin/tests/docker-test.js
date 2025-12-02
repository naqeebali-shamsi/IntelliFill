/**
 * Docker-based Integration Test for Security Features
 * This test runs inside a Docker container and validates the new implementations
 */

const axios = require('axios');
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://quikadmin-app-1:3001';

// Test configuration
const tests = {
  passed: 0,
  failed: 0,
  total: 0
};

// Helper function to log test results
function logTest(name, passed, error = null) {
  tests.total++;
  if (passed) {
    tests.passed++;
    console.log(`✅ ${name}: PASSED`);
  } else {
    tests.failed++;
    console.log(`❌ ${name}: FAILED`);
    if (error) console.log(`   Error: ${error.message || error}`);
  }
}

// Test Rate Limiting
async function testRateLimiting() {
  console.log('\n🔒 Testing Rate Limiting...');
  
  try {
    // Test standard API rate limit
    const requests = [];
    for (let i = 0; i < 102; i++) {
      requests.push(axios.get(`${BASE_URL}/health`));
    }
    
    const results = await Promise.allSettled(requests);
    const blocked = results.filter(r => r.status === 'rejected' && r.reason.response?.status === 429);
    
    logTest('Rate Limiting - Should block after 100 requests', blocked.length >= 1);
  } catch (error) {
    logTest('Rate Limiting', false, error);
  }
}

// Test CSRF Protection
async function testCSRF() {
  console.log('\n🛡️ Testing CSRF Protection...');
  
  try {
    // Test missing CSRF token
    try {
      await axios.post(`${BASE_URL}/api/test`, { data: 'test' });
      logTest('CSRF - Should reject without token', false, 'Request succeeded without token');
    } catch (error) {
      logTest('CSRF - Should reject without token', error.response?.status === 403);
    }
    
    // Test GET requests don't need CSRF
    const getResponse = await axios.get(`${BASE_URL}/health`);
    logTest('CSRF - GET requests bypass', getResponse.status === 200);
    
  } catch (error) {
    logTest('CSRF Protection', false, error);
  }
}

// Test Health Check
async function testHealthCheck() {
  console.log('\n❤️ Testing Health Check...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logTest('Health Check - Endpoint available', response.status === 200);
    logTest('Health Check - Returns status', response.data?.status === 'ok');
    logTest('Health Check - Has timestamp', !!response.data?.timestamp);
  } catch (error) {
    logTest('Health Check', false, error);
  }
}

// Test Job Queue API
async function testJobQueue() {
  console.log('\n📊 Testing Job Queue API...');
  
  try {
    // Test job status endpoint (should return 404 for non-existent job)
    try {
      await axios.get(`${BASE_URL}/api/jobs/non-existent-id/status`);
      logTest('Job Queue - Non-existent job', false, 'Should return 404');
    } catch (error) {
      logTest('Job Queue - Non-existent job returns 404', error.response?.status === 404);
    }
    
    // Test queue stats endpoint exists
    try {
      const response = await axios.get(`${BASE_URL}/api/jobs/queue/stats`);
      logTest('Job Queue - Stats endpoint exists', response.status === 200 || response.status === 401);
    } catch (error) {
      // May require auth
      logTest('Job Queue - Stats endpoint requires auth', error.response?.status === 401);
    }
    
  } catch (error) {
    logTest('Job Queue API', false, error);
  }
}

// Main test runner
async function runTests() {
  console.log('🐳 QuikAdmin Docker Integration Tests');
  console.log('======================================');
  console.log(`Testing against: ${BASE_URL}`);
  
  // Wait for services to be ready
  console.log('\n⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Run all tests
  await testHealthCheck();
  await testRateLimiting();
  await testCSRF();
  await testJobQueue();
  
  // Summary
  console.log('\n======================================');
  console.log('📊 Test Summary');
  console.log('======================================');
  console.log(`Total Tests: ${tests.total}`);
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  
  if (tests.failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed!');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});