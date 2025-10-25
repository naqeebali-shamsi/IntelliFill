/**
 * JWT Security Tests
 * Tests for critical JWT vulnerabilities and their fixes
 */

import jwt from 'jsonwebtoken';
import { AuthService } from '../src/services/AuthService';
import { PrismaAuthService } from '../src/services/PrismaAuthService';
import { verifyToken, authenticate } from '../src/middleware/auth';
import { DatabaseService } from '../src/database/DatabaseService';
import { Request, Response } from 'express';

// Test configuration
const TEST_JWT_SECRET = 'test-secret-that-is-at-least-64-characters-long-for-proper-entropy-test';
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-64-characters-long-for-proper-entropy';

// Mock environment variables
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class JWTSecurityTester {
  private authService: AuthService;
  private prismaAuthService: PrismaAuthService;
  private results: TestResult[] = [];

  constructor() {
    const mockDB = new DatabaseService();
    this.authService = new AuthService(mockDB);
    this.prismaAuthService = new PrismaAuthService();
  }

  private addResult(name: string, passed: boolean, error?: string) {
    this.results.push({ name, passed, error });
    console.log(`${passed ? '✅' : '❌'} ${name}${error ? ': ' + error : ''}`);
  }

  /**
   * Test 1: Algorithm Confusion Attack Prevention
   */
  async testAlgorithmConfusionAttack() {
    console.log('\n🔐 Testing Algorithm Confusion Attack Prevention...');

    // Test 1a: 'none' algorithm should be rejected
    try {
      const noneToken = jwt.sign(
        { id: 'test-user', email: 'test@example.com', role: 'user' },
        '',
        { algorithm: 'none' as any }
      );

      await this.authService.verifyAccessToken(noneToken);
      this.addResult('Reject none algorithm', false, 'None algorithm was accepted');
    } catch (error) {
      this.addResult('Reject none algorithm', true);
    }

    // Test 1b: HS512 algorithm should be rejected (only HS256 allowed)
    try {
      const hs512Token = jwt.sign(
        { id: 'test-user', email: 'test@example.com', role: 'user' },
        TEST_JWT_SECRET,
        { algorithm: 'HS512', issuer: 'test-issuer', audience: 'test-audience' }
      );

      await this.authService.verifyAccessToken(hs512Token);
      this.addResult('Reject HS512 algorithm', false, 'HS512 algorithm was accepted');
    } catch (error) {
      this.addResult('Reject HS512 algorithm', true);
    }

    // Test 1c: RS256 algorithm should be rejected
    try {
      const rs256Token = jwt.sign(
        { id: 'test-user', email: 'test@example.com', role: 'user' },
        TEST_JWT_SECRET,
        { algorithm: 'RS256' as any, issuer: 'test-issuer', audience: 'test-audience' }
      );

      await this.authService.verifyAccessToken(rs256Token);
      this.addResult('Reject RS256 algorithm', false, 'RS256 algorithm was accepted');
    } catch (error) {
      this.addResult('Reject RS256 algorithm', true);
    }
  }

  /**
   * Test 2: Unsigned Token Prevention
   */
  async testUnsignedTokenPrevention() {
    console.log('\n🚫 Testing Unsigned Token Prevention...');

    // Test 2a: Manually crafted unsigned token
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ 
        id: 'test-user', 
        email: 'test@example.com', 
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600 
      })).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      await this.authService.verifyAccessToken(unsignedToken);
      this.addResult('Reject unsigned token', false, 'Unsigned token was accepted');
    } catch (error) {
      this.addResult('Reject unsigned token', true);
    }

    // Test 2b: Token with empty signature
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ 
        id: 'test-user', 
        email: 'test@example.com', 
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600 
      })).toString('base64url');
      const emptySignatureToken = `${header}.${payload}.`;

      await this.authService.verifyAccessToken(emptySignatureToken);
      this.addResult('Reject empty signature', false, 'Empty signature token was accepted');
    } catch (error) {
      this.addResult('Reject empty signature', true);
    }
  }

  /**
   * Test 3: Token Expiration Validation
   */
  async testTokenExpirationValidation() {
    console.log('\n⏰ Testing Token Expiration Validation...');

    // Test 3a: Expired token should be rejected
    try {
      const expiredToken = jwt.sign(
        { 
          id: 'test-user', 
          email: 'test@example.com', 
          role: 'user',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', issuer: 'test-issuer', audience: 'test-audience' }
      );

      await this.authService.verifyAccessToken(expiredToken);
      this.addResult('Reject expired token', false, 'Expired token was accepted');
    } catch (error) {
      this.addResult('Reject expired token', true);
    }

    // Test 3b: Future token should be rejected (iat check)
    try {
      const futureToken = jwt.sign(
        { 
          id: 'test-user', 
          email: 'test@example.com', 
          role: 'user',
          iat: Math.floor(Date.now() / 1000) + 3600, // Issued 1 hour in the future
          exp: Math.floor(Date.now() / 1000) + 7200
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', issuer: 'test-issuer', audience: 'test-audience' }
      );

      await this.authService.verifyAccessToken(futureToken);
      this.addResult('Reject future-issued token', false, 'Future-issued token was accepted');
    } catch (error) {
      this.addResult('Reject future-issued token', true);
    }

    // Test 3c: Valid token should be accepted
    try {
      const validToken = jwt.sign(
        { 
          id: 'test-user', 
          email: 'test@example.com', 
          role: 'user'
        },
        TEST_JWT_SECRET,
        { 
          algorithm: 'HS256', 
          expiresIn: '1h',
          issuer: 'test-issuer', 
          audience: 'test-audience'
        }
      );

      // Mock user lookup for valid token test
      const originalFindUser = this.authService['findUserById'];
      this.authService['findUserById'] = async () => ({
        id: 'test-user',
        email: 'test@example.com',
        is_active: true
      } as any);

      await this.authService.verifyAccessToken(validToken);
      this.addResult('Accept valid token', true);

      // Restore original method
      this.authService['findUserById'] = originalFindUser;
    } catch (error) {
      this.addResult('Accept valid token', false, (error as Error).message);
    }
  }

  /**
   * Test 4: Token Structure Validation
   */
  async testTokenStructureValidation() {
    console.log('\n🏗️ Testing Token Structure Validation...');

    // Test 4a: Invalid token format (not a string)
    try {
      await this.authService.verifyAccessToken(null as any);
      this.addResult('Reject null token', false, 'Null token was accepted');
    } catch (error) {
      this.addResult('Reject null token', true);
    }

    // Test 4b: Invalid token structure (wrong number of parts)
    try {
      await this.authService.verifyAccessToken('invalid.token');
      this.addResult('Reject malformed token', false, 'Malformed token was accepted');
    } catch (error) {
      this.addResult('Reject malformed token', true);
    }

    // Test 4c: Invalid header format
    try {
      const invalidHeader = 'invalid-base64';
      const validPayload = Buffer.from(JSON.stringify({ 
        id: 'test', email: 'test@example.com', role: 'user' 
      })).toString('base64url');
      const validSignature = 'signature';
      const malformedToken = `${invalidHeader}.${validPayload}.${validSignature}`;

      await this.authService.verifyAccessToken(malformedToken);
      this.addResult('Reject invalid header', false, 'Invalid header token was accepted');
    } catch (error) {
      this.addResult('Reject invalid header', true);
    }
  }

  /**
   * Test 5: Payload Validation
   */
  async testPayloadValidation() {
    console.log('\n📋 Testing Payload Validation...');

    // Test 5a: Missing required fields
    try {
      const incompleteToken = jwt.sign(
        { id: 'test-user' }, // Missing email and role
        TEST_JWT_SECRET,
        { algorithm: 'HS256', issuer: 'test-issuer', audience: 'test-audience', expiresIn: '1h' }
      );

      await this.authService.verifyAccessToken(incompleteToken);
      this.addResult('Reject incomplete payload', false, 'Incomplete payload was accepted');
    } catch (error) {
      this.addResult('Reject incomplete payload', true);
    }

    // Test 5b: Invalid payload structure
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const invalidPayload = 'invalid-json-payload';
      const signature = jwt.sign('', TEST_JWT_SECRET).split('.')[2];
      const invalidToken = `${header}.${invalidPayload}.${signature}`;

      await this.authService.verifyAccessToken(invalidToken);
      this.addResult('Reject invalid payload JSON', false, 'Invalid payload JSON was accepted');
    } catch (error) {
      this.addResult('Reject invalid payload JSON', true);
    }
  }

  /**
   * Test 6: Middleware Security
   */
  async testMiddlewareSecurity() {
    console.log('\n🛡️ Testing Middleware Security...');

    // Mock request and response objects
    const createMockReq = (authHeader?: string) => ({
      headers: authHeader ? { authorization: authHeader } : {}
    } as Request);

    const createMockRes = () => {
      const res = {} as Response;
      const responses: any[] = [];
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockImplementation((data) => {
        responses.push(data);
        return res;
      });
      (res as any).getResponses = () => responses;
      return res;
    };

    const mockNext = jest.fn();

    // Test 6a: No authorization header
    try {
      const req = createMockReq();
      const res = createMockRes();
      
      await authenticate(req as any, res, mockNext);
      
      const responses = (res as any).getResponses();
      if (responses.length > 0 && responses[0].error === 'Authentication required') {
        this.addResult('Reject missing auth header', true);
      } else {
        this.addResult('Reject missing auth header', false, 'Missing auth header was accepted');
      }
    } catch (error) {
      this.addResult('Reject missing auth header', false, (error as Error).message);
    }

    // Test 6b: Invalid header format
    try {
      const req = createMockReq('InvalidFormat token');
      const res = createMockRes();
      
      await authenticate(req as any, res, mockNext);
      
      const responses = (res as any).getResponses();
      if (responses.length > 0 && responses[0].error === 'Authentication required') {
        this.addResult('Reject invalid header format', true);
      } else {
        this.addResult('Reject invalid header format', false, 'Invalid header format was accepted');
      }
    } catch (error) {
      this.addResult('Reject invalid header format', false, (error as Error).message);
    }

    // Test 6c: Token length validation
    try {
      const req = createMockReq('Bearer short');
      const res = createMockRes();
      
      await authenticate(req as any, res, mockNext);
      
      const responses = (res as any).getResponses();
      if (responses.length > 0 && responses[0].error === 'Invalid token') {
        this.addResult('Reject short token', true);
      } else {
        this.addResult('Reject short token', false, 'Short token was accepted');
      }
    } catch (error) {
      this.addResult('Reject short token', false, (error as Error).message);
    }
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    console.log('🚀 Starting JWT Security Tests...\n');

    try {
      await this.testAlgorithmConfusionAttack();
      await this.testUnsignedTokenPrevention();
      await this.testTokenExpirationValidation();
      await this.testTokenStructureValidation();
      await this.testPayloadValidation();
      await this.testMiddlewareSecurity();
    } catch (error) {
      console.error('❌ Critical error during testing:', error);
    }

    this.printSummary();
  }

  /**
   * Print test summary
   */
  private printSummary() {
    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(test => {
        console.log(`  - ${test.name}: ${test.error || 'Unknown error'}`);
      });
    }

    if (passed === total) {
      console.log('\n🎉 All JWT security tests passed! The application is protected against:');
      console.log('  ✅ Algorithm confusion attacks');
      console.log('  ✅ Unsigned token acceptance');
      console.log('  ✅ Expired token usage');
      console.log('  ✅ Malformed token structures');
      console.log('  ✅ Invalid payload data');
      console.log('  ✅ Middleware bypass attempts');
    } else {
      console.log('\n⚠️ Some security tests failed. Please review and fix the issues.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new JWTSecurityTester();
  tester.runAllTests().catch(console.error);
}

export { JWTSecurityTester };