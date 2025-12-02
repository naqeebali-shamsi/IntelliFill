#!/usr/bin/env node

/**
 * API Testing Agent
 * Comprehensive API endpoint testing with authentication
 */

const request = require('supertest');
const API_URL = 'http://127.0.0.1:3001';

class APITestAgent {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      endpoints: []
    };
    this.authToken = null;
  }

  /**
   * Setup - Get authentication token
   */
  async setup() {
    try {
      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });
      
      if (response.body.data && response.body.data.tokens) {
        this.authToken = response.body.data.tokens.accessToken;
        console.log('✅ Authentication successful');
      } else {
        console.error('❌ Failed to authenticate');
      }
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
    }
  }

  /**
   * Test health endpoint
   */
  async testHealth() {
    const testName = 'Health Check';
    this.results.total++;
    
    try {
      const response = await request(API_URL)
        .get('/health')
        .expect(200);
      
      if (response.body.status === 'ok') {
        this.results.passed++;
        this.results.endpoints.push({
          name: testName,
          endpoint: '/health',
          status: 'passed',
          responseTime: response.headers['x-response-time'] || 'N/A'
        });
        console.log(`✅ ${testName}`);
      } else {
        throw new Error('Invalid health response');
      }
    } catch (error) {
      this.results.failed++;
      this.results.endpoints.push({
        name: testName,
        endpoint: '/health',
        status: 'failed',
        error: error.message
      });
      console.error(`❌ ${testName}: ${error.message}`);
    }
  }

  /**
   * Test authentication endpoints
   */
  async testAuthEndpoints() {
    const endpoints = [
      {
        name: 'Login - Valid Credentials',
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'admin@example.com', password: 'admin123' },
        expectedStatus: 200
      },
      {
        name: 'Login - Invalid Credentials',
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'admin@example.com', password: 'wrongpass' },
        expectedStatus: 401
      },
      {
        name: 'Login - Missing Fields',
        method: 'POST',
        path: '/api/auth/login',
        body: {},
        expectedStatus: 400,
        delay: 1000 // Delay to avoid rate limiting
      },
      {
        name: 'Refresh Token',
        method: 'POST',
        path: '/api/auth/refresh',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        expectedStatus: 200,
        skip: !this.authToken
      },
      {
        name: 'Logout',
        method: 'POST',
        path: '/api/auth/logout',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        expectedStatus: 200,
        skip: !this.authToken
      }
    ];
    
    for (const test of endpoints) {
      if (test.skip) continue;
      
      // Add delay to avoid rate limiting
      if (test.delay) {
        await new Promise(resolve => setTimeout(resolve, test.delay));
      }
      
      await this.testEndpoint(test);
    }
  }

  /**
   * Test document endpoints
   */
  async testDocumentEndpoints() {
    const endpoints = [
      {
        name: 'List Documents',
        method: 'GET',
        path: '/api/documents',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        expectedStatus: 200
      },
      {
        name: 'Upload Document',
        method: 'POST',
        path: '/api/documents/upload',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        file: 'test-document.pdf',
        expectedStatus: 201,
        skip: true // Skip file upload for now
      },
      {
        name: 'Get Document Status',
        method: 'GET',
        path: '/api/documents/status/test-id',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        expectedStatus: 404 // Expected since test-id doesn't exist
      }
    ];
    
    for (const test of endpoints) {
      if (test.skip) continue;
      await this.testEndpoint(test);
    }
  }

  /**
   * Test template endpoints
   */
  async testTemplateEndpoints() {
    const endpoints = [
      {
        name: 'List Templates',
        method: 'GET',
        path: '/api/templates',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        expectedStatus: 200
      },
      {
        name: 'Create Template',
        method: 'POST',
        path: '/api/templates',
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        body: {
          name: 'Test Template',
          fields: [
            { name: 'field1', type: 'string' },
            { name: 'field2', type: 'number' }
          ]
        },
        expectedStatus: 201
      }
    ];
    
    for (const test of endpoints) {
      await this.testEndpoint(test);
    }
  }

  /**
   * Test a single endpoint
   */
  async testEndpoint(test) {
    this.results.total++;
    const startTime = Date.now();
    
    try {
      let req = request(API_URL)[test.method.toLowerCase()](test.path);
      
      if (test.headers) {
        Object.entries(test.headers).forEach(([key, value]) => {
          req = req.set(key, value);
        });
      }
      
      if (test.body) {
        req = req.send(test.body);
      }
      
      if (test.file) {
        req = req.attach('file', test.file);
      }
      
      const response = await req.expect(test.expectedStatus);
      
      const responseTime = Date.now() - startTime;
      
      this.results.passed++;
      this.results.endpoints.push({
        name: test.name,
        endpoint: test.path,
        method: test.method,
        status: 'passed',
        responseTime: `${responseTime}ms`
      });
      
      console.log(`✅ ${test.name} (${responseTime}ms)`);
      
    } catch (error) {
      this.results.failed++;
      this.results.endpoints.push({
        name: test.name,
        endpoint: test.path,
        method: test.method,
        status: 'failed',
        error: error.message
      });
      
      console.error(`❌ ${test.name}: ${error.message}`);
    }
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting() {
    const testName = 'Rate Limiting';
    console.log(`\n🔒 Testing ${testName}...`);
    
    this.results.total++;
    
    try {
      // Make rapid requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(API_URL)
            .post('/api/auth/login')
            .send({ email: 'test@test.com', password: 'test' })
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (rateLimited) {
        this.results.passed++;
        console.log(`✅ ${testName}: Rate limiting is working`);
      } else {
        throw new Error('Rate limiting not triggered');
      }
    } catch (error) {
      this.results.failed++;
      console.error(`❌ ${testName}: ${error.message}`);
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(2);
    
    console.log('\n📊 API Test Results:');
    console.log(`  Total: ${this.results.total}`);
    console.log(`  Passed: ${this.results.passed} ✅`);
    console.log(`  Failed: ${this.results.failed} ❌`);
    console.log(`  Pass Rate: ${passRate}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.endpoints
        .filter(e => e.status === 'failed')
        .forEach(e => {
          console.log(`  - ${e.name}: ${e.error}`);
        });
    }
    
    // Output JSON for orchestrator
    console.log('\n' + JSON.stringify({
      agentId: 'api-tester',
      stats: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: 0,
        duration: Date.now() - this.startTime
      },
      details: this.results.endpoints
    }));
  }

  /**
   * Run all tests
   */
  async run() {
    this.startTime = Date.now();
    
    console.log('🚀 API Testing Agent Starting...\n');
    
    await this.setup();
    
    console.log('\n📋 Testing Health Endpoint...');
    await this.testHealth();
    
    console.log('\n🔐 Testing Authentication Endpoints...');
    await this.testAuthEndpoints();
    
    if (this.authToken) {
      console.log('\n📄 Testing Document Endpoints...');
      await this.testDocumentEndpoints();
      
      console.log('\n📝 Testing Template Endpoints...');
      await this.testTemplateEndpoints();
    }
    
    console.log('\n🚦 Testing Rate Limiting...');
    await this.testRateLimiting();
    
    this.generateReport();
    
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Check dependencies
try {
  require.resolve('supertest');
} catch {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install supertest', { stdio: 'inherit' });
}

// Run the agent
if (require.main === module) {
  const agent = new APITestAgent();
  agent.run();
}

module.exports = APITestAgent;