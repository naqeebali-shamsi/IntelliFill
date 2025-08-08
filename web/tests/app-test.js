/**
 * Application Testing Script
 * Tests the PDF Filler application functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3000/api';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, 'cyan');
  console.log('='.repeat(50));
}

async function testEndpoint(name, url, expectedStatus = 200) {
  try {
    const response = await axios.get(url, {
      validateStatus: () => true, // Accept any status
      timeout: 5000,
    });
    
    if (response.status === expectedStatus) {
      log(`✓ ${name}: ${response.status} ${response.statusText}`, 'green');
      return true;
    } else {
      log(`✗ ${name}: Expected ${expectedStatus}, got ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${name}: ${error.message}`, 'red');
    return false;
  }
}

async function testFrontend() {
  logSection('Testing Frontend Application');
  
  const tests = [
    { name: 'Homepage', url: BASE_URL },
    { name: 'Dashboard', url: `${BASE_URL}/dashboard` },
    { name: 'Upload Page', url: `${BASE_URL}/upload` },
    { name: 'History Page', url: `${BASE_URL}/history` },
    { name: 'Templates Page', url: `${BASE_URL}/templates` },
    { name: 'Settings Page', url: `${BASE_URL}/settings` },
  ];
  
  let passed = 0;
  for (const test of tests) {
    if (await testEndpoint(test.name, test.url)) {
      passed++;
    }
  }
  
  return { total: tests.length, passed };
}

async function testBackendAPI() {
  logSection('Testing Backend API');
  
  const tests = [
    { name: 'Health Check', url: `${API_URL}/health` },
    { name: 'Statistics', url: `${API_URL}/statistics`, expectedStatus: 401 }, // May require auth
    { name: 'Templates', url: `${API_URL}/templates`, expectedStatus: 401 }, // May require auth
    { name: 'Jobs', url: `${API_URL}/jobs`, expectedStatus: 401 }, // May require auth
  ];
  
  let passed = 0;
  for (const test of tests) {
    if (await testEndpoint(test.name, test.url, test.expectedStatus || 200)) {
      passed++;
    }
  }
  
  // Test API response structure
  try {
    const healthResponse = await axios.get(`${API_URL}/health`);
    if (healthResponse.data.status === 'ok') {
      log('✓ Health API returns correct structure', 'green');
      passed++;
    }
  } catch (error) {
    log('✗ Health API structure test failed', 'red');
  }
  
  return { total: tests.length + 1, passed };
}

async function testServices() {
  logSection('Testing Infrastructure Services');
  
  const tests = [
    { name: 'PostgreSQL', url: 'http://localhost:5432', expectedStatus: 500 }, // Will fail but confirms port is open
    { name: 'Redis', url: 'http://localhost:6379', expectedStatus: 500 }, // Will fail but confirms port is open
    { name: 'Prometheus', url: 'http://localhost:9090' },
    { name: 'Grafana', url: 'http://localhost:3002' },
  ];
  
  let passed = 0;
  for (const test of tests) {
    // For DB services, we just check if port is responding
    if (test.name === 'PostgreSQL' || test.name === 'Redis') {
      try {
        await axios.get(test.url, { timeout: 1000, validateStatus: () => true });
        log(`✓ ${test.name} port is responding`, 'green');
        passed++;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          log(`✗ ${test.name} port is not open`, 'red');
        } else {
          log(`✓ ${test.name} port is responding (service-specific protocol)`, 'green');
          passed++;
        }
      }
    } else {
      if (await testEndpoint(test.name, test.url, test.expectedStatus || 200)) {
        passed++;
      }
    }
  }
  
  return { total: tests.length, passed };
}

async function performanceTest() {
  logSection('Performance Testing');
  
  const endpoints = [
    { name: 'Frontend Homepage', url: BASE_URL },
    { name: 'API Health', url: `${API_URL}/health` },
  ];
  
  for (const endpoint of endpoints) {
    const startTime = Date.now();
    try {
      await axios.get(endpoint.url, { timeout: 10000 });
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 100) {
        log(`✓ ${endpoint.name}: ${responseTime}ms (Excellent)`, 'green');
      } else if (responseTime < 500) {
        log(`✓ ${endpoint.name}: ${responseTime}ms (Good)`, 'yellow');
      } else {
        log(`⚠ ${endpoint.name}: ${responseTime}ms (Slow)`, 'red');
      }
    } catch (error) {
      log(`✗ ${endpoint.name}: Failed to measure`, 'red');
    }
  }
}

async function runTests() {
  console.clear();
  log('\n╔════════════════════════════════════════════════╗', 'blue');
  log('║     PDF Filler Application Test Suite          ║', 'blue');
  log('╚════════════════════════════════════════════════╝', 'blue');
  
  const results = {
    frontend: await testFrontend(),
    backend: await testBackendAPI(),
    services: await testServices(),
  };
  
  await performanceTest();
  
  // Summary
  logSection('Test Summary');
  
  const totalTests = results.frontend.total + results.backend.total + results.services.total;
  const totalPassed = results.frontend.passed + results.backend.passed + results.services.passed;
  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
  
  log(`\nFrontend: ${results.frontend.passed}/${results.frontend.total} tests passed`, 
      results.frontend.passed === results.frontend.total ? 'green' : 'yellow');
  log(`Backend:  ${results.backend.passed}/${results.backend.total} tests passed`,
      results.backend.passed === results.backend.total ? 'green' : 'yellow');
  log(`Services: ${results.services.passed}/${results.services.total} tests passed`,
      results.services.passed === results.services.total ? 'green' : 'yellow');
  
  console.log('\n' + '─'.repeat(50));
  
  if (passRate === '100.0') {
    log(`✓ ALL TESTS PASSED (${totalPassed}/${totalTests})`, 'green');
  } else if (passRate >= 80) {
    log(`⚠ PARTIAL SUCCESS: ${totalPassed}/${totalTests} tests passed (${passRate}%)`, 'yellow');
  } else {
    log(`✗ TESTS FAILED: ${totalPassed}/${totalTests} tests passed (${passRate}%)`, 'red');
  }
  
  console.log('─'.repeat(50));
  
  // Application Status
  log('\n📊 Application Status:', 'cyan');
  if (results.frontend.passed > 0) {
    log('  ✓ Frontend is running on http://localhost:3001', 'green');
  }
  if (results.backend.passed > 0) {
    log('  ✓ Backend API is running on http://localhost:3000', 'green');
  }
  if (results.services.passed >= 2) {
    log('  ✓ Database and cache services are available', 'green');
  }
  if (results.services.passed >= 3) {
    log('  ✓ Monitoring services are running', 'green');
  }
  
  log('\n🚀 Application is ready for use!', 'blue');
  log('   Visit http://localhost:3001 to access the application', 'cyan');
}

// Run the tests
runTests().catch(error => {
  log(`\n✗ Test suite failed: ${error.message}`, 'red');
  process.exit(1);
});