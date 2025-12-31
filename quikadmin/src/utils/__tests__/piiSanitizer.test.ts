/**
 * PII Sanitizer Tests
 *
 * Comprehensive unit tests covering:
 * - Field-name based redaction (email, password, name, passportNumber, emiratesId)
 * - Value-based pattern detection (email, phone, Emirates ID formats)
 * - Nested object handling (objects within objects, arrays, mixed arrays)
 * - Edge cases (null, undefined, circular reference protection, primitives)
 * - Preservation of safe data (UUIDs, timestamps, IDs, status fields)
 */

import { sanitizeForLogging } from '../piiSafeLogger';

describe('PII Sanitizer', () => {
  describe('Field-name based redaction', () => {
    it('should redact email field', () => {
      const input = { email: 'user@example.com', userId: 'john' };
      const result = sanitizeForLogging(input);

      expect(result.email).toBe('[REDACTED]');
      expect(result.userId).toBe('john');
    });

    it('should completely remove password field', () => {
      const input = { password: 'secret123', userId: 'john' };
      const result = sanitizeForLogging(input);

      expect(result.password).toBeUndefined();
      expect(result.userId).toBe('john');
    });

    it('should redact name fields (name, firstName, lastName)', () => {
      const input = {
        name: 'John Doe',
        firstName: 'Jane',
        lastName: 'Smith',
        fullName: 'Bob Johnson',
        userId: 'user123',
      };
      const result = sanitizeForLogging(input);

      expect(result.name).toBe('[REDACTED]');
      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.fullName).toBe('[REDACTED]');
      expect(result.userId).toBe('user123');
    });

    it('should redact passportNumber field', () => {
      const input = { passportNumber: 'AB1234567', userId: '123' };
      const result = sanitizeForLogging(input);

      expect(result.passportNumber).toBe('[REDACTED]');
      expect(result.userId).toBe('123');
    });

    it('should redact emiratesId field', () => {
      const input = { emiratesId: '784-1234-1234567-1', status: 'active' };
      const result = sanitizeForLogging(input);

      expect(result.emiratesId).toBe('[REDACTED]');
      expect(result.status).toBe('active');
    });

    it('should remove sensitive fields (secret, token, key, authorization)', () => {
      const input = {
        secret: 'my-secret',
        token: 'jwt-token',
        authorization: 'Bearer token',
        key: 'encryption-key',
        cvv: '123',
        ssn: '123-45-6789',
        data: 'public-data',
      };
      const result = sanitizeForLogging(input);

      expect(result.secret).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.authorization).toBeUndefined();
      expect(result.key).toBeUndefined();
      expect(result.cvv).toBeUndefined();
      expect(result.ssn).toBeUndefined();
      expect(result.data).toBe('public-data');
    });

    it('should redact additional PII fields (phone, address, dob, salary, bankAccount, iban)', () => {
      const input = {
        phone: '+971501234567',
        address: '123 Main St',
        dateOfBirth: '1990-01-01',
        dob: '1990-01-01',
        salary: '50000',
        bankAccount: '1234567890',
        iban: 'AE123456789012345678901',
        status: 'active',
      };
      const result = sanitizeForLogging(input);

      expect(result.phone).toBe('[REDACTED]');
      expect(result.address).toBe('[REDACTED]');
      expect(result.dateOfBirth).toBe('[REDACTED]');
      expect(result.dob).toBe('[REDACTED]');
      expect(result.salary).toBe('[REDACTED]');
      expect(result.bankAccount).toBe('[REDACTED]');
      expect(result.iban).toBe('[REDACTED]');
      expect(result.status).toBe('active');
    });

    it('should handle case-insensitive field names', () => {
      const input = {
        EMAIL: 'user@example.com',
        Password: 'secret',
        NAME: 'John Doe',
        emiratesid: '784-1234-1234567-1',
        status: 'active',
      };
      const result = sanitizeForLogging(input);

      expect(result.EMAIL).toBe('[REDACTED]');
      expect(result.Password).toBeUndefined();
      expect(result.NAME).toBe('[REDACTED]');
      expect(result.emiratesid).toBe('[REDACTED]');
      expect(result.status).toBe('active');
    });

    it('should redact fields matching PII patterns in field names', () => {
      const input = {
        userEmail: 'user@example.com',
        customerName: 'John Doe',
        phoneNumber: '+971501234567',
        passportDoc: 'AB1234567',
        emiratesCard: '784-1234-1234567-1',
        homeAddress: '123 Main St',
        birthDate: '1990-01-01',
        salaryAmount: '50000',
        bankDetails: 'Account 123',
        accountNumber: '1234567890',
        status: 'active',
      };
      const result = sanitizeForLogging(input);

      expect(result.userEmail).toBe('[REDACTED]');
      expect(result.customerName).toBe('[REDACTED]');
      expect(result.phoneNumber).toBe('[REDACTED]');
      expect(result.passportDoc).toBe('[REDACTED]');
      expect(result.emiratesCard).toBe('[REDACTED]');
      expect(result.homeAddress).toBe('[REDACTED]');
      expect(result.birthDate).toBe('[REDACTED]');
      expect(result.salaryAmount).toBe('[REDACTED]');
      expect(result.bankDetails).toBe('[REDACTED]');
      expect(result.accountNumber).toBe('[REDACTED]');
      expect(result.status).toBe('active');
    });

    it('should redact encrypted data fields', () => {
      const input = {
        encryptedData: { nested: 'value' },
        ciphertext: { data: 'encryptedvalue' },
        normalData: 'public',
      };
      const result = sanitizeForLogging(input);

      expect(result.encryptedData).toBe('[ENCRYPTED_DATA]');
      expect(result.ciphertext).toBe('[ENCRYPTED_DATA]');
      expect(result.normalData).toBe('public');
    });
  });

  describe('Value-based pattern detection', () => {
    it('should detect and redact email format in string values', () => {
      const emailInput = { value: 'test@example.com' };
      const emailResult = sanitizeForLogging(emailInput);
      expect(emailResult.value).toBe('[REDACTED_EMAIL]');
    });

    it('should detect various email formats', () => {
      const emails = [
        'simple@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test_user@sub.domain.example.com',
        'admin@localhost.localdomain',
      ];

      emails.forEach((email) => {
        const result = sanitizeForLogging({ value: email });
        expect(result.value).toBe('[REDACTED_EMAIL]');
      });
    });

    it('should detect and redact phone number format', () => {
      const phones = [
        '+971501234567',
        '+12025551234',
        '1234567890',
        '12345678901234',
        '+1-202-555-1234',
        '+1 202 555 1234',
      ];

      phones.forEach((phone) => {
        const result = sanitizeForLogging({ value: phone });
        expect(result.value).toBe('[REDACTED_PHONE]');
      });
    });

    it('should detect and redact Emirates ID format', () => {
      const emiratesIds = ['784-1234-1234567-1', '784-5678-7654321-2', '784-0000-0000000-0'];

      emiratesIds.forEach((id) => {
        const result = sanitizeForLogging({ value: id });
        expect(['[REDACTED_EMIRATES_ID]', '[REDACTED_PHONE]']).toContain(result.value);
      });
    });

    it('should not redact similar but invalid formats', () => {
      const notPII = ['not-an-email', 'missing@domain', '123', 'example.com', '12 34 56'];

      notPII.forEach((value) => {
        const result = sanitizeForLogging({ value });
        expect(result.value).toBe(value);
      });
    });
  });

  describe('Nested object handling', () => {
    it('should handle objects within objects', () => {
      const input = {
        user: {
          email: 'user@example.com',
          profile: {
            name: 'John Doe',
            age: 30,
            address: '123 Main St',
          },
        },
        status: 'active',
      };
      const result = sanitizeForLogging(input);

      expect(result.user.email).toBe('[REDACTED]');
      expect(result.user.profile.name).toBe('[REDACTED]');
      expect(result.user.profile.age).toBe(30);
      expect(result.user.profile.address).toBe('[REDACTED]');
      expect(result.status).toBe('active');
    });

    it('should handle deeply nested objects (3+ levels)', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                email: 'deep@example.com',
                password: 'secret',
                data: 'public',
              },
            },
          },
        },
      };
      const result = sanitizeForLogging(input);

      expect(result.level1.level2.level3.level4.email).toBe('[REDACTED]');
      expect(result.level1.level2.level3.level4.password).toBeUndefined();
      expect(result.level1.level2.level3.level4.data).toBe('public');
    });

    it('should handle arrays of objects', () => {
      const input = {
        users: [
          { email: 'user1@example.com', name: 'User One', id: '1' },
          { email: 'user2@example.com', name: 'User Two', id: '2' },
          { email: 'user3@example.com', name: 'User Three', id: '3' },
        ],
      };
      const result = sanitizeForLogging(input);

      expect(result.users).toHaveLength(3);
      result.users.forEach((user: any) => {
        expect(user.email).toBe('[REDACTED]');
        expect(user.name).toBe('[REDACTED]');
        expect(user.id).toBeDefined();
      });
    });

    it('should handle mixed arrays (primitives and objects)', () => {
      const input = {
        mixedArray: [
          'string-value',
          123,
          { email: 'user@example.com', status: 'active' },
          null,
          { password: 'secret', data: 'public' },
        ],
      };
      const result = sanitizeForLogging(input);

      expect(result.mixedArray[0]).toBe('string-value');
      expect(result.mixedArray[1]).toBe(123);
      expect(result.mixedArray[2].email).toBe('[REDACTED]');
      expect(result.mixedArray[2].status).toBe('active');
      expect(result.mixedArray[3]).toBeNull();
      expect(result.mixedArray[4].password).toBeUndefined();
      expect(result.mixedArray[4].data).toBe('public');
    });

    it('should handle arrays of primitives', () => {
      const input = {
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
        contacts: ['user1@example.com', 'user2@example.com'],
      };
      const result = sanitizeForLogging(input);

      expect(result.numbers).toEqual([1, 2, 3]);
      expect(result.strings).toEqual(['a', 'b', 'c']);
      expect(result.contacts[0]).toBe('[REDACTED_EMAIL]');
      expect(result.contacts[1]).toBe('[REDACTED_EMAIL]');
    });

    it('should handle objects in arrays in objects', () => {
      const input = {
        company: {
          title: 'Acme Corp',
          employees: [
            {
              email: 'john@acme.com',
              fullname: 'John Doe',
              department: {
                title: 'Engineering',
                manager: {
                  email: 'manager@acme.com',
                  fullname: 'Jane Smith',
                },
              },
            },
          ],
        },
      };
      const result = sanitizeForLogging(input);

      expect(result.company.title).toBe('Acme Corp');
      expect(result.company.employees[0].email).toBe('[REDACTED]');
      expect(result.company.employees[0].fullname).toBe('[REDACTED]');
      expect(result.company.employees[0].department.title).toBe('Engineering');
      expect(result.company.employees[0].department.manager.email).toBe('[REDACTED]');
      expect(result.company.employees[0].department.manager.fullname).toBe('[REDACTED]');
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      const input = { value: null as string | null, email: null as string | null };
      const result = sanitizeForLogging(input);

      expect(result.value).toBeNull();
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle undefined values', () => {
      const input = {
        value: undefined as string | undefined,
        email: undefined as string | undefined,
      };
      const result = sanitizeForLogging(input);

      expect(result.value).toBeUndefined();
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle empty objects', () => {
      const input = {};
      const result = sanitizeForLogging(input);

      expect(result).toEqual({});
    });

    it('should handle empty arrays', () => {
      const input = { items: [] as unknown[] };
      const result = sanitizeForLogging(input);

      expect(result.items).toEqual([]);
    });

    it('should protect against circular references with max depth', () => {
      const input: any = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: {
                              data: 'too-deep',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = sanitizeForLogging(input);

      expect(
        result.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.level11
      ).toBe('[MAX_DEPTH]');
    });

    it('should handle non-object primitives', () => {
      expect(sanitizeForLogging('string')).toBe('string');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(true)).toBe(true);
      expect(sanitizeForLogging(false)).toBe(false);
    });

    it('should handle string primitives with PII patterns', () => {
      expect(sanitizeForLogging('test@example.com')).toBe('[REDACTED_EMAIL]');
      expect(sanitizeForLogging('+971501234567')).toBe('[REDACTED_PHONE]');
      const emiratesResult = sanitizeForLogging('784-1234-1234567-1');
      expect(['[REDACTED_EMIRATES_ID]', '[REDACTED_PHONE]']).toContain(emiratesResult);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const input = { createdAt: date };
      const result = sanitizeForLogging(input);

      expect(result.createdAt).toBeDefined();
    });

    it('should handle arrays with null and undefined', () => {
      const input = { items: [null, undefined, 'value', null] };
      const result = sanitizeForLogging(input);

      expect(result.items[0]).toBeNull();
      expect(result.items[1]).toBeUndefined();
      expect(result.items[2]).toBe('value');
      expect(result.items[3]).toBeNull();
    });

    it('should handle objects with numeric keys', () => {
      const input = { 0: 'value0', 1: 'value1', email: 'test@example.com' };
      const result = sanitizeForLogging(input);

      expect(result[0]).toBe('value0');
      expect(result[1]).toBe('value1');
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle objects with special characters in keys', () => {
      const input = {
        'key-with-dash': 'value1',
        'key.with.dot': 'value2',
        'key with space': 'value3',
        'user-email': 'test@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result['key-with-dash']).toBe('value1');
      expect(result['key.with.dot']).toBe('value2');
      expect(result['key with space']).toBe('value3');
      expect(result['user-email']).toBe('[REDACTED]');
    });

    it('should handle empty strings', () => {
      const input = { value: '', email: '' };
      const result = sanitizeForLogging(input);

      expect(result.value).toBe('');
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const input = { data: longString };
      const result = sanitizeForLogging(input);

      expect(result.data).toBe(longString);
    });
  });

  describe('Preservation of safe data', () => {
    it('should preserve numeric IDs', () => {
      const input = {
        id: 123,
        userId: '456',
        orderId: 789,
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.id).toBe(123);
      expect(result.userId).toBe('456');
      expect(result.orderId).toBe(789);
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve timestamps', () => {
      const input = {
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: 1704067200000,
        timestamp: Date.now(),
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(result.updatedAt).toBe(1704067200000);
      expect(result.timestamp).toBe(input.timestamp);
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve status fields', () => {
      const input = {
        status: 'active',
        state: 'pending',
        phase: 'processing',
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.status).toBe('active');
      expect(result.state).toBe('pending');
      expect(result.phase).toBe('processing');
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve boolean flags', () => {
      const input = {
        isActive: true,
        verified: false,
        enabled: true,
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.isActive).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.enabled).toBe(true);
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve non-PII metadata', () => {
      const input = {
        version: '1.0.0',
        type: 'document',
        format: 'pdf',
        size: 1024,
        count: 42,
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.version).toBe('1.0.0');
      expect(result.type).toBe('document');
      expect(result.format).toBe('pdf');
      expect(result.size).toBe(1024);
      expect(result.count).toBe(42);
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve configuration values and remove sensitive ones', () => {
      const input = {
        maxRetries: 3,
        timeout: 5000,
        endpoint: '/api/v1/users',
        method: 'POST',
        secret: 'secret-key',
      };
      const result = sanitizeForLogging(input);

      expect(result.maxRetries).toBe(3);
      expect(result.timeout).toBe(5000);
      expect(result.endpoint).toBe('/api/v1/users');
      expect(result.method).toBe('POST');
      expect(result.secret).toBeUndefined();
    });

    it('should preserve error codes and messages (non-PII)', () => {
      const input = {
        errorCode: 'ERR_VALIDATION_FAILED',
        errorMessage: 'Invalid input provided',
        statusCode: 400,
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.errorCode).toBe('ERR_VALIDATION_FAILED');
      expect(result.errorMessage).toBe('Invalid input provided');
      expect(result.statusCode).toBe(400);
      expect(result.email).toBe('[REDACTED]');
    });

    it('should preserve public URLs', () => {
      const input = {
        url: 'https://example.com/document.pdf',
        apiUrl: 'https://api.example.com',
        email: 'user@example.com',
      };
      const result = sanitizeForLogging(input);

      expect(result.url).toBe('https://example.com/document.pdf');
      expect(result.apiUrl).toBe('https://api.example.com');
      expect(result.email).toBe('[REDACTED]');
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should sanitize a complete user object', () => {
      const input = {
        id: 'user-123',
        email: 'john.doe@example.com',
        password: 'super-secret',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+971501234567',
        emiratesId: '784-1234-1234567-1',
        address: '123 Main St, Dubai',
        dateOfBirth: '1990-01-01',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        role: 'user',
      };
      const result = sanitizeForLogging(input);

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('[REDACTED]');
      expect(result.password).toBeUndefined();
      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
      expect(result.emiratesId).toBe('[REDACTED]');
      expect(result.address).toBe('[REDACTED]');
      expect(result.dateOfBirth).toBe('[REDACTED]');
      expect(result.status).toBe('active');
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(result.role).toBe('user');
    });

    it('should sanitize an API request log', () => {
      const input = {
        method: 'POST',
        path: '/api/users',
        statusCode: 201,
        duration: 142,
        body: {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        },
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer jwt-token-here',
        },
        timestamp: '2025-01-01T00:00:00Z',
      };
      const result = sanitizeForLogging(input);

      expect(result.method).toBe('POST');
      expect(result.path).toBe('/api/users');
      expect(result.statusCode).toBe(201);
      expect(result.duration).toBe(142);
      expect(result.body.email).toBe('[REDACTED]');
      expect(result.body.password).toBeUndefined();
      expect(result.body.name).toBe('[REDACTED]');
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers.authorization).toBeUndefined();
      expect(result.timestamp).toBe('2025-01-01T00:00:00Z');
    });

    it('should sanitize an error log with user context', () => {
      const input = {
        errorCode: 'DB_CONNECTION_FAILED',
        message: 'Failed to connect to database',
        stack: 'Error: Failed to connect...',
        user: {
          id: 'user-456',
          email: 'user@example.com',
          name: 'Error User',
        },
        timestamp: Date.now(),
        severity: 'error',
      };
      const result = sanitizeForLogging(input);

      expect(result.errorCode).toBe('DB_CONNECTION_FAILED');
      expect(result.message).toBe('Failed to connect to database');
      expect(result.stack).toBe('Error: Failed to connect...');
      expect(result.user.id).toBe('user-456');
      expect(result.user.email).toBe('[REDACTED]');
      expect(result.user.name).toBe('[REDACTED]');
      expect(result.timestamp).toBe(input.timestamp);
      expect(result.severity).toBe('error');
    });

    it('should sanitize a document processing log', () => {
      const input = {
        documentId: 'doc-789',
        userId: 'user-123',
        file: 'passport.pdf',
        status: 'processing',
        extractedData: {
          passportNumber: 'AB1234567',
          fullname: 'John Doe',
          dateOfBirth: '1990-01-01',
          emiratesId: '784-1234-1234567-1',
          issueDate: '2020-01-01',
          expiryDate: '2030-01-01',
        },
        metadata: {
          size: 2048,
          mimeType: 'application/pdf',
          uploadedAt: '2025-01-01T00:00:00Z',
        },
      };
      const result = sanitizeForLogging(input);

      expect(result.documentId).toBe('doc-789');
      expect(result.userId).toBe('user-123');
      expect(result.file).toBe('passport.pdf');
      expect(result.status).toBe('processing');
      expect(result.extractedData.passportNumber).toBe('[REDACTED]');
      expect(result.extractedData.fullname).toBe('[REDACTED]');
      expect(result.extractedData.dateOfBirth).toBe('[REDACTED]');
      expect(result.extractedData.emiratesId).toBe('[REDACTED]');
      expect(result.extractedData.issueDate).toBe('2020-01-01');
      expect(result.extractedData.expiryDate).toBe('2030-01-01');
      expect(result.metadata.size).toBe(2048);
      expect(result.metadata.mimeType).toBe('application/pdf');
      expect(result.metadata.uploadedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should sanitize a batch operation log', () => {
      const input = {
        operation: 'batch-user-import',
        totalRecords: 100,
        successCount: 95,
        failureCount: 5,
        failures: [
          {
            record: { email: 'invalid@', name: 'Invalid User' },
            error: 'Invalid email format',
          },
          {
            record: { email: 'duplicate@example.com', name: 'Duplicate User' },
            error: 'Email already exists',
          },
        ],
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2025-01-01T00:05:00Z',
        duration: 300000,
      };
      const result = sanitizeForLogging(input);

      expect(result.operation).toBe('batch-user-import');
      expect(result.totalRecords).toBe(100);
      expect(result.successCount).toBe(95);
      expect(result.failureCount).toBe(5);
      expect(result.failures).toHaveLength(2);
      expect(result.failures[0].record.email).toBe('[REDACTED]');
      expect(result.failures[0].record.name).toBe('[REDACTED]');
      expect(result.failures[0].error).toBe('Invalid email format');
      expect(result.failures[1].record.email).toBe('[REDACTED]');
      expect(result.failures[1].record.name).toBe('[REDACTED]');
      expect(result.failures[1].error).toBe('Email already exists');
      expect(result.startTime).toBe('2025-01-01T00:00:00Z');
      expect(result.endTime).toBe('2025-01-01T00:05:00Z');
      expect(result.duration).toBe(300000);
    });
  });
});
