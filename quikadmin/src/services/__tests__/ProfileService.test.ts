/**
 * Profile Service Unit Tests
 *
 * Tests for the ProfileService class covering:
 * - Profile aggregation from documents
 * - Field deduplication and normalization
 * - Profile saving and retrieval
 * - Manual profile updates
 * - Profile refresh
 * - Profile deletion
 * - Email, phone, SSN normalization
 * - Confidence calculation
 * - Encryption/decryption integration
 * - Error handling
 *
 * @module services/__tests__/ProfileService.test
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { encryptJSON, decryptJSON } from '../../utils/encryption';

// Mock encryption utilities
jest.mock('../../utils/encryption', () => ({
  encryptJSON: jest.fn((data) => `encrypted:${JSON.stringify(data)}`),
  decryptJSON: jest.fn((data) => {
    if (typeof data === 'string' && data.startsWith('encrypted:')) {
      return JSON.parse(data.replace('encrypted:', ''));
    }
    return data;
  }),
}));

// Mock PII-safe logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import ProfileService after mocks are set up
import { ProfileService, AggregatedProfile, ProfileField } from '../ProfileService';

// Import the mocked prisma from utils/prisma (mocked in tests/setup.ts)
import { prisma } from '../../utils/prisma';

// Create reference to mock prisma for test assertions
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    service = new ProfileService();

    // Reset decryptJSON mock to default implementation
    (decryptJSON as jest.Mock).mockImplementation((data) => {
      if (typeof data === 'string' && data.startsWith('encrypted:')) {
        return JSON.parse(data.replace('encrypted:', ''));
      }
      return data;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Profile Aggregation Tests
  // ==========================================================================

  describe('aggregateUserProfile', () => {
    it('should aggregate profile from multiple documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"name":"John Doe","email":"john@example.com"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"phone":"555-1234","email":"john@example.com"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result).toMatchObject({
        userId: 'user-1',
        lastAggregated: expect.any(Date),
        documentCount: 2,
      });

      expect(result.fields.name).toBeDefined();
      expect(result.fields.name.values).toContain('John Doe');
      expect(result.fields.email).toBeDefined();
      expect(result.fields.email.values).toContain('john@example.com');
      expect(result.fields.phone).toBeDefined();
      expect(result.fields.phone.values).toContain('555-1234');
    });

    it('should only aggregate completed documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.aggregateUserProfile('user-1');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should exclude documents without extractedData', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.aggregateUserProfile('user-1');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            extractedData: { not: null },
          }),
        })
      );
    });

    it('should handle documents with no extracted data gracefully', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: null as string | null,
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields).toEqual({});
    });

    it('should skip documents with invalid encrypted data', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'invalid-encrypted-data',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"name":"John Doe"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      (decryptJSON as jest.Mock).mockImplementation((data) => {
        if (data === 'invalid-encrypted-data') {
          throw new Error('Decryption failed');
        }
        return JSON.parse(data.replace('encrypted:', ''));
      });

      const result = await service.aggregateUserProfile('user-1');

      // Should only have data from doc-2
      expect(result.fields.name).toBeDefined();
      expect(result.fields.name.values).toContain('John Doe');
    });

    it('should calculate weighted average confidence', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 80,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 90,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Weighted average: (80 + 90) / 2 = 85
      expect(result.fields.email.confidence).toBe(85);
    });

    it('should track document sources for each field', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.email.sources).toContain('doc-1');
      expect(result.fields.email.sources).toContain('doc-2');
    });

    it('should use most recent processedAt date', async () => {
      const date1 = new Date('2025-01-01');
      const date2 = new Date('2025-01-02');

      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 90,
          processedAt: date1,
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 85,
          processedAt: date2,
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.email.lastUpdated).toEqual(date2);
    });

    it('should handle user with no documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields).toEqual({});
      expect(result.documentCount).toBe(0);
    });

    it('should handle database errors', async () => {
      mockPrisma.document.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.aggregateUserProfile('user-1')).rejects.toThrow(
        'Profile aggregation failed'
      );
    });
  });

  // ==========================================================================
  // Field Normalization Tests
  // ==========================================================================

  describe('Field Normalization', () => {
    it('should normalize field keys', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData:
            'encrypted:{"First Name":"John","Last-Name":"Doe","email_address":"john@example.com"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Keys should be normalized to lowercase with underscores
      expect(result.fields.first_name).toBeDefined();
      expect(result.fields.last_name).toBeDefined();
      expect(result.fields.email_address).toBeDefined();
    });

    it('should extract values from arrays', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"emails":["john@example.com","john.doe@work.com"]}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.emails.values).toContain('john@example.com');
      expect(result.fields.emails.values).toContain('john.doe@work.com');
    });

    it('should convert numbers to strings', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"age":30,"zip":12345}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.age.values).toContain('30');
      expect(result.fields.zip.values).toContain('12345');
    });

    it('should convert booleans to strings', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"verified":true,"active":false}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.verified.values).toContain('true');
      expect(result.fields.active.values).toContain('false');
    });

    it('should flatten nested objects', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"address":{"street":"123 Main St","city":"Boston"}}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.address.values).toContain('123 Main St');
      expect(result.fields.address.values).toContain('Boston');
    });

    it('should skip null and undefined values', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"name":"John","middle":"","last":"   "}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.name).toBeDefined();
      // Empty and whitespace-only values should be filtered out
      expect(result.fields.middle).toBeUndefined();
      expect(result.fields.last).toBeUndefined();
    });
  });

  // ==========================================================================
  // Deduplication Tests
  // ==========================================================================

  describe('Field Deduplication', () => {
    it('should deduplicate email addresses (case-insensitive)', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"email":"John@Example.com"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"email":"john@example.com"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should only have one email (case-insensitive deduplication)
      expect(result.fields.email.values).toHaveLength(1);
    });

    it('should deduplicate phone numbers with different formats', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"phone":"555-1234"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"phone":"(555) 1234"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should only have one phone number (normalized deduplication)
      expect(result.fields.phone.values).toHaveLength(1);
    });

    it('should normalize phone numbers with country code', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"phone":"15551234567"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"phone":"555-123-4567"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should deduplicate (country code stripped from 15551234567 -> 5551234567, matches 555-123-4567 -> 5551234567)
      expect(result.fields.phone.values).toHaveLength(1);
    });

    it('should deduplicate SSN with different formats', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"ssn":"123-45-6789"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"ssn":"123456789"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should only have one SSN (normalized deduplication)
      expect(result.fields.ssn.values).toHaveLength(1);
    });

    it('should deduplicate ID numbers without formatting', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"id":"ABC-123"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"id":"ABC123"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should deduplicate based on digits only
      expect(result.fields.id.values).toHaveLength(1);
    });

    it('should preserve different values', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"name":"John Doe"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          extractedData: 'encrypted:{"name":"Jane Doe"}',
          confidence: 85,
          processedAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should have both names (different values)
      expect(result.fields.name.values).toContain('John Doe');
      expect(result.fields.name.values).toContain('Jane Doe');
    });
  });

  // ==========================================================================
  // Save Profile Tests
  // ==========================================================================

  describe('saveProfile', () => {
    it('should encrypt and save profile data', async () => {
      const mockProfile: AggregatedProfile = {
        userId: 'user-1',
        fields: {
          email: {
            key: 'email',
            values: ['john@example.com'],
            sources: ['doc-1'],
            confidence: 90,
            lastUpdated: new Date(),
          },
        },
        lastAggregated: new Date(),
        documentCount: 1,
      };

      mockPrisma.userProfile.upsert.mockResolvedValue({});

      await service.saveProfile('user-1', mockProfile);

      expect(encryptJSON).toHaveBeenCalledWith(mockProfile.fields);
      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: {
          userId: 'user-1',
          profileData: expect.stringContaining('encrypted:'),
          lastAggregated: mockProfile.lastAggregated,
        },
        update: {
          profileData: expect.stringContaining('encrypted:'),
          lastAggregated: mockProfile.lastAggregated,
        },
      });
    });

    it('should handle save errors', async () => {
      const mockProfile: AggregatedProfile = {
        userId: 'user-1',
        fields: {},
        lastAggregated: new Date(),
        documentCount: 0,
      };

      mockPrisma.userProfile.upsert.mockRejectedValue(new Error('Database error'));

      await expect(service.saveProfile('user-1', mockProfile)).rejects.toThrow(
        'Failed to save profile'
      );
    });
  });

  // ==========================================================================
  // Get Profile Tests
  // ==========================================================================

  describe('getProfile', () => {
    it('should retrieve and decrypt profile data', async () => {
      const lastUpdatedDate = new Date('2025-01-15');
      const mockFields = {
        email: {
          key: 'email',
          values: ['john@example.com'],
          sources: ['doc-1'],
          confidence: 90,
          lastUpdated: lastUpdatedDate.toISOString(),
        },
      };

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
        profileData: `encrypted:${JSON.stringify(mockFields)}`,
        lastAggregated: new Date('2025-01-15'),
      });

      mockPrisma.document.count.mockResolvedValue(5);

      const result = await service.getProfile('user-1');

      expect(result).toMatchObject({
        userId: 'user-1',
        documentCount: 5,
      });
      expect(result?.fields.email.values).toContain('john@example.com');
      expect(decryptJSON).toHaveBeenCalled();
    });

    it('should return null if profile not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('user-1');

      expect(result).toBeNull();
    });

    it('should handle decryption errors', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
        profileData: 'invalid-encrypted-data',
        lastAggregated: new Date(),
      });

      (decryptJSON as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(service.getProfile('user-1')).rejects.toThrow('Failed to retrieve profile');
    });

    it('should handle database errors', async () => {
      mockPrisma.userProfile.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getProfile('user-1')).rejects.toThrow('Failed to retrieve profile');
    });
  });

  // ==========================================================================
  // Update Profile Tests
  // ==========================================================================

  describe('updateProfile', () => {
    it('should update existing profile with new data', async () => {
      const lastUpdated = new Date('2025-01-01');
      const existingFields = {
        email: {
          key: 'email',
          values: ['john@example.com'],
          sources: ['doc-1'],
          confidence: 90,
          lastUpdated: lastUpdated,
        },
      };

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
        profileData: `encrypted:${JSON.stringify(existingFields)}`,
        lastAggregated: new Date('2025-01-15'),
      });

      mockPrisma.document.count.mockResolvedValue(1);
      mockPrisma.userProfile.upsert.mockResolvedValue({});

      const updates = {
        phone: '555-1234',
        email: 'john.doe@example.com', // New email
      };

      const result = await service.updateProfile('user-1', updates);

      expect(result.fields.phone).toBeDefined();
      expect(result.fields.phone.values).toContain('555-1234');
      expect(result.fields.email.values).toContain('john@example.com');
      expect(result.fields.email.values).toContain('john.doe@example.com');
    });

    it('should create new profile if none exists', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.userProfile.upsert.mockResolvedValue({});

      const updates = { name: 'John Doe' };

      const result = await service.updateProfile('user-1', updates);

      expect(result.fields.name).toBeDefined();
      expect(result.fields.name.values).toContain('John Doe');
      expect(result.fields.name.sources).toContain('manual_edit');
      expect(result.fields.name.confidence).toBe(100); // Manual edits have 100% confidence
    });

    it('should not duplicate existing values', async () => {
      const lastUpdated = new Date('2025-01-01');
      const existingFields = {
        email: {
          key: 'email',
          values: ['john@example.com'],
          sources: ['doc-1'],
          confidence: 90,
          lastUpdated: lastUpdated,
        },
      };

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
        profileData: `encrypted:${JSON.stringify(existingFields)}`,
        lastAggregated: new Date('2025-01-15'),
      });

      mockPrisma.document.count.mockResolvedValue(1);
      mockPrisma.userProfile.upsert.mockResolvedValue({});

      const updates = { email: 'john@example.com' }; // Same email

      const result = await service.updateProfile('user-1', updates);

      // Should still only have one email
      expect(result.fields.email.values).toHaveLength(1);
    });

    it('should handle update errors', async () => {
      mockPrisma.userProfile.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.updateProfile('user-1', { name: 'John' })).rejects.toThrow(
        'Failed to update profile'
      );
    });
  });

  // ==========================================================================
  // Refresh Profile Tests
  // ==========================================================================

  describe('refreshProfile', () => {
    it('should re-aggregate profile from documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"fullname":"John Doe"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.userProfile.upsert.mockResolvedValue({});

      const result = await service.refreshProfile('user-1');

      expect(result.fields.fullname).toBeDefined();
      expect(mockPrisma.userProfile.upsert).toHaveBeenCalled();
    });

    it('should handle refresh errors', async () => {
      mockPrisma.document.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.refreshProfile('user-1')).rejects.toThrow('Failed to refresh profile');
    });
  });

  // ==========================================================================
  // Delete Profile Tests
  // ==========================================================================

  describe('deleteProfile', () => {
    it('should delete user profile', async () => {
      mockPrisma.userProfile.delete.mockResolvedValue({});

      await service.deleteProfile('user-1');

      expect(mockPrisma.userProfile.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should handle deletion errors', async () => {
      mockPrisma.userProfile.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteProfile('user-1')).rejects.toThrow('Failed to delete profile');
    });

    it('should handle deleting non-existent profile', async () => {
      mockPrisma.userProfile.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.deleteProfile('user-999')).rejects.toThrow('Failed to delete profile');
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty field values', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"name":"","email":"   "}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Empty strings should be filtered out
      expect(result.fields.name).toBeUndefined();
      expect(result.fields.email).toBeUndefined();
    });

    it('should handle fields with only whitespace', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"note":"   \\n\\t  "}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Whitespace-only values should be filtered out
      expect(result.fields.note).toBeUndefined();
    });

    it('should handle very long field names', async () => {
      const longFieldName = 'a'.repeat(300);
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: `encrypted:{"${longFieldName}":"value"}`,
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Should normalize even very long field names (lowercase, no special chars)
      // Normalization keeps alphanumeric and underscores, so 300 'a's should remain 300 'a's
      const normalizedKey = 'a'.repeat(300);
      expect(result.fields[normalizedKey]).toBeDefined();
      expect(result.fields[normalizedKey].values).toContain('value');
    });

    it('should handle special characters in field names', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"email@address":"test@example.com","field#1":"value"}',
          confidence: 90,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      // Special characters should be removed or normalized
      expect(Object.keys(result.fields).some((k) => k.includes('@'))).toBe(false);
      expect(Object.keys(result.fields).some((k) => k.includes('#'))).toBe(false);
    });

    it('should handle confidence values of 0', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"fullname":"Unknown Person"}',
          confidence: 0,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.fullname).toBeDefined();
      expect(result.fields.fullname.confidence).toBe(0);
    });

    it('should handle confidence values of 100', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          extractedData: 'encrypted:{"fullname":"John Doe"}',
          confidence: 100,
          processedAt: new Date('2025-01-01'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.aggregateUserProfile('user-1');

      expect(result.fields.fullname).toBeDefined();
      expect(result.fields.fullname.confidence).toBe(100);
    });
  });
});
