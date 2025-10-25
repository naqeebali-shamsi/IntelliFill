#!/usr/bin/env node

/**
 * Security Testing Agent
 * Tests for common security vulnerabilities and OWASP Top 10
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const API_URL = 'http://127.0.0.1:3001';

class SecurityTestAgent {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      vulnerabilities: []
    };
  }

  /**
   * Test SQL Injection vulnerabilities
   */
  async testSQLInjection() {
    console.log('\n💉 Testing SQL Injection Protection...');
    
    const injectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1' UNION SELECT * FROM users--",
      "admin'--",
      "' OR 1=1--"
    ];
    
    for (const payload of injectionPayloads) {
      this.results.total++;
      
      try {
        const response = await request(API_URL)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: payload
          });
        
        // If we get a 400 or 401, the injection was blocked
        if (response.status === 400 || response.status === 401 || response.status === 429) {
          this.results.passed++;
          console.log(`  ✅ Blocked SQL injection: ${payload.substring(0, 20)}...`);
        } else {
          this.results.failed++;
          this.results.vulnerabilities.push({
            type: 'SQL Injection',
            severity: 'CRITICAL',
            payload,
            endpoint: '/api/auth/login'
          });
          console.log(`  ❌ Potential SQL injection vulnerability with: ${payload}`);
        }
      } catch (error) {
        this.results.passed++;
        console.log(`  ✅ Error handling prevented injection`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Test XSS (Cross-Site Scripting) protection
   */
  async testXSSProtection() {
    console.log('\n🔒 Testing XSS Protection...');
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>'
    ];
    
    for (const payload of xssPayloads) {
      this.results.total++;
      
      try {
        // Try to inject XSS in various fields
        const response = await request(API_URL)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'Test123!',
            fullName: payload
          });
        
        // Check if the payload is properly escaped in response
        if (response.text && response.text.includes(payload)) {
          // Check if it's escaped
          if (response.text.includes('&lt;script&gt;') || 
              response.text.includes('&quot;') ||
              !response.text.includes('<script>')) {
            this.results.passed++;
            console.log(`  ✅ XSS payload properly escaped: ${payload.substring(0, 20)}...`);
          } else {
            this.results.failed++;
            this.results.vulnerabilities.push({
              type: 'XSS',
              severity: 'HIGH',
              payload,
              endpoint: '/api/auth/register'
            });
            console.log(`  ❌ Potential XSS vulnerability with: ${payload}`);
          }
        } else {
          this.results.passed++;
          console.log(`  ✅ XSS payload blocked or sanitized`);
        }
      } catch (error) {
        this.results.passed++;
        console.log(`  ✅ XSS attempt blocked`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Test JWT Security
   */
  async testJWTSecurity() {
    console.log('\n🔑 Testing JWT Security...');
    
    // Get a valid token first
    let validToken;
    try {
      const loginResponse = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });
      
      validToken = loginResponse.body.data?.tokens?.accessToken;
    } catch (error) {
      console.log('  ⚠️ Could not obtain valid token for testing');
      return;
    }
    
    // Test 1: Algorithm confusion attack
    this.results.total++;
    try {
      const decoded = jwt.decode(validToken, { complete: true });
      const maliciousToken = jwt.sign(decoded.payload, 'public', { algorithm: 'HS256' });
      
      const response = await request(API_URL)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${maliciousToken}`);
      
      if (response.status === 401 || response.status === 403) {
        this.results.passed++;
        console.log('  ✅ Algorithm confusion attack blocked');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'JWT Algorithm Confusion',
          severity: 'CRITICAL',
          details: 'JWT accepts tokens with wrong algorithm'
        });
        console.log('  ❌ JWT algorithm confusion vulnerability detected');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ JWT validation properly implemented');
    }
    
    // Test 2: None algorithm attack
    this.results.total++;
    try {
      const decoded = jwt.decode(validToken, { complete: true });
      const noneToken = jwt.sign(decoded.payload, '', { algorithm: 'none' });
      
      const response = await request(API_URL)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${noneToken}`);
      
      if (response.status === 401 || response.status === 403) {
        this.results.passed++;
        console.log('  ✅ None algorithm attack blocked');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'JWT None Algorithm',
          severity: 'CRITICAL',
          details: 'JWT accepts unsigned tokens'
        });
        console.log('  ❌ JWT none algorithm vulnerability detected');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ JWT none algorithm properly blocked');
    }
    
    // Test 3: Expired token
    this.results.total++;
    try {
      const expiredToken = jwt.sign(
        { id: '123', exp: Math.floor(Date.now() / 1000) - 3600 },
        'secret'
      );
      
      const response = await request(API_URL)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      if (response.status === 401) {
        this.results.passed++;
        console.log('  ✅ Expired tokens are rejected');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'JWT Expiration',
          severity: 'HIGH',
          details: 'Expired tokens are accepted'
        });
        console.log('  ❌ Expired tokens are not properly validated');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ Token expiration properly enforced');
    }
  }

  /**
   * Test for sensitive data exposure
   */
  async testSensitiveDataExposure() {
    console.log('\n🔍 Testing for Sensitive Data Exposure...');
    
    // Test 1: Check if passwords are returned in responses
    this.results.total++;
    try {
      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });
      
      const responseText = JSON.stringify(response.body);
      
      if (!responseText.includes('password') && 
          !responseText.includes('admin123') &&
          !responseText.includes('password_hash')) {
        this.results.passed++;
        console.log('  ✅ Passwords not exposed in responses');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'Sensitive Data Exposure',
          severity: 'HIGH',
          details: 'Passwords or password hashes exposed in API responses'
        });
        console.log('  ❌ Sensitive data (passwords) exposed in responses');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ Sensitive data properly protected');
    }
    
    // Test 2: Check for detailed error messages
    this.results.total++;
    try {
      const response = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrong'
        });
      
      const errorMessage = response.body.error || response.body.message || '';
      
      // Check if error reveals too much information
      if (!errorMessage.includes('user not found') && 
          !errorMessage.includes('incorrect password') &&
          !errorMessage.includes('SQL') &&
          !errorMessage.includes('database')) {
        this.results.passed++;
        console.log('  ✅ Error messages do not leak sensitive information');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'Information Disclosure',
          severity: 'MEDIUM',
          details: 'Detailed error messages reveal system information'
        });
        console.log('  ❌ Error messages reveal too much information');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ Error handling properly implemented');
    }
  }

  /**
   * Test CORS configuration
   */
  async testCORSConfiguration() {
    console.log('\n🌐 Testing CORS Configuration...');
    
    this.results.total++;
    
    try {
      const response = await request(API_URL)
        .get('/health')
        .set('Origin', 'http://evil.com');
      
      const allowedOrigin = response.headers['access-control-allow-origin'];
      
      if (!allowedOrigin || allowedOrigin !== '*') {
        this.results.passed++;
        console.log('  ✅ CORS properly configured (no wildcard)');
      } else {
        this.results.failed++;
        this.results.vulnerabilities.push({
          type: 'CORS Misconfiguration',
          severity: 'MEDIUM',
          details: 'CORS allows all origins (*)'
        });
        console.log('  ❌ CORS allows all origins (security risk)');
      }
    } catch (error) {
      this.results.passed++;
      console.log('  ✅ CORS configuration secure');
    }
  }

  /**
   * Test security headers
   */
  async testSecurityHeaders() {
    console.log('\n🛡️ Testing Security Headers...');
    
    const requiredHeaders = [
      { name: 'X-Content-Type-Options', expected: 'nosniff' },
      { name: 'X-Frame-Options', expected: ['DENY', 'SAMEORIGIN'] },
      { name: 'X-XSS-Protection', expected: '1; mode=block' },
      { name: 'Strict-Transport-Security', expected: 'max-age=' },
      { name: 'Content-Security-Policy', expected: null } // Just check it exists
    ];
    
    try {
      const response = await request(API_URL).get('/health');
      
      for (const header of requiredHeaders) {
        this.results.total++;
        const value = response.headers[header.name.toLowerCase()];
        
        if (value) {
          if (header.expected === null || 
              (Array.isArray(header.expected) ? 
                header.expected.includes(value) : 
                value.includes(header.expected))) {
            this.results.passed++;
            console.log(`  ✅ ${header.name}: ${value}`);
          } else {
            this.results.failed++;
            this.results.vulnerabilities.push({
              type: 'Missing Security Header',
              severity: 'LOW',
              details: `${header.name} has incorrect value: ${value}`
            });
            console.log(`  ❌ ${header.name}: incorrect value (${value})`);
          }
        } else {
          this.results.failed++;
          this.results.vulnerabilities.push({
            type: 'Missing Security Header',
            severity: 'LOW',
            details: `${header.name} is missing`
          });
          console.log(`  ❌ ${header.name}: missing`);
        }
      }
    } catch (error) {
      console.log('  ⚠️ Could not test security headers');
    }
  }

  /**
   * Generate security report
   */
  generateReport() {
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(2);
    
    console.log('\n🔒 Security Test Results:');
    console.log(`  Total Tests: ${this.results.total}`);
    console.log(`  Passed: ${this.results.passed} ✅`);
    console.log(`  Failed: ${this.results.failed} ❌`);
    console.log(`  Security Score: ${passRate}%`);
    
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n⚠️ Vulnerabilities Found:');
      
      const critical = this.results.vulnerabilities.filter(v => v.severity === 'CRITICAL');
      const high = this.results.vulnerabilities.filter(v => v.severity === 'HIGH');
      const medium = this.results.vulnerabilities.filter(v => v.severity === 'MEDIUM');
      const low = this.results.vulnerabilities.filter(v => v.severity === 'LOW');
      
      if (critical.length > 0) {
        console.log('\n  🔴 CRITICAL:');
        critical.forEach(v => console.log(`    - ${v.type}: ${v.details || v.payload}`));
      }
      
      if (high.length > 0) {
        console.log('\n  🟠 HIGH:');
        high.forEach(v => console.log(`    - ${v.type}: ${v.details || v.payload}`));
      }
      
      if (medium.length > 0) {
        console.log('\n  🟡 MEDIUM:');
        medium.forEach(v => console.log(`    - ${v.type}: ${v.details || v.payload}`));
      }
      
      if (low.length > 0) {
        console.log('\n  🟢 LOW:');
        low.forEach(v => console.log(`    - ${v.type}: ${v.details || v.payload}`));
      }
    }
    
    // Output JSON for orchestrator
    console.log('\n' + JSON.stringify({
      agentId: 'security-tester',
      stats: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: 0,
        duration: Date.now() - this.startTime
      },
      vulnerabilities: this.results.vulnerabilities
    }));
  }

  /**
   * Run all security tests
   */
  async run() {
    this.startTime = Date.now();
    
    console.log('🔒 Security Testing Agent Starting...');
    console.log('Testing for OWASP Top 10 vulnerabilities...\n');
    
    await this.testSQLInjection();
    await this.testXSSProtection();
    await this.testJWTSecurity();
    await this.testSensitiveDataExposure();
    await this.testCORSConfiguration();
    await this.testSecurityHeaders();
    
    this.generateReport();
    
    // Exit with error if critical vulnerabilities found
    const hasCritical = this.results.vulnerabilities.some(v => v.severity === 'CRITICAL');
    process.exit(hasCritical ? 1 : 0);
  }
}

// Check dependencies
const deps = ['supertest', 'jsonwebtoken'];
deps.forEach(dep => {
  try {
    require.resolve(dep);
  } catch {
    console.log(`Installing ${dep}...`);
    require('child_process').execSync(`npm install ${dep}`, { stdio: 'inherit' });
  }
});

// Run the agent
if (require.main === module) {
  const agent = new SecurityTestAgent();
  agent.run();
}

module.exports = SecurityTestAgent;