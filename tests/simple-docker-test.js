#!/usr/bin/env node
/**
 * Simple Docker Test Runner for Security Features
 * Runs against existing development containers
 */

const http = require('http');

// Configuration
const HOST = 'quikadmin-app-1';
const PORT = 3001;

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[0m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m'
  };
  console.log(`${colors[type]}${message}\x1b[0m`);
}

async function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    log(`✅ ${name}`, 'success');
  } catch (error) {
    results.failed++;
    log(`❌ ${name}: ${error.message}`, 'error');
  }
}

async function runTests() {
  log('\n🐳 Docker Security Tests\n', 'info');
  
  // Test 1: Health Check
  await test('Health endpoint accessible', async () => {
    const res = await makeRequest('/health');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Test 2: Rate Limiting Headers
  await test('Rate limit headers present', async () => {
    const res = await makeRequest('/api/test');
    if (!res.headers['x-ratelimit-limit']) {
      throw new Error('Rate limit headers missing');
    }
  });

  // Test 3: CSRF on POST without token
  await test('CSRF blocks POST without token', async () => {
    const res = await makeRequest('/api/test', 'POST');
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}`);
    }
  });

  // Test 4: Multiple requests for rate limit
  await test('Rate limiting after threshold', async () => {
    let blocked = false;
    // Make 105 requests to trigger rate limit
    for (let i = 0; i < 105; i++) {
      try {
        const res = await makeRequest('/api/test');
        if (res.status === 429) {
          blocked = true;
          break;
        }
      } catch (e) {
        // Ignore connection errors
      }
    }
    if (!blocked) throw new Error('Rate limit not triggered');
  });

  // Summary
  log('\n=============================', 'info');
  log('Test Summary:', 'info');
  log(`Total: ${results.total}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests after delay for services to be ready
setTimeout(runTests, 2000);